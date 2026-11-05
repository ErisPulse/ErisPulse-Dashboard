// ErisPulse Dashboard – components/subnav
// 通用「左侧子导航 + 右侧内容」布局控制器（样式：ep-subnav.css）
//
// 结构约定：
//   <div class="ep-subnav" data-subnav>
//     <aside class="ep-subnav-aside">
//       <nav class="ep-subnav-nav">
//         <button class="ep-subnav-item" data-pane="paneId">…</button>
//         <button class="ep-subnav-item is-child" data-pane="subId">…</button>  ← 归属上一父项
//       </nav>
//     </aside>
//     <div class="ep-subnav-body">
//       <div class="ep-subnav-pane" data-pane-id="paneId">…</div>
//       <div class="ep-subnav-pane" data-pane-id="subId" data-parent="paneId">…</div>
//     </div>
//   </div>
//
// pane 声明 data-parent 时，激活该 pane 会同时高亮其父导航项。
// data-subnav-onswitch="全局函数名" 可选：切换后回调 fn(paneId, navItem, paneEl)。

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

  // 单动态 pane 模式：pane 的 data-pane-id 可在渲染时动态改写为当前项
  // （适配器/模块配置页共用一个内容容器）；找不到匹配 pane 时仍设置
  // 导航高亮并触发回调，由回调负责填充内容。
  var pane = body.querySelector('.ep-subnav-pane[data-pane-id="' + paneId + '"]');
  if (pane) {
    body.querySelectorAll(".ep-subnav-pane").forEach(function (p) {
      p.classList.toggle("active", p === pane);
    });
  }

  // 子面板归属父分区：导航高亮跟随父项（子项自身也保持高亮）
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
  // 首个 pane 默认激活（无激活项时）
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

// 事件委托：任意 ep-subnav-item 点击即切换（无需每处绑事件）
document.addEventListener("click", function (e) {
  var item = e.target.closest && e.target.closest(".ep-subnav-item");
  if (!item) return;
  var sub = item.closest("[data-subnav]");
  if (!sub) return;
  if (!item.dataset.pane) return;
  selectSubnavPane(sub, item.dataset.pane);
});
