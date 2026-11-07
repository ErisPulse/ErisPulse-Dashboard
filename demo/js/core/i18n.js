// ErisPulse Dashboard – core/i18n

const I18N = window.__EP_I18N__ || {};;

// 支持的前端语言码（与 res/i18n/*.js 字典键一致）
export const SUPPORTED_LANGS = ["zh", "en", "zh-TW", "ja", "ru"];

// 语言码归一化：把 zh-CN / zh_CN / zh-Hans / ja-JP 等变体收敛到字典键。
// 非法或空值返回 ""，由调用方决定回退策略。
export function normalizeLang(v) {
  if (!v) return "";
  var s = String(v).trim().toLowerCase();
  if (!s) return "";
  if (s.indexOf("zh") === 0) {
    if (s.indexOf("tw") !== -1 || s.indexOf("hk") !== -1 || s.indexOf("hant") !== -1)
      return "zh-TW";
    return "zh";
  }
  if (s.indexOf("ja") === 0) return "ja";
  if (s.indexOf("ru") === 0) return "ru";
  if (s.indexOf("en") === 0) return "en";
  return "";
}

export function detectLang() {
  const saved = normalizeLang(localStorage.getItem("ep_lang"));
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

// 自愈：历史版本或外部同步可能写入 zh-CN 之类的非法语言码，
// 归一化后回写，避免每次启动都落到兜底字典
try {
  var _storedLang = localStorage.getItem("ep_lang");
  if (_storedLang && _storedLang !== window.lang) {
    localStorage.setItem("ep_lang", window.lang);
  }
} catch (e) {}

// 取当前语言字典；语言码异常或字典缺失时逐级回退，
// 避免整站显示原始 i18n key（历史上存了 zh-CN 之类的非法码会触发）
function _dict() {
  var d = I18N[lang];
  if (d) return d;
  var norm = normalizeLang(lang);
  if (norm && I18N[norm]) return I18N[norm];
  return I18N.zh || I18N.en || null;
}

export function t(k) {
  var d = _dict();
  if (d && d[k]) return d[k];
  return k;
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
      transcript: function () {
        // 会话收件箱：动态加载页面模块并挂载到 window（与 router.js 的 go() loader 一致）
        return import("../pages/transcript.js").then(function (m) {
          Object.assign(window, m);
          return m.loadTranscript();
        });
      },
      "module-mgmt": loadModules,
      adapter: loadAdapterConfigPage,
      store: function () {
        loadStore();
      },
      packages: function () {
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
  // 语言字典缺失防御：资源文件加载/解析失败时跳过渲染（保留英文 key 兜底），
  // 不因 I18N[lang] 为 undefined 连锁崩溃调用方（如模块视图加载）
  const dict = _dict();
  if (!dict) return;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const k = el.getAttribute("data-i18n");
    if (dict[k]) el.textContent = dict[k];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const k = el.getAttribute("data-i18n-placeholder");
    if (dict[k]) el.placeholder = dict[k];
  });
  document.querySelectorAll("[data-i18n-option]").forEach((el) => {
    const k = el.getAttribute("data-i18n-option");
    if (dict[k]) el.textContent = dict[k];
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const k = el.getAttribute("data-i18n-title");
    if (dict[k]) el.title = dict[k];
  });
  const ah = document.getElementById("authHint");
  if (ah && dict.auth_hint) ah.innerHTML = dict.auth_hint;
  const titles = {
    zh: "ErisPulse 仪表盘",
    "zh-TW": "ErisPulse 儀表盤",
    ja: "ErisPulse ダッシュボード",
    ru: "ErisPulse Панель управления",
  };
  document.title = titles[lang] || "ErisPulse Dashboard";
  const htmlLangMap = { zh: "zh-CN", "zh-TW": "zh-TW", ja: "ja", ru: "ru" };
  document.documentElement.lang = htmlLangMap[lang] || "en";
  // 侧边栏折叠态无文字，用本地化页面名做悬浮气泡提示（跟随语言切换）
  document.querySelectorAll(".nav-item").forEach((el) => {
    const label = el.querySelector("span[data-i18n]");
    if (label) el.setAttribute("data-tip", label.textContent || "");
  });
  var nodeLabel = document.getElementById("nodeSelectorLabel");
  if (nodeLabel) {
    var nodeHeader = nodeLabel.closest(".node-selector-header");
    if (nodeHeader) nodeHeader.title = nodeLabel.textContent || "";
  }
  refreshConnBadgeText();
}

