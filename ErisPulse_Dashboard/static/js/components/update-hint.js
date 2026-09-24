// ErisPulse Dashboard – components/update-hint (auto-split from dash.js)
// 更新完成后的重载引导条：告诉用户本次更新建议如何重载（框架→重启 / Dashboard→已自动重载）

var UPDATE_HINT_KEY = "ep_update_hint";
var UPDATE_HINT_TTL = 24 * 60 * 60 * 1000; // 超过 24h 的未处理提示自动过期

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
  bar.appendChild(btn);

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
