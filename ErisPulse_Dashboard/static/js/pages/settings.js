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
  if (tab === "settings-update") {
    loadFrameworkVersions();
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
    // 全局同步开启时，其它端自动套用全局外观
    if (app._global_enabled) {
      applyGlobalAppearanceData(app);
    }
  } catch (e) {
    console.debug("Appearance API unavailable, using local settings");
  }
}

export async function onSettingsScopeChange(checked) {
  try {
    await api("/api/appearance", {
      method: "PUT",
      body: JSON.stringify({ _global_enabled: checked }),
    });
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

export function _fillDefaultPageSelect() {
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

export function applySettingDefaultPage(val) {
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

export function getDefaultPage() {
  return getSetting("default_page", "dashboard");
}

export function applyDefaultPageOnLogin() {
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

