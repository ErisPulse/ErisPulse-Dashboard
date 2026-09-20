// ErisPulse Dashboard – pages/events (auto-split from dash.js)

export function isHeartbeatEvent(e) {
  return (
    !!e &&
    e.type === "meta" &&
    (e.detail_type === "heartbeat" || e.alt_message === "heartbeat")
  );
}

export function evHtml(e, count) {
  const tm = new Date(e.time * 1000).toLocaleTimeString(getLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  var denseCls = getEventDensity() === "compact" ? " ev-dense" : "";
  var type = e.type || "meta";
  var ico = EV_TYPE_ICONS[type] || EV_TYPE_ICONS.meta;
  var hb = isHeartbeatEvent(e);
  return (
    '<div class="ev-item ev-' +
    esc(type) +
    denseCls +
    (hb ? ' ev-hb" data-platform="' + esc(e.platform || "") : "") +
    '" title="' +
    esc(t(type) || type) +
    '"><span class="ev-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    ico +
    '</svg></span><div class="ev-body"><div class="ev-title"><span class="ev-title-text">' +
    esc(privText(e.alt_message || e.detail_type || "-")) +
    "</span>" +
    (count > 1
      ? '<span class="ev-hb-count">&times;' + count + "</span>"
      : "") +
    "</div>" +
    (e.user_id
      ? '<div class="ev-sub">user: ' + esc(privText(e.user_id)) + "</div>"
      : "") +
    '</div><div class="ev-side"><span class="ev-plat">' +
    esc(e.platform || "-") +
    '</span><span class="ev-time">' +
    tm +
    "</span></div></div>"
  );
}

export function renderEventsHtml(events) {
  var html = "";
  var i = 0;
  while (i < events.length) {
    var e = events[i];
    if (isHeartbeatEvent(e)) {
      var n = 1;
      while (
        i + n < events.length &&
        isHeartbeatEvent(events[i + n]) &&
        events[i + n].platform === e.platform
      )
        n++;
      html += evHtml(e, n);
      i += n;
    } else {
      html += evHtml(e);
      i++;
    }
  }
  return html;
}

export function prependEventHtml(container, ev) {
  if (isHeartbeatEvent(ev)) {
    var first = container.firstElementChild;
    if (
      first &&
      first.classList.contains("ev-hb") &&
      first.dataset.platform === (ev.platform || "")
    ) {
      var c = (parseInt(first.dataset.count || "1", 10) || 1) + 1;
      first.dataset.count = c;
      var cnt = first.querySelector(".ev-hb-count");
      if (cnt) cnt.textContent = "\u00d7" + c;
      var tmEl = first.querySelector(".ev-time");
      if (tmEl)
        tmEl.textContent = new Date(ev.time * 1000).toLocaleTimeString(
          getLocale(),
          { hour: "2-digit", minute: "2-digit", second: "2-digit" },
        );
      return;
    }
  }
  container.insertAdjacentHTML("afterbegin", evHtml(ev));
}

export async function loadEvents() {
  const tf = document.getElementById("eTypeFilter")?.value || "";
  const pf = document.getElementById("ePlatFilter")?.value || "";
  const limit = getSetting("event_limit", "100");
  const u = new URLSearchParams({ limit });
  if (tf) u.set("type", tf);
  if (pf) u.set("platform", pf);
  const d = await api("/api/events?" + u);
  if (!d) return;
  allEvents = d.events || [];
  if (d.total_count !== undefined) _totalEventCount = d.total_count;
  document.getElementById("eventList").innerHTML = allEvents.length
    ? renderEventsHtml(allEvents.slice().reverse())
    : '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg><p>' +
      t("no_events") +
      "</p></div>";
  document.getElementById("dashEvents").innerHTML =
    renderEventsHtml(allEvents.slice(-20).reverse()) ||
    '<div style="padding:16px 18px;font-size:13px;color:var(--tx-s)">' +
      t("waiting_events") +
      "</div>";
  const ps = document.getElementById("ePlatFilter");
  if (ps && platforms.length) {
    const ex = new Set([...ps.options].map((o) => o.value));
    platforms.forEach((p) => {
      if (!ex.has(p)) {
        const o = document.createElement("option");
        o.value = p;
        o.textContent = p;
        ps.appendChild(o);
      }
    });
  }
}

export async function clearEvents() {
  if (!authed) return showLogin();
  const ok = await confirm2(t("clear_events"), t("clear_confirm"));
  if (!ok) return;
  await api("/api/events/clear", { method: "POST" });
  allEvents = [];
  _totalEventCount = 0;
  loadEvents();
}

export function _relativeTime(ts) {
  if (!ts) return t("never");
  var now = Date.now() / 1000;
  var diff = Math.floor(now - ts);
  if (diff < 10) return t("just_now");
  if (diff < 60) return diff + "s " + t("time_ago");
  if (diff < 3600) return Math.floor(diff / 60) + "min " + t("time_ago");
  if (diff < 86400) return Math.floor(diff / 3600) + "h " + t("time_ago");
  if (diff < 604800) return Math.floor(diff / 86400) + "d " + t("time_ago");
  return new Date(ts * 1000).toLocaleDateString(getLocale());
}

export function refreshEventViews() {
  var evl = document.getElementById("eventList");
  var dh = document.getElementById("dashEvents");
  var all = typeof allEvents !== "undefined" ? allEvents : [];
  if (evl && all.length) {
    var active = document.querySelector(".page.active");
    if (!active || active.id === "p-event-stream") {
      evl.innerHTML = renderEventsHtml(all.slice().reverse());
    }
  }
  if (dh) {
    var s = document.querySelector(".page.active");
    if (!s || s.id === "p-dashboard") {
      dh.innerHTML =
        renderEventsHtml(all.slice(-20).reverse()) ||
        '<div style="padding:16px 18px;font-size:13px;color:var(--tx-s)">' +
          t("waiting_events") +
          "</div>";
    }
  }
}

export function _flushEventStream() {
  if (!_wsEventBuffer.length) return;
  if (!_eventStreamLive) {
    _wsEventBuffer = [];
    return;
  }
  const el = document.getElementById("eventList");
  if (!el) {
    _wsEventBuffer = [];
    return;
  }
  const active = document.querySelector(".page.active");
  if (!active || active.id !== "p-event-stream") {
    _wsEventBuffer = [];
    return;
  }
  const em = el.querySelector(".empty-state");
  if (em) em.remove();
  _wsEventBuffer.forEach((ev) => {
    prependEventHtml(el, ev);
  });
  while (el.children.length > 100) el.removeChild(el.lastChild);
  if (getEventAutoTop()) {
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      window.scrollTo(0, 0);
    }
  }
  _wsEventBuffer = [];
}

export function toggleEventLive() {
  _eventStreamLive = !_eventStreamLive;
  const btn = document.getElementById("eventLiveBtn");
  if (btn) {
    btn.style.opacity = _eventStreamLive ? "" : "0.5";
    btn.title = _eventStreamLive
      ? t("live_events")
      : t("live_events") + " (" + t("module_disabled") + ")";
  }
}

const EVENT_TYPES = {
  message: {
    detail_types: ["private", "group", "channel", "guild", "thread", "user"],
    required_fields: ["message", "alt_message", "user_id"],
    optional_fields: [
      "group_id",
      "channel_id",
      "guild_id",
      "user_nickname",
      "message_id",
    ],
  },
  notice: {
    detail_types: [
      "friend_increase",
      "friend_decrease",
      "group_member_increase",
      "group_member_decrease",
    ],
    required_fields: ["user_id"],
    optional_fields: [
      "user_nickname",
      "group_id",
      "operator_id",
      "operator_nickname",
    ],
  },
  request: {
    detail_types: ["friend", "group"],
    required_fields: ["user_id", "comment"],
    optional_fields: ["user_nickname", "group_id"],
  },
  meta: {
    detail_types: ["connect", "disconnect", "heartbeat"],
    required_fields: [],
    optional_fields: [],
  },
};;

export async function initEventBuilder() {
  // 加载平台列表
  await loadPlatforms();
  // 设置默认详情类型
  updateDetailTypeOptions();
  // 初始化预览
  updateEventPreview();
  // 加载消息段类型
  await loadMessageSegmentTypes();
}

export async function loadPlatforms() {
  const d = await api("/api/adapters");
  if (!d) return;

  const platforms = d.adapters || [];
  const select = document.getElementById("platformSelect");
  select.innerHTML = '<option value="">' + t("select_platform") + "</option>";

  platforms.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.platform;
    opt.textContent = p.platform;
    select.appendChild(opt);
  });
}

export async function loadBotsForPlatform(platform) {
  const select = document.getElementById("botSelect");
  select.innerHTML = '<option value="">' + t("select_bot") + "</option>";

  if (!platform) return;

  const bots = await api("/api/bots");
  if (bots && bots.bots) {
    const platformBots = bots.bots.filter((b) => b.platform === platform);
    platformBots.forEach((b) => {
      const opt = document.createElement("option");
      opt.value = b.bot_id;
      opt.textContent =
        b.bot_id +
        (b.info?.user_name ? ` (${b.info.user_name})` : "") +
        " (" +
        t("online") +
        ")";
      select.appendChild(opt);
    });
  }
}

export function selectEventType(type) {
  builderState.eventType = type;

  // 更新按钮状态
  document.querySelectorAll(".type-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.dataset.type === type) btn.classList.add("active");
  });

  // 更新详情类型选项
  updateDetailTypeOptions();

  // 更新必填字段显示
  updateRequiredFields();

  // 更新消息构建器显示
  const msgCard = document.getElementById("messageBuilderCard");
  if (msgCard) {
    msgCard.style.display = type === "message" ? "block" : "none";
  }

  updateEventPreview();
}

export function updateDetailTypeOptions() {
  const select = document.getElementById("detailType");
  const types = EVENT_TYPES[builderState.eventType]?.detail_types || [];

  select.innerHTML =
    '<option value="">' + t("select_detail_type") + "</option>";
  types.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    select.appendChild(opt);
  });
}

export function onDetailTypeChange() {
  builderState.detailType = document.getElementById("detailType").value;
  updateEventPreview();
}

export function onPlatformChange() {
  const select = document.getElementById("platformSelect");
  builderState.platform = select.value;
  builderState.customPlatform = false;
  loadBotsForPlatform(builderState.platform);
  updateEventPreview();
}

export function onBotChange() {
  const select = document.getElementById("botSelect");
  builderState.botId = select.value;
  builderState.customBot = false;
  updateEventPreview();
}

export function toggleCustomPlatform() {
  const group = document.getElementById("customPlatformGroup");
  const select = document.getElementById("platformSelect");

  builderState.customPlatform = !builderState.customPlatform;
  group.style.display = builderState.customPlatform ? "block" : "none";
  select.disabled = builderState.customPlatform;

  if (builderState.customPlatform) {
    builderState.platform = "";
  }

  updateEventPreview();
}

export function toggleCustomBot() {
  const group = document.getElementById("customBotGroup");
  const select = document.getElementById("botSelect");

  builderState.customBot = !builderState.customBot;
  group.style.display = builderState.customBot ? "block" : "none";
  select.disabled = builderState.customBot;

  if (builderState.customBot) {
    builderState.botId = "";
  }

  updateEventPreview();
}

export function updateRequiredFields() {
  // 清空附加字段区域（user_id 和 alt_message 现在自动处理）
  const container = document.getElementById("optionalFields");
  container.innerHTML = "";
}

export function addOptionalField(key = "", value = "", label = "") {
  const container = document.getElementById("optionalFields");

  const div = document.createElement("div");
  div.className = "optional-field";
  div.dataset.key = key;
  // 确定 placeholder
  var ph = t("field_value_placeholder");
  if (label) {
    ph = t(label) || label;
  }
  div.innerHTML = `
        <input type="text" placeholder="${t("field_name_placeholder")}" value="${esc(key)}" onchange="updateOptionalFieldKey(this.parentElement)">
        <input type="text" placeholder="${esc(ph)}" value="${esc(value)}" onchange="updateOptionalFieldValue(this)">
        <button class="optional-field-remove" onclick="removeOptionalField(this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
        </button>
    `;

  container.appendChild(div);
  updateEventPreview();
}

export function updateOptionalFieldKey(div) {
  // 更新 data-key 以便 buildEventData 正确读取
  var keyInput = div.querySelector("input:first-child");
  if (keyInput) div.dataset.key = keyInput.value;
  updateEventPreview();
}

export function updateOptionalFieldValue(input) {
  updateEventPreview();
}

export function removeOptionalField(btn) {
  btn.closest(".optional-field").remove();
  updateEventPreview();
}

export async function loadMessageSegmentTypes() {
  const d = await api("/api/builder/segments");
  if (!d) return;

  window.messageSegmentTypes = d;
}

export function addMessageSegment() {
  if (!window.messageSegmentTypes) {
    toast(t("load_segments_first"), "er");
    return;
  }

  const types = window.messageSegmentTypes.standard_segments || [];

  if (types.length === 0) return;

  const container = document.getElementById("messageSegments");
  const segment = {
    type: types[0].type,
    fields: {},
  };

  const div = document.createElement("div");
  div.className = "message-segment";

  let fieldsHtml = "";
  types[0].fields.forEach((f) => {
    fieldsHtml += `
            <input type="text" placeholder="${f.name}"
                   data-field="${f.name}"
                   oninput="updateMessageSegment(this)"
                   ${f.required ? "required" : ""}>
        `;
  });

  div.innerHTML = `
        <select class="segment-type" onchange="changeSegmentType(this)">
            ${types.map((t) => `<option value="${t.type}">${t.name}</option>`).join("")}
        </select>
        <div class="segment-fields">${fieldsHtml}</div>
        <button class="segment-remove" onclick="removeMessageSegment(this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
        </button>
    `;

  container.appendChild(div);

  builderState.messageSegments.push(segment);
  updateEventPreview();
}

export function changeSegmentType(select) {
  const segmentDiv = select.closest(".message-segment");
  const index = Array.from(segmentDiv.parentElement.children).indexOf(
    segmentDiv,
  );
  const type = select.value;

  builderState.messageSegments[index].type = type;
  builderState.messageSegments[index].fields = {};

  // 更新字段输入框
  const segmentType = (window.messageSegmentTypes.standard_segments || []).find(
    (s) => s.type === type,
  );
  if (segmentType) {
    const fieldsDiv = segmentDiv.querySelector(".segment-fields");
    let fieldsHtml = "";
    segmentType.fields.forEach((f) => {
      fieldsHtml += `
                <input type="text" placeholder="${f.name}"
                       data-field="${f.name}"
                       oninput="updateMessageSegment(this)"
                       ${f.required ? "required" : ""}>
            `;
    });
    fieldsDiv.innerHTML = fieldsHtml;
  }

  updateEventPreview();
}

export function updateMessageSegment(input) {
  const segmentDiv = input.closest(".message-segment");
  const index = Array.from(segmentDiv.parentElement.children).indexOf(
    segmentDiv,
  );
  const fieldName = input.dataset.field;
  const value = input.value;

  builderState.messageSegments[index].fields[fieldName] = value;
  updateEventPreview();
}

export function removeMessageSegment(btn) {
  const segmentDiv = btn.closest(".message-segment");
  const index = Array.from(segmentDiv.parentElement.children).indexOf(
    segmentDiv,
  );

  segmentDiv.remove();
  builderState.messageSegments.splice(index, 1);
  updateEventPreview();
}

export function buildEventData() {
  const platform = builderState.customPlatform
    ? document.getElementById("platformCustom").value
    : builderState.platform;

  const botId = builderState.customBot
    ? document.getElementById("botCustom").value
    : builderState.botId;

  const event = {
    id: "builder_" + Date.now(),
    time: Math.floor(Date.now() / 1000),
    type: builderState.eventType,
    detail_type: builderState.detailType,
    platform: platform,
    self: {
      platform: platform,
      user_id: botId,
    },
  };

  // 添加消息段
  if (builderState.eventType === "message") {
    event.message = builderState.messageSegments.map((seg) => ({
      type: seg.type,
      data: seg.fields,
    }));
  }

  // 添加附加字段（用户手动添加的）
  const optionalFields = document.querySelectorAll(".optional-field");
  optionalFields.forEach((field) => {
    const inputs = field.querySelectorAll("input");
    if (inputs.length >= 2) {
      const key = inputs[0].value.trim();
      const value = inputs[1].value.trim();
      if (key && value) {
        event[key] = value;
      }
    }
  });

  // 添加会话信息
  const sessionType = document.getElementById("sessionType").value;
  const sessionId = document.getElementById("sessionId").value;

  if (sessionType === "private") {
    event.user_id = event.user_id || sessionId;
  } else if (sessionType === "group") {
    event.group_id = event.group_id || sessionId;
  } else if (sessionType === "channel") {
    event.channel_id = event.channel_id || sessionId;
  }

  // user_id 默认使用 bot 的 ID（OneBot12 标准字段）
  if (!event.user_id) {
    event.user_id = botId || "test_user";
  }

  // alt_message 自动从消息段生成
  if (builderState.eventType === "message") {
    if (!event.alt_message) {
      event.alt_message = (event.message || [])
        .filter((seg) => seg.type === "text" && seg.data && seg.data.text)
        .map((seg) => seg.data.text)
        .join("");
      // 没有文本段时给一个占位值，避免服务端校验拒绝
      if (!event.alt_message) event.alt_message = "[test message]";
    }
  }

  return event;
}

export function updateEventPreview() {
  const event = buildEventData();
  const preview = document.getElementById("eventJsonPreview");
  if (preview) {
    preview.textContent = JSON.stringify(event, null, 2);
  }
}

export function copyEventJson() {
  const event = buildEventData();
  const json = JSON.stringify(event, null, 2);

  _copyToClipboard(json)
    .then(() => {
      toast(t("copied_to_clipboard"), "ok");
    })
    .catch(() => {
      toast(t("copy_failed"), "er");
    });
}

export async function previewEvent() {
  const event = buildEventData();

  showOutputModal(
    t("event_preview"),
    [JSON.stringify(event, null, 2)],
    [{ label: t("ok"), value: true, primary: true }],
  );
}

export async function submitEvent() {
  const event = buildEventData();

  const result = await api("/api/builder/submit", {
    method: "POST",
    body: JSON.stringify(event),
  });

  if (result && result.success) {
    toast(t("submit_success"), "ok");
  } else {
    var errs = result?.errors || [result?.error || t("unknown_error")];
    showOutputModal(t("submit_failed"), errs, [
      { label: t("ok"), value: true, primary: true },
    ]);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  // 监听平台自定义输入
  const platformCustom = document.getElementById("platformCustom");
  if (platformCustom) {
    platformCustom.addEventListener("input", function () {
      builderState.platform = this.value;
      updateEventPreview();
    });
  }

  // 监听 Bot 自定义输入
  const botCustom = document.getElementById("botCustom");
  if (botCustom) {
    botCustom.addEventListener("input", function () {
      builderState.botId = this.value;
      updateEventPreview();
    });
  }

  // 监听会话类型和 ID
  const sessionType = document.getElementById("sessionType");
  const sessionId = document.getElementById("sessionId");
  if (sessionType) {
    sessionType.addEventListener("change", updateEventPreview);
  }
  if (sessionId) {
    sessionId.addEventListener("input", updateEventPreview);
  }

  // 按钮涟漪效果
  initRippleEffects();
});;

