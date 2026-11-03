 
 
 

var _role = "admin";
var _pages = [];  

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

 
export function canAccessPage(page) {
  if (_role !== "viewer") return true;
  if (!_pages.length) return true;
  return _pages.indexOf(page) !== -1;
}

 
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

 
export function guardPage(page) {
  if (canAccessPage(page)) return true;
  if (typeof toast === "function") {
    toast(t("viewer_no_access"), "wr");
  }
  return false;
}
