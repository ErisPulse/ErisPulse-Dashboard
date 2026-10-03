// ErisPulse Dashboard – core/liquid-glass
// 真实液态玻璃引擎：移植自 Shu Ding 的 liquid-glass（MIT, 2025）
// https://github.com/shuding/liquid-glass
// 原理：canvas 逐像素生成位移贴图（圆角矩形 SDF 边缘折射环）→
// feImage + feDisplacementMap → backdrop-filter: url(#filter)。
// 仅 Chromium 支持 SVG 滤镜形式的 backdrop-filter；不支持时由
// glass.css 的 blur 玻璃优雅兜底（本引擎自动跳过挂载）。

var _lgStates = new Map(); // el -> { svg, observer, prevFilter, opts, pending }
var _lgSupport;

function _lgSmoothStep(a, b, t) {
  t = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function _lgLength(x, y) {
  return Math.sqrt(x * x + y * y);
}

function _lgRoundedRectSDF(x, y, width, height, radius) {
  var qx = Math.abs(x) - width + radius;
  var qy = Math.abs(y) - height + radius;
  return (
    Math.min(Math.max(qx, qy), 0) +
    _lgLength(Math.max(qx, 0), Math.max(qy, 0)) -
    radius
  );
}

function _lgSupported() {
  if (_lgSupport === undefined) {
    var ua = navigator.userAgent || "";
    var chromium =
      /Chrome\/|Chromium\/|Edg\//.test(ua) && !/Firefox|FxiOS|Mobile Safari/.test(ua);
    _lgSupport =
      chromium &&
      typeof CSS !== "undefined" &&
      CSS.supports &&
      CSS.supports("backdrop-filter", "blur(1px)");
  }
  return _lgSupport;
}

function _lgAllowed() {
  // 桌面端 + glass 风格 + 未开启低透明度偏好时才挂载真折射
  return (
    _lgSupported() &&
    document.documentElement.getAttribute("data-ui-style") === "glass" &&
    window.innerWidth > 720 &&
    !(window.matchMedia && window.matchMedia("(prefers-reduced-transparency: reduce)").matches)
  );
}

// 生成位移贴图：边缘折射环，中心保持原样
function _lgBuildMap(canvas, w, h, opts) {
  var ctx = canvas.getContext("2d");
  var data = ctx.createImageData(w, h);
  var px = data.data;
  var halfW = 0.5 - (opts.edgeInset || 0);
  var halfH = 0.5 - (opts.edgeInset || 0);
  var ring = opts.ring != null ? opts.ring : 0.15;
  var radius = opts.radius != null ? opts.radius : 0.5;
  var maxScale = 0;
  var raw = [];
  var i, x, y, ix, iy, d, disp, scaled, dx, dy;
  for (y = 0; y < h; y++) {
    for (x = 0; x < w; x++) {
      ix = x / w - 0.5;
      iy = y / h - 0.5;
      d = _lgRoundedRectSDF(ix, iy, halfW, halfH, radius);
      disp = _lgSmoothStep(0.8, 0, d - ring);
      scaled = _lgSmoothStep(0, 1, disp);
      dx = ix * scaled * w - x;
      dy = iy * scaled * h - y;
      if (Math.abs(dx) > maxScale) maxScale = Math.abs(dx);
      if (Math.abs(dy) > maxScale) maxScale = Math.abs(dy);
      raw.push(dx, dy);
    }
  }
  maxScale *= 0.5;
  if (maxScale < 1) maxScale = 1;
  var j = 0;
  for (i = 0; i < px.length; i += 4) {
    px[i] = (raw[j++] / maxScale + 0.5) * 255;
    px[i + 1] = (raw[j++] / maxScale + 0.5) * 255;
    px[i + 2] = 0;
    px[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return maxScale;
}

function _lgRefresh(el) {
  var st = _lgStates.get(el);
  if (!st) return;
  var rect = el.getBoundingClientRect();
  var w = Math.max(2, Math.round(rect.width));
  var h = Math.max(2, Math.round(rect.height));
  var opts = st.opts;
  var filter = st.filter;
  var canvas = st.canvas;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  var maxScale = _lgBuildMap(canvas, w, h, opts);
  st.feImage.setAttribute("width", String(w));
  st.feImage.setAttribute("height", String(h));
  st.feImage.setAttributeNS(
    "http://www.w3.org/1999/xlink",
    "href",
    canvas.toDataURL(),
  );
  st.feDisplacementMap.setAttribute("scale", String(maxScale));
  filter.setAttribute("width", String(w));
  filter.setAttribute("height", String(h));
}

/**
 * 将液态玻璃折射效果挂载到既有元素。
 * opts: ring(折射环宽度, 默认 0.18), radius(圆角, 默认 0.5),
 *       blur(默认 0.4), contrast(1.15), brightness(1.05), saturate(1.15)
 * 返回 detach 函数；元素尺寸变化时自动重建贴图。
 */
export function attachLiquidGlass(el, opts) {
  if (!el || _lgStates.has(el) || !_lgSupported()) return function () {};
  // 预置在 DOM 里但隐藏的元素（如未打开的模态框）跳过，显示时由
  // initLiquidGlass 的监听器懒挂载，避免为一堆 2×2 的隐形元素建滤镜
  var rect = el.getBoundingClientRect();
  if (rect.width < 60 || rect.height < 40) return function () {};
  opts = opts || {};
  var id = "liquid-glass-" + Math.random().toString(36).slice(2, 11);

  var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  svg.style.pointerEvents = "none";
  var defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  var filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
  filter.setAttribute("id", id + "_filter");
  filter.setAttribute("filterUnits", "userSpaceOnUse");
  filter.setAttribute("colorInterpolationFilters", "sRGB");
  filter.setAttribute("x", "0");
  filter.setAttribute("y", "0");
  var feImage = document.createElementNS("http://www.w3.org/2000/svg", "feImage");
  feImage.setAttribute("result", "map");
  var feDisp = document.createElementNS("http://www.w3.org/2000/svg", "feDisplacementMap");
  feDisp.setAttribute("in", "SourceGraphic");
  feDisp.setAttribute("in2", "map");
  feDisp.setAttribute("xChannelSelector", "R");
  feDisp.setAttribute("yChannelSelector", "G");
  filter.appendChild(feImage);
  filter.appendChild(feDisp);
  defs.appendChild(filter);
  svg.appendChild(defs);
  document.body.appendChild(svg);

  var canvas = document.createElement("canvas");
  canvas.style.display = "none";
  document.body.appendChild(canvas);

  var st = {
    svg: svg,
    filter: filter,
    feImage: feImage,
    feDisplacementMap: feDisp,
    canvas: canvas,
    opts: opts,
    prevFilter: el.style.backdropFilter || "",
    observer: null,
    pending: null,
  };
  _lgStates.set(el, st);

  var refresh = function () {
    if (st.pending) clearTimeout(st.pending);
    st.pending = setTimeout(function () {
      st.pending = null;
      if (_lgStates.get(el) === st) _lgRefresh(el);
    }, 120);
  };

  el.style.backdropFilter =
    "url(#" +
    id +
    "_filter) blur(" +
    (opts.blur != null ? opts.blur : 0.4) +
    "px) contrast(" +
    (opts.contrast != null ? opts.contrast : 1.15) +
    ") brightness(" +
    (opts.brightness != null ? opts.brightness : 1.05) +
    ") saturate(" +
    (opts.saturate != null ? opts.saturate : 1.15) +
    ")";
  el.style.webkitBackdropFilter = el.style.backdropFilter;
  _lgRefresh(el);

  st.observer = new ResizeObserver(refresh);
  st.observer.observe(el);

  return function () {
    detachLiquidGlass(el);
  };
}

export function detachLiquidGlass(el) {
  var st = _lgStates.get(el);
  if (!st) return;
  st.observer && st.observer.disconnect();
  if (st.pending) clearTimeout(st.pending);
  el.style.backdropFilter = st.prevFilter;
  el.style.webkitBackdropFilter = st.prevFilter;
  st.svg.remove();
  st.canvas.remove();
  _lgStates.delete(el);
}

function _lgDetachAll() {
  Array.from(_lgStates.keys()).forEach(detachLiquidGlass);
}

// 默认挂载面：侧栏 / 顶栏 / 模态窗（大表面、静态，代价可控）
var _lgTargets = [
  { sel: ".sidebar", opts: { ring: 0.3, radius: 0.5 } },
  { sel: ".header", opts: { ring: 0.35, radius: 0.5 } },
  { sel: ".modal-box", opts: { ring: 0.16, radius: 0.4 } },
];

export function initLiquidGlass() {
  if (!_lgSupported()) return;
  var applyPending = null;
  var apply = function () {
    if (applyPending) clearTimeout(applyPending);
    applyPending = setTimeout(function () {
      applyPending = null;
      if (!_lgAllowed()) {
        _lgDetachAll();
        return;
      }
      _lgTargets.forEach(function (t) {
        document.querySelectorAll(t.sel).forEach(function (el) {
          if (!_lgStates.has(el)) attachLiquidGlass(el, t.opts);
        });
      });
    }, 120);
  };
  apply();
  // 风格切换 / 窗口跨过移动端断点 / 模态框打开（懒挂载）时重新评估
  var mo = new MutationObserver(apply);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-ui-style"],
  });
  var bo = new MutationObserver(apply);
  bo.observe(document.body, {
    attributes: true,
    attributeFilter: ["style", "class"],
    subtree: true,
  });
  var rzPending = null;
  window.addEventListener("resize", function () {
    if (rzPending) clearTimeout(rzPending);
    rzPending = setTimeout(apply, 200);
  });
}
