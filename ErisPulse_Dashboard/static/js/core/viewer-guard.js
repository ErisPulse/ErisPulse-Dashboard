// ErisPulse Dashboard – core/viewer-guard
// 只读密钥（viewer）的页面白名单：登录后按 auth 响应中的 role/pages
// 隐藏无权导航项，并在进入页面时兜底拦截。

var _role = "admin";
var _pages = []; // 空 = 不限制（viewer 全只读）

export function setAccess(role, pages) {
  _role = role === "viewer" ? "viewer" : "admin";
  _pages = Array.isArray(pages) ? pages.filter(function (p) { return typeof p === "string"; }) : [];
}

export function isViewer() {
  return _role === "viewer";
}

export function getAllowedPages() {
  return _pages.slice();
}

// 当前身份是否可访问某页面（admin 恒 true；viewer 无白名单则全允许）
export function canAccessPage(page) {
  if (_role !== "viewer") return true;
  if (!_pages.length) return true;
  return _pages.indexOf(page) !== -1;
}

// 按白名单隐藏导航项（含快捷导航与首页 pin 候选）
export function applyNavGuard() {
  if (_role !== "viewer" || !_pages.length) {
    document.documentElement.removeAttribute("data-viewer");
    return;
  }
  document.documentElement.setAttribute("data-viewer", "on");
  document.querySelectorAll(".nav-item[data-page]").forEach(function (el) {
    var page = el.getAttribute("data-page");
    if (page && _pages.indexOf(page) === -1) el.style.display = "none";
    else el.style.display = "";
  });
}

// 页面切换前的权限校验（go() 内部调用）
export function guardPage(page) {
  if (canAccessPage(page)) return true;
  if (typeof toast === "function") {
    toast(t("viewer_no_access"), "wr");
  }
  return false;
}
