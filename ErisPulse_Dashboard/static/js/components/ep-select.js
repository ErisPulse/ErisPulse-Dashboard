 
 

window.EP = window.EP || {};;
EP.version = "2.0";;
 
EP._finePointer = !!(
  window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches
);;
EP._bootAt = Date.now();;

EP._enhanced = [];;

EP._pendingSelects = [];;

EP._multis = [];;

EP.positionList = function (el, anchor, maxH) {
  var rc = anchor.getBoundingClientRect();
  var margin = 8;
  var vw = window.innerWidth;
  var vh = window.innerHeight;
  var below = vh - rc.bottom - margin;
  var above = rc.top - margin;
   
  var prevVis = el.style.visibility;
  el.style.visibility = "hidden";
  el.style.display = "block";
  el.style.width = "auto";
  var contentW = el.offsetWidth;
  el.style.visibility = prevVis;
  var width = Math.max(rc.width, contentW, 160);
  if (width > vw - margin) width = vw - margin;
  var left = Math.min(rc.left, vw - margin);
  if (left + width > vw - margin) left = Math.max(margin, vw - width - margin);
  var flipUp = below < 120 && above > below;
  var space = flipUp ? above : below;
  var maxH2 = Math.max(80, Math.min(maxH, space));
  el.style.position = "fixed";
  el.style.left = left + "px";
  el.style.width = width + "px";
  el.style.maxWidth = vw - margin + "px";
  if (flipUp) {
    el.style.top = Math.max(margin, rc.top - maxH2 - 4) + "px";
  } else {
    el.style.top = rc.bottom + 4 + "px";
  }
  el.style.maxHeight = maxH2 + "px";
  el.style.display = "block";
};;

EP.enhanceSelect = function (sel) {
  if (!sel || sel.tagName !== "SELECT" || sel.dataset.epEnhanced) return sel;
  if (sel.closest(".ep-combobox")) return sel;
  sel.dataset.epEnhanced = "1";

  var wrap = document.createElement("div");
  wrap.className = "ep-combobox";
  if (sel.disabled) wrap.classList.add("disabled");
  ["width", "minWidth", "maxWidth"].forEach(function (k) {
    if (sel.style[k]) wrap.style[k] = sel.style[k];
  });

  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ep-combobox-trigger";
  btn.setAttribute("aria-haspopup", "listbox");
  var lbl = document.createElement("span");
  lbl.className = "ep-combobox-label";
  var arrow = document.createElement("span");
  arrow.className = "ep-combobox-arrow";
  arrow.innerHTML =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
  btn.appendChild(lbl);
  btn.appendChild(arrow);
  var list = document.createElement("div");
  list.className = "ep-combobox-list";
  list.setAttribute("role", "listbox");
  list.dataset.epOwner = "1";
  wrap.appendChild(btn);
  sel.parentNode.insertBefore(wrap, sel.nextSibling);
   
  document.body.appendChild(list);
  sel.classList.add("ep-native-hidden");

  var api = { select: sel, wrap: wrap, list: list, label: lbl, _last: sel.value };

  function appendOpt(opt) {
    var o = document.createElement("div");
    o.className = "ep-combobox-opt";
    o.setAttribute("role", "option");
    o.textContent = opt.textContent || opt.value || "\u00a0";
    o.dataset.value = opt.value;
    o.addEventListener("click", function (e) {
      e.stopPropagation();
      selectValue(opt.value);
    });
    list.appendChild(o);
  }
  function build() {
    list.innerHTML = "";
    Array.prototype.forEach.call(sel.children, function (child) {
      if (child.tagName === "OPTGROUP") {
        var gl = document.createElement("div");
        gl.className = "ep-combobox-group-label";
        gl.textContent = child.label || "";
        list.appendChild(gl);
        Array.prototype.forEach.call(child.children, function (opt) {
          if (opt.tagName === "OPTION") appendOpt(opt);
        });
      } else if (child.tagName === "OPTION") {
        appendOpt(child);
      }
    });
  }
  function syncUI() {
    var v = sel.value;
    var label = "";
    Array.prototype.forEach.call(sel.querySelectorAll("option"), function (opt) {
      if (String(opt.value) === String(v)) label = opt.textContent || opt.value;
    });
    if (label === "" && v === "") {
      var first = sel.querySelector("option");
      label = first ? first.textContent || first.value : "";
    }
    api.label.textContent = label || "\u00a0";
    Array.prototype.forEach.call(list.querySelectorAll(".ep-combobox-opt"), function (o) {
      o.dataset.selected = String(o.dataset.value) === String(v) ? "1" : "0";
    });
  }
  var wheelGuard = function (e) {
    var canDown = list.scrollHeight - list.scrollTop - list.clientHeight > 1;
    var canUp = list.scrollTop > 1;
    if ((e.deltaY > 0 && !canDown) || (e.deltaY < 0 && !canUp)) {
      e.preventDefault();
    }
  };
  function open() {
    build();
    syncUI();
    EP.positionList(list, btn, 260);
    list.addEventListener("wheel", wheelGuard);
    wrap.dataset.open = "1";
    btn.setAttribute("aria-expanded", "true");
    var active = list.querySelector('.ep-combobox-opt[data-selected="1"]');
    if (active) list.scrollTop = active.offsetTop - list.clientHeight / 2;
  }
  function close() {
    delete wrap.dataset.open;
    list.removeEventListener("wheel", wheelGuard);
    list.style.display = "none";
    btn.setAttribute("aria-expanded", "false");
    kbHighlight(null);
  }
  function toggle() {
    if (wrap.dataset.open === "1") close();
    else open();
  }
  function selectValue(val) {
    sel.value = val;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    api._last = val;
    syncUI();
    close();
  }

  btn.addEventListener("mousedown", function (e) {
    e.stopPropagation();
    e.preventDefault();
    toggle();
  });

   
  function kbHighlight(opt) {
    var opts = list.querySelectorAll(".ep-combobox-opt");
    Array.prototype.forEach.call(opts, function (o) {
      o.classList.remove("ep-kb-active");
    });
    if (opt) {
      opt.classList.add("ep-kb-active");
      if (opt.scrollIntoViewIfNeeded) opt.scrollIntoViewIfNeeded(false);
      else opt.scrollIntoView({ block: "nearest" });
    }
  }
  function kbMove(dir) {
    var opts = Array.prototype.slice.call(list.querySelectorAll(".ep-combobox-opt"));
    if (!opts.length) return;
    var cur = list.querySelector(".ep-combobox-opt.ep-kb-active");
    var idx = cur ? opts.indexOf(cur) + dir : dir > 0 ? 0 : opts.length - 1;
    idx = Math.max(0, Math.min(opts.length - 1, idx));
    kbHighlight(opts[idx]);
  }
  btn.addEventListener("keydown", function (e) {
    var openNow = wrap.dataset.open === "1";
    if (!openNow) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
        var sel = list.querySelector('.ep-combobox-opt[data-selected="1"]');
        kbHighlight(sel);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      kbMove(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      kbMove(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      var hit = list.querySelector(".ep-combobox-opt.ep-kb-active");
      if (hit) {
        selectValue(hit.dataset.value);
      } else {
        close();
      }
    }
  });

  var obs = new MutationObserver(function () {
    clearTimeout(api._buildTimer);
    api._buildTimer = setTimeout(function () {
      build();
      syncUI();
    }, 30);
  });
  obs.observe(sel, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["disabled"],
  });

  api.syncUI = syncUI;
  api.close = close;
  api.open = open;
  api.build = build;
  build();
  syncUI();
  EP._enhanced.push(api);
  return sel;
};;

EP.enhanceAll = function (scope) {
  var root = scope || document;
  Array.prototype.forEach.call(root.querySelectorAll("select"), function (s) {
    if (!s.dataset.epEnhanced) EP.enhanceSelect(s);
  });
};;

EP.createMultiSelect = function (opts) {
  var host = opts.host;
  var items = (opts.items || []).slice();
  var selected = opts.selected || new Set();
  var onChange = opts.onChange || function () {};
  var placeholder = opts.placeholder || "";

  var wrap = document.createElement("div");
  wrap.className = "ep-multiselect";
  var trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "ep-multiselect-trigger";
  var label = document.createElement("span");
  label.className = "ep-multiselect-label";
  var arrow = document.createElement("span");
  arrow.className = "ep-multiselect-arrow";
  arrow.innerHTML =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
  trigger.appendChild(label);
  trigger.appendChild(arrow);
  var panel = document.createElement("div");
  panel.className = "ep-multiselect-panel";
  panel.dataset.epOwner = "1";
  var search = document.createElement("input");
  search.type = "text";
  search.className = "ep-multiselect-search";
  search.placeholder = opts.searchPlaceholder || "Search...";
  var actions = document.createElement("div");
  actions.className = "ep-multiselect-actions";
  var selAll = document.createElement("button");
  selAll.type = "button";
  selAll.className = "btn btn-secondary btn-xs";
  selAll.textContent = opts.selectAll || "Select all";
  var clear = document.createElement("button");
  clear.type = "button";
  clear.className = "btn btn-secondary btn-xs";
  clear.textContent = opts.clear || "Clear";
  actions.appendChild(selAll);
  actions.appendChild(clear);
  var optsList = document.createElement("div");
  optsList.className = "ep-multiselect-list";
  panel.appendChild(search);
  panel.appendChild(actions);
  panel.appendChild(optsList);
  wrap.appendChild(trigger);
  host.appendChild(wrap);
   
  document.body.appendChild(panel);

  function render() {
     
    label.innerHTML = "";
    if (selected.size > 0) {
      var b = document.createElement("b");
      b.className = "ep-multiselect-count";
      b.textContent = selected.size;
      label.appendChild(b);
      label.appendChild(
        document.createTextNode(" " + (opts.countLabel || "")),
      );
    } else {
      label.appendChild(document.createTextNode(placeholder || "\u00a0"));
    }
    var q = (search.value || "").toLowerCase();
    optsList.innerHTML = "";
    var shown = 0;
    items.slice().sort().forEach(function (tag) {
      if (q && tag.toLowerCase().indexOf(q) === -1) return;
      shown++;
      var row = document.createElement("label");
      row.className = "ep-multiselect-opt";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = selected.has(tag);
      var span = document.createElement("span");
      span.textContent = tag;
      row.appendChild(cb);
      row.appendChild(span);
      row.addEventListener("click", function (e) {
        if (e.target !== cb) cb.click();
      });
      cb.addEventListener("change", function () {
        if (cb.checked) selected.add(tag);
        else selected.delete(tag);
        render();
        onChange();
      });
      optsList.appendChild(row);
    });
    if (shown === 0) {
      var empty = document.createElement("div");
      empty.className = "ep-multiselect-empty";
      empty.textContent = opts.emptyText || "—";
      optsList.appendChild(empty);
    }
  }
  var wheelGuard = function (e) {
    var canDown = panel.scrollHeight - panel.scrollTop - panel.clientHeight > 1;
    var canUp = panel.scrollTop > 1;
    if ((e.deltaY > 0 && !canDown) || (e.deltaY < 0 && !canUp)) {
      e.preventDefault();
    }
  };
  function open() {
    EP.positionList(panel, trigger, 320);
    panel.addEventListener("wheel", wheelGuard);
    wrap.dataset.open = "1";
     
    if (EP._finePointer) search.focus();
    render();
  }
  function close() {
    delete wrap.dataset.open;
    panel.removeEventListener("wheel", wheelGuard);
    panel.style.display = "none";
  }
  trigger.addEventListener("mousedown", function (e) {
    e.stopPropagation();
    e.preventDefault();
    if (wrap.dataset.open === "1") close();
    else open();
  });
   
  trigger.addEventListener("keydown", function (e) {
    if (
      wrap.dataset.open !== "1" &&
      (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")
    ) {
      e.preventDefault();
      open();
    }
  });
  selAll.addEventListener("click", function () {
    items.forEach(function (t) {
      selected.add(t);
    });
    render();
    onChange();
  });
  clear.addEventListener("click", function () {
    selected.clear();
    render();
    onChange();
  });
  search.addEventListener("input", render);
  panel.addEventListener("click", function (e) {
    e.stopPropagation();
  });
  render();
  var mApi = {
    wrap: wrap,
    panel: panel,
    setItems: function (arr) {
      items = (arr || []).slice();
      render();
    },
    close: close,
    getSelected: function () {
      return selected;
    },
  };
  EP._multis.push(mApi);
  return mApi;
};;

document.addEventListener(
  "mousedown",
  function (e) {
    EP._enhanced.forEach(function (api) {
      if (api.wrap.dataset.open === "1" && !api.wrap.contains(e.target) && !(api.list && api.list.contains(e.target)))
        api.close();
    });
    EP._multis.forEach(function (m) {
      if (m.wrap.dataset.open === "1" && !m.wrap.contains(e.target) && !(m.panel && m.panel.contains(e.target)))
        m.close();
    });
  },
  true,
);;

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    EP._enhanced.forEach(function (api) {
      api.close();
    });
    EP._multis.forEach(function (m) {
      m.close();
    });
  }
});;

window.addEventListener(
  "scroll",
  function (e) {
    var t = e.target;
    EP._enhanced.forEach(function (api) {
      if (api.wrap.dataset.open !== "1") return;
      if (t && t.nodeType === 1 && api.list.contains(t)) return;
      api.close();
    });
    EP._multis.forEach(function (m) {
      if (m.wrap.dataset.open !== "1") return;
      if (t && t.nodeType === 1 && m.panel.contains(t)) return;
      m.close();
    });
  },
  true,
);;

 
 
var _epLastW = window.innerWidth;
window.addEventListener("resize", function () {
  var w = window.innerWidth;
  var widthChanged = Math.abs(w - _epLastW) > 2;
  _epLastW = w;
  EP._enhanced.forEach(function (api) {
    if (api.wrap.dataset.open !== "1") return;
    if (widthChanged) {
      api.close();
      return;
    }
    var trg = api.wrap.querySelector(".ep-combobox-trigger");
    if (trg) EP.positionList(api.list, trg, 260);
  });
  EP._multis.forEach(function (m) {
    if (m.wrap.dataset.open !== "1") return;
    if (widthChanged) {
      m.close();
      return;
    }
    var trg = m.wrap.querySelector(".ep-multiselect-trigger");
    if (trg) EP.positionList(m.panel, trg, 320);
  });
});;

EP._autoObserver = new MutationObserver(function (muts) {
  muts.forEach(function (m) {
    Array.prototype.forEach.call(m.addedNodes, function (n) {
      if (n.nodeType !== 1) return;
      if (n.tagName === "SELECT" && !n.dataset.epEnhanced) EP._pendingSelects.push(n);
      else if (n.querySelectorAll) {
        Array.prototype.forEach.call(n.querySelectorAll("select"), function (s) {
          if (!s.dataset.epEnhanced) EP._pendingSelects.push(s);
        });
      }
    });
  });
  if (EP._pendingSelects.length) {
    clearTimeout(_epAutoTimer);
    _epAutoTimer = setTimeout(function () {
      EP._pendingSelects.forEach(function (s) {
        if (!s.dataset.epEnhanced) EP.enhanceSelect(s);
      });
      EP._pendingSelects = [];
      EP._cleanupOrphans();
    }, 40);
  }
});;

EP._autoObserver.observe(document.body, { childList: true, subtree: true });;

EP._cleanupOrphans = function () {
  var live = new Set();
  EP._enhanced.forEach(function (api) {
    live.add(api.list);
  });
  EP._multis.forEach(function (m) {
    live.add(m.panel);
  });
  document
    .querySelectorAll(".ep-combobox-list[data-ep-owner], .ep-multiselect-panel[data-ep-owner]")
    .forEach(function (el) {
      if (!live.has(el)) el.remove();
    });
};;

EP._tick = setInterval(function () {
  EP._enhanced.forEach(function (api) {
    if (api.select.value !== api._last) {
      api._last = api.select.value;
      api.syncUI();
    }
  });
}, 500);;

EP.enhanceAll(document);;













EP._liveFns = {
  clock: function (el) {
    el.textContent = new Date().toLocaleTimeString(
      (window.getLocale && getLocale()) || undefined,
      { hour: "2-digit", minute: "2-digit", second: "2-digit" },
    );
  },
  date: function (el) {
    el.textContent = new Date().toLocaleDateString(
      (window.getLocale && getLocale()) || undefined,
      { year: "numeric", month: "short", day: "numeric" },
    );
  },
  datetime: function (el) {
    var d = new Date();
    var loc = (window.getLocale && getLocale()) || undefined;
    el.textContent =
      d.toLocaleDateString(loc, { month: "short", day: "numeric" }) +
      " " +
      d.toLocaleTimeString(loc, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
  },
  uptime: function (el) {
    el.textContent = EP._humanUptime(Date.now() - EP._bootAt);
  },
  wsuptime: function (el) {
    var m = window._wsMeta;
    el.textContent =
      m && m.connectedAt
        ? EP._humanUptime(Date.now() - m.connectedAt)
        : "—";
  },
};
EP._humanUptime = function (ms) {
  var s = Math.floor(ms / 1000);
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  var sec = s % 60;
  return (h ? h + "h " : "") + (h || m ? m + "m " : "") + sec + "s";
};
 
EP.countUp = function (el, to, opts) {
  opts = opts || {};
  var from = parseFloat(
    opts.from != null ? opts.from : String(el.textContent).replace(/[^\d.-]/g, ""),
  );
  if (isNaN(from)) from = 0;
  if (from === to) {
    el.textContent = to;
    return;
  }
  var dur = opts.duration || 600;
  var start = performance.now();
  function frame(now) {
    var t = Math.min(1, (now - start) / dur);
    var eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
};
 
EP._statPrev = {};
EP.animateStatVals = function (container, key) {
  if (!container) return;
  key = key || "default";
  var prev = EP._statPrev[key] || {};
  var i = 0;
  Array.prototype.forEach.call(
    container.querySelectorAll(".stat-val"),
    function (el) {
      var to = parseInt(el.textContent, 10);
      if (isNaN(to)) {
        i++;
        return;
      }
      var from = prev[i] != null ? prev[i] : to;
      prev[i] = to;
      if (from !== to && from >= 0 && to >= 0)
        EP.countUp(el, to, { from: from, duration: 550 });
      i++;
    },
  );
  EP._statPrev[key] = prev;
};
 
EP.live = function (name, fn) {
  EP._liveFns[name] = fn;
  EP.refreshLive();
};
EP.refreshLive = function () {
  EP._liveTick();
};
EP._liveTick = function () {
  var nodes = document.querySelectorAll("[data-live]");
  Array.prototype.forEach.call(nodes, function (el) {
    var fn = EP._liveFns[el.dataset.live];
    if (!fn) return;
    try {
      fn(el, el.dataset);
    } catch (e) {}
  });
};
 
EP._liveTimers = {};
EP._liveSchedule = function () {
  var groups = {};
  Array.prototype.forEach.call(
    document.querySelectorAll("[data-live]"),
    function (el) {
      var p = parseInt(el.dataset.tick || "1000", 10) || 1000;
      (groups[p] = groups[p] || []).push(el);
    },
  );
  Object.keys(EP._liveTimers).forEach(function (p) {
    if (!groups[p]) {
      clearInterval(EP._liveTimers[p]);
      delete EP._liveTimers[p];
    }
  });
  Object.keys(groups).forEach(function (p) {
    if (EP._liveTimers[p]) return;
    EP._liveTimers[p] = setInterval(function () {
      if (document.hidden) return;
      groups[p].forEach(function (el) {
        if (!el.isConnected) return;
        var fn = EP._liveFns[el.dataset.live];
        if (fn)
          try {
            fn(el, el.dataset);
          } catch (e) {}
      });
    }, parseInt(p, 10));
  });
};
 
EP._liveObserver = new MutationObserver(function () {
  clearTimeout(EP._liveObsTimer);
  EP._liveObsTimer = setTimeout(function () {
    EP._liveSchedule();
    EP._liveTick();
  }, 120);
});
EP._liveObserver.observe(document.body, { childList: true, subtree: true });
EP._liveSchedule();
EP._liveTick();;


