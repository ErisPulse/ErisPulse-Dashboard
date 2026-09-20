// ErisPulse Dashboard – pages/appearance (auto-split from dash.js)

export function getTheme() {
  var s = localStorage.getItem("ep_theme");
  if (s === "light" || s === "dark") return s;
  // auto or unset — follow system
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
    // The actual CSS is driven by @media (prefers-color-scheme) on [data-theme="auto"]
  } else {
    document.documentElement.setAttribute("data-theme", th);
  }
  onThemeChanged();
}

export function onThemeChanged() {
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

export function toggleTheme() {
  var cur = getTheme();
  var next = cur === "light" ? "dark" : cur === "dark" ? "auto" : "light";
  localStorage.setItem("ep_theme", next);
  applyTheme(next);
}

export function getUiStyle() {
  return FIXED_UI_STYLE;
}

export function applyUiStyle(style) {
  document.documentElement.setAttribute("data-ui-style", FIXED_UI_STYLE);
}

export function getFont() {
  return localStorage.getItem("ep_font") || "sora";
}

export function applyFont(id) {
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

export function getOled() {
  return localStorage.getItem("ep_oled") === "on";
}

export function applyOled(on) {
  if (on) {
    document.documentElement.setAttribute("data-oled", "on");
  } else {
    document.documentElement.removeAttribute("data-oled");
  }
}

export function hexToRgbStr(hex) {
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

export function applyAccentColor(hex) {
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

export function applyAccentColorManual(hex) {
  // 手动选择强调色时自动关闭自动取色，避免刷新后被覆盖
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
  // 默认：背景色变化时同步推导一个柔和的强调色
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

export function applyBgImage(dataUrl) {
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

export function clearBgImage() {
  document.body.style.removeProperty("background-image");
  document.body.style.removeProperty("background-size");
  document.body.style.removeProperty("background-position");
  document.body.style.removeProperty("background-attachment");
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

export function deriveAccentFromBg(hex) {
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
  syncAccentUI("#4fa6de");
}

export function syncAccentUI(hex) {
  var swatches = document.querySelectorAll(".color-swatch");
  swatches.forEach(function (s) {
    s.classList.toggle("active", s.dataset.color === hex);
  });
  var accentInput = document.getElementById("settingsAccent");
  if (accentInput) accentInput.value = hex;
}

export function initAccentSwatches() {
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

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function() {
  if (getTheme() === "auto") {
    onThemeChanged();
  }
});;

