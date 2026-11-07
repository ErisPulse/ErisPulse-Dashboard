// ErisPulse Dashboard – components/lang-hint
// 界面语言与框架语言不一致时的提醒条：一键把框架语言同步为界面语言

var LANG_HINT_DISMISS_KEY = "ep_langhint_dismissed";

// 前端语言码 → 框架语言码（与 /api/i18n/language POST 的映射一致）
function _toFrameworkLang(dashLang) {
  if (dashLang === "zh") return "zh-CN";
  return dashLang;
}

export function checkFrameworkLangSync() {
  if (!authed) return;
  api("/api/i18n/language").then(function (d) {
    if (!d || !d.language) return;
    var dash = _toFrameworkLang(lang);
    var fw = d.language;
    if (dash === fw) {
      clearLangHint();
      return;
    }
    // 同一组合只提醒一次（任一侧变化会再次提醒）
    var dismissed = "";
    try {
      dismissed = localStorage.getItem(LANG_HINT_DISMISS_KEY) || "";
    } catch (e) {}
    if (dismissed === dash + ">" + fw) return;
    renderLangHint(dash, fw);
  });
}

export function clearLangHint() {
  var el = document.getElementById("langHintBar");
  if (el) el.remove();
}

function renderLangHint(dashLang, frameworkLang) {
  var old = document.getElementById("langHintBar");
  if (old) old.remove();

  var bar = document.createElement("div");
  bar.id = "langHintBar";
  bar.className = "update-hint-bar lang-hint-bar";

  var icon = document.createElement("span");
  icon.className = "update-hint-icon";
  icon.innerHTML =
    '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
  bar.appendChild(icon);

  var msg = document.createElement("span");
  msg.className = "update-hint-text";
  msg.textContent = t("lang_hint_text").replace("{sdk}", frameworkLang);
  bar.appendChild(msg);

  var actions = document.createElement("span");
  actions.className = "update-hint-actions";
  bar.appendChild(actions);

  var syncBtn = document.createElement("button");
  syncBtn.className = "btn btn-primary btn-xs";
  syncBtn.textContent = t("lang_hint_sync");
  syncBtn.onclick = async function () {
    syncBtn.disabled = true;
    var d = await api("/api/i18n/language", {
      method: "POST",
      body: JSON.stringify({ lang: lang }),
    });
    if (d && d.success) {
      toast(t("settings_sync_framework_done"), "ok");
      clearLangHint();
    } else {
      syncBtn.disabled = false;
      toast((d && d.error) || t("settings_sync_framework_fail"), "er");
    }
  };
  actions.appendChild(syncBtn);

  var close = document.createElement("button");
  close.className = "btn-icon update-hint-close";
  close.setAttribute("aria-label", "Dismiss");
  close.innerHTML =
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  close.onclick = function () {
    try {
      localStorage.setItem(
        LANG_HINT_DISMISS_KEY,
        dashLang + ">" + frameworkLang
      );
    } catch (e) {}
    clearLangHint();
  };
  actions.appendChild(close);

  document.body.appendChild(bar);
  requestAnimationFrame(function () {
    bar.classList.add("show");
  });
}
