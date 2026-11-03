// ErisPulse Dashboard – core/drag-scroll
// 触屏 / VNC 拖拽滚动兜底：此类环境把触摸合成为鼠标拖拽，
// 浏览器默认行为是拖选文字（配合全局 user-select:none 已抑制），
// 这里把"鼠标按住拖动"翻译成容器滚动，让滑动 = 滚动。

var _DRAG_IGNORE = [
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "label",
  "[role=button]",
  "[onclick]",
  ".CodeMirror",
  ".topo-canvas",
  // 内容豁免区：日志/会话记录/事件流/Markdown 详情保持拖选复制语义
  ".log-console",
  ".transcript-msg-list",
  ".dash-events",
  "#pkgDetailDesc",
  ".fw-notes-summary",
  ".fw-notes-callout",
  ".fw-notes-group-body",
].join(",");
var _THRESHOLD = 6; // px，超过才视为拖拽（过滤点击抖动）

var _dragging = false;
var _startX = 0;
var _startY = 0;
var _lastX = 0;
var _lastY = 0;
var _moved = false;
var _scroller = null;
var _prevBehavior = "";

function _enabled() {
  // ep_touch_scroll: "auto"(默认,触屏/VNC 探测) | "on" | "off"
  var mode = null;
  try {
    mode = localStorage.getItem("ep_touch_scroll");
  } catch (e) {}
  if (mode === "on") return true;
  if (mode === "off") return false;
  return (
    (window.matchMedia && window.matchMedia("(any-pointer: coarse)").matches) ||
    "ontouchstart" in window
  );
}

function _onDown(e) {
  // 只接管被合成为鼠标的触摸拖拽；真触点走原生滚动，避免双滚
  if (e.pointerType !== "mouse" || e.button !== 0) return;
  if (!_enabled()) return;
  if (e.target.closest && e.target.closest(_DRAG_IGNORE)) return;
  var scroller = e.target.closest
    ? e.target.closest(".page, .sidebar-nav")
    : null;
  if (!scroller) return;
  _scroller = scroller;
  _dragging = true;
  _moved = false;
  _startX = _lastX = e.clientX;
  _startY = _lastY = e.clientY;
  // CSS 的 scroll-behavior:smooth 会把每次 scrollTop 赋值变成异步动画，
  // 拖动中连续赋值互相打断导致"拖不动"——拖动期间强制 auto，结束后还原
  _prevBehavior = scroller.style.scrollBehavior;
  scroller.style.scrollBehavior = "auto";
}

function _onMove(e) {
  if (!_dragging || !_scroller) return;
  var dx = e.clientX - _lastX;
  var dy = e.clientY - _lastY;
  if (!_moved) {
    if (
      Math.abs(e.clientX - _startX) < _THRESHOLD &&
      Math.abs(e.clientY - _startY) < _THRESHOLD
    )
      return;
    _moved = true;
  }
  e.preventDefault();
  _scroller.scrollTop -= dy;
  _scroller.scrollLeft -= dx;
  _lastX = e.clientX;
  _lastY = e.clientY;
}

function _onUp() {
  if (_dragging && _moved) _suppressClick();
  if (_scroller) _scroller.style.scrollBehavior = _prevBehavior;
  _dragging = false;
  _scroller = null;
}

// 拖拽结束后吞掉紧随的一次 click，防止滑动松手误触按钮/卡片
function _suppressClick() {
  var kill = function (e) {
    e.stopPropagation();
    e.preventDefault();
    document.removeEventListener("click", kill, true);
  };
  document.addEventListener("click", kill, true);
  // 兜底：异常路径下 400ms 后自动解除，避免永久吞点击
  setTimeout(function () {
    document.removeEventListener("click", kill, true);
  }, 400);
}

export function initDragScroll() {
  if (window.__epDragScrollInit) return;
  window.__epDragScrollInit = true;
  document.addEventListener("pointerdown", _onDown, { passive: true });
  document.addEventListener(
    "pointermove",
    _onMove,
    { passive: false } // 需要 preventDefault 阻断默认拖选
  );
  document.addEventListener("pointerup", _onUp, { passive: true });
  document.addEventListener("pointercancel", _onUp, { passive: true });
}
