// ErisPulse Dashboard – core/themepack
// 主题包 v2：zip 压缩包（theme.json 清单 + theme.css + 可选 theme.js + assets/）。
// 主题包拥有完整的 JS/CSS 执行权限——导入前必须经用户确认来源。
// 纯前端解压：手工解析 zip 中央目录 + DecompressionStream("deflate-raw")。

var TP_STYLE_ID = "epThemePack";
var TP_SCRIPT_ID = "epThemePackScript";
var TP_STORE_KEY = "ep_theme_pack";
var TP_ASSET_PREFIX = "assets/";

function _tpB64FromBytes(bytes) {
  var bin = "";
  var chunk = 0x8000;
  for (var i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunk),
    );
  }
  return btoa(bin);
}

function _tpBytesFromB64(b64) {
  var bin = atob(b64);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function _tpInflateRaw(data) {
  if (typeof DecompressionStream === "undefined")
    throw new Error("浏览器不支持解压（需现代浏览器）");
  var ds = new DecompressionStream("deflate-raw");
  var buf = await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer();
  return new Uint8Array(buf);
}

// 解析 zip（存储方法 0 / deflate 8），返回 [{name, bytes}]
export async function themepackUnzip(buffer) {
  var dv = new DataView(buffer);
  var u8 = new Uint8Array(buffer);
  var eocd = -1;
  for (var i = u8.length - 22; i >= 0 && i > u8.length - 66000; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("不是有效的 zip 文件");
  var count = dv.getUint16(eocd + 10, true);
  var ptr = dv.getUint32(eocd + 16, true);
  var entries = [];
  for (var n = 0; n < count; n++) {
    if (dv.getUint32(ptr, true) !== 0x02014b50) break;
    var method = dv.getUint16(ptr + 10, true);
    var csize = dv.getUint32(ptr + 20, true);
    var nameLen = dv.getUint16(ptr + 28, true);
    var extraLen = dv.getUint16(ptr + 30, true);
    var cmtLen = dv.getUint16(ptr + 32, true);
    var lho = dv.getUint32(ptr + 42, true);
    var name = new TextDecoder().decode(u8.slice(ptr + 46, ptr + 46 + nameLen));
    if (name.endsWith("/")) {
      ptr += 46 + nameLen + extraLen + cmtLen;
      continue;
    }
    var lnLen = dv.getUint16(lho + 26, true);
    var leLen = dv.getUint16(lho + 28, true);
    var dataStart = lho + 30 + lnLen + leLen;
    var raw = u8.slice(dataStart, dataStart + csize);
    var content = method === 0 ? raw : await _tpInflateRaw(raw);
    entries.push({ name: name, bytes: content });
    ptr += 46 + nameLen + extraLen + cmtLen;
  }
  if (!entries.length) throw new Error("压缩包为空");
  return entries;
}

// 组装主题包运行时：清单 + css（assets 引用改写为 blob URL）+ 可选 js
export async function themepackBuild(buffer, fallbackName) {
  var entries = await themepackUnzip(buffer);
  var byName = {};
  entries.forEach(function (e) {
    byName[e.name] = e.bytes;
  });
  var manifest = { name: fallbackName };
  if (byName["theme.json"]) {
    try {
      var m = JSON.parse(new TextDecoder().decode(byName["theme.json"]));
      if (m && m.name) manifest.name = m.name;
      if (m) manifest.meta = m;
    } catch (e) {}
  }
  var cssName = byName["theme.css"] ? "theme.css" : null;
  if (!cssName) {
    entries.forEach(function (e) {
      if (!cssName && e.name.endsWith(".css")) cssName = e.name;
    });
  }
  if (!cssName) throw new Error("包内缺少 theme.css");
  var css = new TextDecoder().decode(byName[cssName]);

  // assets → blob URL，并改写 css 中的相对引用（url(assets/…)、src="assets/…"）
  var assets = {};
  entries.forEach(function (e) {
    if (e.name.indexOf(TP_ASSET_PREFIX) === 0 && e.bytes.length) {
      var type = /\.png$/i.test(e.name)
        ? "image/png"
        : /\.jpe?g$/i.test(e.name)
          ? "image/jpeg"
          : /\.webp$/i.test(e.name)
            ? "image/webp"
            : /\.gif$/i.test(e.name)
              ? "image/gif"
              : /\.svg$/i.test(e.name)
                ? "image/svg+xml"
                : /\.woff2$/i.test(e.name)
                  ? "font/woff2"
                  : "application/octet-stream";
      assets[e.name] = URL.createObjectURL(new Blob([e.bytes], { type: type }));
    }
  });
  Object.keys(assets).forEach(function (path) {
    var rel = path.slice(TP_ASSET_PREFIX.length);
    css = css.split("assets/" + rel).join(assets[path]);
  });

  var js = byName["theme.js"] ? new TextDecoder().decode(byName["theme.js"]) : "";
  return {
    name: manifest.name,
    css: css,
    js: js,
    assets: assets,
    meta: manifest.meta || {},
  };
}

// 应用到页面：样式注入 + 可选脚本执行（调用方须已完成来源确认）
export function themepackApply(pack) {
  var el = document.getElementById(TP_STYLE_ID);
  if (!el) {
    el = document.createElement("style");
    el.id = TP_STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = pack.css || "";
  var oldScript = document.getElementById(TP_SCRIPT_ID);
  if (oldScript) oldScript.remove();
  if (pack.js) {
    var script = document.createElement("script");
    script.id = TP_SCRIPT_ID;
    script.textContent = pack.js + "\n//# sourceURL=themepack.js";
    document.body.appendChild(script);
  }
}

export function themepackRemove() {
  var el = document.getElementById(TP_STYLE_ID);
  if (el) el.remove();
  var script = document.getElementById(TP_SCRIPT_ID);
  if (script) script.remove();
}

// 持久化：zip 字节存 base64（≤4MB，超出建议改用自定义 CSS）
export function themepackSave(buffer, name) {
  var b64 = _tpB64FromBytes(new Uint8Array(buffer));
  if (b64.length > 4 * 1024 * 1024)
    throw new Error("主题包过大（base64 超过 4MB），请精简包内容");
  localStorage.setItem(
    TP_STORE_KEY,
    JSON.stringify({ name: name, zip: b64 }),
  );
}

export function themepackClear() {
  localStorage.removeItem(TP_STORE_KEY);
  themepackRemove();
}

// 开机恢复：解包持久化的 zip 并应用
export async function themepackRestore() {
  var raw = localStorage.getItem(TP_STORE_KEY);
  if (!raw) return;
  try {
    var stored = JSON.parse(raw);
    var pack = await themepackBuild(_tpBytesFromB64(stored.zip).buffer, stored.name);
    themepackApply(pack);
  } catch (e) {
    console.debug("themepack restore failed:", e);
  }
}
