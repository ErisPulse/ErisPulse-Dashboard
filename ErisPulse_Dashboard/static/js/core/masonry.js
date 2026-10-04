// ErisPulse Dashboard – core/masonry
// 瀑布流卡片布局：按列宽自动分列（自动补齐），最短列优先摆放，
// 绝对定位 + transform 过渡实现平滑重排；ResizeObserver 自动响应
// 容器宽度与卡片高度变化。layoutMasonry(container, opts) 全局可用。

var _masonryStates = new Map(); // container -> {observer, timer}

function _masonryCols(width, colWidth, gap) {
  return Math.max(1, Math.min(12, Math.floor((width + gap) / (colWidth + gap))));
}

function _masonryLayout(container, opts) {
  var colWidth = opts.colWidth || 420;
  var gap = opts.gap || 20;
  var selector = opts.selector || ":scope > .sec-item, :scope > .card, :scope > .settings-card";
  var items = Array.prototype.slice.call(container.querySelectorAll(selector));
  if (!items.length) {
    container.style.height = "";
    return;
  }
  var width = container.clientWidth;
  if (!width) return;
  var n = _masonryCols(width, colWidth, gap);
  var colW = (width - gap * (n - 1)) / n;

  // 先统一宽度再测高，避免换行误差
  items.forEach(function (it) {
    it.style.position = "absolute";
    it.style.top = "0";
    it.style.left = "0";
    it.style.width = colW + "px";
    it.style.margin = "0";
  });

  var heights = new Array(n).fill(0);
  items.forEach(function (it) {
    var i = 0;
    for (var k = 1; k < n; k++) if (heights[k] < heights[i] - 0.5) i = k;
    var x = i * (colW + gap);
    var y = heights[i];
    it.style.transform = "translate(" + x + "px," + y + "px)";
    heights[i] += it.offsetHeight + gap;
  });
  container.style.height = Math.max(0, Math.max.apply(null, heights) - gap) + "px";
}

export function layoutMasonry(container, opts) {
  if (!container) return;
  // 首次布局不播放动画（避免元素从自然位置瞬移/半途截断），
  // 布局完成后再挂过渡类；后续重排（宽度/高度变化）走既有 --ease 体系
  _masonryLayout(container, opts || {});
  if (_masonryStates.has(container)) return;
  if (document.documentElement.getAttribute("data-anim") !== "off") {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        container.classList.add("masonry-anim");
      });
    });
  }
  // 首次接入：观察容器宽度与子项高度变化（字体加载/i18n 切换/内容展开）
  var pending = null;
  var schedule = function () {
    if (pending) clearTimeout(pending);
    pending = setTimeout(function () {
      pending = null;
      _masonryLayout(container, opts || {});
    }, 80);
  };
  var observer = new ResizeObserver(schedule);
  observer.observe(container);
  Array.prototype.slice
    .call(container.querySelectorAll(":scope > *"))
    .forEach(function (el) {
      observer.observe(el);
    });
  _masonryStates.set(container, { observer: observer });
}

export function destroyMasonry(container) {
  var st = _masonryStates.get(container);
  if (st) {
    st.observer.disconnect();
    _masonryStates.delete(container);
  }
}

// ── 通用瀑布流引导：扫描 [data-masonry] 容器自动布局 ──
// 页面内容多为异步渲染（loaders），MutationObserver 兜底内容到达后自动重排
var _mgGlobalBooted = false;

export function bootMasonryGrids() {
  if (_mgGlobalBooted) return;
  _mgGlobalBooted = true;
  var scan = function () {
    document.querySelectorAll("[data-masonry]").forEach(function (el) {
      if (!_masonryStates.has(el)) {
        layoutMasonry(el, { colWidth: 430, selector: ":scope > .card, :scope > .settings-card, :scope > .sec-item" });
      }
    });
  };
  scan();
  var pending = null;
  var mo = new MutationObserver(function () {
    if (pending) clearTimeout(pending);
    pending = setTimeout(scan, 150);
  });
  mo.observe(document.body, { childList: true, subtree: true });
}
