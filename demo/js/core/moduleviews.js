// ErisPulse Dashboard – core/moduleviews (auto-split from dash.js)

export function _runModuleViewLoader(name) {
  var loader = _moduleViewLoaders && _moduleViewLoaders[name];
  if (typeof loader !== "function") {
    console.warn(
      "[ErisPulse Dashboard] 模块视图 '" +
        name +
        "' 的 loader 未注册——通常是该模块的 js_content 未正确定义 loader 函数，属于模块自身问题。",
    );
    return null;
  }
  try {
    var result = loader();
    if (result && typeof result.catch === "function") {
      result.catch(function (err) {
        console.error(
          "[ErisPulse Dashboard] 模块视图 '" +
            name +
            "' 异步运行出错。这通常是该模块自身的问题（js_content / API / 业务逻辑），不是 Dashboard 的问题。错误如下：",
          err,
        );
      });
    }
    return result;
  } catch (err) {
    console.error(
      "[ErisPulse Dashboard] 模块视图 '" +
        name +
        "' 的 loader 抛出异常。这通常是该模块自身的问题（js_content 语法/引用错误），不是 Dashboard 的问题。错误如下：",
      err,
    );
    return null;
  }
}

export async function loadModuleViews() {
  try {
    const d = await api("/api/views");
    if (!d || !d.views) return;
    _renderModuleViews(d.views);
    // 模块视图可能影响默认起始页选项，刷新下拉
    _fillDefaultPageSelect();
  } catch (e) {
    console.error("loadModuleViews error", e);
  }
}

export function _viewText(val, fallback) {
  if (val == null) return fallback || "";
  if (typeof val === "string") return val;
  if (typeof val === "object") {
    if (val.default) return val.default;
    if (val.i18n) return val.i18n;
    return JSON.stringify(val);
  }
  return String(val);
}

export function _renderModuleViews(views) {
  const sidebarNav = document.querySelector(".sidebar-nav");
  if (!sidebarNav) return;
  const contentDiv = document.querySelector(".content");
  if (!contentDiv) return;

  document
    .querySelectorAll(".nav-item[data-module-view]")
    .forEach((el) => el.remove());
  document
    .querySelectorAll(".page[data-module-view]")
    .forEach((el) => el.remove());
  document.querySelectorAll(".module-view-style").forEach((el) => el.remove());
  document.querySelectorAll(".module-view-script").forEach((el) => el.remove());
  document
    .querySelectorAll(".nav-group.module-view-group")
    .forEach((el) => el.remove());

  _moduleViewLoaders = {};

  const groups = {};
  views.forEach(function (v) {
    const g = v.group || "group_extensions";
    if (!groups[g]) groups[g] = [];
    groups[g].push(v);
  });

  views.forEach(function (v) {
    if (v.css_content) {
      const style = document.createElement("style");
      style.className = "module-view-style";
      style.setAttribute("data-view-id", v.id);
      style.textContent = v.css_content;
      document.head.appendChild(style);
    }
  });

  views.forEach(function (v) {
    if (v.js_content) {
      const script = document.createElement("script");
      script.className = "module-view-script";
      script.setAttribute("data-view-id", v.id);
      script.textContent = v.js_content;
      document.body.appendChild(script);
    }
  });

  views.forEach(function (v) {
    const pageId = "ext-" + v.id;
    const pageDiv = document.createElement("div");
    pageDiv.className = "page";
    pageDiv.id = "p-" + pageId;
    pageDiv.setAttribute("data-module-view", v.id);

    if (v.iframe_url) {
      var iframeSrc = v.iframe_url;
      if (currentNode !== "local" && iframeSrc.charAt(0) === "/") {
        var nInfo = nodeRuntimeInfo[currentNode] || {};
        if (nInfo.url) iframeSrc = nInfo.url + iframeSrc;
      }
      const sep = iframeSrc.indexOf("?") === -1 ? "?" : "&";
      pageDiv.innerHTML =
        '<iframe src="' +
        esc(iframeSrc) +
        sep +
        "token=" +
        encodeURIComponent(
          currentNode !== "local"
            ? (nodeRuntimeInfo[currentNode] || {}).token || ""
            : localStorage.getItem(TK) || "",
        ) +
        '" class="module-view-iframe" frameborder="0"></iframe>';
    } else if (v.html_content) {
      pageDiv.innerHTML = v.html_content;
    }

    contentDiv.appendChild(pageDiv);

    if (v.loader && typeof window[v.loader] === "function") {
      _moduleViewLoaders[pageId] = window[v.loader];
    } else if (v.loader) {
      console.warn(
        "[ErisPulse Dashboard] 模块视图 '" +
          v.id +
          "' 声明了 loader '" +
          v.loader +
          "' 但该函数未定义——通常是该模块的 js_content 执行失败（语法/引用错误），属于该模块自身的问题，不是 Dashboard 的问题。",
      );
    }
  });

  Object.keys(groups).forEach(function (groupKey) {
    const firstView = groups[groupKey][0];

    let navGroup;
    if (groupKey.startsWith("group_")) {
      const existingTitle = sidebarNav.querySelector(
        '.nav-group-title[data-i18n="' + groupKey + '"]',
      );
      if (existingTitle) {
        navGroup = existingTitle.closest(".nav-group");
      }
    }

    if (!navGroup) {
      navGroup = document.createElement("div");
      navGroup.className = "nav-group module-view-group";
      const groupTitle = document.createElement("div");
      groupTitle.className = "nav-group-title";
      groupTitle.onclick = function () {
        toggleNavGroup(this);
      };
      if (groupKey.startsWith("group_") && firstView.group_title) {
        // Use multi-language group_titles if available
        var gtText =
          (firstView.group_titles && firstView.group_titles[lang]) ||
          firstView.group_title;
        groupTitle.textContent = _viewText(gtText, groupKey);
        groupTitle.setAttribute("data-i18n", groupKey);
      } else if (groupKey.startsWith("group_")) {
        var i18nText = t(groupKey);
        groupTitle.textContent = i18nText !== groupKey ? i18nText : groupKey;
        groupTitle.setAttribute("data-i18n", groupKey);
      } else {
        // Use multi-language group_titles if available
        if (firstView.group_titles && firstView.group_titles[lang]) {
          groupTitle.textContent = _viewText(firstView.group_titles[lang], groupKey);
        } else {
          const locale = lang;
          if (locale === "zh" || locale === "zh-TW") {
            groupTitle.textContent = _viewText(
              firstView.group_title || firstView.group_title_en || groupKey,
              groupKey,
            );
          } else {
            groupTitle.textContent = _viewText(
              firstView.group_title_en || firstView.group_title || groupKey,
              groupKey,
            );
          }
        }
      }
      navGroup.appendChild(groupTitle);
      sidebarNav.insertBefore(
        navGroup,
        sidebarNav.querySelector(".sidebar-footer"),
      );
      var savedStates = null;
      try {
        savedStates = JSON.parse(localStorage.getItem("ep_nav_group_states") || "{}");
      } catch (e) {}
      if (savedStates && savedStates[groupKey]) {
        navGroup.classList.add("collapsed");
      }
    }

    const sc = window.sessionCaps;
    groups[groupKey].forEach(function (v) {
      // 受限令牌：未授予 view:<id> 能力的模块视图不渲染入口
      if (sc && !sc.admin && (sc.caps || []).indexOf("view:" + v.id) === -1) {
        return;
      }
      const pageId = "ext-" + v.id;
      const navItem = document.createElement("a");
      navItem.className = "nav-item";
      navItem.setAttribute("data-page", pageId);
      navItem.setAttribute("data-module-view", v.id);
      navItem.className = "nav-item";
      navItem.setAttribute("data-page", pageId);
      navItem.setAttribute("data-module-view", v.id);
      navItem.onclick = function () {
        go(pageId, this);
      };

      const iconSvg =
        v.icon_svg ||
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>';
      navItem.innerHTML = iconSvg;

      const span = document.createElement("span");
      // Use multi-language titles dict if available
      if (v.titles && v.titles[lang]) {
        span.textContent = _viewText(v.titles[lang], v.id);
      } else {
        const locale = lang;
        if (locale === "zh" || locale === "zh-TW") {
          span.textContent = _viewText(v.title || v.title_en || v.id, v.id);
        } else {
          span.textContent = _viewText(v.title_en || v.title || v.id, v.id);
        }
      }
      navItem.appendChild(span);
      navGroup.appendChild(navItem);
    });
  });

  _moduleViewsLoaded = true;

  // 动态视图加载后，刷新主页 pin（已 pin 的动态视图会自动出现）
  applyI18n();
  renderHomePins();
}

export function _removeModuleView(viewId) {
  const pageId = "ext-" + viewId;
  const page = document.getElementById("p-" + pageId);
  if (page) page.remove();
  const navItem = document.querySelector(
    '.nav-item[data-module-view="' + viewId + '"]',
  );
  if (navItem) {
    const group = navItem.closest(".nav-group");
    navItem.remove();
    if (
      group &&
      group.classList.contains("module-view-group") &&
      group.querySelectorAll(".nav-item").length === 0
    ) {
      group.remove();
    }
  }
  document
    .querySelectorAll('.module-view-style[data-view-id="' + viewId + '"]')
    .forEach(function (el) {
      el.remove();
    });
  document
    .querySelectorAll('.module-view-script[data-view-id="' + viewId + '"]')
    .forEach(function (el) {
      el.remove();
    });
  delete _moduleViewLoaders[pageId];

  renderHomePins();
}

export function _clearModuleViews() {
  document
    .querySelectorAll(".nav-item[data-module-view]")
    .forEach(function (el) {
      el.remove();
    });
  document.querySelectorAll(".page[data-module-view]").forEach(function (el) {
    el.remove();
  });
  document.querySelectorAll(".module-view-style").forEach(function (el) {
    el.remove();
  });
  document.querySelectorAll(".module-view-script").forEach(function (el) {
    el.remove();
  });
  document
    .querySelectorAll(".nav-group.module-view-group")
    .forEach(function (el) {
      el.remove();
    });
  _moduleViewLoaders = {};
  _moduleViewsLoaded = false;
}

