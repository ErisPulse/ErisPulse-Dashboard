// ErisPulse Dashboard – pages/transcript（会话收件箱）
// 依赖 SDK 的 sdk.transcript 能力（经 /api/transcript/* 暴露）；本页面为拉取式：
// 进入页面拉取一次 + 工具条手动刷新，不做 WebSocket 推送。

var _trInfo = null; // /api/transcript/info 结果（能力探测 + 保留策略）
var _trSessions = []; // 当前时间窗内的会话列表
var _trCurSession = ""; // 当前选中会话键（platform:detail_type:target_id）
var _trHours = 24; // 会话列表时间窗（小时）
var _trTraceId = ""; // 链路查看模式（非空时消息区展示 trace 结果）

function _trEl(id) {
  return document.getElementById(id);
}

// 相对时间（复用全局 just_now / time_ago / never 文案）
function _trRelativeTime(ts) {
  if (!ts) return t("never");
  var diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 10) return t("just_now");
  if (diff < 60) return diff + "s " + t("time_ago");
  if (diff < 3600) return Math.floor(diff / 60) + "min " + t("time_ago");
  if (diff < 86400) return Math.floor(diff / 3600) + "h " + t("time_ago");
  if (diff < 604800) return Math.floor(diff / 86400) + "d " + t("time_ago");
  return new Date(ts * 1000).toLocaleDateString(getLocale());
}

// 三态切换：unsupported（SDK 无能力）/ disabled（未启用）/ main（正常主从视图）
function _trShowState(state) {
  var unsupported = _trEl("transcriptUnsupported");
  var disabled = _trEl("transcriptDisabled");
  var main = _trEl("transcriptMain");
  if (unsupported) unsupported.style.display = state === "unsupported" ? "" : "none";
  if (disabled) disabled.style.display = state === "disabled" ? "" : "none";
  if (main) main.style.display = state === "main" ? "" : "none";
}

// ════════════════ 页面入口（进入拉一次 + 手动刷新） ════════════════

export async function loadTranscript() {
  if (!authed) return showLogin();
  var d = await api("/api/transcript/info");
  if (!d || d.supported === false) {
    _trInfo = null;
    _trShowState("unsupported");
    return;
  }
  _trInfo = d;
  if (!d.enabled) {
    // 未启用：引导开启（附配置段提示与跳配置页入口）
    var hint = _trEl("transcriptDisabledHint");
    if (hint) {
      hint.innerHTML =
        esc(t("transcript_disabled_desc")) +
        '<code class="tr-cfg-hint">[ErisPulse.transcript]<br>enabled = true</code>';
    }
    _trShowState("disabled");
    return;
  }
  _trShowState("main");
  await loadTranscriptSessions();
  // 恢复上一次选中的会话（不在当前时间窗内则回到待选择态）
  var stillThere = _trSessions.some(function (s) {
    return s.session_key === _trCurSession;
  });
  if (stillThere) {
    selectTranscriptSession(_trCurSession, true);
  } else {
    _trCurSession = "";
    _trRenderDetailEmpty();
  }
}

// ════════════════ 会话列表（左栏） ════════════════

export function onTranscriptHoursChange(value) {
  var h = parseInt(value, 10);
  _trHours = isNaN(h) ? 24 : h;
  loadTranscriptSessions();
}

export async function loadTranscriptSessions() {
  var listEl = _trEl("transcriptSessionList");
  if (!listEl) return;
  var d = await api("/api/transcript/sessions?hours=" + _trHours);
  if (!d || d.supported === false) {
    listEl.innerHTML =
      '<div class="empty-state"><p>' + esc(t("server_error")) + "</p></div>";
    return;
  }
  _trSessions = (d.sessions || []).map(function (s) {
    // 后端 _api_transcript_sessions 的条目由三段键拆解而来，可能不带
    // session_key 字段；缺失时由 platform/detail_type/target_id 拼回，
    // 否则 data-key/onclick 为空，选中会话会静默失效（右栏不渲染）。
    if (!s.session_key) {
      s.session_key = [s.platform, s.detail_type, s.target_id]
        .filter(function (p) {
          return !!p;
        })
        .join(":");
    }
    return s;
  });
  var countEl = _trEl("transcriptSessionCount");
  if (countEl) countEl.textContent = String(_trSessions.length);
  if (!_trSessions.length) {
    listEl.innerHTML =
      '<div class="empty-state tr-session-empty"><p>' +
      esc(t("transcript_no_sessions")) +
      "</p></div>";
    return;
  }
  var html = "";
  for (var i = 0; i < _trSessions.length; i++) {
    var s = _trSessions[i];
    var platform = s.platform || "-";
    var target = s.target_id || "-";
    var summary = s.summary || t("transcript_summary_empty");
    html +=
      '<div class="tr-session' +
      (s.session_key === _trCurSession ? " active" : "") +
      '" data-key="' +
      esc(s.session_key) +
      '" onclick="selectTranscriptSession(\'' +
      _jsq(s.session_key) +
      "')\">" +
      '<div class="tr-session-top">' +
      '<span class="chip chip-pr tr-session-plat">' +
      esc(platform) +
      "</span>" +
      '<span class="tr-session-type">' +
      esc(s.detail_type || "-") +
      "</span>" +
      '<span class="tr-session-time">' +
      esc(_trRelativeTime(s.last_ts)) +
      "</span>" +
      "</div>" +
      '<div class="tr-session-target">' +
      esc(target) +
      "</div>" +
      '<div class="tr-session-summary">' +
      esc(summary) +
      "</div>" +
      '<div class="tr-session-meta">' +
      t("transcript_msg_count") +
      " " +
      (s.count || 0) +
      "</div>" +
      "</div>";
  }
  listEl.innerHTML = html;
}

export function selectTranscriptSession(key, keepMobile) {
  _trCurSession = key;
  _trTraceId = ""; // 选中会话即退出链路查看模式
  // 移动端单栏切换：进入详情
  if (!keepMobile) {
    var layout = _trEl("transcriptLayout");
    if (layout) layout.classList.add("show-detail");
  }
  var listEl = _trEl("transcriptSessionList");
  if (listEl) {
    listEl.querySelectorAll(".tr-session").forEach(function (el) {
      el.classList.toggle("active", el.getAttribute("data-key") === key);
    });
  }
  loadTranscriptMessages();
}

export function showTranscriptList() {
  var layout = _trEl("transcriptLayout");
  if (layout) layout.classList.remove("show-detail");
}

// ════════════════ 消息流（右栏） ════════════════

function _trRenderDetailEmpty() {
  var emptyEl = _trEl("transcriptDetailEmpty");
  var card = _trEl("transcriptMsgsCard");
  if (emptyEl) emptyEl.style.display = "";
  if (card) card.style.display = "none";
}

function _trSessionHeader(sessionKey) {
  var parts = String(sessionKey || "").split(":");
  var platform = parts[0] || "-";
  var detailType = parts[1] || "-";
  var targetId = parts[2] || "-";
  var head = _trEl("transcriptCurHead");
  if (head) {
    head.innerHTML =
      '<span class="chip chip-pr tr-session-plat">' +
      esc(platform) +
      "</span>" +
      '<span class="tr-detail-title">' +
      esc(targetId) +
      "</span>" +
      '<span class="tr-detail-sub">' +
      esc(detailType) +
      " · " +
      esc(sessionKey) +
      "</span>";
  }
}

function _trRenderTraceBanner() {
  var banner = _trEl("transcriptTraceBanner");
  if (!banner) return;
  if (_trTraceId) {
    banner.style.display = "";
    banner.innerHTML =
      '<span class="chip chip-pr">' +
      esc(t("transcript_trace_banner")) +
      "</span>" +
      '<span class="tr-trace-id">' +
      esc(_trTraceId) +
      "</span>" +
      '<button class="btn btn-secondary btn-xs" onclick="exitTranscriptTrace()">' +
      esc(t("transcript_trace_close")) +
      "</button>";
  } else {
    banner.style.display = "none";
    banner.innerHTML = "";
  }
}

export function exitTranscriptTrace() {
  _trTraceId = "";
  loadTranscriptMessages();
}

export async function loadTranscriptMessages() {
  var card = _trEl("transcriptMsgsCard");
  var emptyEl = _trEl("transcriptDetailEmpty");
  var listEl = _trEl("transcriptMsgList");
  if (!card || !listEl) return;

  if (_trTraceId) {
    // 链路查看模式：消息区展示按 trace_id 查询的出站记录
    if (emptyEl) emptyEl.style.display = "none";
    card.style.display = "";
    _trRenderTraceBanner();
    var head = _trEl("transcriptCurHead");
    if (head) head.innerHTML = "";
    var dTrace = await api(
      "/api/transcript/trace?trace_id=" + encodeURIComponent(_trTraceId)
    );
    var traceMsgs = dTrace && dTrace.supported !== false ? dTrace.messages || [] : [];
    if (!traceMsgs.length) {
      listEl.innerHTML =
        '<div class="empty-state"><p>' + esc(t("transcript_trace_empty")) + "</p></div>";
      return;
    }
    _trRenderMsgList(listEl, traceMsgs);
    return;
  }

  if (!_trCurSession) {
    _trRenderDetailEmpty();
    return;
  }
  if (emptyEl) emptyEl.style.display = "none";
  card.style.display = "";
  _trRenderTraceBanner();
  _trSessionHeader(_trCurSession);

  var d = await api(
    "/api/transcript?session=" +
      encodeURIComponent(_trCurSession) +
      "&n=100"
  );
  var msgs = d && d.supported !== false ? d.messages || [] : [];
  if (!msgs.length) {
    listEl.innerHTML =
      '<div class="empty-state"><p>' + esc(t("transcript_msg_empty")) + "</p></div>";
    return;
  }
  _trRenderMsgList(listEl, msgs);
}

function _trRenderMsgList(listEl, msgs) {
  var html = "";
  for (var i = 0; i < msgs.length; i++) {
    var m = msgs[i];
    var isBot = String(m.role || "") === "bot";
    var ts = Number(m.ts) || 0;
    var eid = String(m.event_id || "");
    var sender = "";
    var meta = m.meta;
    if (meta && typeof meta === "object" && meta.nickname) {
      sender = String(meta.nickname);
    } else if (m.sender) {
      sender = String(m.sender);
    }
    html +=
      '<div class="tr-msg ' +
      (isBot ? "bot" : "user") +
      '">' +
      '<div class="tr-bubble">' +
      (sender
        ? '<div class="tr-sender">' + esc(sender) + "</div>"
        : "") +
      '<div class="tr-text">' +
      esc(m.text || "") +
      "</div>" +
      '<div class="tr-meta">' +
      "<span>" +
      esc(formatTime(ts)) +
      "</span>" +
      (eid
        ? '<span class="tr-eid" onclick="copyTranscriptTraceId(this)" data-eid="' +
          esc(eid) +
          '" title="' +
          esc(t("transcript_trace_action")) +
          '">' +
          esc(eid) +
          "</span>"
        : "") +
      "</div>" +
      "</div>" +
      "</div>";
  }
  listEl.innerHTML = html;
  // 聊天语义：新消息沉底
  listEl.scrollTop = listEl.scrollHeight;
}

export function copyTranscriptTraceId(el) {
  var eid = el ? el.getAttribute("data-eid") : "";
  if (!eid) return;
  _trTraceId = eid;
  loadTranscriptMessages();
}

// ════════════════ 工具条动作 ════════════════

export async function openTranscriptTrace() {
  var v = await prompt2(
    t("transcript_trace_title"),
    t("transcript_trace_ph"),
    _trTraceId || ""
  );
  if (v === null) return;
  var tid = String(v).trim();
  if (!tid) {
    // 清空输入等价退出链路模式
    _trTraceId = "";
    loadTranscriptMessages();
    return;
  }
  _trTraceId = tid;
  loadTranscriptMessages();
}

export async function clearTranscriptSession() {
  if (!_trCurSession) return;
  var ok = await confirm2(t("transcript_clear_title"), t("transcript_clear_confirm"));
  if (!ok) return;
  var d = await api("/api/transcript/clear", {
    method: "POST",
    body: JSON.stringify({ session: _trCurSession }),
  });
  if (d && d.success) {
    toast(t("transcript_cleared"), "ok");
    _trTraceId = "";
    await loadTranscriptSessions();
    loadTranscriptMessages();
  } else {
    toast((d && d.error) || t("server_error"), "er");
  }
}

// ════════════════ 保留策略（模态表单） ════════════════

export async function openTranscriptRetention() {
  var d = await api("/api/transcript/retention");
  var ret = d && d.retention ? d.retention : {};
  var maxV = ret.max_per_session != null ? ret.max_per_session : 50;
  var ttlV = ret.ttl_hours != null ? ret.ttl_hours : 168;
  var overridden = ret.overridden || [];
  var html =
    '<div class="tr-retention-form">' +
    '<div class="tr-retention-field">' +
    "<label>" +
    esc(t("transcript_retention_max")) +
    "</label>" +
    '<input class="fw-input" id="trRetMax" type="number" min="0" step="1" value="' +
    esc(String(maxV)) +
    '">' +
    '<span class="tr-retention-hint">' +
    esc(t("transcript_retention_max_hint")) +
    "</span>" +
    "</div>" +
    '<div class="tr-retention-field">' +
    "<label>" +
    esc(t("transcript_retention_ttl")) +
    "</label>" +
    '<input class="fw-input" id="trRetTtl" type="number" min="0" step="1" value="' +
    esc(String(ttlV)) +
    '">' +
    '<span class="tr-retention-hint">' +
    esc(t("transcript_retention_ttl_hint")) +
    "</span>" +
    "</div>" +
    (overridden.length
      ? '<div class="tr-retention-note">' +
        esc(t("transcript_retention_overridden")) +
        "</div>"
      : "") +
    "</div>";
  var choice = await showModal(t("transcript_retention_title"), html, [
    { label: t("transcript_retention_reset"), value: "reset" },
    { label: t("cancel"), value: null },
    { label: t("ok"), value: "save", primary: true },
  ]);
  if (choice === null) return;

  if (choice === "reset") {
    var rr = await api("/api/transcript/retention", {
      method: "PUT",
      body: JSON.stringify({ reset: true }),
    });
    if (rr && rr.success) {
      toast(t("transcript_retention_saved"), "ok");
      loadTranscript();
    } else {
      toast((rr && rr.error) || t("server_error"), "er");
    }
    return;
  }

  var maxEl = _trEl("trRetMax");
  var ttlEl = _trEl("trRetTtl");
  var maxNum = parseInt(maxEl ? maxEl.value : "0", 10);
  var ttlNum = parseFloat(ttlEl ? ttlEl.value : "0");
  if (isNaN(maxNum) || maxNum < 0) maxNum = 0;
  if (isNaN(ttlNum) || ttlNum < 0) ttlNum = 0;
  var body = { max_per_session: maxNum, ttl_hours: ttlNum };
  var rs = await api("/api/transcript/retention", {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (rs && rs.success) {
    toast(t("transcript_retention_saved"), "ok");
    loadTranscript();
  } else {
    toast((rs && rs.error) || t("server_error"), "er");
  }
}
