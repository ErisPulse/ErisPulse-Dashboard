const API = "/Dashboard",
  TK = "__ep_tk__";
let ws = null,
  allEvents = [],
  _totalEventCount = 0,
  platforms = [],
  authed = false,
  _adapterLogos = {};
let currentNode = "local";
let nodeCapabilities = {};
let nodeRuntimeInfo = {};
let _lastOverview = null;

const _realFetch = window.fetch;
window.fetch = function (input, init) {
  if (
    currentNode !== "local" &&
    typeof input === "string" &&
    input.charAt(0) === "/" &&
    input.charAt(1) !== "/"
  ) {
    if (!input.startsWith(API + "/api/cluster/")) {
      input = API + "/api/cluster/proxy/" + currentNode + input;
    }
  }
  return _realFetch.call(this, input, init);
};

const I18N = window.__EP_I18N__ || {};

const STATUS_FRAMES = {
  conn: ["Disconnected.png", "Connected.png", "Connection Error  Broken.png"],
};

const STATUS_STATE_KEYS = {
  conn: [
    "status_conn_disconnected",
    "status_conn_connected",
    "status_conn_error",
  ],
};

const _statusRegistry = {};

function createStatusIcon(container, config) {
  const group = config.group;
  const size = config.size || "lg";
  const showLabel = config.showLabel !== false;
  const frames = STATUS_FRAMES[group];
  if (!frames) return null;

  const wrapper = document.createElement("div");
  wrapper.className = "status-icon-container";

  const framesDiv = document.createElement("div");
  framesDiv.className = "status-icon-frames size-" + size;

  frames.forEach(function (src, i) {
    var img = document.createElement("img");
    img.src = "/Dashboard/static/res/" + group + "/" + encodeURIComponent(src);
    img.alt = src.replace(/\.png$/, "");
    img.dataset.frame = String(i);
    if (i === 0) img.classList.add("active");
    framesDiv.appendChild(img);
  });

  wrapper.appendChild(framesDiv);

  var labelEl = null,
    stateEl = null;
  if (showLabel) {
    labelEl = document.createElement("div");
    labelEl.className = "status-icon-label";
    labelEl.textContent = t("status_icons_" + group) || group;
    wrapper.appendChild(labelEl);

    stateEl = document.createElement("div");
    stateEl.className = "status-icon-state";
    stateEl.textContent = t(STATUS_STATE_KEYS[group][0]) || "";
    wrapper.appendChild(stateEl);
  }

  container.appendChild(wrapper);

  var instance = {
    id: "si_" + group + "_" + Math.random().toString(36).substr(2, 6),
    group: group,
    container: container,
    wrapper: wrapper,
    framesDiv: framesDiv,
    stateEl: stateEl,
    currentFrame: 0,
    animating: false,
    _timers: [],
    destroy: function () {
      instance._timers.forEach(clearTimeout);
      instance._timers = [];
      if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
      delete _statusRegistry[instance.id];
    },
    setState: function (frameIndex, animate) {
      if (frameIndex < 0 || frameIndex >= frames.length) return;
      if (frameIndex === instance.currentFrame && !instance.animating) return;
      instance._timers.forEach(clearTimeout);
      instance._timers = [];
      instance.animating = false;

      if (animate) {
        _crtTransition(instance, frameIndex);
      } else {
        _setFrameDirect(instance, frameIndex);
      }
    },
  };

  _statusRegistry[instance.id] = instance;
  return instance;
}

function _setFrameDirect(inst, frameIndex) {
  var imgs = inst.framesDiv.querySelectorAll("img");
  imgs.forEach(function (img) {
    img.classList.remove("active", "crt-out", "crt-in");
    img.style.clipPath = "";
  });
  if (imgs[frameIndex]) imgs[frameIndex].classList.add("active");

  var beam = inst.framesDiv.querySelector(".scanline-beam");
  if (beam) beam.remove();
  inst.framesDiv.classList.remove("scanning");

  inst.currentFrame = frameIndex;
  if (inst.stateEl) {
    var key =
      STATUS_STATE_KEYS[inst.group] &&
      STATUS_STATE_KEYS[inst.group][frameIndex];
    if (key) inst.stateEl.textContent = t(key) || "";
  }
}

function _crtTransition(inst, newFrame) {
  if (inst.animating) {
    inst._timers.forEach(clearTimeout);
    inst._timers = [];
    var oldImgs = inst.framesDiv.querySelectorAll("img");
    oldImgs.forEach(function (img) {
      img.classList.remove("active", "crt-out", "crt-in");
      img.style.clipPath = "";
    });
    var oldBeam = inst.framesDiv.querySelector(".scanline-beam");
    if (oldBeam) oldBeam.remove();
    inst.framesDiv.classList.remove("scanning");
  }

  inst.animating = true;
  inst.framesDiv.classList.add("scanning");

  var imgs = inst.framesDiv.querySelectorAll("img");
  var oldFrame = inst.currentFrame;
  var oldImg = imgs[oldFrame];
  var newImg = imgs[newFrame];

  var sameFrame = oldImg === newImg;

  if (oldImg && !sameFrame) {
    oldImg.classList.remove("active", "crt-in");
    oldImg.classList.add("crt-out");
  }

  var beamOut = document.createElement("div");
  beamOut.className = "scanline-beam sweep-up";
  inst.framesDiv.appendChild(beamOut);

  inst._timers.push(
    setTimeout(function () {
      if (oldImg && !sameFrame) {
        oldImg.classList.remove("crt-out");
        oldImg.style.clipPath = "inset(100% 0 0 0)";
      }
      beamOut.remove();

      if (newImg) {
        newImg.classList.remove("crt-out");
        newImg.style.clipPath = "";
        newImg.classList.add("crt-in");
      }

      var beamIn = document.createElement("div");
      beamIn.className = "scanline-beam sweep-down";
      inst.framesDiv.appendChild(beamIn);

      inst._timers.push(
        setTimeout(function () {
          imgs.forEach(function (img) {
            img.classList.remove("crt-out", "crt-in", "active");
            img.style.clipPath = "";
          });
          if (imgs[newFrame]) imgs[newFrame].classList.add("active");

          beamIn.remove();
          inst.framesDiv.classList.remove("scanning");
          inst.currentFrame = newFrame;
          inst.animating = false;

          if (inst.stateEl) {
            var key =
              STATUS_STATE_KEYS[inst.group] &&
              STATUS_STATE_KEYS[inst.group][newFrame];
            if (key) inst.stateEl.textContent = t(key) || "";
          }
        }, 280),
      );
    }, 280),
  );
}

function updateStatusGroup(group, frameIndex, animate) {
  Object.keys(_statusRegistry).forEach(function (id) {
    var inst = _statusRegistry[id];
    if (inst.group === group) {
      inst.setState(frameIndex, animate !== false);
    }
  });
}

var _badgeInst = null,
  _panelInst = null,
  _collapseTimer = null;

function initHeaderStatusIcon() {
  var badgeContainer = document.getElementById("status-badge-icon");
  var panelContainer = document.getElementById("status-panel-icon");
  if (!badgeContainer || !panelContainer || badgeContainer.dataset.init === "1")
    return;
  badgeContainer.dataset.init = "1";

  _badgeInst = createStatusIcon(badgeContainer, {
    group: "conn",
    size: "custom",
    showLabel: false,
  });
  _panelInst = createStatusIcon(panelContainer, {
    group: "conn",
    size: "custom",
    showLabel: false,
  });

  _badgeInst.setState(0, false);
  _panelInst.setState(0, false);
}

function showConnPanel(title, desc) {
  var panel = document.getElementById("connPanel");
  var titleEl = document.getElementById("connPanelTitle");
  var descEl = document.getElementById("connPanelDesc");
  if (titleEl) titleEl.textContent = title || "";
  if (descEl) descEl.textContent = desc || "";
  if (panel) panel.classList.add("expanded");

  if (_collapseTimer) clearTimeout(_collapseTimer);
  _collapseTimer = setTimeout(function () {
    if (panel) panel.classList.remove("expanded");
  }, 2600);
}

function updateConnBadge(state) {
  var badge = document.getElementById("connBadge");
  var text = document.getElementById("connBadgeText");
  if (badge) {
    badge.classList.remove("connected", "disconnected");
    if (state === 1) badge.classList.add("connected");
    else if (state === 0) badge.classList.add("disconnected");
  }
  if (text) {
    var labels = [
      t("status_conn_disconnected"),
      t("status_conn_connected"),
      t("status_conn_error"),
    ];
    text.textContent = labels[state] || "";
  }
}

function connStateChange(state, animate) {
  if (_badgeInst) _badgeInst.setState(state, false);
  updateConnBadge(state);

  if (animate) {
    var titleKey = STATUS_STATE_KEYS.conn[state];
    showConnPanel(t(titleKey), t("status_icons_conn"));

    if (_panelInst) {
      _panelInst.setState(_panelInst.currentFrame, false);
      setTimeout(function () {
        if (_panelInst) _panelInst.setState(state, true);
      }, 400);
    }
  } else {
    if (_panelInst) _panelInst.setState(state, false);
  }
}

function createBotStatusIcon(botCard) {
  var container = document.createElement("div");
  container.className = "bot-card-status";
  botCard.appendChild(container);
  return createStatusIcon(container, {
    group: "conn",
    size: "bot",
    showLabel: false,
  });
}

function detectLang() {
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
function getLocale() {
  const m = { zh: "zh-CN", "zh-TW": "zh-TW", ja: "ja-JP", ru: "ru-RU" };
  return m[lang] || "en-US";
}
let lang = detectLang();
function t(k) {
  return I18N[lang]?.[k] || k;
}
function cmpVer(a, b) {
  var parseVer = function (v) {
    var m = v
      .replace(/^v/, "")
      .toLowerCase()
      .match(/^(\d+(?:\.\d+)*)(?:[-.]?(dev|a|alpha|b|beta|c|rc|pre|post)(?:[-.]?(\d+))?)?/);
    var nums = m && m[1] ? m[1].split(".").map(Number) : [];
    var tag = m && m[2] ? m[2] : "";
    var pnum = m && m[3] ? parseInt(m[3], 10) : 0;
    var rank;
    if (!tag) rank = Infinity;
    else if (tag === "dev") rank = -3;
    else if (tag === "a" || tag === "alpha") rank = -2;
    else if (tag === "b" || tag === "beta") rank = -1;
    else if (tag === "c" || tag === "rc" || tag === "pre") rank = 0;
    else if (tag === "post") rank = 1;
    else rank = Infinity;
    return { nums: nums, rank: rank, pnum: pnum };
  };
  var va = parseVer(a),
    vb = parseVer(b);
  var len = Math.max(va.nums.length, vb.nums.length);
  for (var i = 0; i < len; i++) {
    var na = va.nums[i] || 0,
      nb = vb.nums[i] || 0;
    if (na !== nb) return na > nb ? 1 : -1;
  }
  if (va.rank !== vb.rank) return va.rank > vb.rank ? 1 : -1;
  if (va.pnum !== vb.pnum) return va.pnum > vb.pnum ? 1 : -1;
  return 0;
}
function toggleLang() {
  const langs = ["en", "zh", "zh-TW", "ja", "ru"];
  lang = langs[(langs.indexOf(lang) + 1) % langs.length];
  localStorage.setItem("ep_lang", lang);
  applyI18n();
  loadAll();
  var activePage = document.querySelector(".page.active");
  if (activePage) {
    var pageId = activePage.id.replace("p-", "");
    var loaders = {
      dashboard: refreshDashboard,
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

function applyI18n() {
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

function refreshConnBadgeText() {
  var badge = document.getElementById("connBadge");
  var text = document.getElementById("connBadgeText");
  if (!badge || !text) return;
  var state = 0;
  if (badge.classList.contains("connected")) state = 1;
  else if (badge.classList.contains("disconnected")) state = 0;
  text.textContent = t(STATUS_STATE_KEYS.conn[state]);
}

function getTheme() {
  var s = localStorage.getItem("ep_theme");
  if (s === "light" || s === "dark") return s;
  // auto or unset — follow system
  return "auto";
}
function getEffectiveTheme() {
  var th = getTheme();
  if (th === "auto") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return th;
}
function applyTheme(th) {
  if (th === "auto") {
    document.documentElement.setAttribute("data-theme", "auto");
    // The actual CSS is driven by @media (prefers-color-scheme) on [data-theme="auto"]
  } else {
    document.documentElement.setAttribute("data-theme", th);
  }
  onThemeChanged();
}

function onThemeChanged() {
  var img = getSetting("bg_image", "");
  if (img) {
    applyBgImage(img); // 更新深/浅遮罩
    if (bgAutoThemeEnabled()) {
      extractImageColor(img, function (hex) {
        applyAccentColor(hex);
      });
    }
  } else if (bgAutoThemeEnabled()) {
    var col = getSetting("bg_color", "");
    if (col) applyAccentColor(deriveAccentFromBg(col));
  }
}
function toggleTheme() {
  var cur = getTheme();
  var next = cur === "light" ? "dark" : cur === "dark" ? "auto" : "light";
  localStorage.setItem("ep_theme", next);
  applyTheme(next);
}

/* 界面风格切换功能已移除：classic(MD3) 与 eris 视觉已合并。
   data-ui-style 对外契约保留，固定为 "eris"（见 module-view-registration.md）。 */
var FIXED_UI_STYLE = "eris";

function getUiStyle() {
  return FIXED_UI_STYLE;
}
function applyUiStyle(style) {
  document.documentElement.setAttribute("data-ui-style", FIXED_UI_STYLE);
}
function applySettingUiStyle(val) {
  applyUiStyle(FIXED_UI_STYLE);
  if (typeof syncSettingsUI === "function") syncSettingsUI();
}

var FONT_PRESETS = [
  { id: "sora", name: "Sora", display: '"Sora", sans-serif', body: '"Sora", sans-serif',
    preview: "Aa", weight: "600" },
  { id: "editorial", name: "Editorial", display: '"Instrument Serif", serif', body: '"Outfit", sans-serif',
    preview: "Aa", weight: "400" },
  { id: "spectral", name: "Spectral", display: '"Spectral", serif', body: '"DM Sans", sans-serif',
    preview: "Aa", weight: "500" },
  { id: "newsreader", name: "Newsreader", display: '"Newsreader", serif', body: '"Schibsted Grotesk", sans-serif',
    preview: "Aa", weight: "500" },
  { id: "mono", name: "Mono", display: '"JetBrains Mono", monospace', body: '"Outfit", sans-serif',
    preview: "Aa", weight: "500" },
];

function getFont() {
  return localStorage.getItem("ep_font") || "sora";
}
function applyFont(id) {
  var preset = FONT_PRESETS.find(function(f) { return f.id === id; });
  if (!preset) return;
  var root = document.documentElement;
  var bodyStack = preset.body.replace(/"(.*?)"/, function(_, n) {
    return '"' + n + '", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
  });
  var displayStack = preset.display.replace(/"(.*?)"/, function(_, n) {
    return '"' + n + '", "PingFang SC", "Microsoft YaHei", serif';
  });
  root.style.setProperty("--font-body", bodyStack);
  root.style.setProperty("--font-display", displayStack);
}
function applySettingFont(id) {
  localStorage.setItem("ep_font", id);
  applyFont(id);
  syncFontCards();
}
function initFontSelector() {
  var container = document.getElementById("fontSelector");
  if (!container) return;
  container.innerHTML = "";
  FONT_PRESETS.forEach(function(f) {
    var card = document.createElement("div");
    card.className = "font-card";
    card.dataset.font = f.id;
    card.onclick = function() { applySettingFont(f.id); };
    var preview = document.createElement("div");
    preview.className = "font-card-preview";
    preview.style.fontFamily = f.display;
    preview.style.fontWeight = f.weight;
    preview.textContent = f.preview;
    var label = document.createElement("div");
    label.className = "font-card-label";
    label.textContent = f.name;
    label.style.fontFamily = f.body;
    card.appendChild(preview);
    card.appendChild(label);
    container.appendChild(card);
  });
  syncFontCards();
}
function syncFontCards() {
  var cur = getFont();
  document.querySelectorAll(".font-card").forEach(function(c) {
    c.classList.toggle("active", c.dataset.font === cur);
  });
}

function getOled() {
  return localStorage.getItem("ep_oled") === "on";
}
function applyOled(on) {
  if (on) {
    document.documentElement.setAttribute("data-oled", "on");
  } else {
    document.documentElement.removeAttribute("data-oled");
  }
}
function applySettingOled(on) {
  localStorage.setItem("ep_oled", on ? "on" : "off");
  applyOled(on);
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("overlay").classList.toggle("show");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("overlay").classList.remove("show");
}

function esc(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function _jsq(s) {
  if (s == null) return "";
  return esc(
    String(s)
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
  );
}

let _remoteAuthToastTs = 0;
var _lastErrorToast = 0;
function api(path, opts) {
  const tk = localStorage.getItem(TK);
  const headers = {
    ...(opts?.headers || {}),
    ...(tk ? { Authorization: "Bearer " + tk } : {}),
  };
  if (opts?.body && !(opts.body instanceof FormData))
    headers["Content-Type"] = "application/json";
  return fetch(API + path, { ...opts, headers })
    .then((r) => {
      if (r.status === 401) {
        authed = false;
        localStorage.removeItem(TK);
        document.querySelector(".app").classList.remove("authed");
        showLogin();
        return null;
      }
      if (r.status === 502) {
        return r.json().then((d) => {
          if (
            d &&
            d.error === "remote_unauthorized" &&
            currentNode !== "local"
          ) {
            var now = Date.now();
            if (now - _remoteAuthToastTs > 5000) {
              _remoteAuthToastTs = now;
              toast(t("remote_unauthorized"), "er");
            }
          }
          return d;
        });
      }
      if (r.status >= 500) {
        var now = Date.now();
        if (now - _lastErrorToast > 5000) {
          _lastErrorToast = now;
          toast(t("server_error") + " (" + r.status + ")", "er");
        }
        return null;
      }
      return r.json();
    })
    .catch((e) => {
      var now = Date.now();
      if (now - _lastErrorToast > 5000) {
        _lastErrorToast = now;
        toast(t("connection_error"), "er");
      }
      return null;
    });
}

async function fetchAdapterLogos() {
  const d = await api("/api/adapter-logos");
  if (d && d.logos) _adapterLogos = d.logos;
}

function getAdapterLogo(name) {
  if (!name) return null;
  var low = name.toLowerCase(),
    best = null,
    bestLen = 0;
  for (var k in _adapterLogos) {
    if (low.indexOf(k.toLowerCase()) !== -1 && k.length > bestLen) {
      best = _adapterLogos[k];
      bestLen = k.length;
    }
  }
  return best;
}

function adapterLogoImg(name, size) {
  var s = size || 20;
  var src = getAdapterLogo(name);
  if (!src) return '<span style="width:' + s + 'px;height:' + s + 'px;display:inline-block;flex-shrink:0"></span>';
  return (
    '<img src="' +
    esc(src) +
    '" style="width:' +
    s +
    "px;height:" +
    s +
    'px;border-radius:4px;object-fit:contain;flex-shrink:0" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{style:{width:\'' +
    s +
    "px',height:'" +
    s +
    "px',display:'inline-block',flexShrink:'0'}}))\">"
  );
}

function _botAvatarFallback(el) {
  var logo = el.getAttribute("data-logo");
  if (logo && el.src !== logo) {
    el.removeAttribute("data-logo");
    el.src = logo;
    var container = el.parentElement;
    if (container) {
      container.classList.add("has-logo");
      container.classList.remove("bot-avatar");
      container.classList.add("bot-avatar");
    }
    return;
  }
  var container = el.parentElement;
  if (container) {
    container.classList.remove("has-logo");
  }
  el.outerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="8" width="14" height="10" rx="2"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/></svg>';
}

// 页面重定向：合并后的页面，旧 ID 重定向到宿主页 + 指定 tab
var PAGE_REDIRECTS = {
  "framework-config": { page: "config", tab: "cfg-framework" },
  "adapter-config": { page: "adapter", tab: "cfg-adapter" },
  "module-config": { page: "adapter", tab: "cfg-module" },
  "event-builder": { page: "event-stream", tab: "ev-builder" },
  modules: { page: "module-mgmt", tab: "mm-adapters" },
  "ext-modules": { page: "module-mgmt", tab: "mm-adapters" },
  "ext-store": { page: "store", tab: "st-browse" },
  "ext-packages": { page: "store", tab: "st-packages" },
  packages: { page: "store", tab: "st-packages" },
  lifecycle: { page: "logs", tab: "mon-lifecycle" },
  audit: { page: "logs", tab: "mon-audit" },
};

function go(name, el) {
  if (!authed) {
    showLogin();
    return;
  }
  // 处理重定向（合并后的页面）
  var redirect = PAGE_REDIRECTS[name];
  if (redirect) {
    var targetEl = el;
    // 如果传入的 el 是旧页面的 nav-item，找到宿主页的 nav-item
    if (el) {
      var hostNav = document.querySelector(
        '.nav-item[data-page="' + redirect.page + '"]',
      );
      if (hostNav) targetEl = hostNav;
    }
    go(redirect.page, targetEl);
    // 激活对应 tab
    var tabBtn = document.querySelector(
      "#" +
        redirect.page.replace(/-/g, "") +
        'TabBar [data-tab="' +
        redirect.tab +
        '"]',
    );
    if (!tabBtn) {
      // 通用查找：在任何 tab bar 中找 data-tab
      tabBtn = document.querySelector('[data-tab="' + redirect.tab + '"]');
    }
    if (tabBtn) tabBtn.click();
    return;
  }
  var requiredCap = _PAGE_CAPABILITY_MAP[name];
  if (requiredCap && !isCapabilitySupported(requiredCap)) {
    toast(t("unsupported_on_node") + ": " + t(name), "wr");
    return;
  }
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".page-loader-strip")
    .forEach((o) => o.remove());
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  const page = document.getElementById("p-" + name);
  if (page) {
    page.classList.add("active");
    page.classList.add("anim-enter");
    setTimeout(() => page.classList.remove("anim-enter"), 850);
  }
  if (el) {
    el.classList.add("active");
  } else {
    const navMatch = document.querySelector(
      '.nav-item[data-page="' + name + '"]',
    );
    if (navMatch) navMatch.classList.add("active");
  }
  closeSidebar();

  // 加载指示条
  if (page) {
    var strip = document.createElement("div");
    strip.className = "page-loader-strip";
    var navItem = el || document.querySelector('.nav-item[data-page="' + name + '"]');
    var iconTitle = "";
    if (navItem) {
      var spanEl = navItem.querySelector("span");
      if (spanEl) iconTitle = spanEl.textContent;
    }
    strip.innerHTML = '<span class="pl-label">' + (iconTitle || name) + "</span>";
    page.appendChild(strip);
  }
  var minDelay = new Promise(function (r) { setTimeout(r, 800); });

  const loaders = {
    dashboard: refreshDashboard,
    bots: loadBots,
    "event-stream": function () {
      loadEvents();
    },
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
  if (loaders[name]) {
    var result = loaders[name]();
    Promise.resolve(result).then(function () {
      return minDelay;
    }).then(function () {
      if (strip) { strip.classList.add("hide"); setTimeout(function () { strip.remove(); }, 350); }
    });
  } else if (_moduleViewLoaders && _moduleViewLoaders[name]) {
    var result2 = _runModuleViewLoader(name);
    Promise.resolve(result2 || minDelay)
      .then(function () {
        return minDelay;
      })
      .then(function () {
        if (strip) { strip.classList.add("hide"); setTimeout(function () { strip.remove(); }, 350); }
      });
  } else {
    minDelay.then(function () {
      if (strip) { strip.classList.add("hide"); setTimeout(function () { strip.remove(); }, 350); }
    });
  }

  if (name !== "logs" && (_logAutoRefreshTimer || _logStreamActive)) {
    if (_logAutoRefreshTimer) {
      clearInterval(_logAutoRefreshTimer);
      _logAutoRefreshTimer = null;
    }
    _logStreamActive = false;
    _logStreamBuffer = [];
    if (_logStreamFlushTimer) {
      clearTimeout(_logStreamFlushTimer);
      _logStreamFlushTimer = null;
    }
    const btn = document.getElementById("logAutoRefreshBtn");
    if (btn) btn.style.opacity = "0.5";
  }
}

let _moduleViewLoaders = {};

// 运行模块视图 loader：捕获同步/异步异常，并提示错误归属（模块 vs Dashboard）
function _runModuleViewLoader(name) {
  var loader = _moduleViewLoaders && _moduleViewLoaders[name];
  if (typeof loader !== "function") {
    console.warn(
      "[ErisPulse Dashboard] 模块视图 '" +
        name +
        "' 的 loader 未注册——通常是该模块的 js_content 未正确定义 loader 函数，属于模块自身问题。",
    );
    return null;
  }
  try {
    var result = loader();
    if (result && typeof result.catch === "function") {
      result.catch(function (err) {
        console.error(
          "[ErisPulse Dashboard] 模块视图 '" +
            name +
            "' 异步运行出错。这通常是该模块自身的问题（js_content / API / 业务逻辑），不是 Dashboard 的问题。错误如下：",
          err,
        );
      });
    }
    return result;
  } catch (err) {
    console.error(
      "[ErisPulse Dashboard] 模块视图 '" +
        name +
        "' 的 loader 抛出异常。这通常是该模块自身的问题（js_content 语法/引用错误），不是 Dashboard 的问题。错误如下：",
      err,
    );
    return null;
  }
}
let _moduleViewsLoaded = false;

async function loadModuleViews() {
  try {
    const d = await api("/api/views");
    if (!d || !d.views) return;
    _renderModuleViews(d.views);
    // 模块视图可能影响默认起始页选项，刷新下拉
    _fillDefaultPageSelect();
  } catch (e) {
    console.error("loadModuleViews error", e);
  }
}

// 解析模块视窗标题/分组标题文本（防御式：支持 {"i18n":key,"default":text} 引用）
function _viewText(val, fallback) {
  if (val == null) return fallback || "";
  if (typeof val === "string") return val;
  if (typeof val === "object") {
    if (val.default) return val.default;
    if (val.i18n) return val.i18n;
    return JSON.stringify(val);
  }
  return String(val);
}

function _renderModuleViews(views) {
  const sidebarNav = document.querySelector(".sidebar-nav");
  if (!sidebarNav) return;
  const contentDiv = document.querySelector(".content");
  if (!contentDiv) return;

  document
    .querySelectorAll(".nav-item[data-module-view]")
    .forEach((el) => el.remove());
  document
    .querySelectorAll(".page[data-module-view]")
    .forEach((el) => el.remove());
  document.querySelectorAll(".module-view-style").forEach((el) => el.remove());
  document.querySelectorAll(".module-view-script").forEach((el) => el.remove());
  document
    .querySelectorAll(".nav-group.module-view-group")
    .forEach((el) => el.remove());

  _moduleViewLoaders = {};

  const groups = {};
  views.forEach(function (v) {
    const g = v.group || "group_extensions";
    if (!groups[g]) groups[g] = [];
    groups[g].push(v);
  });

  views.forEach(function (v) {
    if (v.css_content) {
      const style = document.createElement("style");
      style.className = "module-view-style";
      style.setAttribute("data-view-id", v.id);
      style.textContent = v.css_content;
      document.head.appendChild(style);
    }
  });

  views.forEach(function (v) {
    if (v.js_content) {
      const script = document.createElement("script");
      script.className = "module-view-script";
      script.setAttribute("data-view-id", v.id);
      script.textContent = v.js_content;
      document.body.appendChild(script);
    }
  });

  views.forEach(function (v) {
    const pageId = "ext-" + v.id;
    const pageDiv = document.createElement("div");
    pageDiv.className = "page";
    pageDiv.id = "p-" + pageId;
    pageDiv.setAttribute("data-module-view", v.id);

    if (v.iframe_url) {
      var iframeSrc = v.iframe_url;
      if (currentNode !== "local" && iframeSrc.charAt(0) === "/") {
        var nInfo = nodeRuntimeInfo[currentNode] || {};
        if (nInfo.url) iframeSrc = nInfo.url + iframeSrc;
      }
      const sep = iframeSrc.indexOf("?") === -1 ? "?" : "&";
      pageDiv.innerHTML =
        '<iframe src="' +
        esc(iframeSrc) +
        sep +
        "token=" +
        encodeURIComponent(
          currentNode !== "local"
            ? (nodeRuntimeInfo[currentNode] || {}).token || ""
            : localStorage.getItem(TK) || "",
        ) +
        '" class="module-view-iframe" frameborder="0"></iframe>';
    } else if (v.html_content) {
      pageDiv.innerHTML = v.html_content;
    }

    contentDiv.appendChild(pageDiv);

    if (v.loader && typeof window[v.loader] === "function") {
      _moduleViewLoaders[pageId] = window[v.loader];
    } else if (v.loader) {
      console.warn(
        "[ErisPulse Dashboard] 模块视图 '" +
          v.id +
          "' 声明了 loader '" +
          v.loader +
          "' 但该函数未定义——通常是该模块的 js_content 执行失败（语法/引用错误），属于该模块自身的问题，不是 Dashboard 的问题。",
      );
    }
  });

  Object.keys(groups).forEach(function (groupKey) {
    const firstView = groups[groupKey][0];

    let navGroup;
    if (groupKey.startsWith("group_")) {
      const existingTitle = sidebarNav.querySelector(
        '.nav-group-title[data-i18n="' + groupKey + '"]',
      );
      if (existingTitle) {
        navGroup = existingTitle.closest(".nav-group");
      }
    }

    if (!navGroup) {
      navGroup = document.createElement("div");
      navGroup.className = "nav-group module-view-group";
      const groupTitle = document.createElement("div");
      groupTitle.className = "nav-group-title";
      groupTitle.onclick = function () {
        toggleNavGroup(this);
      };
      if (groupKey.startsWith("group_") && firstView.group_title) {
        // Use multi-language group_titles if available
        var gtText =
          (firstView.group_titles && firstView.group_titles[lang]) ||
          firstView.group_title;
        groupTitle.textContent = _viewText(gtText, groupKey);
        groupTitle.setAttribute("data-i18n", groupKey);
      } else if (groupKey.startsWith("group_")) {
        var i18nText = t(groupKey);
        groupTitle.textContent = i18nText !== groupKey ? i18nText : groupKey;
        groupTitle.setAttribute("data-i18n", groupKey);
      } else {
        // Use multi-language group_titles if available
        if (firstView.group_titles && firstView.group_titles[lang]) {
          groupTitle.textContent = _viewText(firstView.group_titles[lang], groupKey);
        } else {
          const locale = lang;
          if (locale === "zh" || locale === "zh-TW") {
            groupTitle.textContent = _viewText(
              firstView.group_title || firstView.group_title_en || groupKey,
              groupKey,
            );
          } else {
            groupTitle.textContent = _viewText(
              firstView.group_title_en || firstView.group_title || groupKey,
              groupKey,
            );
          }
        }
      }
      navGroup.appendChild(groupTitle);
      sidebarNav.insertBefore(
        navGroup,
        sidebarNav.querySelector(".sidebar-footer"),
      );
      var savedStates = null;
      try {
        savedStates = JSON.parse(localStorage.getItem("ep_nav_group_states") || "{}");
      } catch (e) {}
      if (savedStates && savedStates[groupKey]) {
        navGroup.classList.add("collapsed");
      }
    }

    groups[groupKey].forEach(function (v) {
      const pageId = "ext-" + v.id;
      const navItem = document.createElement("a");
      navItem.className = "nav-item";
      navItem.setAttribute("data-page", pageId);
      navItem.setAttribute("data-module-view", v.id);
      navItem.onclick = function () {
        go(pageId, this);
      };

      const iconSvg =
        v.icon_svg ||
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>';
      navItem.innerHTML = iconSvg;

      const span = document.createElement("span");
      // Use multi-language titles dict if available
      if (v.titles && v.titles[lang]) {
        span.textContent = _viewText(v.titles[lang], v.id);
      } else {
        const locale = lang;
        if (locale === "zh" || locale === "zh-TW") {
          span.textContent = _viewText(v.title || v.title_en || v.id, v.id);
        } else {
          span.textContent = _viewText(v.title_en || v.title || v.id, v.id);
        }
      }
      navItem.appendChild(span);
      navGroup.appendChild(navItem);
    });
  });

  _moduleViewsLoaded = true;

  // 动态视图加载后，刷新主页 pin（已 pin 的动态视图会自动出现）
  applyI18n();
  renderHomePins();
}

function _removeModuleView(viewId) {
  const pageId = "ext-" + viewId;
  const page = document.getElementById("p-" + pageId);
  if (page) page.remove();
  const navItem = document.querySelector(
    '.nav-item[data-module-view="' + viewId + '"]',
  );
  if (navItem) {
    const group = navItem.closest(".nav-group");
    navItem.remove();
    if (
      group &&
      group.classList.contains("module-view-group") &&
      group.querySelectorAll(".nav-item").length === 0
    ) {
      group.remove();
    }
  }
  document
    .querySelectorAll('.module-view-style[data-view-id="' + viewId + '"]')
    .forEach(function (el) {
      el.remove();
    });
  document
    .querySelectorAll('.module-view-script[data-view-id="' + viewId + '"]')
    .forEach(function (el) {
      el.remove();
    });
  delete _moduleViewLoaders[pageId];

  renderHomePins();
}

function showModal(title, text, actions) {
  return new Promise((r) => {
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalText").innerHTML = text;
    const ac = document.getElementById("modalActions");
    ac.innerHTML = "";
    actions.forEach((a) => {
      const b = document.createElement("button");
      b.className = "btn " + (a.primary ? "btn-primary" : "btn-secondary");
      b.textContent = a.label;
      b.onclick = () => {
        document.getElementById("modalOv").classList.remove("show");
        r(a.value);
      };
      ac.appendChild(b);
    });
    document.getElementById("modalOv").classList.add("show");
  });
}
function confirm2(title, text) {
  return showModal(title, text, [
    { label: t("cancel"), value: false },
    { label: t("ok"), value: true, primary: true },
  ]);
}
function prompt2(title, text, defaultValue) {
  return new Promise(function (r) {
    var input = document.createElement("input");
    input.className = "fw-input modal-input";
    input.type = "text";
    input.value = defaultValue || "";
    input.placeholder = text || "";
    input.style.width = "100%";
    input.style.boxSizing = "border-box";

    var textEl = document.getElementById("modalText");
    textEl.innerHTML = "";
    textEl.appendChild(input);
    document.getElementById("modalTitle").textContent = title;

    var ac = document.getElementById("modalActions");
    ac.innerHTML = "";
    var cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-secondary";
    cancelBtn.textContent = t("cancel");
    cancelBtn.onclick = function () {
      document.getElementById("modalOv").classList.remove("show");
      r(null);
    };
    ac.appendChild(cancelBtn);

    var okBtn = document.createElement("button");
    okBtn.className = "btn btn-primary";
    okBtn.textContent = t("ok");
    okBtn.onclick = function () {
      document.getElementById("modalOv").classList.remove("show");
      r(input.value);
    };
    ac.appendChild(okBtn);

    document.getElementById("modalOv").classList.add("show");
    setTimeout(function () {
      input.focus();
      input.select();
    }, 100);
  });
}
function toggleNavGroup(titleEl) {
  titleEl.parentElement.classList.toggle("collapsed");
  // 保存状态
  saveNavGroupStates();
}

function saveNavGroupStates() {
  var enabled = localStorage.getItem("ep_remember_groups") !== "false";
  if (!enabled) return;
  var state = {};
  document.querySelectorAll(".sidebar-nav .nav-group").forEach(function (g) {
    var title = g.querySelector(".nav-group-title");
    if (!title) return;
    var key = title.getAttribute("data-i18n") || "";
    if (key) state[key] = g.classList.contains("collapsed");
  });
  localStorage.setItem("ep_nav_group_states", JSON.stringify(state));
}

function restoreNavGroupStates() {
  var enabled = localStorage.getItem("ep_remember_groups") !== "false";
  if (!enabled) return;
  var raw = localStorage.getItem("ep_nav_group_states");
  if (!raw) return;
  try {
    var state = JSON.parse(raw);
    document.querySelectorAll(".sidebar-nav .nav-group").forEach(function (g) {
      var title = g.querySelector(".nav-group-title");
      if (!title) return;
      var key = title.getAttribute("data-i18n") || "";
      if (state[key]) g.classList.add("collapsed");
    });
  } catch (e) {}
}

function applySettingRememberGroups(enabled) {
  localStorage.setItem("ep_remember_groups", enabled);
  if (!enabled) {
    localStorage.removeItem("ep_nav_group_states");
  } else {
    saveNavGroupStates();
  }
}
function alert2(title, text) {
  return showModal(title, text, [
    { label: t("ok"), value: true, primary: true },
  ]);
}

function showOutputModal(title, lines, actions) {
  return new Promise((r) => {
    document.getElementById("outputTitle").textContent = title;
    const pre = document.getElementById("outputPre");
    pre.textContent = (lines || []).join("\n") || "(no output)";
    const ac = document.getElementById("outputActions");
    ac.innerHTML = "";
    actions.forEach((a) => {
      const b = document.createElement("button");
      b.className = "btn " + (a.primary ? "btn-primary" : "btn-secondary");
      b.textContent = a.label;
      b.onclick = () => {
        document.getElementById("outputOv").classList.remove("show");
        r(a.value);
      };
      ac.appendChild(b);
    });
    document.getElementById("outputOv").classList.add("show");
  });
}

function showAdapterReloadLog(module, displayName) {
  var overlay = document.getElementById("outputOv");
  document.getElementById("outputTitle").textContent =
    (displayName || module) + " — 重载日志";
  var pre = document.getElementById("outputPre");
  var origMaxHeight = pre.style.maxHeight;
  pre.style.maxHeight = "400px";
  pre.textContent = "正在收集日志...\n";

  var ac = document.getElementById("outputActions");
  ac.innerHTML = "";
  var closeBtn = document.createElement("button");
  closeBtn.className = "btn btn-primary";
  closeBtn.textContent = t("ok");
  ac.appendChild(closeBtn);

  var pollTimer = null;
  var startTime = Date.now();
  var seenLogs = new Set();
  var stopped = false;

  function stopPolling() {
    stopped = true;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  closeBtn.onclick = function () {
    stopPolling();
    pre.style.maxHeight = origMaxHeight;
    overlay.classList.remove("show");
  };

  overlay.classList.add("show");

  async function fetchLogs() {
    if (stopped) return;
    try {
      var data = await api(
        "/api/logs?module=" + encodeURIComponent(module) + "&limit=80",
      );
      if (!data || !data.logs) return;

      var entries = data.logs.slice().reverse();
      var newLines = [];
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        var key = e.full || e.timestamp + "|" + e.message;
        if (!seenLogs.has(key)) {
          seenLogs.add(key);
          newLines.push(e.message || "");
        }
      }

      if (newLines.length > 0) {
        if (pre.textContent.indexOf("正在收集日志") === 0) {
          pre.textContent = "";
        }
        pre.textContent += newLines.join("\n") + "\n";
        pre.scrollTop = pre.scrollHeight;
      }
    } catch (e) {}

    if (Date.now() - startTime > 15000) {
      stopPolling();
      pre.textContent += "\n— 日志收集已自动停止 —";
    }
  }

  fetchLogs();
  pollTimer = setInterval(fetchLogs, 800);
}

function toast(msg, type) {
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(12px);padding:10px 24px;border-radius:8px;font-size:14px;font-family:inherit;box-shadow:0 8px 24px rgba(0,0,0,.15);z-index:9999;opacity:0;transition:opacity .25s ease,transform .25s cubic-bezier(.4,0,.2,1);pointer-events:none";
  if (type === "ok") {
    el.style.background = "var(--ok-bg)";
    el.style.color = "var(--ok-c)";
    el.style.border = "1px solid var(--ok-bd)";
  } else if (type === "er") {
    el.style.background = "var(--er-bg)";
    el.style.color = "var(--er-c)";
    el.style.border = "1px solid var(--er-bd)";
  } else {
    el.style.background = "var(--bg-t)";
    el.style.color = "var(--tx-p)";
    el.style.border = "1px solid var(--bd)";
  }
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "translateX(-50%) translateY(0)";
  });
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateX(-50%) translateY(12px)";
    setTimeout(() => el.remove(), 250);
  }, 2500);
}

function showLogin() {
  document.querySelector(".app").classList.remove("authed");
  document.getElementById("loginOv").classList.add("show");
  const ls = document.getElementById("loginLangSelect");
  if (ls) ls.value = lang;
  document.getElementById("loginInput").focus();
}
function closeLogin() {
  document.getElementById("loginOv").classList.remove("show");
}
let _loginLock = false;
async function doLogin() {
  if (_loginLock) return;
  _loginLock = true;
  const inp = document.getElementById("loginInput");
  const btn = inp.closest(".login-card").querySelector(".btn-primary");
  btn.disabled = true;
  btn.style.opacity = ".5";
  const v = inp.value.trim();
  if (!v) {
    _loginLock = false;
    btn.disabled = false;
    btn.style.opacity = "";
    return;
  }
  const d = await api("/api/auth", {
    method: "POST",
    body: JSON.stringify({ token: v }),
  });
  if (d && d.success) {
    localStorage.setItem(TK, v);
    authed = true;
    closeLogin();
    document.querySelector(".app").classList.add("authed");
    // 先加载仪表盘主体，外观延迟加载（不阻塞访问）
    loadAll();
    wsConnect();
    restartRefreshTimer();
    loadClusterNodes();
    loadGlobalAppearance();
    applyDefaultPageOnLogin();
    toast(t("logged_in"), "ok");
  } else {
    if (!authed) localStorage.removeItem(TK);
    toast(t("invalid_token"), "er");
    inp.select();
  }
  btn.disabled = false;
  btn.style.opacity = "";
  _loginLock = false;
}

function doLogout() {
  localStorage.removeItem(TK);
  authed = false;
  closeSettings();
  document.querySelector(".app").classList.remove("authed");
  showLogin();
}

function evHtml(e) {
  const tm = new Date(e.time * 1000).toLocaleTimeString(getLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  var denseCls = getEventDensity() === "compact" ? " ev-dense" : "";
  return (
    '<div class="ev-item' +
    denseCls +
    '"><span class="ev-badge ' +
    e.type +
    '">' +
    esc(e.type) +
    '</span><div style="flex:1;min-width:0"><div>' +
    esc(privText(e.alt_message || e.detail_type || "-")) +
    "</div>" +
    (e.user_id
      ? '<div style="font-size:11px;color:var(--tx-s)">user: ' +
        esc(privText(e.user_id)) +
        "</div>"
      : "") +
    '</div><span style="font-size:11px;color:var(--tx-s);flex-shrink:0">' +
    esc(e.platform) +
    '</span><span style="font-size:11px;color:var(--tx-t);flex-shrink:0">' +
    tm +
    "</span></div>"
  );
}

async function refreshDashboard() {
  const d = await api("/api/status");
  if (!d) return;
  const fw = d.framework || {};
  window._fwStatus = fw;
  updateAboutCard();
  // 存储服务器平台（用于判断更新行为，而非客户端浏览器平台）
  window._serverPlatform = fw.platform || "";
  window._serverIsWindows = !!fw.is_windows;
  document.getElementById("fwDesc").textContent =
    "ErisPulse v" + fw.version + " | Python " + fw.python_version;
  document.getElementById("fwInfo").textContent = "ErisPulse v" + fw.version;
  const ad = d.adapters || {},
    mo = d.modules || {};
  let ob = 0;
  Object.values(ad).forEach((a) =>
    Object.values(a.bots || {}).forEach((b) => {
      if (b.status === "online") ob++;
    }),
  );
  document.getElementById("statGrid").innerHTML =
    statCard(
      Object.keys(ad).length,
      t("adapters"),
      '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
      "adapter",
    ) +
    statCard(
      Object.keys(mo).filter((k) => mo[k]).length,
      t("modules_label"),
      '<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
      "module-mgmt",
    ) +
    statCard(
      ob,
      t("online_bots"),
      '<rect x="5" y="8" width="14" height="10" rx="2"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/><line x1="12" y1="4" x2="12" y2="8"/><circle cx="9" cy="4" r="1.5" fill="currentColor"/><circle cx="15" cy="4" r="1.5" fill="currentColor"/>',
      "bots",
    ) +
    statCard(
      _totalEventCount,
      t("total_events"),
      '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>',
      "event-stream",
    );

  renderHomePins();

  let aH = "";
  Object.entries(ad).forEach(([n, i]) => {
    const on = i.status === "started";
    aH +=
      '<div class="list-row">' +
      adapterLogoImg(n, 20) +
      '<span class="chip ' +
      (on ? "chip-ok" : "chip-er") +
      '" style="min-width:60px;justify-content:center">' +
      esc(i.status) +
      '</span><span style="flex:1;font-weight:500">' +
      esc(n) +
      '</span><span style="font-size:12px;color:var(--tx-s)">' +
      Object.keys(i.bots || {}).length +
      " bots</span></div>";
  });
  document.getElementById("dashAdapters").innerHTML =
    aH ||
    '<div style="padding:16px 18px;font-size:13px;color:var(--tx-s)">' +
      t("no_adapters") +
      "</div>";

  let mH = "";
  Object.entries(mo).forEach(([n, l]) => {
    mH +=
      '<div class="list-row"><span class="chip ' +
      (l ? "chip-ok" : "chip-er") +
      '" style="min-width:60px;justify-content:center">' +
      (l ? t("active") : t("inactive")) +
      '</span><span style="flex:1;font-weight:500">' +
      esc(n) +
      "</span></div>";
  });
  document.getElementById("dashModules").innerHTML =
    mH ||
    '<div style="padding:16px 18px;font-size:13px;color:var(--tx-s)">' +
      t("no_modules") +
      "</div>";

  platforms = Object.keys(ad);
}

function statCard(v, label, icon, page) {
  const tag = page
    ? '<div class="stat-card is-link" onclick="go(' + "'" + page + "'" + ')">'
    : '<div class="stat-card">';
  return (
    tag +
    (icon
      ? '<svg class="stat-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
        icon +
        "</svg>"
      : "") +
    '<div class="stat-val">' +
    v +
    '</div><div class="stat-label">' +
    esc(label) +
    "</div></div>"
  );
}

async function loadEvents() {
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
    ? allEvents.slice().reverse().map(evHtml).join("")
    : '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg><p>' +
      t("no_events") +
      "</p></div>";
  document.getElementById("dashEvents").innerHTML =
    allEvents.slice(-20).reverse().map(evHtml).join("") ||
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

async function clearEvents() {
  if (!authed) return showLogin();
  const ok = await confirm2(t("clear_events"), t("clear_confirm"));
  if (!ok) return;
  await api("/api/events/clear", { method: "POST" });
  allEvents = [];
  _totalEventCount = 0;
  loadEvents();
}

function _relativeTime(ts) {
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

function _capabilityBadges(caps) {
  if (!caps || !caps.length) return "";
  var popular = ["Text", "Image", "Voice", "Markdown", "Video"];
  var shown = caps.filter(function (c) {
    return popular.indexOf(c) >= 0;
  });
  var rest = caps.length - shown.length;
  var html = shown
    .map(function (c) {
      return '<span class="bot-cap-tag">' + esc(c) + "</span>";
    })
    .join("");
  if (rest > 0)
    html += '<span class="bot-cap-tag bot-cap-more">+' + rest + "</span>";
  return '<div class="bot-caps">' + html + "</div>";
}

function _adapterStatusBadge(status) {
  var map = {
    started: { cls: "chip-ok", label: "running" },
    starting: { cls: "chip-wr", label: "starting" },
    stopping: { cls: "chip-wr", label: "stopping" },
    stopped: { cls: "chip-er", label: "stopped" },
    unknown: { cls: "chip-default", label: "unknown" },
  };
  var s = map[status] || map.unknown;
  return (
    '<span class="chip ' +
    s.cls +
    ' adapter-status-chip">' +
    esc(s.label) +
    "</span>"
  );
}

async function loadBots() {
  const d = await api("/api/bots");
  if (!d) return;
  const b = d.bots || [];
  document.getElementById("botGrid").innerHTML = b.length
    ? b
        .map((x) => {
          const i = x.info || {},
            nm = i.user_name || i.nickname || x.bot_id,
            av = i.avatar;
          const la = _relativeTime(x.last_active);
          const on = x.status === "online";
          const logoSrc = getAdapterLogo(x.platform);
          const useLogo = !av && logoSrc;
          const avCls = useLogo ? "bot-avatar has-logo" : "bot-avatar";
          const capsHtml = _capabilityBadges(x.capabilities);
          const adStatusHtml = _adapterStatusBadge(x.adapter_status);
          let avatarHtml;
          if (av) {
            avatarHtml =
              '<img src="' +
              esc(av) +
              '" data-logo="' +
              (logoSrc ? esc(logoSrc) : "") +
              '" onerror="_botAvatarFallback(this)">';
          } else if (logoSrc) {
            avatarHtml =
              '<img src="' +
              esc(logoSrc) +
              '" onerror="_botAvatarFallback(this)">';
          } else {
            avatarHtml =
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="8" width="14" height="10" rx="2"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/></svg>';
          }
          return (
            '<div class="bot-card" data-bot-status="' +
            (on ? "online" : "offline") +
            '"><div class="' +
            avCls +
            '">' +
            avatarHtml +
            '</div><div class="bot-card-body"><div class="bot-name-row">' +
            '<span class="bot-name">' +
            esc(nm) +
            "</span>" +
            '</div><div class="bot-platform-row">' +
            esc(x.platform) +
            " / " +
            '<code class="bot-id-code">' +
            esc(x.bot_id) +
            "</code>" +
            "</div>" +
            capsHtml +
            '</div><div class="bot-card-right"><div class="bot-status-row">' +
            '<span class="dot" style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:' +
            (on ? "var(--ok-c)" : "var(--tx-t)") +
            '"></span><span style="font-size:12px;font-weight:500;color:' +
            (on ? "var(--ok-c)" : "var(--tx-s)") +
            '">' +
            (on ? t("online") : t("offline")) +
            '</span></div><div class="bot-last-active">' +
            esc(la) +
            "</div>" +
            adStatusHtml +
            "</div></div>"
          );
        })
        .join("")
    : '<div class="empty-state" style="grid-column:span 3"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="8" width="14" height="10" rx="2"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/></svg><h3>' +
      t("no_bots") +
      '</h3><button class="empty-action" onclick="go(\'adapter\')">' +
      t("adapter_config") +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg></button></div>';
}

async function loadModules() {
  const d = await api("/api/modules");
  if (!d) return;
  const items = d.modules || [];
  const search = (
    document.getElementById("moduleSearch")?.value || ""
  ).toLowerCase();
  const status = document.getElementById("moduleStatus")?.value || "all";
  const adapters = items.filter((m) => {
    if (m.type !== "adapter") return false;
    if (search && !m.name.toLowerCase().includes(search)) return false;
    if (status === "active" && !m.loaded) return false;
    if (status === "inactive" && m.loaded) return false;
    if (status === "loaded" && !m.loaded) return false;
    if (status === "disabled" && m.enabled) return false;
    return true;
  });
  const modules = items.filter((m) => {
    if (m.type !== "module") return false;
    if (search && !m.name.toLowerCase().includes(search)) return false;
    if (status === "active" && !m.loaded) return false;
    if (status === "inactive" && m.loaded) return false;
    if (status === "loaded" && !m.loaded) return false;
    if (status === "disabled" && m.enabled) return false;
    return true;
  });
  document.getElementById("adapterCount").textContent = adapters.length;
  document.getElementById("moduleCount").textContent = modules.length;
  // Update summary stats
  var allItems = d.modules || [];
  var allAdapters = allItems.filter(function (m) {
    return m.type === "adapter";
  });
  var allModules = allItems.filter(function (m) {
    return m.type === "module";
  });
  var activeCount = allItems.filter(function (m) {
    return m.loaded;
  }).length;
  var disabledCount = allItems.filter(function (m) {
    return !m.enabled;
  }).length;
  var el;
  if ((el = document.getElementById("statAdapterTotal")))
    el.textContent = allAdapters.length;
  if ((el = document.getElementById("statModuleTotal")))
    el.textContent = allModules.length;
  if ((el = document.getElementById("statActive")))
    el.textContent = activeCount;
  if ((el = document.getElementById("statDisabled")))
    el.textContent = disabledCount;
  var mmAd = document.getElementById("mmAdaptersCount");
  if (mmAd) mmAd.textContent = allAdapters.length;
  var mmMo = document.getElementById("mmModulesCount");
  if (mmMo) mmMo.textContent = allModules.length;
  document.getElementById("adapterList").innerHTML = adapters.length
    ? adapters.map((m) => renderPluginRow(m, true)).join("")
    : '<div style="padding:16px 18px;font-size:13px;color:var(--tx-s)">' +
      t("no_adapters") +
      "</div>";
  document.getElementById("moduleList").innerHTML = modules.length
    ? modules.map((m) => renderPluginRow(m, false)).join("")
    : '<div style="padding:16px 18px;font-size:13px;color:var(--tx-s)">' +
      t("no_modules") +
      ' <a class="empty-action" style="margin-top:0;margin-left:6px;padding:3px 10px;font-size:12px" onclick="go(\'store\')">' +
      t("store") +
      "</a></div>";
}
function renderPluginRow(m, isAd) {
  let statusDot = "",
    statusText = "",
    statusClass = "";
  if (m.loaded) {
    statusDot = "loaded";
    statusText = t("active");
    statusClass = "chip-ok";
  } else if (m.enabled) {
    statusDot = "enabled";
    statusText = t("module_enabled_not_loaded");
    statusClass = "chip-wr";
  } else {
    statusDot = "disabled";
    statusText = t("module_disabled");
    statusClass = "chip-er";
  }

  let meta = "";
  if (m.version)
    meta += "<span>" + t("module_version") + ": " + esc(m.version) + "</span>";
  if (m.author)
    meta += "<span>" + t("module_author") + ": " + esc(m.author) + "</span>";
  if (!meta && m.description) meta = "<span>" + esc(m.description) + "</span>";
  if (!meta) meta = "<span>" + t("module_no_desc") + "</span>";

  let acts = "";
  // Expand toggle always shown
  acts +=
    '<button class="btn btn-secondary btn-xs module-expand-btn" onclick="toggleModuleDetail(this)" title="' +
    t("view_detail") +
    '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px"><polyline points="6 9 12 15 18 9"/></svg></button> ';
  if (m.loaded) {
    if (!isAd)
      acts +=
        '<button class="btn btn-secondary btn-xs" onclick="moduleAction(\'' +
        esc(m.name) +
        "','reload','" +
        esc(m.type) +
        "')\">" +
        t("reload") +
        "</button> ";
    acts +=
      '<button class="btn btn-secondary btn-xs" onclick="moduleAction(\'' +
      esc(m.name) +
      "','unload','" +
      esc(m.type) +
      "')\">" +
      t("unload") +
      "</button> ";
  } else if (m.enabled) {
    acts +=
      '<button class="btn btn-primary btn-xs" onclick="moduleAction(\'' +
      esc(m.name) +
      "','load','" +
      esc(m.type) +
      "')\">" +
      t("load") +
      "</button> ";
  }
  if (m.enabled) {
    acts +=
      '<button class="btn btn-secondary btn-xs" onclick="moduleAction(\'' +
      esc(m.name) +
      "','disable','" +
      esc(m.type) +
      "')\">" +
      t("disable_module") +
      "</button> ";
  } else {
    acts +=
      '<button class="btn btn-primary btn-xs" onclick="moduleAction(\'' +
      esc(m.name) +
      "','enable','" +
      esc(m.type) +
      "')\">" +
      t("enable_module") +
      "</button> ";
  }
  if (!isAd && m.package) {
    acts +=
      '<button class="btn btn-danger btn-xs" onclick="moduleAction(\'' +
      esc(m.name) +
      "','uninstall','" +
      esc(m.type) +
      "','" +
      esc(m.package) +
      "')\">" +
      t("uninstall_module") +
      "</button> ";
  }

  // Build detail section
  var detailHtml = "";
  var detailItems = [];
  // 详情：状态说明（适配器/模块通用）
  detailItems.push(
    '<span class="module-detail-item"><strong>' +
      t("loaded_status") +
      ":</strong> " +
      esc(statusText) +
      "</span>",
  );
  // 详情：完整描述
  if (m.description)
    detailItems.push(
      '<span class="module-detail-item">' +
        esc(m.description) +
        "</span>",
    );
  if (isAd) {
    if (m.bots_count > 0) {
      detailItems.push(
        '<span class="module-detail-item"><strong>' +
          t("online_bots") +
          ":</strong> " +
          m.bots_count +
          "</span>",
      );
    }
    if (m.capabilities && m.capabilities.length) {
      detailItems.push(
        '<span class="module-detail-item"><strong>' +
          t("capability") +
          ":</strong> " +
          m.capabilities
            .map(function (c) {
              return '<span class="module-cap-tag">' + esc(c) + "</span>";
            })
            .join(" ") +
          "</span>",
      );
    }
    if (m.has_config != null)
      detailItems.push(
        '<span class="module-detail-item"><strong>' +
          t("config") +
          ":</strong> " +
          (m.has_config ? t("cmd_yes") : t("cmd_no")) +
          "</span>",
      );
    if (m.has_accounts != null)
      detailItems.push(
        '<span class="module-detail-item"><strong>' +
          t("adapter_accounts") +
          ":</strong> " +
          (m.has_accounts ? t("cmd_yes") : t("cmd_no")) +
          "</span>",
      );
  } else {
    if (m.load_strategy) {
      var ls = m.load_strategy;
      if (ls.lazy_load != null)
        detailItems.push(
          '<span class="module-detail-item"><strong>' +
            t("module_load_mode") +
            ":</strong> " +
            (ls.lazy_load ? t("module_lazy") : t("module_eager")) +
            "</span>",
        );
      if (ls.priority != null)
        detailItems.push(
          '<span class="module-detail-item"><strong>' +
            t("module_priority") +
            ":</strong> " +
            ls.priority +
            "</span>",
        );
      if (ls.depends && ls.depends.length)
        detailItems.push(
          '<span class="module-detail-item"><strong>' +
            t("module_depends") +
            ":</strong> " +
            ls.depends
              .map(function (d) {
                return '<code class="dep-code">' + esc(d) + "</code>";
              })
              .join(" ") +
            "</span>",
        );
    }
    if (m.routes_count > 0)
      detailItems.push(
        '<span class="module-detail-item"><strong>' +
          t("registered_routes") +
          ":</strong> " +
          m.routes_count +
          "</span>",
      );
    if (m.views_count > 0)
      detailItems.push(
        '<span class="module-detail-item"><strong>' +
          t("module_views_count") +
          ":</strong> " +
          m.views_count +
          "</span>",
      );
    if (m.has_config != null)
      detailItems.push(
        '<span class="module-detail-item"><strong>' +
          t("config") +
          ":</strong> " +
          (m.has_config ? t("cmd_yes") : t("cmd_no")) +
          "</span>",
      );
    if (m.package)
      detailItems.push(
        '<span class="module-detail-item"><strong>' +
          t("pkg_name") +
          ':</strong> <code class="dep-code">' +
          esc(m.package) +
          "</code></span>",
      );
    if (m.is_git)
      detailItems.push(
        '<span class="module-detail-item"><span class="chip chip-pr module-git-chip">Git</span></span>',
      );
  }
  if (detailItems.length) {
    detailHtml =
      '<div class="module-detail hidden"><div class="module-detail-row">' +
      detailItems.join("") +
      "</div></div>";
  }

  const adLogo = isAd ? adapterLogoImg(m.name, 20) : "";
  var html =
    '<div class="module-row-wrap">' +
    '<div class="module-row"><span class="module-status-dot ' +
    statusDot +
    '"></span>' +
    adLogo +
    '<div class="module-info"><div class="module-name">' +
    esc(m.name) +
    '</div><div class="module-meta">' +
    meta +
    '</div></div><div class="module-actions">' +
    '<span class="chip ' +
    statusClass +
    ' module-status-chip">' +
    esc(statusText) +
    "</span>" +
    acts +
    "</div></div>" +
    detailHtml +
    "</div>";
  return html;
}
function toggleModuleDetail(btn) {
  var wrap = btn.closest(".module-row-wrap");
  if (!wrap) return;
  var detail = wrap.querySelector(".module-detail");
  if (!detail) return;
  var svg = btn.querySelector("svg");
  if (detail.classList.contains("hidden")) {
    detail.classList.remove("hidden");
    wrap.classList.add("expanded");
    if (svg) svg.innerHTML = '<polyline points="6 15 12 9 18 15"/>';
  } else {
    detail.classList.add("hidden");
    wrap.classList.remove("expanded");
    if (svg) svg.innerHTML = '<polyline points="6 9 12 15 18 9"/>';
  }
}
async function moduleAction(name, action, type, pkg) {
  if (!authed) return showLogin();
  if (action === "unload" && name === "Dashboard") {
    const ok = await confirm2(t("unload_self_title"), t("unload_self_confirm"));
    if (!ok) return;
  } else if (action === "unload") {
    const ok = await confirm2(
      t("unload_confirm_title"),
      t("unload_confirm_text"),
    );
    if (!ok) return;
  }
  if (action === "disable") {
    const ok = await confirm2(
      t("disable_confirm_title"),
      t("disable_confirm_text"),
    );
    if (!ok) return;
  }
  if (action === "uninstall") {
    const ok = await confirm2(
      t("uninstall_confirm_title"),
      t("uninstall_confirm_text") + " <strong>" + esc(name) + "</strong>",
    );
    if (!ok) return;
  }
  const body = { name, action, type };
  if (pkg) body.package = pkg;
  const d = await api("/api/modules/action", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (d && d.success) {
    if (d.task_id) {
      _installTaskIds.set(d.task_id, name);
      toast(t("module_uninstalling"), "");
    } else {
      setTimeout(loadModules, 300);
      toast(t("action_completed"), "ok");
    }
  } else toast(d?.error || t("action_failed"), "er");
}

let _storeTimer;
function debounceStore() {
  clearTimeout(_storeTimer);
  _storeTimer = setTimeout(loadStore, 300);
}
const STORE_CACHE_KEY = "__ep_store__",
  STORE_CACHE_TTL = 4 * 3600 * 1000;
function mirrorOptionsHtml() {
  return (
    '<option value="">PyPI (Default)</option>' +
    '<option value="https://pypi.tuna.tsinghua.edu.cn/simple">Tsinghua</option>' +
    '<option value="https://mirrors.aliyun.com/pypi/simple/">Aliyun</option>' +
    '<option value="https://pypi.doubanio.com/simple/">Douban</option>' +
    '<option value="https://repo.huaweicloud.com/repository/pypi/simple">Huawei</option>'
  );
}
function initMirrorSelects() {
  ["uploadMirrorSelect", "detailMirrorSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el && !el.children.length) el.innerHTML = mirrorOptionsHtml();
  });
}
// ========== EP 组件库：自定义下拉 / 可搜索多选 ==========
window.EP = window.EP || {};
EP._enhanced = [];
EP._pendingSelects = [];
EP._multis = [];

// 将浮层 fixed 定位到触发器下方（贴近屏幕边缘时内收 / 上翻 / 限制高度可滚动）
EP.positionList = function (el, anchor, maxH) {
  var rc = anchor.getBoundingClientRect();
  var margin = 8;
  var vw = window.innerWidth;
  var vh = window.innerHeight;
  var below = vh - rc.bottom - margin;
  var above = rc.top - margin;
  // 先以 auto 宽度渲染测量内容自然宽度（不可见，避免闪烁）
  var prevVis = el.style.visibility;
  el.style.visibility = "hidden";
  el.style.display = "block";
  el.style.width = "auto";
  var contentW = el.offsetWidth;
  el.style.visibility = prevVis;
  var width = Math.max(rc.width, contentW, 160);
  if (width > vw - margin) width = vw - margin;
  var left = Math.min(rc.left, vw - margin);
  if (left + width > vw - margin) left = Math.max(margin, vw - width - margin);
  var flipUp = below < 120 && above > below;
  var space = flipUp ? above : below;
  var maxH2 = Math.max(80, Math.min(maxH, space));
  el.style.position = "fixed";
  el.style.left = left + "px";
  el.style.width = width + "px";
  el.style.maxWidth = vw - margin + "px";
  if (flipUp) {
    el.style.top = Math.max(margin, rc.top - maxH2 - 4) + "px";
  } else {
    el.style.top = rc.bottom + 4 + "px";
  }
  el.style.maxHeight = maxH2 + "px";
  el.style.display = "block";
};

EP.enhanceSelect = function (sel) {
  if (!sel || sel.tagName !== "SELECT" || sel.dataset.epEnhanced) return sel;
  if (sel.closest(".ep-combobox")) return sel;
  sel.dataset.epEnhanced = "1";

  var wrap = document.createElement("div");
  wrap.className = "ep-combobox";
  if (sel.disabled) wrap.classList.add("disabled");
  ["width", "minWidth", "maxWidth"].forEach(function (k) {
    if (sel.style[k]) wrap.style[k] = sel.style[k];
  });

  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ep-combobox-trigger";
  btn.setAttribute("aria-haspopup", "listbox");
  var lbl = document.createElement("span");
  lbl.className = "ep-combobox-label";
  var arrow = document.createElement("span");
  arrow.className = "ep-combobox-arrow";
  arrow.innerHTML =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
  btn.appendChild(lbl);
  btn.appendChild(arrow);
  var list = document.createElement("div");
  list.className = "ep-combobox-list";
  list.setAttribute("role", "listbox");
  list.dataset.epOwner = "1";
  wrap.appendChild(btn);
  sel.parentNode.insertBefore(wrap, sel.nextSibling);
  // 列表挂到 body：脱离模态/transform/overflow 祖先，保证 fixed 定位基于视口
  document.body.appendChild(list);
  sel.classList.add("ep-native-hidden");

  var api = { select: sel, wrap: wrap, list: list, label: lbl, _last: sel.value };

  function appendOpt(opt) {
    var o = document.createElement("div");
    o.className = "ep-combobox-opt";
    o.setAttribute("role", "option");
    o.textContent = opt.textContent || opt.value || "\u00a0";
    o.dataset.value = opt.value;
    o.addEventListener("click", function (e) {
      e.stopPropagation();
      selectValue(opt.value);
    });
    list.appendChild(o);
  }
  function build() {
    list.innerHTML = "";
    Array.prototype.forEach.call(sel.children, function (child) {
      if (child.tagName === "OPTGROUP") {
        var gl = document.createElement("div");
        gl.className = "ep-combobox-group-label";
        gl.textContent = child.label || "";
        list.appendChild(gl);
        Array.prototype.forEach.call(child.children, function (opt) {
          if (opt.tagName === "OPTION") appendOpt(opt);
        });
      } else if (child.tagName === "OPTION") {
        appendOpt(child);
      }
    });
  }
  function syncUI() {
    var v = sel.value;
    var label = "";
    Array.prototype.forEach.call(sel.querySelectorAll("option"), function (opt) {
      if (String(opt.value) === String(v)) label = opt.textContent || opt.value;
    });
    if (label === "" && v === "") {
      var first = sel.querySelector("option");
      label = first ? first.textContent || first.value : "";
    }
    api.label.textContent = label || "\u00a0";
    Array.prototype.forEach.call(list.querySelectorAll(".ep-combobox-opt"), function (o) {
      o.dataset.selected = String(o.dataset.value) === String(v) ? "1" : "0";
    });
  }
  var wheelGuard = function (e) {
    var canDown = list.scrollHeight - list.scrollTop - list.clientHeight > 1;
    var canUp = list.scrollTop > 1;
    if ((e.deltaY > 0 && !canDown) || (e.deltaY < 0 && !canUp)) {
      e.preventDefault();
    }
  };
  function open() {
    build();
    syncUI();
    EP.positionList(list, btn, 260);
    list.addEventListener("wheel", wheelGuard);
    wrap.dataset.open = "1";
    btn.setAttribute("aria-expanded", "true");
    var active = list.querySelector('.ep-combobox-opt[data-selected="1"]');
    if (active) list.scrollTop = active.offsetTop - list.clientHeight / 2;
  }
  function close() {
    delete wrap.dataset.open;
    list.removeEventListener("wheel", wheelGuard);
    list.style.display = "none";
    btn.setAttribute("aria-expanded", "false");
  }
  function toggle() {
    if (wrap.dataset.open === "1") close();
    else open();
  }
  function selectValue(val) {
    sel.value = val;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    api._last = val;
    syncUI();
    close();
  }

  btn.addEventListener("mousedown", function (e) {
    e.stopPropagation();
    e.preventDefault();
    toggle();
  });

  var obs = new MutationObserver(function () {
    clearTimeout(api._buildTimer);
    api._buildTimer = setTimeout(function () {
      build();
      syncUI();
    }, 30);
  });
  obs.observe(sel, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["disabled"],
  });

  api.syncUI = syncUI;
  api.close = close;
  api.build = build;
  build();
  syncUI();
  EP._enhanced.push(api);
  return sel;
};

EP.enhanceAll = function (scope) {
  var root = scope || document;
  Array.prototype.forEach.call(root.querySelectorAll("select"), function (s) {
    if (!s.dataset.epEnhanced) EP.enhanceSelect(s);
  });
};

EP.createMultiSelect = function (opts) {
  var host = opts.host;
  var items = (opts.items || []).slice();
  var selected = opts.selected || new Set();
  var onChange = opts.onChange || function () {};
  var placeholder = opts.placeholder || "";

  var wrap = document.createElement("div");
  wrap.className = "ep-multiselect";
  var trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "ep-multiselect-trigger";
  var label = document.createElement("span");
  label.className = "ep-multiselect-label";
  var arrow = document.createElement("span");
  arrow.className = "ep-multiselect-arrow";
  arrow.innerHTML =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
  trigger.appendChild(label);
  trigger.appendChild(arrow);
  var panel = document.createElement("div");
  panel.className = "ep-multiselect-panel";
  panel.dataset.epOwner = "1";
  var search = document.createElement("input");
  search.type = "text";
  search.className = "ep-multiselect-search";
  search.placeholder = opts.searchPlaceholder || "Search...";
  var actions = document.createElement("div");
  actions.className = "ep-multiselect-actions";
  var selAll = document.createElement("button");
  selAll.type = "button";
  selAll.className = "btn btn-secondary btn-xs";
  selAll.textContent = opts.selectAll || "Select all";
  var clear = document.createElement("button");
  clear.type = "button";
  clear.className = "btn btn-secondary btn-xs";
  clear.textContent = opts.clear || "Clear";
  actions.appendChild(selAll);
  actions.appendChild(clear);
  var optsList = document.createElement("div");
  optsList.className = "ep-multiselect-list";
  panel.appendChild(search);
  panel.appendChild(actions);
  panel.appendChild(optsList);
  wrap.appendChild(trigger);
  host.appendChild(wrap);
  // 面板挂到 body：脱离模态/transform/overflow 祖先，保证 fixed 定位基于视口
  document.body.appendChild(panel);

  function render() {
    label.textContent =
      selected.size > 0 ? selected.size + " " + (opts.countLabel || "") : placeholder || "\u00a0";
    var q = (search.value || "").toLowerCase();
    optsList.innerHTML = "";
    var shown = 0;
    items.slice().sort().forEach(function (tag) {
      if (q && tag.toLowerCase().indexOf(q) === -1) return;
      shown++;
      var row = document.createElement("label");
      row.className = "ep-multiselect-opt";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = selected.has(tag);
      var span = document.createElement("span");
      span.textContent = tag;
      row.appendChild(cb);
      row.appendChild(span);
      row.addEventListener("click", function (e) {
        if (e.target !== cb) cb.click();
      });
      cb.addEventListener("change", function () {
        if (cb.checked) selected.add(tag);
        else selected.delete(tag);
        render();
        onChange();
      });
      optsList.appendChild(row);
    });
    if (shown === 0) {
      var empty = document.createElement("div");
      empty.className = "ep-multiselect-empty";
      empty.textContent = opts.emptyText || "—";
      optsList.appendChild(empty);
    }
  }
  var wheelGuard = function (e) {
    var canDown = panel.scrollHeight - panel.scrollTop - panel.clientHeight > 1;
    var canUp = panel.scrollTop > 1;
    if ((e.deltaY > 0 && !canDown) || (e.deltaY < 0 && !canUp)) {
      e.preventDefault();
    }
  };
  function open() {
    EP.positionList(panel, trigger, 320);
    panel.addEventListener("wheel", wheelGuard);
    wrap.dataset.open = "1";
    search.focus();
    render();
  }
  function close() {
    delete wrap.dataset.open;
    panel.removeEventListener("wheel", wheelGuard);
    panel.style.display = "none";
  }
  trigger.addEventListener("mousedown", function (e) {
    e.stopPropagation();
    e.preventDefault();
    if (wrap.dataset.open === "1") close();
    else open();
  });
  selAll.addEventListener("click", function () {
    items.forEach(function (t) {
      selected.add(t);
    });
    render();
    onChange();
  });
  clear.addEventListener("click", function () {
    selected.clear();
    render();
    onChange();
  });
  search.addEventListener("input", render);
  panel.addEventListener("click", function (e) {
    e.stopPropagation();
  });
  render();
  var mApi = {
    wrap: wrap,
    panel: panel,
    setItems: function (arr) {
      items = (arr || []).slice();
      render();
    },
    close: close,
    getSelected: function () {
      return selected;
    },
  };
  EP._multis.push(mApi);
  return mApi;
};

// 外部按下关闭所有 EP 下拉 / 多选（mousedown 更即时）
document.addEventListener(
  "mousedown",
  function (e) {
    EP._enhanced.forEach(function (api) {
      if (api.wrap.dataset.open === "1" && !api.wrap.contains(e.target) && !(api.list && api.list.contains(e.target)))
        api.close();
    });
    EP._multis.forEach(function (m) {
      if (m.wrap.dataset.open === "1" && !m.wrap.contains(e.target) && !(m.panel && m.panel.contains(e.target)))
        m.close();
    });
  },
  true,
);

// Esc 关闭 EP 下拉
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    EP._enhanced.forEach(function (api) {
      api.close();
    });
    EP._multis.forEach(function (m) {
      m.close();
    });
  }
});

// 页面滚动时关闭浮层；但下拉列表自身滚动不关闭
window.addEventListener(
  "scroll",
  function (e) {
    var t = e.target;
    EP._enhanced.forEach(function (api) {
      if (api.wrap.dataset.open !== "1") return;
      if (t && t.nodeType === 1 && api.list.contains(t)) return;
      api.close();
    });
    EP._multis.forEach(function (m) {
      if (m.wrap.dataset.open !== "1") return;
      if (t && t.nodeType === 1 && m.panel.contains(t)) return;
      m.close();
    });
  },
  true,
);
window.addEventListener("resize", function () {
  EP._enhanced.forEach(function (api) {
    api.close();
  });
  EP._multis.forEach(function (m) {
    m.close();
  });
});

// 自动增强动态插入的 select
var _epAutoTimer = null;
EP._autoObserver = new MutationObserver(function (muts) {
  muts.forEach(function (m) {
    Array.prototype.forEach.call(m.addedNodes, function (n) {
      if (n.nodeType !== 1) return;
      if (n.tagName === "SELECT" && !n.dataset.epEnhanced) EP._pendingSelects.push(n);
      else if (n.querySelectorAll) {
        Array.prototype.forEach.call(n.querySelectorAll("select"), function (s) {
          if (!s.dataset.epEnhanced) EP._pendingSelects.push(s);
        });
      }
    });
  });
  if (EP._pendingSelects.length) {
    clearTimeout(_epAutoTimer);
    _epAutoTimer = setTimeout(function () {
      EP._pendingSelects.forEach(function (s) {
        if (!s.dataset.epEnhanced) EP.enhanceSelect(s);
      });
      EP._pendingSelects = [];
      EP._cleanupOrphans();
    }, 40);
  }
});
EP._autoObserver.observe(document.body, { childList: true, subtree: true });

// 清理挂到 body 后因宿主被移除而成为孤儿的列表/面板
EP._cleanupOrphans = function () {
  var live = new Set();
  EP._enhanced.forEach(function (api) {
    live.add(api.list);
  });
  EP._multis.forEach(function (m) {
    live.add(m.panel);
  });
  document
    .querySelectorAll(".ep-combobox-list[data-ep-owner], .ep-multiselect-panel[data-ep-owner]")
    .forEach(function (el) {
      if (!live.has(el)) el.remove();
    });
};

// 值变化同步（覆盖程序赋值）
EP._tick = setInterval(function () {
  EP._enhanced.forEach(function (api) {
    if (api.select.value !== api._last) {
      api._last = api.select.value;
      api.syncUI();
    }
  });
}, 500);

// 初始增强页面所有 select
EP.enhanceAll(document);

var _selectedStoreTags = new Set();
var _storeTagMulti = null;

function _renderStoreTags(data) {
  var tagSet = new Set();
  for (var key in data.modules || {}) {
    var tg = data.modules[key].tags;
    if (Array.isArray(tg))
      tg.forEach(function (tag) {
        tagSet.add(tag);
      });
  }
  for (var key in data.adapters || {}) {
    var tg = data.adapters[key].tags;
    if (Array.isArray(tg))
      tg.forEach(function (tag) {
        tagSet.add(tag);
      });
  }
  var container = document.getElementById("storeTags");
  if (!container) return;
  if (tagSet.size === 0) {
    container.style.display = "none";
    return;
  }
  container.style.display = "block";
  var tags = Array.from(tagSet).sort();
  if (!_storeTagMulti) {
    _storeTagMulti = EP.createMultiSelect({
      host: container,
      items: tags,
      selected: _selectedStoreTags,
      placeholder: t("store_tag_filter"),
      searchPlaceholder: t("search_packages"),
      selectAll: t("select_all"),
      clear: t("clear_all"),
      emptyText: t("no_matches"),
      countLabel: t("ep_selected"),
      onChange: function () {
        loadStore();
      },
    });
  } else {
    _storeTagMulti.setItems(tags);
  }
}

async function loadStore(forceRefresh) {
  const q = document.getElementById("storeSearch")?.value?.toLowerCase() || "";
  const typeFilter = document.getElementById("storeTypeFilter")?.value || "all";
  let remotePackages = null;

  // 远程注册表数据变化少，可缓存；但已安装版本必须实时获取
  if (!forceRefresh) {
    try {
      const c = JSON.parse(localStorage.getItem(STORE_CACHE_KEY));
      if (c && c.packages && Date.now() - c.ts < STORE_CACHE_TTL)
        remotePackages = c.packages;
    } catch (e) {}
  }
  if (!remotePackages) {
    const resp = await api("/api/store/remote");
    if (resp && resp.packages) {
      remotePackages = resp.packages;
      localStorage.setItem(
        STORE_CACHE_KEY,
        JSON.stringify({ ts: Date.now(), packages: remotePackages }),
      );
    }
  }

  // 已安装版本始终实时获取（不缓存），避免升级后"有更新"徽章不消失
  const instResp = await api("/api/packages");
  const installedVersions = {};
  if (instResp && Array.isArray(instResp.packages)) {
    instResp.packages.forEach(function (p) {
      if (p.name) installedVersions[p.name.toLowerCase()] = p.version || "";
    });
  }

  const d = { packages: remotePackages, installed_versions: installedVersions };
  if (!d || !d.packages) {
    document.getElementById("storeGrid").innerHTML =
      '<div class="empty-state" style="grid-column:span 3"><p>' +
      t("failed_registry") +
      "</p></div>";
    return;
  }
  const pk = d.packages;

  // 渲染标签筛选项
  _renderStoreTags(pk);

  const all = [
    ...Object.entries(pk.modules || {}).map(([n, i]) => ({
      ...i,
      name: n,
      type: "module",
    })),
    ...Object.entries(pk.adapters || {}).map(([n, i]) => ({
      ...i,
      name: n,
      type: "adapter",
    })),
  ];
  // 多层筛选
  var f = all;
  if (typeFilter !== "all") {
    f = f.filter(function (i) {
      return i.type === typeFilter;
    });
  }
  if (q) {
    f = f.filter(function (i) {
      return (i.name + i.description + i.package).toLowerCase().indexOf(q) >= 0;
    });
  }
  if (_selectedStoreTags.size > 0) {
    f = f.filter(function (i) {
      var tags = i.tags;
      if (!Array.isArray(tags)) return false;
      for (var ti = 0; ti < tags.length; ti++) {
        if (_selectedStoreTags.has(tags[ti])) return true;
      }
      return false;
    });
  }
  document.getElementById("storeGrid").innerHTML = f.length
    ? f
        .map((i) => {
          const pkgLower = (i.package || "").toLowerCase();
          const installedVer = installedVersions[pkgLower] || "";
          const isInstalled = !!installedVer;
          const hasUpdate = isInstalled && cmpVer(i.version, installedVer) > 0;
          let statusBadge = "";
          let actionBtn = "";
          if (hasUpdate) {
            statusBadge =
              '<span class="chip chip-wr" style="margin-left:4px;font-size:10px">' +
              t("store_update_available") +
              "</span>";
            actionBtn =
              '<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();upgradePkg(\'' +
              esc(i.package) +
              "')\">" +
              t("pkg_upgrade") +
              "</button>";
          } else if (isInstalled) {
            statusBadge =
              '<span class="chip chip-ok" style="margin-left:4px;font-size:10px">v' +
              esc(installedVer) +
              "</span>";
            actionBtn =
              '<span style="font-size:12px;color:var(--ok-c);font-weight:500">' +
              t("active") +
              "</span>";
          } else {
            actionBtn =
              '<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();installPkg(\'' +
              esc(i.package) +
              "')\">" +
              t("install") +
              "</button>";
          }
          // 标签徽章
          var tagBadges = "";
          if (Array.isArray(i.tags) && i.tags.length) {
            tagBadges =
              '<div class="store-card-tags">' +
              i.tags
                .map(function (t) {
                  return '<span class="store-card-tag">' + esc(t) + "</span>";
                })
                .join("") +
              "</div>";
          }
          return (
            '<div class="store-card' +
            (hasUpdate ? " store-card-update" : "") +
            '" onclick="openPkgDetail(\'' +
            esc(i.name) +
            "','" +
            esc(i.package) +
            "','" +
            esc(i.type) +
            '\')"><div style="display:flex;align-items:center;gap:8px"><input type="checkbox" class="store-card-check" data-pkg="' +
            esc(i.package) +
            '" onclick="event.stopPropagation();updateBatchBar()"><span style="font-size:14px;font-weight:600">' +
            esc(i.name) +
            '</span><span class="chip chip-pr">' +
            esc(i.type) +
            "</span>" +
            statusBadge +
            '</div><div style="font-size:12px;color:var(--tx-t);font-family:Consolas,Monaco,monospace">' +
            esc(i.package) +
            '</div><div class="store-card-desc">' +
            esc(i.description || "-") +
            "</div>" +
            tagBadges +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:auto"><span style="font-size:12px;color:var(--tx-s);font-weight:500">v' +
            esc(i.version || "?") +
            (hasUpdate
              ? ' <span style="color:var(--wr-c);font-weight:600">&larr;</span> ' +
                t("store_version_current") +
                " v" +
                esc(installedVer)
              : "") +
            '</span><div style="display:flex;align-items:center;gap:6px">' +
            actionBtn +
            '<button class="store-card-detail-btn" onclick="event.stopPropagation();openPkgDetail(\'' +
            esc(i.name) +
            "','" +
            esc(i.package) +
            "','" +
            esc(i.type) +
            '\')" title="' +
            t("view_detail") +
            '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></button></div></div></div>'
          );
        })
        .join("")
    : '<div class="empty-state" style="grid-column:span 3"><p>' +
      t("no_packages") +
      "</p></div>";
}
let _installTaskIds = new Map();
function showInstallConfirm(pkg, isBatch) {
  return new Promise((r) => {
    const ov = document.getElementById("modalOv");
    document.getElementById("modalTitle").textContent = t("install");
    const label = isBatch
      ? esc(pkg)
      : "Install <strong>" + esc(pkg) + "</strong>?";
    document.getElementById("modalText").innerHTML =
      label +
      '<div class="install-confirm-options">' +
      '<div class="install-confirm-option"><div><div class="install-confirm-option-label">' +
      t("force_install") +
      '</div><div style="font-size:11px;color:var(--tx-t)">' +
      t("force_install_desc") +
      '</div></div><label class="switch"><input type="checkbox" id="installConfirmForce"><span class="switch-slider"></span></label></div>' +
      '<div class="install-confirm-option"><div class="install-confirm-option-label">' +
      t("pip_mirror") +
      '</div><select class="upload-select" id="installConfirmMirror" style="width:160px">' +
      mirrorOptionsHtml() +
      "</select></div>" +
      "</div>";
    const ac = document.getElementById("modalActions");
    ac.innerHTML = "";
    const b1 = document.createElement("button");
    b1.className = "btn btn-secondary";
    b1.textContent = t("cancel");
    b1.onclick = () => {
      ov.classList.remove("show");
      r(null);
    };
    const b2 = document.createElement("button");
    b2.className = "btn btn-primary";
    b2.textContent = t("install");
    b2.onclick = () => {
      const force =
        document.getElementById("installConfirmForce")?.checked || false;
      const mirror =
        document.getElementById("installConfirmMirror")?.value || "";
      ov.classList.remove("show");
      r({ force, index_url: mirror });
    };
    ac.append(b1, b2);
    ov.classList.add("show");
  });
}
async function installPkg(pkg) {
  if (!authed) return showLogin();
  const opts = await showInstallConfirm(pkg);
  if (!opts) return;
  const body = { packages: [pkg] };
  if (opts.force) body.force = true;
  if (opts.index_url) body.index_url = opts.index_url;
  const d = await api("/api/store/install", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, pkg);
    toast(t("installing"), "");
  } else {
    toast(t("install_failed"), "er");
  }
}

// ========== 上传安装模态窗 ==========
let _uploadState = { file: null, taskId: null, uploaded: false };
function openUploadModal() {
  if (!authed) return showLogin();
  _uploadState = { file: null, taskId: null, uploaded: false };
  initMirrorSelects();
  const ov = document.getElementById("uploadOv");
  document.getElementById("uploadProgressSection").style.display = "none";
  document.getElementById("uploadProgressFill").style.width = "0%";
  document.getElementById("uploadProgressText").textContent = "0%";
  document.getElementById("uploadFileInfo").textContent = "";
  document.getElementById("uploadInstallBtn").disabled = true;
  document.getElementById("uploadForceInstall").checked = false;
  const ms = document.getElementById("uploadMirrorSelect");
  if (ms) ms.value = "";
  document.getElementById("uploadDropZone").classList.remove("drag-over");
  ov.classList.add("show");
}
function closeUploadModal() {
  document.getElementById("uploadOv").classList.remove("show");
}
function handleUploadDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add("drag-over");
}
function handleUploadDragLeave(e) {
  e.currentTarget.classList.remove("drag-over");
}
function handleUploadDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) processUploadFile(file);
}
function handleUploadFileSelect(input) {
  const file = input.files && input.files[0];
  if (file) processUploadFile(file);
  input.value = "";
}
function processUploadFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext !== "whl" && ext !== "zip") {
    toast(t("upload_failed"), "er");
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    toast(t("upload_file_too_large"), "er");
    return;
  }
  _uploadState.file = file;
  _uploadState.uploaded = false;
  document.getElementById("uploadFileInfo").textContent =
    file.name + " (" + formatFileSize(file.size) + ")";
  doUpload(file);
}
function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + " " + u[i];
}
function doUpload(file) {
  const fd = new FormData();
  fd.append("file", file);
  const force = document.getElementById("uploadForceInstall").checked;
  const mirror = document.getElementById("uploadMirrorSelect")?.value || "";
  if (force) fd.append("force", "true");
  if (mirror) fd.append("index_url", mirror);
  const xhr = new XMLHttpRequest();
  document.getElementById("uploadProgressSection").style.display = "flex";
  document.getElementById("uploadInstallBtn").disabled = true;
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      document.getElementById("uploadProgressFill").style.width = pct + "%";
      document.getElementById("uploadProgressText").textContent = pct + "%";
    }
  };
  xhr.onload = () => {
    try {
      const d = JSON.parse(xhr.responseText);
      if (d && d.success && d.task_id) {
        _uploadState.taskId = d.task_id;
        _uploadState.uploaded = true;
        _installTaskIds.set(d.task_id, file.name);
        document.getElementById("uploadProgressFill").style.width = "100%";
        document.getElementById("uploadProgressText").textContent =
          t("upload_complete");
        document.getElementById("uploadInstallBtn").disabled = false;
      } else {
        toast(d?.error || t("upload_failed"), "er");
        closeUploadModal();
      }
    } catch (err) {
      toast(t("upload_failed"), "er");
      closeUploadModal();
    }
  };
  xhr.onerror = () => {
    toast(t("upload_failed"), "er");
    closeUploadModal();
  };
  xhr.open("POST", API + "/api/store/upload");
  xhr.setRequestHeader("Authorization", "Bearer " + localStorage.getItem(TK));
  xhr.send(fd);
}
function startUploadInstall() {
  closeUploadModal();
  toast(t("installing"), "");
}

// ========== 包详情弹窗 ==========
let _pkgDetailCache = {};
async function openPkgDetail(name, pkg, type) {
  if (!authed) return showLogin();
  initMirrorSelects();
  const ov = document.getElementById("pkgDetailOv");
  document.getElementById("pkgDetailTitle").textContent = name;
  document.getElementById("pkgDetailType").textContent = type;
  document.getElementById("pkgDetailVersion").innerHTML = "";
  document.getElementById("pkgDetailDesc").innerHTML =
    '<p style="color:var(--tx-t)">' + t("pkg_detail_loading") + "</p>";
  document.getElementById("pkgDetailInfoGrid").innerHTML = "";
  document.getElementById("pkgDetailDepsSection").style.display = "none";
  document.getElementById("pkgDetailVersionsSection").style.display = "none";
  document.getElementById("detailForceInstall").checked = false;
  const ms = document.getElementById("detailMirrorSelect");
  if (ms) ms.value = "";
  const vs = document.getElementById("detailVersionSelect");
  vs.innerHTML = '<option value="">' + t("latest_version") + "</option>";
  const ac = document.getElementById("pkgDetailActions");
  ac.innerHTML = "";
  ov.classList.add("show");

  const cacheKey = pkg.toLowerCase();
  let d = _pkgDetailCache[cacheKey];
  if (!d) {
    d = await api(
      "/api/store/package/detail?package=" + encodeURIComponent(pkg),
    );
    if (d && !d.error) _pkgDetailCache[cacheKey] = d;
  }
  if (!d || d.error) {
    document.getElementById("pkgDetailDesc").innerHTML =
      '<p style="color:var(--er-c)">' + t("pkg_detail_failed") + "</p>";
    return;
  }

  let verHtml = "";
  if (d.installed_version)
    verHtml +=
      '<span class="chip chip-ok" style="font-size:11px">v' +
      esc(d.installed_version) +
      " " +
      t("store_version_current") +
      "</span> ";
  if (d.latest_version)
    verHtml +=
      '<span class="chip chip-pr" style="font-size:11px">v' +
      esc(d.latest_version) +
      " " +
      t("store_version_latest") +
      "</span>";
  document.getElementById("pkgDetailVersion").innerHTML = verHtml;

  const descText = d.description || d.summary || "";
  if (descText && typeof marked !== "undefined") {
    document.getElementById("pkgDetailDesc").innerHTML = marked.parse(descText);
  } else if (descText) {
    const cleanDesc = descText.replace(/<[^>]*>/g, "").substring(0, 2000);
    document.getElementById("pkgDetailDesc").innerHTML =
      '<p style="white-space:pre-wrap">' + esc(cleanDesc) + "</p>";
  } else {
    document.getElementById("pkgDetailDesc").innerHTML =
      '<p style="color:var(--tx-t)">-</p>';
  }

  let infoHtml = "";
  if (d.author)
    infoHtml +=
      '<dt style="color:var(--tx-t);font-weight:500">Author</dt><dd style="color:var(--tx-s);margin:0">' +
      esc(d.author) +
      "</dd>";
  if (d.license)
    infoHtml +=
      '<dt style="color:var(--tx-t);font-weight:500">License</dt><dd style="color:var(--tx-s);margin:0">' +
      esc(d.license) +
      "</dd>";
  if (d.home_page)
    infoHtml +=
      '<dt style="color:var(--tx-t);font-weight:500">Homepage</dt><dd style="color:var(--tx-s);margin:0"><a href="' +
      esc(d.home_page) +
      '" target="_blank" style="color:var(--accent)">' +
      esc(d.home_page) +
      "</a></dd>";
  if (infoHtml)
    document.getElementById("pkgDetailInfoGrid").innerHTML = infoHtml;

  const deps = (d.requires_dist || []).filter(
    (dep) => !dep.includes("; extra ==") && !dep.includes(":"),
  );
  if (deps.length) {
    document.getElementById("pkgDetailDepsSection").style.display = "";
    document.getElementById("pkgDetailDeps").innerHTML = deps
      .map(
        (dep) =>
          '<span class="chip" style="margin:2px;font-size:11px;padding:2px 8px">' +
          esc(dep) +
          "</span>",
      )
      .join("");
  }

  const versions = d.versions || [];
  if (versions.length) {
    document.getElementById("pkgDetailVersionsSection").style.display = "";
    document.getElementById("pkgDetailVersions").innerHTML = versions
      .slice(0, 20)
      .map(
        (v) =>
          "<span style=\"display:inline-block;margin:2px 6px;cursor:pointer;color:var(--tx-s)\" onclick=\"document.getElementById('detailVersionSelect').value='" +
          esc(v) +
          "'\">" +
          esc(v) +
          "</span>",
      )
      .join("");
    vs.innerHTML =
      '<option value="">' +
      t("latest_version") +
      " (" +
      esc(d.latest_version || "") +
      ")</option>" +
      versions
        .slice(0, 30)
        .map((v) => '<option value="' + esc(v) + '">' + esc(v) + "</option>")
        .join("");
  }

  ac.innerHTML = "";
  const closeBtn = document.createElement("button");
  closeBtn.className = "btn btn-secondary";
  closeBtn.textContent = t("cancel");
  closeBtn.onclick = () => ov.classList.remove("show");

  const actionBtn = document.createElement("button");
  actionBtn.className = "btn btn-primary";
  if (
    d.installed_version &&
    d.latest_version &&
    cmpVer(d.latest_version, d.installed_version) > 0
  ) {
    actionBtn.textContent = t("pkg_upgrade");
    actionBtn.onclick = () => {
      ov.classList.remove("show");
      doInstallWithOptions(pkg, false, true);
    };
  } else if (!d.installed_version) {
    actionBtn.textContent = t("install");
    actionBtn.onclick = () => {
      ov.classList.remove("show");
      doInstallWithOptions(pkg);
    };
  } else {
    actionBtn.textContent = t("force_install");
    actionBtn.onclick = () => {
      ov.classList.remove("show");
      doInstallWithOptions(pkg, true);
    };
  }
  ac.append(closeBtn, actionBtn);
}
function closePkgDetail() {
  document.getElementById("pkgDetailOv").classList.remove("show");
}
async function doInstallWithOptions(pkg, defaultForce, isUpgrade) {
  const force =
    defaultForce !== undefined
      ? defaultForce
      : document.getElementById("detailForceInstall")?.checked || false;
  const mirror = document.getElementById("detailMirrorSelect")?.value || "";
  const version = document.getElementById("detailVersionSelect")?.value || "";
  const pkgSpec = version ? pkg + "==" + version : pkg;
  const body = { packages: [pkgSpec] };
  if (force) body.force = true;
  if (mirror) body.index_url = mirror;
  if (isUpgrade) {
    const d = await api("/api/packages/upgrade", {
      method: "POST",
      body: JSON.stringify({
        packages: [pkgSpec],
        index_url: mirror || undefined,
      }),
    });
    if (d && d.success && d.task_id) {
      _installTaskIds.set(d.task_id, pkg);
      toast(t("installing"), "");
    } else toast(t("install_failed"), "er");
  } else {
    const d = await api("/api/store/install", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (d && d.success && d.task_id) {
      _installTaskIds.set(d.task_id, pkg);
      toast(t("installing"), "");
    } else toast(t("install_failed"), "er");
  }
}

// ========== 批量安装 ==========
function updateBatchBar() {
  const checked = document.querySelectorAll(".store-card-check:checked");
  const bar = document.getElementById("storeBatchBar");
  if (checked.length > 0) {
    bar.style.display = "flex";
    document.getElementById("storeBatchCount").textContent = t(
      "batch_install_count",
    ).replace("{n}", checked.length);
  } else {
    bar.style.display = "none";
  }
}
async function batchInstall() {
  if (!authed) return showLogin();
  const checked = document.querySelectorAll(".store-card-check:checked");
  const pkgs = Array.from(checked).map((c) => c.dataset.pkg);
  if (!pkgs.length) return;
  const opts = await showInstallConfirm(pkgs.join(", "), true);
  if (!opts) return;
  const body = { packages: pkgs };
  if (opts.force) body.force = true;
  if (opts.index_url) body.index_url = opts.index_url;
  const d = await api("/api/store/install", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, pkgs.join(", "));
    toast(t("installing"), "");
  } else {
    toast(t("install_failed"), "er");
  }
  document
    .querySelectorAll(".store-card-check")
    .forEach((c) => (c.checked = false));
  updateBatchBar();
}
async function restartFramework() {
  if (!authed) return showLogin();
  closeSettings();
  const ok = await confirm2(t("restart"), t("restart_confirm"));
  if (!ok) return;
  toast(t("restart_success"), "");
  const d = await api("/api/restart", { method: "POST" });
  if (!d || !d.success) {
    toast(t("restart_failed"), "er");
  }
}

// 从配置页跳转到「组件配置」的模块配置标签
function goToModuleConfig() {
  go("adapter");
  var btn = document.querySelector('[data-tab="cfg-module"]');
  if (btn) btn.click();
}

async function loadConfig() {
  const c = await api("/api/config");
  if (c && c.config) {
    window._kvData = c.config;
    window._fwData = c.config["ErisPulse"] || {};
    // 过滤掉 ErisPulse 键，不在树形视图中显示
    const treeData = {};
    for (const [k, v] of Object.entries(c.config)) {
      if (k !== "ErisPulse") treeData[k] = v;
    }
    requestAnimationFrame(function () {
      const treeEl = document.getElementById("configBodyTree");
      treeEl.innerHTML = "";
      _appendKvChunks(treeEl, kvTreeChunks(treeData, "config", ""));
    });
  }
  const s = await api("/api/storage");
  if (s) {
    document.getElementById("storageCount").textContent =
      (s.total || 0) + " " + t("storage_items");
    const k = s.keys || [];
    requestAnimationFrame(function () {
      document.getElementById("storageBody").innerHTML = k.length
        ? k
            .slice(0, 200)
            .map((x) => kvRow(esc(x), s.data[x], "storage", x))
            .join("")
        : '<div class="empty-state"><p>' + t("empty_storage") + "</p></div>";
    });
  }

  // 如果在源码视图，也加载源码
  if (document.getElementById("configBodySource").style.display !== "none") {
    await loadConfigSource();
  }
}

var _cfgSourceCM = null;
var _cfgTomlMod = null;
var _cfgSourceOk = true;
var _cfgValidateTimer = null;

function _cfgEditorTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dracula"
    : "default";
}

async function _getCfgTomlMod() {
  if (_cfgTomlMod !== null) return _cfgTomlMod;
  try {
    _cfgTomlMod = await import(
      "https://cdn.jsdelivr.net/npm/smol-toml@1.7.1/+esm"
    );
  } catch (e) {
    _cfgTomlMod = false;
  }
  return _cfgTomlMod;
}

function _ensureCfgSourceCM() {
  if (_cfgSourceCM) return _cfgSourceCM;
  var ta = document.getElementById("configSourceEditor");
  if (!ta || typeof CodeMirror === "undefined") return null;
  _cfgSourceCM = CodeMirror.fromTextArea(ta, {
    mode: "toml",
    theme: _cfgEditorTheme(),
    lineNumbers: true,
    matchBrackets: true,
    autoCloseBrackets: true,
    lineWrapping: true,
    tabSize: 4,
    indentUnit: 4,
  });
  _cfgSourceCM.setSize("100%", "500px");
  _cfgSourceCM.on("change", function () {
    _cfgSourceDirty = true;
    clearTimeout(_cfgValidateTimer);
    _cfgValidateTimer = setTimeout(_validateCfgToml, 300);
  });
  return _cfgSourceCM;
}

async function _validateCfgToml() {
  var cm = _cfgSourceCM;
  if (!cm) return;
  var statusEl = document.getElementById("configSourceStatus");
  var content = cm.getValue();
  if (!content.trim()) {
    _cfgSourceOk = true;
    if (statusEl) {
      statusEl.textContent = "";
      statusEl.className = "cfg-source-status";
    }
    return;
  }
  var mod = await _getCfgTomlMod();
  if (!mod) {
    if (statusEl) {
      statusEl.textContent = "";
      statusEl.className = "cfg-source-status";
    }
    return;
  }
  try {
    mod.parse(content);
    _cfgSourceOk = true;
    if (statusEl) {
      statusEl.textContent = "✓ " + t("config_syntax_ok");
      statusEl.className = "cfg-source-status ok";
    }
  } catch (e) {
    _cfgSourceOk = false;
    var msg = e && e.message ? String(e.message).split("\n")[0] : String(e);
    if (statusEl) {
      statusEl.textContent = "✗ " + msg;
      statusEl.className = "cfg-source-status err";
    }
  }
}

async function loadConfigSource() {
  const d = await api("/api/config/source");
  if (d && d.content != null) {
    var cm = _ensureCfgSourceCM();
    if (cm) {
      cm.setValue(d.content);
      _cfgSourceDirty = false;
      cm.setOption("theme", _cfgEditorTheme());
      setTimeout(function () {
        cm.refresh();
        _validateCfgToml();
      }, 100);
    } else {
      const editor = document.getElementById("configSourceEditor");
      if (editor) editor.value = d.content;
    }
  } else {
    toast(t("config_load_failed"), "er");
  }
}

async function saveConfigSource() {
  var cm = _cfgSourceCM;
  var content = cm
    ? cm.getValue()
    : (document.getElementById("configSourceEditor") || {}).value;
  if (content == null) return;

  await _validateCfgToml();
  if (!_cfgSourceOk) {
    toast(t("config_syntax_err"), "er");
    return;
  }

  const d = await api("/api/config/source", {
    method: "POST",
    body: JSON.stringify({ content }),
  });

  if (d && d.success) {
    _cfgSourceDirty = false;
    toast(t("config_saved"), "ok");
    loadConfig();
  } else {
    toast(t("save_failed") + ": " + (d?.error || t("unknown_error")), "er");
  }
}

async function switchConfigView(view, btn) {
  if (view === "tree" && _cfgSourceDirty) {
    var ok = await confirm2(t("unsaved_title"), t("unsaved_confirm"));
    if (!ok) return;
  }
  // 只作用于内部的 tree/source toggle，不影响外层 tab
  var headerActions = btn.closest(".header-actions");
  if (headerActions) {
    headerActions
      .querySelectorAll(".view-btn")
      .forEach((b) => b.classList.remove("active"));
  }
  btn.classList.add("active");
  const treeView = document.getElementById("configBodyTree");
  const sourceView = document.getElementById("configBodySource");
  if (view === "tree") {
    treeView.style.display = "block";
    sourceView.style.display = "none";
  } else {
    treeView.style.display = "none";
    sourceView.style.display = "block";
    loadConfigSource();
  }
}

function getSetting(key, def) {
  const v = localStorage.getItem("ep_setting_" + key);
  return v !== null ? v : def;
}
function setSetting(key, val) {
  localStorage.setItem("ep_setting_" + key, val);
}

function showSettings() {
  go("settings");
}
function closeSettings() {}

function switchSettingsTab(tab, btn) {
  var tabs = btn.closest(".pkg-tabs").querySelectorAll(".pkg-tab");
  tabs.forEach(function (b) {
    b.classList.remove("active");
  });
  btn.classList.add("active");
  document.querySelectorAll("#p-settings .tab-section").forEach(function (s) {
    s.style.display = "none";
  });
  var target = document.getElementById(tab + "-tab");
  if (target) target.style.display = "block";
  if (tab === "settings-update") {
    loadFrameworkVersions();
    document.getElementById("settingsUpdateTab")?.classList.remove("show-update");
  }
}

function updateAboutCard() {
  var fw = window._fwStatus || {};
  var ver = document.getElementById("aboutFwVer");
  if (ver) ver.textContent = fw.version ? "ErisPulse v" + fw.version : "-";
  var meta = document.getElementById("aboutFwMeta");
  if (meta) {
    var parts = [];
    if (fw.python_version) parts.push("Python " + fw.python_version);
    if (fw.platform) parts.push(fw.platform);
    meta.textContent = parts.join(" · ");
  }
}

async function loadSettings() {
  updateAboutCard();
  syncSettingsUI();
  initAccentSwatches();
  initCustomThemeEditor();
  initFontSelector();
  await loadGlobalAppearance();
}

async function loadGlobalAppearance() {
  try {
    var d = await api("/api/appearance");
    if (!d || !d.appearance) return;
    var app = d.appearance;
    var scopeEl = document.getElementById("settingsGlobalScope");
    if (scopeEl) scopeEl.checked = !!app._global_enabled;
    // 全局同步开启时，其它端自动套用全局外观
    if (app._global_enabled) {
      applyGlobalAppearanceData(app);
    }
  } catch (e) {
    console.debug("Appearance API unavailable, using local settings");
  }
}

// 全局同步开关：显式开启/关闭（关闭后各端恢复使用本地外观）
async function onSettingsScopeChange(checked) {
  try {
    await api("/api/appearance", {
      method: "PUT",
      body: JSON.stringify({ _global_enabled: checked }),
    });
  } catch (e) {}
}

function applyDashTitle(title) {
  if (!title) title = "ErisPulse Dashboard";
  setSetting("dash_title", title);
  var el = document.getElementById("appTitle");
  if (el) el.textContent = title;
  document.title = title;
}

function applyGlobalAppearanceData(app) {
  if (app.dash_title) {
    setSetting("dash_title", app.dash_title);
    applyDashTitle(app.dash_title);
  }
  if (app.theme) {
    localStorage.setItem("ep_theme", app.theme);
    applyTheme(app.theme);
    syncSettingsUI();
  }
  if (app.ui_style) {
    /* 风格已固定为 eris，仅保持属性同步，不再接受外部值 */
    applyUiStyle(FIXED_UI_STYLE);
  }
  if (app.font) {
    localStorage.setItem("ep_font", app.font);
    applyFont(app.font);
    syncFontCards();
  }
  if (app.oled !== undefined) {
    localStorage.setItem("ep_oled", app.oled ? "on" : "off");
    applyOled(app.oled);
    var oledEl = document.getElementById("settingsOled");
    if (oledEl) oledEl.checked = app.oled;
  }
  if (app.bg_color) {
    applyBgColor(app.bg_color);
  }
  if (app.bg_image) {
    setSetting("bg_image", app.bg_image);
    applyBgImage(app.bg_image);
  } else {
    clearBgImage();
  }
  if (app.accent_color) {
    applyAccentColor(app.accent_color);
  }
  if (app.bg_auto_theme !== undefined) {
    localStorage.setItem("ep_setting_bg_auto_theme", app.bg_auto_theme);
    var autoEl = document.getElementById("settingsBgAutoTheme");
    if (autoEl) autoEl.checked = app.bg_auto_theme;
  }
}

function collectAppearanceData() {
  return {
    dash_title: getSetting("dash_title", "ErisPulse Dashboard"),
    theme: getTheme(),
    ui_style: getUiStyle(),
    font: getFont(),
    oled: getOled(),
    bg_color: getSetting("bg_color", ""),
    bg_image: getSetting("bg_image", ""),
    accent_color: getSetting("accent_color", ""),
    bg_auto_theme: bgAutoThemeEnabled(),
  };
}

// 主动上传当前外观为全局外观（由用户点击「上传全局」触发）
async function uploadGlobalAppearance() {
  var data = collectAppearanceData();
  try {
    var d = await api("/api/appearance", {
      method: "PUT",
      body: JSON.stringify(data),
    });
    if (d && d.success) {
      toast(t("settings_upload_global_ok"), "ok");
    } else {
      toast(t("save_failed") + ": " + (d?.error || t("unknown_error")), "er");
    }
  } catch (e) {
    toast(t("save_failed"), "er");
  }
}

// ========== 设置页新增偏好 ==========

function _availableNavPages() {
  var out = [];
  var seen = {};
  Array.prototype.forEach.call(
    document.querySelectorAll(".nav-item[data-page]"),
    function (a) {
      var page = a.getAttribute("data-page");
      if (!page || seen[page]) return;
      seen[page] = 1;
      var c = navItemContent(page);
      out.push({ value: page, label: (c && c.title) || page });
      // 子 tab 变体（同主页 pin 逻辑）
      var tabs = MERGED_PAGE_TABS[page];
      if (tabs) {
        tabs.forEach(function (tabInfo) {
          out.push({
            value: page + ":" + tabInfo.id,
            label: "↳ " + (t(tabInfo.i18n) || tabInfo.label),
          });
        });
      }
    },
  );
  return out;
}

function _fillDefaultPageSelect() {
  var el = document.getElementById("settingsDefaultPage");
  if (!el) return;
  var cur = getDefaultPage();
  var pages = _availableNavPages();
  var opts = "";
  pages.forEach(function (p) {
    opts +=
      '<option value="' +
      esc(p.value) +
      '"' +
      (p.value === cur ? " selected" : "") +
      ">" +
      esc(p.label) +
      "</option>";
  });
  var known = pages.some(function (p) {
    return p.value === cur;
  });
  opts +=
    '<option value="__custom__"' +
    (cur && !known ? " selected" : "") +
    ">" +
    esc(t("settings_default_custom")) +
    "</option>";
  el.innerHTML = opts;
  el.value = known ? cur : "__custom__";
}

function applySettingDefaultPage(val) {
  if (val === "__custom__") {
    var cur = getDefaultPage();
    prompt2(t("settings_default_custom"), t("settings_default_custom_desc"), cur && cur !== "dashboard" ? cur : "dashboard").then(function (id) {
      if (!id) {
        _fillDefaultPageSelect();
        return;
      }
      setSetting("default_page", id);
      _fillDefaultPageSelect();
    });
    return;
  }
  setSetting("default_page", val);
}
function getDefaultPage() {
  return getSetting("default_page", "dashboard");
}
function applyDefaultPageOnLogin() {
  var p = getDefaultPage();
  if (!p || p === "dashboard") return;
  // 模块视图异步渲染，轮询等待 nav-item 出现后跳转
  var attempts = 0;
  var timer = setInterval(function () {
    attempts++;
    if (document.querySelector('.nav-item[data-page="' + p + '"]')) {
      clearInterval(timer);
      go(p);
    } else if (attempts > 30) {
      clearInterval(timer);
      go(p);
    }
  }, 100);
}

function applySettingDensity(val) {
  setSetting("density", val);
  document.documentElement.setAttribute("data-density", val);
}
function getDensity() {
  return getSetting("density", "comfortable");
}

function applySettingTabSize(val) {
  setSetting("editor_tab_size", val);
  _applyEditorOptions();
}
function applySettingLineWrap(on) {
  setSetting("editor_line_wrap", on ? "1" : "0");
  _applyEditorOptions();
}
function getEditorTabSize() {
  return parseInt(getSetting("editor_tab_size", "4"), 10) || 4;
}
function getEditorLineWrap() {
  return getSetting("editor_line_wrap", "1") !== "0";
}
function _applyEditorOptions() {
  var tab = getEditorTabSize(),
    wrap = getEditorLineWrap();
  if (_cfgSourceCM) {
    _cfgSourceCM.setOption("tabSize", tab);
    _cfgSourceCM.setOption("indentUnit", tab);
    _cfgSourceCM.setOption("lineWrapping", wrap);
  }
  if (_fmEditor) {
    _fmEditor.setOption("tabSize", tab);
    _fmEditor.setOption("indentUnit", tab);
    _fmEditor.setOption("lineWrapping", wrap);
  }
}

function applySettingCustomCss() {
  var css = document.getElementById("settingsCustomCss")?.value || "";
  setSetting("custom_css", css);
  var style = document.getElementById("epCustomCss");
  if (!style) {
    style = document.createElement("style");
    style.id = "epCustomCss";
    document.head.appendChild(style);
  }
  style.textContent = css;
  toast(t("config_saved"), "ok");
}
function initCustomCss() {
  var css = getSetting("custom_css", "");
  var el = document.getElementById("settingsCustomCss");
  if (el) el.value = css;
  if (css) {
    var style = document.getElementById("epCustomCss");
    if (!style) {
      style = document.createElement("style");
      style.id = "epCustomCss";
      document.head.appendChild(style);
    }
    style.textContent = css;
  }
}

function exportAppearancePrefs() {
  var data = {
    version: 1,
    exported: Date.now(),
    theme: getTheme(),
    ui_style: getUiStyle(),
    font: getFont(),
    oled: getOled(),
    bg_color: getSetting("bg_color", ""),
    bg_image: getSetting("bg_image", ""),
    accent_color: getSetting("accent_color", ""),
    bg_auto_theme: bgAutoThemeEnabled(),
    dash_title: getSetting("dash_title", "ErisPulse Dashboard"),
  };
  var blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "erispulse-appearance.json";
  a.click();
  URL.revokeObjectURL(a.href);
  toast(t("settings_export_ok"), "ok");
}

function importAppearancePrefs() {
  var input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = function () {
    var f = input.files && input.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var d = JSON.parse(e.target.result);
        if (d.theme) {
          localStorage.setItem("ep_theme", d.theme);
          applyTheme(d.theme);
        }
        if (d.ui_style) {
          /* 风格已固定，导入的旧备份值仅触发属性同步 */
          applyUiStyle(FIXED_UI_STYLE);
        }
        if (d.font) {
          localStorage.setItem("ep_font", d.font);
          applyFont(d.font);
        }
        if (d.oled !== undefined) {
          localStorage.setItem("ep_oled", d.oled ? "on" : "off");
          applyOled(d.oled);
        }
        if (d.bg_color) applyBgColor(d.bg_color);
        if (d.bg_image) {
          setSetting("bg_image", d.bg_image);
          applyBgImage(d.bg_image);
        } else {
          clearBgImage();
        }
        if (d.accent_color) applyAccentColor(d.accent_color);
        if (d.bg_auto_theme !== undefined) {
          localStorage.setItem("ep_setting_bg_auto_theme", d.bg_auto_theme);
        }
        if (d.dash_title) applyDashTitle(d.dash_title);
        syncSettingsUI();
        toast(t("settings_import_ok"), "ok");
      } catch (err) {
        toast(t("validation_failed"), "er");
      }
    };
    reader.readAsText(f);
  };
  input.click();
}

// ========== UX 增强 ==========

var _cfgSourceDirty = false;

function showShortcutsHelp() {
  var rows =
    '<div class="list-row" style="font-size:13px"><span style="flex:1">' +
    esc(t("kb_focus_search")) +
    '</span><code style="background:var(--bg-s);padding:2px 8px;border-radius:4px;border:1px solid var(--bd)">/</code></div>' +
    '<div class="list-row" style="font-size:13px"><span style="flex:1">' +
    esc(t("kb_close_modal")) +
    '</span><code style="background:var(--bg-s);padding:2px 8px;border-radius:4px;border:1px solid var(--bd)">Esc</code></div>' +
    '<div class="list-row" style="font-size:13px"><span style="flex:1">' +
    esc(t("kb_show_help")) +
    '</span><code style="background:var(--bg-s);padding:2px 8px;border-radius:4px;border:1px solid var(--bd)">?</code></div>';
  showModal(t("kb_title"), rows, [
    { label: t("ok"), value: true, primary: true },
  ]);
}

function toastUndo(msg, undoFn) {
  var el = document.createElement("div");
  el.style.cssText =
    "position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(12px);display:flex;align-items:center;gap:12px;padding:10px 14px 10px 24px;border-radius:8px;font-size:14px;font-family:inherit;background:var(--bg-t);color:var(--tx-p);border:1px solid var(--bd);box-shadow:0 8px 24px rgba(0,0,0,.15);z-index:9999;opacity:0;transition:opacity .25s ease,transform .25s cubic-bezier(.4,0,.2,1)";
  var span = document.createElement("span");
  span.textContent = msg;
  el.appendChild(span);
  var btn = document.createElement("button");
  btn.className = "btn btn-secondary btn-xs";
  btn.textContent = t("undo");
  btn.onclick = function () {
    try {
      undoFn();
    } catch (e) {}
    el.remove();
  };
  el.appendChild(btn);
  document.body.appendChild(el);
  requestAnimationFrame(function () {
    el.style.opacity = "1";
    el.style.transform = "translateX(-50%) translateY(0)";
  });
  setTimeout(function () {
    el.style.opacity = "0";
    el.style.transform = "translateX(-50%) translateY(12px)";
    setTimeout(function () {
      el.remove();
    }, 250);
  }, 4000);
}

document.addEventListener("keydown", function (e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  var tag = (e.target.tagName || "").toLowerCase();
  if (
    e.key === "/" &&
    tag !== "input" &&
    tag !== "textarea" &&
    !e.target.isContentEditable
  ) {
    var s = document.getElementById("storeSearch");
    if (s) {
      e.preventDefault();
      s.focus();
    }
  } else if (e.key === "Escape") {
    closeSidebar();
    var ov = document.getElementById("modalOv");
    if (ov && ov.classList.contains("show")) ov.classList.remove("show");
    if (typeof closeNodeDropdown === "function") closeNodeDropdown();
  } else if (e.key === "?") {
    e.preventDefault();
    showShortcutsHelp();
  }
});

window.addEventListener("beforeunload", function (e) {
  if (_cfgSourceDirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});

var _swipeX = 0,
  _swipeT = 0;
document.addEventListener(
  "touchstart",
  function (e) {
    _swipeX = e.changedTouches[0].clientX;
    _swipeT = Date.now();
  },
  { passive: true },
);
document.addEventListener(
  "touchend",
  function (e) {
    if (window.innerWidth > 768) return;
    var sb = document.getElementById("sidebar");
    if (!sb) return;
    var dx = e.changedTouches[0].clientX - _swipeX;
    var dt = Date.now() - _swipeT;
    if (Math.abs(dx) < 60 || dt > 400) return;
    if (dx > 0 && !sb.classList.contains("open") && _swipeX < 40) {
      toggleSidebar();
    } else if (dx < 0 && sb.classList.contains("open")) {
      closeSidebar();
    }
  },
  { passive: true },
);

function syncSettingsUI() {
  // Style cards (ErisPulse / MD3)
  var curStyle = getUiStyle();
  document.querySelectorAll(".style-card").forEach(function(card) {
    card.classList.toggle("active", card.dataset.style === curStyle);
  });
  
  // Theme cards (Light / Dark / Auto)
  var curTheme = getTheme();
  document.querySelectorAll(".theme-card").forEach(function(card) {
    card.classList.toggle("active", card.dataset.themeCard === curTheme);
  });
  var oledEl = document.getElementById("settingsOled");
  if (oledEl) oledEl.checked = getOled();
  var autoCard = document.querySelector('.theme-card[data-theme-card="auto"]');
  if (autoCard) {
    var eff = getEffectiveTheme();
    var label = autoCard.querySelector(".theme-card-label-sm");
    if (label) label.textContent = eff === "dark" ? "跟随系统 · 深色" : "跟随系统 · 浅色";
  }
  // Language cards
  document.querySelectorAll(".lang-card").forEach(function(card) {
    card.classList.toggle("active", card.dataset.lang === lang);
  });
  var sbEl = document.getElementById("settingsSidebar");
  if (sbEl) {
    var _sidebarColl = localStorage.getItem("ep_sidebar_collapsed");
    sbEl.checked =
      _sidebarColl === null ? true : _sidebarColl === "true";
  }
  var nsEl = document.getElementById("settingsNodeSelector");
  if (nsEl)
    nsEl.checked = localStorage.getItem("ep_show_node_selector") !== "false";
  var rgEl = document.getElementById("settingsRememberGroups");
  if (rgEl)
    rgEl.checked = localStorage.getItem("ep_remember_groups") !== "false";
  var rfEl = document.getElementById("settingsRefresh");
  if (rfEl) rfEl.value = getSetting("refresh_interval", "5000");
  var elEl = document.getElementById("settingsEventLimit");
  if (elEl) elEl.value = getSetting("event_limit", "100");
  var animEl = document.getElementById("settingsAnimStyle");
  if (animEl) animEl.value = getAnimStyle();
  var dtEl = document.getElementById("settingsDashTitle");
  if (dtEl) dtEl.value = getSetting("dash_title", "ErisPulse Dashboard");
  // Apply saved accent color to CSS variables (not just sync UI)
  var savedAccent = getSetting("accent_color", "");
  if (savedAccent) applyAccentColor(savedAccent);
  else syncAccentUI("#4fa6de");
  var bgInput = document.getElementById("settingsBg");
  if (bgInput) bgInput.value = getSetting("bg_color", "") || "#f4f7fb";
  var hasBgImg = !!getSetting("bg_image", "");
  showBgAutoThemeRow(hasBgImg);
  var autoChk = document.getElementById("settingsBgAutoTheme");
  if (autoChk) autoChk.checked = bgAutoThemeEnabled();
  // 偏好设置回显
  _fillDefaultPageSelect();
  var dnEl = document.getElementById("settingsDensity");
  if (dnEl) dnEl.value = getDensity();
  var tsEl = document.getElementById("settingsTabSize");
  if (tsEl) tsEl.value = String(getEditorTabSize());
  var lwEl = document.getElementById("settingsLineWrap");
  if (lwEl) lwEl.checked = getEditorLineWrap();
  var ccEl = document.getElementById("settingsCustomCss");
  if (ccEl) ccEl.value = getSetting("custom_css", "");
  var pmEl = document.getElementById("settingsPrivacyMode");
  if (pmEl) pmEl.checked = getPrivacyMode();
  var evDenEl = document.getElementById("settingsEventDensity");
  if (evDenEl) evDenEl.value = getEventDensity();
  var atEl = document.getElementById("settingsEventAutoTop");
  if (atEl) atEl.checked = getEventAutoTop();
  document.body.classList.toggle("privacy-on", getPrivacyMode());
}

function applySettingTheme(theme) {
  if (theme !== "light" && theme !== "dark" && theme !== "auto") return;
  localStorage.setItem("ep_theme", theme);
  applyTheme(theme);
  syncSettingsUI();
}
function applySettingLang(v) {
  lang = v;
  localStorage.setItem("ep_lang", lang);
  applyI18n();
  // Sync language cards after i18n update
  document.querySelectorAll(".lang-card").forEach(function(card) {
    card.classList.toggle("active", card.dataset.lang === lang);
  });
  loadAll();
}
async function syncFrameworkLang() {
  const d = await api("/api/i18n/language", {
    method: "POST",
    body: JSON.stringify({ lang: lang }),
  });
  if (d && d.success) {
    toast(t("settings_sync_framework_done"), "ok");
  } else {
    toast(d?.error || t("settings_sync_framework_fail"), "er");
  }
}
function applySettingSidebar(collapsed) {
  localStorage.setItem("ep_sidebar_collapsed", collapsed);
  if (window.innerWidth <= 768) return;
  document.getElementById("sidebar").classList.toggle("collapsed", collapsed);
}
function applySettingRefresh(val) {
  setSetting("refresh_interval", val);
  restartRefreshTimer();
}
function applySettingEventLimit(val) {
  setSetting("event_limit", val);
}

// ── 私密模式 ──
function getPrivacyMode() {
  return getSetting("privacy_mode", "0") !== "0";
}
function privText(txt) {
  if (!getPrivacyMode() || txt == null) return txt;
  var n = Math.max(4, Math.min(String(txt).length, 20));
  return "\u2022".repeat(n);
}
function applyPrivacyMode(on) {
  setSetting("privacy_mode", on ? "1" : "0");
  document.body.classList.toggle("privacy-on", on);
  refreshEventViews();
  syncSettingsUI();
}
function refreshEventViews() {
  var evl = document.getElementById("eventList");
  var dh = document.getElementById("dashEvents");
  var all = typeof allEvents !== "undefined" ? allEvents : [];
  if (evl && all.length) {
    var active = document.querySelector(".page.active");
    if (!active || active.id === "p-event-stream") {
      evl.innerHTML = all.slice().reverse().map(evHtml).join("");
    }
  }
  if (dh) {
    var s = document.querySelector(".page.active");
    if (!s || s.id === "p-dashboard") {
      dh.innerHTML =
        all.slice(-20).reverse().map(evHtml).join("") ||
        '<div style="padding:16px 18px;font-size:13px;color:var(--tx-s)">' +
          t("waiting_events") +
          "</div>";
    }
  }
}

// ── 事件列表密度 ──
function getEventDensity() {
  return getSetting("event_density", "comfy");
}
function applySettingEventDensity(val) {
  setSetting("event_density", val === "compact" ? "compact" : "comfy");
  refreshEventViews();
  syncSettingsUI();
}

// ── 实时新事件自动回顶 ──
function getEventAutoTop() {
  return getSetting("event_auto_top", "1") !== "0";
}
function applySettingEventAutoTop(on) {
  setSetting("event_auto_top", on ? "1" : "0");
}

// ── 数据与重置 ──
function resetAppearanceSettings() {
  confirm2(
    t("settings_reset_appearance"),
    t("settings_reset_appearance_desc") + "？",
  ).then(function (ok) {
    if (!ok) return;
    [
      "ep_theme",
      "ep_oled",
      "ep_font",
      "ep_setting_accent_color",
      "ep_setting_bg_color",
      "ep_setting_bg_image",
      "ep_setting_bg_auto_theme",
      "ep_setting_custom_css",
      "ep_setting_density",
    ].forEach(function (k) {
      localStorage.removeItem(k);
    });
    location.reload();
  });
}
function resetAllSettings() {
  confirm2(
    t("settings_reset_all"),
    t("settings_reset_all_desc") + "？",
  ).then(function (ok) {
    if (!ok) return;
    var keep = {};
    var keepKeys = ["ep_lang", TK];
    keepKeys.forEach(function (k) {
      try {
        keep[k] = localStorage.getItem(k);
      } catch (e) {}
    });
    try {
      localStorage.clear();
    } catch (e) {}
    keepKeys.forEach(function (k) {
      if (keep[k] !== undefined && keep[k] !== null)
        try {
          localStorage.setItem(k, keep[k]);
        } catch (e) {}
    });
    location.reload();
  });
}
function applySettingNodeSelector(show) {
  localStorage.setItem("ep_show_node_selector", show);
  // 重新应用显隐逻辑
  updateNodeSelectorVisibility();
}

function getAnimStyle() {
  return localStorage.getItem("ep_anim_style") || "subtle";
}
function applyAnimStyle(style) {
  document.documentElement.setAttribute("data-anim", style);
}
function applySettingAnimStyle(val) {
  localStorage.setItem("ep_anim_style", val);
  applyAnimStyle(val);
}

// ========== 配色定制（主题色 / 背景） ==========

// 预设强调色（MD3 风格）
var ACCENT_PRESETS = [
  "#4fa6de", // ErisPulse 默认蓝
  "#6750a4", // MD3 紫
  "#006b3c", // 深绿
  "#e8590c", // 橙
  "#c92a2a", // 红
  "#9c36b5", // 品红
  "#2c7bb6", // 深蓝
  "#495057", // 石板灰
];

// hex -> "r, g, b"
function hexToRgbStr(hex) {
  hex = hex.replace("#", "");
  if (hex.length === 3)
    hex = hex
      .split("")
      .map(function (c) {
        return c + c;
      })
      .join("");
  var r = parseInt(hex.substr(0, 2), 16);
  var g = parseInt(hex.substr(2, 2), 16);
  var b = parseInt(hex.substr(4, 2), 16);
  return r + ", " + g + ", " + b;
}

// 调亮/调暗 hex，pct<0 变暗、>0 变亮
function shadeHex(hex, pct) {
  hex = hex.replace("#", "");
  var num = parseInt(hex, 16);
  var r = (num >> 16) & 255,
    g = (num >> 8) & 255,
    b = num & 255;
  var amt = Math.round(2.55 * pct);
  r = Math.max(0, Math.min(255, r + amt));
  g = Math.max(0, Math.min(255, g + amt));
  b = Math.max(0, Math.min(255, b + amt));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function applyAccentColor(hex) {
  if (!hex) return;
  setSetting("accent_color", hex);
  var root = document.documentElement.style;
  root.setProperty("--accent", hex);
  root.setProperty("--accent-rgb", hexToRgbStr(hex));
  // 填充色比点缀色更深，保证白字可读
  root.setProperty("--accent-fill", shadeHex(hex, -18));
  root.setProperty("--accent-fill-h", shadeHex(hex, -28));
  root.setProperty("--accent-h", shadeHex(hex, -10));
  syncAccentUI(hex);
}

function applyAccentColorManual(hex) {
  // 手动选择强调色时自动关闭自动取色，避免刷新后被覆盖
  if (bgAutoThemeEnabled()) {
    localStorage.setItem("ep_setting_bg_auto_theme", "false");
    var autoChk = document.getElementById("settingsBgAutoTheme");
    if (autoChk) autoChk.checked = false;
  }
  applyAccentColor(hex);
}

// 背景纯色
function applyBgColor(hex) {
  if (!hex) return;
  setSetting("bg_color", hex);
  document.documentElement.style.setProperty("--bg-p", hex);
  clearBgImage();
  // 默认：背景色变化时同步推导一个柔和的强调色
  if (bgAutoThemeEnabled()) {
    applyAccentColor(deriveAccentFromBg(hex));
  }
  var bgInput = document.getElementById("settingsBg");
  if (bgInput) bgInput.value = hex;
}

// 用户手动选择背景色（与纯 apply 区分，手动变更需同步到全局）
function applyBgColorManual(hex) {
  applyBgColor(hex);
}

// 背景图片：上传
function applyBgImageFile(file) {
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function (e) {
    var dataUrl = e.target.result;
    // 本地预览（不存 base64 到 localStorage，避免塞满本地存储）
    applyBgImage(dataUrl);
    showBgAutoThemeRow(true);
    if (bgAutoThemeEnabled()) {
      extractImageColor(dataUrl, function (hex) {
        applyAccentColor(hex);
      });
    }
    // 上传到服务器，只保存 URL（避免 base64 污染配置）
    uploadBgImage(file).then(function (url) {
      if (url) {
        setSetting("bg_image", url);
      } else {
        // 上传失败时回退到本地 base64（仅本地，不同步）
        setSetting("bg_image", dataUrl);
      }
    });
  };
  reader.readAsDataURL(file);
}

// 上传背景图到服务器，返回 URL（避免 base64 污染配置）
async function uploadBgImage(file) {
  if (!file) return null;
  try {
    var fd = new FormData();
    fd.append("file", file);
    var d = await api("/api/appearance/upload", { method: "POST", body: fd });
    return d && d.success ? d.url : null;
  } catch (e) {
    console.debug("bg upload failed:", e);
    return null;
  }
}

function applyBgImage(dataUrl) {
  if (!dataUrl) return;
  // 背景图 + 半透明遮罩（保证内容可读）
  var dark = getEffectiveTheme() === "dark";
  var overlay = dark
    ? "linear-gradient(rgba(10,14,23,0.8),rgba(10,14,23,0.8))"
    : "linear-gradient(rgba(244,247,252,0.74),rgba(244,247,252,0.74))";
  document.body.style.backgroundImage = overlay + ', url("' + dataUrl + '")';
  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundPosition = "center";
  document.body.style.backgroundAttachment = "fixed";
  // 纯色背景失效
  document.documentElement.style.removeProperty("--bg-p");
}

function clearBgImage() {
  document.body.style.removeProperty("background-image");
  document.body.style.removeProperty("background-size");
  document.body.style.removeProperty("background-position");
  document.body.style.removeProperty("background-attachment");
}

// 从图片提取主色调
function extractImageColor(dataUrl, cb) {
  var img = new Image();
  img.onload = function () {
    var cw = 24,
      ch = 24;
    var c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    var ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, cw, ch);
    var data;
    try {
      data = ctx.getImageData(0, 0, cw, ch).data;
    } catch (e) {
      cb("#4fa6de");
      return;
    }
    // 量化到 32 的颜色桶，统计频次并偏好饱和色
    var buckets = {};
    for (var i = 0; i < data.length; i += 4) {
      var r = data[i],
        g = data[i + 1],
        b = data[i + 2],
        a = data[i + 3];
      if (a < 125) continue;
      var qr = Math.round(r / 32) * 32,
        qg = Math.round(g / 32) * 32,
        qb = Math.round(b / 32) * 32;
      var key = qr + "," + qg + "," + qb;
      var mx = Math.max(r, g, b),
        mn = Math.min(r, g, b);
      var sat = mx === 0 ? 0 : (mx - mn) / mx; // 饱和度
      if (!buckets[key]) buckets[key] = { n: 0, r: 0, g: 0, b: 0, sat: 0 };
      var bk = buckets[key];
      bk.n++;
      bk.r += r;
      bk.g += g;
      bk.b += b;
      bk.sat += sat;
    }
    var best = null,
      bestScore = -1;
    Object.keys(buckets).forEach(function (k) {
      var bk = buckets[k];
      var avgSat = bk.sat / bk.n;
      // 评分：频次 × (饱和度加权)，避免选到灰白黑
      var score = bk.n * (0.4 + avgSat * 1.6);
      if (score > bestScore) {
        bestScore = score;
        best = bk;
      }
    });
    if (!best) {
      cb("#4fa6de");
      return;
    }
    var hr = Math.round(best.r / best.n),
      hg = Math.round(best.g / best.n),
      hb = Math.round(best.b / best.n);
    // 若提取色太灰，退回默认蓝
    var mx2 = Math.max(hr, hg, hb),
      mn2 = Math.min(hr, hg, hb);
    if (mx2 - mn2 < 18) cb("#4fa6de");
    else
      cb(
        themeAwareAccent(
          "#" + ((1 << 24) + (hr << 16) + (hg << 8) + hb).toString(16).slice(1),
        ),
      );
  };
  img.onerror = function () {
    cb("#4fa6de");
  };
  img.src = dataUrl;
}

// 由背景纯色推导一个柔和强调色（默认行为）
function deriveAccentFromBg(hex) {
  hex = hex.replace("#", "");
  var num = parseInt(hex, 16);
  var r = (num >> 16) & 255,
    g = (num >> 8) & 255,
    b = num & 255;
  var mx = Math.max(r, g, b),
    mn = Math.min(r, g, b);
  var sat = mx === 0 ? 0 : (mx - mn) / mx;
  // 背景几乎无色彩 → 保持默认蓝，避免随灰色背景变灰
  if (sat < 0.12) return "#4fa6de";
  // 有色彩 → 取背景主色，并按当前主题压暗/提亮
  return themeAwareAccent("#" + hex);
}

// 按当前主题调整强调色亮度：深色模式提亮、浅色模式压暗
function themeAwareAccent(hex) {
  var dark = getEffectiveTheme() === "dark";
  return shadeHex(hex, dark ? 14 : -18);
}

function bgAutoThemeEnabled() {
  return localStorage.getItem("ep_setting_bg_auto_theme") !== "false";
}

function showBgAutoThemeRow(show) {
  var row = document.getElementById("bgAutoThemeRow");
  if (row) row.style.display = show ? "flex" : "none";
}

function onBgAutoThemeToggle(checked) {
  localStorage.setItem("ep_setting_bg_auto_theme", checked);
  if (checked) {
    // 开启自动取色：立即按当前背景重算
    var img = getSetting("bg_image", "");
    var col = getSetting("bg_color", "");
    if (img) {
      extractImageColor(img, function (hex) {
        applyAccentColor(hex);
      });
    } else if (col) {
      applyAccentColor(deriveAccentFromBg(col));
    } else {
      resetAccent();
    }
  }
}

// 重置背景（颜色 + 图片）
function resetBg() {
  localStorage.removeItem("ep_setting_bg_color");
  localStorage.removeItem("ep_setting_bg_image");
  document.documentElement.style.removeProperty("--bg-p");
  clearBgImage();
  showBgAutoThemeRow(false);
  var bgInput = document.getElementById("settingsBg");
  if (bgInput) bgInput.value = "#f4f7fb";
  var bgFile = document.getElementById("settingsBgFile");
  if (bgFile) bgFile.value = "";
  if (bgAutoThemeEnabled()) resetAccent();
}

// 重置强调色为默认
function resetAccent() {
  localStorage.removeItem("ep_setting_accent_color");
  var root = document.documentElement.style;
  root.removeProperty("--accent");
  root.removeProperty("--accent-rgb");
  root.removeProperty("--accent-fill");
  root.removeProperty("--accent-fill-h");
  root.removeProperty("--accent-h");
  syncAccentUI("#4fa6de");
}

function syncAccentUI(hex) {
  var swatches = document.querySelectorAll(".color-swatch");
  swatches.forEach(function (s) {
    s.classList.toggle("active", s.dataset.color === hex);
  });
  var accentInput = document.getElementById("settingsAccent");
  if (accentInput) accentInput.value = hex;
}

function initAccentSwatches() {
  var wrap = document.getElementById("accentSwatches");
  if (!wrap || wrap.childElementCount) return;
  ACCENT_PRESETS.forEach(function (c) {
    var btn = document.createElement("button");
    btn.className = "color-swatch";
    btn.style.background = c;
    btn.dataset.color = c;
    btn.title = c;
    btn.onclick = function () {
      applyAccentColorManual(c);
    };
    wrap.appendChild(btn);
  });
}

// ========== Full custom theme editor ==========
var FULL_THEME_VARS = [
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
var FULL_THEME_GROUPS = { bg:'背景', text:'文字', border:'边框', accent:'强调色', semantic:'语义色', other:'其他' };

function getFullCustomTheme() {
  try { return JSON.parse(localStorage.getItem('ep_full_custom_theme')); } catch(e) { return null; }
}

function applyFullCustomTheme() {
  var d = getFullCustomTheme();
  if (!d || !d.enabled) {
    FULL_THEME_VARS.forEach(function(v) { document.documentElement.style.removeProperty(v.key); });
    return;
  }
  Object.keys(d.vars).forEach(function(k) { if (d.vars[k]) document.documentElement.style.setProperty(k, d.vars[k]); });
}

function initCustomThemeEditor() {
  var c = document.getElementById('customThemeVars');
  if (!c) return;
  var groups = {}; var h = '';
  FULL_THEME_VARS.forEach(function(v) { if (!groups[v.group]) groups[v.group] = []; groups[v.group].push(v); });
  Object.keys(groups).forEach(function(g) {
    h += '<div class="ct-group"><div class="ct-group-title">' + (FULL_THEME_GROUPS[g]||g) + '</div>';
    groups[g].forEach(function(v) {
      h += '<div class="ct-row">'
        + '<label class="ct-label">' + v.label + '</label>'
        + '<input type="color" class="ct-color" data-var="' + v.key + '" value="#000000">'
        + '<input type="text" class="ct-input" data-var="' + v.key + '" placeholder="' + v.key + '" spellcheck="false">'
        + '<button type="button" class="ct-reset btn-icon btn-xs" onclick="resetThemeVar(\'' + v.key + '\')">↺</button>'
        + '</div>';
    });
    h += '</div>';
  });
  c.innerHTML = h;
  c.querySelectorAll('.ct-color').forEach(function(el) {
    el.addEventListener('input', function() { var i = el.parentElement.querySelector('.ct-input'); if (i) i.value = el.value; });
  });
  c.querySelectorAll('.ct-input').forEach(function(el) {
    el.addEventListener('input', function() { var co = el.parentElement.querySelector('.ct-color'); if (co && /^#[0-9a-f]{6}$/i.test(el.value)) co.value = el.value; });
  });
  var saved = getFullCustomTheme();
  if (saved && saved.enabled) {
    document.getElementById('customThemeToggle').checked = true;
    Object.keys(saved.vars).forEach(function(k) { var r = c.querySelector('[data-var="' + k + '"]'); if (r) r.value = saved.vars[k]; });
    c.querySelectorAll('input').forEach(function(el) { el.disabled = false; });
    c.querySelectorAll('button').forEach(function(el) { el.disabled = false; });
  } else {
    c.querySelectorAll('input').forEach(function(el) { el.disabled = true; });
    c.querySelectorAll('button').forEach(function(el) { el.disabled = true; });
  }
}

function onCustomThemeToggle(enabled) {
  var saved = getFullCustomTheme() || { vars:{}, enabled:false };
  saved.enabled = enabled;
  if (enabled) {
    var c = document.getElementById('customThemeVars');
    if (c) c.querySelectorAll('.ct-input').forEach(function(el) { if (el.value) saved.vars[el.dataset.var] = el.value; });
  }
  localStorage.setItem('ep_full_custom_theme', JSON.stringify(saved));
  applyFullCustomTheme();
  var c = document.getElementById('customThemeVars');
  if (c) { c.querySelectorAll('input,button').forEach(function(el) { el.disabled = !enabled; }); }
}

function saveFullCustomTheme() {
  var saved = getFullCustomTheme() || { vars:{}, enabled:true };
  var c = document.getElementById('customThemeVars');
  if (c) c.querySelectorAll('.ct-input').forEach(function(el) { if (el.value) saved.vars[el.dataset.var] = el.value; });
  saved.enabled = true;
  localStorage.setItem('ep_full_custom_theme', JSON.stringify(saved));
  applyFullCustomTheme();
  document.getElementById('customThemeToggle').checked = true;
  if (c) c.querySelectorAll('input,button').forEach(function(el) { el.disabled = false; });
}

function resetFullCustomTheme() {
  localStorage.removeItem('ep_full_custom_theme');
  applyFullCustomTheme();
  var c = document.getElementById('customThemeVars');
  if (c) { c.querySelectorAll('.ct-input').forEach(function(el) { el.value = ''; }); }
  document.getElementById('customThemeToggle').checked = false;
  if (c) c.querySelectorAll('input,button').forEach(function(el) { el.disabled = true; });
}

function resetThemeVar(key) {
  document.documentElement.style.removeProperty(key);
  var c = document.getElementById('customThemeVars');
  if (c) { var i = c.querySelector('.ct-input[data-var="' + key + '"]'); if (i) i.value = ''; }
}

// 启动时恢复自定义配色
function applyCustomTheme() {
  var img = getSetting("bg_image", "");
  var col = getSetting("bg_color", "");
  var accent = getSetting("accent_color", "");
  var auto = bgAutoThemeEnabled();
  if (img) {
    // 有背景图：应用图，并按自动取色推导强调色
    applyBgImage(img);
    if (auto) {
      extractImageColor(img, function (hex) {
        applyAccentColor(hex);
      });
    } else if (accent) {
      applyAccentColor(accent);
    }
  } else if (col) {
    applyBgColor(col);
  } else if (accent && !auto) {
    // 无背景、手动选过强调色
    applyAccentColor(accent);
  }
}

// Listen for system theme changes when in auto mode
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function() {
  if (getTheme() === "auto") {
    onThemeChanged();
  }
});

// ========== 主页快捷导航（可自定义 pin） ==========

var HOME_PIN_DEFAULTS = ["config", "module-mgmt", "logs", "files"];
var _homePinsEditing = false;

// 合并页面的 tab 定义（用于 pin 选择器展示子 tab）
var MERGED_PAGE_TABS = {
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

function getHomePins() {
  var raw = localStorage.getItem("ep_home_pins");
  if (raw) {
    try {
      var arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    } catch (e) {}
  }
  return HOME_PIN_DEFAULTS.slice();
}

function setHomePins(arr) {
  localStorage.setItem("ep_home_pins", JSON.stringify(arr));
}

// 从侧边栏导航项读取图标+标题；支持 page:tab 格式
function navItemContent(pinId) {
  var parts = pinId.split(":");
  var page = parts[0];
  var tab = parts[1];
  var item = document.querySelector('.nav-item[data-page="' + page + '"]');
  if (!item) return null;
  var svg = item.querySelector("svg");
  var span = item.querySelector("span");
  var title = span ? span.textContent : page;
  // 如果有子 tab，只显示 tab 名称（不显示父页面名）
  if (tab) {
    var tabBtn = document.querySelector('[data-tab="' + tab + '"]');
    if (tabBtn) {
      var tabText = tabBtn.textContent.trim();
      if (tabText) title = tabText;
    }
  }
  return {
    svg: svg ? svg.outerHTML : "",
    title: title,
  };
}

function renderHomePins() {
  var wrap = document.getElementById("homePins");
  if (!wrap) return;
  var pins = getHomePins();
  wrap.innerHTML = "";
  var found = 0;
  pins.forEach(function (pinId, idx) {
    var c = navItemContent(pinId);
    if (!c) return; // 该视图不存在（如动态视图已卸载），跳过
    found++;
    var card = document.createElement("div");
    card.className = "home-pin" + (_homePinsEditing ? " editing" : "");
    card.draggable = _homePinsEditing;
    card.setAttribute("data-page", pinId);
    card.setAttribute("data-idx", String(idx));
    if (!_homePinsEditing) {
      card.addEventListener("click", function () {
        var parts = pinId.split(":");
        if (parts[1]) {
          // page:tab 格式 — 先导航到页面再切换 tab
          go(parts[0]);
          var tabBtn = document.querySelector('[data-tab="' + parts[1] + '"]');
          if (tabBtn) tabBtn.click();
        } else {
          go(pinId);
        }
      });
    }

    var grip = document.createElement("span");
    grip.className = "home-pin-grip";
    grip.title = "Drag";
    grip.textContent = "⋮⋮";
    card.appendChild(grip);

    var icon = document.createElement("span");
    icon.innerHTML = c.svg;
    card.appendChild(icon.firstChild || icon);

    var label = document.createElement("span");
    label.className = "home-pin-label";
    label.textContent = c.title;
    card.appendChild(label);

    if (_homePinsEditing) {
      var rm = document.createElement("button");
      rm.className = "home-pin-remove";
      rm.textContent = "×";
      rm.addEventListener("click", function (e) {
        e.stopPropagation();
        removeHomePin(pinId);
      });
      card.appendChild(rm);
    }
    wrap.appendChild(card);
  });
  if (found === 0) {
    var empty = document.createElement("div");
    empty.className = "home-pin-empty";
    empty.style.cssText = "color:var(--tx-t);font-size:13px;padding:12px 0";
    empty.textContent = t("home_empty");
    wrap.appendChild(empty);
  }
  bindHomePinDnd();

  var addBar = document.getElementById("homePinAdd");
  if (addBar) addBar.style.display = _homePinsEditing ? "block" : "none";
}

function toggleHomePinsEdit() {
  _homePinsEditing = !_homePinsEditing;
  var btn = document.getElementById("homePinsEditBtn");
  if (btn) btn.classList.toggle("active", _homePinsEditing);
  renderHomePins();
}

function removeHomePin(page) {
  var pins = getHomePins().filter(function (p) {
    return p !== page;
  });
  setHomePins(pins);
  renderHomePins();
}

function toggleHomePinPicker() {
  var picker = document.getElementById("homePinPicker");
  if (!picker) return;
  if (picker.style.display === "none") {
    var pinned = getHomePins();
    var all = Array.prototype.map.call(
      document.querySelectorAll(".nav-item[data-page]"),
      function (a) {
        return a.getAttribute("data-page");
      },
    );
    picker.innerHTML = "";
    var count = 0;

    function addOption(label, svgHtml, onClick, isSub) {
      var opt = document.createElement("div");
      opt.className = isSub ? "home-pin-suboption" : "home-pin-option";
      opt.addEventListener("click", onClick);
      var icon = document.createElement("span");
      icon.innerHTML = svgHtml || "";
      opt.appendChild(icon.firstChild || icon);
      var span = document.createElement("span");
      span.textContent = label;
      opt.appendChild(span);
      picker.appendChild(opt);
      count++;
    }

    all.forEach(function (page) {
      var c = navItemContent(page);
      if (!c) return;

      var isPinned = pinned.indexOf(page) !== -1;

      // 整页 pin 选项（仅当该页面未被 pin 时显示）
      if (!isPinned) {
        addOption(c.title, c.svg, function () {
          addHomePin(page);
        });
      }

      // 子 tab 选项（仅当父页面未被 pin 时显示，避免孤儿选项）
      if (!isPinned) {
        var tabs = MERGED_PAGE_TABS[page];
        if (tabs) {
          tabs.forEach(function (tabInfo) {
            var pinId = page + ":" + tabInfo.id;
            if (pinned.indexOf(pinId) !== -1) return;
            addOption(
              t(tabInfo.i18n) || tabInfo.label,
              c.svg,
              function () {
                addHomePin(pinId);
              },
              true,
            );
          });
        }
      }
    });
    if (count === 0) {
      var none = document.createElement("div");
      none.style.cssText = "padding:8px;color:var(--tx-t)";
      none.textContent = "—";
      picker.appendChild(none);
    }
    picker.style.display = "block";
  } else {
    picker.style.display = "none";
  }
}

function addHomePin(page) {
  var pins = getHomePins();
  if (pins.indexOf(page) === -1) {
    pins.push(page);
    setHomePins(pins);
  }
  var picker = document.getElementById("homePinPicker");
  if (picker) picker.style.display = "none";
  renderHomePins();
}

// 原生拖拽排序
var _dragPinIdx = null;
function bindHomePinDnd() {
  var pins = document.querySelectorAll(".home-pin");
  pins.forEach(function (el) {
    el.addEventListener("dragstart", function (e) {
      _dragPinIdx = parseInt(el.dataset.idx, 10);
      el.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    el.addEventListener("dragend", function () {
      el.classList.remove("dragging");
    });
    el.addEventListener("dragover", function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      el.classList.add("drag-over");
    });
    el.addEventListener("dragleave", function () {
      el.classList.remove("drag-over");
    });
    el.addEventListener("drop", function (e) {
      e.preventDefault();
      el.classList.remove("drag-over");
      var targetIdx = parseInt(el.dataset.idx, 10);
      if (_dragPinIdx === null || _dragPinIdx === targetIdx) return;
      var arr = getHomePins();
      var moved = arr.splice(_dragPinIdx, 1)[0];
      arr.splice(targetIdx, 0, moved);
      setHomePins(arr);
      _dragPinIdx = null;
      renderHomePins();
    });
  });
}

function updateNodeSelectorVisibility() {
  var nodeSelector = document.getElementById("nodeSelector");
  if (!nodeSelector) return;
  var showSetting = localStorage.getItem("ep_show_node_selector") !== "false"; // 默认开启
  if (!showSetting) {
    nodeSelector.style.display = "none";
    return;
  }
  // 设置开启时：有远程节点才显示
  var hasRemote = Object.keys(nodeRuntimeInfo).some(function (id) {
    return id !== "local";
  });
  nodeSelector.style.display = hasRemote ? "" : "none";
}

let _refreshTimer = null;
function restartRefreshTimer() {
  if (_refreshTimer) clearInterval(_refreshTimer);
  const interval = parseInt(getSetting("refresh_interval", "5000"));
  if (interval > 0 && authed) {
    _refreshTimer = setInterval(refreshDashboard, interval);
  }
}

function toggleSidebarCollapse() {
  if (window.innerWidth <= 768) return; // mobile: no collapsed state
  const sb = document.getElementById("sidebar");
  sb.classList.toggle("collapsed");
  localStorage.setItem(
    "ep_sidebar_collapsed",
    sb.classList.contains("collapsed"),
  );
  document.getElementById("settingsSidebar").checked =
    sb.classList.contains("collapsed");
}

function kvRow(k, v, mode, fk) {
  const tp = v === null ? "null" : typeof v;
  const ds = tp === "object" ? JSON.stringify(v) : String(v);
  const isMultiline = ds.includes("\n") || ds.length > 100;
  const saveFn = mode === "config" ? "saveConfig(this)" : "saveStorage(this)";

  // 只允许编辑子项属性，不允许定义根值
  const isRootLevel = fk && !fk.includes(".");
  const canEdit = mode === "config" ? !isRootLevel : true;

  const inputHtml = isMultiline
    ? `<textarea class="kv-input kv-textarea" data-key="${esc(fk)}" data-type="${tp}"
                 rows="3" onfocus="this.select()"
                 onkeydown="if(event.key==='Enter' && !event.shiftKey){event.preventDefault();${saveFn}}">${esc(ds)}</textarea>`
    : `<input class="kv-input" type="text" value="${esc(ds)}" data-key="${esc(fk)}" data-type="${tp}"
                 ${canEdit ? "" : "readonly"} onfocus="this.select()"
                 onkeydown="if(event.key==='Enter'){event.preventDefault();${saveFn}}">`;

  const delBtn =
    mode === "storage"
      ? `<button class="kv-btn kv-btn-del" onclick="delStorage('${esc(fk)}',this)" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>`
      : "";

  const readOnlyIndicator = !canEdit
    ? '<span style="font-size:11px;color:var(--wr-c);margin-left:8px">' +
      t("read_only") +
      "</span>"
    : "";

  return `<div class="kv-row"><div class="kv-key">${esc(k)}</div><div class="kv-actions">${inputHtml}<button class="kv-btn kv-btn-save" onclick="${saveFn}" title="Save" ${!canEdit ? 'style="display:none"' : ""}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></button>${delBtn}${readOnlyIndicator}</div></div>`;
}

function kvTreeChunks(obj, mode, pfx, dep) {
  dep = dep || 0;
  const chunks = [];
  for (const [k, v] of Object.entries(obj)) {
    const fk = pfx ? pfx + "." + k : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      chunks.push(
        '<div class="kv-group collapsed" style="margin-left:' +
          dep * 12 +
          'px" data-pfx="' +
          esc(fk) +
          '" data-mode="' +
          mode +
          '" data-dep="' +
          (dep + 1) +
          '"><div class="kv-group-hd" onclick="toggleKvGroup(this)"><span class="kv-chevron">\u25BC</span><span style="flex:1">' +
          esc(k) +
          '</span><span class="kv-count">' +
          Object.keys(v).length +
          '</span></div><div class="kv-group-body"></div></div>',
      );
    } else {
      chunks.push(
        '<div style="margin-left:' +
          dep * 12 +
          'px">' +
          kvRow(k, v, mode, fk) +
          "</div>",
      );
    }
  }
  return chunks;
}

function _appendKvChunks(container, chunks) {
  if (!chunks.length) return;
  let i = 0;
  function step() {
    const end = Math.min(i + 120, chunks.length);
    let html = "";
    for (; i < end; i++) html += chunks[i];
    container.insertAdjacentHTML("beforeend", html);
    if (i < chunks.length) requestAnimationFrame(step);
  }
  step();
}

function kvTree(obj, mode, pfx, dep) {
  return kvTreeChunks(obj, mode, pfx, dep).join("");
}

const _fwDefaults = {
  server: {
    host: "0.0.0.0",
    port: 8000,
    auto_start: true,
    ssl_certfile: null,
    ssl_keyfile: null,
    ssl_cert: null,
    ssl_key: null,
  },
  logger: {
    level: "INFO",
    format: "rich",
    log_files: [],
    log_dir: "",
    log_rotation: "size",
    log_max_size_mb: 10,
    log_backup_count: 5,
    log_rotation_when: "midnight",
    memory_limit: 1000,
    exclude_levels: [],
  },
  storage: {
    backend: "sqlite",
    use_global_db: false,
    mysql: {
      host: "127.0.0.1",
      port: 3306,
      user: "erispulse",
      password: "",
      database: "erispulse",
      charset: "utf8mb4",
      pool_min: 1,
      pool_max: 10,
    },
    postgres: {
      host: "127.0.0.1",
      port: 5432,
      user: "erispulse",
      password: "",
      database: "erispulse",
      pool_min: 1,
      pool_max: 10,
    },
  },
  modules: {},
  adapters: {},
  event: {
    overrides: {
      message: {},
      notice: {},
      request: {},
      meta: {},
      command: {},
      acl: {},
      acl_default_allow: true,
    },
    message: { ignore_self: true },
    command: {
      prefix: "/",
      case_sensitive: true,
      allow_space_prefix: false,
      must_at_bot: false,
    },
  },
  master: { users: {} },
  framework: {
    enable_lazy_loading: true,
    plugins_dir: "plugins",
    uninit_timeout: 30,
    strict_mode: 0,
    strict_mode_exceptions: { modules: [], adapters: [] },
    handler_max_concurrency: 64,
    proactive_gc_interval: 300,
    proactive_gc_generation: 0,
    proactive_gc_full_every: 20,
    proactive_gc_memory_growth_mb: 32,
    proactive_gc_idle_only: false,
    proactive_gc_gen0_min: 500,
    offline_bot_expiry: 3600,
  },
  i18n: { language: "auto" },
  scope: {
    default_allow: true,
    cache_size: 1024,
    platforms: {},
    bots: {},
    sessions: {},
    identity: {
      adapters: {},
      bots: {},
      sessions: {},
      users: {},
    },
    actions: {},
  },
  interaction: { checkpoint_ttl: 86400 },
  transcript: {
    enabled: true,
    max_per_session: 50,
    ttl_hours: 168,
  },
};

const _fwFieldDescs = {
  "server.host": "监听地址",
  "server.port": "监听端口",
  "server.auto_start": "初始化时自动启动 HTTP 路由服务器",
  "server.ssl_certfile": "SSL 证书文件路径，设为 null 则不使用 SSL",
  "server.ssl_keyfile": "SSL 密钥文件路径",
  "server.ssl_cert": "内联 PEM 证书内容（优先于 ssl_certfile，适合容器/无文件系统场景）",
  "server.ssl_key": "内联 PEM 密钥内容（优先于 ssl_keyfile）",
  "logger.level": "日志级别: TRACE / DEBUG / INFO / EVENT / WARNING / ERROR / CRITICAL",
  "logger.log_files": '日志文件列表（显式路径，不分段），如 ["logs/app.log"]；与 log_dir 互斥且优先',
  "logger.log_dir": "日志输出目录（自动创建），写入 erispulse.log 并按 log_rotation 自动分段",
  "logger.log_rotation": "分段方式: size（按大小）/ date（按时间）/ none（不分段）",
  "logger.log_max_size_mb": "size 模式单文件大小上限（MB），超过后轮转为备份",
  "logger.log_backup_count": "保留的历史日志文件数，超出最旧的自动删除",
  "logger.log_rotation_when": "date 模式轮转周期: S / M / H / D / midnight（每天零点）",
  "logger.memory_limit": "内存日志条数上限",
  "logger.exclude_levels": '屏蔽指定日志等级（完全丢弃），如 ["EVENT"] 隐藏消息收发内容保护隐私',
  "storage.backend": "存储后端: sqlite（默认零配置）/ mysql / postgres（需安装可选驱动，参数变更需重启）",
  "storage.use_global_db": "仅 SQLite：使用包内全局数据库（跨模块共享），变更需重启",
  "storage.mysql.host": "MySQL 主机（backend = mysql 时生效，需 pip install ErisPulse[mysql]）",
  "storage.mysql.port": "MySQL 端口",
  "storage.mysql.user": "MySQL 用户名",
  "storage.mysql.password": "MySQL 密码",
  "storage.mysql.database": "MySQL 数据库名",
  "storage.mysql.charset": "MySQL 字符集",
  "storage.mysql.pool_min": "MySQL 连接池最小连接数",
  "storage.mysql.pool_max": "MySQL 连接池最大连接数",
  "storage.postgres.host": "PostgreSQL 主机（backend = postgres 时生效，需 pip install ErisPulse[postgres]）",
  "storage.postgres.port": "PostgreSQL 端口",
  "storage.postgres.user": "PostgreSQL 用户名",
  "storage.postgres.password": "PostgreSQL 密码",
  "storage.postgres.database": "PostgreSQL 数据库名",
  "storage.postgres.pool_min": "PostgreSQL 连接池最小连接数",
  "storage.postgres.pool_max": "PostgreSQL 连接池最大连接数",
  "event.overrides.acl_default_allow": "ACL 兜底：true = 未配置 ACL 的命令放行；false = 严格模式（无 ACL 即拒）",
  "event.message.ignore_self": "忽略机器人自身发出的消息",
  "event.command.prefix": "命令触发前缀",
  "event.command.case_sensitive": "命令是否区分大小写",
  "event.command.allow_space_prefix": "是否允许命令前缀前有空格",
  "event.command.must_at_bot": "是否必须 @Bot 才能触发命令",
  "master.users": "框架主人：dict 按平台指定，list 为全局主人（所有平台生效）；支持热更新",
  "framework.enable_lazy_loading": "是否启用模块懒加载（按需加载）",
  "framework.plugins_dir": "本地插件文件夹（相对项目根目录，字符串或列表）",
  "framework.uninit_timeout": "优雅关闭总超时时间（秒），超过后强制终止；0 表示不设超时",
  "framework.strict_mode":
    "严格模式：0=宽松（仅警告，默认）/ 1=严格-跳过不合规组件 / 2=严格-致命（中止启动）",
  "framework.strict_mode_exceptions.modules": "严格模式豁免的模块名列表",
  "framework.strict_mode_exceptions.adapters": "严格模式豁免的适配器名列表",
  "framework.handler_max_concurrency": "事件处理器最大并发数（同时运行的 Task 数量，0 表示无限制），支持热更新",
  "framework.proactive_gc_interval": "主动 GC 间隔（秒，支持小数），0 表示禁用；变更即时重启任务",
  "framework.proactive_gc_generation": "常规轮次回收分代（0/1/2），0 保持轻量；深度回收由 full_every 周期触发",
  "framework.proactive_gc_full_every": "每 N 轮做一次全量回收，0 表示禁用；受内存增长门限约束",
  "framework.proactive_gc_memory_growth_mb": "全量回收的内存增长门限（MB），0 表示不设门限",
  "framework.proactive_gc_idle_only": "开启后事件洪峰时跳过 Python GC，避免停顿与消息处理竞争",
  "framework.proactive_gc_gen0_min": "gen0 垃圾量低于此值直接跳过回收（空转近乎零开销），0 表示始终回收",
  "framework.offline_bot_expiry": "离线 Bot 过期时间（秒），超过自动清除，0 表示不过期",
  "i18n.language": "语言设置（auto 为自动检测）",
  "scope.default_allow": "作用域全局兜底：false = 隐式拒绝严格模式（不影响出站维度）",
  "scope.cache_size": "作用域判定 LRU 缓存大小",
  "interaction.checkpoint_ttl": "对话自动检查点过期秒数，重启恢复时超期存档被丢弃",
  "transcript.enabled": "是否启用会话收件箱自动记录",
  "transcript.max_per_session": "每会话保留消息条数上限",
  "transcript.ttl_hours": "记录全局过期时间（小时），过期惰性清理",
};

const _fwFieldWidgets = {
  "logger.level": {
    widget: "select",
    options: ["TRACE", "DEBUG", "INFO", "EVENT", "WARNING", "ERROR", "CRITICAL"],
  },
  "logger.format": { widget: "select", options: ["rich", "plain", "json"] },
  "logger.log_rotation": {
    widget: "select",
    options: ["size", "date", "none"],
  },
  "logger.log_rotation_when": {
    widget: "select",
    options: ["midnight", "S", "M", "H", "D"],
  },
  "storage.backend": {
    widget: "select",
    options: ["sqlite", "mysql", "postgres"],
  },
  "framework.strict_mode": {
    widget: "select",
    options: [0, 1, 2],
  },
  "i18n.language": {
    widget: "select",
    options: ["auto", "zh", "en", "zh-TW", "ja", "ru"],
  },
};

var _fwKnownKeys = null;

function _buildFwKnownKeys() {
  if (_fwKnownKeys) return _fwKnownKeys;
  _fwKnownKeys = {};
  (function walk(obj, prefix) {
    for (var k in obj) {
      var key = prefix ? prefix + "." + k : k;
      var v = obj[k];
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        walk(v, key);
      } else {
        _fwKnownKeys[key] = true;
      }
    }
  })(_fwDefaults, "");
  return _fwKnownKeys;
}

function fwFieldDesc(fullKey) {
  const enKey = "fw_field_" + fullKey.replace(/\./g, "_");
  const en = t(enKey);
  if (en !== enKey) return en;
  const desc = _fwFieldDescs[fullKey];
  return desc || "";
}

function deepMerge(target, source) {
  const r = {};
  for (const k of Object.keys(source)) {
    if (
      k in target &&
      target[k] !== null &&
      typeof target[k] === "object" &&
      !Array.isArray(target[k]) &&
      typeof source[k] === "object" &&
      !Array.isArray(source[k])
    ) {
      r[k] = deepMerge(target[k], source[k]);
    } else {
      r[k] = k in target ? target[k] : source[k];
    }
  }
  for (const k of Object.keys(target)) {
    if (!(k in source)) r[k] = target[k];
  }
  return r;
}

function fwSectionI18nKey(key) {
  const i18nKey = "fw_section_" + key.replace(/\./g, "_");
  const label = t(i18nKey);
  return label !== i18nKey ? label : key.replace(/\./g, " › ");
}

// ========== 适配器配置页面 ==========

var _adapterConfigPlatforms = [];
var _adapterConfigCurrent = "";

async function loadAdapterConfigPage() {
  const d = await api("/api/adapters");
  if (!d) return;
  _adapterConfigPlatforms = d.adapters || [];

  const panel = document.getElementById("adapterConfigPanel");
  const empty = document.getElementById("adapterConfigEmpty");

  if (_adapterConfigPlatforms.length === 0) {
    // 没适配器 — 显示空状态 + 引导去商店安装
    if (empty) empty.style.display = "flex";
    panel.innerHTML = "";
    panel.appendChild(empty);
    var cta = document.createElement("button");
    cta.className = "empty-action";
    cta.innerHTML =
      t("store") +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>';
    cta.onclick = function () {
      go("store");
    };
    panel.appendChild(cta);
    return;
  }

  if (empty) empty.style.display = "none";

  // 创建水平适配器选择列表
  let selectorHtml = [
    '<div class="adapter-selector-bar">',
    '<div class="adapter-chip-list" id="adapterChipList">',
  ];

  _adapterConfigPlatforms.forEach((a) => {
    const isActive = a.platform === _adapterConfigCurrent;
    const cls = isActive ? " adapter-chip active" : " adapter-chip";
    const logo = adapterLogoImg(a.platform, 22) || "";
    const dotColor = a.running ? "var(--ok-c)" : "var(--tx-t)";
    const plat = esc(a.platform);
    selectorHtml.push(
      '<div class="' +
        cls +
        '" data-platform="' +
        plat +
        '" onclick="selectAdapter(\'' +
        plat +
        "')\">",
      logo,
      '<span class="adapter-chip-name">' + plat + "</span>",
      '<span class="adapter-chip-dot" style="background:' +
        dotColor +
        '"></span>',
      "</div>",
    );
  });

  selectorHtml.push("</div></div>");
  selectorHtml = selectorHtml.join("");

  // 先放选择器
  panel.innerHTML = selectorHtml;

  // 加载第一个适配器
  if (
    !_adapterConfigCurrent ||
    !_adapterConfigPlatforms.some((a) => a.platform === _adapterConfigCurrent)
  ) {
    _adapterConfigCurrent = _adapterConfigPlatforms[0].platform;
  }
  // 高亮当前选中
  document.querySelectorAll(".adapter-chip").forEach((el) => {
    el.classList.toggle(
      "active",
      el.dataset.platform === _adapterConfigCurrent,
    );
  });
  loadAdapterConfigDetail(_adapterConfigCurrent);
}

function selectAdapter(platform) {
  _adapterConfigCurrent = platform;
  document.querySelectorAll(".adapter-chip").forEach((el) => {
    el.classList.toggle("active", el.dataset.platform === platform);
  });
  loadAdapterConfigDetail(platform);
}

async function loadAdapterConfigDetail(platform) {
  const panel = document.getElementById("adapterConfigPanel");
  if (!panel) return;

  // 保留选择器，只替换内容区
  let container = document.getElementById("adapterConfigContent");
  if (!container) {
    container = document.createElement("div");
    container.id = "adapterConfigContent";
    panel.appendChild(container);
  }
  container.innerHTML =
    '<div style="padding:40px;text-align:center;color:var(--tx-s)">' +
    t("loading") +
    "...</div>";

  const d = await api(
    "/api/adapter/" + encodeURIComponent(platform) + "/config",
  );
  if (!d || d.error) {
    container.innerHTML =
      '<div class="empty-state"><p>' +
      esc(d ? d.error : t("unknown_error")) +
      "</p></div>";
    return;
  }

  var html = '<div class="adapter-config-detail">';

  if (d.has_config && d.schema) {
    html +=
      '<div class="fw-section"><div class="fw-section-title">' +
      t("adapter_global_config") +
      '</div><div class="fw-section-body">';
    html +=
      '<div id="adapterGlobalConfigFields">' +
      renderAdapterSchemaFields(d.schema.fields, d.values || {}, d.config_key) +
      "</div>";
    html +=
      '<div style="margin-top:12px;text-align:right"><button class="btn btn-primary btn-sm" onclick="saveAdapterConfigAll(\'' +
      esc(platform) +
      "')\">" +
      t("save_adapter_config") +
      "</button></div>";
    html += "</div></div>";
  }

  html += "</div>";

  container.innerHTML = html;

  if (d.has_accounts) {
    loadAdapterAccounts(platform);
  }
}

function renderAdapterSchemaFields(fields, values, keyPrefix, opts) {
  if (!fields || Object.keys(fields).length === 0)
    return (
      '<div style="padding:12px;color:var(--tx-s)">' +
      t("no_config_schema") +
      "</div>"
    );

  var groups = {};
  var groupOrder = {};
  for (const [name, fs] of Object.entries(fields)) {
    var g = fs.group || "_default";
    if (!groups[g]) {
      groups[g] = [];
      groupOrder[g] = 100;
    }
    groups[g].push({
      name: name,
      schema: fs,
      value: values[name] !== undefined ? values[name] : fs.default,
    });
  }

  var html = "";
  var sortedGroups = Object.keys(groups).sort(function (a, b) {
    var oa = groupOrder[a] || 100,
      ob = groupOrder[b] || 100;
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b);
  });

  for (const g of sortedGroups) {
    var items = groups[g].sort(function (a, b) {
      var oa = a.schema.order || 100,
        ob = b.schema.order || 100;
      return oa - ob;
    });
    for (const item of items) {
      html += renderAdapterConfigField(
        item.name,
        item.schema,
        item.value,
        keyPrefix,
        opts,
      );
    }
  }
  return html;
}

var EYE_OPEN_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
var EYE_CLOSED_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

function toggleSecretVisibility(btn) {
  var input = btn.parentElement.querySelector("input");
  if (!input) return;
  if (input.type === "password") {
    input.type = "text";
    btn.innerHTML = EYE_CLOSED_SVG;
    btn.title = t("hide_secret");
  } else {
    input.type = "password";
    btn.innerHTML = EYE_OPEN_SVG;
    btn.title = t("show_secret");
  }
}

function renderAdapterConfigField(name, schema, value, keyPrefix, opts) {
  opts = opts || {};
  var fieldSave = opts.fieldSave !== false;
  var saveFn = opts.saveFn || "saveAdapterConfigField";
  var saveTitle = opts.saveTitle || t("save_adapter_config");
  var desc = schema.description || "";
  var tp = schema.type || "string";
  var widget = schema.widget || "";
  var fullKey = (keyPrefix ? keyPrefix + "." : "") + name;
  var onChg = fieldSave ? ' onchange="' + saveFn + '(this)"' : "";
  var saveBtn = fieldSave
    ? '<button class="kv-btn" onclick="' + saveFn + '(this.parentElement.querySelector(\'input,textarea\'))" title="' +
      saveTitle +
      '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></button>'
    : "";

  var ctrl = "";
  // 嵌套 dataclass 子树（schema 带 fields）：渲染为可折叠嵌套分组，递归渲染子字段
  if (schema.fields && typeof schema.fields === "object" && !Array.isArray(schema.fields)) {
    var subValues = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    var subHtml = renderAdapterSchemaFields(schema.fields, subValues, fullKey, opts);
    ctrl =
      '<details class="fw-nested" style="border:1px solid rgba(128,128,128,.25);border-radius:8px;padding:8px 10px;margin:4px 0">' +
      '<summary style="cursor:pointer;font-weight:600;user-select:none">' +
      esc(name) +
      "</summary>" +
      (desc ? '<div class="fw-desc">' + esc(desc) + "</div>" : "") +
      '<div style="margin-top:6px">' +
      subHtml +
      "</div></details>";
    return (
      '<div class="fw-row" style="display:block"><div class="fw-control" style="width:100%">' +
      ctrl +
      "</div></div>"
    );
  }
  if (widget === "switch" || tp === "boolean") {
    var checked = value === true || value === "true" || value === 1;
    ctrl =
      '<label class="switch"><input type="checkbox" ' +
      (checked ? "checked" : "") +
      ' data-ackey="' +
      esc(fullKey) +
      '" data-adapter-tp="boolean" data-adapter-widget="switch"' +
      onChg +
      '><span class="switch-slider"></span></label>';
  } else if (widget === "password" || schema.secret) {
    var eyeBtn =
      '<button class="kv-btn" type="button" onclick="toggleSecretVisibility(this)" title="' +
      esc(t("show_secret")) +
      '">' +
      EYE_OPEN_SVG +
      "</button>";
    ctrl =
      '<div style="display:flex;gap:4px"><input class="fw-input" type="password" value="' +
      esc(String(value != null ? value : "")) +
      '" autocomplete="new-password" data-ackey="' +
      esc(fullKey) +
      '" data-adapter-tp="string">' +
      eyeBtn +
      saveBtn +
      "</div>";
  } else if (widget === "select" || (schema.options && schema.options.length)) {
    var options = schema.options || [];
    var optsHtml = options
      .map(function (o) {
        var optVal = typeof o === "object" ? o.value : o;
        var optLabel = typeof o === "object" ? o.label : o;
        // label 兼容 i18n 字典形态（服务端已解析为文本；此处兜底未解析的场景）
        if (optLabel && typeof optLabel === "object") {
          optLabel =
            optLabel.default != null
              ? optLabel.default
              : String(optLabel.i18n != null ? optLabel.i18n : "");
        }
        var sel =
          String(value).toLowerCase() === String(optVal).toLowerCase()
            ? " selected"
            : "";
        return (
          '<option value="' +
          esc(optVal) +
          '"' +
          sel +
          ">" +
          esc(optLabel) +
          "</option>"
        );
      })
      .join("");
    ctrl =
      '<select class="settings-select" data-ackey="' +
      esc(fullKey) +
      '" data-adapter-tp="string"' +
      onChg +
      ">" +
      optsHtml +
      "</select>";
  } else if (widget === "number" || tp === "integer" || tp === "float") {
    ctrl =
      '<div style="display:flex;gap:4px"><input class="fw-input" type="number" value="' +
      esc(String(value != null ? value : "")) +
      '" data-ackey="' +
      esc(fullKey) +
      '" data-adapter-tp="' +
      esc(tp) +
      '">' +
      saveBtn +
      "</div>";
  } else if (
    tp === "array" ||
    tp === "object" ||
    tp === "table" ||
    (value && typeof value === "object" && !Array.isArray(value)) ||
    Array.isArray(value) ||
    schema.widget === "textarea"
  ) {
    // dict/list 值以 JSON 文本进 textarea（保存路径按 tp=object JSON.parse 回写）
    var strVal =
      value && typeof value === "object"
        ? JSON.stringify(value, null, 2)
        : String(value != null ? value : "");
    ctrl =
      '<div style="display:flex;gap:4px"><textarea class="fw-input fw-textarea" rows="2" data-ackey="' +
      esc(fullKey) +
      '" data-adapter-tp="object">' +
      esc(strVal) +
      "</textarea>" +
      saveBtn +
      "</div>";
  } else {
    ctrl =
      '<div style="display:flex;gap:4px"><input class="fw-input" type="text" value="' +
      esc(String(value != null ? value : "")) +
      '" data-ackey="' +
      esc(fullKey) +
      '" data-adapter-tp="' +
      esc(tp) +
      '">' +
      saveBtn +
      "</div>";
  }

  var descHtml = desc ? '<div class="fw-desc">' + esc(desc) + "</div>" : "";
  return (
    '<div class="fw-row"><div class="fw-label">' +
    esc(name) +
    descHtml +
    '</div><div class="fw-control">' +
    ctrl +
    "</div></div>"
  );
}

async function saveAdapterConfigField(el) {
  var ackey = el.dataset.ackey;
  var tp = el.dataset.adapterTp || "string";
  var val = el.type === "checkbox" ? el.checked : el.value;
  if (tp === "number" || tp === "integer" || tp === "float") val = Number(val);
  else if (tp === "object") {
    try {
      val = JSON.parse(val);
    } catch (e) {
      return toast(t("validation_failed"), "er");
    }
  }

  var d = await api("/api/config", {
    method: "PUT",
    body: JSON.stringify({ key: ackey, value: val }),
  });
  if (d && d.success) {
    el.style.border = "2px solid var(--ok-c)";
    setTimeout(function () {
      el.style.border = "";
    }, 1200);
    toast(t("adapter_config_saved"), "ok");
  } else {
    toast(t("save_failed") + ": " + (d?.error || t("unknown_error")), "er");
  }
}

async function saveModuleConfigField(el) {
  var ackey = el.dataset.ackey;
  var tp = el.dataset.adapterTp || "string";
  var val = el.type === "checkbox" ? el.checked : el.value;
  if (tp === "number" || tp === "integer" || tp === "float") val = Number(val);
  else if (tp === "object") {
    try {
      val = JSON.parse(val);
    } catch (e) {
      return toast(t("validation_failed"), "er");
    }
  }

  var d = await api("/api/config", {
    method: "PUT",
    body: JSON.stringify({ key: ackey, value: val }),
  });
  if (d && d.success) {
    el.style.border = "2px solid var(--ok-c)";
    setTimeout(function () {
      el.style.border = "";
    }, 1200);
    toast(t("module_config_saved"), "ok");
  } else {
    toast(t("save_failed") + ": " + (d?.error || t("unknown_error")), "er");
  }
}

async function saveAdapterConfigAll(platform) {
  var d = await api("/api/adapter/" + encodeURIComponent(platform) + "/config");
  if (!d || !d.schema) return;

  var values = {};
  var inputs = document.querySelectorAll(
    "#adapterGlobalConfigFields [data-ackey]",
  );
  for (var i = 0; i < inputs.length; i++) {
    var el = inputs[i];
    var ackey = el.dataset.ackey;
    var parts = ackey.split(".");
    var keyName = parts[parts.length - 1];
    var tp = el.dataset.adapterTp || "string";
    var val = el.type === "checkbox" ? el.checked : el.value;
    if (tp === "number" || tp === "integer" || tp === "float")
      val = Number(val);
    else if (tp === "object") {
      try {
        val = JSON.parse(val);
      } catch (e) {
        continue;
      }
    }
    values[keyName] = val;
  }

  var result = await api(
    "/api/adapter/" + encodeURIComponent(platform) + "/config",
    {
      method: "PUT",
      body: JSON.stringify({ values: values }),
    },
  );

  if (result && result.success) {
    toast(t("adapter_config_saved"), "ok");
    if (result.errors && result.errors.length > 0) {
      toast(
        t("config_validation_failed") + ": " + result.errors.join(", "),
        "er",
      );
    }
  } else {
    toast(
      t("save_failed") + ": " + (result?.error || t("unknown_error")),
      "er",
    );
    if (result?.errors) toast(result.errors.join(", "), "er");
  }
}

async function loadAdapterAccounts(platform) {
  var panel = document.getElementById("adapterConfigPanel");
  if (!panel) return;

  var d = await api(
    "/api/adapter/" + encodeURIComponent(platform) + "/accounts",
  );
  if (!d || d.error) return;

  // 先清除旧账户内容
  var oldSection = document.getElementById("adapterAccountsSection");
  if (oldSection) oldSection.remove();

  var html =
    '<div id="adapterAccountsSection" class="adapter-accounts-section">' +
    '<div class="adapter-section-heading">' +
    t("adapter_accounts") +
    "</div>" +
    '<div class="adapter-account-list">';

  var accounts = d.accounts || {};
  var schema = d.schema;
  for (var aname in accounts) {
    var adata = accounts[aname] || {};
    html += renderAdapterAccountCard(platform, aname, adata, schema);
  }

  html += "</div>";
  html +=
    '<button class="btn btn-primary btn-sm adapter-add-account-btn" onclick="addAdapterAccount(\'' +
    esc(platform) +
    "')\">+ " +
    t("add_account") +
    "</button>";
  html += "</div>";

  // 追加到内容区
  var container = document.getElementById("adapterConfigContent");
  if (container) {
    container.insertAdjacentHTML("beforeend", html);
  } else {
    panel.innerHTML += html;
  }
}

function renderAdapterAccountCard(platform, accountName, accountData, schema) {
  var fieldsHtml = "";
  if (schema && schema.fields) {
    var items = Object.entries(schema.fields).sort(function (a, b) {
      var oa = a[1].order || 100,
        ob = b[1].order || 100;
      return oa - ob;
    });
    for (var i = 0; i < items.length; i++) {
      var fname = items[i][0],
        fschema = items[i][1];
      if (fname === "enabled" || fname === "name") continue;
      var fval =
        accountData[fname] !== undefined ? accountData[fname] : fschema.default;
      fieldsHtml += renderAdapterConfigField(
        fname,
        fschema,
        fval,
        "accounts." + accountName + "." + platform,
        { fieldSave: false },
      );
    }
  }

  var isEnabled = accountData.enabled !== false;
  return (
    '<div class="account-card"><div class="account-card-header">' +
    '<label class="switch" style="margin-right:8px"><input type="checkbox" ' +
    (isEnabled ? "checked" : "") +
    " onchange=\"saveAdapterAccountField('" +
    esc(platform) +
    "','" +
    esc(accountName) +
    "','enabled',this.checked)\"><span class=\"switch-slider\"></span></label>" +
    '<span class="account-card-name">' +
    esc(accountName) +
    "</span>" +
    '<div style="flex:1"></div>' +
    '<button class="btn btn-danger btn-sm" onclick="removeAdapterAccount(\'' +
    esc(platform) +
    "','" +
    esc(accountName) +
    "')\">" +
    t("remove_account") +
    "</button>" +
    "</div>" +
    '<div class="account-card-body">' +
    fieldsHtml +
    "</div>" +
    '<div class="account-card-footer"><button class="btn btn-primary btn-sm" onclick="saveAdapterAccount(\'' +
    esc(platform) +
    "','" +
    esc(accountName) +
    "')\">" +
    t("save_adapter_config") +
    "</button></div>" +
    "</div>"
  );
}

async function saveAdapterAccountField(
  platform,
  accountName,
  fieldName,
  value,
) {
  var d = await api(
    "/api/adapter/" + encodeURIComponent(platform) + "/accounts",
  );
  if (!d || !d.accounts) return;
  var accounts = d.accounts;
  if (!accounts[accountName]) accounts[accountName] = {};
  accounts[accountName][fieldName] = value;
  var result = await api(
    "/api/adapter/" + encodeURIComponent(platform) + "/accounts",
    {
      method: "PUT",
      body: JSON.stringify({ accounts: accounts }),
    },
  );
  if (result && result.success) {
    toast(t("adapter_config_saved"), "ok");
  } else {
    toast(t("save_failed"), "er");
  }
}

async function saveAdapterAccount(platform, accountName) {
  var accountData = {};
  var inputs = document.querySelectorAll("#adapterConfigPanel [data-ackey]");
  var prefix = "accounts." + accountName + "." + platform + ".";
  for (var i = 0; i < inputs.length; i++) {
    var el = inputs[i];
    var ackey = el.dataset.ackey;
    if (!ackey.startsWith(prefix)) continue;
    var keyName = ackey.substring(prefix.length);
    var tp = el.dataset.adapterTp || "string";
    var val = el.type === "checkbox" ? el.checked : el.value;
    if (tp === "number" || tp === "integer" || tp === "float")
      val = Number(val);
    else if (tp === "object") {
      try {
        val = JSON.parse(val);
      } catch (e) {
        continue;
      }
    }
    accountData[keyName] = val;
  }

  var d = await api(
    "/api/adapter/" + encodeURIComponent(platform) + "/accounts",
  );
  if (!d || !d.accounts) return;
  var accounts = d.accounts;
  accounts[accountName] = accountData;

  var result = await api(
    "/api/adapter/" + encodeURIComponent(platform) + "/accounts",
    {
      method: "PUT",
      body: JSON.stringify({ accounts: accounts }),
    },
  );
  if (result && result.success) {
    toast(t("adapter_config_saved"), "ok");
    if (result.message) {
      toast(result.message);
      showAdapterReloadLog(result.module || platform, platform);
    }
    if (result.errors && result.errors.length > 0) {
      toast(
        t("config_validation_failed") + ": " + result.errors.join(", "),
        "er",
      );
    }
  } else {
    toast(
      t("save_failed") + ": " + (result?.error || t("unknown_error")),
      "er",
    );
    if (result?.errors) toast(result.errors.join(", "), "er");
  }
}

async function addAdapterAccount(platform) {
  var name = await prompt2(
    t("add_account"),
    t("account_name"),
    t("new_account_default_name"),
  );
  if (!name) return;
  var result = await api(
    "/api/adapter/" + encodeURIComponent(platform) + "/accounts/add",
    {
      method: "POST",
      body: JSON.stringify({ name: name }),
    },
  );
  if (result && result.success) {
    toast(t("account_added"), "ok");
    if (result.message) toast(result.message);
    loadAdapterConfigDetail(platform);
  } else {
    toast(
      t("save_failed") + ": " + (result?.error || t("unknown_error")),
      "er",
    );
  }
}

async function removeAdapterAccount(platform, accountName) {
  var ok = await confirm2(
    t("confirm_remove_account"),
    t("remove_account") + ": " + esc(accountName),
  );
  if (!ok) return;
  var result = await api(
    "/api/adapter/" +
      encodeURIComponent(platform) +
      "/accounts/" +
      encodeURIComponent(accountName),
    {
      method: "DELETE",
    },
  );
  if (result && result.success) {
    toast(t("account_removed"), "ok");
    if (result.message) {
      toast(result.message);
      showAdapterReloadLog(result.module || platform, platform);
    }
    loadAdapterConfigDetail(platform);
  } else {
    toast(
      t("save_failed") + ": " + (result?.error || t("unknown_error")),
      "er",
    );
  }
}

async function loadFrameworkConfig() {
  const c = await api("/api/config");
  if (!c || !c.config) return;
  const live = c.config["ErisPulse"] || {};
  const merged = deepMerge(live, _fwDefaults);
  window._fwData = merged;
  const body = document.getElementById("fwConfigBody");
  if (!body) return;
  const sections = flattenFwSections(merged);
  body.innerHTML =
    '<div class="fw-add-field-bar"><button class="btn btn-secondary btn-sm" onclick="addFwField()">+ ' +
    t("fw_add_field") +
    "</button></div>" +
    sections.map((s) => renderFwSection(s)).join("");
  loadFrameworkVersions();
}

async function addFwField() {
  var sectionKey = await prompt2(
    t("fw_add_field"),
    t("fw_add_field_section_hint"),
    "",
  );
  if (!sectionKey) return;
  sectionKey = sectionKey.trim();
  var fieldName = await prompt2(
    t("fw_add_field"),
    t("fw_add_field_name_hint"),
    "",
  );
  if (!fieldName) return;
  fieldName = fieldName.trim();
  var fullKey = "ErisPulse." + sectionKey + "." + fieldName;
  var value = await prompt2(
    t("fw_add_field"),
    t("fw_add_field_value_hint"),
    "",
  );
  if (value === null) return;
  var parsedValue = value;
  try {
    parsedValue = JSON.parse(value);
  } catch (e) {
    // keep as string
  }
  var d = await api("/api/config", {
    method: "PUT",
    body: JSON.stringify({ key: fullKey, value: parsedValue }),
  });
  if (d && d.success) {
    toast(t("config_saved"), "ok");
    loadFrameworkConfig();
  } else {
    toast(t("save_failed") + ": " + (d ? d.error : t("unknown_error")), "er");
  }
}

function flattenFwSections(obj, prefix) {
  prefix = prefix || "";
  var knownKeys = _buildFwKnownKeys();
  const sections = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k === "ErisPulse") continue;
    const key = prefix ? prefix + "." + k : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      const allLeaf = Object.values(v).every(
        (x) => x === null || typeof x !== "object" || Array.isArray(x),
      );
      if (allLeaf) {
        var annotated = {};
        for (var fk in v) {
          var fullKey = key + "." + fk;
          var isKnown =
            !!knownKeys[fullKey] ||
            fullKey.startsWith("adapters.") ||
            fullKey.startsWith("modules.");
          annotated[fk] = { value: v[fk], known: isKnown };
        }
        sections.push({ key, values: annotated });
      } else {
        // 混合类型：先收集原始值（boolean/number/string/array）为当前 section
        var annotated = {};
        for (var fk in v) {
          var fv = v[fk];
          if (fv === null || typeof fv !== "object" || Array.isArray(fv)) {
            var fullKey = key + "." + fk;
            var isKnown =
              !!knownKeys[fullKey] ||
              fullKey.startsWith("adapters.") ||
              fullKey.startsWith("modules.");
            annotated[fk] = { value: fv, known: isKnown };
          }
        }
        if (Object.keys(annotated).length > 0) {
          sections.push({ key, values: annotated });
        }
        // 再递归处理嵌套对象
        sections.push(...flattenFwSections(v, key));
      }
    }
  }
  return sections;
}

function renderFwSection(s) {
  const displayName = fwSectionI18nKey(s.key);
  const knownKeys = _buildFwKnownKeys();
  const rows = Object.entries(s.values)
    .map(([field, info]) => {
      var val =
        info && typeof info === "object" && "value" in info ? info.value : info;
      var keyForCheck = s.key + "." + field;
      var isKnown =
        info && typeof info === "object" && "known" in info
          ? info.known
          : !!knownKeys[keyForCheck];
      isKnown =
        isKnown ||
        keyForCheck.startsWith("adapters.") ||
        keyForCheck.startsWith("modules.");
      const fk = "ErisPulse." + s.key + "." + field;
      const descKey = s.key + "." + field;
      const desc = fwFieldDesc(descKey);
      const tp =
        val === null ? "null" : Array.isArray(val) ? "list" : typeof val;
      var rowClass = isKnown ? "fw-row" : "fw-row fw-row-unknown";
      var unknownLabel = isKnown
        ? ""
        : '<span class="fw-unknown-badge" title="' +
          esc(t("fw_unknown_field_desc")) +
          '">' +
          esc(t("fw_unknown_field")) +
          "</span>";

      var widgetDef = _fwFieldWidgets[descKey];
      var ctrl = "";
      if (widgetDef && widgetDef.widget === "select") {
        var optsHtml = widgetDef.options
          .map(function (o) {
            var sel =
              String(val).toLowerCase() === String(o).toLowerCase()
                ? " selected"
                : "";
            return (
              '<option value="' +
              esc(o) +
              '"' +
              sel +
              ">" +
              esc(o) +
              "</option>"
            );
          })
          .join("");
        ctrl =
          '<select class="settings-select" data-fk="' +
          esc(fk) +
          '" data-tp="string" onchange="saveFwConfig(this)">' +
          optsHtml +
          "</select>";
      } else if (tp === "boolean") {
        ctrl =
          '<label class="switch"><input type="checkbox" ' +
          (val ? "checked" : "") +
          ' data-fk="' +
          esc(fk) +
          '" data-tp="' +
          tp +
          '" onchange="saveFwConfig(this)"><span class="switch-slider"></span></label>';
      } else if (tp === "number") {
        ctrl =
          '<input class="fw-input" type="number" value="' +
          esc(String(val)) +
          '" data-fk="' +
          esc(fk) +
          '" data-tp="' +
          tp +
          '">';
      } else if (tp === "list") {
        ctrl = renderFwListField(fk, val);
      } else if (tp === "object") {
        ctrl =
          '<textarea class="fw-input fw-textarea" rows="2" data-fk="' +
          esc(fk) +
          '" data-tp="' +
          tp +
          '">' +
          esc(JSON.stringify(val)) +
          "</textarea>";
      } else {
        ctrl =
          '<input class="fw-input" type="text" value="' +
          esc(String(val)) +
          '" data-fk="' +
          esc(fk) +
          '" data-tp="' +
          tp +
          '">';
      }
      var saveBtn =
        tp === "boolean" || tp === "list"
          ? ""
          : '<button class="kv-btn kv-btn-save" onclick="saveFwConfig(this.previousElementSibling)" title="Save"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></button>';
      var resetBtn =
        '<button class="kv-btn kv-btn-del" onclick="resetFwField(\'' +
        esc(fk) +
        '\')" title="' +
        esc(isKnown ? t("fw_reset_default") : t("fw_delete_field")) +
        '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg></button>';
      var descHtml = desc ? '<div class="fw-desc">' + esc(desc) + "</div>" : "";
      return (
        '<div class="' +
        rowClass +
        '"><div class="fw-label">' +
        esc(field) +
        unknownLabel +
        descHtml +
        '</div><div class="fw-control">' +
        ctrl +
        saveBtn +
        resetBtn +
        "</div></div>"
      );
    })
    .join("");
  return (
    '<div class="fw-section"><div class="fw-section-title">' +
    esc(displayName) +
    '</div><div class="fw-section-body">' +
    rows +
    "</div></div>"
  );
}

function renderFwListField(fk, val) {
  if (!Array.isArray(val)) val = [val];
  var itemsHtml = val
    .map(function (item, i) {
      return (
        '<div class="fw-list-item">' +
        '<input class="fw-input fw-list-input" type="text" value="' +
        esc(String(item)) +
        '" data-fk="' +
        esc(fk) +
        '" data-idx="' +
        i +
        '">' +
        '<button class="kv-btn kv-btn-del" onclick="removeFwListItem(this)" title="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
        "</div>"
      );
    })
    .join("");
  return (
    '<div class="fw-list-field" data-fk="' +
    esc(fk) +
    '">' +
    itemsHtml +
    '<button class="btn btn-secondary btn-xs fw-list-add-btn" onclick="addFwListItem(this)" data-fk="' +
    esc(fk) +
    '">+ Add</button>' +
    '<button class="btn btn-primary btn-xs fw-list-save-btn" onclick="saveFwListField(this)" data-fk="' +
    esc(fk) +
    '">' +
    t("save_config") +
    "</button>" +
    "</div>"
  );
}

function addFwListItem(btn) {
  var container = btn.parentElement;
  var addBtn = container.querySelector(".fw-list-add-btn");
  var newItem = document.createElement("div");
  newItem.className = "fw-list-item";
  newItem.innerHTML =
    '<input class="fw-input fw-list-input" type="text" value="" data-fk="' +
    esc(btn.dataset.fk) +
    '" data-idx="' +
    container.querySelectorAll(".fw-list-input").length +
    '">' +
    '<button class="kv-btn kv-btn-del" onclick="removeFwListItem(this)" title="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
  container.insertBefore(newItem, addBtn);
  newItem.querySelector("input").focus();
}

function removeFwListItem(btn) {
  var item = btn.parentElement;
  item.remove();
}

async function saveFwListField(btnOrContainer) {
  var container =
    btnOrContainer.classList &&
    btnOrContainer.classList.contains("fw-list-field")
      ? btnOrContainer
      : btnOrContainer.closest(".fw-list-field");
  if (!container) return;
  var fk = container.dataset.fk;
  var inputs = container.querySelectorAll(".fw-list-input");
  var values = [];
  inputs.forEach(function (inp) {
    var v = inp.value.trim();
    if (v) values.push(v);
  });
  if (fk.startsWith("ErisPulse.server.")) {
    var ok = await confirm2(
      t("fw_server_warn_title"),
      t("fw_server_warn_text"),
    );
    if (!ok) return;
  }
  // If single value, save as string; if multiple, save as list
  var saveValue = values.length === 1 ? values[0] : values;
  var d = await api("/api/config", {
    method: "PUT",
    body: JSON.stringify({ key: fk, value: saveValue }),
  });
  if (d && d.success) {
    toast(t("config_saved"), "ok");
    loadFrameworkConfig();
  } else {
    toast(t("save_failed") + ": " + (d ? d.error : t("unknown_error")), "er");
  }
}

async function saveFwConfig(el) {
  const fk = el.dataset.fk;
  if (fk.startsWith("ErisPulse.server.")) {
    const ok = await confirm2(
      t("fw_server_warn_title"),
      t("fw_server_warn_text"),
    );
    if (!ok) return;
  }
  const tp = el.dataset.tp;
  let v = el.type === "checkbox" ? el.checked : el.value;
  if (tp === "number") v = Number(v);
  else if (tp === "object") {
    try {
      v = JSON.parse(v);
    } catch (e) {
      return toast(t("validation_failed"), "er");
    }
  }
  const d = await api("/api/config", {
    method: "PUT",
    body: JSON.stringify({ key: fk, value: v }),
  });
  el.style.border =
    d && d.success ? "2px solid var(--ok-c)" : "2px solid var(--er-c)";
  setTimeout(() => (el.style.border = ""), 1200);
  if (d && d.success) toast(t("config_saved"), "ok");
  else toast(t("save_failed") + ": " + (d?.error || t("unknown_error")), "er");
}

async function resetFwField(fk) {
  var knownKeys = _buildFwKnownKeys();
  var plainKey = fk.replace("ErisPulse.", "");
  var isKnown = !!knownKeys[plainKey];
  var msg = isKnown
    ? t("fw_reset_confirm").replace("{key}", fk)
    : t("fw_delete_confirm").replace("{key}", fk);
  var ok = await confirm2(
    isKnown ? t("fw_reset_default") : t("fw_delete_field"),
    msg,
  );
  if (!ok) return;
  var d = await api("/api/config", {
    method: "PUT",
    body: JSON.stringify({ key: fk, value: null }),
  });
  if (d && d.success) {
    toast(isKnown ? t("fw_reset_done") : t("fw_delete_done"), "ok");
    loadFrameworkConfig();
  } else {
    toast(t("save_failed") + ": " + (d?.error || t("unknown_error")), "er");
  }
}

let _fwVersions = [];
let _fwCurrentVer = "";

/**
 * 判断服务器是否为 Windows（使用 /api/status 或 /api/framework/versions 返回的平台信息）。
 */
function isServerWindows() {
  if (typeof window._serverIsWindows === "boolean") return window._serverIsWindows;
  var p = (window._serverPlatform || "").toLowerCase();
  return p === "windows";
}

/**
 * 启动时检查框架是否有新版本。
 * - 有更新 → 设置按钮和框架更新 tab 显示红点，从设置按钮弹出提示气泡
 * - 无更新 → 不做处理
 */
var _fwBadgeChecked = false;
async function checkFwUpdateBadge() {
  if (_fwBadgeChecked) return;
  _fwBadgeChecked = true;
  try {
    var d = await api("/api/framework/versions");
    if (!d || !d.current) return;
    // 同步服务器平台
    if (d.platform) {
      window._serverPlatform = d.platform;
      window._serverIsWindows = /^win/i.test(d.platform);
    }
    var versions = d.versions || [];
    var latest = versions.length > 0 ? versions[0] : "";
    var hasUpdate = latest && cmpVer(latest, d.current) > 0;
    if (!hasUpdate) return;
    // 红点
    document.getElementById("settingsBtn")?.classList.add("show-update");
    document.getElementById("settingsUpdateTab")?.classList.add("show-update");
    // 弹出提示（延迟显示，避免与连接状态面板同时弹出）
    var popupText = document.getElementById("fwUpdatePopupText");
    if (popupText) {
      popupText.textContent = t("fw_popup_msg").replace("{latest}", latest);
    }
    var popup = document.getElementById("fwUpdatePopup");
    if (popup) {
      setTimeout(function () {
        popup.classList.add("expanded");
        setTimeout(function () {
          popup.classList.remove("expanded");
        }, 4000);
      }, 3000);
    }
  } catch (e) { /* 静默失败 */ }
}

async function loadFrameworkVersions() {
  var spinBtn = document.getElementById("fwRefreshBtn");
  if (spinBtn) spinBtn.classList.add("spinning");
  const d = await api(
    "/api/framework/versions?pre=" +
      (document.getElementById("fwPreRelease")?.checked || false),
  );
  if (spinBtn) spinBtn.classList.remove("spinning");
  if (!d) return;

  _fwCurrentVer = d.current;
  _fwVersions = d.versions || [];
  document.getElementById("fwCurrentVer").textContent = d.current;

  // 最新版本 + 状态徽章
  var latest = _fwVersions.length > 0 ? _fwVersions[0] : "-";
  var hasUpdate = latest !== "-" && cmpVer(latest, d.current) > 0;
  var latestEl = document.getElementById("fwLatestVer");
  if (latestEl) {
    latestEl.textContent = latest;
    latestEl.classList.toggle("has-update", hasUpdate);
  }
  var badge = document.getElementById("fwStatusBadge");
  if (badge) {
    badge.classList.toggle("ok", !hasUpdate);
    badge.classList.toggle("update", hasUpdate);
  }
  var badgeText = document.getElementById("fwStatusText");
  if (badgeText) {
    badgeText.textContent = t(
      hasUpdate ? "fw_update_available" : "fw_latest_already",
    );
  }

  // 服务器平台提示（点击安装时弹窗确认，此处不显横幅）
  if (d.platform) {
    window._serverPlatform = d.platform;
    window._serverIsWindows = /^win/i.test(d.platform);
  }
  var isWindows = isServerWindows();
  var winWarn = document.getElementById("fwWinWarn");
  if (winWarn) winWarn.style.display = isWindows ? "" : "none";

  // 更新按钮：所选版本 > 当前版本即可启用
  var updateBtn = document.getElementById("fwUpdateBtn");
  var sel = document.getElementById("fwVersionSelect");
  function refreshBtn() {
    if (!updateBtn || !sel) return;
    var sv = sel.value;
    if (!sv || sv === _fwCurrentVer) {
      updateBtn.disabled = true;
      updateBtn.style.opacity = "0.5";
    } else {
      updateBtn.disabled = false;
      updateBtn.style.opacity = "";
    }
  }
  sel.onchange = function () {
    refreshBtn();
    loadFwReleaseNotes();
  };

  // 填充版本选择器
  var versionRow = document.getElementById("fwVersionRow");
  if (sel && versionRow && _fwVersions.length > 0) {
    versionRow.style.display = "";
    sel.innerHTML = _fwVersions
      .map(function (v) {
        var isCurrent = v === d.current;
        return (
          '<option value="' +
          esc(v) +
          '"' +
          (v === latest ? " selected" : "") +
          ">" +
          esc(v) +
          (isCurrent ? " (" + t("fw_current") + ")" : "") +
          "</option>"
        );
      })
      .join("");
  }

  refreshBtn();
  if (sel && sel.value) loadFwReleaseNotes();
}

var _changelogCache = null;
var _changelogCacheTs = 0;
var CHANGELOG_BASE = "https://raw.githubusercontent.com/ErisPulse/ErisPulse/Develop/v2/CHANGELOG.md";
var CHANGELOG_PROXIES = [
  "https://cdn.gh-proxy.org/",
  "https://ghproxy.com/",
  "https://gh-proxy.com/",
  "",
];

async function fetchChangelog() {
  if (_changelogCache && Date.now() - _changelogCacheTs < 600000) return _changelogCache;
  for (var i = 0; i < CHANGELOG_PROXIES.length; i++) {
    try {
      var url = CHANGELOG_PROXIES[i] + CHANGELOG_BASE;
      var resp = await fetch(url);
      if (resp.ok) {
        _changelogCache = await resp.text();
        _changelogCacheTs = Date.now();
        return _changelogCache;
      }
    } catch (e) {}
  }
  return null;
}

function findChangelogHead(text, version) {
  if (!text) return null;
  // CHANGELOG 用横杠，PyPI 用点号，都要试
  var variants = [version];
  if (version.indexOf(".dev") !== -1) variants.push(version.replace(/\.dev/, "-dev."));
  if (version.indexOf("-dev.") !== -1) variants.push(version.replace(/-dev\./, ".dev"));
  if (version.indexOf("-de.") !== -1) variants.push(version.replace(/-de\./, "-dev."));
  for (var i = 0; i < variants.length; i++) {
    var headRe = new RegExp("## \\[" + escRegex(variants[i]) + "\\][^\\n]*");
    var m = text.match(headRe);
    if (m) return m;
  }
  return null;
}

function parseChangelogSection(text, version) {
  var m = findChangelogHead(text, version);
  if (!m) return null;
  // 正文：标题行之后到下一个版本标题之间
  var start = m.index + m[0].length;
  var rest = text.slice(start);
  var next = rest.search(/## \[/);
  var body = (next === -1 ? rest : rest.slice(0, next)).trim();
  // 日期取自标题行 "## [x] - 2026/08/28"
  var dm = m[0].match(/-\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s*$/);
  return { date: dm ? dm[1] : "", body: body };
}

// 正式版自身通常不含"### 分类"小节，其变更明细散落在对应的 dev 段落中；
// 聚合该版本与上一个正式版之间的同版本 dev 分组（如 2.7.1 ← 2.7.1-dev.x）。
function aggregateDevGroups(text, version) {
  if (!text || /dev/i.test(version)) return null;
  var m = findChangelogHead(text, version);
  if (!m) return null;
  var rest = text.slice(m.index + m[0].length);
  var devs = 0;
  var merged = [];
  function mergeGroups(groups) {
    groups.forEach(function (g) {
      if (!g.lines.join("\n").trim()) return;
      var found = null;
      for (var i = 0; i < merged.length; i++) {
        if (merged[i].name === g.name) { found = merged[i]; break; }
      }
      if (found) found.lines = found.lines.concat(g.lines);
      else merged.push({ name: g.name, lines: g.lines.slice() });
    });
  }
  while (true) {
    var hm = rest.match(/^## \[([^\]]+)\][^\n]*/m);
    if (!hm) break;
    var vname = hm[1].trim();
    // 仅聚合属于该版本的开发段落，遇到其它版本（含上一个正式版）即停止
    if (
      vname.indexOf(version + "-dev") !== 0 &&
      vname.indexOf(version + ".dev") !== 0
    ) {
      break;
    }
    devs++;
    var start = hm.index + hm[0].length;
    var subRest = rest.slice(start);
    var next = subRest.search(/^## \[/m);
    var body = next === -1 ? subRest : subRest.slice(0, next);
    var sub = parseReleaseStructure(body);
    if (sub) mergeGroups(sub.groups);
    rest = subRest;
  }
  if (!devs || !merged.length) return null;
  merged.sort(function (a, b) {
    return fwCatOrder(a.name) - fwCatOrder(b.name);
  });
  return { count: devs, groups: merged };
}

function escRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// ── 发行说明结构化解析 ──
// 将 CHANGELOG 的版本段落解析为 { releaseType, summary, upgrade, notice, groups }：
// - "> 正式发布 / > 开发版本" 引导行 → releaseType
// - "**版本摘要**" / "**升级建议**" / "**注意事项**" 引导块 → 对应字段
// - "### 分类" 小节（新增/优化/修复/…）→ groups
var FW_CAT_MAP = [
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

function fwCatMeta(name) {
  for (var i = 0; i < FW_CAT_MAP.length; i++) {
    if (FW_CAT_MAP[i][0].test(name)) {
      return { cls: FW_CAT_MAP[i][1], i18n: FW_CAT_MAP[i][2] };
    }
  }
  return { cls: "neutral", i18n: null };
}

function fwCatOrder(name) {
  for (var i = 0; i < FW_CAT_MAP.length; i++) {
    if (FW_CAT_MAP[i][0].test(name)) return i;
  }
  return FW_CAT_MAP.length;
}

function fwMdHtml(lines) {
  var md = (lines || []).join("\n").trim();
  if (!md) return "";
  return typeof marked !== "undefined" ? marked.parse(md) : md.replace(/</g, "&lt;");
}

function fwCountItems(lines) {
  // 官方 CHANGELOG 顶层是贡献者、二级缩进才是变更条目；
  // 旧格式则顶层即变更。优先计二级，无二级时计顶层。
  var top = 0, nested = 0;
  for (var i = 0; i < (lines || []).length; i++) {
    if (/^([-*+]|\d+\.)\s+/.test(lines[i])) top++;
    else if (/^ {1,2}([-*+]|\d+\.)\s+/.test(lines[i])) nested++;
  }
  return nested > 0 ? nested : top;
}

function parseReleaseStructure(md) {
  if (!md) return null;
  var res = {
    releaseType: "",
    summary: [],
    upgrade: [],
    notice: [],
    breaking: [],
    groups: [],
    summaryExplicit: false,
  };
  var bucket = null; // "summary" | "upgrade" | "notice" | 分组对象
  var sawContent = false;
  function push(s) {
    if (typeof bucket === "string") res[bucket].push(s);
    else bucket.lines.push(s);
  }
  var lines = md.split("\n");
  for (var i = 0; i < lines.length; i++) {
    var ln = lines[i].replace(/\s+$/, "");
    if (/^#{1,6}\s+\S/.test(ln)) {
      bucket = { type: "group", name: ln.replace(/^#{1,6}\s+/, "").trim(), lines: [] };
      res.groups.push(bucket);
      continue;
    }
    var mb = ln.match(/^\*\*([^*]+)\*\*\s*$/);
    if (mb) {
      var k = mb[1].trim();
      if (/摘要|summary/i.test(k)) {
        bucket = "summary";
        res.summaryExplicit = true;
        continue;
      }
      if (/升级|upgrade/i.test(k)) { bucket = "upgrade"; continue; }
      if (/注意|notice|caution/i.test(k)) { bucket = "notice"; continue; }
      if (/破坏|breaking|不兼容/i.test(k)) { bucket = "breaking"; continue; }
    }
    if (/^-{3,}\s*$/.test(ln)) continue;
    if (!sawContent && /^>\s?/.test(ln)) {
      var q = ln.replace(/^>\s?/, "").trim();
      if (q && !res.releaseType) { res.releaseType = q; continue; }
    }
    if (!ln.trim()) {
      if (bucket) push("");
      continue;
    }
    sawContent = true;
    if (!bucket) bucket = "summary";
    push(ln);
  }
  return res;
}

function renderFwNotes(v, body, date, agg) {
  var notesEl = document.getElementById("fwReleaseNotes");
  if (!notesEl) return true;
  var s = parseReleaseStructure(body) || {
    releaseType: "",
    summary: [],
    upgrade: [],
    notice: [],
    breaking: [],
    groups: [],
    summaryExplicit: false,
  };
  var hasOwn =
    s.groups.length ||
    s.summaryExplicit ||
    s.upgrade.length ||
    s.notice.length ||
    s.breaking.length;
  // 正式版自身无分组时，合并其对应开发版本的分组
  var useAgg = !!(agg && agg.groups && agg.groups.length) && !s.groups.length;
  if (!hasOwn && !useAgg) {
    return false; // 无结构，交由调用方回退整段渲染
  }
  var h = '<div class="fw-notes-head"><span class="fw-notes-ver">v' + esc(v) + "</span>";
  if (date) h += '<span class="fw-notes-date">' + esc(date) + "</span>";
  if (s.releaseType) {
    var rt = s.releaseType;
    var kind = /正式|stable/i.test(rt)
      ? "stable"
      : /开发|dev/i.test(rt)
        ? "dev"
        : "";
    var label = kind === "stable"
      ? t("fw_release_stable")
      : kind === "dev"
        ? t("fw_release_dev")
        : esc(rt);
    h += '<span class="fw-notes-type' + (kind ? " " + kind : "") + '">' + label + "</span>";
  }
  h += "</div>";
  var summaryHtml = fwMdHtml(s.summary);
  if (summaryHtml) h += '<div class="fw-notes-summary">' + summaryHtml + "</div>";
  if (s.breaking.join("\n").trim()) {
    h +=
      '<div class="fw-notes-callout danger"><div class="fw-callout-label">' +
      esc(t("fw_notes_breaking")) +
      "</div>" +
      fwMdHtml(s.breaking) +
      "</div>";
  }
  if (s.upgrade.join("\n").trim()) {
    h +=
      '<div class="fw-notes-callout"><div class="fw-callout-label">' +
      esc(t("fw_notes_upgrade")) +
      "</div>" +
      fwMdHtml(s.upgrade) +
      "</div>";
  }
  if (s.notice.join("\n").trim()) {
    h +=
      '<div class="fw-notes-callout"><div class="fw-callout-label">' +
      esc(t("fw_notes_notice")) +
      "</div>" +
      fwMdHtml(s.notice) +
      "</div>";
  }
  var groups = s.groups;
  if (useAgg) {
    h +=
      '<div class="fw-notes-agg">' +
      esc(t("fw_notes_from_devs")).replace("{n}", agg.count) +
      "</div>";
    groups = agg.groups;
  }
  if (groups.length) {
    var total = 0;
    groups.forEach(function (g) { total += fwCountItems(g.lines); });
    var expandAll = total > 0 && total <= 6;
    h += '<div class="fw-notes-groups">';
    groups.forEach(function (g) {
      var meta = fwCatMeta(g.name);
      var name = meta.i18n ? t(meta.i18n) : esc(g.name);
      h +=
        '<details class="fw-notes-group fw-cat-' + meta.cls + '"' +
        (expandAll ? " open" : "") +
        '><summary><span class="fw-cat-dot"></span><span>' +
        name +
        '</span><span class="fw-cat-count">' +
        fwCountItems(g.lines) +
        "</span></summary>" +
        '<div class="fw-notes-group-body">' +
        fwMdHtml(g.lines) +
        "</div></details>";
    });
    h += "</div>";
  }
  notesEl.innerHTML = h;
  return true;
}

async function loadFwReleaseNotes() {
  var sel = document.getElementById("fwVersionSelect");
  var notesEl = document.getElementById("fwReleaseNotes");
  if (!sel || !notesEl) return;
  var v = sel.value;
  if (!v) { notesEl.style.display = "none"; return; }
  notesEl.style.display = "";
  notesEl.innerHTML =
    '<div class="fw-notes-loading">' + esc(t("loading")) + "...</div>";

  // 1. 尝试从 CHANGELOG.md 提取并结构化渲染（正式版聚合其 dev 分组）
  var changelog = await fetchChangelog();
  if (changelog) {
    var section = parseChangelogSection(changelog, v);
    if (section) {
      var agg = aggregateDevGroups(changelog, v);
      if (renderFwNotes(v, section.body, section.date, agg)) return;
    }
  }

  // 2. 回退后端
  var d = await api("/api/framework/versions?notes=" + encodeURIComponent(v));
  if (d && d.notes) {
    if (renderFwNotes(v, d.notes, "")) return;
    notesEl.innerHTML =
      '<div class="fw-notes-head"><span class="fw-notes-ver">v' + esc(v) + "</span></div>" +
      '<div class="fw-notes-summary">' +
      (typeof marked !== "undefined" ? marked.parse(d.notes) : d.notes.replace(/</g, "&lt;")) +
      "</div>";
    return;
  }

  // 3. 最后显示链接
  var releaseUrl = "https://github.com/ErisPulse/ErisPulse/releases/tag/v" + v;
  notesEl.innerHTML =
    '<div class="fw-notes-loading">' +
    '<p style="margin:0 0 8px">' + esc(t("release_notes_unavailable")) + "</p>" +
    '<a href="' + esc(releaseUrl) +
    '" target="_blank" rel="noopener">' +
    esc(releaseUrl) + "</a></div>";
}

async function doFrameworkUpdate() {
  const sel = document.getElementById("fwVersionSelect");
  const version = sel?.value;
  if (!version) return;

  if (_fwCurrentVer && cmpVer(version, _fwCurrentVer) < 0) {
    const ok = await confirm2(
      t("fw_downgrade_title"),
      t("fw_downgrade_text").replace("{v}", version),
    );
    if (!ok) return;
  }

  // Windows 特别提示（基于服务器平台而非客户端浏览器平台）
  var isWin = isServerWindows();
  if (isWin) {
    var ok = await confirm2(t("fw_win_confirm_title"), t("fw_win_confirm_text"));
    if (!ok) return;
  }

  const btn = document.getElementById("fwUpdateBtn");
  btn.disabled = true;
  btn.innerHTML = "<span>" + t("installing") + "</span>";

  const d = await api("/api/framework/update", {
    method: "POST",
    body: JSON.stringify({ version, lang }),
  });

  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, "ErisPulse==" + version);
    if (isWin) {
      toast(t("fw_win_update_started"), "ok");
    } else {
      toast(t("installing"), "");
    }
  } else {
    toast(t("install_failed"), "er");
    btn.disabled = false;
    btn.innerHTML =
      '<span data-i18n="fw_install_update">' +
      t("fw_install_update") +
      "</span>";
  }
}

function toggleKvGroup(hd) {
  const g = hd.parentElement;
  const body = g.querySelector(".kv-group-body");
  if (g.classList.contains("collapsed")) {
    if (!body.innerHTML) {
      const obj = window._kvData;
      function find(d, t) {
        const keys = t.split(".");
        let cur = d;
        for (const k of keys) {
          if (cur == null || typeof cur !== "object") return null;
          cur = cur[k];
        }
        return cur;
      }
      const data = find(obj, g.dataset.pfx);
      if (data && typeof data === "object") {
        body.innerHTML = "";
        _appendKvChunks(
          body,
          kvTreeChunks(
            data,
            g.dataset.mode,
            g.dataset.pfx,
            parseInt(g.dataset.dep),
          ),
        );
      }
    }
    g.classList.remove("collapsed");
  } else {
    g.classList.add("collapsed");
  }
}

async function saveConfig(btn) {
  const inp = btn.previousElementSibling;
  const fk = inp.dataset.key;
  const tp = inp.dataset.type;
  let v = inp.value;
  if (tp === "boolean") v = v === "true";
  else if (tp === "number") v = Number(v);
  else if (tp === "object") {
    try {
      v = JSON.parse(v);
    } catch (e) {
      return;
    }
  }
  const d = await api("/api/config", {
    method: "PUT",
    body: JSON.stringify({ key: fk, value: v }),
  });
  inp.style.border =
    d && d.success ? "2px solid var(--ok-c)" : "2px solid var(--er-c)";
  setTimeout(() => (inp.style.border = ""), 1200);
}
async function saveStorage(btn) {
  const inp = btn.previousElementSibling;
  const k = inp.dataset.key;
  let v = inp.value;
  try {
    v = JSON.parse(v);
  } catch (e) {}
  const d = await api("/api/storage", {
    method: "POST",
    body: JSON.stringify({ key: k, value: v }),
  });
  inp.style.border =
    d && d.success ? "2px solid var(--ok-c)" : "2px solid var(--er-c)";
  setTimeout(() => (inp.style.border = ""), 1200);
}
async function delStorage(k, btn) {
  const row = btn.closest(".kv-row");
  const inp = row ? row.querySelector("input,textarea") : null;
  let oldVal = inp ? inp.value : "";
  if (/^[[{]/.test(oldVal)) {
    try {
      oldVal = JSON.parse(oldVal);
    } catch (e) {}
  }
  row.style.opacity = ".3";
  const d = await api("/api/storage/delete", {
    method: "POST",
    body: JSON.stringify({ key: k }),
  });
  if (d && d.success) {
    row.style.transition = "all .2s";
    requestAnimationFrame(() => {
      row.style.maxHeight = "0";
      row.style.padding = "0";
      row.style.overflow = "hidden";
      row.style.borderWidth = "0";
      setTimeout(() => row.remove(), 200);
    });
    toastUndo(t("storage_deleted") + ": " + k, function () {
      api("/api/storage", {
        method: "POST",
        body: JSON.stringify({ key: k, value: oldVal }),
      }).then(function () {
        toast(t("storage_restored"), "ok");
        loadConfig();
      });
    });
  } else row.style.opacity = "1";
}

let _eventStreamLive = true;
let _wsEventBuffer = [];
let _wsFlushTimer = null;
function _flushEventStream() {
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
    el.insertAdjacentHTML("afterbegin", evHtml(ev));
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
function toggleEventLive() {
  _eventStreamLive = !_eventStreamLive;
  const btn = document.getElementById("eventLiveBtn");
  if (btn) {
    btn.style.opacity = _eventStreamLive ? "" : "0.5";
    btn.title = _eventStreamLive
      ? t("live_events")
      : t("live_events") + " (" + t("module_disabled") + ")";
  }
}

function wsConnect() {
  if (ws) {
    ws.onclose = null;
    ws.onerror = null;
    try {
      ws.close();
    } catch (e) {}
    ws = null;
  }
  var u;
  if (currentNode === "local") {
    const p = location.protocol === "https:" ? "wss:" : "ws:";
    u =
      p +
      "//" +
      location.host +
      API +
      "/ws?token=" +
      encodeURIComponent(localStorage.getItem(TK) || "");
  } else {
    var info = nodeRuntimeInfo[currentNode] || {};
    var nodeUrl = info.url || "";
    if (!nodeUrl) {
      connStateChange(0, false);
      return;
    }
    var wsProto = nodeUrl.startsWith("https") ? "wss:" : "ws:";
    var wsHost = nodeUrl.replace(/^https?:\/\//, "");
    u =
      wsProto +
      "//" +
      wsHost +
      "/Dashboard/ws?token=" +
      encodeURIComponent(info.token || "");
  }
  ws = new WebSocket(u);
  ws.onopen = () => {
    connStateChange(1, true);
  };
  ws.onclose = () => {
    connStateChange(0, true);
    setTimeout(wsConnect, 3000);
  };
  ws.onerror = () => ws.close();
  ws.onmessage = (e) => {
    try {
      const m = JSON.parse(e.data);
      if (m.type === "event") {
        allEvents.push(m.data);
        _totalEventCount++;
        if (allEvents.length > 500) allEvents.shift();
        const sv = document.getElementById("statGrid");
        const statCards = sv?.querySelectorAll(".stat-val");
        if (statCards && statCards[3])
          statCards[3].textContent = _totalEventCount;
        if (document.querySelector(".page.active")?.id === "p-dashboard") {
          const dh = document.getElementById("dashEvents");
          const em = dh?.querySelector(".empty-state");
          if (em) em.remove();
          dh?.insertAdjacentHTML("afterbegin", evHtml(m.data));
          while (dh && dh.children.length > 20) dh.removeChild(dh.lastChild);
        }
        if (
          document.querySelector(".page.active")?.id === "p-event-stream" &&
          _eventStreamLive
        ) {
          _wsEventBuffer.push(m.data);
          if (!_wsFlushTimer) {
            _wsFlushTimer = setTimeout(() => {
              _wsFlushTimer = null;
              _flushEventStream();
            }, 500);
          }
        }
      } else if (m.type === "install_progress") {
        const pkg =
          _installTaskIds.get(m.task_id) ||
          (m.packages ? m.packages.join(", ") : "");
        if (m.status === "running") {
          addOrUpdateTask(m.task_id, pkg, "running", m.output || []);
        } else if (m.status === "success") {
          _installTaskIds.delete(m.task_id);
          addOrUpdateTask(m.task_id, pkg, "success", m.output || []);
          loadModules();
          loadPackages(true);
          loadStore(true);
        } else if (m.status === "error") {
          _installTaskIds.delete(m.task_id);
          addOrUpdateTask(
            m.task_id,
            pkg,
            "error",
            m.output || [],
            m.message || t("install_failed"),
          );
        }
      } else if (m.type === "module_changed") {
        if (m.data && m.data.action === "installed") {
          toast(m.data.name + ": " + t("module_loaded_dynamic"), "ok");
        }
        if (m.data && m.data.action === "upgraded") {
          toast(t("pkg_upgrade_success"), "ok");
          loadPackages(true);
        }
        loadModules();
      } else if (m.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      } else if (m.type === "views_changed") {
        if (m.data && m.data.action === "unregister" && m.data.id) {
          _removeModuleView(m.data.id);
        } else {
          loadModuleViews();
        }
      } else if (m.type === "appearance_changed") {
        loadGlobalAppearance();
      } else if (m.type === "log_entry") {
        _onWebSocketLog(m.data);
      }
    } catch (err) {}
  };
}

function loadAll() {
  initMirrorSelects();
  loadGlobalAppearance();
  initHeaderStatusIcon();
  applySettingDensity(getDensity());
  initCustomCss();
  _applyEditorOptions();
  fetchAdapterLogos();
  document.body.classList.toggle("privacy-on", getPrivacyMode());
  refreshDashboard();
  checkFwUpdateBadge();
  loadEvents();
  loadBots();
  loadModules();
  loadConfig();
  loadStore();
  loadMessageStats();
  loadAuditLog();
  loadPerformance();
  loadPackages();
  loadPackageUpdates();
  loadModuleViews();
  loadMaster();
  restartRefreshTimer();
}

// ========== 模块配置页面 ==========

var _moduleConfigNames = [];
var _moduleConfigCurrent = "";

async function loadModuleConfigPage() {
  const d = await api("/api/modules");
  if (!d) return;

  // 只保留有配置 schema 的模块
  _moduleConfigNames = (d.modules || []).filter(function (m) {
    return m.type === "module" && m.has_config;
  });

  const panel = document.getElementById("moduleConfigPanel");
  const empty = document.getElementById("moduleConfigEmpty");

  if (_moduleConfigNames.length === 0) {
    if (empty) empty.style.display = "flex";
    let container = document.getElementById("moduleConfigContent");
    if (container) container.remove();
    return;
  }

  if (empty) empty.style.display = "none";

  // 构建选择器（与适配器配置一致的芯片式布局）
  var selectorHtml = [
    '<div class="adapter-selector-bar">',
    '<div class="adapter-chip-list" id="moduleChipList">',
  ];
  _moduleConfigNames.forEach(function (m) {
    var isActive = m.name === _moduleConfigCurrent;
    var cls = isActive ? " adapter-chip active" : " adapter-chip";
    var dotColor = m.loaded ? "var(--ok-c)" : m.enabled ? "var(--wr-c)" : "var(--tx-t)";
    var iconSvg =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;flex-shrink:0"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';
    selectorHtml.push(
      '<div class="' +
        cls +
        '" data-module="' +
        esc(m.name) +
        '" onclick="selectModuleConfig(\'' +
        esc(m.name) +
        '\')">',
      iconSvg,
      '<span class="adapter-chip-name">' + esc(m.name) + "</span>",
      '<span class="adapter-chip-dot" style="background:' +
        dotColor +
        '"></span>',
      "</div>",
    );
  });
  selectorHtml.push("</div></div>");

  // 保留内容区
  var existingContent = document.getElementById("moduleConfigContent");
  panel.innerHTML = selectorHtml.join("");
  if (existingContent) {
    panel.appendChild(existingContent);
  } else {
    var c = document.createElement("div");
    c.id = "moduleConfigContent";
    panel.appendChild(c);
  }

  if (
    !_moduleConfigCurrent ||
    !_moduleConfigNames.some(function (m) {
      return m.name === _moduleConfigCurrent;
    })
  ) {
    _moduleConfigCurrent = _moduleConfigNames[0].name;
  }

  // 高亮当前
  var chips = panel.querySelectorAll(".adapter-chip[data-module]");
  chips.forEach(function (el) {
    el.classList.toggle("active", el.dataset.module === _moduleConfigCurrent);
  });

  loadModuleConfigDetail(_moduleConfigCurrent);
}

function selectModuleConfig(name) {
  _moduleConfigCurrent = name;
  var panel = document.getElementById("moduleConfigPanel");
  if (panel) {
    var chips = panel.querySelectorAll(".adapter-chip[data-module]");
    chips.forEach(function (el) {
      el.classList.toggle("active", el.dataset.module === name);
    });
  }
  loadModuleConfigDetail(name);
}

async function loadModuleConfigDetail(moduleName) {
  let container = document.getElementById("moduleConfigContent");
  if (!container) {
    var panel = document.getElementById("moduleConfigPanel");
    if (!panel) return;
    container = document.createElement("div");
    container.id = "moduleConfigContent";
    panel.appendChild(container);
  }
  container.innerHTML =
    '<div style="padding:40px;text-align:center;color:var(--tx-s)">' +
    t("loading") +
    "...</div>";

  const d = await api(
    "/api/module/" + encodeURIComponent(moduleName) + "/config",
  );
  if (!d || d.error) {
    container.innerHTML =
      '<div class="empty-state"><p>' +
      esc(d ? d.error : t("unknown_error")) +
      "</p></div>";
    return;
  }

  var html = '<div class="adapter-config-detail">';

  if (d.has_config && d.schema) {
    html +=
      '<div class="fw-section"><div class="fw-section-title">' +
      esc(moduleName) +
      '</div><div class="fw-section-body">';
    html +=
      '<div id="moduleConfigFields">' +
      renderAdapterSchemaFields(d.schema.fields, d.values || {}, d.config_key, { saveFn: "saveModuleConfigField", saveTitle: t("save_module_config") }) +
      "</div>";
    html +=
      '<div style="margin-top:12px;text-align:right"><button class="btn btn-primary btn-sm" onclick="saveModuleConfigAll(\'' +
      esc(moduleName) +
      '\')">' +
      t("save_module_config") +
      "</button></div>";
    html += "</div></div>";
  } else {
    html +=
      '<div class="empty-state"><p>' +
      t("no_config_schema") +
      "</p></div>";
  }

  html += "</div>";
  container.innerHTML = html;
}

async function saveModuleConfigAll(moduleName) {
  var d = await api(
    "/api/module/" + encodeURIComponent(moduleName) + "/config",
  );
  if (!d || !d.schema) return;

  var values = {};
  var inputs = document.querySelectorAll(
    "#moduleConfigFields [data-ackey]",
  );
  for (var i = 0; i < inputs.length; i++) {
    var el = inputs[i];
    var ackey = el.dataset.ackey;
    var parts = ackey.split(".");
    var keyName = parts[parts.length - 1];
    var tp = el.dataset.adapterTp || "string";
    var val = el.type === "checkbox" ? el.checked : el.value;
    if (tp === "number" || tp === "integer" || tp === "float")
      val = Number(val);
    else if (tp === "object") {
      try {
        val = JSON.parse(val);
      } catch (e) {
        continue;
      }
    }
    values[keyName] = val;
  }

  var result = await api(
    "/api/module/" + encodeURIComponent(moduleName) + "/config",
    {
      method: "PUT",
      body: JSON.stringify({ values: values }),
    },
  );

  if (result && result.success) {
    toast(t("module_config_saved"), "ok");
  } else {
    toast(
      t("save_failed") + ": " + (result?.error || t("unknown_error")),
      "er",
    );
    if (result?.errors) toast(result.errors.join(", "), "er");
  }
}

// ========== 事件构建器相关 ==========

let builderState = {
  eventType: "message",
  detailType: "",
  platform: "",
  botId: "",
  customPlatform: false,
  customBot: false,
  messageSegments: [],
  optionalFields: [],
};

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
};

async function initEventBuilder() {
  // 加载平台列表
  await loadPlatforms();
  // 设置默认详情类型
  updateDetailTypeOptions();
  // 初始化预览
  updateEventPreview();
  // 加载消息段类型
  await loadMessageSegmentTypes();
}

async function loadPlatforms() {
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

async function loadBotsForPlatform(platform) {
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

function selectEventType(type) {
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

function updateDetailTypeOptions() {
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

function onDetailTypeChange() {
  builderState.detailType = document.getElementById("detailType").value;
  updateEventPreview();
}

function onPlatformChange() {
  const select = document.getElementById("platformSelect");
  builderState.platform = select.value;
  builderState.customPlatform = false;
  loadBotsForPlatform(builderState.platform);
  updateEventPreview();
}

function onBotChange() {
  const select = document.getElementById("botSelect");
  builderState.botId = select.value;
  builderState.customBot = false;
  updateEventPreview();
}

function toggleCustomPlatform() {
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

function toggleCustomBot() {
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

function updateRequiredFields() {
  // 清空附加字段区域（user_id 和 alt_message 现在自动处理）
  const container = document.getElementById("optionalFields");
  container.innerHTML = "";
}

function addOptionalField(key = "", value = "", label = "") {
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

function updateOptionalFieldKey(div) {
  // 更新 data-key 以便 buildEventData 正确读取
  var keyInput = div.querySelector("input:first-child");
  if (keyInput) div.dataset.key = keyInput.value;
  updateEventPreview();
}

function updateOptionalFieldValue(input) {
  updateEventPreview();
}

function removeOptionalField(btn) {
  btn.closest(".optional-field").remove();
  updateEventPreview();
}

async function loadMessageSegmentTypes() {
  const d = await api("/api/builder/segments");
  if (!d) return;

  window.messageSegmentTypes = d;
}

function addMessageSegment() {
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

function changeSegmentType(select) {
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

function updateMessageSegment(input) {
  const segmentDiv = input.closest(".message-segment");
  const index = Array.from(segmentDiv.parentElement.children).indexOf(
    segmentDiv,
  );
  const fieldName = input.dataset.field;
  const value = input.value;

  builderState.messageSegments[index].fields[fieldName] = value;
  updateEventPreview();
}

function removeMessageSegment(btn) {
  const segmentDiv = btn.closest(".message-segment");
  const index = Array.from(segmentDiv.parentElement.children).indexOf(
    segmentDiv,
  );

  segmentDiv.remove();
  builderState.messageSegments.splice(index, 1);
  updateEventPreview();
}

function buildEventData() {
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

function updateEventPreview() {
  const event = buildEventData();
  const preview = document.getElementById("eventJsonPreview");
  if (preview) {
    preview.textContent = JSON.stringify(event, null, 2);
  }
}

function copyEventJson() {
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

async function previewEvent() {
  const event = buildEventData();

  showOutputModal(
    t("event_preview"),
    [JSON.stringify(event, null, 2)],
    [{ label: t("ok"), value: true, primary: true }],
  );
}

async function submitEvent() {
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

// 添加实时预览的监听器
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
});

// 涟漪效果初始化
function initRippleEffects() {
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".btn");
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    btn.style.setProperty("--ripple-x", x + "%");
    btn.style.setProperty("--ripple-y", y + "%");
    btn.classList.remove("ripple");
    void btn.offsetWidth; // 强制重绘
    btn.classList.add("ripple");

    setTimeout(() => btn.classList.remove("ripple"), 600);
  });
}

// 贡献者头像延迟动画
function animateContributors() {
  const items = document.querySelectorAll(".about-contrib-item");
  items.forEach((item, i) => {
    item.style.animationDelay = i * 0.05 + "s";
  });
}

// ========== 日志功能 ==========

let _logAutoRefreshTimer = null;
let _logPaused = false;
let _logSortNewestBottom = true;
let _availableModules = new Set();
let _logStreamBuffer = [];
let _logStreamActive = false;
let _logStreamFlushTimer = null;

let _logDebounceTimer;
function debounceLogs() {
  clearTimeout(_logDebounceTimer);
  _logDebounceTimer = setTimeout(loadLogs, 300);
}

function toggleLogAutoRefresh() {
  if (_logStreamActive || _logAutoRefreshTimer) {
    // Turn off
    _logStreamActive = false;
    if (_logAutoRefreshTimer) {
      clearInterval(_logAutoRefreshTimer);
      _logAutoRefreshTimer = null;
    }
    var btn = document.getElementById("logAutoRefreshBtn");
    if (btn) btn.style.opacity = "0.5";
    toast(t("auto_refresh_off"), "");
  } else {
    // Turn on - prefer WebSocket streaming, fall back to polling
    _logStreamActive = true;
    // Also do an initial load to get history
    loadLogs();
    var btn = document.getElementById("logAutoRefreshBtn");
    if (btn) btn.style.opacity = "1";
    toast(t("auto_refresh_on"), "ok");
  }
}

function _onWebSocketLog(logData) {
  if (!_logStreamActive) return;
  _logStreamBuffer.push(logData);
  if (!_logStreamFlushTimer) {
    _logStreamFlushTimer = setTimeout(_flushLogStream, 300);
  }
}

function _flushLogStream() {
  _logStreamFlushTimer = null;
  if (_logStreamBuffer.length === 0) return;
  var newLogs = _logStreamBuffer;
  _logStreamBuffer = [];

  // Collect new modules
  newLogs.forEach(function (log) {
    if (log.module && !_availableModules.has(log.module)) {
      _availableModules.add(log.module);
    }
  });
  if (newLogs.some(function (l) { return l.module; })) {
    updateModuleSelect();
  }

  // Apply current filters
  var moduleFilter = document.getElementById("logModuleFilter")?.value || "";
  var levelSet = _getSelectedLevelsSet();
  var search = document.getElementById("logSearch")?.value?.toLowerCase() || "";

  var filtered = newLogs.filter(function (log) {
    if (moduleFilter && log.module && log.module.toLowerCase().indexOf(moduleFilter.toLowerCase()) === -1) return false;
    if (levelSet.size > 0 && !levelSet.has((log.level || "").toUpperCase())) return false;
    if (search && log.message && log.message.toLowerCase().indexOf(search) === -1) return false;
    return true;
  });

  // Prepend to existing log list
  var logList = document.getElementById("logList");
  if (!logList) return;

  var wasNearBottom = logList.scrollHeight - logList.scrollTop - logList.clientHeight < 50;
  var insertHTML = filtered.map(_renderLogEntry).join("");

  if (_logSortNewestBottom) {
    logList.insertAdjacentHTML("beforeend", insertHTML);
  } else {
    logList.insertAdjacentHTML("afterbegin", insertHTML);
  }

  // Trim excess entries (keep max 500)
  while (logList.children.length > 500) {
    if (_logSortNewestBottom) logList.removeChild(logList.firstChild);
    else logList.removeChild(logList.lastChild);
  }

  // Update count
  var countEl = document.getElementById("logCount");
  if (countEl) countEl.textContent = parseInt(countEl.textContent || "0") + filtered.length;

  // Auto-scroll
  if (!_logPaused && (_logStreamActive || wasNearBottom)) {
    logList.scrollTop = _logSortNewestBottom ? logList.scrollHeight : 0;
  }
}

function _getSelectedLevels() {
  var container = document.getElementById("logLevelFilter");
  if (!container) return [];
  var checked = container.querySelectorAll('input[type="checkbox"]:checked');
  return Array.prototype.map.call(checked, function (cb) { return cb.value; });
}

function _getSelectedLevelsSet() {
  return new Set(_getSelectedLevels());
}

function _logLevelToNum(level) {
  var map = { TRACE: 5, DEBUG: 10, INFO: 20, EVENT: 21, WARNING: 30, ERROR: 40, CRITICAL: 50 };
  return map[(level || "").toUpperCase()] ?? null;
}

function _renderLogEntry(log) {
  var moduleEsc = esc(log.module || "");
  var moduleTooltip = (log.module && log.module.length > 15) ? 'title="' + esc(log.module) + '"' : "";
  var lvl = (log.level || "").toLowerCase();
  var lvlClass = lvl ? " log-level-" + lvl : "";
  var lvlBadge = lvl
    ? '<span class="log-level-badge ' + lvl + '">' + esc(log.level) + "</span>"
    : "";
  // Short timestamp: HH:MM:SS, full on hover
  var ts = log.timestamp || "";
  var shortTs = ts;
  var m = ts.match(/(\d{2}:\d{2}:\d{2})/);
  if (m) shortTs = m[1];
  return '<div class="log-entry' + lvlClass + '" onclick="this.classList.toggle(\'log-expanded\')">' +
    '<span class="log-time" title="' + esc(ts) + '">' + esc(shortTs) + "</span>" +
    '<span class="log-module" ' + moduleTooltip + ">" + lvlBadge + moduleEsc + "</span>" +
    '<span class="log-message">' + esc(log.message) + "</span>" +
    "</div>";
}

function toggleLogPause() {
  _logPaused = !_logPaused;
  var btn = document.getElementById("logPauseBtn");
  if (btn) {
    btn.classList.toggle("paused", _logPaused);
    btn.title = _logPaused ? t("resume_scroll") : t("pause_scroll");
  }
}

function toggleLogSortOrder() {
  _logSortNewestBottom = !_logSortNewestBottom;
  var btn = document.getElementById("logSortBtn");
  if (btn) {
    btn.classList.toggle("active", _logSortNewestBottom);
    btn.title = _logSortNewestBottom
      ? t("sort_newest_bottom")
      : t("sort_newest_top");
  }
  loadLogs();
}

let _logLastModuleScan = 0;

async function _discoverLogModules() {
  var now = Date.now();
  if (now - _logLastModuleScan < 30000) return;
  _logLastModuleScan = now;
  const d = await api("/api/logs?limit=500");
  if (!d || !d.logs) return;
  var newModules = false;
  d.logs.forEach((log) => {
    if (log.module && !_availableModules.has(log.module)) {
      _availableModules.add(log.module);
      newModules = true;
    }
  });
  if (newModules) updateModuleSelect();
}

async function loadLogs() {
  const moduleFilter = document.getElementById("logModuleFilter")?.value || "";
  const selectedLevels = _getSelectedLevels();
  const search = document.getElementById("logSearch")?.value || "";

  // 定期做一次全量扫描以发现新模块（不阻塞当前渲染）
  _discoverLogModules();

  const params = new URLSearchParams();
  if (moduleFilter) params.set("module", moduleFilter);
  if (selectedLevels.length) params.set("levels", selectedLevels.join(","));
  if (search) params.set("search", search);
  params.set("limit", "200");

  const d = await api("/api/logs?" + params);
  if (!d) return;

  const logs = d.logs || [];

  // 同时从当前筛选结果中收集新模块
  var newModules = false;
  logs.forEach((log) => {
    if (log.module && !_availableModules.has(log.module)) {
      _availableModules.add(log.module);
      newModules = true;
    }
  });
  if (newModules) updateModuleSelect();

  document.getElementById("logCount").textContent = d.total || 0;

  if (logs.length === 0) {
    document.getElementById("logList").innerHTML =
      '<div class="empty-state"><p>' + t("no_logs") + "</p></div>";
    return;
  }

  const sortedLogs = _logSortNewestBottom ? logs.slice().reverse() : logs;
  const logHtml = sortedLogs.map(_renderLogEntry).join("");

  const logList = document.getElementById("logList");
  const wasNearBottom =
    logList.scrollHeight - logList.scrollTop - logList.clientHeight < 50;

  logList.innerHTML = logHtml;

  if (!_logPaused && (_logAutoRefreshTimer || wasNearBottom)) {
    logList.scrollTop = _logSortNewestBottom ? logList.scrollHeight : 0;
  }
}

function updateModuleSelect() {
  const select = document.getElementById("logModuleFilter");
  if (!select) return;

  const currentValue = select.value;

  // 清空并重新填充
  select.innerHTML = '<option value="">' + t("all_modules") + "</option>";

  const sortedModules = Array.from(_availableModules).sort();
  sortedModules.forEach((module) => {
    const opt = document.createElement("option");
    opt.value = module;
    opt.textContent = module;
    select.appendChild(opt);
  });

  // 恢复之前的选择
  if (currentValue && _availableModules.has(currentValue)) {
    select.value = currentValue;
  }
}

function _copyToClipboard(text) {
  return new Promise((resolve, reject) => {
    if (
      navigator.clipboard &&
      navigator.clipboard.writeText &&
      window.isSecureContext
    ) {
      navigator.clipboard.writeText(text).then(resolve, reject);
      return;
    }
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error("execCommand failed"));
    } catch (e) {
      document.body.removeChild(ta);
      reject(e);
    }
  });
}

async function _fetchFilteredLogs() {
  const moduleFilter = document.getElementById("logModuleFilter")?.value || "";
  const selectedLevels = _getSelectedLevels();
  const search = document.getElementById("logSearch")?.value || "";

  const params = new URLSearchParams();
  if (moduleFilter) params.set("module", moduleFilter);
  if (selectedLevels.length) params.set("levels", selectedLevels.join(","));
  if (search) params.set("search", search);
  params.set("limit", "10000");

  const d = await api("/api/logs?" + params);
  if (!d || !d.logs) return [];
  return d.logs.slice().reverse();
}

function _formatLogText(logs) {
  return logs
    .map(function (log) {
      var ts = log.timestamp || "";
      var lvl = (log.level || "").toUpperCase();
      var mod = log.module || "";
      var msg = log.message || "";
      return "[" + ts + "] [" + lvl + "] [" + mod + "] " + msg;
    })
    .join("\n");
}

function copyLogs() {
  _fetchFilteredLogs().then(function (logs) {
    if (!logs.length) {
      toast(t("no_logs"), "er");
      return;
    }
    _copyToClipboard(_formatLogText(logs))
      .then(() => {
        toast(t("copied_to_clipboard"), "ok");
      })
      .catch(() => {
        toast(t("copy_failed"), "er");
      });
  });
}

function downloadLogs() {
  _fetchFilteredLogs().then(function (logs) {
    if (!logs.length) {
      toast(t("no_logs"), "er");
      return;
    }

    const text = _formatLogText(logs);
    const now = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const stamp =
      now.getFullYear() +
      "-" +
      p(now.getMonth() + 1) +
      "-" +
      p(now.getDate()) +
      "_" +
      p(now.getHours()) +
      p(now.getMinutes()) +
      p(now.getSeconds());

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "erispulse_logs_" + stamp + ".log";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

// ========== 生命周期功能 ==========

async function loadLifecycle() {
  const d = await api("/api/lifecycle");
  if (!d) return;

  const events = d.events || [];
  const filter = document.getElementById("lifecycleFilter")?.value || "";

  const filtered = filter
    ? events.filter((e) => e.event.startsWith(filter + "."))
    : events;

  if (filtered.length === 0) {
    document.getElementById("lifecycleTimeline").innerHTML =
      '<div class="empty-state"><p>' + esc(t("no_lifecycle")) + "</p></div>";
    return;
  }

  const timelineHtml = filtered
    .map((event, idx) => {
      const eventParts = event.event.split(".");
      const eventType = eventParts[0] || "";
      const eventName = eventParts.slice(1).join(".");

      const time = new Date(event.timestamp * 1000).toLocaleTimeString();

      const hasData = event.data && Object.keys(event.data).length > 0;
      const dataJson = hasData ? JSON.stringify(event.data, null, 2) : "";

      return `<div class="lifecycle-item${hasData ? " has-data" : ""}" ${hasData ? `onclick="this.classList.toggle('expanded')"` : ""}>
            <span class="lifecycle-badge ${esc(eventType)}">${esc(eventType)}</span>
            <span class="lifecycle-event">${esc(eventName)}</span>
            <span class="lifecycle-time">${time}</span>
            ${hasData ? '<span class="lifecycle-expand-hint">▸</span>' : ""}
            ${hasData ? `<div class="lifecycle-data"><pre>${esc(dataJson)}</pre></div>` : ""}
        </div>`;
    })
    .join("");

  document.getElementById("lifecycleTimeline").innerHTML = timelineHtml;
}

async function clearLifecycle() {
  const ok = await confirm2(t("clear_events"), t("clear_confirm"));
  if (!ok) return;
  await api("/api/lifecycle/clear", { method: "POST" });
  loadLifecycle();
}

// ========== 关于页面 ==========

async function loadAbout() {
  loadAboutContributors();
}

async function loadAboutContributors() {
  const container = document.getElementById("aboutContributors");
  if (!container) return;

  try {
    const resp = await fetch(
      "https://api.github.com/repos/ErisPulse/ErisPulse/contributors?per_page=100",
    );
    if (!resp.ok) throw new Error("Failed to fetch");
    const contributors = await resp.json();

    if (!Array.isArray(contributors) || contributors.length === 0) {
      container.innerHTML = '<span class="about-contrib-empty">-</span>';
      return;
    }

    container.innerHTML = contributors
      .map(
        (c) => `
            <a href="${esc(c.html_url)}" target="_blank" rel="noopener" class="about-contrib-item" title="${esc(c.login)}">
                <img src="${esc(c.avatar_url)}" alt="${esc(c.login)}" loading="lazy" width="36" height="36">
                <span class="about-contrib-name">${esc(c.login)}</span>
            </a>
        `,
      )
      .join("");
    animateContributors();
  } catch {
    container.innerHTML =
      '<span class="about-contrib-empty" data-i18n="about_contrib_failed"></span>';
  }
}

// ========== 性能监控功能 ==========

async function loadPerformance() {
  const d = await api("/api/performance");
  if (!d) return;

  const system = d.system || {};
  const process = system.process || {};
  const memory = system.memory || {};

  const fmt = (v, unit = "") => {
    if (v === null || v === undefined) return "--" + unit;
    if (typeof v === "string") v = parseFloat(v) || 0;
    return v.toFixed(1) + unit;
  };

  var _updateCircle = function (circleId, textId, pct) {
    var circleEl = document.getElementById(circleId);
    if (circleEl) {
      circleEl.setAttribute("stroke-dashoffset", 100 - Math.min(pct, 100));
      circleEl.classList.toggle("high", pct > 60);
      circleEl.classList.toggle("critical", pct > 85);
    }
    var textEl = document.getElementById(textId);
    if (textEl) textEl.textContent = (pct || 0).toFixed(0) + "%";
  };
  var _updateBar = function (barId, pct) {
    var bar = document.getElementById(barId);
    if (bar) {
      bar.style.width = Math.min(pct, 100) + "%";
      bar.classList.toggle("high", pct > 60);
      bar.classList.toggle("critical", pct > 85);
    }
  };

  // CPU 卡片：只显示进程CPU
  var procCpu = memory.cpu_percent || 0;
  var sysCpu = memory.system_cpu_percent || 0;
  _updateCircle("cpuProgressCircle", "cpuProgressText", procCpu);

  // 内存卡片：只显示进程内存
  var rssMb = memory.rss_mb || 0;
  var totalGb = memory.system_total_gb || 0;
  var procMemPct =
    totalGb > 0 ? Math.min((rssMb / (totalGb * 1024)) * 100, 100) : 0;
  var sysPct = memory.system_percent || 0;

  _updateCircle("memProgressCircle", "memProgressText", procMemPct);
  if (document.getElementById("procMemVal"))
    document.getElementById("procMemVal").textContent = fmt(rssMb, " MB");

  // popover详情
  const setEl = (id, v, unit = "") => {
    const el = document.getElementById(id);
    if (el) el.textContent = fmt(v, unit);
  };
  if (document.getElementById("cpuProcPct"))
    document.getElementById("cpuProcPct").textContent = fmt(procCpu, "%");
  if (document.getElementById("cpuSysPct"))
    document.getElementById("cpuSysPct").textContent = fmt(sysCpu, "%");
  setEl("cpuUser", process.cpu_user, " s");
  setEl("cpuSys", process.cpu_system, " s");
  if (document.getElementById("cpuThreads"))
    document.getElementById("cpuThreads").textContent = String(
      process.threads || "--",
    );

  if (document.getElementById("memRss"))
    document.getElementById("memRss").textContent = fmt(rssMb, " MB");
  if (document.getElementById("sysMemPct"))
    document.getElementById("sysMemPct").textContent = fmt(sysPct, "%");
  setEl("vmsMem", memory.vms_mb, " MB");
  setEl("sysTotal", memory.system_total_gb, " GB");
  setEl("sysAvail", memory.system_available_gb, " GB");
  setEl("swapMem", memory.swap_used_mb, " MB");
  setEl("ioRead", process.read_bytes_mb, " MB");
  setEl("ioWrite", process.write_bytes_mb, " MB");

  // 实例信息
  if (document.getElementById("instUptime"))
    document.getElementById("instUptime").textContent =
      system.uptime_human || "--";
  if (document.getElementById("instThreads"))
    document.getElementById("instThreads").textContent = String(
      process.threads || "--",
    );
  if (document.getElementById("instConnections"))
    document.getElementById("instConnections").textContent = String(
      process.connections || "--",
    );
  // 存储以便后续使用
  window._perfData = {
    vms: memory.vms_mb,
    threads: process.threads,
    connections: process.connections,
    listening: process.listening,
    readBytes: process.read_bytes_mb,
    writeBytes: process.write_bytes_mb,
    swapUsed: memory.swap_used_mb,
    swapPercent: memory.swap_percent,
    sysTotal: memory.system_total_gb,
    sysAvail: memory.system_available_gb,
  };
}

// ========== Popover 交互逻辑 ==========
function initPopovers() {
  // 定位popover
  function positionPopover(trigger, popover) {
    const rect = trigger.getBoundingClientRect();
    const gap = 12;

    // 先显示popover获取实际尺寸
    popover.style.visibility = "hidden";
    popover.style.display = "block";
    const popoverHeight = popover.offsetHeight;
    const popoverWidth = popover.offsetWidth;
    popover.style.visibility = "";
    popover.style.display = "";

    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;

    // 优先显示在上方
    let top = rect.top - popoverHeight - gap;
    let left = rect.left + (rect.width - popoverWidth) / 2;

    // 如果上方空间不够，显示在下方
    if (top < gap) {
      top = rect.bottom + gap;
    }

    // 如果下方也不够，选择空间更大的一方
    if (top + popoverHeight > viewportH - gap) {
      const spaceAbove = rect.top - gap;
      const spaceBelow = viewportH - rect.bottom - gap;
      if (spaceAbove > spaceBelow) {
        top = rect.top - popoverHeight - gap;
      } else {
        top = rect.bottom + gap;
      }
    }

    // 确保不超出左右边界
    if (left < gap) {
      left = gap;
    }
    if (left + popoverWidth > viewportW - gap) {
      left = viewportW - popoverWidth - gap;
    }

    popover.style.top = top + "px";
    popover.style.left = left + "px";
  }

  // CPU详情popover
  const cpuSection = document.getElementById("cpuSection");
  const cpuPopover = document.getElementById("cpuDetailPopover");
  const cpuClose = document.getElementById("cpuPopoverClose");

  if (cpuSection && cpuPopover) {
    let cpuPinned = false;

    // 点击显示/隐藏
    cpuSection.addEventListener("click", function (e) {
      if (e.target.closest(".popover-close")) {
        cpuPinned = false;
        cpuPopover.classList.remove("show");
        return;
      }
      // 关闭内存popover
      if (memPopover) memPopover.classList.remove("show");

      cpuPinned = !cpuPinned;
      if (cpuPinned) {
        positionPopover(cpuSection, cpuPopover);
      }
      cpuPopover.classList.toggle("show", cpuPinned);
    });
  }

  // 内存详情popover
  const memSection = document.getElementById("memSection");
  const memPopover = document.getElementById("memDetailPopover");
  const memClose = document.getElementById("memPopoverClose");

  if (memSection && memPopover) {
    let memPinned = false;

    // 点击显示/隐藏
    memSection.addEventListener("click", function (e) {
      if (e.target.closest(".popover-close")) {
        memPinned = false;
        memPopover.classList.remove("show");
        return;
      }
      // 关闭CPUpopover
      if (cpuPopover) cpuPopover.classList.remove("show");

      memPinned = !memPinned;
      if (memPinned) {
        positionPopover(memSection, memPopover);
      }
      memPopover.classList.toggle("show", memPinned);
    });
  }

  // 点击外部关闭所有popover
  document.addEventListener("click", function (e) {
    if (
      !e.target.closest("#cpuSection") &&
      !e.target.closest("#cpuDetailPopover")
    ) {
      if (cpuPopover) cpuPopover.classList.remove("show");
    }
    if (
      !e.target.closest("#memSection") &&
      !e.target.closest("#memDetailPopover")
    ) {
      if (memPopover) memPopover.classList.remove("show");
    }
  });

  // ESC键关闭所有popover
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (cpuPopover) cpuPopover.classList.remove("show");
      if (memPopover) memPopover.classList.remove("show");
    }
  });

  // 窗口大小变化时重新定位
  window.addEventListener("resize", function () {
    if (cpuPopover && cpuPopover.classList.contains("show")) {
      positionPopover(cpuSection, cpuPopover);
    }
    if (memPopover && memPopover.classList.contains("show")) {
      positionPopover(memSection, memPopover);
    }
  });

  // 滚动时关闭popover
  window.addEventListener(
    "scroll",
    function () {
      if (cpuPopover && cpuPopover.classList.contains("show")) {
        cpuPopover.classList.remove("show");
      }
      if (memPopover && memPopover.classList.contains("show")) {
        memPopover.classList.remove("show");
      }
    },
    { passive: true },
  );
}

// 页面加载后初始化popover
document.addEventListener("DOMContentLoaded", initPopovers);

// ========== API 路由功能 ==========

async function loadApiRoutes() {
  const d = await api("/api/routes");
  if (!d) return;

  const httpRoutes = d.http_routes || [];
  const wsRoutes = d.ws_routes || [];

  document.getElementById("httpRouteCount").textContent = httpRoutes.length;
  document.getElementById("wsRouteCount").textContent = wsRoutes.length;

  var groups = {};

  httpRoutes.forEach(function (r) {
    var m = r.module || "System";
    if (!groups[m]) groups[m] = { http: [], ws: [] };
    groups[m].http.push(r);
  });

  wsRoutes.forEach(function (r) {
    var m = r.module || "System";
    if (!groups[m]) groups[m] = { http: [], ws: [] };
    groups[m].ws.push(r);
  });

  var moduleNames = Object.keys(groups).sort(function (a, b) {
    if (a === "System") return 1;
    if (b === "System") return -1;
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });

  var methodColor = {
    GET: "method-get",
    POST: "method-post",
    PUT: "method-put",
    DELETE: "method-delete",
    PATCH: "method-patch",
    OPTIONS: "method-options",
    HEAD: "method-head",
  };

  var html = "";

  moduleNames.forEach(function (mod, idx) {
    var g = groups[mod];
    var totalRoutes = g.http.length + g.ws.length;
    if (totalRoutes === 0) return;
    var basePath = "/" + mod;

    html +=
      '<div class="card route-group-card collapsed" style="margin-bottom:12px">';
    html +=
      '<div class="card-header" style="cursor:pointer;user-select:none" onclick="toggleRouteGroup(this)">';
    html +=
      '<svg class="route-group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;transition:transform .2s">';
    html += '<polyline points="6 9 12 15 18 9"/></svg>';
    html += '<span style="flex:1;font-size:14px">' + esc(mod) + "</span>";
    html +=
      '<span class="chip chip-sc" style="margin:0">' +
      totalRoutes +
      " routes</span>";
    if (g.http.length > 0)
      html +=
        '<span class="chip chip-pr" style="margin:0;margin-left:4px">' +
        g.http.length +
        " HTTP</span>";
    if (g.ws.length > 0)
      html +=
        '<span class="chip chip-sc" style="margin:0;margin-left:4px">' +
        g.ws.length +
        " WS</span>";
    html += "</div>";
    html += '<div class="route-group-body" style="display:none">';

    g.http.forEach(function (r) {
      var mc = methodColor[r.method] || "method-get";
      html += '<div class="route-item">';
      html +=
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
      html += '<span class="method-badge ' + mc + '">' + r.method + "</span>";
      html +=
        '<code style="font-size:13px;font-weight:500;background:var(--bg-s);padding:2px 6px;border-radius:4px">' +
        esc(r.full_path) +
        "</code>";
      html += '<div style="margin-left:auto">';
      html +=
        '<button class="btn btn-secondary btn-xs" onclick="openRouteTest(\'' +
        esc(r.method) +
        "','" +
        esc(r.full_path) +
        "')\">" +
        t("test") +
        "</button>";
      html += "</div></div></div>";
    });

    g.ws.forEach(function (r) {
      var authBadge = r.has_auth
        ? '<span class="chip chip-wr" style="margin:0">' +
          t("requires_auth") +
          "</span>"
        : "";
      html += '<div class="route-item">';
      html +=
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
      html += '<span class="method-badge method-ws">WS</span>';
      html += authBadge;
      html +=
        '<code style="font-size:13px;font-weight:500;background:var(--bg-s);padding:2px 6px;border-radius:4px">' +
        esc(r.full_path) +
        "</code>";
      html += "</div></div>";
    });

    html += "</div></div>";
  });

  var container = document.getElementById("routeModulesContainer");
  container.innerHTML =
    html ||
    '<div style="padding:16px;font-size:13px;color:var(--tx-s);text-align:center">' +
      t("no_data") +
      "</div>";

  var firstCard = container.querySelector(".route-group-card");
  if (firstCard) {
    firstCard.classList.remove("collapsed");
    firstCard.querySelector(".route-group-body").style.display = "block";
    var firstChevron = firstCard.querySelector(".route-group-chevron");
    if (firstChevron) firstChevron.style.transform = "rotate(180deg)";
    var firstHint = firstCard.querySelector(".route-expand-hint");
    if (firstHint) firstHint.style.display = "none";
  }
}

function toggleRouteGroup(hd) {
  var card = hd.parentElement;
  var body = card.querySelector(".route-group-body");
  var chevron = card.querySelector(".route-group-chevron");
  var hint = card.querySelector(".route-expand-hint");
  var collapsed = card.classList.contains("collapsed");

  if (collapsed) {
    body.style.display = "block";
    chevron.style.transform = "rotate(180deg)";
    card.classList.remove("collapsed");
    if (hint) hint.style.display = "none";
  } else {
    body.style.display = "none";
    chevron.style.transform = "rotate(0deg)";
    card.classList.add("collapsed");
    if (hint) hint.style.display = "";
  }
}

function expandAllRouteGroups() {
  var cards = document.querySelectorAll(".route-group-card");
  cards.forEach(function (card) {
    card.classList.remove("collapsed");
    card.querySelector(".route-group-body").style.display = "block";
    card.querySelector(".route-group-chevron").style.transform =
      "rotate(180deg)";
    var hint = card.querySelector(".route-expand-hint");
    if (hint) hint.style.display = "none";
  });
}

function collapseAllRouteGroups() {
  var cards = document.querySelectorAll(".route-group-card");
  cards.forEach(function (card) {
    card.classList.add("collapsed");
    card.querySelector(".route-group-body").style.display = "none";
    card.querySelector(".route-group-chevron").style.transform = "rotate(0deg)";
    var hint = card.querySelector(".route-expand-hint");
    if (hint) hint.style.display = "";
  });
}

// ========== 消息统计功能 ==========

async function loadMessageStats() {
  const d = await api("/api/message-stats");
  if (!d) return;

  // 消息类型分布
  const typeStats = d.by_type || {};
  var ti = 0;
  const typeHtml = Object.entries(typeStats)
    .map(([type, count]) => {
      const total = d.total_events || 1;
      const percent = ((count / total) * 100).toFixed(1);
      return (
        '<div class="stat-bar-chart">' +
        '<span class="stat-bar-label">' +
        esc(type) +
        "</span>" +
        '<div class="stat-bar-track"><div class="stat-bar-fill" style="width:' +
        percent +
        '%"></div></div>' +
        '<span class="stat-bar-value">' +
        count +
        "</span></div>"
      );
    })
    .join("");
  document.getElementById("msgTypeStats").innerHTML =
    typeHtml ||
    '<div style="color:var(--tx-s);font-size:13px">' + t("no_data") + "</div>";

  // 平台分布
  const platformStats = d.by_platform || {};
  const platformHtml = Object.entries(platformStats)
    .map(([platform, count]) => {
      const total = d.total_events || 1;
      const percent = ((count / total) * 100).toFixed(1);
      return (
        '<div class="stat-bar-chart">' +
        '<span class="stat-bar-label">' +
        esc(platform) +
        "</span>" +
        '<div class="stat-bar-track"><div class="stat-bar-fill" style="width:' +
        percent +
        '%"></div></div>' +
        '<span class="stat-bar-value">' +
        count +
        "</span></div>"
      );
    })
    .join("");
  document.getElementById("msgPlatformStats").innerHTML =
    platformHtml ||
    '<div style="color:var(--tx-s);font-size:13px">' + t("no_data") + "</div>";

  // 每小时趋势（最近24小时）
  const hourlyStats = d.hourly || {};
  const now = Date.now() / 1000;
  const bars = [];
  var maxCount = Math.max(...Object.values(hourlyStats), 1);

  for (let i = 23; i >= 0; i--) {
    const hourKey = Math.floor((now - i * 3600) / 3600) * 3600;
    const count = hourlyStats[hourKey] || 0;
    const height = maxCount > 0 ? Math.max((count / maxCount) * 100, 1) : 1;
    bars.push(
      '<div class="hourly-bar-wrap"><div class="hourly-bar" style="height:' +
        height +
        '%"></div></div>',
    );
  }

  // 只显示首尾和中间时间
  const firstHour = new Date((now - 23 * 3600) * 1000).getHours();
  const midHour = new Date((now - 12 * 3600) * 1000).getHours();
  const lastHour = new Date(now * 1000).getHours();

  document.getElementById("msgHourlyTrend").innerHTML =
    '<div class="hourly-chart">' +
    bars.join("") +
    "</div>" +
    '<div class="hourly-labels"><span class="hourly-label">' +
    firstHour +
    ':00</span><span class="hourly-label">' +
    midHour +
    ':00</span><span class="hourly-label">' +
    lastHour +
    ":00</span></div>";
}

// 更新 refreshDashboard 函数以包含性能监控
const _originalRefreshDashboard = refreshDashboard;
refreshDashboard = async function () {
  await _originalRefreshDashboard();
  await loadPerformance();
  await loadMessageStats();
};

// ========== API 路由测试 ==========

let _rtMethod = "",
  _rtFullPath = "";

function openRouteTest(method, fullPath) {
  _rtMethod = method;
  _rtFullPath = fullPath;
  const methodColor =
    {
      GET: "method-get",
      POST: "method-post",
      PUT: "method-put",
      DELETE: "method-delete",
      PATCH: "method-patch",
    }[method] || "method-get";
  const mb = document.getElementById("rtMethod");
  mb.textContent = method;
  mb.className = "method-badge " + methodColor;
  document.getElementById("rtPath").textContent = fullPath;
  document.getElementById("rtBodySection").style.display = [
    "POST",
    "PUT",
    "PATCH",
  ].includes(method)
    ? "block"
    : "none";
  document.getElementById("rtParams").innerHTML = "";
  document.getElementById("rtBody").value = "";
  document.getElementById("rtResponse").textContent = "";
  document.getElementById("rtResponseStatus").style.display = "none";
  document.getElementById("routeTestOverlay").style.display = "flex";
}

function closeRouteTest() {
  document.getElementById("routeTestOverlay").style.display = "none";
}

function addRouteParam(k, v) {
  const c = document.getElementById("rtParams");
  const d = document.createElement("div");
  d.style.cssText = "display:flex;gap:6px;margin-bottom:4px";
  d.innerHTML =
    '<input class="rt-pk" style="flex:1;padding:4px 8px;border:1px solid var(--bd);border-radius:4px;font-size:12px;background:var(--bg-s);color:var(--tx-p)" placeholder="Key" value="' +
    esc(k || "") +
    '">' +
    '<input class="rt-pv" style="flex:2;padding:4px 8px;border:1px solid var(--bd);border-radius:4px;font-size:12px;background:var(--bg-s);color:var(--tx-p)" placeholder="Value" value="' +
    esc(v || "") +
    '">' +
    '<button class="btn-icon" onclick="this.parentElement.remove()" style="flex-shrink:0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
  c.appendChild(d);
}

async function sendRouteTest() {
  const params = [];
  document.querySelectorAll("#rtParams > div").forEach((row) => {
    const k = row.querySelector(".rt-pk").value.trim();
    const v = row.querySelector(".rt-pv").value.trim();
    if (k) params.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
  });
  const qs = params.length ? "?" + params.join("&") : "";
  const url = _rtFullPath + qs;
  const tk = localStorage.getItem(TK);
  const headers = { Authorization: "Bearer " + tk };
  const bodyArea = document.getElementById("rtBody");
  const hasBody =
    ["POST", "PUT", "PATCH"].includes(_rtMethod) && bodyArea.value.trim();
  if (hasBody) headers["Content-Type"] = "application/json";
  document.getElementById("rtResponse").textContent = t("loading");
  document.getElementById("rtResponseStatus").style.display = "none";
  try {
    const opts = { method: _rtMethod, headers };
    if (hasBody) opts.body = bodyArea.value.trim();
    const resp = await fetch(url, opts);
    const statusEl = document.getElementById("rtResponseStatus");
    const isOk = resp.status >= 200 && resp.status < 300;
    statusEl.innerHTML =
      '<span class="chip ' +
      (isOk ? "chip-ok" : "chip-er") +
      '">' +
      resp.status +
      " " +
      esc(resp.statusText) +
      "</span>";
    statusEl.style.display = "block";
    const ct = resp.headers.get("content-type") || "";
    let text;
    if (ct.includes("json")) {
      const json = await resp.json();
      text = JSON.stringify(json, null, 2);
    } else {
      text = await resp.text();
      try {
        text = JSON.stringify(JSON.parse(text), null, 2);
      } catch (e) {}
    }
    document.getElementById("rtResponse").textContent = text;
  } catch (e) {
    document.getElementById("rtResponse").textContent = "Error: " + e.message;
  }
}

// ========== 审计日志功能 ==========

async function loadAuditLog() {
  const actionFilterEl = document.getElementById("auditActionFilter");
  const actionFilter = actionFilterEl?.value || "";
  const params = new URLSearchParams();
  if (actionFilter) params.set("action", actionFilter);
  params.set("limit", "200");
  const d = await api("/api/audit?" + params);
  if (!d) return;
  const logs = d.logs || [];
  if (actionFilterEl) {
    var _acts = {};
    logs.forEach(function (l) {
      _acts[l.action] = 1;
    });
    if (actionFilter) _acts[actionFilter] = 1;
    var _actList = Object.keys(_acts).sort();
    var _opts = '<option value="">' + esc(t("all_actions")) + "</option>";
    _actList.forEach(function (a) {
      var _k = "action_" + a;
      var _lbl = t(_k) !== _k ? t(_k) : a;
      _opts +=
        '<option value="' +
        esc(a) +
        '"' +
        (a === actionFilter ? " selected" : "") +
        ">" +
        esc(_lbl) +
        "</option>";
    });
    actionFilterEl.innerHTML = _opts;
  }
  document.getElementById("auditCount").textContent = d.total || 0;
  if (logs.length === 0) {
    document.getElementById("auditList").innerHTML =
      '<div class="empty-state"><p>' + t("no_data") + "</p></div>";
    return;
  }
  const html = logs
    .slice()
    .reverse()
    .map((log) => {
      const tm = new Date(log.timestamp * 1000).toLocaleString(getLocale());
      const actionKey = "action_" + log.action;
      const actionLabel =
        t(actionKey) !== actionKey ? t(actionKey) : esc(log.action);
      const actionClass =
        {
          restart_framework: "chip-er",
          framework_update: "chip-er",
          file_delete: "chip-er",
          uninstall_module: "chip-er",
          package_uninstall: "chip-er",
          disable_module: "chip-er",
          disable_adapter: "chip-er",
          unload_module: "chip-er",
          unload_adapter: "chip-er",
          cluster_node_delete: "chip-er",
          audit_clear: "chip-er",
          login_failed: "chip-er",
          logs_clear: "chip-er",
          lifecycle_clear: "chip-er",
          clear_events: "chip-wr",
          file_rename: "chip-wr",
          file_write: "chip-wr",
          config_source_save: "chip-wr",
          appearance_update: "chip-wr",
          master_update: "chip-wr",
          command_update: "chip-wr",
          cluster_node_add: "chip-wr",
          cluster_node_update: "chip-wr",
          cluster_node_probe: "chip-wr",
          package_install: "chip-ok",
          package_upgrade: "chip-ok",
          package_git_upgrade: "chip-ok",
          login_success: "chip-ok",
          file_mkdir: "chip-ok",
          enable_module: "chip-ok",
          enable_adapter: "chip-ok",
          load_module: "chip-ok",
          load_adapter: "chip-ok",
          reload_module: "chip-ok",
          reload_adapter: "chip-ok",
          backup_import: "chip-pr",
          backup_export: "chip-pr",
          appearance_upload: "chip-pr",
          file_copy: "chip-pr",
          file_decompress: "chip-pr",
        }[log.action] || "chip-sc";
      return (
        '<div class="list-row" style="font-size:13px;gap:12px">' +
        '<span class="chip ' +
        actionClass +
        '" style="min-width:100px;justify-content:center">' +
        esc(actionLabel) +
        "</span>" +
        '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--tx-s)" title="' +
        esc(log.detail) +
        '">' +
        esc(log.detail || "-") +
        "</span>" +
        '<span style="font-size:11px;color:var(--tx-t);white-space:nowrap">' +
        esc(log.ip || "") +
        "</span>" +
        '<span style="font-size:11px;color:var(--tx-t);white-space:nowrap;min-width:140px;text-align:right">' +
        esc(tm) +
        "</span>" +
        "</div>"
      );
    })
    .join("");
  document.getElementById("auditList").innerHTML = html;
}

async function clearAuditLog() {
  if (!authed) return showLogin();
  const ok = await confirm2(t("clear_events"), t("audit_clear_confirm"));
  if (!ok) return;
  await api("/api/audit/clear", { method: "POST" });
  toast(t("audit_cleared"), "ok");
  loadAuditLog();
}

// ========== 备份与恢复功能 ==========

async function exportBackup() {
  if (!authed) return showLogin();
  const d = await api("/api/backup/export");
  if (!d || d.error) {
    toast(t("backup_failed"), "er");
    return;
  }
  const blob = new Blob([JSON.stringify(d, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  a.download = "erispulse-backup-" + ts + ".json";
  a.click();
  URL.revokeObjectURL(url);
  toast(t("backup_export_success"), "ok");
}

async function importBackup(input) {
  if (!authed) return showLogin();
  const file = input.files && input.files[0];
  if (!file) return;
  const ok = await confirm2(t("backup_import"), t("backup_import_confirm"));
  if (!ok) {
    input.value = "";
    return;
  }
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const result = await api("/api/backup/import", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (result && result.success) {
      toast(
        t("import_success") +
          " (" +
          result.config_restored +
          " config, " +
          result.storage_restored +
          " storage)",
        "ok",
      );
      loadConfig();
    } else {
      toast(t("import_failed") + ": " + (result?.error || ""), "er");
    }
  } catch (e) {
    toast(t("import_failed") + ": " + e.message, "er");
  }
  input.value = "";
}

// ========== 文件管理功能 ==========

let _fmCurrentPath = ".";
let _fmShowHidden = false;
let _fmIsWindows = false;
try {
  _fmIsWindows =
    /win/i.test(navigator.platform || "") ||
    /Windows/.test(navigator.userAgent) ||
    String(navigator.userAgentData && navigator.userAgentData.platform || "").toLowerCase() === "windows";
} catch (e) {
  _fmIsWindows = false;
}
let _fmEditor = null;
let _fmEditPath = "";
let _fmDirty = false;
let _fmContextMenu = null;
let _fmSearchTimer;

function debounceFmSearch() {
  clearTimeout(_fmSearchTimer);
  _fmSearchTimer = setTimeout(() => fmBrowse(_fmCurrentPath), 300);
}

function fmGetMode(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  const modes = {
    js: "javascript",
    json: "javascript",
    mjs: "javascript",
    py: "python",
    pyw: "python",
    html: "htmlmixed",
    htm: "htmlmixed",
    css: "css",
    xml: "xml",
    svg: "xml",
    md: "markdown",
    markdown: "markdown",
    toml: "toml",
    yaml: "yaml",
    yml: "yaml",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    txt: "text",
  };
  return modes[ext] || "text";
}

function fmFormatSize(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + " " + units[i];
}

function fmFormatTime(ts) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleString(getLocale(), {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

var FM_EXT_COLORS = {
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

function fmGetIcon(type, name) {
  if (type === "directory")
    return '<svg class="fm-icon folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>';
  var ext = (name || "").split(".").pop().toLowerCase();
  var color = FM_EXT_COLORS[ext] || FM_EXT_COLORS._;
  return (
    '<svg class="fm-icon file" style="color:' +
    color +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
  );
}

function fmUpdateBreadcrumb(path, count) {
  const bc = document.getElementById("fmBreadcrumb");
  const parts = path === "." ? [] : path.split("/");
  let html =
    '<span class="fm-crumb' +
    (parts.length === 0 ? " active" : "") +
    '" onclick="fmNavigateTo(\'.\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;vertical-align:middle"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg></span>';
  let accumulated = "";
  parts.forEach((part, i) => {
    accumulated += (accumulated ? "/" : "") + part;
    const p = accumulated;
    html +=
      '<span class="fm-crumb-sep">/</span><span class="fm-crumb' +
      (i === parts.length - 1 ? " active" : "") +
      '" onclick="fmNavigateTo(\'' +
      esc(p) +
      "')\">" +
      esc(part) +
      "</span>";
  });
  if (count !== undefined) {
    html += '<span class="fm-crumb-count">(' + count + ")</span>";
  }
  bc.innerHTML = html;
}

function fmNavigateTo(path) {
  _fmCurrentPath = path;
  fmBrowse(path);
}

function fmGoUp() {
  if (_fmCurrentPath === ".") return;
  const parts = _fmCurrentPath.split("/");
  parts.pop();
  fmNavigateTo(parts.length ? parts.join("/") : ".");
}

function fmToggleHidden() {
  _fmShowHidden = !_fmShowHidden;
  const btn = document.getElementById("fmHiddenBtn");
  btn.style.background = _fmShowHidden ? "var(--accent)" : "";
  fmBrowse(_fmCurrentPath);
}

function fmRefresh() {
  fmBrowse(_fmCurrentPath);
}

async function fmBrowse(path) {
  _fmCurrentPath = path;
  const search = document.getElementById("fmSearch")?.value || "";
  const params = new URLSearchParams({
    path,
    hidden: _fmShowHidden ? "true" : "false",
  });
  if (search) params.set("pattern", "*" + search + "*");
  const d = search
    ? await api("/api/files/search?" + params)
    : await api("/api/files/browse?" + params);
  if (!d) return;
  if (d.error) {
    toast(d.error, "er");
    return;
  }

  const entries = d.entries || d.results || [];
  fmUpdateBreadcrumb(d.path || path, entries.length);

  const fileList = document.getElementById("fmFileList");
  if (entries.length === 0) {
    fileList.innerHTML = renderUxEmpty(
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
      "no_data"
    );
    return;
  }

  fileList.innerHTML = entries
    .map((e) => {
      const isDir = e.type === "directory";
      const icon = fmGetIcon(e.type, e.name);
      const size = isDir ? "--" : fmFormatSize(e.size || 0);
      const mtime = fmFormatTime(e.modified);
      const rowActions = !isDir
        ? '<button class="fm-card-action" onclick="event.stopPropagation();fmDownload(\'' +
          esc(e.path) +
          '\')" title="' + esc(t("download")) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>' +
          '<button class="fm-card-action" onclick="event.stopPropagation();fmEditFile(\'' +
          esc(e.path) +
          '\')" title="' + esc(t("edit")) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'
        : "";
      return (
        '<div class="fm-file-card' + (isDir ? " is-dir" : "") + '" ondblclick="' +
        (isDir
          ? "fmNavigateTo('" + esc(e.path) + "')"
          : "fmEditFile('" + esc(e.path) + "')") +
        '" oncontextmenu="fmContextMenu(event,\'' +
        esc(e.path) +
        "','" +
        esc(e.type) +
        "')\">" +
        '<div class="fm-card-icon">' + icon + "</div>" +
        '<div class="fm-card-body">' +
        '<span class="fm-card-name' + (isDir ? " folder-name" : "") + '">' + esc(e.name) + "</span>" +
        '<span class="fm-card-meta">' + size + " · " + esc(mtime) + "</span>" +
        "</div>" +
        '<div class="fm-card-actions">' + rowActions + "</div>" +
        "</div>"
      );
    })
    .join("");
}

function fmContextMenu(event, path, type) {
  event.preventDefault();
  event.stopPropagation();
  if (_fmContextMenu) _fmContextMenu.remove();

  const isDir = type === "directory";
  const menu = document.createElement("div");
  menu.className = "fm-context-menu";
  menu.style.left = event.clientX + "px";
  menu.style.top = event.clientY + "px";

  let items = "";
  if (isDir) {
    items += fmCtxItem(
      t("files"),
      '<polyline points="9 18 15 12 9 6"/>',
      "fmNavigateTo('" + esc(path) + "')",
    );
  } else {
    items += fmCtxItem(
      t("files"),
      '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>',
      "fmEditFile('" + esc(path) + "')",
    );
    items += fmCtxItem(
      t("download"),
      '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
      "fmDownload('" + esc(path) + "')",
    );
  }
  items += '<div class="fm-ctx-sep"></div>';
  if (!_fmIsWindows) {
    items += fmCtxItem(
      t("permissions"),
      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-2.82 1.18V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001-1.51 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 002.82-1.18V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.2.65.77 1.09 1.51 1.08H21a2 2 0 010 4h-.09c-.74 0-1.31.44-1.51 1.08z"/>',
      "fmChmod('" + esc(path) + "')",
    );
  }
  items += fmCtxItem(
    t("rename_label"),
    '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/>',
    "fmRename('" + esc(path) + "')",
  );
  const fname = path.split("/").pop().toLowerCase();
  if (
    fname.endsWith(".zip") ||
    fname.endsWith(".tar.gz") ||
    fname.endsWith(".tgz") ||
    fname.endsWith(".tar.bz2") ||
    fname.endsWith(".tar.xz") ||
    fname.endsWith(".tar")
  ) {
    items += fmCtxItem(
      t("decompress"),
      '<polyline points="17 1 21 5 17 9"/><path d="M3 7V5a2 2 0 012-2h12"/><line x1="9" y1="12" x2="15" y2="12"/>',
      "fmDecompress('" + esc(path) + "')",
    );
  }
  items += '<div class="fm-ctx-sep"></div>';
  items +=
    '<div class="fm-ctx-item danger" onclick="fmDelete(\'' +
    esc(path) +
    '\');this.closest(\'.fm-context-menu\').remove()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg><span>' +
    t("delete") +
    "</span></div>";

  menu.innerHTML = items;
  document.body.appendChild(menu);
  _fmContextMenu = menu;

  const close = () => {
    menu.remove();
    _fmContextMenu = null;
    document.removeEventListener("click", close);
  };
  setTimeout(() => document.addEventListener("click", close), 0);
}

function fmCtxItem(label, svgPath, onclick) {
  return (
    '<div class="fm-ctx-item" onclick="' +
    onclick +
    ';this.closest(\'.fm-context-menu\').remove()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
    svgPath +
    "</svg><span>" +
    label +
    "</span></div>"
  );
}

async function fmEditFile(path) {
  const d = await api("/api/files/read?path=" + encodeURIComponent(path));
  if (!d) return;
  if (d.error) {
    if (d.binary) toast(t("binary_file"), "er");
    else if (d.error === "File too large")
      toast(t("file_too_large") + " (" + fmFormatSize(d.size) + ")", "er");
    else toast(d.error, "er");
    return;
  }
  _fmEditPath = path;
  _fmDirty = false;
  const overlay = document.getElementById("fmEditorOv");
  document.getElementById("fmEditorTitle").textContent = path;
  document.getElementById("fmEditorStatus").textContent = "";

  const container = document.getElementById("fmEditorContainer");
  if (typeof CodeMirror !== "undefined") {
    if (_fmEditor) _fmEditor.toTextArea();
    const textarea = document.createElement("textarea");
    container.innerHTML = "";
    container.appendChild(textarea);
    textarea.value = d.content;
    _fmEditor = CodeMirror.fromTextArea(textarea, {
      mode: fmGetMode(path),
      theme:
        document.documentElement.getAttribute("data-theme") === "dark"
          ? "dracula"
          : "default",
      lineNumbers: true,
      matchBrackets: true,
      autoCloseBrackets: true,
      lineWrapping: true,
      tabSize: 4,
      indentUnit: 4,
    });
    _fmEditor.on("change", () => {
      _fmDirty = true;
      document.getElementById("fmEditorStatus").textContent = "●";
      document.getElementById("fmEditorStatus").style.color = "var(--wr-c)";
    });
    _fmEditor.setSize("100%", "100%");
  } else {
    container.innerHTML =
      '<textarea id="fmFallbackEditor" class="code-editor" style="width:100%;height:100%;box-sizing:border-box" spellcheck="false">' +
      esc(d.content) +
      "</textarea>";
  }
  overlay.classList.add("show");
  setTimeout(() => { if (_fmEditor) _fmEditor.refresh(); }, 100);
}

async function fmSaveFile() {
  if (!_fmEditPath) return;
  let content;
  if (_fmEditor) {
    content = _fmEditor.getValue();
  } else {
    const ta = document.getElementById("fmFallbackEditor");
    content = ta ? ta.value : "";
  }
  const d = await api("/api/files/write", {
    method: "PUT",
    body: JSON.stringify({ path: _fmEditPath, content }),
  });
  if (d && d.success) {
    _fmDirty = false;
    document.getElementById("fmEditorStatus").textContent = t("file_saved");
    document.getElementById("fmEditorStatus").style.color = "var(--ok-c)";
    toast(t("file_saved"), "ok");
  } else {
    toast(d?.error || t("file_save_failed"), "er");
  }
}

function fmCloseEditor() {
  document.getElementById("fmEditorOv").classList.remove("show");
  if (_fmEditor) {
    _fmEditor.toTextArea();
    _fmEditor = null;
  }
  _fmEditPath = "";
  _fmDirty = false;
}

function fmDownload(path) {
  const tk = localStorage.getItem(TK);
  const url =
    API +
    "/api/files/download?path=" +
    encodeURIComponent(path) +
    (tk ? "&token=" + encodeURIComponent(tk) : "");
  window.open(url, "_blank");
}

async function fmNewFile() {
  const name = await showModal(
    t("new_file"),
    '<input type="text" id="fmNewName" class="form-input" data-i18n-placeholder="new_file_name" placeholder="' +
      esc(t("new_file_name")) +
      '" style="width:100%">',
    [
      { label: t("cancel"), value: null },
      { label: t("ok"), value: "ok", primary: true },
    ],
  );
  if (!name) return;
  const input = document.getElementById("fmNewName");
  const fileName = input ? input.value.trim() : "";
  if (!fileName) return;
  const fullPath =
    _fmCurrentPath === "." ? fileName : _fmCurrentPath + "/" + fileName;
  const d = await api("/api/files/write", {
    method: "PUT",
    body: JSON.stringify({ path: fullPath, content: "" }),
  });
  if (d && d.success) {
    toast(t("file_saved"), "ok");
    fmBrowse(_fmCurrentPath);
  } else {
    toast(d?.error || t("file_save_failed"), "er");
  }
}

async function fmNewFolder() {
  const name = await showModal(
    t("new_folder"),
    '<input type="text" id="fmNewName" class="form-input" data-i18n-placeholder="new_folder_name" placeholder="' +
      esc(t("new_folder_name")) +
      '" style="width:100%">',
    [
      { label: t("cancel"), value: null },
      { label: t("ok"), value: "ok", primary: true },
    ],
  );
  if (!name) return;
  const input = document.getElementById("fmNewName");
  const folderName = input ? input.value.trim() : "";
  if (!folderName) return;
  const fullPath =
    _fmCurrentPath === "." ? folderName : _fmCurrentPath + "/" + folderName;
  const d = await api("/api/files/mkdir", {
    method: "POST",
    body: JSON.stringify({ path: fullPath, recursive: true }),
  });
  if (d && d.success) {
    toast(t("action_completed"), "ok");
    fmBrowse(_fmCurrentPath);
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

function fmUpload() {
  document.getElementById("fmUploadInput").click();
}

async function fmDoUpload(input) {
  const files = input.files;
  if (!files || files.length === 0) return;
  const fd = new FormData();
  for (let i = 0; i < files.length; i++) {
    fd.append("files", files[i]);
  }
  const d = await api(
    "/api/files/upload?path=" + encodeURIComponent(_fmCurrentPath),
    {
      method: "POST",
      body: fd,
    },
  );
  if (d && d.success) {
    toast(t("upload_success") + " (" + d.count + ")", "ok");
    fmBrowse(_fmCurrentPath);
  } else {
    toast(d?.error || t("upload_failed"), "er");
  }
  input.value = "";
}

async function fmDelete(path) {
  const ok = await confirm2(t("delete"), t("delete_confirm"));
  if (!ok) return;
  const d = await api("/api/files/delete", {
    method: "POST",
    body: JSON.stringify({ paths: [path] }),
  });
  if (d && d.success) {
    toast(t("delete_success"), "ok");
    fmBrowse(_fmCurrentPath);
  } else {
    toast(d?.error || t("delete_failed"), "er");
  }
}

async function fmRename(path) {
  const oldName = path.split("/").pop();
  const result = await showModal(
    t("rename_label"),
    '<input type="text" id="fmRenameInput" class="form-input" value="' +
      esc(oldName) +
      '" style="width:100%">',
    [
      { label: t("cancel"), value: null },
      { label: t("ok"), value: "ok", primary: true },
    ],
  );
  if (!result) return;
  const input = document.getElementById("fmRenameInput");
  const newName = input ? input.value.trim() : "";
  if (!newName || newName === oldName) return;
  const dir = path.includes("/")
    ? path.substring(0, path.lastIndexOf("/"))
    : ".";
  const newPath = dir === "." ? newName : dir + "/" + newName;
  const d = await api("/api/files/rename", {
    method: "POST",
    body: JSON.stringify({ old_path: path, new_path: newPath }),
  });
  if (d && d.success) {
    toast(t("rename_success"), "ok");
    fmBrowse(_fmCurrentPath);
  } else {
    toast(d?.error || t("rename_failed"), "er");
  }
}

async function fmChmod(path) {
  const result = await showModal(
    t("chmod"),
    '<input type="text" id="fmChmodInput" class="form-input" placeholder="755" style="width:100%">',
    [
      { label: t("cancel"), value: null },
      { label: t("ok"), value: "ok", primary: true },
    ],
  );
  if (!result) return;
  const input = document.getElementById("fmChmodInput");
  const mode = input ? input.value.trim() : "";
  if (!mode || !/^[0-7]{3,4}$/.test(mode)) {
    toast("Invalid mode", "er");
    return;
  }
  const d = await api("/api/files/chmod", {
    method: "POST",
    body: JSON.stringify({ path, mode }),
  });
  if (d && d.success) {
    toast(t("action_completed"), "ok");
    fmBrowse(_fmCurrentPath);
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

document.addEventListener("keydown", function (e) {
  if (e.ctrlKey && e.key === "s" && _fmEditPath) {
    e.preventDefault();
    fmSaveFile();
  }
});

async function fmCompress() {
  if (!authed) return showLogin();
  const allRows = document.querySelectorAll("#fmFileList .fm-file-card");
  if (allRows.length === 0) {
    toast(t("no_data"), "");
    return;
  }
  const archiveName = await showModal(
    t("compress"),
    '<input type="text" id="fmCompressName" class="form-input" value="archive.zip" style="width:100%">',
    [
      { label: t("cancel"), value: null },
      { label: t("ok"), value: "ok", primary: true },
    ],
  );
  if (!archiveName) return;
  const name =
    document.getElementById("fmCompressName")?.value?.trim() || "archive.zip";
  const paths = [];
  allRows.forEach((row) => {
    const nameEl = row.querySelector(".fm-card-name");
    if (nameEl) {
      const n = nameEl.textContent;
      paths.push(_fmCurrentPath === "." ? n : _fmCurrentPath + "/" + n);
    }
  });
  if (paths.length === 0) return;
  const resp = await fetch(API + "/api/files/compress", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + localStorage.getItem(TK),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paths, archive_name: name }),
  });
  if (resp.ok) {
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    toast(t("action_completed"), "ok");
    fmBrowse(_fmCurrentPath);
  } else {
    const err = await resp.json().catch(() => ({}));
    toast(err.error || t("action_failed"), "er");
  }
}

async function fmDecompress(path) {
  if (!authed) return showLogin();
  const d = await api("/api/files/decompress", {
    method: "POST",
    body: JSON.stringify({ path }),
  });
  if (d && d.success) {
    toast(t("action_completed"), "ok");
    fmBrowse(_fmCurrentPath);
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

// ========== 任务列表系统 ==========

let _tasks = [];
let _taskPanelOpen = false;
let _expandedTasks = new Set();

function addOrUpdateTask(id, name, status, outputLines, errorMsg) {
  let task = _tasks.find((t) => t.id === id);
  if (!task) {
    task = {
      id,
      name,
      status,
      output: [],
      startedAt: Date.now(),
      errorMsg: "",
    };
    _tasks.unshift(task);
  }
  task.status = status;
  task.output = outputLines || task.output;
  if (errorMsg) task.errorMsg = errorMsg;
  renderTaskPanel();
  renderTaskBadge();
}

function removeTask(id) {
  _tasks = _tasks.filter((t) => t.id !== id);
  _expandedTasks.delete(id);
  renderTaskPanel();
  renderTaskBadge();
}

function toggleTaskPanel() {
  _taskPanelOpen = !_taskPanelOpen;
  document.getElementById("taskPanel").classList.toggle("open", _taskPanelOpen);
  renderTaskPanel();
}

function closeTaskPanel() {
  _taskPanelOpen = false;
  document.getElementById("taskPanel").classList.remove("open");
}

// 点击面板外部自动关闭
document.addEventListener("click", function (e) {
  if (!_taskPanelOpen) return;
  var panel = document.getElementById("taskPanel");
  var badge = document.getElementById("taskBadge");
  if (panel && !panel.contains(e.target) && badge && !badge.contains(e.target)) {
    closeTaskPanel();
  }
});

function clearAllTasks() {
  var removedIds = _tasks
    .filter((t) => t.status !== "running")
    .map((t) => t.id);
  removedIds.forEach(function (id) {
    _expandedTasks.delete(id);
  });
  _tasks = _tasks.filter((t) => t.status === "running");
  renderTaskPanel();
  renderTaskBadge();
}

function renderTaskBadge() {
  const badge = document.getElementById("taskBadge");
  const count = _tasks.length;
  const hasRunning = _tasks.some((t) => t.status === "running");
  document.getElementById("taskCount").textContent = count;
  if (count > 0) {
    badge.style.display = "";
    badge.classList.toggle("pulse", hasRunning);
  } else {
    badge.style.display = "none";
    badge.classList.remove("pulse");
    _taskPanelOpen = false;
    document.getElementById("taskPanel").classList.remove("open");
  }
}

function renderTaskPanel() {
  if (!_taskPanelOpen) return;
  var container = document.getElementById("taskList");

  var items = container.querySelectorAll(".task-item.task-expanded");
  _expandedTasks.clear();
  items.forEach(function (item) {
    if (item.dataset.taskId) _expandedTasks.add(item.dataset.taskId);
  });

  if (_tasks.length === 0) {
    container.innerHTML = '<div class="task-empty">' + t("no_data") + "</div>";
    return;
  }
  container.innerHTML = _tasks
    .map((t) => {
      let statusIcon = "";
      let statusClass = "";
      if (t.status === "running") {
        statusIcon =
          '<svg class="task-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>';
        statusClass = "task-running";
      } else if (t.status === "success") {
        statusIcon =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
        statusClass = "task-success";
      } else {
        statusIcon =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        statusClass = "task-error";
      }
      var output = (t.output || []).slice(-20).join("\n");
      var detail = t.status === "error" && t.errorMsg ? "\n" + t.errorMsg : "";
      var expanded = _expandedTasks.has(t.id) ? " task-expanded" : "";
      return (
        '<div class="task-item ' +
        statusClass +
        expanded +
        '" data-task-id="' +
        esc(t.id) +
        '" onclick="toggleTaskExpand(this)">' +
        '<div class="task-item-hd">' +
        '<span class="task-icon">' +
        statusIcon +
        "</span>" +
        '<span class="task-name">' +
        esc(t.name) +
        "</span>" +
        '<span class="task-time">' +
        new Date(t.startedAt).toLocaleTimeString(getLocale()) +
        "</span>" +
        '<button class="btn-icon" onclick="event.stopPropagation();removeTask(\'' +
        esc(t.id) +
        '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
        "</div>" +
        '<pre class="task-output">' +
        esc(output + detail) +
        "</pre>" +
        "</div>"
      );
    })
    .join("");
}

function toggleTaskExpand(el) {
  el.classList.toggle("task-expanded");
  var taskId = el.dataset.taskId;
  if (!taskId) return;
  if (el.classList.contains("task-expanded")) {
    _expandedTasks.add(taskId);
  } else {
    _expandedTasks.delete(taskId);
  }
}

// 已完成任务不自动清理，由用户手动清除
setInterval(function () {
  // 原自动清理逻辑
  // const now = Date.now();
  // const before = _tasks.length;
  // var removed = _tasks.filter(t => t.status !== 'running' && now - t.startedAt >= 30000);
  // removed.forEach(function(t) { _expandedTasks.delete(t.id) });
  // _tasks = _tasks.filter(t => t.status === 'running' || now - t.startedAt < 30000);
  // if (_tasks.length !== before) renderTaskBadge();
  if (_taskPanelOpen) renderTaskPanel();
}, 5000);

// ========== 包管理功能 ==========

let _pkgCache = null;
let _pkgUpdateCache = null;
let _pkgDebounceTimer;

function debouncePkgs() {
  clearTimeout(_pkgDebounceTimer);
  _pkgDebounceTimer = setTimeout(renderPkgInstalled, 300);
}

function switchPkgTab(tab, btn) {
  btn
    .closest(".view-toggle")
    .querySelectorAll(".view-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("pkInstalledTab").style.display =
    tab === "pk-installed" ? "block" : "none";
  document.getElementById("pkUpdatesTab").style.display =
    tab === "pk-updates" ? "block" : "none";
  document.getElementById("pkInstallNewTab").style.display =
    tab === "pk-install-new" ? "block" : "none";
  document.getElementById("pkGitTab").style.display =
    tab === "pk-git" ? "block" : "none";
  document.getElementById("pkUploadTab").style.display =
    tab === "pk-upload" ? "block" : "none";
  if (tab === "pk-updates") loadPackageUpdates();
}

/**
 * 通用合并页 tab 切换
 * @param {string} tabPrefix - tab section ID 前缀（如 "cfg-editor"）
 * @param {Element} btn - 被点击的 tab 按钮
 * @param {function} [onSwitch] - 切换后回调（用于懒加载）
 */
function switchMergeTab(tabPrefix, btn, onSwitch) {
  // 找到最近的 tab bar
  var bar = btn.closest(".view-toggle");
  if (bar) {
    bar.querySelectorAll(".view-btn").forEach(function (b) {
      b.classList.remove("active");
    });
  }
  btn.classList.add("active");
  // 隐藏同组所有 tab section，显示目标
  var section = document.getElementById(tabPrefix + "-tab");
  if (section) {
    var parent = section.parentElement;
    parent.querySelectorAll(".tab-section").forEach(function (s) {
      s.style.display = "none";
    });
    section.style.display = "block";
  }
  if (onSwitch) onSwitch();
}

// ===== 配置中心 tab =====
function switchConfigTab(tab, btn) {
  var loaders = {
    "cfg-editor": loadConfig,
    "cfg-framework": loadFrameworkConfig,
  };
  switchMergeTab(tab, btn, loaders[tab]);
}

// ===== 事件中心 tab =====
function switchEventTab(tab, btn) {
  var loaders = {
    "ev-stream": loadEvents,
    "ev-builder": initEventBuilder,
  };
  switchMergeTab(tab, btn, loaders[tab]);
}

// ===== 商店 tab =====
function switchStoreTab(tab, btn) {
  var loaders = {
    "st-browse": loadStore,
    "st-packages": function () {
      loadPackages();
      loadPackageUpdates();
    },
  };
  switchMergeTab(tab, btn, loaders[tab]);
}

// ===== 系统监控 tab =====
function switchMonitorTab(tab, btn) {
  var loaders = {
    "mon-logs": loadLogs,
    "mon-lifecycle": loadLifecycle,
    "mon-audit": loadAuditLog,
  };
  switchMergeTab(tab, btn, loaders[tab]);
}

// ===== 模块管理 tab（适配器 / 模块）=====
function switchModuleMgmtTab(tab, btn) {
  switchMergeTab(tab, btn, null);
}

// ===== 适配器配置 tab（适配器配置 / 模块配置）=====
function switchExtConfigTab(tab, btn) {
  var loaders = {
    "cfg-adapter": loadAdapterConfigPage,
    "cfg-module": loadModuleConfigPage,
  };
  switchMergeTab(tab, btn, loaders[tab]);
}

async function loadPackages(forceRefresh) {
  const force = forceRefresh === true;
  const params = force ? "?force=true" : "";
  const d = await api("/api/packages" + params);
  if (!d || d.error) return;
  _pkgCache = d.packages || [];
  document.getElementById("pkgInstalledCount").textContent = _pkgCache.length;
  renderPkgInstalled();
}

function renderPkgInstalled() {
  if (!_pkgCache) return;
  const search = (
    document.getElementById("pkgSearch")?.value || ""
  ).toLowerCase();
  const filtered = search
    ? _pkgCache.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          (p.summary || "").toLowerCase().includes(search),
      )
    : _pkgCache;

  if (filtered.length === 0) {
    document.getElementById("pkgInstalledList").innerHTML =
      '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg><p>' +
      t("pkg_no_installed") +
      "</p></div>";
    return;
  }

  const html = filtered
    .map((p) => {
      let typeBadges = "";
      if (p.is_module)
        typeBadges +=
          '<span class="chip chip-pr" style="font-size:10px;padding:1px 6px">' +
          t("pkg_type_module") +
          "</span>";
      if (p.is_adapter)
        typeBadges +=
          '<span class="chip chip-sc" style="font-size:10px;padding:1px 6px">' +
          t("pkg_type_adapter") +
          "</span>";
      if (!p.is_module && !p.is_adapter)
        typeBadges +=
          '<span class="chip" style="font-size:10px;padding:1px 6px;background:var(--bg-s);color:var(--tx-t)">' +
          t("pkg_type_library") +
          "</span>";

      const isProtected =
        p.name.toLowerCase().replace(/[-_]/g, "") === "erispulse" ||
        p.name.toLowerCase().replace(/[-_]/g, "") === "erispulsedashboard";
      let actions = "";
      if (!isProtected) {
        actions +=
          '<button class="btn btn-secondary btn-xs" onclick="upgradePkg(\'' +
          esc(p.name) +
          "')\">" +
          t("pkg_upgrade") +
          "</button> ";
        actions +=
          '<button class="btn btn-danger btn-xs" onclick="uninstallPkg(\'' +
          esc(p.name) +
          "')\">" +
          t("uninstall_module") +
          "</button>";
      }

      return (
        '<div class="pkg-row">' +
        '<div class="pkg-info">' +
        '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
        '<span class="pkg-name">' +
        esc(p.name) +
        "</span>" +
        typeBadges +
        "</div>" +
        '<div style="font-size:12px;color:var(--tx-s);margin-top:2px">' +
        esc(p.summary || "") +
        "</div>" +
        "</div>" +
        '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">' +
        '<span class="pkg-version">v' +
        esc(p.version) +
        "</span>" +
        actions +
        "</div>" +
        "</div>"
      );
    })
    .join("");

  document.getElementById("pkgInstalledList").innerHTML = html;
}

async function loadPackageUpdates(forceRefresh) {
  const countEl = document.getElementById("pkgUpdateCount");
  const countInnerEl = document.getElementById("pkgUpdateCountInner");

  if (!_pkgUpdateCache || forceRefresh) {
    document.getElementById("pkgUpdateList").innerHTML =
      '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="animation:spin 1s linear infinite"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg><p>' +
      t("pkg_checking_updates") +
      "</p></div>";
    const force = forceRefresh === true;
    const params = force ? "?force=true" : "";
    const d = await api("/api/packages/updates" + params);
    if (!d || d.error) {
      document.getElementById("pkgUpdateList").innerHTML =
        '<div class="empty-state"><p>' +
        (d?.error || t("action_failed")) +
        "</p></div>";
      return;
    }
    _pkgUpdateCache = d.updates || [];
  }

  const updates = _pkgUpdateCache;
  countEl.textContent = updates.length;
  countEl.style.display = updates.length > 0 ? "inline-flex" : "none";
  countInnerEl.textContent = updates.length;

  if (updates.length === 0) {
    document.getElementById("pkgUpdateList").innerHTML =
      '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="20 6 9 17 4 12"/></svg><p>' +
      t("pkg_no_updates") +
      "</p></div>";
    return;
  }

  const html = updates
    .map((u) => {
      return (
        '<div class="pkg-row pkg-row-update">' +
        '<div class="pkg-info">' +
        '<span class="pkg-name">' +
        esc(u.name) +
        "</span>" +
        "</div>" +
        '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">' +
        '<span class="pkg-version-old">v' +
        esc(u.current) +
        "</span>" +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;color:var(--wr-c)"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>' +
        '<span class="pkg-version-new">v' +
        esc(u.latest) +
        "</span>" +
        '<button class="btn btn-primary btn-xs" onclick="upgradePkg(\'' +
        esc(u.name) +
        "')\">" +
        t("pkg_upgrade") +
        "</button>" +
        "</div>" +
        "</div>"
      );
    })
    .join("");

  document.getElementById("pkgUpdateList").innerHTML = html;
}

async function upgradePkg(pkgName) {
  if (!authed) return showLogin();
  const ok = await confirm2(
    t("pkg_upgrade"),
    t("pkg_upgrade_confirm") + " <strong>" + esc(pkgName) + "</strong>?",
  );
  if (!ok) return;
  const d = await api("/api/packages/upgrade", {
    method: "POST",
    body: JSON.stringify({ packages: [pkgName] }),
  });
  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, pkgName);
    toast(t("pkg_upgrading"), "");
  } else {
    toast(t("pkg_upgrade_failed") + ": " + (d?.error || ""), "er");
  }
}

async function upgradeAllPkgs() {
  if (!authed) return showLogin();
  if (!_pkgUpdateCache || _pkgUpdateCache.length === 0) {
    toast(t("pkg_no_updates"), "");
    return;
  }
  const ok = await confirm2(t("upgrade_all"), t("pkg_upgrade_all_confirm"));
  if (!ok) return;
  const packages = _pkgUpdateCache.map((u) => u.name);
  const d = await api("/api/packages/upgrade", {
    method: "POST",
    body: JSON.stringify({ packages }),
  });
  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, packages.join(", "));
    toast(t("pkg_upgrading"), "");
  } else {
    toast(t("pkg_upgrade_failed") + ": " + (d?.error || ""), "er");
  }
}

async function installNewPkg() {
  if (!authed) return showLogin();
  const input = document.getElementById("pkgInstallInput");
  const val = input.value.trim();
  if (!val) return;
  const packages = val.split(/\s+/).filter((s) => s.length > 0);
  const ok = await confirm2(
    t("install"),
    t("install") + " <strong>" + esc(packages.join(", ")) + "</strong>?",
  );
  if (!ok) return;
  const d = await api("/api/packages/install", {
    method: "POST",
    body: JSON.stringify({ packages }),
  });
  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, packages.join(", "));
    toast(t("installing"), "");
    input.value = "";
  } else {
    toast(t("install_failed") + ": " + (d?.error || ""), "er");
  }
}

async function installNewGitPkg() {
  if (!authed) return showLogin();
  const input = document.getElementById("pkgGitInput");
  const val = input.value.trim();
  if (!val) return;
  if (!val.startsWith("git+")) {
    toast(t("install_failed") + ": URL must start with git+", "er");
    return;
  }
  const ok = await confirm2(
    t("install"),
    t("install") + " <strong>" + esc(val) + "</strong>?",
  );
  if (!ok) return;
  const d = await api("/api/packages/install", {
    method: "POST",
    body: JSON.stringify({ packages: [val] }),
  });
  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, val);
    toast(t("installing"), "");
    input.value = "";
  } else {
    toast(t("install_failed") + ": " + (d?.error || ""), "er");
  }
}

async function loadGitPackages() {
  if (!authed) return;
  const d = await api("/api/packages/git");
  if (!d) return;
  const container = document.getElementById("pkgGitList");
  const pkgs = d.packages || [];
  const updates = d.updates || [];
  const updateMap = {};
  updates.forEach((u) => {
    updateMap[u.git_url] = u;
  });
  if (pkgs.length === 0) {
    container.innerHTML =
      '<div class="empty-state" style="padding:32px 20px">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:32px;height:32px;opacity:0.3;margin-bottom:8px">' +
      '<circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.01" y1="12" x2="22.96" y2="12"/>' +
      "</svg>" +
      '<p style="font-size:13px;color:var(--tx-s);margin:0">' +
      t("pkg_git_no_packages") +
      "</p>" +
      "</div>";
    return;
  }
  const html = pkgs
    .map((p) => {
      const isUpdatable = updateMap[p.git_url];
      const urlEsc = esc(p.git_url);
      const label = isUpdatable
        ? `<span class="chip chip-wr">${t("pkg_git_update_available")}</span>`
        : `<span class="chip chip-ok">${t("latest_version")}</span>`;
      const btn = isUpdatable
        ? `<button class="btn btn-primary btn-xs" onclick="upgradeGitPkg('${urlEsc}')">${t("pkg_git_upgrade")}</button>`
        : "";
      return `
        <div class="kv-row" style="display:flex;align-items:center;gap:12px;padding:12px 18px">
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px;font-family:Consolas,Monaco,monospace;word-break:break-all">${urlEsc}</div>
            <div style="font-size:11px;color:var(--tx-s);margin-top:4px">
              ${label}
            </div>
          </div>
          <div style="flex-shrink:0;display:flex;gap:4px">
            ${btn}
          </div>
        </div>`;
    })
    .join("");
  container.innerHTML = html;
}

async function upgradeGitPkg(gitUrl) {
  if (!authed) return showLogin();
  const ok = await confirm2(
    t("pkg_git_upgrade"),
    t("pkg_upgrade_confirm") + " <strong>" + esc(gitUrl) + "</strong>?",
  );
  if (!ok) return;
  const d = await api("/api/packages/git-upgrade", {
    method: "POST",
    body: JSON.stringify({ git_url: gitUrl }),
  });
  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, gitUrl);
    toast(t("pkg_upgrading"), "");
  } else {
    toast(t("pkg_upgrade_failed") + ": " + (d?.error || ""), "er");
  }
}

async function uninstallPkg(pkgName) {
  if (!authed) return showLogin();
  const ok = await confirm2(
    t("uninstall_module"),
    t("pkg_uninstall_confirm") + " <strong>" + esc(pkgName) + "</strong>",
  );
  if (!ok) return;
  const d = await api("/api/packages/uninstall", {
    method: "POST",
    body: JSON.stringify({ package: pkgName }),
  });
  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, pkgName);
    toast(t("module_uninstalling"), "");
  } else if (d && d.error === "Cannot uninstall core package") {
    toast(t("pkg_cannot_uninstall"), "er");
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

let _cmdData = null,
  _editCmdName = "",
  _editAliases = [],
  _editAllowed = [],
  _editBlocked = [],
  _editAclAllow = [],
  _editAclDeny = [],
  _cmdPlatforms = [];
let _masterPlatforms = [];
let _masterEntries = [];
let _masterFilter = "";
let _masterProviders = [];
let _scopeData = null;
let _scopePlatformBots = {};
let _scopeRegisteredModules = [];
let _scopeEditorTarget = null;
let _scopeMsWhite = null;
let _scopeMsBlock = null;
let _scopeIdnPolicy = "allow";

function switchPermTab(tab, btn) {
  var bar = btn.closest("#permTabBar");
  if (bar) {
    bar.querySelectorAll(".pkg-tab").forEach(function (b) {
      b.classList.remove("active");
    });
  }
  btn.classList.add("active");
  document.querySelectorAll("#p-master .tab-section").forEach(function (s) {
    s.style.display = "none";
  });
  var target = document.getElementById(tab + "-tab");
  if (target) target.style.display = "block";
  if (tab === "perm-master") loadMaster();
  if (tab === "perm-scope") loadScope();
}

function loadPermPage() {
  var btn = document.querySelector('#permTabBar [data-tab="perm-scope"]');
  if (btn && !btn.classList.contains("active")) {
    switchPermTab("perm-scope", btn);
  } else {
    loadScope();
  }
}

function onMasterFilterInput() {
  var el = document.getElementById("masterFilter");
  _masterFilter = el ? el.value.trim().toLowerCase() : "";
  renderMasterConfig();
}

async function loadCommands() {
  const d = await api("/api/commands");
  if (!d) return;
  _cmdData = d;
  _cmdPlatforms = d.platforms || [];
  const gs = d.global_settings || {};
  renderCmdGlobalSettings(gs);
  document.getElementById("cmdCount").textContent = d.total || 0;
  const cmds = d.commands || [];
  if (!cmds.length) {
    document.getElementById("cmdListBody").innerHTML =
      '<div style="padding:32px 18px;text-align:center;color:var(--tx-t);font-size:13px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;opacity:.3;margin-bottom:8px"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg><div>' +
      t("cmd_no_commands") +
      "</div></div>";
    return;
  }
  let html = "";
  for (const c of cmds) {
    const enabled = c.enabled !== false;
    const dotClass = enabled ? "enabled" : "disabled";
    const statusText = enabled ? t("cmd_enabled") : t("cmd_disabled");
    let aliasesHtml = "";
    for (const a of c.original_aliases || []) {
      aliasesHtml +=
        '<span class="cmd-alias-chip original">' + esc(a) + "</span>";
    }
    for (const a of c.custom_aliases || []) {
      aliasesHtml +=
        '<span class="cmd-alias-chip custom">' + esc(a) + "</span>";
    }
    let metaParts = [];
    if (!aliasesHtml) aliasesHtml = "";
    if (aliasesHtml)
      metaParts.push(
        "<span>" + t("cmd_aliases_label") + ": " + aliasesHtml + "</span>",
      );
    if (c.help) metaParts.push("<span>" + esc(c.help) + "</span>");
    if (c.group)
      metaParts.push(
        "<span>" + t("cmd_group") + ": " + esc(c.group) + "</span>",
      );
    if (c.usage)
      metaParts.push(
        '<span style="font-family:Consolas,Monaco,monospace;font-size:11px">' +
          esc(c.usage) +
          "</span>",
      );
    let platformBadges = "";
    for (const p of c.allowed_platforms || []) {
      platformBadges +=
        '<span class="cmd-platform-chip allowed">' + esc(p) + "</span>";
    }
    for (const p of c.blocked_platforms || []) {
      platformBadges +=
        '<span class="cmd-platform-chip blocked">' + esc(p) + "</span>";
    }
    let transformBadge = "";
    if (c.transform_to) {
      transformBadge =
        '<span class="cmd-transform">&rarr; ' + esc(c.transform_to) + "</span>";
    }
    let badges = platformBadges + transformBadge;
    html +=
      '<div class="cmd-row">' +
      '<span class="cmd-status-dot ' +
      dotClass +
      '"></span>' +
      '<div class="cmd-info">' +
      '<div class="cmd-name-row">' +
      '<span class="cmd-name">' +
      esc(c.name) +
      "</span>" +
      (badges ? '<span class="cmd-badges">' + badges + "</span>" : "") +
      "</div>" +
      '<div class="cmd-meta">' +
      (metaParts.length
        ? metaParts.join("")
        : '<span style="color:var(--tx-t)">' +
          t("module_no_desc") +
          "</span>") +
      "</div>" +
      "</div>" +
      '<div class="cmd-actions">' +
      '<button class="btn btn-secondary btn-xs" onclick="openCmdEdit(\'' +
      esc(c.name).replace(/'/g, "\\'") +
      "')\">" +
      t("config") +
      "</button>" +
      "</div>" +
      "</div>";
  }
  document.getElementById("cmdListBody").innerHTML = html;
}

function renderCmdGlobalSettings(gs) {
  var prefixes = gs.prefixes || [gs.prefix || "/"];
  var prefixStr = prefixes.join(",");
  var html =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 20px">' +
    '<div style="grid-column:1/-1">' +
    '<div style="color:var(--tx-s);font-size:13px;margin-bottom:4px">' +
    t("cmd_prefix") +
    "</div>" +
    '<input class="fw-input" id="cmdSetPrefix" value="' +
    esc(prefixStr) +
    '" placeholder="/" style="width:100%">' +
    '<div style="font-size:11px;color:var(--tx-t);margin-top:2px">' +
    t("cmd_prefix_hint") +
    "</div>" +
    "</div>" +
    renderCmdToggleRow("cmdSetCaseSensitive", t("cmd_case_sensitive"), gs.case_sensitive) +
    renderCmdToggleRow("cmdSetAllowSpace", t("cmd_allow_space_prefix"), gs.allow_space_prefix) +
    renderCmdToggleRow("cmdSetMustAtBot", t("cmd_must_at_bot"), gs.must_at_bot) +
    "</div>";
  document.getElementById("cmdGlobalSettingsBody").innerHTML = html;
  var settingsTimer = null;
  ["cmdSetPrefix", "cmdSetCaseSensitive", "cmdSetAllowSpace", "cmdSetMustAtBot"].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    var handler = function () {
      clearTimeout(settingsTimer);
      settingsTimer = setTimeout(saveCmdGlobalSettings, 800);
    };
    if (el.tagName === "INPUT" && el.type === "checkbox") el.addEventListener("change", handler);
    else el.addEventListener("input", handler);
  });
}

function renderCmdToggleRow(id, label, checked) {
  return (
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0">' +
    '<span style="color:var(--tx-s);font-size:13px">' +
    esc(label) +
    "</span>" +
    '<label class="switch"><input type="checkbox" id="' +
    id +
    '"' +
    (checked ? " checked" : "") +
    '><span class="switch-slider"></span></label></div>'
  );
}

async function saveCmdGlobalSettings() {
  if (!authed) return showLogin();
  var prefix = document.getElementById("cmdSetPrefix").value;
  var caseSensitive = document.getElementById("cmdSetCaseSensitive").checked;
  var allowSpace = document.getElementById("cmdSetAllowSpace").checked;
  var mustAtBot = document.getElementById("cmdSetMustAtBot").checked;
  var d = await api("/api/commands/settings", {
    method: "PUT",
    body: JSON.stringify({
      prefix: prefix,
      case_sensitive: caseSensitive,
      allow_space_prefix: allowSpace,
      must_at_bot: mustAtBot,
    }),
  });
  if (d && d.success) {
    toast(t("cmd_settings_saved"), "ok");
  } else {
    toast(t("cmd_save_failed") + ": " + (d?.error || t("unknown_error")), "er");
  }
}

function initMasterState(masterConfig, platforms) {
  _masterPlatforms = platforms || [];
  _masterEntries = [];
  var users = (masterConfig && masterConfig.users) || {};
  if (Array.isArray(users)) {
    for (var i = 0; i < users.length; i++) {
      _masterEntries.push({ platform: "", userId: String(users[i]) });
    }
  } else if (typeof users === "object" && users !== null) {
    for (var platform in users) {
      var ids = users[platform];
      if (!Array.isArray(ids)) ids = [ids];
      for (var j = 0; j < ids.length; j++) {
        _masterEntries.push({ platform: String(platform), userId: String(ids[j]) });
      }
    }
  }
}

function renderMasterConfig() {
  var body = document.getElementById("masterListBody");
  if (!body) return;
  var countEl = document.getElementById("masterCount");
  if (countEl) countEl.textContent = _masterEntries.length;

  // Update stats
  var globalCount = 0;
  var platformCount = 0;
  for (var i = 0; i < _masterEntries.length; i++) {
    if (_masterEntries[i].platform) platformCount++;
    else globalCount++;
  }
  var statTotal = document.getElementById("masterStatTotal");
  var statGlobal = document.getElementById("masterStatGlobal");
  var statPlatform = document.getElementById("masterStatPlatform");
  if (statTotal) statTotal.textContent = _masterEntries.length;
  if (statGlobal) statGlobal.textContent = globalCount;
  if (statPlatform) statPlatform.textContent = platformCount;

  // 平台分布可视化
  var distEl = document.getElementById("masterDist");
  if (distEl) {
    if (!_masterEntries.length) {
      distEl.innerHTML = "";
      distEl.style.display = "none";
    } else {
      distEl.style.display = "";
      var byPlatform = {};
      for (var di = 0; di < _masterEntries.length; di++) {
        var dp = _masterEntries[di].platform || "_global";
        byPlatform[dp] = (byPlatform[dp] || 0) + 1;
      }
      var maxCount = 1;
      Object.keys(byPlatform).forEach(function (k) {
        if (byPlatform[k] > maxCount) maxCount = byPlatform[k];
      });
      var distHtml = '<div class="perm-group-title" style="margin-bottom:8px">' + esc(t("master_dist")) + "</div>";
      Object.keys(byPlatform)
        .sort(function (a, b) { return byPlatform[b] - byPlatform[a]; })
        .forEach(function (k) {
          var pct = Math.round((byPlatform[k] / maxCount) * 100);
          var label = k === "_global" ? esc(t("master_global")) : esc(k);
          distHtml +=
            '<div class="master-dist-row">' +
            '<span class="master-dist-name">' + label + "</span>" +
            '<span class="master-dist-bar"><span class="master-dist-fill" style="width:' + pct + '%"></span></span>' +
            '<span class="master-dist-count">' + byPlatform[k] + "</span>" +
            "</div>";
        });
      distEl.innerHTML = distHtml;
    }
  }

  // Update add-form platform options
  renderMasterAddPlatformOptions();

  if (!_masterEntries.length) {
    body.innerHTML =
      '<div class="perm-empty">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="52" height="52" style="color:var(--accent);opacity:0.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>' +
      '<div class="perm-empty-title">' + t("master_empty") + "</div>" +
      '<div class="perm-empty-desc">' + t("master_merge_hint") + "</div>" +
      '<button class="btn btn-primary btn-sm" style="margin-top:14px" onclick="toggleMasterEditor()">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;margin-right:4px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
      t("master_add") +
      "</button>" +
      "</div>";
    if (_masterProviders.length) _renderMasterProviders(body);
    return;
  }

  var f = _masterFilter;
  var visible = [];
  for (var i = 0; i < _masterEntries.length; i++) {
    var en = _masterEntries[i];
    if (
      !f ||
      String(en.userId).toLowerCase().indexOf(f) !== -1 ||
      String(en.platform).toLowerCase().indexOf(f) !== -1
    ) {
      visible.push(i);
    }
  }

  if (countEl && f) {
    countEl.textContent = visible.length + "/" + _masterEntries.length;
  }

  if (!visible.length) {
    body.innerHTML =
      '<div class="perm-empty">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
      '<div class="perm-empty-title">' + t("no_matches") + "</div>" +
      "</div>";
    return;
  }

  // Group visible entries: global first, then by platform
  var globalEntries = [];
  var platformGroups = {};
  var platformOrder = [];
  for (var k = 0; k < visible.length; k++) {
    var v = visible[k];
    var ent = _masterEntries[v];
    if (!ent.platform) globalEntries.push(v);
    else {
      if (!platformGroups[ent.platform]) {
        platformGroups[ent.platform] = [];
        platformOrder.push(ent.platform);
      }
      platformGroups[ent.platform].push(v);
    }
  }

  var html = "";

  // Global section
  if (globalEntries.length > 0) {
    html +=
      '<div class="perm-group">' +
      '<div class="perm-group-head">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/></svg>' +
      '<span class="perm-group-title">' + t("master_global_users") + "</span>" +
      '<span class="perm-group-count">' + globalEntries.length + "</span>" +
      '<span class="perm-group-hint">' + t("master_global_users_hint") + "</span>" +
      "</div>" +
      '<div class="perm-members">';
    for (var j = 0; j < globalEntries.length; j++) {
      html += renderMasterTag(globalEntries[j]);
    }
    html += "</div></div>";
  }

  // Platform sections
  for (var pi = 0; pi < platformOrder.length; pi++) {
    var platform = platformOrder[pi];
    var indices = platformGroups[platform];
    html +=
      '<div class="perm-group">' +
      '<div class="perm-group-head">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/></svg>' +
      '<span class="perm-group-title">' + esc(platform) + "</span>" +
      '<span class="perm-group-count">' + indices.length + "</span>" +
      "</div>" +
      '<div class="perm-members">';
    for (var j = 0; j < indices.length; j++) {
      html += renderMasterTag(indices[j]);
    }
    html += "</div></div>";
  }

  // Hint at bottom
  html += '<div class="perm-hint">' + t("master_merge_hint") + "</div>";

  html += _masterProvidersHtml();

  body.innerHTML = html;
}

function _masterProvidersHtml() {
  if (!_masterProviders.length) return "";
  return (
    '<div class="perm-group">' +
    '<div class="perm-group-head">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-3.6 8-10V5.4L12 2.5 4 5.4V12c0 6.4 8 10 8 10z"/></svg>' +
    '<span class="perm-group-title">' + t("master_providers_title") + "</span>" +
    '<span class="perm-group-count">' + _masterProviders.length + "</span>" +
    "</div>" +
    '<div class="perm-members">' +
    _masterProviders
      .map(function (p) {
        return (
          '<div class="perm-member">' +
          '<span class="perm-member-avatar">ƒ</span>' +
          '<span class="perm-member-id">' + esc(p.name) + "</span>" +
          (p.owner
            ? '<span class="scope-owner-chip">📦 ' + esc(p.owner) + "</span>"
            : "") +
          "</div>"
        );
      })
      .join("") +
    "</div></div>"
  );
}

function _renderMasterProviders(container) {
  if (!container) return;
  var div = document.createElement("div");
  div.innerHTML = _masterProvidersHtml();
  if (div.firstChild) container.appendChild(div.firstChild);
}

function renderMasterTag(idx) {
  var entry = _masterEntries[idx];
  var initial = (entry.userId || "?").trim().charAt(0).toUpperCase();
  return (
    '<div class="perm-member" data-uid="' + esc(entry.userId) + '">' +
    '<span class="perm-member-avatar">' + esc(initial) + "</span>" +
    '<span class="perm-member-id">' + esc(entry.userId) + "</span>" +
    '<button class="perm-member-remove" onclick="removeMasterEntry(' + idx + ')" title="' + t("master_remove") + '">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
    "</button></div>"
  );
}

function renderMasterAddPlatformOptions() {
  var sel = document.getElementById("masterAddPlatform");
  if (!sel) return;
  var current = sel.value;
  var html = '<option value="">' + t("master_global") + "</option>";
  for (var i = 0; i < _masterPlatforms.length; i++) {
    var p = _masterPlatforms[i];
    html += '<option value="' + esc(p) + '">' + esc(p) + "</option>";
  }
  html += '<option value="__custom__">' + t("custom") + "</option>";
  sel.innerHTML = html;
  if (current && current !== "__custom__") sel.value = current;
}

function onMasterAddPlatformChange() {
  var sel = document.getElementById("masterAddPlatform");
  if (!sel || sel.value !== "__custom__") return;
  // Replace select with text input for custom platform
  var wrapper = sel.parentElement;
  sel.outerHTML =
    '<input id="masterAddPlatform" class="fw-input" style="width:150px;flex-shrink:0;font-size:13px" placeholder="' + t("master_add_platform") +
    '" data-custom="1">';
  var newInput = document.getElementById("masterAddPlatform");
  if (newInput) newInput.focus();
}

function addMasterFromForm() {
  var sel = document.getElementById("masterAddPlatform");
  var idInput = document.getElementById("masterAddId");
  if (!idInput) return;
  var userId = idInput.value.trim();
  if (!userId) {
    idInput.focus();
    return;
  }
  var platform = "";
  if (sel) {
    if (sel.value === "__custom__") return;
    if (sel.dataset && sel.dataset.custom === "1") {
      platform = sel.value.trim();
      if (!platform) {
        sel.focus();
        return;
      }
    } else {
      platform = sel.value;
    }
  }
  _masterEntries.push({ platform: platform, userId: userId });
  idInput.value = "";
  // Reset platform selector if it was custom
  if (sel && sel.dataset && sel.dataset.custom === "1") {
    renderMasterConfig();
  }
  idInput.focus();
  renderMasterConfig();
  saveMasterConfig();
}

function removeMasterEntry(idx) {
  _masterEntries.splice(idx, 1);
  renderMasterConfig();
  saveMasterConfig();
}

function toggleMasterEditor() {
  var card = document.getElementById("masterEditorCard");
  if (!card) return;
  var show = card.style.display === "none";
  card.style.display = show ? "" : "none";
  if (show) {
    renderMasterAddPlatformOptions();
    var idInput = document.getElementById("masterAddId");
    if (idInput) idInput.focus();
  }
}

async function loadMaster() {
  var filterEl = document.getElementById("masterFilter");
  if (filterEl) filterEl.value = "";
  _masterFilter = "";
  var d = await api("/api/master");
  if (!d) return;
  _masterProviders = d.providers || [];
  var platforms = d.platforms || [];
  try {
    var ad = await api("/api/adapters");
    if (ad && ad.adapters) {
      platforms = ad.adapters.map(function (a) { return a.platform; });
    }
  } catch (e) {}
  initMasterState(d.master || {}, platforms);
  renderMasterConfig();
}

function collectMasterEntries() {
  return _masterEntries.filter(function (e) { return e.userId; });
}

async function saveMasterConfig() {
  if (!authed) return showLogin();
  var entries = collectMasterEntries();
  var globalEntries = entries.filter(function (e) { return !e.platform; });
  var platformEntries = entries.filter(function (e) { return e.platform; });
  var users;
  if (platformEntries.length === 0) {
    users = globalEntries.map(function (e) { return e.userId; });
  } else {
    users = {};
    for (var i = 0; i < platformEntries.length; i++) {
      var p = platformEntries[i].platform;
      if (!users[p]) users[p] = [];
      if (users[p].indexOf(platformEntries[i].userId) === -1) users[p].push(platformEntries[i].userId);
    }
    for (var i = 0; i < globalEntries.length; i++) {
      for (var p in users) {
        if (users[p].indexOf(globalEntries[i].userId) === -1) users[p].push(globalEntries[i].userId);
      }
    }
  }
  var d = await api("/api/master", {
    method: "PUT",
    body: JSON.stringify({ users: users }),
  });
  if (d && d.success) {
    toast(t("master_saved"), "ok");
  } else {
    toast(t("save_failed") + ": " + (d?.error || t("unknown_error")), "er");
  }
}

// ========== 作用域（Scope）管理 ==========

async function loadScope() {
  var d = await api("/api/scope");
  if (!d) return;
  _scopeData = d;
  var unsupported = document.getElementById("scopeUnsupported");
  var main = document.getElementById("scopeMain");
  if (!d.supported) {
    if (unsupported) unsupported.style.display = "";
    if (main) main.style.display = "none";
    return;
  }
  if (unsupported) unsupported.style.display = "none";
  if (main) main.style.display = "";
  await _loadScopeContexts();
  renderScopeAll();
  onScopeTestKindChange();
}

async function _loadScopeContexts() {
  _scopePlatformBots = {};
  _scopeRegisteredModules = [];
  try {
    var ad = await api("/api/adapters");
    (ad?.adapters || []).forEach(function (a) {
      _scopePlatformBots[a.platform] = (a.bots || []).map(function (b) {
        return b.bot_id;
      });
    });
  } catch (e) {}
  try {
    var md = await api("/api/modules");
    _scopeRegisteredModules = (md?.modules || [])
      .filter(function (m) {
        return m.type === "module";
      })
      .map(function (m) {
        return m.name;
      });
  } catch (e) {}
  var platforms = Object.keys(_scopePlatformBots);
  [["scopeModulePlatform", "scopeModuleBot"], ["scopeIdnPlatform", "scopeIdnBot"], ["scopeTestPlatform", "scopeTestBot"]].forEach(function (pair) {
    var pSel = document.getElementById(pair[0]);
    var bSel = document.getElementById(pair[1]);
    if (!pSel) return;
    var prevP = pSel.value;
    pSel.innerHTML =
      '<option value="">' + esc(t("topo_type_adapter")) + "…</option>" +
      platforms
        .map(function (p) {
          return '<option value="' + esc(p) + '">' + esc(p) + "</option>";
        })
        .join("");
    if (prevP && platforms.indexOf(prevP) >= 0) pSel.value = prevP;
    onScopePlatformChange(pair[0] === "scopeModulePlatform" ? "module" : pair[0] === "scopeIdnPlatform" ? "identity" : "test");
  });
  var mSel = document.getElementById("scopeActionModule");
  var tSel = document.getElementById("scopeTestModule");
  [mSel, tSel].forEach(function (sel) {
    if (!sel) return;
    var prev = sel.value;
    sel.innerHTML =
      '<option value="">' + esc(t("topo_type_module")) + "…</option>" +
      _scopeRegisteredModules
        .map(function (m) {
          return '<option value="' + esc(m) + '">' + esc(m) + "</option>";
        })
        .join("");
    if (prev && _scopeRegisteredModules.indexOf(prev) >= 0) sel.value = prev;
  });
}

function onScopePlatformChange(kind) {
  var pSelId = kind === "module" ? "scopeModulePlatform" : kind === "identity" ? "scopeIdnPlatform" : "scopeTestPlatform";
  var bSelId = kind === "module" ? "scopeModuleBot" : kind === "identity" ? "scopeIdnBot" : "scopeTestBot";
  var pSel = document.getElementById(pSelId);
  var bSel = document.getElementById(bSelId);
  if (!pSel || !bSel) return;
  var bots = _scopePlatformBots[pSel.value] || [];
  bSel.innerHTML =
    '<option value="">' + esc(t("scope_all_bots")) + "</option>" +
    bots
      .map(function (b) {
        return '<option value="' + esc(b) + '">' + esc(b) + "</option>";
      })
      .join("");
  if (kind === "module") {
    var editorCard = document.getElementById("scopeModuleEditorCard");
    if (editorCard && editorCard.style.display !== "none") {
      renderScopeModuleCrumbsFromEditor();
    }
  }
}

function onScopeIdnLevelChange() {
  var level = document.getElementById("scopeIdnLevel").value;
  var botField = document.getElementById("scopeIdnBotField");
  var targetField = document.getElementById("scopeIdnTargetField");
  var targetLabel = document.getElementById("scopeIdnTargetLabel");
  var target = document.getElementById("scopeIdnTarget");
  if (botField) botField.style.display = level === "adapter" ? "none" : "";
  if (targetField) targetField.style.display = level === "session" || level === "user" ? "" : "none";
  if (targetLabel) targetLabel.textContent = t(level === "user" ? "scope_level_user" : "scope_level_session");
  if (target) target.placeholder = t(level === "user" ? "scope_user_ph" : "scope_session_ph");
}

function _scopeEntryChips(items, cls) {
  return (items || [])
    .map(function (x) {
      return '<span class="scope-entry-chip ' + (cls || "") + '">' + esc(x) + "</span>";
    })
    .join(" ");
}

function renderScopeAll() {
  if (!_scopeData || !_scopeData.supported) return;
  var topo = _scopeData.topology || {};
  var stats = _scopeData.stats || {};
  var da = document.getElementById("scopeDefaultAllow");
  if (da) da.checked = !!_scopeData.default_allow;

  var moduleFiltered = stats.module_filtered || 0;
  var identityDenied = stats.identity_denied || 0;
  var actionDenied = stats.action_denied || 0;
  var hits = stats.cache_hits || 0;
  var misses = stats.cache_misses || 0;
  var hitRate = hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 0;
  _setText("scopeStatModule", moduleFiltered);
  _setText("scopeStatIdentity", identityDenied);
  _setText("scopeStatAction", actionDenied);
  _setText("scopeStatCache", hitRate + "%");

  var modCount = renderScopeModuleList(topo);
  var idnCount = renderScopeIdentityList(topo);
  var actCount = renderScopeActionList(topo);
  renderScopeRuntimeList();
  _setText("scopeNavCountMod", modCount);
  _setText("scopeNavCountIdn", idnCount);
  _setText("scopeNavCountAct", actCount);
  _setText("scopeNavCountRt", ((_scopeData && _scopeData.runtime_bindings) || []).length);
}

function switchScopePanel(panel, btn) {
  var nav = document.getElementById("scopeNav");
  if (nav) {
    nav.querySelectorAll(".scope-nav-item").forEach(function (b) {
      b.classList.remove("active");
    });
  }
  if (btn) btn.classList.add("active");
  ["mod", "idn", "act", "rt", "test"].forEach(function (p) {
    var el = document.getElementById("scopePanel-" + p);
    if (el) el.style.display = p === panel ? "" : "none";
  });
  if (panel === "mod") {
    var editorCard = document.getElementById("scopeModuleEditorCard");
    if (editorCard) editorCard.style.display = "none";
  }
}

function _scopeLevelBadge(level) {
  var labelKey = { P: "scope_level_platform", B: "scope_level_bot", S: "scope_level_session", A: "scope_level_adapter", U: "scope_level_user" }[level] || "scope_level_platform";
  var icons = {
    P: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/></svg>',
    B: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M12 8V4M8 4h8"/><circle cx="8.5" cy="14" r="1"/><circle cx="15.5" cy="14" r="1"/></svg>',
    S: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    A: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    U: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  };
  return (
    '<span class="scope-level-badge lv-' + level.toLowerCase() + '">' +
    (icons[level] || "") + "<span>" + esc(t(labelKey)) + "</span></span>"
  );
}

function renderUxEmpty(iconSvg, titleKey, descKey, actionHtml) {
  return (
    '<div class="ux-empty">' +
    '<div class="ux-empty-icon">' + iconSvg + "</div>" +
    '<div class="ux-empty-title">' + esc(t(titleKey)) + "</div>" +
    (descKey ? '<div class="ux-empty-desc">' + esc(t(descKey)) + "</div>" : "") +
    (actionHtml ? '<div class="ux-empty-action">' + actionHtml + "</div>" : "") +
    "</div>"
  );
}

function _setText(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value;
}

function _scopeModuleNodeHtml(r, isLast) {
  var path = r.platform + (r.bot ? " / " + r.bot : "") + (r.session ? " / " + r.session : "");
  var cfg = r.cfg || {};
  var modList = (cfg.modules || []).map(String);
  var blockList = (cfg.blocked || []).map(String);
  var chips = "";
  if (modList.length) chips += _scopeEntryChips(modList, "");
  if (blockList.length) chips += (chips ? " " : "") + _scopeEntryChips(blockList, "blocked");
  if (cfg.merge) chips += ' <span class="scope-entry-chip merge">merge</span>';
  if (!chips) chips = '<span class="scope-inherit">' + esc(t("scope_inherit")) + "</span>";
  var target = { platform: r.platform, bot: r.bot || null, session: r.session || null };
  var editArgs = encodeURIComponent(JSON.stringify(target));
  var delArgs = "'" + _jsq(r.platform) + "','" + _jsq(r.bot || "") + "','" + _jsq(r.session || "") + "'";
  return (
    '<div class="scope-tree-node">' +
    (r.level === "P" ? "" : '<div class="scope-tree-guide' + (isLast ? " leaf" : "") + '"></div>') +
    '<div class="scope-tree-row lv-' + r.level.toLowerCase() + '">' +
    '<div class="scope-tree-main">' + _scopeLevelBadge(r.level) +
    '<span class="scope-tree-name">' + esc(path) + "</span>" +
    '<span class="scope-tree-chips">' + chips + "</span></div>" +
    '<div class="scope-tree-actions">' +
    '<button class="btn btn-secondary btn-sm" onclick="openScopeModuleEditor(decodeURIComponent(\'' + editArgs + '\'))">' + esc(t("node_edit")) + "</button>" +
    '<button class="btn btn-danger btn-sm" onclick="deleteScopeModule(' + delArgs + ')">' + esc(t("scope_delete")) + "</button>" +
    "</div></div></div>"
  );
}

function renderScopeModuleList(topo) {
  topo = topo || (_scopeData && _scopeData.topology) || {};
  var container = document.getElementById("scopeModuleListBody");
  if (!container) return 0;
  var platforms = topo.platforms || {};
  var bots = topo.bots || {};
  var sessions = topo.sessions || {};
  var total = 0;
  var html = [];
  Object.keys(platforms).sort().forEach(function (p) {
    total++;
    html.push(_scopeModuleNodeHtml({ level: "P", platform: p, cfg: platforms[p] }, false));
    var children = [];
    Object.keys(bots[p] || {}).sort().forEach(function (b) {
      children.push({ level: "B", platform: p, bot: b, cfg: bots[p][b] });
    });
    Object.keys(sessions[p] || {}).sort().forEach(function (s) {
      children.push({ level: "S", platform: p, session: s, cfg: sessions[p][s] });
    });
    children.forEach(function (child, i) {
      total++;
      html.push(_scopeModuleNodeHtml(child, i === children.length - 1));
    });
  });
  var countEl = document.getElementById("scopeModuleCount");
  if (countEl) countEl.textContent = total;
  if (!total) {
    container.innerHTML = renderUxEmpty(
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
      "scope_no_rules"
    );
    return 0;
  }
  container.innerHTML = '<div class="scope-tree">' + html.join("") + "</div>";
  return total;
}

function renderScopeIdentityList(topo) {
  topo = topo || (_scopeData && _scopeData.topology) || {};
  var container = document.getElementById("scopeIdentityListBody");
  if (!container) return 0;
  var identity = topo.identity || {};
  var buckets = [
    ["adapters", "A", "scope_level_adapter"],
    ["bots", "B", "scope_level_bot"],
    ["sessions", "S", "scope_level_session"],
    ["users", "U", "scope_level_user"],
  ];
  var rows = [];
  buckets.forEach(function (pair) {
    var bucket = identity[pair[0]] || {};
    Object.keys(bucket).sort().forEach(function (p) {
      var sub = bucket[p];
      if (pair[0] === "adapters") {
        rows.push({ bucket: pair[0], level: pair[1], labelKey: pair[2], platform: p, cfg: sub });
      } else {
        Object.keys(sub || {}).sort().forEach(function (k) {
          rows.push({ bucket: pair[0], level: pair[1], labelKey: pair[2], platform: p, key: k, cfg: sub[k] });
        });
      }
    });
  });
  var countEl = document.getElementById("scopeIdentityCount");
  if (countEl) countEl.textContent = rows.length;
  if (!rows.length) {
    container.innerHTML = renderUxEmpty(
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      "scope_no_rules"
    );
    return 0;
  }
  container.innerHTML = '<div class="scope-tree">' + rows
    .map(function (r) {
      var path = r.platform + (r.key ? " / " + r.key : "");
      var isDeny = r.cfg && r.cfg.deny;
      var chips = isDeny
        ? '<span class="scope-entry-chip deny">deny</span>'
        : '<span class="scope-entry-chip">allow</span>';
      var args =
        "'" + _jsq(r.bucket) + "','" + _jsq(r.platform) + "','" + _jsq(r.key || "") + "'";
      return (
        '<div class="scope-tree-node">' +
        '<div class="scope-tree-row lv-' + r.level.toLowerCase() + '">' +
        '<div class="scope-tree-main">' + _scopeLevelBadge(r.level) +
        '<span class="scope-tree-name">' + esc(path) + "</span>" +
        '<span class="scope-tree-chips">' + chips + "</span></div>" +
        '<div class="scope-tree-actions">' +
        '<button class="btn btn-danger btn-sm" onclick="deleteScopeIdentity(' + args + ')">' + esc(t("scope_delete")) + "</button>" +
        "</div></div></div>"
      );
    })
    .join("") + "</div>";
  return rows.length;
}

function renderScopeActionList(topo) {
  topo = topo || (_scopeData && _scopeData.topology) || {};
  var container = document.getElementById("scopeActionListBody");
  if (!container) return 0;
  var actions = topo.actions || {};
  var rows = [];
  Object.keys(actions).sort().forEach(function (m) {
    Object.keys(actions[m] || {}).sort().forEach(function (a) {
      rows.push({ module: m, action: a, rule: actions[m][a] });
    });
  });
  var countEl = document.getElementById("scopeActionCount");
  if (countEl) countEl.textContent = rows.length;
  if (!rows.length) {
    container.innerHTML = renderUxEmpty(
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
      "scope_no_rules"
    );
    return 0;
  }
  container.innerHTML = '<div class="scope-tree">' + rows
    .map(function (r) {
      var rule = r.rule || {};
      var chips = "";
      if (rule.deny === true) {
        chips += '<span class="scope-entry-chip deny">deny *</span>';
      } else if (Array.isArray(rule.deny) && rule.deny.length) {
        chips += _scopeEntryChips(rule.deny, "deny");
      }
      if (Array.isArray(rule.allow) && rule.allow.length) {
        chips += (chips ? " " : "") + _scopeEntryChips(rule.allow, "");
      }
      if (!chips) chips = '<span class="scope-inherit">' + esc(t("scope_no_rules")) + "</span>";
      var args = "'" + _jsq(r.module) + "','" + _jsq(r.action) + "'";
      return (
        '<div class="scope-tree-node">' +
        '<div class="scope-tree-row">' +
        '<div class="scope-tree-main"><span class="scope-act-mod">' + esc(r.module) + "</span>" +
        '<span class="scope-act-type">' + esc(r.action) + "</span>" +
        '<span class="scope-tree-chips">' + chips + "</span></div>" +
        '<div class="scope-tree-actions">' +
        '<button class="btn btn-danger btn-sm" onclick="deleteScopeAction(' + args + ')">' + esc(t("scope_delete")) + "</button>" +
        "</div></div></div>"
      );
    })
    .join("") + "</div>";
  return rows.length;
}

function renderScopeRuntimeList() {
  var container = document.getElementById("scopeRuntimeListBody");
  if (!container) return;
  var bindings = (_scopeData && _scopeData.runtime_bindings) || [];
  var countEl = document.getElementById("scopeRuntimeCount");
  if (countEl) countEl.textContent = bindings.length;
  var owners = {};
  bindings.forEach(function (b) {
    var o = b.owner || "-";
    owners[o] = (owners[o] || 0) + 1;
  });
  var html = "";
  if (bindings.length) {
    html += '<div style="margin-bottom:10px;display:flex;gap:6px;flex-wrap:wrap">';
    Object.keys(owners).forEach(function (o) {
      html +=
        '<button class="btn btn-secondary btn-sm" onclick="cleanupScopeRuntime(\'' +
        _jsq(o) +
        '\')">' + esc(t("scope_cleanup")) + ": " + esc(o) + " (" + owners[o] + ")</button>";
    });
    html += "</div>";
  }
  if (!bindings.length) {
    html += renderUxEmpty(
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
      "scope_no_runtime"
    );
  } else {
    html += bindings
      .map(function (b) {
        var preview = "";
        try {
          preview = JSON.stringify(b.value);
        } catch (e) {
          preview = String(b.value);
        }
        if (preview.length > 120) preview = preview.slice(0, 120) + "…";
        return (
          '<div class="scope-row"><div class="scope-row-main"><span class="scope-row-path">' +
          esc(b.path) +
          '</span>' +
          '<span class="scope-owner-chip">📦 ' + esc(b.owner || "-") + "</span>" +
          '<span class="scope-row-sub">' + esc(preview) + "</span></div></div>"
        );
      })
      .join("");
  }
  container.innerHTML = html;
}

function _ensureScopeMultiselects() {
  if (_scopeMsWhite && _scopeMsBlock) return;
  _scopeMsWhite = EP.createMultiSelect({
    host: document.getElementById("scopeMsWhitelistHost"),
    items: [],
    selected: new Set(),
    placeholder: t("scope_ms_modules_ph"),
    searchPlaceholder: t("scope_ms_modules_ph"),
    selectAll: t("select_all"),
    clear: t("clear_all"),
    emptyText: t("no_matches"),
    countLabel: t("ep_selected"),
    onChange: function () {},
  });
  _scopeMsBlock = EP.createMultiSelect({
    host: document.getElementById("scopeMsBlocklistHost"),
    items: [],
    selected: new Set(),
    placeholder: t("scope_ms_modules_ph"),
    searchPlaceholder: t("scope_ms_modules_ph"),
    selectAll: t("select_all"),
    clear: t("clear_all"),
    emptyText: t("no_matches"),
    countLabel: t("ep_selected"),
    onChange: function () {},
  });
}

function _renderScopeCrumbs(platform, bot, session) {
  var el = document.getElementById("scopeModuleCrumbs");
  if (!el) return;
  function part(level, value, anyText) {
    return (
      '<span style="display:inline-flex;align-items:center;gap:4px">' +
      _scopeLevelBadge(level) +
      '<span class="' + (value ? "scope-tree-name" : "scope-inherit") + '">' +
      esc(value || anyText) +
      "</span></span>"
    );
  }
  el.innerHTML =
    part("P", platform, platform || t("scope_crumbs_any")) +
    '<span class="scope-crumbs-sep">›</span>' +
    part("B", bot, t("scope_all_bots")) +
    '<span class="scope-crumbs-sep">›</span>' +
    part("S", session, t("scope_crumbs_any"));
}

function renderScopeModuleCrumbsFromEditor() {
  _renderScopeCrumbs(
    document.getElementById("scopeModulePlatform").value,
    document.getElementById("scopeModuleBot").value,
    document.getElementById("scopeModuleSession").value.trim()
  );
}

function openScopeModuleEditor(target) {
  if (typeof target === "string") {
    try {
      target = JSON.parse(target);
    } catch (e) {
      target = null;
    }
  }
  _scopeEditorTarget = target || null;
  var card = document.getElementById("scopeModuleEditorCard");
  if (!card) return;
  card.style.display = "";
  var titleEl = document.getElementById("scopeModuleEditorTitle");
  if (titleEl) titleEl.textContent = target ? t("scope_editor_edit") : t("scope_editor_new");

  var platform = target ? target.platform || "" : "";
  var bot = target ? target.bot || "" : "";
  var session = target ? target.session || "" : "";
  var platformSel = document.getElementById("scopeModulePlatform");
  if (platform && platformSel && !platformSel.querySelector('option[value="' + CSS.escape(platform) + '"]')) {
    var opt = document.createElement("option");
    opt.value = platform;
    opt.textContent = platform;
    platformSel.appendChild(opt);
  }
  if (platformSel) platformSel.value = platform;
  onScopePlatformChange("module");
  var botSel = document.getElementById("scopeModuleBot");
  if (bot && botSel && !botSel.querySelector('option[value="' + CSS.escape(bot) + '"]')) {
    var opt2 = document.createElement("option");
    opt2.value = bot;
    opt2.textContent = bot;
    botSel.appendChild(opt2);
  }
  if (botSel) botSel.value = bot;
  var sessionInput = document.getElementById("scopeModuleSession");
  if (sessionInput) sessionInput.value = session;

  // 读取现有绑定（会话 > Bot > 平台）
  var existing = {};
  if (_scopeData && _scopeData.topology) {
    var topo = _scopeData.topology;
    var bucket =
      session && topo.sessions && topo.sessions[platform]
        ? (topo.sessions[platform] || {})[session]
        : bot && topo.bots && topo.bots[platform]
          ? (topo.bots[platform] || {})[bot]
          : topo.platforms
            ? topo.platforms[platform]
            : null;
    if (bucket && typeof bucket === "object") existing = bucket;
  }
  var white = (existing.modules || []).map(String);
  var block = (existing.blocked || []).map(String);
  var mergeEl = document.getElementById("scopeModuleMerge");
  if (mergeEl) mergeEl.checked = !!existing.merge;

  _ensureScopeMultiselects();
  var globExtra = white.concat(block).filter(function (e) {
    return !_scopeRegisteredModules.some(function (m) {
      return m.toLowerCase() === e.toLowerCase();
    });
  });
  var allModules = _scopeRegisteredModules.concat(globExtra).sort();
  var whiteSet = _scopeMsWhite.getSelected();
  var blockSet = _scopeMsBlock.getSelected();
  whiteSet.clear();
  white.forEach(function (w) { whiteSet.add(w); });
  blockSet.clear();
  block.forEach(function (b) { blockSet.add(b); });
  _scopeMsWhite.setItems(allModules);
  _scopeMsBlock.setItems(allModules);
  renderScopeModuleCrumbsFromEditor();
}

function closeScopeModuleEditor() {
  var card = document.getElementById("scopeModuleEditorCard");
  if (card) card.style.display = "none";
  _scopeEditorTarget = null;
}

async function saveScopeModule() {
  if (!_scopeMsWhite || !_scopeMsBlock) return;
  var platform = document.getElementById("scopeModulePlatform").value;
  if (!platform) {
    toast(t("action_failed"), "er");
    return;
  }
  var bot = document.getElementById("scopeModuleBot").value;
  var session = document.getElementById("scopeModuleSession").value.trim();
  var modules = Array.from(_scopeMsWhite.getSelected());
  var blocked = Array.from(_scopeMsBlock.getSelected());
  var d = await api("/api/scope/module", {
    method: "POST",
    body: JSON.stringify({
      platform: platform,
      bot_id: bot || null,
      session_id: session || null,
      modules: modules,
      blocked: blocked,
      merge: document.getElementById("scopeModuleMerge").checked,
    }),
  });
  if (d && d.success) {
    toast(t("scope_saved"), "ok");
    closeScopeModuleEditor();
    loadScope();
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

async function deleteScopeModule(platform, bot, session) {
  var d = await api("/api/scope/module", {
    method: "DELETE",
    body: JSON.stringify({
      platform: platform,
      bot_id: bot || null,
      session_id: session || null,
    }),
  });
  if (d && d.success) {
    toast(t("scope_saved"), "ok");
    loadScope();
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

function setScopeIdnPolicy(policy) {
  _scopeIdnPolicy = policy === "deny" ? "deny" : "allow";
  var wrap = document.getElementById("scopeIdnPolicy");
  if (!wrap) return;
  wrap.querySelectorAll(".scope-policy-btn").forEach(function (b) {
    b.classList.toggle("active", b.getAttribute("data-policy") === _scopeIdnPolicy);
  });
}

function toggleScopeIdentityEditor() {
  var card = document.getElementById("scopeIdentityEditorCard");
  if (!card) return;
  var show = card.style.display === "none";
  card.style.display = show ? "" : "none";
  if (!show) return;
  setScopeIdnPolicy("allow");
  onScopeIdnLevelChange();
}

async function saveScopeIdentity() {
  var platform = document.getElementById("scopeIdnPlatform").value;
  if (!platform) {
    toast(t("action_failed"), "er");
    return;
  }
  var level = document.getElementById("scopeIdnLevel").value;
  var bot = document.getElementById("scopeIdnBot").value;
  var target = document.getElementById("scopeIdnTarget").value.trim();
  var policy = _scopeIdnPolicy;
  var body = {
    platform: platform,
    bot_id: level === "adapter" ? null : bot || null,
    session_id: level === "session" ? target || null : null,
    user_id: level === "user" ? target || null : null,
    allow: policy === "allow",
    deny: policy === "deny",
  };
  var d = await api("/api/scope/identity", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (d && d.success) {
    toast(t("scope_saved"), "ok");
    var card = document.getElementById("scopeIdentityEditorCard");
    if (card) card.style.display = "none";
    loadScope();
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

async function deleteScopeIdentity(bucket, platform, key) {
  var body = { platform: platform };
  if (bucket === "bots") body.bot_id = key;
  else if (bucket === "sessions") body.session_id = key;
  else if (bucket === "users") body.user_id = key;
  var d = await api("/api/scope/identity", {
    method: "DELETE",
    body: JSON.stringify(body),
  });
  if (d && d.success) {
    toast(t("scope_saved"), "ok");
    loadScope();
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

function toggleScopeActionEditor() {
  var card = document.getElementById("scopeActionEditorCard");
  if (!card) return;
  card.style.display = card.style.display === "none" ? "" : "none";
}

async function saveScopeAction() {
  var moduleName = document.getElementById("scopeActionModule").value;
  var action = document.getElementById("scopeActionType").value;
  if (!moduleName) {
    toast(t("action_failed"), "er");
    return;
  }
  var denyAll = document.getElementById("scopeActionDenyAll").checked;
  var allow = document.getElementById("scopeActionAllow").value
    .split(",")
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
  var deny = document.getElementById("scopeActionDeny").value
    .split(",")
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
  var body = {
    module: moduleName,
    action: action,
    allow: denyAll ? null : allow,
    deny: denyAll ? true : deny.length ? deny : null,
  };
  var d = await api("/api/scope/action", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (d && d.success) {
    toast(t("scope_saved"), "ok");
    loadScope();
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

async function deleteScopeAction(moduleName, action) {
  var d = await api("/api/scope/action", {
    method: "DELETE",
    body: JSON.stringify({ module: moduleName, action: action }),
  });
  if (d && d.success) {
    toast(t("scope_saved"), "ok");
    loadScope();
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

async function cleanupScopeRuntime(owner) {
  var d = await api("/api/scope/runtime/cleanup", {
    method: "POST",
    body: JSON.stringify({ owner: owner }),
  });
  if (d && d.success) {
    toast(t("scope_saved"), "ok");
    loadScope();
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

async function onScopeDefaultAllowChange(checked) {
  var d = await api("/api/scope/settings", {
    method: "PUT",
    body: JSON.stringify({ default_allow: checked }),
  });
  if (d && d.success) {
    toast(t("scope_saved"), "ok");
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

async function resetScopeStats() {
  var d = await api("/api/scope/stats/reset", { method: "POST" });
  if (d && d.success) {
    loadScope();
  }
}

var _scopeTransferData = null;
var _scopeImportParsed = null;
var _scopeImportMode = "merge";

function openScopeTransfer() {
  var overlay = document.getElementById("scopeTransferOverlay");
  if (overlay) overlay.style.display = "flex";
  switchScopeTransfer("export", document.querySelector('#scopeTransferTabs [data-tab="export"]'));
  _loadScopeTransferData();
}

function closeScopeTransfer() {
  var overlay = document.getElementById("scopeTransferOverlay");
  if (overlay) overlay.style.display = "none";
}

function switchScopeTransfer(tab, btn) {
  var bar = document.getElementById("scopeTransferTabs");
  if (bar) {
    bar.querySelectorAll(".view-btn").forEach(function (b) {
      b.classList.remove("active");
    });
  }
  if (btn) btn.classList.add("active");
  var ex = document.getElementById("scopeTransferExport");
  var im = document.getElementById("scopeTransferImport");
  if (ex) ex.style.display = tab === "export" ? "" : "none";
  if (im) im.style.display = tab === "import" ? "" : "none";
}

async function _loadScopeTransferData() {
  var d = await api("/api/scope/export");
  _scopeTransferData = d && d.config ? d : null;
  _renderScopeExportDims();
}

function _scopeDimCounts(config) {
  config = config || {};
  function countSub(sub) {
    var n = 0;
    Object.keys(sub || {}).forEach(function (k) {
      n += Object.keys(sub[k] || {}).length;
    });
    return n;
  }
  return {
    platforms: Object.keys(config.platforms || {}).length,
    bots: countSub(config.bots),
    sessions: countSub(config.sessions),
    identity:
      countSub((config.identity || {}).adapters) +
      countSub((config.identity || {}).bots) +
      countSub((config.identity || {}).sessions) +
      countSub((config.identity || {}).users),
    actions: countSub(config.actions),
  };
}

function _scopeDimRowHtml(dim, checked, count) {
  var labels = {
    default_allow: t("scope_dim_default"),
    platforms: t("scope_dim_platforms"),
    bots: t("scope_dim_bots"),
    sessions: t("scope_dim_sessions"),
    identity: t("scope_nav_identity"),
    actions: t("scope_nav_action"),
  };
  return (
    '<label class="scope-dim-row">' +
    '<input type="checkbox" data-dim="' + dim + '"' + (checked ? " checked" : "") + "/>" +
    '<span class="scope-dim-label">' + esc(labels[dim] || dim) + "</span>" +
    '<span class="chip chip-sc">' + esc(String(count)) + "</span>" +
    "</label>"
  );
}

function _renderScopeExportDims() {
  var el = document.getElementById("scopeExportDims");
  if (!el) return;
  if (!_scopeTransferData) {
    el.innerHTML = '<div class="scope-empty">…</div>';
    return;
  }
  var c = _scopeTransferData.config || {};
  var counts = _scopeDimCounts(c);
  el.innerHTML =
    _scopeDimRowHtml("platforms", counts.platforms > 0, counts.platforms) +
    _scopeDimRowHtml("bots", counts.bots > 0, counts.bots) +
    _scopeDimRowHtml("sessions", counts.sessions > 0, counts.sessions) +
    _scopeDimRowHtml("identity", counts.identity > 0, counts.identity) +
    _scopeDimRowHtml("actions", counts.actions > 0, counts.actions) +
    _scopeDimRowHtml("default_allow", true, _scopeTransferData.default_allow ? "ON" : "OFF");
}

function _scopeCheckedDims(containerId) {
  var checked = {};
  document.querySelectorAll("#" + containerId + ' input[data-dim]').forEach(function (cb) {
    checked[cb.getAttribute("data-dim")] = cb.checked;
  });
  return checked;
}

function _scopeFilterConfig(src, checked) {
  var config = {};
  ["platforms", "bots", "sessions", "actions"].forEach(function (k) {
    if (checked[k]) config[k] = src[k] || {};
  });
  if (checked.identity) {
    var idn = src.identity || {};
    config.identity = {};
    ["adapters", "bots", "sessions", "users"].forEach(function (k) {
      config.identity[k] = idn[k] || {};
    });
  }
  return config;
}

function doScopeExport() {
  if (!_scopeTransferData) {
    toast(t("action_failed"), "er");
    return;
  }
  var checked = _scopeCheckedDims("scopeExportDims");
  if (!Object.keys(checked).some(function (k) { return checked[k]; })) {
    toast(t("scope_dim_none_selected"), "er");
    return;
  }
  var payload = {
    type: "erispulse_scope_config",
    version: 1,
    exported_at: new Date().toISOString().slice(0, 19),
    config: _scopeFilterConfig(_scopeTransferData.config || {}, checked),
  };
  if (checked.default_allow && typeof _scopeTransferData.default_allow === "boolean") {
    payload.default_allow = _scopeTransferData.default_allow;
  }
  var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "erispulse-scope-" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
  toast(t("scope_exported"), "ok");
}

function setScopeImportMode(mode) {
  _scopeImportMode = mode === "replace" ? "replace" : "merge";
  var wrap = document.getElementById("scopeTransferImport");
  if (wrap) {
    wrap.querySelectorAll(".scope-policy-btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-mode") === _scopeImportMode);
    });
  }
  var warn = document.getElementById("scopeReplaceWarn");
  if (warn) warn.style.display = _scopeImportMode === "replace" ? "" : "none";
}

async function onScopeImportFilePicked(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  try {
    var parsed = JSON.parse(await file.text());
    var cfg = parsed.config || parsed;
    if (!cfg || typeof cfg !== "object") throw new Error("bad config");
    _scopeImportParsed = parsed;
    var zone = document.getElementById("scopeFileZone");
    if (zone) zone.classList.add("loaded");
    var summary = document.getElementById("scopeFileSummary");
    if (summary) summary.textContent = "📁 " + file.name;
    var counts = _scopeDimCounts(cfg);
    var el = document.getElementById("scopeImportDims");
    if (el) {
      el.innerHTML =
        _scopeDimRowHtml("platforms", counts.platforms > 0, counts.platforms) +
        _scopeDimRowHtml("bots", counts.bots > 0, counts.bots) +
        _scopeDimRowHtml("sessions", counts.sessions > 0, counts.sessions) +
        _scopeDimRowHtml("identity", counts.identity > 0, counts.identity) +
        _scopeDimRowHtml("actions", counts.actions > 0, counts.actions) +
        (typeof parsed.default_allow === "boolean"
          ? _scopeDimRowHtml("default_allow", false, parsed.default_allow ? "ON" : "OFF")
          : "");
    }
    var parsedBox = document.getElementById("scopeImportParsed");
    if (parsedBox) parsedBox.style.display = "";
    setScopeImportMode("merge");
  } catch (e) {
    _scopeImportParsed = null;
    toast(t("scope_file_invalid"), "er");
  }
}

async function doScopeImport() {
  if (!_scopeImportParsed) {
    toast(t("scope_file_invalid"), "er");
    return;
  }
  var checked = _scopeCheckedDims("scopeImportDims");
  if (!Object.keys(checked).some(function (k) { return checked[k]; })) {
    toast(t("scope_dim_none_selected"), "er");
    return;
  }
  var cfg = _scopeImportParsed.config || _scopeImportParsed;
  var body = {
    config: _scopeFilterConfig(cfg, checked),
    mode: _scopeImportMode,
  };
  if (checked.default_allow && typeof _scopeImportParsed.default_allow === "boolean") {
    body.default_allow = _scopeImportParsed.default_allow;
  }
  var d = await api("/api/scope/import", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (d && d.success) {
    var c = d.imported || {};
    toast(
      t("scope_imported") +
        " (P:" + (c.platforms || 0) + " B:" + (c.bots || 0) +
        " S:" + (c.sessions || 0) + " I:" + (c.identity || 0) +
        " A:" + (c.actions || 0) + ")",
      "ok"
    );
    closeScopeTransfer();
    loadScope();
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

function onScopeTestKindChange() {
  var kind = document.getElementById("scopeTestKind").value;
  var map = {
    module: ["scopeTestPlatformField", "scopeTestBotField", "scopeTestSessionField", "scopeTestModuleField"],
    identity: ["scopeTestPlatformField", "scopeTestBotField", "scopeTestSessionField", "scopeTestUserField"],
    action: ["scopeTestModuleField", "scopeTestActionField", "scopeTestNameField"],
  };
  ["scopeTestPlatformField", "scopeTestBotField", "scopeTestSessionField", "scopeTestUserField", "scopeTestModuleField", "scopeTestActionField", "scopeTestNameField"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.style.display = (map[kind] || []).indexOf(id) >= 0 ? "" : "none";
  });
}

async function runScopeTest() {
  var kind = document.getElementById("scopeTestKind").value;
  var body = { kind: kind };
  if (kind === "module") {
    body.platform = document.getElementById("scopeTestPlatform").value;
    body.bot_id = document.getElementById("scopeTestBot").value;
    body.session_id = document.getElementById("scopeTestSession").value.trim();
    body.module = document.getElementById("scopeTestModule").value;
  } else if (kind === "identity") {
    body.platform = document.getElementById("scopeTestPlatform").value;
    body.bot_id = document.getElementById("scopeTestBot").value;
    body.session_id = document.getElementById("scopeTestSession").value.trim();
    body.user_id = document.getElementById("scopeTestUser").value.trim();
  } else {
    body.module = document.getElementById("scopeTestModule").value;
    body.action = document.getElementById("scopeTestAction").value;
    body.name = document.getElementById("scopeTestName").value.trim();
  }
  var resultEl = document.getElementById("scopeTestResult");
  if (resultEl) resultEl.innerHTML = '<span style="color:var(--tx-t)">…</span>';
  var d = await api("/api/scope/test", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!resultEl) return;
  if (d && typeof d.allowed !== "undefined") {
    resultEl.innerHTML = d.allowed
      ? '<span class="ok">✓ ' + esc(t("scope_test_allowed")) + "</span>"
      : '<span class="bad">✗ ' + esc(t("scope_test_denied")) + "</span>";
  } else {
    resultEl.innerHTML = '<span class="bad">' + esc(d?.error || t("action_failed")) + "</span>";
  }
}

function openCmdEdit(name) {
  if (!_cmdData) return;
  const cmd = (_cmdData.commands || []).find((c) => c.name === name);
  if (!cmd) return;
  _editCmdName = name;
  _editAliases = [...(cmd.custom_aliases || [])];
  _editAllowed = [...(cmd.allowed_platforms || [])];
  _editBlocked = [...(cmd.blocked_platforms || [])];
  _editAclAllow = [...((cmd.acl && cmd.acl.allow) || [])];
  _editAclDeny = [...((cmd.acl && cmd.acl.deny) || [])];
  document.getElementById("cmdEditTitle").textContent = "/" + name;
  document.getElementById("cmdEnabled").checked = cmd.enabled !== false;
  document.getElementById("cmdTransformTo").value = cmd.transform_to || "";
  var params = cmd.params || {};
  document.getElementById("cmdOverrideMaster").checked = !!params.master;
  document.getElementById("cmdOverrideHidden").checked = !!params.hidden;
  var ownerBadge = document.getElementById("cmdOwnerBadge");
  if (ownerBadge) {
    if (cmd.owner) {
      ownerBadge.style.display = "";
      ownerBadge.textContent = "📦 " + (t("cmd_owner") + ": " + cmd.owner);
      ownerBadge.title = t("cmd_owner") + ": " + cmd.owner;
      ownerBadge.onclick = function () {
        closeCmdEdit();
        goToModuleConfig();
        setTimeout(function () {
          try {
            if (typeof selectModuleConfig === "function") selectModuleConfig(cmd.owner);
          } catch (e) {}
        }, 600);
      };
    } else {
      ownerBadge.style.display = "none";
    }
  }
  renderCmdAclPlatformOptions();
  renderCmdAclTags();
  let origHtml = "";
  if ((cmd.original_aliases || []).length) {
    origHtml =
      '<span style="color:var(--tx-t);font-size:12px">' +
      t("cmd_original_aliases_label") +
      ": " +
      cmd.original_aliases.map((a) => esc(a)).join(", ") +
      "</span>";
  }
  if (cmd.help)
    origHtml +=
      '<span style="margin-left:12px;color:var(--tx-s);font-size:12px">' +
      t("cmd_help") +
      ": " +
      esc(cmd.help) +
      "</span>";
  if (cmd.group)
    origHtml +=
      '<span style="margin-left:12px;color:var(--tx-s);font-size:12px">' +
      t("cmd_group") +
      ": " +
      esc(cmd.group) +
      "</span>";
  document.getElementById("cmdOriginalAliases").innerHTML = origHtml;
  renderCmdAliasTags();
  renderCmdPlatformToggles();
  var dl = document.getElementById("cmdTransformOptions");
  if (dl) {
    dl.innerHTML = (_cmdData.commands || [])
      .filter(function (c) {
        return c.name !== name;
      })
      .map(function (c) {
        return '<option value="' + esc(c.name) + '"></option>';
      })
      .join("");
  }
  document.getElementById("cmdAliasInput").value = "";
  document.getElementById("cmdAclAllowInput").value = "";
  document.getElementById("cmdAclDenyInput").value = "";
  document.getElementById("cmdEditOverlay").style.display = "flex";
}

function renderCmdAclPlatformOptions() {
  var platforms = (_cmdData && _cmdData.platforms) || _cmdPlatforms || [];
  ["cmdAclAllowPlatform", "cmdAclDenyPlatform"].forEach(function (id) {
    var sel = document.getElementById(id);
    if (!sel) return;
    var prev = sel.value;
    sel.innerHTML =
      platforms
        .map(function (p) {
          return '<option value="' + esc(p) + '">' + esc(p) + "</option>";
        })
        .join("") + '<option value="">*</option>';
    if (prev && platforms.indexOf(prev) >= 0) sel.value = prev;
  });
}

function renderCmdAclTags() {
  renderCmdAclTagList("cmdAclAllowTags", _editAclAllow, "allow");
  renderCmdAclTagList("cmdAclDenyTags", _editAclDeny, "deny");
}

function renderCmdAclTagList(containerId, list, kind) {
  var container = document.getElementById(containerId);
  if (!container) return;
  if (!list.length) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = list
    .map(function (tag, i) {
      var cls =
        kind === "allow" ? "scope-entry-chip" : "scope-entry-chip deny";
      return (
        '<span class="' + cls + '" style="cursor:pointer" onclick="removeCmdAclTag(\'' +
        kind +
        "'," +
        i +
        ')" title="' +
        t("scope_delete") +
        '">' +
        esc(tag) +
        " &times;</span>"
      );
    })
    .join("");
}

function addCmdAclTag(kind) {
  var platformId = kind === "allow" ? "cmdAclAllowPlatform" : "cmdAclDenyPlatform";
  var inputId = kind === "allow" ? "cmdAclAllowInput" : "cmdAclDenyInput";
  var platform = document.getElementById(platformId).value || "";
  var uid = document.getElementById(inputId).value.trim();
  if (!uid) return;
  var tag = uid === "*" ? "*" : (platform ? platform + ":" + uid : uid);
  var list = kind === "allow" ? _editAclAllow : _editAclDeny;
  if (list.indexOf(tag) === -1) list.push(tag);
  document.getElementById(inputId).value = "";
  renderCmdAclTags();
}

function removeCmdAclTag(kind, index) {
  if (kind === "allow") _editAclAllow.splice(index, 1);
  else _editAclDeny.splice(index, 1);
  renderCmdAclTags();
}

function renderCmdAliasTags() {
  const container = document.getElementById("cmdAliasTags");
  if (!_editAliases.length) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = _editAliases
    .map(
      (a, i) =>
        '<span class="cmd-tag">' +
        esc(a) +
        '<span class="cmd-tag-remove" onclick="removeCmdAlias(' +
        i +
        ')">&times;</span></span>',
    )
    .join("");
}

function addCmdAlias() {
  const input = document.getElementById("cmdAliasInput");
  const val = input.value.trim();
  if (!val || _editAliases.includes(val)) {
    input.value = "";
    return;
  }
  _editAliases.push(val);
  input.value = "";
  renderCmdAliasTags();
}

function removeCmdAlias(index) {
  _editAliases.splice(index, 1);
  renderCmdAliasTags();
}

function renderCmdPlatformToggles() {
  const allowedContainer = document.getElementById("cmdAllowedPlatforms");
  const blockedContainer = document.getElementById("cmdBlockedPlatforms");
  if (!_cmdPlatforms.length) {
    allowedContainer.innerHTML =
      '<span style="font-size:12px;color:var(--tx-t)">' +
      t("no_adapters") +
      "</span>";
    blockedContainer.innerHTML =
      '<span style="font-size:12px;color:var(--tx-t)">' +
      t("no_adapters") +
      "</span>";
    return;
  }
  allowedContainer.innerHTML = _cmdPlatforms
    .map((p) => {
      const active = _editAllowed.includes(p);
      return (
        '<span class="cmd-platform-toggle' +
        (active ? " active" : "") +
        "\" onclick=\"toggleCmdPlatform('allowed','" +
        esc(p) +
        "')\">" +
        esc(p) +
        "</span>"
      );
    })
    .join("");
  blockedContainer.innerHTML = _cmdPlatforms
    .map((p) => {
      const active = _editBlocked.includes(p);
      return (
        '<span class="cmd-platform-toggle' +
        (active ? " blocked" : "") +
        "\" onclick=\"toggleCmdPlatform('blocked','" +
        esc(p) +
        "')\">" +
        esc(p) +
        "</span>"
      );
    })
    .join("");
}

function toggleCmdPlatform(type, platform) {
  if (type === "allowed") {
    const idx = _editAllowed.indexOf(platform);
    if (idx >= 0) _editAllowed.splice(idx, 1);
    else _editAllowed.push(platform);
  } else {
    const idx = _editBlocked.indexOf(platform);
    if (idx >= 0) _editBlocked.splice(idx, 1);
    else _editBlocked.push(platform);
  }
  renderCmdPlatformToggles();
}

function closeCmdEdit() {
  document.getElementById("cmdEditOverlay").style.display = "none";
}

async function saveCmdEdit() {
  const body = {
    enabled: document.getElementById("cmdEnabled").checked,
    aliases: _editAliases,
    allowed_platforms: _editAllowed,
    blocked_platforms: _editBlocked,
    transform_to:
      document.getElementById("cmdTransformTo").value.trim() || null,
    acl: { allow: _editAclAllow, deny: _editAclDeny },
    params: {
      master: document.getElementById("cmdOverrideMaster").checked,
      hidden: document.getElementById("cmdOverrideHidden").checked,
    },
  };
  const d = await api("/api/commands/" + encodeURIComponent(_editCmdName), {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (d && d.success) {
    toast(t("cmd_save_success"), "ok");
    closeCmdEdit();
    loadCommands();
  } else {
    toast(d?.error || t("cmd_save_failed"), "er");
  }
}

(function () {
  applyTheme(getTheme());
  applyUiStyle(getUiStyle());
  applyOled(getOled());
  applyFont(getFont());
  applyI18n();
  applyCustomTheme();
  applyFullCustomTheme();
  applyAnimStyle(getAnimStyle());
  // 恢复保存的仪表盘标题
  var savedTitle = getSetting("dash_title", "");
  if (savedTitle) {
    var titleEl = document.getElementById("appTitle");
    if (titleEl) titleEl.textContent = savedTitle;
    document.title = savedTitle;
  }
  updateNodeSelectorUI();
  const collapsedSetting = localStorage.getItem("ep_sidebar_collapsed");
  // 默认收起侧边栏（首次使用或无设置时）
  const isCollapsed =
    collapsedSetting === null ? true : collapsedSetting === "true";
  if (isCollapsed && window.innerWidth > 768)
    document.getElementById("sidebar").classList.add("collapsed");
  updateNodeSelectorVisibility();
  restoreNavGroupStates();
  // 启动画面在首次显示登录或仪表盘时消失
  var splashEl = document.getElementById("splash");
  var _splashReady = false;
  var _splashDismissed = false;
  setTimeout(function () { _splashReady = true; if (_splashDismissed) dismissSplash(); }, 1750);
  function dismissSplash() {
    _splashDismissed = true;
    if (!_splashReady || !splashEl) return;
    splashEl.classList.add("hide");
    setTimeout(function () { if (splashEl) splashEl.remove(); }, 950);
  }
  const tk = localStorage.getItem(TK);
  if (tk) {
    fetch(API + "/api/auth/status", {
      headers: { Authorization: "Bearer " + tk },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d && d.authenticated) {
          authed = true;
          document.querySelector(".app").classList.add("authed");
          dismissSplash();
          // 先加载仪表盘主体，外观延迟加载（不阻塞访问）
          loadAll();
          wsConnect();
          restartRefreshTimer();
          loadClusterNodes();
          loadGlobalAppearance();
          applyDefaultPageOnLogin();
        } else {
          localStorage.removeItem(TK);
          dismissSplash();
          showLogin();
        }
      })
      .catch(() => {
        dismissSplash();
        showLogin();
      });
  } else {
    dismissSplash();
    showLogin();
  }
  initMirrorSelects();
  const dz = document.getElementById("uploadDropZone");
  if (dz) {
    dz.addEventListener("dragover", function (e) {
      e.preventDefault();
      this.classList.add("drag-over");
    });
    dz.addEventListener("dragleave", function (e) {
      this.classList.remove("drag-over");
    });
    dz.addEventListener("drop", function (e) {
      e.preventDefault();
      this.classList.remove("drag-over");
      if (e.dataTransfer.files[0]) processUploadFile(e.dataTransfer.files[0]);
    });
  }
})();

// ========== 集群管理 ==========

var _PAGE_CAPABILITY_MAP = {
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

function isCapabilitySupported(capId) {
  if (currentNode === "local") return true;
  var caps = nodeCapabilities[currentNode];
  if (!caps) return true;
  if (!caps[capId]) return true;
  return caps[capId].supported !== false;
}

function switchNode(nodeId) {
  if (nodeId === currentNode) return;
  currentNode = nodeId;
  allEvents = [];
  updateNodeSelectorUI();
  updateSidebarForNode();
  _clearModuleViews();
  wsConnect();
  loadModuleViews();
  var activePage = document.querySelector(".page.active");
  if (activePage) {
    var pageId = activePage.id.replace("p-", "");
    go(pageId, document.querySelector('.nav-item[data-page="' + pageId + '"]'));
  }
}

function updateSidebarForNode() {
  document.querySelectorAll(".nav-item[data-page]").forEach(function (el) {
    var page = el.getAttribute("data-page");
    var cap = _PAGE_CAPABILITY_MAP[page];
    if (!isCapabilitySupported(cap)) {
      el.classList.add("nav-disabled");
      el.title = t("unsupported_on_node");
    } else {
      el.classList.remove("nav-disabled");
      el.title = "";
    }
  });
  document
    .querySelectorAll(".nav-item[data-module-view]")
    .forEach(function (el) {
      if (!isCapabilitySupported("module_views")) {
        el.classList.add("nav-disabled");
      } else {
        el.classList.remove("nav-disabled");
      }
    });
}

function _clearModuleViews() {
  document
    .querySelectorAll(".nav-item[data-module-view]")
    .forEach(function (el) {
      el.remove();
    });
  document.querySelectorAll(".page[data-module-view]").forEach(function (el) {
    el.remove();
  });
  document.querySelectorAll(".module-view-style").forEach(function (el) {
    el.remove();
  });
  document.querySelectorAll(".module-view-script").forEach(function (el) {
    el.remove();
  });
  document
    .querySelectorAll(".nav-group.module-view-group")
    .forEach(function (el) {
      el.remove();
    });
  _moduleViewLoaders = {};
  _moduleViewsLoaded = false;
}

function toggleNodeDropdown() {
  var dd = document.getElementById("nodeDropdown");
  dd.classList.toggle("open");
}

function closeNodeDropdown() {
  document.getElementById("nodeDropdown").classList.remove("open");
}

document.addEventListener("click", function (e) {
  var sel = document.getElementById("nodeSelector");
  if (sel && !sel.contains(e.target)) closeNodeDropdown();
});

function updateNodeSelectorUI() {
  var label = document.getElementById("nodeSelectorLabel");
  var dot = document.getElementById("nodeDot");
  if (currentNode === "local") {
    label.textContent = t("node_local");
    dot.className = "node-dot node-dot-local";
  } else {
    var info = nodeRuntimeInfo[currentNode] || {};
    label.textContent = info.name || currentNode;
    dot.className =
      "node-dot " + (info.online ? "node-dot-online" : "node-dot-offline");
  }
}

async function loadClusterNodes() {
  var d = await api("/api/cluster/nodes");
  if (!d) return;
  if (d.nodes) {
    d.nodes.forEach(function (n) {
      nodeRuntimeInfo[n.id] = n;
      if (n.capabilities) {
        nodeCapabilities[n.id] = n.capabilities;
      }
    });
  }
  renderNodeDropdown(d.nodes || []);
  updateNodeSelectorVisibility();
}

function renderNodeDropdown(nodes) {
  var list = document.getElementById("nodeDropdownList");
  if (!list) return;
  var html = "";
  html +=
    '<div class="node-dropdown-item' +
    (currentNode === "local" ? " active" : "") +
    '" onclick="switchNode(\'local\'); closeNodeDropdown();">';
  html += '<span class="node-dot node-dot-local"></span>';
  html += "<span>" + esc(t("node_local")) + "</span>";
  html += "</div>";
  nodes.forEach(function (n) {
    var info = nodeRuntimeInfo[n.id] || {};
    var dotClass = info.online ? "node-dot-online" : "node-dot-offline";
    html +=
      '<div class="node-dropdown-item' +
      (currentNode === n.id ? " active" : "") +
      '" onclick="switchNode(\'' +
      esc(n.id) +
      "'); closeNodeDropdown();\">";
    html += '<span class="node-dot ' + dotClass + '"></span>';
    html +=
      '<span class="node-dropdown-label">' + esc(n.name || n.id) + "</span>";
    if (info.latency_ms >= 0) {
      html += '<span class="node-latency">' + info.latency_ms + "ms</span>";
    }
    html += "</div>";
  });
  list.innerHTML = html;
}

var _capKeys = [
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

function _clusterNodeCardHtml(n) {
  var info = nodeRuntimeInfo[n.id] || {};
  var online = info.online;
  var dotClass = online ? "node-dot-online" : "node-dot-offline";
  var caps = info.capabilities || {};
  var capKeys = _capKeys;
  var supportedCaps = [];
  var unsupportedCaps = [];
  capKeys.forEach(function (k) {
    var c = caps[k];
    if (c && c.supported) supportedCaps.push(k);
    else if (c && c.supported === false) unsupportedCaps.push(k);
  });

  var capsHtml = "";
  if (supportedCaps.length > 0 || unsupportedCaps.length > 0) {
    capsHtml += '<div class="cluster-card-caps">';
    supportedCaps.forEach(function (k) {
      capsHtml +=
        '<span class="cluster-cap-tag cap-supported" title="' +
        esc(t("cap_" + k + "_desc")) +
        '">' +
        esc(t("cap_" + k)) +
        "</span>";
    });
    unsupportedCaps.forEach(function (k) {
      capsHtml +=
        '<span class="cluster-cap-tag cap-unsupported" title="' +
        esc(t("cap_" + k + "_desc")) +
        '">' +
        esc(t("cap_" + k)) +
        "</span>";
    });
    capsHtml += "</div>";
  }

  var meta = "";
  if (info.latency_ms >= 0)
    meta += "<span>" + esc(t("latency")) + ": " + info.latency_ms + "ms</span>";
  if (info.dashboard_version)
    meta += "<span>v" + esc(info.dashboard_version) + "</span>";

  var cardId = "clusterCard-" + esc(n.id);
  var h = '<div class="cluster-node-card" id="' + cardId + '">';
  h += '<div class="cluster-card-header">';
  h +=
    '<div class="cluster-card-title"><span class="node-dot ' +
    dotClass +
    '"></span><span class="cluster-card-name">' +
    esc(n.name || n.id) +
    "</span>";
  h += online
    ? '<span class="cluster-badge badge-online">' +
      esc(t("node_online")) +
      "</span>"
    : '<span class="cluster-badge badge-offline">' +
      esc(t("node_offline")) +
      "</span>";
  h += "</div>";
  h += '<div class="cluster-node-actions">';
  h +=
    '<button class="btn-icon-sm" onclick="openClusterEditModal(\'' +
    esc(n.id) +
    '\')" title="' +
    esc(t("node_edit")) +
    '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';
  h +=
    '<button class="btn-icon-sm" onclick="pingClusterNode(\'' +
    esc(n.id) +
    '\')" title="' +
    esc(t("node_ping")) +
    '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></button>';
  h +=
    '<button class="btn-icon-sm" onclick="probeClusterNode(\'' +
    esc(n.id) +
    '\')" title="' +
    esc(t("node_probe")) +
    '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg></button>';
  h +=
    '<button class="btn-icon-sm btn-icon-danger" onclick="removeClusterNode(\'' +
    esc(n.id) +
    '\')" title="' +
    esc(t("node_delete")) +
    '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>';
  h += "</div></div>";
  var maskedUrl = _maskUrl(n.url);
  h += '<div class="cluster-node-url-wrap">';
  h +=
    '<span class="cluster-node-url" id="' +
    cardId +
    '-url" data-full-url="' +
    esc(n.url) +
    '" data-masked-url="' +
    esc(maskedUrl) +
    '">' +
    esc(maskedUrl) +
    "</span>";
  h +=
    '<button class="btn-icon-sm cluster-url-eye" id="' +
    cardId +
    '-eye" onclick="_toggleUrlVisibility(\'' +
    cardId +
    '\')" title="' +
    esc(t("toggle_url_visibility") || "Show/Hide") +
    '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg></button>';
  h += "</div>";
  if (meta) h += '<div class="cluster-node-meta">' + meta + "</div>";

  h +=
    '<button class="cluster-card-toggle" onclick="toggleClusterCardDetail(\'' +
    cardId +
    "')\">";
  h +=
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="toggle-arrow"><polyline points="6 9 12 15 18 9"/></svg>';
  h += "<span>" + esc(t("cluster_card_detail") || "Details") + "</span>";
  if (supportedCaps.length > 0)
    h +=
      '<span class="cluster-cap-count">' +
      supportedCaps.length +
      "/" +
      capKeys.length +
      "</span>";
  h += "</button>";
  h += '<div class="cluster-card-detail" id="' + cardId + '-detail">';
  h +=
    '<div class="cluster-card-stats-loading"><div class="cluster-spinner"></div></div>';
  h += "</div>";

  h += "</div>";
  return h;
}

function _maskUrl(url) {
  if (!url) return "";
  try {
    var u = new URL(url);
    var host = u.host;
    if (host.length <= 6)
      return u.protocol + "//" + "*".repeat(host.length) + u.pathname;
    var visible = host.substring(0, 3);
    var masked = "*".repeat(Math.min(host.length - 6, 12));
    var end = host.substring(host.length - 3);
    return u.protocol + "//" + visible + masked + end + u.pathname;
  } catch (e) {
    return url.substring(0, 4) + "***";
  }
}

function _toggleUrlVisibility(cardId) {
  var el = document.getElementById(cardId + "-url");
  var btn = document.getElementById(cardId + "-eye");
  if (!el || !btn) return;
  var full = el.getAttribute("data-full-url");
  var masked = el.getAttribute("data-masked-url");
  if (el.textContent === masked) {
    el.textContent = full;
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  } else {
    el.textContent = masked;
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  }
}

function toggleClusterCardDetail(cardId) {
  var card = document.getElementById(cardId);
  if (!card) return;
  var wasExpanded = card.classList.contains("card-expanded");
  card.classList.toggle("card-expanded");
  if (!wasExpanded) {
    var nodeId = cardId.replace("clusterCard-", "");
    var od =
      _lastOverview && _lastOverview.nodes && _lastOverview.nodes[nodeId];
    if (od) _fillClusterCardDetail(nodeId, od);
  }
}

function _buildStatsHtml(overviewData) {
  if (!overviewData || overviewData._error) return "";
  var mem = overviewData.memory || {};
  var status = overviewData.status || {};
  var system = overviewData.system || {};
  var proc = system.process || {};
  var stats = [];
  if (mem.cpu_percent !== undefined)
    stats.push({
      l: "CPU",
      v:
        (typeof mem.cpu_percent === "number"
          ? mem.cpu_percent.toFixed(1)
          : "-") + "%",
      c: _colorForUsage(mem.cpu_percent, 50, 80),
    });
  if (mem.system_percent !== undefined)
    stats.push({
      l: "RAM",
      v: mem.system_percent.toFixed(1) + "%",
      c: _colorForUsage(mem.system_percent, 60, 85),
    });
  if (mem.rss_mb !== undefined)
    stats.push({ l: t("process_memory"), v: mem.rss_mb + "MB" });
  var aCount;
  if (status.adapters_count !== undefined) aCount = status.adapters_count;
  else if (
    status.adapters &&
    typeof status.adapters === "object" &&
    !status.adapters.error
  )
    aCount = Object.keys(status.adapters).length;
  if (aCount !== undefined)
    stats.push({ l: t("adapters") || "Adapters", v: aCount });
  var mCount;
  if (status.modules_count !== undefined) mCount = status.modules_count;
  else if (
    status.modules &&
    typeof status.modules === "object" &&
    !status.modules.error
  )
    mCount = Object.values(status.modules).filter(function (v) {
      return v;
    }).length;
  if (mCount !== undefined)
    stats.push({ l: t("registered") || "Modules", v: mCount });
  var eCount;
  if (status.events_count !== undefined) eCount = status.events_count;
  else if (system.total_events !== undefined) eCount = system.total_events;
  if (eCount !== undefined)
    stats.push({ l: t("events") || "Events", v: eCount });
  if (system.uptime_human)
    stats.push({
      l: t("lifecycle") || "Uptime",
      v: system.uptime_human,
      c: "var(--tx-s)",
    });
  if (proc.threads !== undefined)
    stats.push({ l: t("threads"), v: proc.threads });
  if (proc.connections !== undefined)
    stats.push({ l: t("connections"), v: proc.connections });
  if (stats.length === 0) return "";
  var h = '<div class="cluster-card-stats">';
  stats.forEach(function (s) {
    h +=
      '<div class="cluster-card-stat"><span class="cluster-stat-val"' +
      (s.c ? ' style="color:' + s.c + '"' : "") +
      ">" +
      esc(s.v) +
      '</span><span class="cluster-stat-label">' +
      esc(s.l) +
      "</span></div>";
  });
  h += "</div>";
  return h;
}

function _fillClusterCardDetail(nodeId, overviewData) {
  var el = document.getElementById("clusterCard-" + nodeId + "-detail");
  if (!el) return;
  var info = nodeRuntimeInfo[nodeId] || {};
  var caps = info.capabilities || {};
  var capKeys = _capKeys;
  var statsHtml = _buildStatsHtml(overviewData);
  var capsHtml = "";
  var supportedCaps = 0;
  capKeys.forEach(function (k) {
    var c = caps[k];
    if (c && c.supported) {
      supportedCaps++;
      capsHtml +=
        '<span class="cluster-cap-tag cap-supported" title="' +
        esc(t("cap_" + k + "_desc")) +
        '">' +
        esc(t("cap_" + k)) +
        "</span>";
    } else if (c && c.supported === false) {
      capsHtml +=
        '<span class="cluster-cap-tag cap-unsupported" title="' +
        esc(t("cap_" + k + "_desc")) +
        '">' +
        esc(t("cap_" + k)) +
        "</span>";
    }
  });
  var h = "";
  if (capsHtml) h += '<div class="cluster-card-caps">' + capsHtml + "</div>";
  h = statsHtml + h;
  el.innerHTML =
    h || '<div style="font-size:12px;color:var(--tx-t);padding:4px 0">-</div>';
  var countEl = el.parentElement.querySelector(".cluster-cap-count");
  if (countEl && capKeys.length > 0)
    countEl.textContent = supportedCaps + "/" + capKeys.length;
}

async function loadClusterPage() {
  var container = document.getElementById("clusterContent");
  if (!container) return;

  await loadClusterNodes();
  var d = await api("/api/cluster/nodes");
  var nodes = d && d.nodes ? d.nodes : [];

  var html = "";
  html += '<div class="cluster-toolbar">';
  html +=
    '<div class="cluster-toolbar-info">' +
    nodes.length +
    " " +
    esc(
      t("cluster_node_count") ||
        (t("node_local") === "本地实例" ? "个节点" : "node(s)"),
    ) +
    "</div>";
  html +=
    '<button class="btn btn-primary btn-sm" onclick="openClusterAddModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:4px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
    esc(t("node_add")) +
    "</button>";
  html += "</div>";

  if (nodes.length === 0) {
    html +=
      '<div class="cluster-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg><div>' +
      esc(t("no_data") || "No nodes added yet") +
      "</div></div>";
  } else {
    html += '<div class="cluster-node-list">';
    nodes.forEach(function (n) {
      html += _clusterNodeCardHtml(n);
    });
    html += "</div>";
  }

  container.innerHTML = html;

  if (nodes.length > 0) {
    api("/api/cluster/overview").then(function (od) {
      if (!od || !od.nodes) return;
      _lastOverview = od;
      nodes.forEach(function (n) {
        if (od.nodes[n.id]) _fillClusterCardDetail(n.id, od.nodes[n.id]);
      });
    });
  }
}

function openClusterAddModal() {
  if (!authed) return showLogin();
  ["addNodeName", "addNodeUrl", "addNodeToken"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = "";
  });
  applyI18n();
  document.getElementById("clusterAddOv").classList.add("show");
  var urlInput = document.getElementById("addNodeUrl");
  if (urlInput)
    setTimeout(function () {
      urlInput.focus();
    }, 100);
}

function closeClusterAddModal() {
  document.getElementById("clusterAddOv").classList.remove("show");
}

function openClusterEditModal(nodeId) {
  if (!authed) return showLogin();
  var d = nodeRuntimeInfo[nodeId] || {};
  document.getElementById("editNodeId").value = nodeId;
  document.getElementById("editNodeName").value = d.name || "";
  document.getElementById("editNodeUrl").value = d.url || "";
  document.getElementById("editNodeToken").value = "";
  document.getElementById("editNodeToken").placeholder =
    t("node_token_placeholder") + " (" + t("leave_empty_to_keep") + ")";
  applyI18n();
  document.getElementById("clusterEditOv").classList.add("show");
}

function closeClusterEditModal() {
  document.getElementById("clusterEditOv").classList.remove("show");
}

async function submitClusterNode() {
  var name = document.getElementById("addNodeName").value.trim();
  var url = document.getElementById("addNodeUrl").value.trim();
  var token = document.getElementById("addNodeToken").value.trim();
  if (!url || !token) {
    toast(t("node_add_failed") + ": URL, Token required", "er");
    return;
  }
  var d = await api("/api/cluster/nodes", {
    method: "POST",
    body: JSON.stringify({ name: name, url: url, token: token }),
  });
  if (d && d.success) {
    if (d.node) nodeRuntimeInfo[d.node.id] = d.node;
    closeClusterAddModal();
    toast(t("node_add_success"), "ok");
    loadClusterPage();
    loadClusterNodes();
  } else {
    toast(t("node_add_failed") + (d && d.error ? ": " + d.error : ""), "er");
  }
}

async function submitEditNode() {
  var nodeId = document.getElementById("editNodeId").value.trim();
  var name = document.getElementById("editNodeName").value.trim();
  var url = document.getElementById("editNodeUrl").value.trim();
  var token = document.getElementById("editNodeToken").value.trim();
  if (!nodeId) return;
  var body = { name: name, url: url };
  if (token) body.token = token;
  var d = await api("/api/cluster/nodes/" + encodeURIComponent(nodeId), {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (d && d.success) {
    if (d.node) nodeRuntimeInfo[d.node.id] = d.node;
    if (currentNode === nodeId) wsConnect();
    closeClusterEditModal();
    toast(t("node_edit") + " OK", "ok");
    loadClusterPage();
  } else {
    toast(
      t("node_edit") +
        " " +
        (t("failed") || "failed") +
        (d && d.error ? ": " + d.error : ""),
      "er",
    );
  }
}

async function removeClusterNode(nodeId) {
  if (!confirm(t("node_remove_confirm"))) return;
  var d = await api("/api/cluster/nodes/" + encodeURIComponent(nodeId), {
    method: "DELETE",
  });
  if (d && d.success) {
    toast(t("node_delete") + " OK", "ok");
    if (currentNode === nodeId) switchNode("local");
    loadClusterPage();
  } else {
    toast(t("node_not_found"), "er");
  }
}

async function pingClusterNode(nodeId) {
  var btn = document.querySelector(
    "#clusterCard-" +
      nodeId +
      " .cluster-node-actions .btn-icon-sm:nth-child(2)",
  );
  if (btn) btn.classList.add("spin");
  var d = await api(
    "/api/cluster/nodes/" + encodeURIComponent(nodeId) + "/ping",
    { method: "POST" },
  );
  if (btn) btn.classList.remove("spin");
  if (d && d.online) {
    toast(t("node_ping_success") + " (" + d.latency_ms + "ms)", "ok");
  } else {
    toast(t("node_ping_failed"), "er");
  }
  await loadClusterNodes();
  loadClusterPage();
}

async function probeClusterNode(nodeId) {
  toast(t("node_probing"), "wr");
  var d = await api(
    "/api/cluster/nodes/" + encodeURIComponent(nodeId) + "/probe",
    { method: "POST" },
  );
  if (d && d.capabilities) {
    nodeCapabilities[nodeId] = d.capabilities;
    toast(t("node_probe_complete"), "ok");
    loadClusterPage();
  } else {
    toast(t("node_probe_complete"), "er");
  }
}

function _colorForUsage(val, warn, danger) {
  if (val > (danger || 85)) return "var(--er-c)";
  if (val > (warn || 60)) return "var(--wr-c)";
  return "var(--ok-c)";
}

// ========== 拓扑图谱（Topology Graph）==========

var _topoRaw = null;
var _topoGraph = { nodes: [], edges: [], nodeById: {} };
var _topoSim = { running: false, raf: 0 };
var _topoView = { x: 0, y: 0, k: 1 };
var _topoHover = null;
var _topoDrag = null;
var _topoPanning = false;
var _topoSelected = null;
var _topoColors = {};

async function loadTopology() {
  var d = await api("/api/topology");
  _topoRaw = d;
  var unsupported = document.getElementById("topoUnsupported");
  if (unsupported) unsupported.style.display = d && d.supported ? "none" : "";
  if (!d || !d.supported) return;
  _topoColors = {
    module: _cssVar("--accent"),
    adapter: _cssVar("--ok-c"),
    bot: _cssVar("--wr-c"),
    resource: _cssVar("--tx-t"),
    edge: _cssVar("--bd"),
    text: _cssVar("--tx-s"),
    grid: _cssVar("--bd"),
  };
  _topoBindEvents();
  _topoRebuild(true);
  _renderTopoLegend();
  var topo = (_topoRaw && _topoRaw.topology) || {};
  var botCount = 0;
  Object.keys(topo.adapters || {}).forEach(function (p) {
    botCount += Object.keys((topo.adapters[p] || {}).bots || {}).length;
  });
  _setText("topoStatModules", Object.keys(topo.modules || {}).length);
  _setText("topoStatAdapters", Object.keys(topo.adapters || {}).length);
  _setText("topoStatBots", botCount);
}

function _cssVar(name) {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
  } catch (e) {
    return "#888";
  }
}

function _topoTypeLabel(type) {
  var map = {
    module: "topo_type_module",
    adapter: "topo_type_adapter",
    bot: "topo_type_bot",
    command: "topo_type_command",
    handler: "topo_type_handler",
    route: "topo_type_route",
  };
  return t(map[type] || "topo_type_module");
}

function _topoRebuild(reset) {
  var canvas = document.getElementById("topoCanvas");
  if (!canvas) return;
  var showRes = document.getElementById("topoShowCommands");
  var showScope = document.getElementById("topoShowScope");
  var showDep = document.getElementById("topoShowDepends");
  var includeRes = !showRes || showRes.checked;
  var includeScope = !showScope || showScope.checked;
  var includeDep = !showDep || showDep.checked;
  _buildTopoGraph(includeRes, includeScope, includeDep);
  _initTopoLayout(reset);
  _startTopoSim();
}

function topoRebuild() {
  _topoRebuild(false);
}

function _addTopoNode(id, type, label, data) {
  if (_topoGraph.nodeById[id]) return _topoGraph.nodeById[id];
  var node = {
    id: id,
    type: type,
    label: label || id,
    data: data || {},
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    degree: 0,
  };
  _topoGraph.nodes.push(node);
  _topoGraph.nodeById[id] = node;
  return node;
}

function _addTopoEdge(source, target, kind) {
  if (!source || !target) return;
  if (source.id === target.id) return;
  for (var i = 0; i < _topoGraph.edges.length; i++) {
    var e = _topoGraph.edges[i];
    if (e.source === source && e.target === target && e.kind === kind) return;
  }
  _topoGraph.edges.push({ source: source, target: target, kind: kind });
  source.degree++;
  target.degree++;
}

function _buildTopoGraph(includeRes, includeScope, includeDep) {
  _topoGraph = { nodes: [], edges: [], nodeById: {} };
  var topo = (_topoRaw && _topoRaw.topology) || {};
  var modules = topo.modules || {};
  var adapters = topo.adapters || {};
  var emptyEl = document.getElementById("topoEmpty");
  if (emptyEl) emptyEl.style.display = "none";
  var detailEl = document.getElementById("topoDetail");
  if (detailEl) detailEl.style.display = "none";

  Object.keys(modules).forEach(function (name) {
    var info = modules[name] || {};
    var node = _addTopoNode("module:" + name, "module", name, info);
    if (includeRes) {
      (info.commands || []).forEach(function (c) {
        _addTopoEdge(node, _addTopoNode("command:" + name + ":" + c, "command", "/" + c, { owner: name }), "own");
      });
      Object.keys(info.handlers || {}).forEach(function (h) {
        _addTopoEdge(node, _addTopoNode("handler:" + name + ":" + h, "handler", h + " ×" + info.handlers[h], { owner: name }), "own");
      });
      var routes = info.routes || {};
      (routes.http || []).forEach(function (r) {
        var rn = _addTopoNode("route:" + name + ":http:" + r, "route", _topoRouteLabel("GET", r), { owner: name, full: "GET " + r });
        _addTopoEdge(node, rn, "own");
      });
      (routes.ws || []).forEach(function (r) {
        var rn = _addTopoNode("route:" + name + ":ws:" + r, "route", _topoRouteLabel("WS", r), { owner: name, full: "WS " + r });
        _addTopoEdge(node, rn, "own");
      });
      (routes.sse || []).forEach(function (r) {
        var rn = _addTopoNode("route:" + name + ":sse:" + r, "route", _topoRouteLabel("SSE", r), { owner: name, full: "SSE " + r });
        _addTopoEdge(node, rn, "own");
      });
    }
    if (includeDep) {
      (info.depends || []).forEach(function (dep) {
        if (modules[dep]) {
          var depNode = _addTopoNode("module:" + dep, "module", dep, modules[dep]);
          _addTopoEdge(node, depNode, "depends");
        }
      });
    }
  });

  var scopeTree = topo.scope || {};
  var scopePlatforms = scopeTree.platforms || {};
  var scopeBots = scopeTree.bots || {};

  Object.keys(adapters).forEach(function (platform) {
    var info = adapters[platform] || {};
    var adapterNode = _addTopoNode("adapter:" + platform, "adapter", platform, {
      status: info.status,
      enabled: info.enabled,
    });
    if (includeScope && scopePlatforms[platform]) {
      _bindScopeEdges(adapterNode, scopePlatforms[platform]);
    }
    Object.keys(info.bots || {}).forEach(function (botId) {
      var bot = info.bots[botId] || {};
      var botNode = _addTopoNode("bot:" + platform + ":" + botId, "bot", botId, {
        status: bot.status,
        last_active: bot.last_active,
        platform: platform,
      });
      _addTopoEdge(adapterNode, botNode, "own");
      if (includeScope && scopeBots[platform] && scopeBots[platform][botId]) {
        _bindScopeEdges(botNode, scopeBots[platform][botId]);
      }
    });
  });

  if (!_topoGraph.nodes.length && emptyEl) {
    emptyEl.style.display = "";
  }
}

function _topoRouteLabel(method, path) {
  var clean = String(path || "").split("?")[0];
  var parts = clean.split("/").filter(Boolean);
  var seg = parts.pop() || clean;
  if (seg.length > 14) seg = seg.slice(0, 12) + "…";
  return method + " · " + seg;
}

function _bindScopeEdges(sourceNode, binding) {
  if (!binding || typeof binding !== "object") return;
  var modules = binding.modules || [];
  modules.forEach(function (m) {
    var target = _topoGraph.nodeById["module:" + m];
    if (!target) {
      var all = (_topoRaw && _topoRaw.topology && _topoRaw.topology.modules) || {};
      var match = Object.keys(all).find(function (k) {
        return k.toLowerCase() === String(m).toLowerCase();
      });
      if (match) target = _topoGraph.nodeById["module:" + match];
    }
    if (target) _addTopoEdge(sourceNode, target, "scope");
  });
}

function _initTopoLayout(reset) {
  var nodes = _topoGraph.nodes;
  var n = nodes.length;
  var radius = Math.min(360, 90 + n * 8);
  for (var i = 0; i < n; i++) {
    var node = nodes[i];
    if (reset || node.x === 0 && node.y === 0) {
      var angle = (2 * Math.PI * i) / Math.max(1, n);
      var ring = node.type === "module" || node.type === "adapter" ? 0.55 : 1;
      node.x = Math.cos(angle) * radius * ring;
      node.y = Math.sin(angle) * radius * ring;
      node.vx = 0;
      node.vy = 0;
    }
  }
  if (reset) _topoView = { x: 0, y: 0, k: 1 };
}

function _startTopoSim() {
  _topoSim.ticks = 0;
  if (_topoSim.running) return;
  _topoSim.running = true;
  function frame(ts) {
    if (!_topoSim.running) return;
    if (_topoIsVisible(document.getElementById("topoCanvas"))) {
      if (_topoSim.ticks < 400) {
        _topoTick();
        _topoSim.ticks++;
      }
      _topoDraw(ts || 0);
    }
    _topoSim.raf = requestAnimationFrame(frame);
  }
  _topoSim.raf = requestAnimationFrame(frame);
}

function _topoTick() {
  var nodes = _topoGraph.nodes;
  var edges = _topoGraph.edges;
  var n = nodes.length;
  var i, j, a, b;
  var repulsion = 9000;
  for (i = 0; i < n; i++) {
    a = nodes[i];
    for (j = i + 1; j < n; j++) {
      b = nodes[j];
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var d2 = dx * dx + dy * dy;
      if (d2 < 1) d2 = 1;
      if (d2 > 480 * 480) continue;
      var d = Math.sqrt(d2);
      var f = repulsion / d2;
      var fx = (dx / d) * f;
      var fy = (dy / d) * f;
      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;
    }
  }
  var spring = 0.015;
  var restLen = 110;
  for (i = 0; i < edges.length; i++) {
    a = edges[i].source;
    b = edges[i].target;
    var ddx = b.x - a.x;
    var ddy = b.y - a.y;
    var dist = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
    var force = spring * (dist - restLen);
    var fxx = (ddx / dist) * force;
    var fyy = (ddy / dist) * force;
    a.vx += fxx;
    a.vy += fyy;
    b.vx -= fxx;
    b.vy -= fyy;
  }
  var centerPull = 0.0035;
  var damping = 0.86;
  for (i = 0; i < n; i++) {
    a = nodes[i];
    a.vx -= a.x * centerPull;
    a.vy -= a.y * centerPull;
    if (a === _topoDrag) {
      a.vx = 0;
      a.vy = 0;
      continue;
    }
    a.vx *= damping;
    a.vy *= damping;
    a.x += Math.max(-12, Math.min(12, a.vx));
    a.y += Math.max(-12, Math.min(12, a.vy));
  }
}

function _topoNodeRadius(node) {
  var base = { module: 11, adapter: 12, bot: 9, command: 5, handler: 5, route: 5 }[node.type] || 6;
  return base + Math.min(6, node.degree * 0.6);
}

function _topoShapePath(ctx, type, x, y, r) {
  ctx.beginPath();
  if (type === "module") {
    var rr = r * 0.35;
    ctx.moveTo(x - r + rr, y - r);
    ctx.arcTo(x + r, y - r, x + r, y + r, rr);
    ctx.arcTo(x + r, y + r, x - r, y + r, rr);
    ctx.arcTo(x - r, y + r, x - r, y - r, rr);
    ctx.arcTo(x - r, y - r, x + r, y - r, rr);
    ctx.closePath();
  } else if (type === "adapter") {
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 6 + (i * Math.PI) / 3;
      var px = x + Math.cos(a) * r;
      var py = y + Math.sin(a) * r;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
  } else if (type === "handler") {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
  } else if (type === "route") {
    var rs = r * 0.4;
    ctx.moveTo(x - r + rs, y - r);
    ctx.arcTo(x + r, y - r, x + r, y + r, rs);
    ctx.arcTo(x + r, y + r, x - r, y + r, rs);
    ctx.arcTo(x - r, y + r, x - r, y - r, rs);
    ctx.arcTo(x - r, y - r, x + r, y - r, rs);
    ctx.closePath();
  } else {
    ctx.arc(x, y, r, 0, 2 * Math.PI);
  }
}

function _topoNodeColor(node) {
  if (node.type === "module") {
    return node.data && node.data.loaded ? _topoColors.module : _topoColors.resource;
  }
  if (node.type === "adapter") return _topoColors.adapter;
  if (node.type === "bot") {
    var st = String((node.data && node.data.status) || "").toLowerCase();
    if (st === "online") return _topoColors.adapter;
    if (st === "offline" || st === "disabled") return _topoColors.resource;
    return _topoColors.bot;
  }
  return _topoColors.resource;
}

function _topoQuadCtrl(p0, p1, k) {
  var mx = (p0.x + p1.x) / 2;
  var my = (p0.y + p1.y) / 2;
  return { x: mx - (p1.y - p0.y) * k, y: my + (p1.x - p0.x) * k };
}

function _topoQuadPoint(p0, c, p1, t) {
  var u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
  };
}

function _topoDrawGrid(ctx, w, h) {
  var gap = 30;
  var ox = (((w / 2 + _topoView.x) % gap) + gap) % gap;
  var oy = (((h / 2 + _topoView.y) % gap) + gap) % gap;
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = _topoColors.grid;
  for (var gx = ox; gx < w; gx += gap) {
    for (var gy = oy; gy < h; gy += gap) {
      ctx.fillRect(gx, gy, 1.2, 1.2);
    }
  }
  ctx.restore();
}

function _topoDraw(ts) {
  ts = ts || 0;
  var canvas = document.getElementById("topoCanvas");
  if (!canvas) return;
  var wrap = canvas.parentElement;
  var dpr = window.devicePixelRatio || 1;
  var w = wrap.clientWidth;
  var h = canvas.clientHeight || 560;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  var ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  _topoDrawGrid(ctx, w, h);
  ctx.save();
  ctx.translate(w / 2 + _topoView.x, h / 2 + _topoView.y);
  ctx.scale(_topoView.k, _topoView.k);

  var edges = _topoGraph.edges;
  var i, e;
  for (i = 0; i < edges.length; i++) {
    e = edges[i];
    var isActive = _topoHover && (e.source === _topoHover || e.target === _topoHover);
    var k = e.kind === "own" ? 0.1 : 0.16;
    var c = _topoQuadCtrl(e.source, e.target, k);
    ctx.beginPath();
    ctx.moveTo(e.source.x, e.source.y);
    ctx.quadraticCurveTo(c.x, c.y, e.target.x, e.target.y);
    if (e.kind === "depends") {
      ctx.setLineDash([7, 5]);
    } else if (e.kind === "scope") {
      ctx.setLineDash([2, 5]);
      ctx.lineDashOffset = -(((ts / 40) % 7) * 2);
    } else {
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = isActive ? _topoColors.module : _topoColors.edge;
    ctx.globalAlpha = _topoHover && !isActive ? 0.12 : e.kind === "own" ? 0.55 : 0.85;
    ctx.lineWidth = isActive ? 2 : e.kind === "own" ? 1.2 : 1.4;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    if (e.kind === "depends") {
      var pt = _topoQuadPoint(e.source, c, e.target, 0.72);
      var ahead = _topoQuadPoint(e.source, c, e.target, 0.78);
      var ang = Math.atan2(ahead.y - pt.y, ahead.x - pt.x);
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(3, 0);
      ctx.lineTo(-4, 3.4);
      ctx.lineTo(-4, -3.4);
      ctx.closePath();
      ctx.fillStyle = isActive ? _topoColors.module : _topoColors.edge;
      ctx.globalAlpha = _topoHover && !isActive ? 0.12 : 0.9;
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;

  var nodes = _topoGraph.nodes;
  for (i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    var r = _topoNodeRadius(node);
    var dim = _topoHover && node !== _topoHover && !_nodeAdjacent(node, _topoHover);
    var color = _topoNodeColor(node);
    var isMain = node.type === "module" || node.type === "adapter" || node.type === "bot";
    ctx.globalAlpha = dim ? 0.15 : 1;
    _topoShapePath(ctx, node.type, node.x, node.y, r);
    ctx.fillStyle = color;
    ctx.fill();
    if (isMain) {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      _topoShapePath(ctx, node.type, node.x, node.y, r);
      ctx.stroke();
    }
    if (_topoSelected === node) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 4.5, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.globalAlpha = dim ? 0.2 : 0.8;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.globalAlpha = dim ? 0.15 : 1;
    }
    ctx.globalAlpha = dim ? 0.12 : 0.95;
    ctx.font = isMain ? "600 11px sans-serif" : "10px sans-serif";
    ctx.textAlign = "center";
    var fullLabel = node.label;
    var lbl = fullLabel.length > 26 ? fullLabel.slice(0, 24) + "…" : fullLabel;
    var tw = ctx.measureText(lbl).width;
    var ly = node.y + r + 12;
    ctx.fillStyle = "rgba(128,128,128,0.2)";
    ctx.fillRect(node.x - tw / 2 - 4, ly - 8, tw + 8, 13);
    ctx.fillStyle = _topoColors.text;
    ctx.fillText(lbl, node.x, ly + 2);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function _nodeAdjacent(a, b) {
  for (var i = 0; i < _topoGraph.edges.length; i++) {
    var e = _topoGraph.edges[i];
    if ((e.source === a && e.target === b) || (e.source === b && e.target === a)) return true;
  }
  return false;
}

function _topoScreenToWorld(px, py) {
  var canvas = document.getElementById("topoCanvas");
  var w = canvas.parentElement.clientWidth;
  var h = canvas.clientHeight || 560;
  return {
    x: (px - w / 2 - _topoView.x) / _topoView.k,
    y: (py - h / 2 - _topoView.y) / _topoView.k,
  };
}

function _topoNodeAt(px, py) {
  var pos = _topoScreenToWorld(px, py);
  var nodes = _topoGraph.nodes;
  for (var i = nodes.length - 1; i >= 0; i--) {
    var node = nodes[i];
    var r = _topoNodeRadius(node) + 4;
    var dx = node.x - pos.x;
    var dy = node.y - pos.y;
    if (dx * dx + dy * dy <= r * r) return node;
  }
  return null;
}

function _topoBindEvents() {
  var canvas = document.getElementById("topoCanvas");
  if (!canvas || canvas._topoBound) return;
  canvas._topoBound = true;
  canvas.addEventListener("mousedown", function (ev) {
    var rect = canvas.getBoundingClientRect();
    var px = ev.clientX - rect.left;
    var py = ev.clientY - rect.top;
    var node = _topoNodeAt(px, py);
    if (node) {
      _topoDrag = node;
      canvas.classList.add("dragging");
      _topoHideTooltip();
    } else {
      _topoPanning = true;
      canvas.classList.add("dragging");
      canvas._panStart = { x: ev.clientX, y: ev.clientY, vx: _topoView.x, vy: _topoView.y };
    }
  });
  window.addEventListener("mousemove", function (ev) {
    var rect = canvas.getBoundingClientRect();
    var px = ev.clientX - rect.left;
    var py = ev.clientY - rect.top;
    if (_topoDrag) {
      var pos = _topoScreenToWorld(px, py);
      _topoDrag.x = pos.x;
      _topoDrag.y = pos.y;
      _startTopoSim();
    } else if (_topoPanning && canvas._panStart) {
      _topoView.x = canvas._panStart.vx + (ev.clientX - canvas._panStart.x);
      _topoView.y = canvas._panStart.vy + (ev.clientY - canvas._panStart.y);
      _topoDraw();
    } else if (_topoIsVisible(canvas)) {
      var node = _topoNodeAt(px, py);
      if (node !== _topoHover) {
        _topoHover = node;
        canvas.style.cursor = node ? "pointer" : "grab";
        _topoDraw(0);
      }
      _topoUpdateTooltip(node, px, py);
    }
  });
  window.addEventListener("mouseup", function () {
    if (_topoDrag) {
      _topoSelected = _topoDrag;
      _showTopoDetail(_topoDrag);
    }
    _topoDrag = null;
    _topoPanning = false;
    canvas.classList.remove("dragging");
  });
  canvas.addEventListener("wheel", function (ev) {
    ev.preventDefault();
    var factor = ev.deltaY < 0 ? 1.12 : 0.9;
    var newK = Math.max(0.15, Math.min(3.5, _topoView.k * factor));
    var rect = canvas.getBoundingClientRect();
    var px = ev.clientX - rect.left;
    var py = ev.clientY - rect.top;
    var w = canvas.parentElement.clientWidth;
    var h = canvas.clientHeight || 560;
    var cx = px - w / 2;
    var cy = py - h / 2;
    _topoView.x = cx - ((cx - _topoView.x) * newK) / _topoView.k;
    _topoView.y = cy - ((cy - _topoView.y) * newK) / _topoView.k;
    _topoView.k = newK;
    _topoDraw();
  }, { passive: false });
  canvas.addEventListener("dblclick", function () {
    _topoView = { x: 0, y: 0, k: 1 };
    _startTopoSim();
  });
  canvas.addEventListener("mouseleave", function () {
    if (_topoDrag || _topoPanning) return;
    _topoHover = null;
    _topoHideTooltip();
    _topoDraw(0);
  });

  // ---- 触摸：单指拖动/平移，双指捏合缩放，双击复位 ----

  canvas.addEventListener("touchstart", function (ev) {
    if (ev.touches.length === 1) {
      var t = ev.touches[0];
      var rect = canvas.getBoundingClientRect();
      var px = t.clientX - rect.left;
      var py = t.clientY - rect.top;
      var node = _topoNodeAt(px, py);
      canvas._tapStart = { x: t.clientX, y: t.clientY };
      canvas._tapLast = { x: t.clientX, y: t.clientY };
      if (node) {
        _topoDrag = node;
      } else {
        _topoPanning = true;
        canvas._panStart = { x: t.clientX, y: t.clientY, vx: _topoView.x, vy: _topoView.y };
      }
      canvas.classList.add("dragging");
      _topoHideTooltip();
      ev.preventDefault();
    } else if (ev.touches.length === 2) {
      _topoDrag = null;
      _topoPanning = false;
      var a = ev.touches[0];
      var b = ev.touches[1];
      canvas._pinch = {
        dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1,
        k: _topoView.k,
        midX: (a.clientX + b.clientX) / 2,
        midY: (a.clientY + b.clientY) / 2,
        vx: _topoView.x,
        vy: _topoView.y,
      };
      ev.preventDefault();
    }
  }, { passive: false });

  canvas.addEventListener("touchmove", function (ev) {
    if (ev.touches.length === 2 && canvas._pinch) {
      var a = ev.touches[0];
      var b = ev.touches[1];
      var p = canvas._pinch;
      var dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
      var midX = (a.clientX + b.clientX) / 2;
      var midY = (a.clientY + b.clientY) / 2;
      var newK = Math.max(0.15, Math.min(3.5, p.k * (dist / p.dist)));
      var rect = canvas.getBoundingClientRect();
      var w = canvas.parentElement.clientWidth;
      var h = canvas.clientHeight || 560;
      var cx = p.midX - rect.left - w / 2;
      var cy = p.midY - rect.top - h / 2;
      _topoView.x = cx - ((cx - p.vx) * newK) / p.k;
      _topoView.y = cy - ((cy - p.vy) * newK) / p.k;
      _topoView.k = newK;
      _topoView.x += midX - p.midX;
      _topoView.y += midY - p.midY;
      _topoDraw();
      ev.preventDefault();
    } else if (ev.touches.length === 1) {
      var t = ev.touches[0];
      canvas._tapLast = { x: t.clientX, y: t.clientY };
      var rect = canvas.getBoundingClientRect();
      var px = t.clientX - rect.left;
      var py = t.clientY - rect.top;
      if (_topoDrag) {
        var pos = _topoScreenToWorld(px, py);
        _topoDrag.x = pos.x;
        _topoDrag.y = pos.y;
        _startTopoSim();
        ev.preventDefault();
      } else if (_topoPanning && canvas._panStart) {
        _topoView.x = canvas._panStart.vx + (t.clientX - canvas._panStart.x);
        _topoView.y = canvas._panStart.vy + (t.clientY - canvas._panStart.y);
        _topoDraw();
        ev.preventDefault();
      }
    }
  }, { passive: false });

  function _topoTouchEnd() {
    if (_topoDrag) {
      _topoSelected = _topoDrag;
      _showTopoDetail(_topoDrag);
    }
    // 双击空白复位
    var moved = 0;
    if (canvas._tapStart && canvas._tapLast) {
      moved = Math.hypot(
        canvas._tapLast.clientX - canvas._tapStart.clientX,
        canvas._tapLast.clientY - canvas._tapStart.clientY,
      );
    }
    if (moved < 10) {
      var now = Date.now();
      if (now - (canvas._lastTap || 0) < 300) {
        _topoView = { x: 0, y: 0, k: 1 };
        _startTopoSim();
        canvas._lastTap = 0;
      } else {
        canvas._lastTap = now;
      }
    }
    _topoDrag = null;
    _topoPanning = false;
    canvas._pinch = null;
    canvas._panStart = null;
    canvas.classList.remove("dragging");
    _topoDraw(0);
  }
  canvas.addEventListener("touchend", _topoTouchEnd);
  canvas.addEventListener("touchcancel", _topoTouchEnd);
}

function _topoUpdateTooltip(node, px, py) {
  var tip = document.getElementById("topoTooltip");
  if (!tip) return;
  if (!node) {
    tip.style.display = "none";
    return;
  }
  tip.innerHTML =
    "<b>" + esc((node.data && node.data.full) || node.label) + '</b><span class="tt-type">' + esc(_topoTypeLabel(node.type)) + "</span>";
  tip.style.display = "block";
  var canvas = document.getElementById("topoCanvas");
  var wrapW = canvas.parentElement.clientWidth;
  var wrapH = canvas.clientHeight || 560;
  var tw = tip.offsetWidth;
  var th = tip.offsetHeight;
  tip.style.left = Math.max(4, Math.min(px + 14, wrapW - tw - 8)) + "px";
  tip.style.top = Math.max(4, Math.min(py + 14, wrapH - th - 8)) + "px";
}

function _topoHideTooltip() {
  var tip = document.getElementById("topoTooltip");
  if (tip) tip.style.display = "none";
}

function _topoIsVisible(canvas) {
  return canvas && canvas.offsetParent !== null;
}

function _showTopoDetail(node) {
  var panel = document.getElementById("topoDetail");
  if (!panel) return;
  var html = "";
  var closeBtn =
    '<button class="btn-icon topo-detail-close" onclick="closeTopoDetail()">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
  var typeLabel = '<span class="scope-entry-chip">' + esc(_topoTypeLabel(node.type)) + "</span>";
  html += closeBtn + "<h4>" + esc((node.data && node.data.full) || node.label) + " " + typeLabel + "</h4>";
  var d = node.data || {};
  function kv(k, v) {
    return '<div class="topo-detail-kv"><span class="topo-detail-k">' + esc(k) + ':</span><span class="topo-detail-v">' + esc(String(v)) + "</span></div>";
  }
  if (node.type === "module") {
    html += kv(t("topo_detail_status"), (d.loaded ? t("topo_detail_loaded") : "—") + " / " + (d.enabled ? t("topo_detail_enabled") : "—"));
    var meta = d.info || {};
    if (meta.version) html += kv(t("topo_detail_version"), meta.version);
    if (meta.description) html += kv("", meta.description);
    var res = [];
    if ((d.commands || []).length) res.push(t("topo_type_command") + " ×" + d.commands.length);
    Object.keys(d.handlers || {}).forEach(function (h) {
      res.push(h + " ×" + d.handlers[h]);
    });
    if (res.length) {
      html +=
        '<div class="topo-detail-kv"><span class="topo-detail-k">' + t("topo_detail_resources") + ':</span></div><div class="topo-detail-list">' +
        res.map(function (r2) { return '<span class="scope-entry-chip">' + esc(r2) + "</span>"; }).join(" ") +
        "</div>";
    }
    if ((d.depends || []).length) {
      html +=
        '<div class="topo-detail-kv"><span class="topo-detail-k">' + t("topo_edge_depends") + ':</span><span class="topo-detail-v">' + esc(d.depends.join(", ")) + "</span></div>";
    }
  } else if (node.type === "adapter") {
    html += kv(t("topo_detail_status"), String(d.status || "—"));
    if (typeof d.enabled !== "undefined") html += kv(t("topo_detail_enabled"), String(d.enabled));
    html += _topoScopeChipsHtml("platforms", node.label);
  } else if (node.type === "bot") {
    html += kv(t("topo_detail_status"), String(d.status || "—"));
    if (d.platform) html += kv(t("topo_type_adapter"), d.platform);
    if (d.platform) html += _topoScopeChipsHtml("bots", d.platform, node.label);
  } else if (node.type === "command" || node.type === "handler" || node.type === "route") {
    if (d.owner) html += kv(t("scope_owner"), d.owner);
  }
  var target = { module: "module-mgmt", adapter: "adapter", bot: "bots", command: "commands", handler: "event-stream", route: "api-routes" }[node.type];
  if (target) {
    html +=
      '<div class="topo-detail-actions">' +
      '<button class="btn btn-primary btn-sm" style="width:100%" onclick="closeTopoDetail();go(\'' + target + '\')">' +
      esc(t("topo_open")) + "</button></div>";
  }
  panel.innerHTML = html;
  panel.style.display = "";
}

function closeTopoDetail() {
  var panel = document.getElementById("topoDetail");
  if (panel) panel.style.display = "none";
  _topoSelected = null;
  _topoDraw(0);
}

function _topoScopeChipsHtml(bucket, platform, subKey) {
  try {
    var scopeTree = (_topoRaw && _topoRaw.topology && _topoRaw.topology.scope) || {};
    var binding;
    if (!subKey) {
      binding = (scopeTree.platforms || {})[platform];
    } else {
      binding = ((scopeTree[bucket] || {})[platform] || {})[subKey];
    }
    if (!binding || typeof binding !== "object") return "";
    var chips =
      _scopeEntryChips(binding.modules || [], "") +
      " " +
      _scopeEntryChips(binding.blocked || [], "blocked");
    if (binding.merge) chips += ' <span class="scope-entry-chip merge">merge</span>';
    if (!chips.trim()) return "";
    return (
      '<div class="topo-detail-kv" style="margin-top:6px"><span class="topo-detail-k">' +
      esc(t("topo_edge_scope")) + ':</span></div><div class="topo-detail-list">' + chips + "</div>"
    );
  } catch (e) {
    return "";
  }
}

function _renderTopoLegend() {
  var legend = document.getElementById("topoLegend");
  if (!legend) return;
  function item(color, label) {
    return (
      '<span class="topo-legend-item"><span class="topo-legend-dot" style="background:' + color + '"></span>' + esc(label) + "</span>"
    );
  }
  legend.innerHTML =
    item(_topoColors.module, t("topo_type_module")) +
    item(_topoColors.adapter, t("topo_type_adapter")) +
    item(_topoColors.bot, t("topo_type_bot")) +
    item(_topoColors.resource, t("topo_detail_resources")) +
    '<span class="topo-legend-item"><span class="topo-legend-line"></span>' + esc(t("topo_edge_own")) + "</span>" +
    '<span class="topo-legend-item"><span class="topo-legend-line dashed"></span>' + esc(t("topo_edge_depends")) + "</span>" +
    '<span class="topo-legend-item"><span class="topo-legend-line dotted"></span>' + esc(t("topo_edge_scope")) + "</span>";
}

function _topoStopSim() {
  _topoSim.running = false;
  if (_topoSim.raf) cancelAnimationFrame(_topoSim.raf);
}

window.addEventListener("resize", function () {
  if (_topoIsVisible(document.getElementById("topoCanvas"))) _topoDraw();
});
