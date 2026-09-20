// ErisPulse Dashboard – core/i18n (auto-split from dash.js)

const I18N = window.__EP_I18N__ || {};;

export function detectLang() {
  const saved = localStorage.getItem("ep_lang");
  if (saved) return saved;
  const bl = (
    navigator.language ||
    (navigator.languages && navigator.languages[0]) ||
    ""
  ).toLowerCase();
  if (
    bl.startsWith("zh-tw") ||
    bl.startsWith("zh-hk") ||
    bl.startsWith("zh-hant")
  )
    return "zh-TW";
  if (bl.startsWith("zh")) return "zh";
  if (bl.startsWith("ja")) return "ja";
  if (bl.startsWith("ru")) return "ru";
  return "en";
}

export function getLocale() {
  const m = { zh: "zh-CN", "zh-TW": "zh-TW", ja: "ja-JP", ru: "ru-RU" };
  return m[lang] || "en-US";
}

window.lang = detectLang();

export function t(k) {
  return I18N[lang]?.[k] || k;
}

export function toggleLang() {
  const langs = ["en", "zh", "zh-TW", "ja", "ru"];
  lang = langs[(langs.indexOf(lang) + 1) % langs.length];
  localStorage.setItem("ep_lang", lang);
  applyI18n();
  loadAll();
  var activePage = document.querySelector(".page.active");
  if (activePage) {
    var pageId = activePage.id.replace("p-", "");
    var loaders = {
      dashboard: window.refreshDashboard,
      bots: loadBots,
      "event-stream": loadEvents,
      "module-mgmt": loadModules,
      adapter: loadAdapterConfigPage,
      store: function () {
        loadStore();
        loadPackages();
        loadPackageUpdates();
      },
      logs: loadLogs,
      "api-routes": loadApiRoutes,
      commands: loadCommands,
      master: loadPermPage,
      topology: loadTopology,
      files: function () {
        fmBrowse(".");
      },
      config: loadConfig,
      settings: loadSettings,
      cluster: loadClusterPage,
      about: loadAbout,
    };
    if (loaders[pageId]) loaders[pageId]();
    else if (_moduleViewLoaders && _moduleViewLoaders[pageId])
      _runModuleViewLoader(pageId);
  }
  updateNodeSelectorUI();
}

export function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const k = el.getAttribute("data-i18n");
    if (I18N[lang][k]) el.textContent = I18N[lang][k];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const k = el.getAttribute("data-i18n-placeholder");
    if (I18N[lang][k]) el.placeholder = I18N[lang][k];
  });
  document.querySelectorAll("[data-i18n-option]").forEach((el) => {
    const k = el.getAttribute("data-i18n-option");
    if (I18N[lang][k]) el.textContent = I18N[lang][k];
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const k = el.getAttribute("data-i18n-title");
    if (I18N[lang][k]) el.title = I18N[lang][k];
  });
  const ah = document.getElementById("authHint");
  if (ah && I18N[lang].auth_hint) ah.innerHTML = I18N[lang].auth_hint;
  const titles = {
    zh: "ErisPulse 仪表盘",
    "zh-TW": "ErisPulse 儀表盤",
    ja: "ErisPulse ダッシュボード",
    ru: "ErisPulse Панель управления",
  };
  document.title = titles[lang] || "ErisPulse Dashboard";
  const htmlLangMap = { zh: "zh-CN", "zh-TW": "zh-TW", ja: "ja", ru: "ru" };
  document.documentElement.lang = htmlLangMap[lang] || "en";
  refreshConnBadgeText();
}

