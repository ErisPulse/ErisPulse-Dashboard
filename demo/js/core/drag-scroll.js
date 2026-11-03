 
 
 
 

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
   
  ".log-console",
  ".transcript-msg-list",
  ".dash-events",
  "#pkgDetailDesc",
  ".fw-notes-summary",
  ".fw-notes-callout",
  ".fw-notes-group-body",
].join(",");
var _THRESHOLD = 6;  

var _dragging = false;
var _startX = 0;
var _startY = 0;
var _lastX = 0;
var _lastY = 0;
var _moved = false;
var _scroller = null;
var _prevBehavior = "";

function _enabled() {
   
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

 
function _suppressClick() {
  var kill = function (e) {
    e.stopPropagation();
    e.preventDefault();
    document.removeEventListener("click", kill, true);
  };
  document.addEventListener("click", kill, true);
   
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
    { passive: false }  
  );
  document.addEventListener("pointerup", _onUp, { passive: true });
  document.addEventListener("pointercancel", _onUp, { passive: true });
}
