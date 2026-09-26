// ErisPulse Dashboard – components/search-palette
// 全局功能搜索（Ctrl/Cmd+K、`/`、顶栏按钮）：页面/标签页、组件配置直达、常用操作
// 索引每次打开时构建；结果行文案渲染时直接烘焙 t()（动态 DOM 惯例，不用 data-i18n）

var PALETTE_RECENT_KEY = "ep_palette_recent";
var PALETTE_RECENT_MAX = 5;
var _paletteOpen = false;
var _paletteActiveIdx = 0;
var _paletteFlat = []; // 当前渲染的扁平可选项（与 DOM .palette-item 顺序一致）

function _paletteEnT(key) {
  // 取英文文案加入匹配域，保证中文界面下也能用英文关键词搜到
  try {
    return (window.__EP_I18N__ && window.__EP_I18N__.en && window.__EP_I18N__.en[key]) || "";
  } catch (e) {
    return "";
  }
}

function _palettePageEntries() {
  var entries = [];
  document.querySelectorAll(".nav-item[data-page]").forEach(function (a) {
    var page = a.getAttribute("data-page");
    var c = navItemContent(page);
    if (!c) return;
    var key = "";
    var span = a.querySelector("span[data-i18n]");
    if (span) key = span.getAttribute("data-i18n");
    entries.push({
      id: "page:" + page,
      group: "pages",
      label: c.title,
      icon: c.svg,
      hay: [c.title, key ? _paletteEnT(key) : "", page].join(" ").toLowerCase(),
      run: function () {
        go(page);
      },
    });
    var tabs = MERGED_PAGE_TABS[page];
    if (tabs) {
      tabs.forEach(function (tabInfo) {
        var tabLabel = t(tabInfo.i18n) || tabInfo.label;
        var tabBtn = document.querySelector('[data-tab="' + tabInfo.id + '"]');
        if (tabBtn) tabLabel = tabBtn.textContent.trim() || tabLabel;
        entries.push({
          id: "page:" + page + ":" + tabInfo.id,
          group: "pages",
          label: c.title + " · " + tabLabel,
          icon: c.svg,
          hay: [c.title, tabLabel, _paletteEnT(tabInfo.i18n), tabInfo.id].join(" ").toLowerCase(),
          run: function () {
            go(page);
            var btn = document.querySelector('[data-tab="' + tabInfo.id + '"]');
            if (btn) btn.click();
          },
        });
      });
    }
  });
  // 仅顶栏可达的两个页面
  var extras = [
    { page: "settings", key: "settings_title" },
    { page: "about", key: "about" },
  ];
  extras.forEach(function (x) {
    if (entries.some(function (e2) { return e2.id === "page:" + x.page; })) return;
    var label = t(x.key);
    entries.push({
      id: "page:" + x.page,
      group: "pages",
      label: label,
      icon: "",
      hay: [label, _paletteEnT(x.key), x.page].join(" ").toLowerCase(),
      run: function () {
        go(x.page);
      },
    });
  });
  return entries;
}

function _paletteComponentEntries() {
  var entries = [];
  var seen = {};
  var sources = window._adapterConfigPlatforms || [];
  sources.forEach(function (a) {
    var name = typeof a === "string" ? a : a.platform;
    if (!name || seen[name]) return;
    seen[name] = true;
    entries.push({
      id: "comp:adapter:" + name,
      group: "components",
      label: name,
      icon: adapterLogoImg(name, 16) || "",
      badge: t("adapter_config"),
      hay: [name, t("adapter_config"), _paletteEnT("adapter_config")].join(" ").toLowerCase(),
      run: function () {
        gotoComponentConfig("adapter", name);
      },
    });
  });
  (window.platforms || []).forEach(function (name) {
    if (seen[name]) return;
    seen[name] = true;
    entries.push({
      id: "comp:adapter:" + name,
      group: "components",
      label: name,
      icon: adapterLogoImg(name, 16) || "",
      badge: t("adapter_config"),
      hay: [name, t("adapter_config"), _paletteEnT("adapter_config")].join(" ").toLowerCase(),
      run: function () {
        gotoComponentConfig("adapter", name);
      },
    });
  });
  ((window._paletteModules || [])).forEach(function (m) {
    var name = typeof m === "string" ? m : m.name;
    if (!name || seen[name]) return;
    seen[name] = true;
    entries.push({
      id: "comp:module:" + name,
      group: "components",
      label: name,
      icon: "",
      badge: t("module_config"),
      hay: [name, t("module_config"), _paletteEnT("module_config")].join(" ").toLowerCase(),
      run: function () {
        gotoComponentConfig("module", name);
      },
    });
  });
  return entries;
}

function _paletteActionEntries() {
  var acts = [
    {
      id: "act:theme",
      key: "palette_act_theme",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>',
      run: function () {
        toggleTheme();
      },
    },
    {
      id: "act:lang",
      key: "palette_act_lang",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>',
      run: function () {
        toggleLang();
      },
    },
    {
      id: "act:restart",
      key: "palette_act_restart",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>',
      run: function () {
        restartFramework();
      },
    },
    {
      id: "act:sidebar",
      key: "palette_act_sidebar",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>',
      run: function () {
        toggleSidebarCollapse();
      },
    },
    {
      id: "act:privacy",
      key: "palette_act_privacy",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3.3 3.3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
      run: function () {
        applyPrivacyMode(!getPrivacyMode());
      },
    },
  ];
  return acts.map(function (a) {
    var label = t(a.key);
    return {
      id: a.id,
      group: "actions",
      label: label,
      icon: a.icon,
      hay: [label, _paletteEnT(a.key), a.id].join(" ").toLowerCase(),
      run: a.run,
    };
  });
}

function _paletteBuildIndex() {
  return _palettePageEntries().concat(_paletteComponentEntries(), _paletteActionEntries());
}

function _paletteRecentIds() {
  try {
    var raw = localStorage.getItem(PALETTE_RECENT_KEY);
    var arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.slice(0, PALETTE_RECENT_MAX) : [];
  } catch (e) {
    return [];
  }
}

function _paletteRecordRecent(id) {
  try {
    var ids = _paletteRecentIds().filter(function (x) {
      return x !== id;
    });
    ids.unshift(id);
    localStorage.setItem(PALETTE_RECENT_KEY, JSON.stringify(ids.slice(0, PALETTE_RECENT_MAX)));
  } catch (e) {}
}

function _paletteEnsureModules() {
  // 模块列表懒加载：首次打开搜索时拉一次，完成后若面板仍开着则刷新结果
  if (window._paletteModules) return;
  api("/api/modules").then(function (d) {
    if (!d || !d.modules) return;
    window._paletteModules = d.modules.filter(function (m) {
      return m.type === "module" && m.has_config;
    });
    if (_paletteOpen) renderPalette(document.getElementById("paletteInput").value);
  });
}

function _paletteRowHtml(entry, active) {
  return (
    '<div class="palette-item' + (active ? " active" : "") + '" data-pid="' + esc(entry.id) + '">' +
    '<span class="palette-item-icon">' + (entry.icon || "") + "</span>" +
    '<span class="palette-item-label">' + esc(entry.label) + "</span>" +
    (entry.badge ? '<span class="palette-item-badge">' + esc(entry.badge) + "</span>" : "") +
    "</div>"
  );
}

function _paletteGroupTitle(group) {
  if (group === "pages") return t("palette_group_pages");
  if (group === "components") return t("palette_group_components");
  if (group === "actions") return t("palette_group_actions");
  if (group === "recent") return t("palette_group_recent");
  return "";
}

export function renderPalette(query) {
  var listEl = document.getElementById("paletteList");
  if (!listEl) return;
  var q = (query || "").trim().toLowerCase();
  var index = _paletteBuildIndex();
  var byId = {};
  index.forEach(function (e) {
    byId[e.id] = e;
  });

  var html = [];
  _paletteFlat = [];
  var seenInList = {};

  function pushGroup(groupKey, entries) {
    var shown = entries.filter(function (e) {
      if (seenInList[e.id]) return false;
      seenInList[e.id] = true;
      return true;
    });
    if (!shown.length) return;
    html.push('<div class="palette-group">' + esc(_paletteGroupTitle(groupKey)) + "</div>");
    shown.forEach(function (e) {
      html.push(_paletteRowHtml(e, _paletteFlat.length === _paletteActiveIdx));
      _paletteFlat.push(e);
    });
  }

  if (!q) {
    var recents = _paletteRecentIds()
      .map(function (id) {
        return byId[id];
      })
      .filter(Boolean);
    pushGroup("recent", recents);
    pushGroup("pages", index.filter(function (e) { return e.group === "pages"; }));
    pushGroup("actions", index.filter(function (e) { return e.group === "actions"; }));
  } else {
    var matched = index.filter(function (e) {
      return e.hay.indexOf(q) !== -1;
    });
    pushGroup("pages", matched.filter(function (e) { return e.group === "pages"; }));
    pushGroup("components", matched.filter(function (e) { return e.group === "components"; }));
    pushGroup("actions", matched.filter(function (e) { return e.group === "actions"; }));
  }

  if (!_paletteFlat.length) {
    html.push('<div class="palette-empty">' + esc(t("palette_empty")) + "</div>");
  }
  listEl.innerHTML = html.join("");
  _paletteActiveIdx = 0;
  var first = listEl.querySelector(".palette-item");
  if (first) first.classList.add("active");
}

function _paletteMove(dir) {
  var items = document.querySelectorAll("#paletteList .palette-item");
  if (!items.length) return;
  var cur = document.querySelector("#paletteList .palette-item.active");
  var idx = cur ? Array.prototype.indexOf.call(items, cur) : -1;
  idx = Math.max(0, Math.min(items.length - 1, idx + dir));
  items.forEach(function (el) {
    el.classList.remove("active");
  });
  var target = items[idx];
  target.classList.add("active");
  _paletteActiveIdx = idx;
  if (target.scrollIntoViewIfNeeded) target.scrollIntoViewIfNeeded(false);
  else target.scrollIntoView({ block: "nearest" });
}

function _paletteExecute(entry) {
  if (!entry) return;
  closePalette();
  _paletteRecordRecent(entry.id);
  entry.run();
}

export function openPalette() {
  if (_paletteOpen) return;
  if (!authed) return showLogin();
  var ov = document.getElementById("paletteOv");
  if (!ov) return;
  _paletteOpen = true;
  _paletteActiveIdx = 0;
  ov.classList.add("show");
  var input = document.getElementById("paletteInput");
  input.value = "";
  renderPalette("");
  _paletteEnsureModules();
  // 触屏设备不自动聚焦，避免弹出输入法；指针设备聚焦以便直接输入
  if (!window.EP || EP._finePointer !== false) input.focus();
}

export function closePalette() {
  var ov = document.getElementById("paletteOv");
  if (ov) ov.classList.remove("show");
  _paletteOpen = false;
}

export function togglePalette() {
  if (_paletteOpen) closePalette();
  else openPalette();
}

export function isPaletteOpen() {
  return _paletteOpen;
}

// ── 全局键盘：Ctrl/Cmd+K 打开；Esc 关闭（捕获阶段，先于其他 Esc 处理）──
document.addEventListener("keydown", function (e) {
  if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
    e.preventDefault();
    togglePalette();
    return;
  }
  if (e.key === "Escape" && _paletteOpen) {
    e.preventDefault();
    e.stopPropagation();
    closePalette();
  }
});

// 模块导入即生效：输入框键盘导航 + 遮罩点击关闭 + 鼠标悬停高亮
function _paletteBindDom() {
  var input = document.getElementById("paletteInput");
  if (input) {
    input.addEventListener("input", function () {
      renderPalette(input.value);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        _paletteMove(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        _paletteMove(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        _paletteExecute(_paletteFlat[_paletteActiveIdx]);
      }
    });
  }
  var ov = document.getElementById("paletteOv");
  if (ov) {
    ov.addEventListener("mousedown", function (e) {
      if (e.target === ov) closePalette();
    });
  }
  var list = document.getElementById("paletteList");
  if (list) {
    list.addEventListener("mouseover", function (e) {
      var item = e.target.closest(".palette-item");
      if (!item) return;
      var items = list.querySelectorAll(".palette-item");
      items.forEach(function (el) {
        el.classList.remove("active");
      });
      item.classList.add("active");
      _paletteActiveIdx = Array.prototype.indexOf.call(items, item);
    });
    list.addEventListener("click", function (e) {
      var item = e.target.closest(".palette-item");
      if (!item) return;
      var entry = _paletteFlat[_paletteActiveIdx];
      // 以点击行为准（悬停已同步 _paletteActiveIdx，这里兜底按 id 查）
      var clicked = _paletteFlat.find(function (x) {
        return x.id === item.getAttribute("data-pid");
      });
      _paletteExecute(clicked || entry);
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", _paletteBindDom);
} else {
  _paletteBindDom();
}
