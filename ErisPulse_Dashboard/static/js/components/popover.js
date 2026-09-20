// ErisPulse Dashboard – components/popover (auto-split from dash.js)

export function initPopovers() {
  // 定位popover
  function positionPopover(trigger, popover) {
    const rect = trigger.getBoundingClientRect();
    const gap = 12;

    // 先显示popover获取实际尺寸
    popover.style.visibility = "hidden";
    popover.style.display = "block";
    const popoverHeight = popover.offsetHeight;
    const popoverWidth = popover.offsetWidth;
    popover.style.visibility = "";
    popover.style.display = "";

    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;

    // 优先显示在上方
    let top = rect.top - popoverHeight - gap;
    let left = rect.left + (rect.width - popoverWidth) / 2;

    // 如果上方空间不够，显示在下方
    if (top < gap) {
      top = rect.bottom + gap;
    }

    // 如果下方也不够，选择空间更大的一方
    if (top + popoverHeight > viewportH - gap) {
      const spaceAbove = rect.top - gap;
      const spaceBelow = viewportH - rect.bottom - gap;
      if (spaceAbove > spaceBelow) {
        top = rect.top - popoverHeight - gap;
      } else {
        top = rect.bottom + gap;
      }
    }

    // 确保不超出左右边界
    if (left < gap) {
      left = gap;
    }
    if (left + popoverWidth > viewportW - gap) {
      left = viewportW - popoverWidth - gap;
    }

    popover.style.top = top + "px";
    popover.style.left = left + "px";
  }

  // CPU详情popover
  const cpuSection = document.getElementById("cpuSection");
  const cpuPopover = document.getElementById("cpuDetailPopover");
  const cpuClose = document.getElementById("cpuPopoverClose");

  if (cpuSection && cpuPopover) {
    let cpuPinned = false;

    // ✕ 关闭按钮在 popover 内部，需单独绑定（点击冒泡不经过触发卡片）
    if (cpuClose) {
      cpuClose.addEventListener("click", function (e) {
        e.stopPropagation();
        cpuPinned = false;
        cpuPopover.classList.remove("show");
      });
    }

    // 点击显示/隐藏
    cpuSection.addEventListener("click", function (e) {
      if (e.target.closest(".popover-close")) {
        cpuPinned = false;
        cpuPopover.classList.remove("show");
        return;
      }
      // 关闭内存popover
      if (memPopover) memPopover.classList.remove("show");

      cpuPinned = !cpuPinned;
      if (cpuPinned) {
        positionPopover(cpuSection, cpuPopover);
      }
      cpuPopover.classList.toggle("show", cpuPinned);
    });
  }

  // 内存详情popover
  const memSection = document.getElementById("memSection");
  const memPopover = document.getElementById("memDetailPopover");
  const memClose = document.getElementById("memPopoverClose");

  if (memSection && memPopover) {
    let memPinned = false;

    // ✕ 关闭按钮在 popover 内部，需单独绑定（点击冒泡不经过触发卡片）
    if (memClose) {
      memClose.addEventListener("click", function (e) {
        e.stopPropagation();
        memPinned = false;
        memPopover.classList.remove("show");
      });
    }

    // 点击显示/隐藏
    memSection.addEventListener("click", function (e) {
      if (e.target.closest(".popover-close")) {
        memPinned = false;
        memPopover.classList.remove("show");
        return;
      }
      // 关闭CPUpopover
      if (cpuPopover) cpuPopover.classList.remove("show");

      memPinned = !memPinned;
      if (memPinned) {
        positionPopover(memSection, memPopover);
      }
      memPopover.classList.toggle("show", memPinned);
    });
  }

  // 点击外部关闭所有popover
  document.addEventListener("click", function (e) {
    if (
      !e.target.closest("#cpuSection") &&
      !e.target.closest("#cpuDetailPopover")
    ) {
      if (cpuPopover) cpuPopover.classList.remove("show");
    }
    if (
      !e.target.closest("#memSection") &&
      !e.target.closest("#memDetailPopover")
    ) {
      if (memPopover) memPopover.classList.remove("show");
    }
  });

  // ESC键关闭所有popover
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (cpuPopover) cpuPopover.classList.remove("show");
      if (memPopover) memPopover.classList.remove("show");
    }
  });

  // 窗口大小变化时重新定位
  window.addEventListener("resize", function () {
    if (cpuPopover && cpuPopover.classList.contains("show")) {
      positionPopover(cpuSection, cpuPopover);
    }
    if (memPopover && memPopover.classList.contains("show")) {
      positionPopover(memSection, memPopover);
    }
  });

  // 滚动时关闭popover
  window.addEventListener(
    "scroll",
    function () {
      if (cpuPopover && cpuPopover.classList.contains("show")) {
        cpuPopover.classList.remove("show");
      }
      if (memPopover && memPopover.classList.contains("show")) {
        memPopover.classList.remove("show");
      }
    },
    { passive: true },
  );
}

document.addEventListener("DOMContentLoaded", initPopovers);;

