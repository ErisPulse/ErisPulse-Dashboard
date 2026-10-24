// ErisPulse Dashboard – components/ep-select (auto-split from dash.js)
// EP 组件库 2.0：类名/DOM 与 1.x 完全兼容；新增键盘导航、计数徽章与视觉升级
// 2.1 硬化：全局自动增强（免手动 enhanceAll）/ 隐藏容器延迟定位 / 浮层 z-index 抬升
//          / 幂等增强与 wrap 重建 / 选项全量属性同步 / 任何异常降级为原生 select

window.EP = window.EP || {};;
EP.version = "2.1";;
// 精确指针（鼠标/触控板）才自动聚焦搜索框；触屏弹键盘会引发视口变化导致面板自关
EP._finePointer = !!(
  window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches
);;
EP._bootAt = Date.now();;

EP._enhanced = [];;

EP._pendingSelects = [];;

EP._multis = [];;

// EP 专用浮层层级：高于模态(1300)与搜索面板(1500)，低于 toast(9999+)。
// open 时同步写入行内样式，杜绝被后挂载的高 z 浮层压住
EP.Z_MENU = 3000;;

// 按 select 元素反查既有增强 api（幂等增强 / 重建判定用）
EP._enhancedApiFor = function (sel) {
  if (!sel) return null;
  for (var i = 0; i < EP._enhanced.length; i++) {
    var a = EP._enhanced[i];
    if (a && a.select === sel) return a;
  }
  return null;
};;

// 该 select 是否需要（重）增强：
//  - 全新 select：是
//  - 已增强但 wrap/list 脱离文档（innerHTML 重建后 wrap 丢失）：是 → 原地重建
//  - 处于孤儿 .ep-combobox wrap 内（序列化重建后事件全丢）：是 → 拆除重建
//  - 健康实例：否（幂等）
EP._needsEnhance = function (s) {
  if (!s || s.nodeType !== 1 || s.tagName !== "SELECT" || s.multiple) return false;
  var api = s.dataset.epEnhanced ? EP._enhancedApiFor(s) : null;
  if (api && api.wrap && api.wrap.isConnected && api.list && api.list.isConnected)
    return false;
  if (api) return true;
  if (s.closest && s.closest(".ep-combobox")) return true;
  return !s.dataset.epEnhanced;
};;

EP.positionList = function (el, anchor, maxH) {
  var rc = anchor.getBoundingClientRect();
  var margin = 8;
  var vw = window.innerWidth;
  var vh = window.innerHeight;
  var below = vh - rc.bottom - margin;
  var above = rc.top - margin;
  // 先以 auto 宽度渲染测量内容自然宽度（不可见，避免闪烁）
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
  try {
    return EP._enhanceSelectInner(sel);
  } catch (e) {
    // 防御降级（任务 A6）：组件任何异常都不阻断 select 原生行为
    try {
      if (sel) {
        delete sel.dataset.epEnhanced;
        sel.classList.remove("ep-native-hidden");
        var stale = sel.nextElementSibling;
        if (stale && stale.classList && stale.classList.contains("ep-combobox"))
          stale.parentNode && stale.parentNode.removeChild(stale);
      }
      if (window.console && console.warn)
        console.warn("[ep-select] enhance failed, fallback to native:", e);
    } catch (e2) {}
    return sel;
  }
};;

EP._enhanceSelectInner = function (sel) {
  if (!sel || sel.nodeType !== 1 || sel.tagName !== "SELECT") return sel;
  // 原生 multiple 语义不接管，保持原生多选行为
  if (sel.multiple) return sel;

  var staleWrap = sel.closest ? sel.closest(".ep-combobox") : null;
  var api = sel.dataset.epEnhanced ? EP._enhancedApiFor(sel) : null;
  // 幂等（任务 A4）：同 select 重复 enhance 且实例健康 → 直接返回旧 api
  if (
    api &&
    api.wrap === staleWrap &&
    api.wrap.isConnected &&
    api.list &&
    api.list.isConnected
  )
    return api;
  // 孤儿 wrap（innerHTML 序列化重建后事件丢失）→ 拆除后重建
  if (staleWrap && staleWrap.parentNode) staleWrap.parentNode.removeChild(staleWrap);
  // wrap 被内层重建/丢失（任务 A4）→ 清残骸，原 api 原地重建（引用保持稳定）
  if (api) {
    if (api.list && api.list.parentNode) api.list.parentNode.removeChild(api.list);
    if (api.wrap && api.wrap.parentNode) api.wrap.parentNode.removeChild(api.wrap);
    sel.classList.remove("ep-native-hidden");
  } else {
    api = { select: sel, _last: sel.value };
  }

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
  // 列表挂到 body：脱离模态/transform/overflow 祖先，保证 fixed 定位基于视口。
  // （设置页分区入场动画 settingsPaneIn 以 fill-mode:both 永久保留 translateY，
  // 会使分区成为 fixed 后代的包含块 —— 挂 body 是旧“默认起始页”私有下拉漂移
  // 出屏 bug 的结构性免疫。）
  document.body.appendChild(list);
  sel.classList.add("ep-native-hidden");
  sel.dataset.epEnhanced = "1";

  api.wrap = wrap;
  api.list = list;
  api.label = lbl;
  api.btn = btn;

  function appendOpt(opt) {
    var o = document.createElement("div");
    o.className = "ep-combobox-opt";
    o.setAttribute("role", "option");
    o.textContent = opt.textContent || opt.value || "\u00a0";
    o.dataset.value = opt.value;
    // 任务 A5：disabled 选项同步渲染并禁点
    if (opt.disabled) {
      o.dataset.disabled = "1";
      o.setAttribute("aria-disabled", "true");
    }
    o.addEventListener("click", function (e) {
      e.stopPropagation();
      if (opt.disabled) return;
      selectValue(opt.value);
    });
    api.list.appendChild(o);
  }
  function build() {
    api.list.innerHTML = "";
    Array.prototype.forEach.call(sel.children, function (child) {
      if (child.tagName === "OPTGROUP") {
        var gl = document.createElement("div");
        gl.className = "ep-combobox-group-label";
        gl.textContent = child.label || "";
        api.list.appendChild(gl);
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
    // 任务 A5：宿主禁用态动态镜像到触发器
    wrap.classList.toggle("disabled", !!sel.disabled);
    btn.disabled = !!sel.disabled;
    Array.prototype.forEach.call(api.list.querySelectorAll(".ep-combobox-opt"), function (o) {
      o.dataset.selected = String(o.dataset.value) === String(v) ? "1" : "0";
    });
  }
  var wheelGuard = function (e) {
    var canDown = api.list.scrollHeight - api.list.scrollTop - api.list.clientHeight > 1;
    var canUp = api.list.scrollTop > 1;
    if ((e.deltaY > 0 && !canDown) || (e.deltaY < 0 && !canUp)) {
      e.preventDefault();
    }
  };
  function open() {
    // 单例：展开前先收起其它已展开实例
    EP._enhanced.forEach(function (other) {
      if (other !== api && other.wrap && other.wrap.dataset && other.wrap.dataset.open === "1") {
        try {
          other.close();
        } catch (e) {}
      }
    });
    build();
    syncUI();
    // 隐藏容器安全（任务 A2）：菜单位置不在增强期预设，推迟到 open 这一刻按
    // 触发器实时 rect + 视口剩余空间上下翻转计算
    EP.positionList(api.list, btn, 260);
    // 打开可靠性（任务 A3）：抬到全站浮层之上
    api.list.style.zIndex = String(EP.Z_MENU);
    api.list.addEventListener("wheel", wheelGuard);
    wrap.dataset.open = "1";
    btn.setAttribute("aria-expanded", "true");
    var active = api.list.querySelector('.ep-combobox-opt[data-selected="1"]');
    if (active && active.offsetTop != null)
      api.list.scrollTop = active.offsetTop - api.list.clientHeight / 2;
  }
  function close() {
    delete wrap.dataset.open;
    api.list.removeEventListener("wheel", wheelGuard);
    api.list.style.display = "none";
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

  // 2.0：键盘导航（↑↓ 高亮、Enter 选中、Esc 关闭由全局处理）
  function kbHighlight(opt) {
    var opts = api.list.querySelectorAll(".ep-combobox-opt");
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
    var all = Array.prototype.slice.call(api.list.querySelectorAll(".ep-combobox-opt"));
    // 键盘跳过禁用项
    var opts = all.filter(function (o) {
      return o.dataset.disabled !== "1";
    });
    if (!opts.length) return;
    var cur = api.list.querySelector(".ep-combobox-opt.ep-kb-active");
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
        var first = api.list.querySelector('.ep-combobox-opt[data-selected="1"]');
        kbHighlight(first);
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
      var hit = api.list.querySelector(".ep-combobox-opt.ep-kb-active");
      if (hit && hit.dataset.disabled !== "1") {
        selectValue(hit.dataset.value);
      } else {
        close();
      }
    }
  });

  // 任务 A5：options 全量属性动态同步（label/value/selected/disabled 等）。
  // value 属性变化不触发原生 change，由 EP._tick 兜底同步触发器文案
  if (!api._obs) {
    api._obs = new MutationObserver(function () {
      clearTimeout(api._buildTimer);
      api._buildTimer = setTimeout(function () {
        try {
          if (api.build) api.build();
          if (api.syncUI) api.syncUI();
        } catch (e) {}
      }, 30);
    });
    api._obs.observe(sel, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["disabled", "value", "selected", "label", "hidden", "title"],
    });
  }

  api.syncUI = syncUI;
  api.close = close;
  api.open = open;
  api.build = build;
  build();
  syncUI();
  if (EP._enhanced.indexOf(api) === -1) EP._enhanced.push(api);
  return api;
};;

EP.enhanceAll = function (scope) {
  var root = scope || document;
  var count = 0;
  Array.prototype.forEach.call(root.querySelectorAll("select"), function (s) {
    if (EP._needsEnhance(s)) {
      try {
        EP.enhanceSelect(s);
        count++;
      } catch (e) {}
    }
  });
  return count;
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
  // 面板挂到 body：脱离模态/transform/overflow 祖先，保证 fixed 定位基于视口
  document.body.appendChild(panel);

  function render() {
    // 2.0：计数徽章（<b class="ep-multiselect-count">N</b> + 文本）
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
    // 单例：展开前先收起其它已展开多选面板
    EP._multis.forEach(function (other) {
      if (other !== mApi && other.wrap && other.wrap.dataset && other.wrap.dataset.open === "1") {
        try {
          other.close();
        } catch (e) {}
      }
    });
    EP.positionList(panel, trigger, 320);
    panel.style.zIndex = String(EP.Z_MENU);
    panel.addEventListener("wheel", wheelGuard);
    wrap.dataset.open = "1";
    // 仅精确指针设备自动聚焦；触屏不弹键盘（用户可手动点击搜索框）
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
  // 2.0：键盘开合（Enter/Space/↓ 打开，Esc 由全局关闭）
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

// 任务 A3：document 级全局关闭（单例点击 / Esc / 滚动捕获），全部防御性容错
document.addEventListener(
  "mousedown",
  function (e) {
    EP._enhanced.forEach(function (api) {
      try {
        if (
          api.wrap &&
          api.wrap.dataset.open === "1" &&
          !api.wrap.contains(e.target) &&
          !(api.list && api.list.contains(e.target))
        )
          api.close();
      } catch (err) {}
    });
    EP._multis.forEach(function (m) {
      try {
        if (
          m.wrap &&
          m.wrap.dataset.open === "1" &&
          !m.wrap.contains(e.target) &&
          !(m.panel && m.panel.contains(e.target))
        )
          m.close();
      } catch (err) {}
    });
  },
  true,
);;

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    // 只收起当前展开的实例，不惊扰未展开的
    EP._enhanced.forEach(function (api) {
      try {
        if (api.wrap && api.wrap.dataset.open === "1") api.close();
      } catch (err) {}
    });
    EP._multis.forEach(function (m) {
      try {
        if (m.wrap && m.wrap.dataset.open === "1") m.close();
      } catch (err) {}
    });
  }
});;

// scroll 用 capture：scroll 事件不冒泡但参与捕获下传，任何祖先滚动容器
// （含页面/卡片内滚动）滚动时都会触发 → 收起浮层；浮层自身列表滚动除外
window.addEventListener(
  "scroll",
  function (e) {
    var t = e.target;
    EP._enhanced.forEach(function (api) {
      try {
        if (!api.wrap || api.wrap.dataset.open !== "1") return;
        if (t && t.nodeType === 1 && api.list && api.list.contains(t)) return;
        api.close();
      } catch (err) {}
    });
    EP._multis.forEach(function (m) {
      try {
        if (!m.wrap || m.wrap.dataset.open !== "1") return;
        if (t && t.nodeType === 1 && m.panel && m.panel.contains(t)) return;
        m.close();
      } catch (err) {}
    });
  },
  true,
);;

// 2.0：resize 时仅宽度变化（旋转/分屏）才关闭；高度变化（移动端键盘弹出）
// 重新定位面板，避免"键盘一弹面板就被关掉"。2.1：抽取共享逻辑并接入
// visualViewport（视觉视口变化时同样重算位置）
var _epLastW = window.innerWidth;
EP._repositionOpenMenus = function (widthChanged) {
  EP._enhanced.forEach(function (api) {
    try {
      if (!api.wrap || api.wrap.dataset.open !== "1") return;
      if (widthChanged) {
        api.close();
        return;
      }
      if (api.btn && api.btn.isConnected && api.list && api.list.isConnected)
        EP.positionList(api.list, api.btn, 260);
    } catch (err) {}
  });
  EP._multis.forEach(function (m) {
    try {
      if (!m.wrap || m.wrap.dataset.open !== "1") return;
      if (widthChanged) {
        m.close();
        return;
      }
      var trg = m.wrap.querySelector(".ep-multiselect-trigger");
      if (trg) EP.positionList(m.panel, trg, 320);
    } catch (err) {}
  });
};
window.addEventListener("resize", function () {
  var w = window.innerWidth;
  var widthChanged = Math.abs(w - _epLastW) > 2;
  _epLastW = w;
  EP._repositionOpenMenus(widthChanged);
});;
if (window.visualViewport) {
  var _epLastVVW = window.visualViewport.width;
  window.visualViewport.addEventListener("resize", function () {
    var w = window.visualViewport.width;
    var widthChanged = Math.abs(w - _epLastVVW) > 2;
    _epLastVVW = w;
    EP._repositionOpenMenus(widthChanged);
  });
  // 键盘/缩放导致的视觉视口偏移：只重算位置，不关闭
  window.visualViewport.addEventListener("scroll", function () {
    EP._repositionOpenMenus(false);
  });
}

// 任务 A1：全局自动增强 —— body 级 MutationObserver（childList+subtree，防抖 50ms），
// 任何新进入 DOM 的 select 自动增强，永久消灭“忘调 enhanceAll 导致的死 select”
EP._autoObserver = new MutationObserver(function (muts) {
  try {
    muts.forEach(function (m) {
      Array.prototype.forEach.call(m.addedNodes, function (n) {
        if (n.nodeType !== 1) return;
        if (n.tagName === "SELECT") {
          if (EP._needsEnhance(n) && EP._pendingSelects.indexOf(n) === -1)
            EP._pendingSelects.push(n);
        } else if (n.querySelectorAll) {
          Array.prototype.forEach.call(n.querySelectorAll("select"), function (s) {
            if (EP._needsEnhance(s) && EP._pendingSelects.indexOf(s) === -1)
              EP._pendingSelects.push(s);
          });
        }
      });
    });
    if (EP._pendingSelects.length) {
      clearTimeout(EP._autoTimer);
      EP._autoTimer = setTimeout(function () {
        var pending = EP._pendingSelects;
        EP._pendingSelects = [];
        pending.forEach(function (s) {
          try {
            if (s.isConnected) EP.enhanceSelect(s);
          } catch (e) {}
        });
        EP._cleanupOrphans();
      }, 50);
    }
  } catch (e) {}
});;

// 启动时机：组件求值后 body 已就绪即启动；否则等 DOMContentLoaded（任务 A1）。
// 注意：本文件内 EP._cleanupOrphans 定义在后，启动调用必须容错（首次同步启动时
// 该属性可能尚未赋值，500ms tick 与 observer 回调里均有定义后再用的路径）
EP._startAutoEnhance = function () {
  if (EP._autoStarted || !document.body) return false;
  EP._autoStarted = true;
  EP._autoObserver.observe(document.body, { childList: true, subtree: true });
  try {
    EP.enhanceAll(document);
  } catch (e) {}
  try {
    if (EP._cleanupOrphans) EP._cleanupOrphans();
  } catch (e) {}
  return true;
};;
if (!EP._startAutoEnhance()) {
  document.addEventListener(
    "DOMContentLoaded",
    function () {
      EP._startAutoEnhance();
    },
    { once: true },
  );
};;

EP._cleanupOrphans = function () {
  try {
    var live = new Set();
    EP._enhanced.forEach(function (api) {
      if (api.list && api.list.isConnected) live.add(api.list);
    });
    EP._multis.forEach(function (m) {
      if (m.panel && m.panel.isConnected) live.add(m.panel);
    });
    document
      .querySelectorAll(".ep-combobox-list[data-ep-owner], .ep-multiselect-panel[data-ep-owner]")
      .forEach(function (el) {
        if (!live.has(el)) el.remove();
      });
  } catch (e) {}
};;

// 500ms 值同步兜底 + wrap 失联自愈（任务 A4：wrap 被拆除而 select 尚在 → 重建）
EP._tick = setInterval(function () {
  EP._enhanced.forEach(function (api) {
    try {
      if (!api.select || !api.select.isConnected) return;
      // 自愈：select 在文档中但 wrap 已脱离 → 原地重建
      if (api.wrap && !api.wrap.isConnected) {
        EP.enhanceSelect(api.select);
        return;
      }
      if (api.select.value !== api._last) {
        api._last = api.select.value;
        api.syncUI();
      }
    } catch (e) {}
  });
}, 500);;

EP.enhanceAll(document);;

/* ========== EP Live 2.0：声明式动态区域 ==========
 * HTML 声明即可自动更新，无需手动绑定 DOM：
 *   <span data-live="clock"></span>       实时时钟
 *   <span data-live="date"></span>        本地日期
 *   <span data-live="datetime"></span>    日期 + 时间
 *   <span data-live="uptime"></span>      页面会话时长（ humanize ）
 *   <span data-live="wsuptime"></span>    WS 连接时长（依赖 _wsMeta，无则显示 —）
 * 自定义周期：<span data-live="clock" data-tick="5000"></span>（默认 1s）
 * 注册自定义更新器：EP.live("name", function (el, ds) { el.textContent = ...; })
 * 手动立即刷新：EP.refreshLive()
 * 数字滚动动画：EP.countUp(el, 1234)（统计卡片等数值变化时使用）
 */
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
// 数字滚动动画：从 el 当前值（或 from）平滑滚动到 to
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
// 统计数字容器动画：遍历 .stat-val，值变化时滚动（key 区分多个容器，记住上次值）
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
// 注册/覆盖动态更新器
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
// 共享调度：默认 1s；data-tick 自定义周期的元素归入独立定时器组
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
// DOM 增删自动接管/清理（与组件库的自动增强一致的声明式体验）
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


