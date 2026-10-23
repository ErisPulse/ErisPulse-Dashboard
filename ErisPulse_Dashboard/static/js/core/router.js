 

export function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("overlay").classList.toggle("show");
}

export function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("overlay").classList.remove("show");
}

export function go(name, el, opts) {
  if (!authed) {
    showLogin();
    return;
  }
   
  if (
    !(opts && opts.force) &&
    window._cfgDirtyKeys &&
    _cfgDirtyKeys.size > 0
  ) {
    var adapterPage = document.getElementById("p-adapter");
    var onAdapter = adapterPage && adapterPage.classList.contains("active");
     
    if (name !== "adapter" || onAdapter) {
      confirm2(t("unsaved_confirm_title"), t("unsaved_confirm_text")).then(
        function (ok) {
          if (!ok) return;
          _cfgDirtyKeys.clear();
          if (typeof _cfgUpdateSaveDot === "function") _cfgUpdateSaveDot();
          go(name, el, { force: true });
        },
      );
      return;
    }
  }
   
  var redirect = PAGE_REDIRECTS[name];
  if (redirect) {
    var targetEl = el;
     
    if (el) {
      var hostNav = document.querySelector(
        '.nav-item[data-page="' + redirect.page + '"]',
      );
      if (hostNav) targetEl = hostNav;
    }
    go(redirect.page, targetEl, opts);
     
    var tabBtn = document.querySelector(
      "#" +
        redirect.page.replace(/-/g, "") +
        'TabBar [data-tab="' +
        redirect.tab +
        '"]',
    );
    if (!tabBtn) {
       
      tabBtn = document.querySelector('[data-tab="' + redirect.tab + '"]');
    }
    if (tabBtn) tabBtn.click();
    return;
  }
  var requiredCap = _PAGE_CAPABILITY_MAP[name];
  if (requiredCap && !isCapabilitySupported(requiredCap)) {
    toast(t("unsupported_on_node") + ": " + t(name), "wr");
    return;
  }
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".page-loader-strip")
    .forEach((o) => o.remove());
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  const page = document.getElementById("p-" + name);
  if (page) {
    page.classList.add("active");
    page.classList.add("anim-enter");
    setTimeout(() => page.classList.remove("anim-enter"), 850);
  }
  if (el) {
    el.classList.add("active");
  } else {
    const navMatch = document.querySelector(
      '.nav-item[data-page="' + name + '"]',
    );
    if (navMatch) navMatch.classList.add("active");
  }
  closeSidebar();

   
  if (page) {
    var strip = document.createElement("div");
    strip.className = "page-loader-strip";
    var navItem = el || document.querySelector('.nav-item[data-page="' + name + '"]');
    var iconTitle = "";
    if (navItem) {
       
      var spanEl = navItem.querySelector("span:not(.nav-ico)");
      if (spanEl) iconTitle = spanEl.textContent;
    }
    strip.innerHTML = '<span class="pl-label">' + (iconTitle || name) + "</span>";
    page.appendChild(strip);
  }
  var minDelay = new Promise(function (r) { setTimeout(r, 800); });

  const loaders = {
    dashboard: function () {
      window.refreshDashboard();
       
      loadPerformance();
    },
    bots: loadBots,
    "event-stream": function () {
      loadEvents();
    },
    "module-mgmt": loadModules,
    adapter: loadAdapterConfigPage,
    store: function () {
      loadStore();
    },
    packages: function () {
      loadPackages();
      loadPackageUpdates();
    },
    logs: loadLogs,
    "api-routes": loadApiRoutes,
    commands: loadCommands,
    master: loadPermPage,
    topology: loadTopology,
    files: function () {
      fmBrowse(".");
    },
    config: loadConfig,
    settings: loadSettings,
    cluster: loadClusterPage,
  };
  if (loaders[name]) {
    var result = loaders[name]();
    Promise.resolve(result).then(function () {
      return minDelay;
    }).then(function () {
      if (strip) { strip.classList.add("hide"); setTimeout(function () { strip.remove(); }, 350); }
    });
  } else if (_moduleViewLoaders && _moduleViewLoaders[name]) {
    var result2 = _runModuleViewLoader(name);
    Promise.resolve(result2 || minDelay)
      .then(function () {
        return minDelay;
      })
      .then(function () {
        if (strip) { strip.classList.add("hide"); setTimeout(function () { strip.remove(); }, 350); }
      });
  } else {
    minDelay.then(function () {
      if (strip) { strip.classList.add("hide"); setTimeout(function () { strip.remove(); }, 350); }
    });
  }

  if (name !== "logs" && (_logAutoRefreshTimer || _logStreamActive)) {
    if (_logAutoRefreshTimer) {
      clearInterval(_logAutoRefreshTimer);
      _logAutoRefreshTimer = null;
    }
    _logStreamActive = false;
    _logStreamBuffer = [];
    if (_logStreamFlushTimer) {
      clearTimeout(_logStreamFlushTimer);
      _logStreamFlushTimer = null;
    }
    const btn = document.getElementById("logAutoRefreshBtn");
    if (btn) btn.style.opacity = "0.5";
  }
}

export function toggleNavGroup(titleEl) {
  titleEl.parentElement.classList.toggle("collapsed");
   
  saveNavGroupStates();
}

export function saveNavGroupStates() {
  var enabled = localStorage.getItem("ep_remember_groups") !== "false";
  if (!enabled) return;
  var state = {};
  document.querySelectorAll(".sidebar-nav .nav-group").forEach(function (g) {
    var title = g.querySelector(".nav-group-title");
    if (!title) return;
    var key = title.getAttribute("data-i18n") || "";
    if (key) state[key] = g.classList.contains("collapsed");
  });
  localStorage.setItem("ep_nav_group_states", JSON.stringify(state));
}

export function restoreNavGroupStates() {
  var enabled = localStorage.getItem("ep_remember_groups") !== "false";
  if (!enabled) return;
  var raw = localStorage.getItem("ep_nav_group_states");
  if (!raw) return;
  try {
    var state = JSON.parse(raw);
    document.querySelectorAll(".sidebar-nav .nav-group").forEach(function (g) {
      var title = g.querySelector(".nav-group-title");
      if (!title) return;
      var key = title.getAttribute("data-i18n") || "";
      if (state[key]) g.classList.add("collapsed");
    });
  } catch (e) {}
}

export function applySettingRememberGroups(enabled) {
  localStorage.setItem("ep_remember_groups", enabled);
  if (!enabled) {
    localStorage.removeItem("ep_nav_group_states");
  } else {
    saveNavGroupStates();
  }
}

export function getHomePins() {
  var raw = localStorage.getItem("ep_home_pins");
  if (raw) {
    try {
      var arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    } catch (e) {}
  }
  var pins = HOME_PIN_DEFAULTS.slice();
  document.querySelectorAll(".nav-item[data-module-view]").forEach(function (a) {
    var id = a.getAttribute("data-module-view");
    var pageId = "ext-" + id;
    if (id && pins.indexOf(pageId) < 0) pins.push(pageId);
  });
  return pins;
}

export function setHomePins(arr) {
  localStorage.setItem("ep_home_pins", JSON.stringify(arr));
}

export function navItemContent(pinId) {
  var parts = pinId.split(":");
  var page = parts[0];
  var tab = parts[1];
  var item = document.querySelector('.nav-item[data-page="' + page + '"]') ||
    document.querySelector('.nav-item[data-module-view="' + page + '"]');
  if (!item) return null;
  var svg = item.querySelector("svg");
   
  var span = item.querySelector("span:not(.nav-ico)");
  var title = span ? span.textContent : page;
   
  if (tab) {
    var tabBtn = document.querySelector('[data-tab="' + tab + '"]');
    if (tabBtn) {
      var tabText = tabBtn.textContent.trim();
      if (tabText) title = tabText;
    }
  }
  return {
    svg: svg ? svg.outerHTML : "",
    title: title,
  };
}

export function renderHomePins() {
  var wrap = document.getElementById("homePins");
  if (!wrap) return;
  var pins = getHomePins();
  wrap.innerHTML = "";
  var found = 0;
  pins.forEach(function (pinId, idx) {
    var c = navItemContent(pinId);
    if (!c) return;  
    found++;
    var card = document.createElement("div");
    card.className = "home-pin" + (_homePinsEditing ? " editing" : "");
    card.draggable = _homePinsEditing;
    card.setAttribute("data-page", pinId);
    card.setAttribute("data-idx", String(idx));
    if (!_homePinsEditing) {
      card.addEventListener("click", function () {
        var parts = pinId.split(":");
        if (parts[1]) {
           
          go(parts[0]);
          var tabBtn = document.querySelector('[data-tab="' + parts[1] + '"]');
          if (tabBtn) tabBtn.click();
        } else {
          go(pinId);
        }
      });
    }

    var grip = document.createElement("span");
    grip.className = "home-pin-grip";
    grip.title = "Drag";
    grip.textContent = "⋮⋮";
    card.appendChild(grip);

    var icon = document.createElement("span");
    icon.innerHTML = c.svg;
    card.appendChild(icon.firstChild || icon);

    var label = document.createElement("span");
    label.className = "home-pin-label";
    label.textContent = c.title;
    card.appendChild(label);

    if (_homePinsEditing) {
      var rm = document.createElement("button");
      rm.className = "home-pin-remove";
      rm.textContent = "×";
      rm.addEventListener("click", function (e) {
        e.stopPropagation();
        removeHomePin(pinId);
      });
      card.appendChild(rm);
    }
    wrap.appendChild(card);
  });
  if (found === 0) {
    var empty = document.createElement("div");
    empty.className = "home-pin-empty";
    empty.style.cssText = "color:var(--tx-t);font-size:13px;padding:12px 0";
    empty.textContent = t("home_empty");
    wrap.appendChild(empty);
  }
  bindHomePinDnd();

  var addBar = document.getElementById("homePinAdd");
  if (addBar) addBar.style.display = _homePinsEditing ? "block" : "none";
}

export function toggleHomePinsEdit() {
  _homePinsEditing = !_homePinsEditing;
  var btn = document.getElementById("homePinsEditBtn");
  if (btn) btn.classList.toggle("active", _homePinsEditing);
  renderHomePins();
}

export function removeHomePin(page) {
  var pins = getHomePins().filter(function (p) {
    return p !== page;
  });
  setHomePins(pins);
  renderHomePins();
}

export function toggleHomePinPicker() {
  var picker = document.getElementById("homePinPicker");
  if (!picker) return;
  if (picker.style.display === "none") {
    var pinned = getHomePins();
    var all = Array.prototype.map.call(
      document.querySelectorAll(".nav-item[data-page], .nav-item[data-module-view]"),
      function (a) {
        return a.getAttribute("data-page") || a.getAttribute("data-module-view");
      },
    );
    picker.innerHTML = "";
    var count = 0;

    function addOption(label, svgHtml, onClick, isSub) {
      var opt = document.createElement("div");
      opt.className = isSub ? "home-pin-suboption" : "home-pin-option";
      opt.addEventListener("click", onClick);
      var icon = document.createElement("span");
      icon.innerHTML = svgHtml || "";
      opt.appendChild(icon.firstChild || icon);
      var span = document.createElement("span");
      span.textContent = label;
      opt.appendChild(span);
      picker.appendChild(opt);
      count++;
    }

    all.forEach(function (page) {
      var c = navItemContent(page);
      if (!c) return;

      var isPinned = pinned.indexOf(page) !== -1;

       
      if (!isPinned) {
        addOption(c.title, c.svg, function () {
          addHomePin(page);
        });
      }

       
      if (!isPinned) {
        var tabs = MERGED_PAGE_TABS[page];
        if (tabs) {
          tabs.forEach(function (tabInfo) {
            var tabLabel = t(tabInfo.i18n) || tabInfo.label;
             
            if (tabLabel === c.title) return;
            var pinId = page + ":" + tabInfo.id;
            if (pinned.indexOf(pinId) !== -1) return;
            addOption(
              tabLabel,
              c.svg,
              function () {
                addHomePin(pinId);
              },
              true,
            );
          });
        }
      }
    });
    if (count === 0) {
      var none = document.createElement("div");
      none.style.cssText = "padding:8px;color:var(--tx-t)";
      none.textContent = "—";
      picker.appendChild(none);
    }
    picker.style.display = "block";
  } else {
    picker.style.display = "none";
  }
}

export function addHomePin(page) {
  var pins = getHomePins();
  if (pins.indexOf(page) === -1) {
    pins.push(page);
    setHomePins(pins);
  }
  var picker = document.getElementById("homePinPicker");
  if (picker) picker.style.display = "none";
  renderHomePins();
}

export function bindHomePinDnd() {
  var pins = document.querySelectorAll(".home-pin");
  pins.forEach(function (el) {
    el.addEventListener("dragstart", function (e) {
      _dragPinIdx = parseInt(el.dataset.idx, 10);
      el.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    el.addEventListener("dragend", function () {
      el.classList.remove("dragging");
    });
    el.addEventListener("dragover", function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      el.classList.add("drag-over");
    });
    el.addEventListener("dragleave", function () {
      el.classList.remove("drag-over");
    });
    el.addEventListener("drop", function (e) {
      e.preventDefault();
      el.classList.remove("drag-over");
      var targetIdx = parseInt(el.dataset.idx, 10);
      if (_dragPinIdx === null || _dragPinIdx === targetIdx) return;
      var arr = getHomePins();
      var moved = arr.splice(_dragPinIdx, 1)[0];
      arr.splice(targetIdx, 0, moved);
      setHomePins(arr);
      _dragPinIdx = null;
      renderHomePins();
    });
  });
}

export function updateNodeSelectorVisibility() {
  var nodeSelector = document.getElementById("nodeSelector");
  if (!nodeSelector) return;
  var showSetting = localStorage.getItem("ep_show_node_selector") !== "false";  
  if (!showSetting) {
    nodeSelector.style.display = "none";
    return;
  }
   
  var hasRemote = Object.keys(nodeRuntimeInfo).some(function (id) {
    return id !== "local";
  });
  nodeSelector.style.display = hasRemote ? "" : "none";
}

export function restartRefreshTimer() {
  if (_refreshTimer) clearInterval(_refreshTimer);
  const interval = parseInt(getSetting("refresh_interval", "5000"));
  if (interval > 0 && authed) {
    _refreshTimer = setInterval(window.refreshDashboard, interval);
  }
}

export function toggleSidebarCollapse() {
  if (window.innerWidth <= 1023) return;  
  const sb = document.getElementById("sidebar");
  sb.classList.toggle("collapsed");
  localStorage.setItem(
    "ep_sidebar_collapsed",
    sb.classList.contains("collapsed"),
  );
  document.getElementById("settingsSidebar").checked =
    sb.classList.contains("collapsed");
}

