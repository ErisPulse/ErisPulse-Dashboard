// ErisPulse Dashboard – pages/settings (auto-split from dash.js)

export function applySettingUiStyle(val) {
  applyUiStyle(val);
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

// ════════════════ 背景与透感设置卡（所见即所得） ════════════════

// 平铺开关：仅改变背景铺设方式，透感档位与遮罩不受影响
export function applySettingBgTile(on) {
  setSetting("bg_tile", on ? "1" : "0");
  var img = getSetting("bg_image", "");
  if (img) applyBgImage(img);
  syncBgCardUI();
}

// 透感三档选择器（bgLevelSeg）激活态同步
export function syncBgLevelSeg() {
  var seg = document.getElementById("bgLevelSeg");
  if (!seg) return;
  var cur = getBgTrans();
  seg.querySelectorAll("button").forEach(function (b) {
    b.classList.toggle("active", b.dataset.level === cur);
  });
}

// 背景卡整体回显：预览缩略图 / 平铺开关 / 透感档位 / 自动取色 / 清除按钮 / OLED 提示
export function syncBgCardUI() {
  var img = getSetting("bg_image", "");
  var has = !!img;
  var tile = getSetting("bg_tile", "0") === "1";
  var box = document.getElementById("bgPreviewBox");
  var im = document.getElementById("bgPreviewImg");
  var empty = document.getElementById("bgPreviewEmpty");
  if (im) {
    if (has) {
      im.style.backgroundImage = 'url("' + img + '")';
      // 预览与实际铺设方式一致：图案平铺 / 照片封面
      im.style.backgroundRepeat = tile ? "repeat" : "no-repeat";
      im.style.backgroundSize = tile ? "64px auto" : "cover";
    } else {
      im.style.removeProperty("background-image");
    }
  }
  if (box) box.classList.toggle("has-bg", has);
  if (empty) empty.style.display = has ? "none" : "flex";
  var tileEl = document.getElementById("settingsBgTile");
  if (tileEl) tileEl.checked = tile;
  syncBgLevelSeg();
  showBgAutoThemeRow(has);
  var autoChk = document.getElementById("settingsBgAutoTheme");
  if (autoChk) autoChk.checked = bgAutoThemeEnabled();
  var clearBtn = document.getElementById("bgClearBtn");
  if (clearBtn) clearBtn.style.display = has ? "inline-flex" : "none";
  syncBgPatternActive();
  updateOledHint();
}

// OLED + 背景图同时开启时给出提示（透明黑底会发灰，透感已自动收紧）
export function updateOledHint() {
  var hint = document.getElementById("bgOledHint");
  if (!hint) return;
  var show = !!getSetting("bg_image", "") && getOled();
  hint.style.display = show ? "block" : "none";
}

// 图案库缩略图（BG_PATTERNS 来自 state.js；小图 + 平铺 + 自动取色）
export function renderBgPatternGrid() {
  var grid = document.getElementById("bgPatternGrid");
  if (!grid) return;
  grid.innerHTML = "";
  (BG_PATTERNS || []).forEach(function (url) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "bg-pattern-thumb";
    b.title = t("settings_bg_pattern");
    b.style.backgroundImage = 'url("' + url + '")';
    b.onclick = function () {
      applyBgPattern(url);
      syncBgCardUI();
    };
    grid.appendChild(b);
  });
  syncBgPatternActive();
}

export function syncBgPatternActive() {
  var cur = getSetting("bg_image", "");
  var tile = getSetting("bg_tile", "0") === "1";
  document.querySelectorAll(".bg-pattern-thumb").forEach(function (b, i) {
    b.classList.toggle("active", tile && (BG_PATTERNS || [])[i] === cur);
  });
}

// 预览卡「清除背景」：移除图片与纯色，保留透感档位偏好
export function clearBgFromCard() {
  resetBg();
  syncBgCardUI();
}

// ── 每卡局部重置（设置卡右上角 ↺）──
export async function resetSettingsGroup(group) {
  var key = "settings_reset_group_" + group;
  var ok = await confirm2(t("settings_card_reset"), t(key));
  if (!ok) return;
  switch (group) {
    case "theme":
      localStorage.removeItem("ep_theme");
      applyTheme("auto");
      localStorage.setItem("ep_ui_style", "eris");
      applyUiStyle("eris");
      break;
    case "bg":
      localStorage.removeItem("ep_setting_bg_tile");
      localStorage.removeItem("ep_setting_bg_trans");
      resetBg();
      applyBgTransClass();
      break;
    case "accent":
      resetAccent();
      break;
    case "density":
      localStorage.removeItem("ep_setting_density");
      applySettingDensity("comfortable");
      localStorage.removeItem("ep_oled");
      applySettingOled(false);
      localStorage.removeItem("ep_anim_style");
      applySettingAnimStyle("subtle");
      break;
    case "font":
      localStorage.removeItem("ep_font");
      applyFont("system");
      initFontSelector();
      break;
    case "advanced":
      clearThemePack();
      resetFullCustomTheme();
      localStorage.removeItem("ep_setting_custom_css");
      var cssEl = document.getElementById("epCustomCss");
      if (cssEl) cssEl.textContent = "";
      var ta = document.getElementById("settingsCustomCss");
      if (ta) ta.value = "";
      break;
  }
  syncSettingsUI();
  syncBgCardUI();
  toast(t("settings_reset_group_done"), "ok");
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

// ════════════════ 分区导航（索引 + 详情两栏） ════════════════
// 面板懒加载器：进入分区时按需拉取数据
var SETTINGS_SEC_LOADERS = {
  "sec-update": function () { loadFrameworkVersions(); },
  "sec-about": function () { loadAbout(); },
  "sec-security": function () { loadGeneralTab(); },
};

function _selectSettingsPane(paneId, remember) {
  var pane = document.querySelector('.settings-pane[data-pane="' + paneId + '"]');
  if (!pane) pane = document.querySelector('.settings-pane[data-pane="sec-appearance"]');
  if (!pane) return;
  paneId = pane.dataset.pane;
  document.querySelectorAll("#settingsDetail .settings-pane").forEach(function (p) {
    p.classList.toggle("active", p === pane);
  });
  // 子面板归属父分区：导航高亮跟随父项
  var navSec = pane.dataset.parent || paneId;
  var activeBtn = null;
  document.querySelectorAll("#settingsNav .settings-nav-item").forEach(function (b) {
    b.classList.toggle("active", b.dataset.sec === navSec);
    if (b.dataset.sec === navSec) activeBtn = b;
  });
  // 移动端 chips 行：激活项滚入可视范围，避免选中 tab 藏在横滑区外
  if (activeBtn && _settingsMobileMQ.matches) _scrollNavChipIntoView(activeBtn);
  if (remember && !pane.dataset.parent) setSetting("settings_section", paneId);
  var loader = SETTINGS_SEC_LOADERS[paneId];
  if (loader) loader();
  if (paneId === "sec-update") {
    var el = document.getElementById("settingsUpdateTab");
    if (el) el.classList.remove("show-update");
  }
  syncSettingsSectionUI();
}

// ── 断点形态：桌面 ≥960px 索引+详情两栏；移动 ≤959px 顶部 tab（chips 行）+ 常驻详情 ──
var _settingsMobileMQ = window.matchMedia("(max-width: 959px)");

// 移动端不再有滑入式二级视图；旧 class 残留会在断点切换时统一清理
function _clearMobileDetailView() {
  var shell = document.getElementById("settingsShell");
  if (shell) shell.classList.remove("show-detail");
}

// chips 行激活项水平滚入可视范围（仅调 scrollLeft，不触发页面纵向滚动）
function _scrollNavChipIntoView(btn) {
  var nav = document.getElementById("settingsNav");
  if (!nav) return;
  var nr = nav.getBoundingClientRect();
  var br = btn.getBoundingClientRect();
  if (br.left < nr.left + 8) nav.scrollLeft += br.left - nr.left - 8;
  else if (br.right > nr.right - 8) nav.scrollLeft += br.right - nr.right + 8;
}

// 用户点击入口（导航项 / 值行）：移动端 tab 等价于桌面选分区，详情面板常驻
export function switchSettingsSection(sec) {
  _selectSettingsPane(sec, true);
  // 仅桌面存在二级视图状态；移动端直接切换分区即可
  if (_settingsMobileMQ.matches) return;
  _clearMobileDetailView();
}

// 断点跨越时清理移动端残留的 show-detail，避免桌面误隐藏索引列
if (typeof _settingsMobileMQ.addEventListener === "function") {
  _settingsMobileMQ.addEventListener("change", function (e) {
    if (!e.matches) _clearMobileDetailView();
  });
} else if (typeof _settingsMobileMQ.addListener === "function") {
  _settingsMobileMQ.addListener(function (e) {
    if (!e.matches) _clearMobileDetailView();
  });
}

// 返回：子面板回到父分区（顶级分区在两端均由导航/tab 直达，无返回键）
export function settingsGoBack() {
  var pane = document.querySelector(".settings-pane.active");
  var parent = pane && pane.dataset.parent;
  if (parent) {
    _selectSettingsPane(parent, true);
    return;
  }
  _clearMobileDetailView();
}

// 兼容旧 tab 入口（PAGE_REDIRECTS / 活动中心 / 默认起始页均按旧 tab id 调用）
export function switchSettingsTab(tab, btn) {
  var map = {
    "settings-appearance": "sec-appearance",
    "settings-behavior": "sec-behavior",
    "settings-general": "sec-language",
    "settings-update": "sec-update",
    "settings-about": "sec-about",
  };
  switchSettingsSection(map[tab] || "sec-appearance");
}

// 分区行条目回显：行内分段选择器与值行副标题
export function syncSettingsSectionUI() {
  var themeSeg = document.getElementById("themeModeSeg");
  if (themeSeg) {
    var th = getTheme();
    themeSeg.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.theme === th);
    });
  }
  var styleSeg = document.getElementById("uiStyleSeg");
  if (styleSeg) {
    var st = getUiStyle();
    styleSeg.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.style === st);
    });
  }
  var accentVal = document.getElementById("accentRowValue");
  if (accentVal) {
    var ac = getSetting("accent_color", "");
    if (ac) accentVal.style.background = ac;
    else accentVal.style.removeProperty("background");
  }
  var bgVal = document.getElementById("bgRowValue");
  if (bgVal) {
    var hasBg = !!getSetting("bg_image", "");
    bgVal.textContent = hasBg ? "" : t("settings_bg_empty");
  }
  var fontVal = document.getElementById("fontRowValue");
  if (fontVal) {
    var fid = getFont();
    var label = t("font_system");
    if (fid && fid !== "system") {
      var hit = (window._customFonts || []).find(function (f) { return f.url === fid; });
      if (hit) label = hit.name;
      else {
        var pre = FONT_PRESETS.find(function (p) { return p.id === fid; });
        if (pre && pre.name) label = pre.name;
      }
    }
    fontVal.textContent = label;
  }
  // 行内分段控件激活态回显（语言 / 时间格式 / 编辑器缩进·主题·字号）
  var langSeg = document.getElementById("langSeg");
  if (langSeg) {
    langSeg.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.lang === lang);
    });
  }
  var tfSeg = document.getElementById("timeFmtSeg");
  if (tfSeg) {
    tfSeg.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.tf === getTimeFormat());
    });
  }
  var tsSeg = document.getElementById("tabSizeSeg");
  if (tsSeg) {
    tsSeg.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.ts === String(getEditorTabSize()));
    });
  }
  var etSeg = document.getElementById("editorThemeSeg");
  if (etSeg) {
    etSeg.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.et === getEditorTheme());
    });
  }
  var efsSeg = document.getElementById("editorFontSizeSeg");
  if (efsSeg) {
    efsSeg.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.efs === getEditorFontSize());
    });
  }
}

export async function loadSettings() {
  _selectSettingsPane(getSetting("settings_section", "sec-appearance"), false);
  updateAboutCard();
  syncSettingsUI();
  initAccentSwatches();
  initCustomThemeEditor();
  initFontSelector();
  renderBgPatternGrid();
  syncBgCardUI();
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
    applyUiStyle(app.ui_style);
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
  if (app.bg_tile !== undefined) {
    setSetting("bg_tile", app.bg_tile ? "1" : "0");
  }
  if (app.bg_trans) {
    applySettingBgLevel(app.bg_trans);
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
    bg_tile: getSetting("bg_tile", "0") === "1",
    bg_trans: getBgTrans(),
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

// 默认起始页选择器：原生 <select> + EP 组件库自动增强（触发器在容器内，菜单挂 body）。
// 旧私有实现（dpToggle/dpPanel）的面板渲染在设置分区内，而分区入场动画 settingsPaneIn
// 以 fill-mode:both 永久保留 translateY 变换 → 分区成为 fixed 后代的包含块，
// EP.positionList 计算的视口坐标被相对化后整板漂移出屏（“下拉打不开”的根因）。
// 迁移到 ep-select 后菜单挂 body，结构性规避该类问题，并与“刷新间隔”等全站下拉一致。
export function _renderDefaultPagePicker() {
  var host = document.getElementById("defaultPagePicker");
  if (!host) return;
  var cur = getDefaultPage();
  var pages = _availableNavPages();
  var known = pages.some(function (p) {
    return p.value === cur;
  });

  var sel = document.getElementById("defaultPageSelect");
  if (!sel || !sel.isConnected) {
    host.innerHTML = "";
    sel = document.createElement("select");
    sel.id = "defaultPageSelect";
    sel.className = "settings-select ep-select";
    // change 挂既有持久化函数：增强/降级为原生两种形态下均触发同一持久化路径
    sel.addEventListener("change", function () {
      applySettingDefaultPage(sel.value);
    });
    host.appendChild(sel);
  }
  sel.setAttribute("aria-label", t("settings_default_page"));
  // options 同既有数据源：导航页 + 子 tab（“└ ” 标识层级）+ 自定义入口
  var html = pages
    .map(function (p) {
      return (
        '<option value="' +
        esc(p.value) +
        '">' +
        esc((p.isSub ? "\u2514 " : "") + p.label) +
        "</option>"
      );
    })
    .join("");
  html += '<option value="__custom__">' + esc(t("settings_default_custom")) + "</option>";
  // 当前值不在已知页（历史自定义 id）：补一个回显项，避免触发器显示错乱
  if (!known && cur && cur !== "dashboard") {
    html = '<option value="' + esc(cur) + '">' + esc(cur) + "</option>" + html;
  }
  sel.innerHTML = html;
  sel.value = cur || "dashboard";
  if (sel.selectedIndex === -1) sel.value = "dashboard";
}

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
  syncSettingsSectionUI();
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

// ── CodeMirror 主题（ep_setting_editor_theme：auto 跟随明暗 / default / dracula）──
// 已 vendor 的主题样式仅 dracula.min.css，选项以实测可用项为准
export function getEditorTheme() {
  var v = getSetting("editor_theme", "auto");
  return v === "dracula" || v === "default" ? v : "auto";
}

export function _editorAutoTheme() {
  return getEffectiveTheme() === "dark" ? "dracula" : "default";
}

// 归纳实例应使用的主题：auto 保留页面侧写入的明暗联动值，显式偏好强制覆盖
function _resolveEditorTheme(current) {
  var pref = getEditorTheme();
  if (pref === "auto") return current || _editorAutoTheme();
  return pref;
}

export function applySettingEditorTheme(v) {
  setSetting("editor_theme", v === "dracula" || v === "default" ? v : "auto");
  _applyEditorOptions();
  syncSettingsSectionUI();
}

// ── 编辑器字号（ep_setting_editor_font_size：s/m/l；m 为默认，等价当前继承字号）──
var EDITOR_FONT_SIZES = { s: "12px", m: "", l: "16px" };

export function getEditorFontSize() {
  var v = getSetting("editor_font_size", "m");
  return EDITOR_FONT_SIZES[v] !== undefined ? v : "m";
}

// 字号经 CSS 变量全局下发（settings.css 统一规则），已打开实例仅 refresh 重排
// 编辑器实例归 files.js / config.js 模块私有，经 window 暴露（见各页创建处）
function _applyEditorFontSize() {
  var px = EDITOR_FONT_SIZES[getEditorFontSize()];
  if (px) document.documentElement.style.setProperty("--ep-cm-font-size", px);
  else document.documentElement.style.removeProperty("--ep-cm-font-size");
  [window._cfgSourceCM, window._fmEditor].forEach(function (cm) {
    if (cm && cm.refresh) cm.refresh();
  });
}

export function applySettingEditorFontSize(v) {
  setSetting("editor_font_size", EDITOR_FONT_SIZES[v] !== undefined ? v : "m");
  _applyEditorFontSize();
  syncSettingsSectionUI();
}

// CodeMirror 实例分散在文件管理器 / 配置源码两处且每次打开重建：
// 在工厂与 setOption 两层注入用户偏好，页面侧初始化代码零改动
(function _patchCodeMirrorEditorPrefs() {
  if (typeof CodeMirror === "undefined" || CodeMirror.__epEditorPrefs) return;
  CodeMirror.__epEditorPrefs = true;
  var _fromTextArea = CodeMirror.fromTextArea;
  CodeMirror.fromTextArea = function () {
    var cm = _fromTextArea.apply(this, arguments);
    try {
      cm.setOption("theme", _resolveEditorTheme(cm.getOption("theme")));
      if (getEditorFontSize() !== "m") cm.refresh();
    } catch (e) {}
    return cm;
  };
  var _setOption = CodeMirror.prototype.setOption;
  CodeMirror.prototype.setOption = function (opt, val) {
    // 用户强制指定主题时，页面侧的明暗联动写入一并改写为偏好值
    if (opt === "theme") val = _resolveEditorTheme(val);
    return _setOption.call(this, opt, val);
  };
})();

export function _applyEditorOptions() {
  var tab = getEditorTabSize(),
    wrap = getEditorLineWrap();
  [window._cfgSourceCM, window._fmEditor].forEach(function (cm) {
    if (!cm) return;
    cm.setOption("tabSize", tab);
    cm.setOption("indentUnit", tab);
    cm.setOption("lineWrapping", wrap);
    cm.setOption("theme", _resolveEditorTheme(cm.getOption("theme")));
  });
  _applyEditorFontSize();
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
    bg_tile: getSetting("bg_tile", "0") === "1",
    bg_trans: getBgTrans(),
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
          applyUiStyle(d.ui_style);
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
        if (d.bg_tile !== undefined) setSetting("bg_tile", d.bg_tile ? "1" : "0");
        if (d.bg_trans) applySettingBgLevel(d.bg_trans);
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
  // Style cards (eris 经典 / cel 赛璐璐 / kawaii 可爱极简)
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
  if (elEl) elEl.value = getSetting("event_limit", "100") || "100";
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
  // 背景与透感卡整体回显（预览/平铺/档位/自动取色/OLED 提示）
  syncBgCardUI();
  // 偏好设置回显
  _renderDefaultPagePicker();
  var dnEl = document.getElementById("settingsDensity");
  if (dnEl) dnEl.value = getDensity();
  var lwEl = document.getElementById("settingsLineWrap");
  if (lwEl) lwEl.checked = getEditorLineWrap();
  // 行内分段控件（语言/时间格式/编辑器缩进·主题·字号）的激活态统一在 syncSettingsSectionUI 回显
  // 桌面通知：开关状态 + 权限被拒/能力缺失时置灰
  var ntEl = document.getElementById("settingsDesktopNotify");
  if (ntEl) {
    ntEl.checked = getDesktopNotify();
    ntEl.disabled = _desktopNotifyBlocked();
  }
  var nvEl = document.getElementById("notifyRowValue");
  if (nvEl) nvEl.textContent = _notifyStateText();
  var ccEl = document.getElementById("settingsCustomCss");
  if (ccEl) ccEl.value = getSetting("custom_css", "");
  var pmEl = document.getElementById("settingsPrivacyMode");
  if (pmEl) pmEl.checked = getPrivacyMode();
  var evDenEl = document.getElementById("settingsEventDensity");
  if (evDenEl) evDenEl.value = getEventDensity();
  var atEl = document.getElementById("settingsEventAutoTop");
  if (atEl) atEl.checked = getEventAutoTop();
  document.body.classList.toggle("privacy-on", getPrivacyMode());
  // 分区行条目（分段选择器/值行副标题）随设置变化同步
  syncSettingsSectionUI();
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
  // 行内语言分段激活态随语言切换回显
  syncSettingsSectionUI();
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

// ── 时间显示格式（getTimeFormat/formatTime 定义在 core/state.js）──
export function applySettingTimeFormat(v) {
  setSetting("time_format", v === "12" ? "12" : "24");
  // 已渲染的时间戳随事件流重绘即时生效；日志/审计在下次加载时应用
  refreshEventViews();
  syncSettingsUI();
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

// ════════════════ 桌面通知（页面隐藏时经系统通知提示关键 WS 消息） ════════════════

export function getDesktopNotify() {
  return getSetting("desktop_notify", "0") === "1";
}

// 权限不可用/被拒时开关置灰：能力缺失或 Notification.permission === "denied"
export function _desktopNotifyBlocked() {
  return (
    typeof Notification === "undefined" || Notification.permission === "denied"
  );
}

export function applySettingDesktopNotify(on) {
  if (!on) {
    setSetting("desktop_notify", "0");
    syncSettingsUI();
    return;
  }
  if (typeof Notification === "undefined") {
    toast(t("settings_notify_unsupported"), "er");
    syncSettingsUI();
    return;
  }
  if (Notification.permission === "denied") {
    toast(t("settings_notify_denied"), "er");
    syncSettingsUI();
    return;
  }
  setSetting("desktop_notify", "1");
  if (Notification.permission === "default") {
    Notification.requestPermission().then(function (p) {
      if (p !== "granted") {
        // 授权被拒：回落关闭，避免留下不生效的开启态
        setSetting("desktop_notify", "0");
        toast(t("settings_notify_denied"), "er");
      } else {
        toast(t("settings_notify_enabled"), "ok");
      }
      syncSettingsUI();
    });
  }
  syncSettingsUI();
}

// 行内状态副标题：描述文案 / 已开启 / 权限被拒
function _notifyStateText() {
  if (_desktopNotifyBlocked()) return t("settings_notify_denied");
  if (getDesktopNotify()) return t("settings_notify_enabled");
  return t("settings_notify_desc");
}

var _notifyLastTs = 0;
var _notifySuppressed = 0;

// 关键消息筛选：事件流消息节流聚合，安装/模块变更即时提示
function _maybeDesktopNotify(type, raw) {
  if (!getDesktopNotify()) return;
  if (!document.hidden) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  var m = null;
  try {
    m = JSON.parse(raw);
  } catch (e) {
    return;
  }
  if (!m || typeof m !== "object") return;
  var title = document.title || "ErisPulse Dashboard";
  var body = "";
  if (type === "event") {
    // 高频流节流：10s 窗口内仅提示一次，其余折算进条数
    var now = Date.now();
    if (now - _notifyLastTs < 10000) {
      _notifySuppressed++;
      return;
    }
    _notifyLastTs = now;
    var d = m.data || {};
    body =
      t(d.type || "meta") +
      " · " +
      String(d.alt_message || d.detail_type || "-") +
      (d.platform ? " · " + d.platform : "");
    if (_notifySuppressed > 0) {
      body += " (+" + _notifySuppressed + ")";
      _notifySuppressed = 0;
    }
  } else if (type === "install_progress" && (m.status === "success" || m.status === "error")) {
    body =
      (m.packages || []).join(", ") +
      " · " +
      (m.status === "success" ? t("install_success") : t("install_failed"));
  } else if (type === "module_changed" && m.data && m.data.action === "installed") {
    body = m.data.name + " · " + t("module_loaded_dynamic");
  } else {
    return;
  }
  try {
    var n = new Notification(title, { body: body, tag: "ep-dashboard" });
    n.onclick = function () {
      // 点击通知聚焦窗口
      try {
        window.focus();
      } catch (e) {}
      n.close();
    };
  } catch (e) {}
}

// WS 帧统一经 wsLogPush 上报（先于各消息分支处理），在此单点挂钩即可覆盖全部消息；
// main.js 在模块求值后才把各导出挂到 window，故推迟到 DOMContentLoaded 再包一层
function _installDesktopNotifyHook() {
  if (window.__epNotifyHooked) return;
  window.__epNotifyHooked = true;
  var orig = window.wsLogPush;
  if (typeof orig !== "function") return;
  window.wsLogPush = function (type, raw) {
    try {
      _maybeDesktopNotify(type, raw);
    } catch (e) {}
    return orig.apply(this, arguments);
  };
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", _installDesktopNotifyHook);
} else {
  _installDesktopNotifyHook();
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
      "ep_ui_style",
      "ep_anim_style",
      "ep_setting_accent_color",
      "ep_setting_bg_color",
      "ep_setting_bg_image",
      "ep_setting_bg_tile",
      "ep_setting_bg_trans",
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
  "ep_theme", "ep_oled", "ep_font", "ep_lang", "ep_anim_style", "ep_ui_style",
  "ep_home_pins", "ep_nav_group_states", "ep_sidebar_collapsed",
  "ep_show_node_selector", "ep_remember_groups",
  "ep_setting_dash_title", "ep_setting_bg_color", "ep_setting_bg_image",
  "ep_setting_bg_tile", "ep_setting_bg_trans",
  "ep_setting_accent_color", "ep_setting_bg_auto_theme", "ep_setting_custom_css",
  "ep_setting_privacy_mode", "ep_setting_density", "ep_setting_default_page",
  "ep_setting_editor_tab_size", "ep_setting_editor_line_wrap",
  "ep_setting_editor_theme", "ep_setting_editor_font_size",
  "ep_setting_time_format", "ep_setting_desktop_notify",
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
  ep_ui_style: function (v) { applyUiStyle(v); },
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
  ep_setting_bg_tile: function (v) { applySettingBgTile(v === "1"); },
  ep_setting_bg_trans: function (v) { applySettingBgLevel(v); },
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
  ep_setting_editor_theme: function (v) { applySettingEditorTheme(v); },
  ep_setting_editor_font_size: function (v) { applySettingEditorFontSize(v); },
  ep_setting_time_format: function (v) { applySettingTimeFormat(v); },
  // 通知权限是浏览器级每设备状态，不随同步开关翻转，仅回写本地偏好
  ep_setting_desktop_notify: function (v) { setSetting("desktop_notify", v === "1" ? "1" : "0"); syncSettingsUI(); },
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

// ── 背景：图片链接自定义 ──
export async function applyBgImageUrl() {
  var url = await prompt2(
    t("bg_custom_url"),
    "https://example.com/bg.jpg",
    getSetting("bg_image", "").indexOf("http") === 0
      ? getSetting("bg_image", "")
      : "",
  );
  if (!url) return;
  url = url.trim();
  if (!/^https?:\/\//.test(url)) return toast(t("invalid_url"), "er");
  setSetting("bg_image", url);
  setSetting("bg_tile", "0");
  applyBgImage(url);
  toast(t("config_saved"), "ok");
}
// ── 主题包：zip 包上传（theme.json/theme.css/theme.js/assets，完整 JS/CSS 权限） ──
export async function applyThemePackFile(input) {
  var f = input.files && input.files[0];
  if (!f) return;
  input.value = '';
  try {
    var buf = await f.arrayBuffer();
    var pack = await themepackBuild(buf, f.name.replace(/.(zip|css)$/i, ''));
    var choice = await showModal(
      t('theme_pack_warn_title'),
      '<div class="settings-item-desc" style="margin-bottom:10px">' +
        esc(t('theme_pack_warn_desc')) +
        '</div><div class="settings-item"><div><div class="settings-item-label">' +
        esc(pack.name) +
        '</div><div class="settings-item-desc">' +
        esc((pack.meta && pack.meta.author ? t('theme_pack_author') + ': ' + pack.meta.author + ' · ' : '') +
          (pack.js ? t('theme_pack_has_js') : t('theme_pack_css_only'))) +
        '</div></div></div>',
      [
        { label: t('cancel'), value: 'cancel' },
        { label: t('theme_pack_apply'), value: 'apply', primary: true },
      ],
    );
    if (choice !== 'apply') return;
    themepackApply(pack);
    themepackSave(buf, f.name);
    syncThemePackUI();
    toast(t('theme_pack_done'), 'ok');
  } catch (e) {
    toast(t('theme_pack_invalid') + ': ' + e.message, 'er');
  }
}

export function clearThemePack() {
  themepackClear();
  syncThemePackUI();
  toast(t('theme_pack_cleared'), 'ok');
}

export function syncThemePackUI() {
  var el = document.getElementById('themePackActive');
  if (!el) return;
  var pack = null;
  try { pack = JSON.parse(localStorage.getItem('ep_theme_pack') || 'null'); } catch (e) {}
  el.textContent = pack && pack.name ? pack.name : t('theme_pack_none');
}

// ── 主题变量编辑器模态：打开时按已存主题重建表单，Esc/遮罩点击关闭 ──
var _customThemeEscHandler = null;

export function openCustomThemeModal() {
  var ov = document.getElementById('customThemeOv');
  if (!ov) return;
  initCustomThemeEditor(); // 按当前保存值重建变量表单与开关状态
  ov.classList.add('show');
  // 捕获阶段拦截 Esc，避免其他全局快捷键处理器抢先响应
  _customThemeEscHandler = function (e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    closeCustomThemeModal();
  };
  document.addEventListener('keydown', _customThemeEscHandler, true);
}

export function closeCustomThemeModal() {
  var ov = document.getElementById('customThemeOv');
  if (ov) ov.classList.remove('show');
  if (_customThemeEscHandler) {
    document.removeEventListener('keydown', _customThemeEscHandler, true);
    _customThemeEscHandler = null;
  }
}

// ════════════════ 通用：访问令牌（原安全页迁移） ════════════════

export function loadGeneralTab() {
  loadAccessTokenCard();
  loadLoginLockout();
}

export function loadAccessTokenCard() {
  var host = document.getElementById("generalTokenCard");
  if (!host) return;
  var tk = localStorage.getItem("__ep_tk__") || "";
  var masked =
    tk.length > 12
      ? tk.slice(0, 6) + "••••••" + tk.slice(-4)
      : "••••••";
  host.innerHTML =
    '<div class="card settings-card">' +
    '<div class="card-header">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>' +
    "<span>" +
    esc(t("sec_token_title")) +
    "</span>" +
    "</div>" +
    '<div class="settings-card-body">' +
    '<div class="settings-item"><div>' +
    '<div class="settings-item-label">' +
    esc(t("sec_token_label")) +
    "</div>" +
    '<div class="settings-item-desc">' +
    esc(t("sec_token_desc")) +
    "</div>" +
    "</div>" +
    '<div class="settings-item-control">' +
    "<code>" +
    esc(masked) +
    "</code>" +
    "</div></div>" +
    '<div class="settings-item" style="border-top:none">' +
    '<div class="settings-item-control" style="display:flex;gap:8px;margin-left:0">' +
    '<button class="btn btn-secondary btn-sm" onclick="copyAccessToken()">' +
    esc(t("sec_copy")) +
    "</button>" +
    '<button class="btn btn-danger btn-sm" onclick="regenAccessToken()">' +
    esc(t("sec_token_regen")) +
    "</button>" +
    "</div></div>" +
    "</div></div>";
}

export function copyAccessToken() {
  var tk = localStorage.getItem("__ep_tk__") || "";
  if (!tk) return toast(t("unknown_error"), "er");
  _copyToClipboard(tk);
  toast(t("sec_copied"), "ok");
}

export function copyAccessTokenPreview() {
  var el = document.getElementById("newTokenPreview");
  if (!el) return;
  _copyToClipboard(el.textContent);
  toast(t("sec_copied"), "ok");
}

// ── 令牌重生成：预览 → 复制 → 确认应用（应用前旧令牌始终有效） ──
function _randomAccessToken() {
  var bytes = new Uint8Array(32);
  if (window.crypto && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (var i = 0; i < 32; i++)
      bytes[i] = Math.floor(Math.random() * 256);
  }
  var s = btoa(String.fromCharCode.apply(null, bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function regenAccessToken() {
  if (!authed) return showLogin();
  // 步骤 1：本地生成新令牌并预览，用户复制确认前什么都不会发生
  var newToken = _randomAccessToken();
  var preview = await showModal(
    t("sec_token_preview_title"),
    '<div class="settings-item-desc" style="margin-bottom:10px">' +
      esc(t("sec_token_preview_desc")) +
      "</div>" +
      '<pre class="settings-token-code" id="newTokenPreview">' +
      esc(newToken) +
      "</pre>" +
      '<div style="margin-top:8px;text-align:right">' +
      '<button class="btn btn-secondary btn-xs" onclick="copyAccessTokenPreview()">' +
      esc(t("sec_copy")) +
      "</button></div>",
    [
      { label: t("cancel"), value: "cancel" },
      { label: t("sec_token_apply"), value: "apply", primary: true },
    ],
  );
  if (preview !== "apply") return; // 取消：旧令牌继续有效，本次生成作废
  // 步骤 2：应用（旧令牌立即失效）
  var d = await api("/api/security/token/regenerate", {
    method: "POST",
    body: JSON.stringify({ token: newToken }),
  });
  if (!d || !d.success) return toast(d && d.error ? d.error : t("unknown_error"), "er");
  localStorage.setItem("__ep_tk__", d.token);
  toast(t("sec_token_regen_ok"), "ok");
  loadAccessTokenCard();
}

// ════════════════ 通用：登录失败保护（配置存 Dashboard.login_lockout_*） ════════════════

export async function loadLoginLockout() {
  try {
    var d = await api("/api/config");
    var cfg = (d && d.config && d.config["Dashboard"]) || {};
    var enabled = cfg.login_lockout_enabled !== false;
    var maxFails = cfg.login_lockout_max_fails || 10;
    var win = cfg.login_lockout_window || 60;
    window._loginLockoutCfg = { max_fails: maxFails, window: win };
    var sw = document.getElementById("settingsLoginLockout");
    if (sw) sw.checked = enabled;
    var sum = document.getElementById("loginLockoutSummary");
    if (sum)
      sum.textContent = t("login_lockout_params_desc")
        .replace("{n}", maxFails)
        .replace("{s}", win);
  } catch (e) {}
}

export async function setLoginLockoutEnabled(on) {
  var d = await api("/api/config", {
    method: "PUT",
    body: JSON.stringify({ key: "Dashboard.login_lockout_enabled", value: !!on }),
  });
  if (!d || !d.success) return toast(t("save_failed"), "er");
  toast(on ? t("login_lockout_on") : t("login_lockout_off"), "ok");
}

export async function openLoginLockoutModal() {
  var cfg = window._loginLockoutCfg || { max_fails: 10, window: 60 };
  var html =
    '<div class="settings-item-desc" style="margin-bottom:12px">' +
    esc(t("login_lockout_modal_desc")) +
    "</div>" +
    '<div class="settings-item" style="margin-bottom:8px"><div>' +
    '<div class="settings-item-label">' +
    esc(t("login_lockout_max_fails")) +
    "</div></div>" +
    '<div class="settings-item-control">' +
    '<input type="number" class="settings-input" id="lockoutMaxFails" min="3" max="100" value="' +
    cfg.max_fails +
    '" style="width:110px"/>' +
    "</div></div>" +
    '<div class="settings-item"><div>' +
    '<div class="settings-item-label">' +
    esc(t("login_lockout_window")) +
    "</div></div>" +
    '<div class="settings-item-control">' +
    '<input type="number" class="settings-input" id="lockoutWindow" min="15" max="3600" value="' +
    cfg.window +
    '" style="width:110px"/>' +
    "</div></div>";
  var ok = await showModal(
    t("login_lockout_modal_title"),
    html,
    [
      { label: t("cancel"), value: false },
      { label: t("save"), value: true, primary: true },
    ],
  );
  if (!ok) return;
  var mf = parseInt(document.getElementById("lockoutMaxFails").value, 10);
  var win = parseInt(document.getElementById("lockoutWindow").value, 10);
  if (!mf || mf < 3) mf = 3;
  if (!win || win < 15) win = 15;
  var r1 = await api("/api/config", {
    method: "PUT",
    body: JSON.stringify({ key: "Dashboard.login_lockout_max_fails", value: mf }),
  });
  var r2 = await api("/api/config", {
    method: "PUT",
    body: JSON.stringify({ key: "Dashboard.login_lockout_window", value: win }),
  });
  if (!r1 || !r1.success || !r2 || !r2.success)
    return toast(t("save_failed"), "er");
  toast(t("login_lockout_saved"), "ok");
  loadLoginLockout();
}
