 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 

var _subnavMobileMQ = window.matchMedia
  ? window.matchMedia("(max-width: 959px)")
  : { matches: false };

function _scrollChipIntoView(item) {
  try {
    item.scrollIntoView({
      behavior: "auto",
      block: "nearest",
      inline: "center",
    });
  } catch (e) {}
}

export function selectSubnavPane(subnavEl, paneId) {
  if (!subnavEl) return;
  var body = subnavEl.querySelector(".ep-subnav-body");
  if (!body) return;

   
   
   
  var pane = body.querySelector('.ep-subnav-pane[data-pane-id="' + paneId + '"]');
  if (pane) {
    body.querySelectorAll(".ep-subnav-pane").forEach(function (p) {
      p.classList.toggle("active", p === pane);
    });
  }

   
  var parentSec = (pane && pane.dataset.parent) || paneId;
  var activeItem = null;
  subnavEl.querySelectorAll(".ep-subnav-item").forEach(function (b) {
    var isSelf = b.dataset.pane === paneId;
    var isParent = b.dataset.pane === parentSec && !b.classList.contains("is-child");
    b.classList.toggle("active", isSelf || isParent);
    if (isSelf) activeItem = b;
  });

  if (activeItem && _subnavMobileMQ.matches) _scrollChipIntoView(activeItem);

  var cbName = subnavEl.dataset.subnavOnswitch;
  if (cbName && typeof window[cbName] === "function") {
    try {
      window[cbName](paneId, activeItem, pane);
    } catch (e) {}
  }
}

export function initSubnav(root) {
  var scope = root || document;
   
  scope.querySelectorAll("[data-subnav]").forEach(function (sub) {
    var hasActive =
      sub.querySelector(".ep-subnav-item.active") ||
      sub.querySelector(".ep-subnav-pane.active");
    if (!hasActive) {
      var firstPane = sub.querySelector(".ep-subnav-pane");
      if (firstPane) selectSubnavPane(sub, firstPane.dataset.paneId);
    }
  });
}

 
document.addEventListener("click", function (e) {
  var item = e.target.closest && e.target.closest(".ep-subnav-item");
  if (!item) return;
  var sub = item.closest("[data-subnav]");
  if (!sub) return;
  if (!item.dataset.pane) return;
  selectSubnavPane(sub, item.dataset.pane);
});
