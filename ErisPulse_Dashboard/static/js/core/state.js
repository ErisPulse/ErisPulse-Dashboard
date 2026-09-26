// ErisPulse Dashboard – 全局状态（自动拆分自 dash.js）
// 原顶层 var/let 与跨模块 const 提升为 window 属性，保持与拆分前全局语义一致
// 首次求值即执行（main.js 第一个 import），为后续模块提供全局状态

window.API = "/Dashboard";
window.TK = "__ep_tk__";
window.ws = null;
window.allEvents = [];
window._totalEventCount = 0;
window.platforms = [];
window.authed = false;
window._adapterLogos = {};
window.currentNode = "local";
window.nodeCapabilities = {};
window.nodeRuntimeInfo = {};
window._lastOverview = null;
window._badgeInst = null;
window._panelInst = null;
window._collapseTimer = null;
window._wsMeta = { connectedAt: 0, reconnects: 0, frames: 0, events: 0, url: "" };
window._wsInspTimer = null;
window.FIXED_UI_STYLE = "eris";
window.FONT_PRESETS = [
  { id: "system", name: "", display: "", body: "",
    preview: "Aa", weight: "600" },
];
window._remoteAuthToastTs = 0;
window._lastErrorToast = 0;
window.PAGE_REDIRECTS = {
  "framework-config": { page: "config", tab: "cfg-framework" },
  "adapter-config": { page: "adapter", tab: "cfg-adapter" },
  "module-config": { page: "adapter", tab: "cfg-module" },
  about: { page: "settings", tab: "settings-about" },
  "event-builder": { page: "event-stream", tab: "ev-builder" },
  modules: { page: "module-mgmt", tab: "mm-adapters" },
  "ext-modules": { page: "module-mgmt", tab: "mm-adapters" },
  "ext-store": { page: "store", tab: "st-browse" },
  "ext-packages": { page: "store", tab: "st-packages" },
  packages: { page: "store", tab: "st-packages" },
  lifecycle: { page: "logs", tab: "mon-lifecycle" },
  audit: { page: "logs", tab: "mon-audit" },
};
window._moduleViewLoaders = {};
window._moduleViewsLoaded = false;
window._loginLock = false;
window.EV_TYPE_ICONS = {
  message:
    '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
  notice:
    '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>',
  request:
    '<path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
  meta: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
};
window._storeTimer = undefined;
window._epAutoTimer = null;
window._selectedStoreTags = new Set();
window._selectedStoreCategory = "all";
window._storeTagMulti = null;
window._installTaskIds = new Map();
window._uploadState = { file: null, taskId: null, uploaded: false };
window._pkgDetailCache = {};
window._cfgSourceCM = null;
window._cfgTomlMod = null;
window._cfgSourceOk = true;
window._cfgValidateTimer = null;
window._cfgSourceDirty = false;
window._swipeX = 0;
window._swipeT = 0;
window.ACCENT_PRESETS = [
  "#4fa6de", // ErisPulse 默认蓝
  "#6750a4", // MD3 紫
  "#006b3c", // 深绿
  "#e8590c", // 橙
  "#c92a2a", // 红
  "#9c36b5", // 品红
  "#2c7bb6", // 深蓝
  "#495057", // 石板灰
];
window.FULL_THEME_VARS = [
  { key:'--bg-p', label:'主背景', group:'bg' },
  { key:'--bg-s', label:'次背景（侧栏）', group:'bg' },
  { key:'--bg-t', label:'卡片背景', group:'bg' },
  { key:'--tx-p', label:'主文字', group:'text' },
  { key:'--tx-s', label:'次要文字', group:'text' },
  { key:'--tx-t', label:'辅助文字', group:'text' },
  { key:'--bd', label:'边框', group:'border' },
  { key:'--bd-h', label:'边框高亮', group:'border' },
  { key:'--accent', label:'强调色', group:'accent' },
  { key:'--accent-h', label:'强调色悬浮', group:'accent' },
  { key:'--accent-fill', label:'强调填充', group:'accent' },
  { key:'--accent-fill-h', label:'强调填充悬浮', group:'accent' },
  { key:'--ok-c', label:'成功色', group:'semantic' },
  { key:'--er-c', label:'错误色', group:'semantic' },
  { key:'--wr-c', label:'警告色', group:'semantic' },
  { key:'--pr-c', label:'信息色', group:'semantic' },
  { key:'--sc-c', label:'次要信息色', group:'semantic' },
  { key:'--lk', label:'链接色', group:'other' },
  { key:'--focus-ring', label:'焦点环', group:'other' },
];
window.FULL_THEME_GROUPS = { bg:'背景', text:'文字', border:'边框', accent:'强调色', semantic:'语义色', other:'其他' };
window.HOME_PIN_DEFAULTS = ["config", "module-mgmt", "logs", "files"];
window._homePinsEditing = false;
window.MERGED_PAGE_TABS = {
  config: [
    { id: "cfg-editor", label: "configuration", i18n: "configuration" },
    {
      id: "cfg-framework",
      label: "framework_config",
      i18n: "framework_config",
    },
  ],
  "event-stream": [
    { id: "ev-stream", label: "event_stream", i18n: "event_stream" },
    { id: "ev-builder", label: "event_builder", i18n: "event_builder" },
  ],
  store: [
    { id: "st-browse", label: "store", i18n: "store" },
    { id: "st-packages", label: "pkg_manager", i18n: "pkg_manager" },
  ],
  logs: [
    { id: "mon-logs", label: "sys_logs", i18n: "sys_logs" },
    { id: "mon-lifecycle", label: "lifecycle", i18n: "lifecycle" },
    { id: "mon-audit", label: "audit_log", i18n: "audit_log" },
  ],
  "module-mgmt": [
    { id: "mm-adapters", label: "adapters", i18n: "adapters" },
    { id: "mm-modules", label: "modules_label", i18n: "modules_label" },
  ],
  adapter: [
    { id: "cfg-adapter", label: "adapter_config", i18n: "adapter_config" },
    { id: "cfg-module", label: "module_config", i18n: "module_config" },
  ],
};
window._dragPinIdx = null;
window._refreshTimer = null;
window._fwKnownKeys = null;
window._adapterConfigPlatforms = [];
window._adapterConfigCurrent = "";
window.EYE_OPEN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
window.EYE_CLOSED_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
window._fwVersions = [];
window._fwCurrentVer = "";
window._fwBadgeChecked = false;
window._changelogCache = null;
window._changelogCacheTs = 0;
window.CHANGELOG_BASE = "https://raw.githubusercontent.com/ErisPulse/ErisPulse/Develop/v2/CHANGELOG.md";
window.CHANGELOG_PROXIES = [
  "https://cdn.gh-proxy.org/",
  "https://ghproxy.com/",
  "https://gh-proxy.com/",
  "",
];
window.FW_CAT_MAP = [
  [/^(新增|added)/i, "added", "fw_cat_added"],
  [/^(优化|improved)/i, "improved", "fw_cat_improved"],
  [/^(变更|changed)/i, "changed", "fw_cat_changed"],
  [/^(修复|fixed|bug)/i, "fixed", "fw_cat_fixed"],
  [/^(移除|removed)/i, "removed", "fw_cat_removed"],
  [/^(废弃|弃用|deprecated)/i, "deprecated", "fw_cat_deprecated"],
  [/^(重构|refactored)/i, "refactored", "fw_cat_refactored"],
  [/^(安全|security)/i, "security", "fw_cat_security"],
  [/^(破坏|breaking|不兼容)/i, "breaking", "fw_cat_breaking"],
  [/^(测试|tests?)/i, "neutral", "fw_cat_tests"],
  [/^(文档|docs?|documentation)/i, "neutral", "fw_cat_docs"],
];
window._eventStreamLive = true;
window._wsEventBuffer = [];
window._wsFlushTimer = null;
window._moduleConfigNames = [];
window._moduleConfigCurrent = "";
window._paletteModules = null; // 全局搜索用的懒加载模块缓存（仅含声明了配置的模块）
window._cfgDirtyKeys = new Set(); // 组件配置表单的未保存字段 key（ackey）
window.builderState = {
  eventType: "message",
  detailType: "",
  platform: "",
  botId: "",
  customPlatform: false,
  customBot: false,
  messageSegments: [],
  optionalFields: [],
};
window._logAutoRefreshTimer = null;
window._logPaused = false;
window._logSortNewestBottom = true;
window._availableModules = new Set();
window._logStreamBuffer = [];
window._logStreamActive = false;
window._logStreamFlushTimer = null;
window._logDebounceTimer = undefined;
window._logLastModuleScan = 0;
window._rtMethod = "";
window._rtFullPath = "";
window._fmCurrentPath = ".";
window._fmShowHidden = false;
window._fmIsWindows = false;
window._fmEditor = null;
window._fmEditPath = "";
window._fmDirty = false;
window._fmContextMenu = null;
window._fmSearchTimer = undefined;
window.FM_EXT_COLORS = {
  py: "#4fa6de",
  pyw: "#4fa6de",
  js: "#e6c04c",
  mjs: "#e6c04c",
  ts: "#4fa6de",
  json: "#7bc96f",
  toml: "#e8854c",
  yml: "#c47bd0",
  yaml: "#c47bd0",
  md: "#8a8f98",
  txt: "#8a8f98",
  log: "#a0a4ab",
  sh: "#7bc96f",
  bat: "#6a6f77",
  cmd: "#6a6f77",
  css: "#7b8fe8",
  html: "#e86b5a",
  htm: "#e86b5a",
  xml: "#e88a5a",
  png: "#7b9fe8",
  jpg: "#7bc96f",
  jpeg: "#7bc96f",
  gif: "#c47bd0",
  webp: "#7b9fe8",
  svg: "#e6c04c",
  ico: "#7b9fe8",
  zip: "#e8854c",
  tar: "#e8854c",
  gz: "#e8854c",
  db: "#4a9e8a",
  sqlite: "#4a9e8a",
  sql: "#4a9e8a",
  _: "#9aa0a6",
};
window._tasks = [];
window._taskPanelOpen = false;
window._expandedTasks = new Set();
window._pkgCache = null;
window._pkgUpdateCache = null;
window._pkgDebounceTimer = undefined;
window._cmdData = null;
window._editCmdName = "";
window._editAliases = [];
window._editAllowed = [];
window._editBlocked = [];
window._editAclAllow = [];
window._editAclDeny = [];
window._cmdPlatforms = [];
window._masterPlatforms = [];
window._masterEntries = [];
window._masterFilter = "";
window._masterProviders = [];
window._scopeData = null;
window._scopePlatformBots = {};
window._scopeRegisteredModules = [];
window._scopeEditorTarget = null;
window._scopeMsWhite = null;
window._scopeMsBlock = null;
window._scopeIdnPolicy = "allow";
window._scopeTransferData = null;
window._scopeImportParsed = null;
window._scopeImportMode = "merge";
window._PAGE_CAPABILITY_MAP = {
  bots: "bots",
  topology: "topology",
  "event-stream": "events",
  "event-builder": "event_builder",
  commands: "commands",
  "module-mgmt": "modules",
  adapter: "config",
  "module-config": "config",
  store: "store",
  packages: "packages",
  logs: "logs",
  lifecycle: "lifecycle",
  audit: "audit",
  "api-routes": "routes",
  config: "config",
  "framework-config": "config_source",
  "adapter-config": "config",
  files: "files",
};
window._capKeys = [
  "status",
  "system",
  "adapters",
  "modules",
  "bots",
  "events",
  "config",
  "storage",
  "store",
  "packages",
  "logs",
  "lifecycle",
  "audit",
  "files",
  "commands",
  "event_builder",
  "config_source",
  "module_views",
  "performance",
  "routes",
  "message_stats",
  "framework_update",
];
window._topoRaw = null;
window._topoGraph = { nodes: [], edges: [], nodeById: {} };
window._topoSim = { running: false, raf: 0 };
window._topoView = { x: 0, y: 0, k: 1 };
window._topoHover = null;
window._topoDrag = null;
window._topoPanning = false;
window._topoSelected = null;
window._topoColors = {};
