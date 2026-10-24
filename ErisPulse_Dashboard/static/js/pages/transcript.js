// ErisPulse Dashboard – pages/transcript（会话收件箱）
// 依赖 SDK 的 sdk.transcript 能力（经 /api/transcript/* 暴露）；本页面为拉取式：
// 进入页面拉取一次 + 工具条手动刷新，不做 WebSocket 推送。

var _trInfo = null; // /api/transcript/info 结果（能力探测 + 保留策略）
var _trSessions = []; // 当前时间窗内的会话列表
var _trCurSession = ""; // 当前选中会话键（platform:detail_type:target_id）
var _trHours = 24; // 会话列表时间窗（小时）
var _trTraceId = ""; // 链路查看模式（非空时消息区展示 trace 结果）
var _trMsgSeq = 0; // 消息加载竞态令牌：发起加载前自增并捕获，返回后不一致即丢弃

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
  _trMsgSeq++; // 立即失效在途请求：防止快速切换时旧会话慢响应后到覆盖
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

// ════════════════ 消息文本渲染管线（媒体消息友好化） ════════════════
// SDK 存储侧的 text 有四种形态：① Python bytes repr（b'...'，媒体二进制被
// str() 化的产物）② OneBot 消息段 JSON 数组字符串 ③ CQ 码混排文本 ④ 纯文本。
// 这里按形态归一解析后输出转义的安全 HTML：媒体 → [图片] 等占位符，图片段
// 可渲染缩略图；url 仅放行 http(s)/data，javascript: 等一律拒绝。

function _trPh(label) {
  return '<span class="tr-ph">[' + esc(label) + "]</span>";
}

// 链接 url 白名单：仅 http(s)（其余降级为纯文本，javascript: 被拒绝）
function _trSafeLinkUrl(u) {
  var s = String(u || "").trim();
  return /^https?:\/\//i.test(s) ? s : "";
}

// base64:// 图片转 data URI（按解码后头部魔数推断 MIME，非图片字节返回空）
function _trBase64ToDataUri(u) {
  var b64 = String(u || "").slice(9).replace(/\s+/g, "");
  if (!b64) return "";
  var probe = b64.slice(0, 32);
  probe = probe.slice(0, probe.length - (probe.length % 4));
  var head = "";
  try {
    head = atob(probe);
  } catch (e) {
    return "";
  }
  var mime = "";
  if (head.indexOf("\x89PNG") === 0) mime = "image/png";
  else if (head.indexOf("\xff\xd8") === 0) mime = "image/jpeg";
  else if (head.indexOf("GIF8") === 0) mime = "image/gif";
  else if (head.indexOf("RIFF") === 0 && head.indexOf("WEBP") === 8)
    mime = "image/webp";
  else if (head.indexOf("BM") === 0) mime = "image/bmp";
  return mime ? "data:" + mime + ";base64," + b64 : "";
}

// 图片段渲染：base64:// → data URI 直接显示；http(s)/data: 显示缩略图；
// file:// 等本地路径浏览器不可读 → 仅占位。点击新窗口看原图。
function _trImgHtml(url) {
  var u = String(url || "").trim();
  var src = "";
  if (/^base64:\/\//i.test(u)) src = _trBase64ToDataUri(u);
  else if (/^https?:\/\//i.test(u)) src = u;
  else if (/^data:image\//i.test(u)) src = u;
  if (!src) return _trPh("图片");
  return (
    '<img class="tr-img" src="' +
    esc(src) +
    '" alt="' +
    esc("图片") +
    '" loading="lazy" onclick="openTranscriptImage(this.src)">'
  );
}

// 可点链接（http(s) 才渲染为 <a target=_blank>，其余转义为纯文本）
function _trLinkHtml(url, label) {
  var u = _trSafeLinkUrl(url);
  if (!u) return esc(String(label == null ? url : label));
  return (
    '<a href="' +
    esc(u) +
    '" target="_blank" rel="noopener noreferrer">' +
    esc(String(label || u)) +
    "</a>"
  );
}

// 从 bytes repr 内提取可打印文本中的 url（字符集已排除 repr 转义反斜杠/引号）
function _trExtractUrl(text) {
  var m = String(text || "").match(/https?:\/\/[^\s"'\\<>]+/);
  if (!m) return "";
  return m[0].replace(/[)\]}>,.!?'"]+$/, "");
}

// bytes repr 魔数 → 媒体类型占位（repr 中控制字节表现为 \xNN 转义文本，
// 个别实现也可能存 latin-1 解码后的原始字节，两种形态都匹配）
var _trBytesMagic = [
  [/\\x89PNG|\x89PNG/, "图片"],
  [/\\xff\\xd8|JFIF|\xff\xd8/, "图片"],
  [/GIF8/, "图片"],
  [/RIFF/, "视频"],
  [/OggS/, "音频"],
  [/ftyp/, "视频"],
  [/ID3/, "音频"],
  [/PK\\x03\\x04|PK\x03\x04/, "文件"],
];

// bytes repr 形态检测：b'/b" 开头，且含 repr 转义（\xNN、\n 等）或已知
// 魔数（避免把恰好以 b' 开头的普通文本误判）。结尾引号不作要求——存储侧
// 2000 字符截断可能把 repr 截在中途。
function _trLooksLikeBytesRepr(text) {
  var t = text.trim();
  if (t.length < 4) return false;
  var q = t.charAt(1);
  if (t.charAt(0) !== "b" || (q !== "'" && q !== '"')) return false;
  if (t.indexOf("\\") >= 0) return true;
  for (var i = 0; i < _trBytesMagic.length; i++) {
    if (_trBytesMagic[i][0].test(t)) return true;
  }
  return false;
}

function _trRenderBytesRepr(text) {
  var label = "二进制数据";
  for (var i = 0; i < _trBytesMagic.length; i++) {
    if (_trBytesMagic[i][0].test(text)) {
      label = _trBytesMagic[i][1];
      break;
    }
  }
  var html = _trPh(label);
  // repr 内嵌可打印文本（如 JSON 里含 url）→ 占位符附可点链接
  var url = _trExtractUrl(text);
  if (url) html += " " + _trLinkHtml(url, url);
  return html;
}

// CQ 码参数反转义（OneBot 转义规则：&#44; &#91; &#93; &amp;）
function _trCqUnescape(s) {
  return String(s || "")
    .replace(/&#44;/g, ",")
    .replace(/&#91;/g, "[")
    .replace(/&#93;/g, "]")
    .replace(/&amp;/g, "&");
}

function _trCqParams(raw) {
  var data = {};
  var parts = String(raw || "").split(",");
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (!p) continue;
    var eq = p.indexOf("=");
    if (eq < 0) continue;
    data[p.slice(0, eq).trim()] = _trCqUnescape(p.slice(eq + 1));
  }
  return data;
}

// CQ 码混排：CQ 码替换为占位/富媒体，普通文本段转义保留
//（CQ 参数键与 OneBot 段 data 键一致，复用 _trRenderSegment 的类型分派）
function _trRenderCq(text) {
  var re = /\[CQ:([^\],\s]+)((?:,[^\]]*)?)\]/g;
  var out = "";
  var last = 0;
  var m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out += esc(text.slice(last, m.index));
    out += _trRenderSegment({ type: m[1], data: _trCqParams(m[2]) });
    last = m.index + m[0].length;
  }
  if (last < text.length) out += esc(text.slice(last));
  return out;
}

// OneBot 消息段 JSON 数组检测：trim 后以 [ 开头、JSON.parse 成功、为非空
// 数组且全部元素含字符串 type 字段（避免把普通 JSON 文本误判为段数组）
function _trTryParseSegments(text) {
  var t = text.replace(/^\s+|\s+$/g, "");
  if (t.charAt(0) !== "[") return null;
  var arr;
  try {
    arr = JSON.parse(t);
  } catch (e) {
    return null;
  }
  if (!Array.isArray(arr) || !arr.length) return null;
  for (var i = 0; i < arr.length; i++) {
    var seg = arr[i];
    if (
      !seg ||
      typeof seg !== "object" ||
      Array.isArray(seg) ||
      typeof seg.type !== "string"
    )
      return null;
  }
  return arr;
}

// json/xml 卡片段 → 摘要卡片（尽力提取标题/描述，失败仅显示 [卡片]）
function _trCardHtml(data) {
  var raw = data.data != null ? data.data : data;
  var title = "";
  var desc = "";
  if (typeof raw === "string") {
    try {
      var obj = JSON.parse(raw);
      if (obj && typeof obj === "object") {
        title = obj.title || obj.prompt || "";
        desc = obj.desc || obj.text || "";
      }
    } catch (e) {
      title = "";
    }
  } else if (raw && typeof raw === "object") {
    title = raw.title || raw.prompt || "";
    desc = raw.desc || raw.text || "";
  }
  var body = title ? esc(String(title)) : "";
  if (desc && desc !== title) body += (body ? " · " : "") + esc(String(desc));
  return (
    '<div class="tr-card">' + _trPh("卡片") + (body ? " " + body : "") + "</div>"
  );
}

// 单个 OneBot 11 标准消息段渲染（未知类型 → [type 名]）
function _trRenderSegment(seg) {
  var type = String(seg.type || "");
  var data = seg.data && typeof seg.data === "object" ? seg.data : {};
  switch (type) {
    case "text":
      return esc(String(data.text == null ? "" : data.text));
    case "image":
      return _trImgHtml(data.url || data.file);
    case "record":
    case "voice":
      return _trPh("语音");
    case "video":
      return _trPh("视频");
    case "file": {
      var name = String(data.name || data.file_name || data.file || "");
      return _trPh(name ? "文件 " + name : "文件");
    }
    case "at":
      return "@" + esc(String(data.qq == null ? "" : data.qq));
    case "face":
      return _trPh("表情");
    case "reply": {
      // 引用回复：淡样式前缀，若段内携带被引消息则附其文本摘要
      var quoted = "";
      var content = data.content != null ? data.content : data.message;
      if (Array.isArray(content)) {
        for (var i = 0; i < content.length; i++) {
          var c = content[i];
          if (c && c.type === "text" && c.data && c.data.text)
            quoted += String(c.data.text);
        }
      } else if (typeof content === "string") {
        quoted = content;
      }
      return (
        '<div class="tr-reply">' +
        esc("回复：" + (quoted ? " " + quoted : "")) +
        "</div>"
      );
    }
    case "forward":
    case "node":
      return _trPh("合并转发");
    case "json":
    case "xml":
      return _trCardHtml(data);
    case "share":
      return (
        _trPh("链接") +
        (data.url ? " " + _trLinkHtml(data.url, String(data.title || data.url)) : "")
      );
    case "location":
      return _trPh("位置") + (data.title ? " " + esc(String(data.title)) : "");
    case "music":
      return _trPh("音乐") + (data.title ? " " + esc(String(data.title)) : "");
    case "contact":
      return _trPh("联系人卡片");
    case "rps":
      return _trPh("猜拳");
    case "dice":
      return _trPh("骰子");
    case "shake":
      return _trPh("窗口抖动");
    case "poke":
      return _trPh("戳一戳");
    case "anonymous":
      return _trPh("匿名消息");
    default:
      return _trPh(type || "未知消息");
  }
}

function _trRenderSegments(arr) {
  var out = "";
  for (var i = 0; i < arr.length; i++) out += _trRenderSegment(arr[i]);
  return out;
}

// 主入口：按形态归一渲染消息文本 → 安全 HTML（保留换行，外层 pre-wrap）
export function _trFormatMessageText(raw) {
  var text = raw == null ? "" : String(raw);
  if (!text) return "";
  if (_trLooksLikeBytesRepr(text)) return _trRenderBytesRepr(text);
  var segs = _trTryParseSegments(text);
  if (segs) return _trRenderSegments(segs);
  if (text.indexOf("[CQ:") >= 0) return _trRenderCq(text);
  return esc(text);
}

// 原图查看：http(s) 直接新窗口打开；data: URI 不允许顶层导航，
// 写入空白文档展示。导出供内联 onclick 经 window 挂载调用。
export function openTranscriptImage(src) {
  src = String(src || "");
  var w = window.open("", "_blank");
  if (!w) return;
  if (/^https?:\/\//i.test(src)) {
    w.location.href = src;
    return;
  }
  var doc = w.document;
  doc.open();
  doc.write(
    '<!doctype html><meta charset="utf-8"><title>' +
      esc("图片") +
      "</title>" +
      '<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#000">' +
      '<img src="' +
      src.replace(/"/g, "&quot;") +
      '" style="max-width:100%;max-height:100%;object-fit:contain">' +
      "</body>"
  );
  doc.close();
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

// 消息区加载骨架（三行 skeleton）：切换会话/链路时清空并立即给反馈
function _trShowListSkeleton(listEl) {
  var row = function (width, right) {
    return (
      '<div class="tr-skel' +
      (right ? " right" : "") +
      '"><div class="skeleton skeleton-text" style="width:' +
      width +
      '%"></div></div>'
    );
  };
  listEl.innerHTML = row(58, false) + row(76, true) + row(42, false);
}

export async function loadTranscriptMessages() {
  var card = _trEl("transcriptMsgsCard");
  var emptyEl = _trEl("transcriptDetailEmpty");
  var listEl = _trEl("transcriptMsgList");
  if (!card || !listEl) return;

  // 竞态防护：发起请求前捕获令牌，await 返回后不一致即为过期响应
  var seq = ++_trMsgSeq;

  if (_trTraceId) {
    // 链路查看模式：消息区展示按 trace_id 查询的出站记录
    if (emptyEl) emptyEl.style.display = "none";
    card.style.display = "";
    _trRenderTraceBanner();
    var head = _trEl("transcriptCurHead");
    if (head) head.innerHTML = "";
    _trShowListSkeleton(listEl);
    var dTrace = await api(
      "/api/transcript/trace?trace_id=" + encodeURIComponent(_trTraceId)
    );
    if (seq !== _trMsgSeq) return; // 过期响应：已有更新的加载，丢弃
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
  _trShowListSkeleton(listEl); // 即时反馈：先清空并显示骨架

  var d = await api(
    "/api/transcript?session=" +
      encodeURIComponent(_trCurSession) +
      "&n=100"
  );
  if (seq !== _trMsgSeq) return; // 过期响应：会话已切换，丢弃本次渲染
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
      _trFormatMessageText(m.text) +
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
