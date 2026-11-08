// ErisPulse Dashboard – components/update-hint
// 更新完成后的重载引导条：告诉用户本次更新建议如何重载（框架→重启 / Dashboard→已自动重载）

var UPDATE_HINT_KEY = "ep_update_hint";
var UPDATE_HINT_TTL = 24 * 60 * 60 * 1000; // 超过 24h 的未处理提示自动过期

var _dashRefreshPromptShown = false;


// 触发框架硬重启（Dashboard 升级后应用新版的唯一入口；与 core/ws.js 共用）：
// 标记落 sessionStorage，进程重启完成后 WS 回连，ws.js 按标记直接强刷加载新版前端
export function requestDashboardReload() {
  try { sessionStorage.setItem("ep_fw_restarting", "1"); } catch (e) {}
  toast(t("restart_success"), "");
  api("/api/restart", { method: "POST" })
    .then(function (d) {
      if (d && d.success) {
        clearUpdateHint();
      } else {
        try { sessionStorage.removeItem("ep_fw_restarting"); } catch (e) {}
        toast(t("restart_failed"), "er");
      }
    })
    .catch(function () {
      // 进程约 0.5s 后退出，fetch 随之中断属预期：保留标记等待回连后刷新
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
    // Dashboard 更新：唯一按钮 = 硬重启框架应用新版（不自动重启，用户点击才执行）
    var reloadBtn = document.createElement("button");
    reloadBtn.className = "btn btn-primary btn-xs update-hint-restart";
    reloadBtn.textContent = t("update_hint_reload_page");
    reloadBtn.onclick = function () {
      requestDashboardReload();
    };
    actions.appendChild(reloadBtn);
  } else {
    // 框架更新：同一硬重启路径，点击立即执行
    var btn = document.createElement("button");
    btn.className = "btn btn-primary btn-xs update-hint-restart";
    btn.textContent = t("update_hint_restart");
    btn.onclick = function () {
      clearUpdateHint();
      requestDashboardReload();
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
  // 手动 pip 更新不走任务管道，同样拉起重启引导条（按钮 = 硬重启框架）
  _dashRefreshPromptShown = true;
  try { showUpdateHint("dashboard", v); } catch (e) {}
}
