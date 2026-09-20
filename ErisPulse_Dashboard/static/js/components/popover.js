 

export function initPopovers() {
   
  function positionPopover(trigger, popover) {
    const rect = trigger.getBoundingClientRect();
    const gap = 12;

     
    popover.style.visibility = "hidden";
    popover.style.display = "block";
    const popoverHeight = popover.offsetHeight;
    const popoverWidth = popover.offsetWidth;
    popover.style.visibility = "";
    popover.style.display = "";

    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;

     
    let top = rect.top - popoverHeight - gap;
    let left = rect.left + (rect.width - popoverWidth) / 2;

     
    if (top < gap) {
      top = rect.bottom + gap;
    }

     
    if (top + popoverHeight > viewportH - gap) {
      const spaceAbove = rect.top - gap;
      const spaceBelow = viewportH - rect.bottom - gap;
      if (spaceAbove > spaceBelow) {
        top = rect.top - popoverHeight - gap;
      } else {
        top = rect.bottom + gap;
      }
    }

     
    if (left < gap) {
      left = gap;
    }
    if (left + popoverWidth > viewportW - gap) {
      left = viewportW - popoverWidth - gap;
    }

    popover.style.top = top + "px";
    popover.style.left = left + "px";
  }

   
  const cpuSection = document.getElementById("cpuSection");
  const cpuPopover = document.getElementById("cpuDetailPopover");
  const cpuClose = document.getElementById("cpuPopoverClose");

  if (cpuSection && cpuPopover) {
    let cpuPinned = false;

     
    if (cpuClose) {
      cpuClose.addEventListener("click", function (e) {
        e.stopPropagation();
        cpuPinned = false;
        cpuPopover.classList.remove("show");
      });
    }

     
    cpuSection.addEventListener("click", function (e) {
      if (e.target.closest(".popover-close")) {
        cpuPinned = false;
        cpuPopover.classList.remove("show");
        return;
      }
       
      if (memPopover) memPopover.classList.remove("show");

      cpuPinned = !cpuPinned;
      if (cpuPinned) {
        positionPopover(cpuSection, cpuPopover);
      }
      cpuPopover.classList.toggle("show", cpuPinned);
    });
  }

   
  const memSection = document.getElementById("memSection");
  const memPopover = document.getElementById("memDetailPopover");
  const memClose = document.getElementById("memPopoverClose");

  if (memSection && memPopover) {
    let memPinned = false;

     
    if (memClose) {
      memClose.addEventListener("click", function (e) {
        e.stopPropagation();
        memPinned = false;
        memPopover.classList.remove("show");
      });
    }

     
    memSection.addEventListener("click", function (e) {
      if (e.target.closest(".popover-close")) {
        memPinned = false;
        memPopover.classList.remove("show");
        return;
      }
       
      if (cpuPopover) cpuPopover.classList.remove("show");

      memPinned = !memPinned;
      if (memPinned) {
        positionPopover(memSection, memPopover);
      }
      memPopover.classList.toggle("show", memPinned);
    });
  }

   
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

   
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (cpuPopover) cpuPopover.classList.remove("show");
      if (memPopover) memPopover.classList.remove("show");
    }
  });

   
  window.addEventListener("resize", function () {
    if (cpuPopover && cpuPopover.classList.contains("show")) {
      positionPopover(cpuSection, cpuPopover);
    }
    if (memPopover && memPopover.classList.contains("show")) {
      positionPopover(memSection, memPopover);
    }
  });

   
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

