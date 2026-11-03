 

export function getTheme() {
  var s = localStorage.getItem("ep_theme");
  if (s === "light" || s === "dark") return s;
   
  return "auto";
}

export function getEffectiveTheme() {
  var th = getTheme();
  if (th === "auto") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return th;
}

export function applyTheme(th) {
  if (th === "auto") {
    document.documentElement.setAttribute("data-theme", "auto");
     
  } else {
    document.documentElement.setAttribute("data-theme", th);
  }
  onThemeChanged();
}

export function onThemeChanged() {
  var img = getSetting("bg_image", "");
  if (img) {
    applyBgImage(img);  
    if (bgAutoThemeEnabled()) {
      extractImageColor(img, function (hex) {
        applyAccentColor(hex);
      });
    }
  } else if (bgAutoThemeEnabled()) {
    var col = getSetting("bg_color", "");
    if (col) applyAccentColor(deriveAccentFromBg(col));
  }
   
  if (!bgAutoThemeEnabled()) {
    var accent = getSetting("accent_color", "");
    if (accent) applyAccentColor(accent);
  }
  if (typeof syncBgCardUI === "function") syncBgCardUI();
}

 
 
export function refreshAppearanceChains() {
  var img = getSetting("bg_image", "");
  if (img) applyBgImage(img);
  var accent = getSetting("accent_color", "");
  if (accent && !bgAutoThemeEnabled()) applyAccentColor(accent);
  if (typeof syncBgCardUI === "function") syncBgCardUI();
  if (typeof updateOledHint === "function") updateOledHint();
}

export function toggleTheme() {
  var cur = getTheme();
  var next = cur === "light" ? "dark" : cur === "dark" ? "auto" : "light";
  localStorage.setItem("ep_theme", next);
  applyTheme(next);
}

export function getUiStyle() {
  var s = localStorage.getItem("ep_ui_style");
  return s === "cel" ? s : "eris";
}

export function applyUiStyle(style) {
  if (style !== "cel") style = "eris";
  localStorage.setItem("ep_ui_style", style);
  document.documentElement.setAttribute("data-ui-style", style);
   
  refreshAppearanceChains();
}

export function getFont() {
  return localStorage.getItem("ep_font") || "system";
}

function _ensureFontFace(name, url) {
  var el = document.getElementById("customFontFaces");
  if (!el) {
    el = document.createElement("style");
    el.id = "customFontFaces";
    document.head.appendChild(el);
  }
  var marker = 'font-family: "' + name + '"';
  if (el.textContent.indexOf(marker) === -1) {
    var fmt = /\.woff2$/.test(url)
      ? 'format("woff2")'
      : /\.woff$/.test(url)
        ? 'format("woff")'
        : /\.otf$/.test(url)
          ? 'format("opentype")'
          : 'format("truetype")';
    el.textContent +=
      '\n@font-face {\n  font-family: "' + name + '";\n  src: url("' + url + '") ' + fmt + ';\n  font-display: swap;\n}';
  }
}

export function applyFont(id) {
  var root = document.documentElement;
   
  if (id && id.indexOf("custom:") === 0) {
    var url = id.slice(7);
    var hit = (window._customFonts || []).find(function (f) {
      return f.url === url;
    });
    if (hit) {
      _ensureFontFace(hit.name, hit.url);
      var stack =
        '"' + hit.name + '", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
      root.style.setProperty("--font-body", stack);
      root.style.setProperty("--font-display", stack);
      return;
    }
  }
   
  if (!id || id === "system") {
    root.style.removeProperty("--font-body");
    root.style.removeProperty("--font-display");
    return;
  }
  var preset = FONT_PRESETS.find(function(f) { return f.id === id; });
  if (!preset) {
    root.style.removeProperty("--font-body");
    root.style.removeProperty("--font-display");
    return;
  }
  var bodyStack = preset.body.replace(/"(.*?)"/, function(_, n) {
    return '"' + n + '", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
  });
  var displayStack = preset.display.replace(/"(.*?)"/, function(_, n) {
    return '"' + n + '", "PingFang SC", "Microsoft YaHei", serif';
  });
  root.style.setProperty("--font-body", bodyStack);
  root.style.setProperty("--font-display", displayStack);
}

export function getOled() {
  return localStorage.getItem("ep_oled") === "on";
}

export function applyOled(on) {
  if (on) {
    document.documentElement.setAttribute("data-oled", "on");
  } else {
    document.documentElement.removeAttribute("data-oled");
  }
   
  refreshAppearanceChains();
}

export function hexToRgbStr(hex) {
  var c = hexToRgbObj(hex);
  return c.r + ", " + c.g + ", " + c.b;
}

export function shadeHex(hex, pct) {
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

function hexToRgbObj(hex) {
  hex = String(hex || "").replace("#", "");
  if (hex.length === 3)
    hex = hex
      .split("")
      .map(function (c) {
        return c + c;
      })
      .join("");
  return {
    r: parseInt(hex.substr(0, 2), 16) || 0,
    g: parseInt(hex.substr(2, 2), 16) || 0,
    b: parseInt(hex.substr(4, 2), 16) || 0,
  };
}

 
export function relLuminance(rgb) {
  var f = function (v) {
    v = v / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(rgb.r) + 0.7152 * f(rgb.g) + 0.0722 * f(rgb.b);
}

export function contrastRatio(hexA, hexB) {
  var la = relLuminance(hexToRgbObj(hexA));
  var lb = relLuminance(hexToRgbObj(hexB));
  var hi = Math.max(la, lb),
    lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

 
function _surfaceHexForContrast() {
  var dark = getEffectiveTheme() === "dark";
  if (getUiStyle() === "cel") return dark ? "#20242f" : "#ffffff";
  if (dark && getOled()) return "#0a0d12";
  return dark ? "#1c2027" : "#ffffff";
}

 
 
 
export function ensureAccentReadable(hex) {
  var surface = _surfaceHexForContrast();
  var ratio = contrastRatio(hex, surface);
  if (ratio >= 4.5) return hex;
  var target = ratio >= 2.6 ? 3.4 : 4.5;
  var darken = relLuminance(hexToRgbObj(surface)) > 0.35;  
  var out = hex;
  for (var i = 0; i < 20 && contrastRatio(out, surface) < target; i++) {
    var next = shadeHex(out, darken ? -3 : 3);
    if (next === out) break;  
    out = next;
  }
  return out;
}

 
function ensureFillReadable(hex) {
  var out = hex;
  for (var i = 0; i < 16 && contrastRatio(out, "#ffffff") < 3.0; i++) {
    var next = shadeHex(out, -3);
    if (next === out) break;
    out = next;
  }
  return out;
}

export function applyAccentColor(hex) {
  if (!hex) return;
  hex = ensureAccentReadable(hex);  
  setSetting("accent_color", hex);
  var root = document.documentElement.style;
  root.setProperty("--accent", hex);
  root.setProperty("--accent-rgb", hexToRgbStr(hex));
   
  root.setProperty("--accent-fill", ensureFillReadable(shadeHex(hex, -18)));
  root.setProperty("--accent-fill-h", ensureFillReadable(shadeHex(hex, -28)));
  root.setProperty("--accent-h", shadeHex(hex, -10));
  root.setProperty("--lk", hex);
  syncAccentUI(hex);
}

 
export async function pickAccentFromScreen() {
  if (window.EyeDropper) {
    try {
      var res = await new EyeDropper().open();
      if (res && res.sRGBHex) {
        applyAccentColorManual(res.sRGBHex);
        return;
      }
    } catch (e) {
      if (e && e.name === "AbortError") return;  
       
    }
  }
  var input = document.getElementById("settingsAccent");
  if (input) input.click();
}

export function applyAccentColorManual(hex) {
   
  if (bgAutoThemeEnabled()) {
    localStorage.setItem("ep_setting_bg_auto_theme", "false");
    var autoChk = document.getElementById("settingsBgAutoTheme");
    if (autoChk) autoChk.checked = false;
  }
  applyAccentColor(hex);
}

export function applyBgColor(hex) {
  if (!hex) return;
  setSetting("bg_color", hex);
  document.documentElement.style.setProperty("--bg-p", hex);
  clearBgImage();
   
  if (bgAutoThemeEnabled()) {
    applyAccentColor(deriveAccentFromBg(hex));
  }
  var bgInput = document.getElementById("settingsBg");
  if (bgInput) bgInput.value = hex;
}

export function applyBgColorManual(hex) {
  applyBgColor(hex);
}

export function applyBgImageFile(file) {
  if (!file) return;
   
  var fileInput = document.getElementById("settingsBgFile");
  if (fileInput) fileInput.value = "";
  var reader = new FileReader();
  reader.onload = function (e) {
    var dataUrl = e.target.result;
     
     
    setSetting("bg_tile", "0");  
    setSetting("bg_image", dataUrl);
    applyBgImage(dataUrl);
    showBgAutoThemeRow(true);
    if (bgAutoThemeEnabled()) {
      extractImageColor(dataUrl, function (hex) {
        applyAccentColor(hex);
      });
    }
     
    uploadBgImage(file).then(function (url) {
      if (url && getSetting("bg_image", "") === dataUrl) {
        setSetting("bg_image", url);
        applyBgImage(url);
      }
       
    });
  };
  reader.readAsDataURL(file);
}

export async function uploadBgImage(file) {
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

 
 
export function getBgTrans() {
  var v = getSetting("bg_trans", null);
  if (v === null) {
    var legacy = getSetting("bg_level", null);
    if (legacy !== null) {
      v = legacy;
      setSetting("bg_trans", legacy);
      localStorage.removeItem("ep_setting_bg_level");
    }
  }
  if (v === null) v = "standard";
  return BG_TRANS_LEVELS.indexOf(v) !== -1 ? v : "standard";
}

 
export function applyBgTransClass() {
  var root = document.documentElement.classList;
  root.remove("bg-level-soft", "bg-level-strong");
  var lvl = getBgTrans();
  if (lvl === "soft") root.add("bg-level-soft");
  else if (lvl === "strong") root.add("bg-level-strong");
}

 
export function applySettingBgLevel(level) {
  if (BG_TRANS_LEVELS.indexOf(level) === -1) level = "standard";
  setSetting("bg_trans", level);
  applyBgTransClass();
   
   
  document.body.style.backgroundImage = _bgOverlayCss() + _currentBgImageCss();
  if (typeof syncBgCardUI === "function") syncBgCardUI();
}

 
export function applySettingBgTrans(level) {
  applySettingBgLevel(level);
}

 
var BG_OVERLAY_ALPHA = {
  light: { soft: 0.72, standard: 0.58, strong: 0.42 },
  dark: { soft: 0.66, standard: 0.52, strong: 0.36 },
};

function _bgOverlayCss() {
  var dark = getEffectiveTheme() === "dark";
  var oled = dark && getOled();
  var rgb = oled ? "0, 0, 0" : dark ? "10,14,23" : "244,247,252";
  var a = (BG_OVERLAY_ALPHA[dark ? "dark" : "light"] || BG_OVERLAY_ALPHA.light)[getBgTrans()];
  if (typeof a !== "number") a = 0.55;
   
  if (getBgEffect() === "misty") a = Math.min(0.92, a + 0.14);
   
  if (oled) a = Math.min(0.94, a + 0.1);
  return "linear-gradient(rgba(" + rgb + "," + a + "),rgba(" + rgb + "," + a + "))";
}

 
export function getBgEffect() {
  var v = getSetting("bg_effect", "none");
  return v === "frosted" || v === "misty" ? v : "none";
}

export function applyBgEffectClass() {
  var root = document.documentElement;
  root.removeAttribute("data-bg-effect");
  var eff = getBgEffect();
  if (eff !== "none") root.setAttribute("data-bg-effect", eff);
}

export function applySettingBgEffect(eff) {
  if (eff !== "frosted" && eff !== "misty") eff = "none";
  setSetting("bg_effect", eff);
  applyBgEffectClass();
   
  document.body.style.backgroundImage = _bgOverlayCss() + _currentBgImageCss();
  if (typeof syncBgCardUI === "function") syncBgCardUI();
}

 
var _curBgImage = "";

function _currentBgImageCss() {
  return _curBgImage ? ', url("' + _curBgImage + '")' : "";
}

export function applyBgImage(dataUrl) {
  if (!dataUrl) return;
  _curBgImage = dataUrl;
   
   
   
  document.documentElement.classList.add("bg-image");
  applyBgTransClass();
  applyBgEffectClass();
  document.body.style.backgroundImage = _bgOverlayCss() + ', url("' + dataUrl + '")';
   
  if (getSetting("bg_tile", "0") === "1") {
    document.body.style.backgroundRepeat = "repeat";
    document.body.style.backgroundSize = "460px auto";
  } else {
    document.body.style.backgroundRepeat = "no-repeat";
    document.body.style.backgroundSize = "cover";
  }
  document.body.style.backgroundPosition = "center";
  document.body.style.backgroundAttachment = "fixed";
   
  document.documentElement.style.removeProperty("--bg-p");
  if (typeof syncBgCardUI === "function") syncBgCardUI();
}

 
export function applyBgPattern(url) {
  if (!url) return;
  setSetting("bg_image", url);
  setSetting("bg_tile", "1");
  applyBgImage(url);
  if (bgAutoThemeEnabled()) {
    extractImageColor(url, function (hex) {
      applyAccentColor(hex);
    });
  }
}

export function clearBgImage() {
  _curBgImage = "";
  document.documentElement.classList.remove("bg-image", "bg-level-soft", "bg-level-strong");
  document.documentElement.removeAttribute("data-bg-effect");
  document.body.style.removeProperty("background-image");
  document.body.style.removeProperty("background-repeat");
  document.body.style.removeProperty("background-size");
  document.body.style.removeProperty("background-position");
  document.body.style.removeProperty("background-attachment");
  if (typeof syncBgCardUI === "function") syncBgCardUI();
}

export function extractImageColor(dataUrl, cb) {
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
      var sat = mx === 0 ? 0 : (mx - mn) / mx;  
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

export function deriveAccentFromBg(hex) {
  hex = hex.replace("#", "");
  var num = parseInt(hex, 16);
  var r = (num >> 16) & 255,
    g = (num >> 8) & 255,
    b = num & 255;
  var mx = Math.max(r, g, b),
    mn = Math.min(r, g, b);
  var sat = mx === 0 ? 0 : (mx - mn) / mx;
   
  if (sat < 0.12) return "#4fa6de";
   
  return themeAwareAccent("#" + hex);
}

export function themeAwareAccent(hex) {
  var dark = getEffectiveTheme() === "dark";
  return shadeHex(hex, dark ? 14 : -18);
}

export function bgAutoThemeEnabled() {
  return localStorage.getItem("ep_setting_bg_auto_theme") !== "false";
}

export function showBgAutoThemeRow(show) {
  var row = document.getElementById("bgAutoThemeRow");
  if (row) row.style.display = show ? "flex" : "none";
}

export function onBgAutoThemeToggle(checked) {
  localStorage.setItem("ep_setting_bg_auto_theme", checked);
  if (checked) {
     
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

export function resetBg() {
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

export function resetAccent() {
  localStorage.removeItem("ep_setting_accent_color");
  var root = document.documentElement.style;
  root.removeProperty("--accent");
  root.removeProperty("--accent-rgb");
  root.removeProperty("--accent-fill");
  root.removeProperty("--accent-fill-h");
  root.removeProperty("--accent-h");
  root.removeProperty("--lk");
  syncAccentUI("#4fa6de");
}

export function syncAccentUI(hex) {
  document.querySelectorAll(".accent-chip").forEach(function (s) {
    s.classList.toggle("active", s.dataset.color === hex);
  });
  var accentInput = document.getElementById("settingsAccent");
  if (accentInput) accentInput.value = hex;
}

 
export function initAccentSwatches() {
  var wrap = document.getElementById("accentSwatches");
  if (!wrap) return;
  wrap.innerHTML = "";
  ACCENT_PRESETS.forEach(function (c) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "accent-chip";
    btn.dataset.color = c;
    btn.title = c.toUpperCase();
    btn.style.setProperty("--chip", c);
    btn.innerHTML =
      '<span class="accent-chip-dot"></span>' +
      '<span class="accent-chip-sample">Aa</span>';
    btn.onclick = function () {
      applyAccentColorManual(c);
    };
    wrap.appendChild(btn);
  });
  var cur = getSetting("accent_color", "");
  syncAccentUI(cur || "#4fa6de");
}

export function getFullCustomTheme() {
  try { return JSON.parse(localStorage.getItem('ep_full_custom_theme')); } catch(e) { return null; }
}

export function applyFullCustomTheme() {
  var d = getFullCustomTheme();
  if (!d || !d.enabled) {
    FULL_THEME_VARS.forEach(function(v) { document.documentElement.style.removeProperty(v.key); });
    return;
  }
  Object.keys(d.vars).forEach(function(k) { if (d.vars[k]) document.documentElement.style.setProperty(k, d.vars[k]); });
}

export function initCustomThemeEditor() {
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

export function onCustomThemeToggle(enabled) {
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

export function saveFullCustomTheme() {
  var saved = getFullCustomTheme() || { vars:{}, enabled:true };
  var c = document.getElementById('customThemeVars');
  if (c) c.querySelectorAll('.ct-input').forEach(function(el) { if (el.value) saved.vars[el.dataset.var] = el.value; });
  saved.enabled = true;
  localStorage.setItem('ep_full_custom_theme', JSON.stringify(saved));
  applyFullCustomTheme();
  document.getElementById('customThemeToggle').checked = true;
  if (c) c.querySelectorAll('input,button').forEach(function(el) { el.disabled = false; });
}

export function resetFullCustomTheme() {
  localStorage.removeItem('ep_full_custom_theme');
  applyFullCustomTheme();
  var c = document.getElementById('customThemeVars');
  if (c) { c.querySelectorAll('.ct-input').forEach(function(el) { el.value = ''; }); }
  document.getElementById('customThemeToggle').checked = false;
  if (c) c.querySelectorAll('input,button').forEach(function(el) { el.disabled = true; });
}

export function resetThemeVar(key) {
  document.documentElement.style.removeProperty(key);
  var c = document.getElementById('customThemeVars');
  if (c) { var i = c.querySelector('.ct-input[data-var="' + key + '"]'); if (i) i.value = ''; }
}

export function applyCustomTheme() {
  var img = getSetting("bg_image", "");
  var col = getSetting("bg_color", "");
  var accent = getSetting("accent_color", "");
  var auto = bgAutoThemeEnabled();
  if (img) {
     
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
     
    applyAccentColor(accent);
  }
}

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function() {
  if (getTheme() === "auto") {
    onThemeChanged();
  }
});;

