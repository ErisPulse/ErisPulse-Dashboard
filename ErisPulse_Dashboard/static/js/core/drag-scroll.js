// ErisPulse Dashboard – core/drag-scroll
// 触屏 / VNC 拖拽滚动：此类环境把触摸合成为鼠标拖拽，
// 浏览器默认行为是拖选文字（启用时由 html.ep-drag-lock 挂 user-select 锁抑制），
// 这里把"鼠标按住拖动"翻译成容器滚动，让滑动 = 滚动。
// 默认开启（ep_touch_scroll 缺省视为开启，历史 auto 值同）；设置页可关闭，
// 关闭后恢复原生拖选行为。日志/会话/编辑器等豁免区始终保留拖选复制语义。

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
var _DRAG_SCROLLER = ".page, .sidebar-nav, .modal-box";
var _THRESHOLD = 6; // px，超过才视为拖拽（过滤点击抖动）

var _dragging = false;
var _startX = 0;
var _startY = 0;
var _lastX = 0;
var _lastY = 0;
var _moved = false;
var _scroller = null;
var _prevBehavior = "";

function _touchScrollMode() {
  // ep_touch_scroll: "on"(默认) | "off"；历史 auto 值按开启处理
  try {
    return localStorage.getItem("ep_touch_scroll");
  } catch (e) {
    return null;
  }
}

// 是否接管：默认开启；仅显式 off 关闭（off 同时恢复原生拖选）
function _enabled() {
  return _touchScrollMode() !== "off";
}

// 锁以 class 挂在 <html> 上（base.css 用 :where(html.ep-drag-lock) .app 匹配，
// :where() 零权重，保证内容豁免区的 user-select:text 能按书写顺序覆盖）
function _syncLock() {
  document.documentElement.classList.toggle("ep-drag-lock", _enabled());
}

// 设置页切换档位后调用：翻译按次按下实时读档，只需立即同步选择锁
export function applyTouchScrollMode() {
  _syncLock();
}

function _onDown(e) {
  // 只接管被合成为鼠标的触摸拖拽；真触点走原生滚动
  if (e.pointerType !== "mouse" || e.button !== 0) return;
  if (!_enabled()) return;
  if (e.target.closest && e.target.closest(_DRAG_IGNORE)) return;
  var scroller = e.target.closest
    ? e.target.closest(_DRAG_SCROLLER)
    : null;
  if (!scroller) return;
  _scroller = scroller;
  _dragging = true;
  _moved = false;
  _startX = _lastX = e.clientX;
  _startY = _lastY = e.clientY;
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
  _syncLock();
  document.addEventListener("pointerdown", _onDown, { passive: true });
  document.addEventListener(
    "pointermove",
    _onMove,
    { passive: false } // 需要 preventDefault 阻断默认拖选
  );
  document.addEventListener("pointerup", _onUp, { passive: true });
  document.addEventListener("pointercancel", _onUp, { passive: true });
}
