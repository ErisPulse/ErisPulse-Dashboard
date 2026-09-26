// ErisPulse Dashboard – pages/settings (auto-split from dash.js)

export function applySettingUiStyle(val) {
  applyUiStyle(FIXED_UI_STYLE);
  if (typeof syncSettingsUI === "function") syncSettingsUI();
}

export function applySettingFont(id) {
  localStorage.setItem("ep_font", id);
  applyFont(id);
  syncFontCards();
}

export function initFontSelector() {
  var container = document.getElementById("fontSelector");
  if (!container) return;
  container.innerHTML = "";

  // 系统默认卡片
  var sys = document.createElement("div");
  sys.className = "font-card";
  sys.dataset.font = "system";
  sys.onclick = function() { applySettingFont("system"); };
  var sysPreview = document.createElement("div");
  sysPreview.className = "font-card-preview";
  sysPreview.style.fontWeight = "600";
  sysPreview.textContent = "Aa";
  var sysLabel = document.createElement("div");
  sysLabel.className = "font-card-label";
  sysLabel.textContent = t("font_system");
  sys.appendChild(sysPreview);
  sys.appendChild(sysLabel);
  container.appendChild(sys);

  // 用户上传的字体卡片（可删除）
  (window._customFonts || []).forEach(function(f) {
    var card = document.createElement("div");
    card.className = "font-card";
    card.dataset.font = f.url;
    card.onclick = function() { applySettingFont(f.url); };
    var preview = document.createElement("div");
    preview.className = "font-card-preview";
    preview.style.fontFamily = '"' + f.name + '"';
    preview.textContent = "Aa";
    var label = document.createElement("div");
    label.className = "font-card-label";
    label.textContent = f.name;
    label.style.fontFamily = '"' + f.name + '"';
    var del = document.createElement("button");
    del.className = "font-card-del";
    del.title = t("font_delete");
    del.textContent = "×";
    del.onclick = function(e) {
      e.stopPropagation();
      _deleteCustomFont(f.url);
    };
    card.appendChild(preview);
    card.appendChild(label);
    card.appendChild(del);
    container.appendChild(card);
  });

  // 上传入口卡片
  var up = document.createElement("div");
  up.className = "font-card font-card-upload";
  up.title = t("font_upload");
  up.onclick = function() {
    document.getElementById("fontUploadInput").click();
  };
  up.textContent = "＋";
  container.appendChild(up);
  syncFontCards();
}

// 上传字体：保存到服务端 → 记入外观 custom_fonts → 应用
export async function _uploadFontFile(input) {
  if (!input.files || !input.files[0]) return;
  var file = input.files[0];
  var fd = new FormData();
  fd.append("file", file);
  var d = await api("/api/fonts/upload", { method: "POST", body: fd });
  if (d && d.success) {
    var entry = { name: file.name.replace(/\.[^.]+$/, ""), url: d.url };
    var list = (window._customFonts || []).slice();
    if (!list.some(function(f) { return f.url === entry.url; })) list.push(entry);
    window._customFonts = list;
    await api("/api/appearance", {
      method: "PUT",
      body: JSON.stringify({ custom_fonts: list }),
    });
    initFontSelector();
    applySettingFont(entry.url);
    toast(t("font_uploaded"), "ok");
  } else {
    toast((d && d.error) || t("font_upload_failed"), "er");
  }
  input.value = "";
}

export async function _deleteCustomFont(url) {
  var ok = await confirm2(t("font_delete"), url.split("/").pop());
  if (!ok) return;
  await api("/api/fonts/delete", {
    method: "POST",
    body: JSON.stringify({ url: url }),
  });
  var list = (window._customFonts || []).filter(function(f) {
    return f.url !== url;
  });
  window._customFonts = list;
  await api("/api/appearance", {
    method: "PUT",
    body: JSON.stringify({ custom_fonts: list }),
  });
  if (getFont() === url) applySettingFont("system");
  initFontSelector();
}

export function syncFontCards() {
  var cur = getFont();
  document.querySelectorAll(".font-card").forEach(function(c) {
    c.classList.toggle("active", c.dataset.font === cur);
  });
}

export function applySettingOled(on) {
  localStorage.setItem("ep_oled", on ? "on" : "off");
  applyOled(on);
}

export function alert2(title, text) {
  return showModal(title, text, [
    { label: t("ok"), value: true, primary: true },
  ]);
}

export function getSetting(key, def) {
  const v = localStorage.getItem("ep_setting_" + key);
  return v !== null ? v : def;
}

export function setSetting(key, val) {
  localStorage.setItem("ep_setting_" + key, val);
}

export function showSettings() {
  go("settings");
}

export function closeSettings() {}

export function switchSettingsTab(tab, btn) {
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
  var loaders = {
    "settings-update": loadFrameworkVersions,
    "settings-about": loadAbout,
  };
  if (loaders[tab]) loaders[tab]();
  if (tab === "settings-update") {
    document.getElementById("settingsUpdateTab")?.classList.remove("show-update");
  }
}

export async function loadSettings() {
  updateAboutCard();
  syncSettingsUI();
  initAccentSwatches();
  initCustomThemeEditor();
  initFontSelector();
  await loadGlobalAppearance();
}

export async function loadGlobalAppearance() {
  try {
    var d = await api("/api/appearance");
    if (!d || !d.appearance) return;
    var app = d.appearance;
    var scopeEl = document.getElementById("settingsGlobalScope");
    if (scopeEl) scopeEl.checked = !!app._global_enabled;
    window._globalSyncEnabled = !!app._global_enabled;
    // 用户上传的自定义字体清单（先注册 @font-face 再应用字体）
    window._customFonts = Array.isArray(app.custom_fonts) ? app.custom_fonts : [];
    (window._customFonts || []).forEach(function (f) {
      _ensureFontFace(f.name, f.url);
    });
    if (window._globalSyncEnabled) {
      // 全局同步开启：本机静音，应用远端快照（设置 + 字体），并同步开关 UI
      window._syncMuted = true;
      if (app.font) {
        localStorage.setItem("ep_font", app.font);
        applyFont(app.font);
      }
      await _applySyncedSettings(app.settings || {});
      applyGlobalAppearanceData(app);
      setTimeout(function () { window._syncMuted = false; }, 800);
    }
  } catch (e) {
    console.debug("Appearance API unavailable, using local settings");
  }
}

var APPEARANCE_BACKUP_KEY = "ep_appearance_backup";

export async function onSettingsScopeChange(checked) {
  try {
    if (checked) {
      // 开启前快照本地外观，关闭时可恢复到开启前的样子
      try {
        localStorage.setItem(APPEARANCE_BACKUP_KEY, JSON.stringify(collectAppearanceData()));
      } catch (e) {}
    }
    var d = await api("/api/appearance", {
      method: "PUT",
      body: JSON.stringify({ _global_enabled: checked }),
    });
    if (d && d.success) {
      window._globalSyncEnabled = checked;
      if (checked) {
        await loadGlobalAppearance(); // 立即套用全局外观，而非等下次加载
        toast(t("settings_sync_on_applied"), "ok");
      } else {
        _restoreAppearanceBackup();
        toast(t("settings_sync_off_restored"), "ok");
      }
    } else {
      toast(t("save_failed") + ": " + (d?.error || t("unknown_error")), "er");
    }
  } catch (e) {
    toast(t("save_failed"), "er");
  }
}

function _restoreAppearanceBackup() {
  var raw = null;
  try {
    raw = localStorage.getItem(APPEARANCE_BACKUP_KEY);
  } catch (e) {}
  if (!raw) return;
  try {
    applyGlobalAppearanceData(JSON.parse(raw));
  } catch (e) {}
  try {
    localStorage.removeItem(APPEARANCE_BACKUP_KEY);
  } catch (e) {}
}

export function applyDashTitle(title) {
  if (!title) title = "ErisPulse Dashboard";
  setSetting("dash_title", title);
  var el = document.getElementById("appTitle");
  if (el) el.textContent = title;
  document.title = title;
  // 联动：侧边栏头部（移动端抽屉顶部）同步仪表盘标题
  var sbTitle = document.getElementById("sidebarPageTitle");
  if (sbTitle) sbTitle.textContent = title;
}

export function applyGlobalAppearanceData(app) {
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

export function collectAppearanceData() {
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

export async function uploadGlobalAppearance() {
  var ok = await confirm2(t("settings_upload_global"), t("settings_upload_confirm"));
  if (!ok) return;
  await _pushSyncSnapshot();
  toast(t("settings_upload_global_ok"), "ok");
}

export function _availableNavPages() {
  var out = [];
  var seen = {};
  Array.prototype.forEach.call(
    document.querySelectorAll(".nav-item[data-page]"),
    function (a) {
      var page = a.getAttribute("data-page");
      if (!page || seen[page]) return;
      seen[page] = 1;
      var c = navItemContent(page);
      var pageLabel = (c && c.title) || page;
      out.push({ value: page, label: pageLabel, icon: (c && c.svg) || "", isSub: false });
      // 子 tab 变体（同主页 pin 逻辑；与页面同名的 tab 跳过，避免重复项）
      var tabs = MERGED_PAGE_TABS[page];
      if (tabs) {
        tabs.forEach(function (tabInfo) {
          var tabLabel = t(tabInfo.i18n) || tabInfo.label;
          if (tabLabel === pageLabel) return;
          out.push({
            value: page + ":" + tabInfo.id,
            label: tabLabel,
            icon: (c && c.svg) || "",
            isSub: true,
          });
        });
      }
    },
  );
  return out;
}

const DP_CHECK_SVG =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
export function _dpClosePanel() {
  var panel = document.getElementById("dpPanel");
  if (panel) panel.style.display = "none";
}

// 默认起始页选择器：主页 pin 选择器同款交互（图标 + 页面/子 tab 层级）
export function _renderDefaultPagePicker() {
  var host = document.getElementById("defaultPagePicker");
  if (!host) return;
  var cur = getDefaultPage();
  var pages = _availableNavPages();
  var known = pages.some(function (p) {
    return p.value === cur;
  });
  var curLabel =
    known || !cur
      ? (pages.find(function (p) {
            return p.value === cur;
          }) || { label: t("dashboard") }).label
      : cur;
  if (known && !pages.some(function (p) { return p.value === cur; })) curLabel = t("dashboard");

  var rows = pages
    .map(function (p) {
      return (
        '<div class="' +
        (p.isSub ? "home-pin-suboption" : "home-pin-option") +
        '" data-value="' +
        esc(p.value) +
        '">' +
        '<span class="dp-icon">' +
        (p.icon || "") +
        "</span>" +
        '<span class="dp-label">' +
        esc(p.label) +
        "</span>" +
        (p.value === cur ? '<span class="dp-check">' + DP_CHECK_SVG + "</span>" : "") +
        "</div>"
      );
    })
    .join("");
  rows +=
    '<div class="home-pin-option" data-value="__custom__">' +
    '<span class="dp-icon"></span>' +
    '<span class="dp-label">' +
    esc(t("settings_default_custom")) +
    "</span>" +
    (known ? "" : '<span class="dp-check">' + DP_CHECK_SVG + "</span>") +
    "</div>";

  host.innerHTML =
    '<button type="button" class="settings-select dp-toggle" id="dpToggle">' +
    '<span class="dp-toggle-label">' +
    esc(curLabel) +
    "</span>" +
    "</button>" +
    '<div class="dp-panel" id="dpPanel" style="display:none">' +
    rows +
    "</div>";

  document.getElementById("dpToggle").onclick = function () {
    var panel = document.getElementById("dpPanel");
    var toggle = document.getElementById("dpToggle");
    if (panel.style.display !== "none") {
      panel.style.display = "none";
      return;
    }
    // 复用 EP 组件库的定位逻辑：fixed 定位逃出卡片 overflow 裁剪，空间不足自动上翻
    panel.style.display = "block";
    if (window.EP && EP.positionList) {
      EP.positionList(panel, toggle, 300);
      panel.style.display = "grid"; // 定位测量用 block，展示恢复 grid 行距
    }
  };
  host.querySelectorAll("[data-value]").forEach(function (row) {
    row.onclick = function () {
      _dpClosePanel();
      applySettingDefaultPage(row.getAttribute("data-value"));
    };
  });
}

// 点击选择器外部或页面滚动时收起面板（fixed 面板不随卡片滚动）
document.addEventListener("click", function (e) {
  var picker = document.getElementById("defaultPagePicker");
  if (!picker || !e.target.closest) return;
  if (!picker.contains(e.target)) _dpClosePanel();
});
window.addEventListener("scroll", function (e) {
  // 面板自身列表的滚动不关闭；只有页面/容器滚动时才收起
  if (e.target && e.target.closest && e.target.closest(".default-page-picker")) return;
  _dpClosePanel();
}, true);

export function applySettingDefaultPage(val) {
  if (val === "__custom__") {
    var cur = getDefaultPage();
    prompt2(t("settings_default_custom"), t("settings_default_custom_desc"), cur && cur !== "dashboard" ? cur : "dashboard").then(function (id) {
      if (!id) {
        _renderDefaultPagePicker();
        return;
      }
      setSetting("default_page", id);
      _renderDefaultPagePicker();
    });
    return;
  }
  setSetting("default_page", val);
  _renderDefaultPagePicker();
}

export function getDefaultPage() {
  return getSetting("default_page", "dashboard");
}

export function applyDefaultPageOnLogin() {
  var p = getDefaultPage();
  if (!p || p === "dashboard") return;
  // "page:tab" 形式：先切页再点 tab（nav-item 上没有 tab 后缀，直接查会永远找不到）
  var parts = p.split(":");
  var page = parts[0];
  var tab = parts[1];
  var openTarget = function () {
    go(page);
    if (tab) {
      var tabBtn = document.querySelector('[data-tab="' + tab + '"]');
      if (tabBtn) tabBtn.click();
    }
  };
  // 模块视图异步渲染，轮询等待 nav-item 出现后跳转
  var attempts = 0;
  var timer = setInterval(function () {
    attempts++;
    if (document.querySelector('.nav-item[data-page="' + page + '"]')) {
      clearInterval(timer);
      openTarget();
    } else if (attempts > 30) {
      clearInterval(timer);
      openTarget();
    }
  }, 100);
}

export function applySettingDensity(val) {
  setSetting("density", val);
  document.documentElement.setAttribute("data-density", val);
}

export function getDensity() {
  return getSetting("density", "comfortable");
}

export function applySettingTabSize(val) {
  setSetting("editor_tab_size", val);
  _applyEditorOptions();
}

export function applySettingLineWrap(on) {
  setSetting("editor_line_wrap", on ? "1" : "0");
  _applyEditorOptions();
}

export function getEditorTabSize() {
  return parseInt(getSetting("editor_tab_size", "4"), 10) || 4;
}

export function getEditorLineWrap() {
  return getSetting("editor_line_wrap", "1") !== "0";
}

export function _applyEditorOptions() {
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

export function applySettingCustomCss() {
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

export function initCustomCss() {
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

export function exportAppearancePrefs() {
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

export function importAppearancePrefs() {
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

export function showShortcutsHelp() {
  var rows =
    '<div class="list-row" style="font-size:13px"><span style="flex:1">' +
    esc(t("kb_focus_search")) +
    '</span><code style="background:var(--bg-s);padding:2px 8px;border-radius:4px;border:1px solid var(--bd)">Ctrl K / /</code></div>' +
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

document.addEventListener(
  "touchstart",
  function (e) {
    _swipeX = e.changedTouches[0].clientX;
    _swipeT = Date.now();
  },
  { passive: true },
);;

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
);;

export function syncSettingsUI() {
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
  _renderDefaultPagePicker();
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

export function applySettingTheme(theme) {
  if (theme !== "light" && theme !== "dark" && theme !== "auto") return;
  localStorage.setItem("ep_theme", theme);
  applyTheme(theme);
  syncSettingsUI();
}

export function applySettingLang(v) {
  lang = v;
  localStorage.setItem("ep_lang", lang);
  applyI18n();
  // Sync language cards after i18n update
  document.querySelectorAll(".lang-card").forEach(function(card) {
    card.classList.toggle("active", card.dataset.lang === lang);
  });
  loadAll();
}

export async function syncFrameworkLang() {
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

export function applySettingSidebar(collapsed) {
  localStorage.setItem("ep_sidebar_collapsed", collapsed);
  if (window.innerWidth <= 768) return;
  document.getElementById("sidebar").classList.toggle("collapsed", collapsed);
}

export function applySettingRefresh(val) {
  setSetting("refresh_interval", val);
  restartRefreshTimer();
}

export function applySettingEventLimit(val) {
  setSetting("event_limit", val);
}

export function applyPrivacyMode(on) {
  setSetting("privacy_mode", on ? "1" : "0");
  document.body.classList.toggle("privacy-on", on);
  refreshEventViews();
  syncSettingsUI();
}

export function getEventDensity() {
  return getSetting("event_density", "comfy");
}

export function applySettingEventDensity(val) {
  setSetting("event_density", val === "compact" ? "compact" : "comfy");
  refreshEventViews();
  syncSettingsUI();
}

export function getEventAutoTop() {
  return getSetting("event_auto_top", "1") !== "0";
}

export function applySettingEventAutoTop(on) {
  setSetting("event_auto_top", on ? "1" : "0");
}

export function resetAppearanceSettings() {
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

export function resetAllSettings() {
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

export function applySettingNodeSelector(show) {
  localStorage.setItem("ep_show_node_selector", show);
  // 重新应用显隐逻辑
  updateNodeSelectorVisibility();
}

export function getAnimStyle() {
  return localStorage.getItem("ep_anim_style") || "subtle";
}

export function applyAnimStyle(style) {
  document.documentElement.setAttribute("data-anim", style);
}

export function applySettingAnimStyle(val) {
  localStorage.setItem("ep_anim_style", val);
  applyAnimStyle(val);
}

export async function exportBackup() {
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

export async function importBackup(input) {
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

// ════════════════ 全局同步（一开全开，全量同步）════════════════
// 同步范围：外观 + 行为 + 语言 + 布局（下列 localStorage 键）
var SYNC_LOCAL_KEYS = [
  "ep_theme", "ep_oled", "ep_font", "ep_lang", "ep_anim_style",
  "ep_home_pins", "ep_nav_group_states", "ep_sidebar_collapsed",
  "ep_show_node_selector", "ep_remember_groups",
  "ep_setting_dash_title", "ep_setting_bg_color", "ep_setting_bg_image",
  "ep_setting_accent_color", "ep_setting_bg_auto_theme", "ep_setting_custom_css",
  "ep_setting_privacy_mode", "ep_setting_density", "ep_setting_default_page",
  "ep_setting_editor_tab_size", "ep_setting_editor_line_wrap",
  "ep_setting_refresh_interval", "ep_setting_event_limit",
  "ep_setting_event_density", "ep_setting_event_auto_top",
];
var _syncPushTimer = null;

export function _globalSyncEnabled() {
  return !!window._globalSyncEnabled;
}

// 同步快照推送（同步开启时，任意同步设置变更 → 推送 → 广播到全部设备）
export async function _pushSyncSnapshot() {
  if (!_globalSyncEnabled() || !authed) return;
  var settings = {};
  SYNC_LOCAL_KEYS.forEach(function (k) {
    settings[k] = localStorage.getItem(k) || "";
  });
  var payload = {
    _global_enabled: true,
    settings: settings,
    custom_fonts: window._customFonts || [],
    font: getFont(),
  };
  await api("/api/appearance", { method: "PUT", body: JSON.stringify(payload) });
}

// 拦截同步键的写入（同步开启时自动推送；应用远端快照期间静音）
var _origSetItem = Storage.prototype.setItem;
Storage.prototype.setItem = function (k, v) {
  _origSetItem.call(this, k, v);
  try {
    if (
      window._globalSyncEnabled &&
      !window._syncMuted &&
      typeof k === "string" &&
      (k.indexOf("ep_setting_") === 0 || SYNC_LOCAL_KEYS.indexOf(k) !== -1)
    ) {
      if (_syncPushTimer) clearTimeout(_syncPushTimer);
      _syncPushTimer = setTimeout(_pushSyncSnapshot, 2000);
    }
  } catch (e) {}
};

// 同步键 → 应用函数（收到广播/快照后恢复到本机）
var SYNC_APPLIERS = {
  ep_theme: function (v) { applyTheme(v); },
  ep_oled: function (v) { applyOled(v === "on"); },
  ep_font: function (v) { applyFont(v); },
  ep_lang: function (v) { applySettingLang(v); },
  ep_anim_style: function (v) { applyAnimStyle(v); },
  ep_home_pins: function () { renderHomePins(); },
  ep_nav_group_states: function () { restoreNavGroupStates(); },
  ep_sidebar_collapsed: function (v) {
    if (window.innerWidth > 768)
      document.getElementById("sidebar").classList.toggle("collapsed", v === "true");
  },
  ep_show_node_selector: function () { updateNodeSelectorVisibility(); },
  ep_remember_groups: function () { restoreNavGroupStates(); },
  ep_setting_dash_title: function (v) { applyDashTitle(v); },
  ep_setting_bg_color: function (v) { applyBgColor(v); },
  ep_setting_bg_image: function (v) { v ? applyBgImage(v) : clearBgImage(); },
  ep_setting_accent_color: function (v) { applyAccentColor(v); },
  ep_setting_bg_auto_theme: function (v) {
    localStorage.setItem("ep_setting_bg_auto_theme", v);
    onThemeChanged();
  },
  ep_setting_custom_css: function () {
    var ta = document.getElementById("settingsCustomCss");
    if (ta) applySettingCustomCss();
  },
  ep_setting_privacy_mode: function (v) { applyPrivacyMode(v === "1"); },
  ep_setting_density: function (v) { applySettingDensity(v); },
  ep_setting_default_page: function (v) { setSetting("default_page", v); },
  ep_setting_editor_tab_size: function (v) { applySettingTabSize(parseInt(v, 10) || 4); },
  ep_setting_editor_line_wrap: function (v) { applySettingLineWrap(v === "1"); },
  ep_setting_refresh_interval: function (v) { applySettingRefresh(v); },
  ep_setting_event_limit: function (v) { applySettingEventLimit(v); },
  ep_setting_event_density: function (v) { applySettingEventDensity(v); },
  ep_setting_event_auto_top: function (v) { applySettingEventAutoTop(v === "1"); },
};

// 应用远端设置快照（静音本机推送，避免回环）
export async function _applySyncedSettings(st) {
  window._syncMuted = true;
  try {
    Object.keys(st).forEach(function (k) {
      localStorage.setItem(k, st[k]);
      var fn = SYNC_APPLIERS[k];
      if (fn) {
        try { fn(st[k]); } catch (e) {}
      }
    });
    syncSettingsUI();
  } finally {
    setTimeout(function () { window._syncMuted = false; }, 800);
  }
}
