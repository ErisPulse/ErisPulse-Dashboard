// ErisPulse Dashboard – components/update-hint
// 更新完成后的重载引导条：告诉用户本次更新建议如何重载（框架→重启 / Dashboard→已自动重载）

var UPDATE_HINT_KEY = "ep_update_hint";
var UPDATE_HINT_TTL = 24 * 60 * 60 * 1000; // 超过 24h 的未处理提示自动过期


// 触发 Dashboard 模块自重载（升级后新版生效的唯一入口；与 core/ws.js 共用）：
// 标记落 sessionStorage，重载完成广播 dashboard_reloaded 后按标记直接强刷
export function requestDashboardReload() {
  try { sessionStorage.setItem("ep_dash_reloading", "1"); } catch (e) {}
  toast(t("dashboard_reloading"), "");
  api("/api/modules/action", {
    method: "POST",
    body: JSON.stringify({ action: "reload", name: "Dashboard", type: "module" }),
  })
    .then(function (d) {
      if (d && d.success) {
        clearUpdateHint();
        // 兜底强刷：重载期间 WS 可能断开收不到 dashboard_reloaded 广播
        setTimeout(function () {
          try { sessionStorage.setItem("ep_dash_updated", "1"); } catch (e) {}
          location.href =
            location.pathname + "?_r=" + Date.now() + (location.hash || "");
        }, 4000);
      } else {
        // 404/旧后端：运行中的模块还没有重启入口，需重启框架后再试
        try { sessionStorage.removeItem("ep_dash_reloading"); } catch (e) {}
        toast(t("dashboard_reload_need_framework_restart"), "er");
      }
    })
    .catch(function () {
      try { sessionStorage.removeItem("ep_dash_reloading"); } catch (e) {}
      toast(t("restart_failed"), "er");
    });
}
window.requestDashboardReload = requestDashboardReload;

export function getUpdateHint() {
  try {
    var raw = localStorage.getItem(UPDATE_HINT_KEY);
    if (!raw) return null;
    var h = JSON.parse(raw);
    if (!h || !h.kind || Date.now() - (h.ts || 0) > UPDATE_HINT_TTL) {
      clearUpdateHint();
      return null;
    }
    return h;
  } catch (e) {
    return null;
  }
}

export function clearUpdateHint() {
  try {
    localStorage.removeItem(UPDATE_HINT_KEY);
  } catch (e) {}
  var el = document.getElementById("updateHintBar");
  if (el) el.remove();
}

// 记录并立即显示提示；kind: "framework" | "dashboard"
export function showUpdateHint(kind, version) {
  var hint = { kind: kind, version: version || "", ts: Date.now() };
  try {
    localStorage.setItem(UPDATE_HINT_KEY, JSON.stringify(hint));
  } catch (e) {}
  renderUpdateHint(hint);
}

// 页面刷新/重登后从 localStorage 恢复未处理的提示
export function restoreUpdateHint() {
  // Dashboard 更新确认刷新已完成：清掉提示并告知新版生效
  try {
    if (sessionStorage.getItem("ep_dash_updated")) {
      sessionStorage.removeItem("ep_dash_updated");
      clearUpdateHint();
      toast(t("dashboard_updated_done"), "ok");
      return;
    }
  } catch (e) {}
  renderUpdateHint(getUpdateHint());
}

export function renderUpdateHint(hint) {
  if (!hint) return;
  var old = document.getElementById("updateHintBar");
  if (old) old.remove();

  var isFw = hint.kind === "framework";
  var bar = document.createElement("div");
  bar.id = "updateHintBar";
  bar.className = "update-hint-bar";

  var icon = document.createElement("span");
  icon.className = "update-hint-icon";
  icon.innerHTML =
    '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';
  bar.appendChild(icon);

  var msg = document.createElement("span");
  msg.className = "update-hint-text";
  msg.textContent = isFw
    ? t("update_hint_framework").replace("{v}", hint.version || "")
    : t("update_hint_dashboard");
  bar.appendChild(msg);

  var actions = document.createElement("span");
  actions.className = "update-hint-actions";
  bar.appendChild(actions);

  if (!isFw) {
    // Dashboard 更新：主操作是重启 Dashboard 模块应用新版（升级后不自动重载）
    var reloadBtn = document.createElement("button");
    reloadBtn.className = "btn btn-primary btn-xs update-hint-restart";
    reloadBtn.textContent = t("update_hint_reload_page");
    reloadBtn.onclick = function () {
      requestDashboardReload();
    };
    actions.appendChild(reloadBtn);
  } else {
    // 框架更新：仅提供框架重启按钮
    var btn = document.createElement("button");
    btn.className = "btn btn-primary btn-xs update-hint-restart";
    btn.textContent = t("update_hint_restart");
    btn.onclick = async function () {
      var ok = await confirm2(t("restart"), t("restart_confirm"));
      if (!ok) return;
      clearUpdateHint();
      toast(t("restart_success"), "");
      var d = await api("/api/restart", { method: "POST" });
      if (!d || !d.success) toast(t("restart_failed"), "er");
    };
    actions.appendChild(btn);
  }

  var close = document.createElement("button");
  close.className = "btn-icon update-hint-close";
  close.setAttribute("aria-label", "Dismiss");
  close.innerHTML =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  close.onclick = clearUpdateHint;
  bar.appendChild(close);

  document.body.appendChild(bar);
  requestAnimationFrame(function () {
    bar.classList.add("show");
  });
}
export function promptDashboardRefresh() {
  if (_dashRefreshPromptShown) return;
  _dashRefreshPromptShown = true;
  try { showUpdateHint("dashboard", ""); } catch (e) {}
  toast(t("dashboard_updated_reload"), "ok");
}

// 版本回声：捕获"绕过商店的手动 pip 安装"（这类更新不走任务管道，无任何广播）。
// status.dashboard_version 与上次记录不同 → 提示重启模块应用后端新版；
// store 升级场景由升级任务确认流先行处理，确认重启后 seen 更新，此处不再重复弹。
export function echoDashboardVersion(v) {
  if (!v) return;
  var seen = null;
  try { seen = localStorage.getItem("ep_dash_seen_ver"); } catch (e) {}
  if (!seen) {
    try { localStorage.setItem("ep_dash_seen_ver", v); } catch (e) {}
    return;
  }
  if (seen === v) return;
  toast(t("dashboard_version_changed_title").replace("{v}", v), "ok");
  try { localStorage.setItem("ep_dash_seen_ver", v); } catch (e) {}
}
