// ErisPulse Dashboard – pages/modules (auto-split from dash.js)

export async function loadModules() {
  const d = await api("/api/modules");
  if (!d) return;
  const items = d.modules || [];
  const search = (
    document.getElementById("moduleSearch")?.value || ""
  ).toLowerCase();
  const status = document.getElementById("moduleStatus")?.value || "all";
  const adapters = items.filter((m) => {
    if (m.type !== "adapter") return false;
    if (search && !m.name.toLowerCase().includes(search)) return false;
    if (status === "active" && !m.loaded) return false;
    if (status === "inactive" && m.loaded) return false;
    if (status === "loaded" && !m.loaded) return false;
    if (status === "disabled" && m.enabled) return false;
    return true;
  });
  const modules = items.filter((m) => {
    if (m.type !== "module") return false;
    if (search && !m.name.toLowerCase().includes(search)) return false;
    if (status === "active" && !m.loaded) return false;
    if (status === "inactive" && m.loaded) return false;
    if (status === "loaded" && !m.loaded) return false;
    if (status === "disabled" && m.enabled) return false;
    return true;
  });
  document.getElementById("adapterCount").textContent = adapters.length;
  document.getElementById("moduleCount").textContent = modules.length;
  // Update summary stats
  var allItems = d.modules || [];
  var allAdapters = allItems.filter(function (m) {
    return m.type === "adapter";
  });
  var allModules = allItems.filter(function (m) {
    return m.type === "module";
  });
  var activeCount = allItems.filter(function (m) {
    return m.loaded;
  }).length;
  var disabledCount = allItems.filter(function (m) {
    return !m.enabled;
  }).length;
  var el;
  if ((el = document.getElementById("statAdapterTotal")))
    el.textContent = allAdapters.length;
  if ((el = document.getElementById("statModuleTotal")))
    el.textContent = allModules.length;
  if ((el = document.getElementById("statActive")))
    el.textContent = activeCount;
  if ((el = document.getElementById("statDisabled")))
    el.textContent = disabledCount;
  var mmAd = document.getElementById("mmAdaptersCount");
  if (mmAd) mmAd.textContent = allAdapters.length;
  var mmMo = document.getElementById("mmModulesCount");
  if (mmMo) mmMo.textContent = allModules.length;
  document.getElementById("adapterList").innerHTML = adapters.length
    ? adapters.map((m) => renderPluginRow(m, true)).join("")
    : '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg><p>' +
      t("no_adapters") +
      "</p></div>";
  document.getElementById("moduleList").innerHTML = modules.length
    ? modules.map((m) => renderPluginRow(m, false)).join("")
    : '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg><p>' +
      t("no_modules") +
      '</p><button class="empty-action" onclick="go(\'store\')">' +
      t("store") +
      "</button></div>";
}

export function renderPluginRow(m, isAd) {
  let statusDot = "",
    statusText = "",
    statusClass = "";
  var isLazyModule = false;
  if (m.loaded) {
    statusDot = "loaded";
    statusText = t("active");
    statusClass = "chip-ok";
  } else if (m.enabled) {
    statusDot = "enabled";
    if (m.load_strategy && m.load_strategy.lazy_load) {
      // 懒加载模块已挂载，首次调用时框架会自动加载——不是"出了问题没加载"
      isLazyModule = true;
      statusText = t("module_lazy_pending");
      statusClass = "chip-pr";
    } else {
      statusText = t("module_enabled_not_loaded");
      statusClass = "chip-wr";
    }
  } else {
    statusDot = "disabled";
    // 未注册（失去句柄）的禁用模块：展示为"禁用中"，与常规已禁用区分
    statusText = m.unregistered ? t("module_disabled_running") : t("module_disabled");
    statusClass = "chip-er";
  }

  let meta = "";
  if (m.author)
    meta += "<span>" + t("module_author") + ": " + esc(m.author) + "</span>";
  if (m.description) meta += "<span>" + esc(m.description) + "</span>";
  if (!meta) meta = "<span>" + t("module_no_desc") + "</span>";

  // 主操作按钮：加载/启用（实心）、停止加载（描边）；低频与危险操作收进 ⋯ 菜单
  let acts = "";
  // 声明了配置的组件提供"去配置"直达入口（适配器含账户配置）
  var canCfg = isAd ? m.has_config || m.has_accounts : m.has_config;
  if (canCfg) {
    acts +=
      '<button class="btn btn-secondary btn-xs" onclick="gotoComponentConfig(\'' +
      (isAd ? "adapter" : "module") +
      "','" +
      _jsq(m.name) +
      "')\">" +
      t("goto_config") +
      "</button> ";
  }
  if (m.loaded) {
    acts +=
      '<button class="btn btn-secondary btn-xs module-primary-btn" onclick="moduleAction(\'' +
      _jsq(m.name) +
      "','unload','" +
      _jsq(m.type) +
      "')\">" +
      t("unload") +
      "</button> ";
  } else if (m.enabled) {
    acts +=
      '<button class="btn btn-primary btn-xs module-primary-btn" onclick="moduleAction(\'' +
      _jsq(m.name) +
      "','load','" +
      _jsq(m.type) +
      "')\">" +
      t("load") +
      "</button> ";
  } else {
    acts +=
      '<button class="btn btn-primary btn-xs module-primary-btn" onclick="moduleAction(\'' +
      _jsq(m.name) +
      "','enable','" +
      _jsq(m.type) +
      "')\">" +
      t("enable_module") +
      "</button> ";
  }
  // ⋯ 菜单：重载（仅模块）、禁用/启用、卸载（仅模块）
  var menuItems = [];
  if (m.loaded && !isAd)
    menuItems.push({ label: t("reload"), action: "reload", danger: false });
  if (m.enabled) {
    menuItems.push({
      label: t("disable_module"),
      action: "disable",
      danger: true,
    });
  } else {
    menuItems.push({
      label: t("enable_module"),
      action: "enable",
      danger: false,
    });
  }
  if (!isAd && m.package)
    menuItems.push({
      label: t("uninstall_module"),
      action: "uninstall",
      danger: true,
    });
  if (menuItems.length) {
    acts +=
      '<button class="btn btn-secondary btn-xs module-more-btn" title="' +
      esc(t("more_actions")) +
      '" data-name="' +
      _jsq(m.name) +
      '" data-type="' +
      _jsq(m.type) +
      '" data-pkg="' +
      _jsq(m.package || "") +
      '" data-loaded="' +
      (m.loaded ? 1 : 0) +
      '" data-enabled="' +
      (m.enabled ? 1 : 0) +
      '" data-isad="' +
      (isAd ? 1 : 0) +
      '" onclick="toggleModuleMenu(event, this)"><svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg></button>';
  }

  // Build detail section
  var detailHtml = "";
  var detailItems = [];
  // 详情：状态说明（适配器/模块通用）
  detailItems.push(
    '<span class="module-detail-item"><strong>' +
      t("loaded_status") +
      ":</strong> " +
      esc(statusText) +
      "</span>",
  );
  // 详情：完整描述
  if (m.description)
    detailItems.push(
      '<span class="module-detail-item">' +
        esc(m.description) +
        "</span>",
    );
  if (isAd) {
    if (m.bots_count > 0) {
      detailItems.push(
        '<span class="module-detail-item"><strong>' +
          t("online_bots") +
          ":</strong> " +
          m.bots_count +
          "</span>",
      );
    }
    if (m.capabilities && m.capabilities.length) {
      detailItems.push(
        '<span class="module-detail-item cap-item"><strong>' +
          t("capability") +
          ":</strong> " +
          m.capabilities
            .map(function (c) {
              return '<span class="module-cap-tag">' + esc(c) + "</span>";
            })
            .join(" ") +
          "</span>",
      );
    }
    if (m.has_config != null)
      detailItems.push(
        '<span class="module-detail-item"><strong>' +
          t("config") +
          ":</strong> " +
          (m.has_config ? t("cmd_yes") : t("cmd_no")) +
          "</span>",
      );
    if (m.has_accounts != null)
      detailItems.push(
        '<span class="module-detail-item"><strong>' +
          t("adapter_accounts") +
          ":</strong> " +
          (m.has_accounts ? t("cmd_yes") : t("cmd_no")) +
          "</span>",
      );
  } else {
    if (m.load_strategy) {
      var ls = m.load_strategy;
      if (ls.lazy_load != null)
        detailItems.push(
          '<span class="module-detail-item"><strong>' +
            t("module_load_mode") +
            ":</strong> " +
            (ls.lazy_load ? t("module_lazy") : t("module_eager")) +
            "</span>",
        );
      if (ls.priority != null)
        detailItems.push(
          '<span class="module-detail-item"><strong>' +
            t("module_priority") +
            ":</strong> " +
            ls.priority +
            "</span>",
        );
      if (ls.depends && ls.depends.length)
        detailItems.push(
          '<span class="module-detail-item"><strong>' +
            t("module_depends") +
            ":</strong> " +
            ls.depends
              .map(function (d) {
                return '<code class="dep-code">' + esc(d) + "</code>";
              })
              .join(" ") +
            "</span>",
        );
    }
    if (m.routes_count > 0)
      detailItems.push(
        '<span class="module-detail-item"><strong>' +
          t("registered_routes") +
          ":</strong> " +
          m.routes_count +
          "</span>",
      );
    if (m.views_count > 0)
      detailItems.push(
        '<span class="module-detail-item"><strong>' +
          t("module_views_count") +
          ":</strong> " +
          m.views_count +
          "</span>",
      );
    if (m.has_config != null)
      detailItems.push(
        '<span class="module-detail-item"><strong>' +
          t("config") +
          ":</strong> " +
          (m.has_config ? t("cmd_yes") : t("cmd_no")) +
          "</span>",
      );
    if (m.package)
      detailItems.push(
        '<span class="module-detail-item"><strong>' +
          t("pkg_name") +
          ':</strong> <code class="dep-code">' +
          esc(m.package) +
          "</code></span>",
      );
    if (m.is_git)
      detailItems.push(
        '<span class="module-detail-item"><span class="chip chip-pr module-git-chip">Git</span></span>',
      );
  }
  if (detailItems.length) {
    detailHtml =
      '<div class="module-detail hidden"><div class="module-detail-row">' +
      detailItems.join("") +
      "</div></div>";
  }

  // 图标三级回退：① 适配器品牌 logo（/api/adapter-logos）→ ② 模块元数据声明
  // （m.logo_url 外链图片 / m.icon_svg 内联 SVG，见 docs/module-view-registration.md）→ ③ 首字母头像
  // （accent-soft 底 + 主文字色，全 token 化，不做按名哈希随机彩色，保持家族一致性）
  // 注意：adapterLogoImg() 在无品牌 logo 时返回的是占位空 span（真值字符串），不能用于判空；
  // 此处改用 getAdapterLogo() 取品牌 logo 地址判空，保证适配器条目与普通模块共用同一条回退链，
  // 品牌 logo 加载失败时经 onerror 直降 ③ 首字母头像（与 logo_url 分支行为一致）
  var brandLogo = isAd ? getAdapterLogo(m.name) : null;
  let icoHtml = "";
  if (brandLogo) {
    icoHtml =
      '<img src="' + esc(brandLogo) + '" alt="" loading="lazy" onerror="this.replaceWith(document.createRange().createContextualFragment(moduleIconFallback(\'' + _jsq(m.name) + '\')))">';
  } else if (m.logo_url) {
    icoHtml =
      '<img src="' + esc(m.logo_url) + '" alt="" loading="lazy" onerror="this.replaceWith(document.createRange().createContextualFragment(moduleIconFallback(\'' + _jsq(m.name) + '\')))">';
  } else if (m.icon_svg) {
    icoHtml = String(m.icon_svg);
  } else {
    icoHtml = moduleIconFallback(m.name);
  }
  var html =
    '<div class="module-card' +
    (isAd ? " is-adapter" : "") +
    '">' +
    '<div class="module-card-main">' +
    '<div class="module-card-id" role="button" tabindex="0" onclick="toggleModuleDetail(this)" onkeydown="if(event.key===\'Enter\'){toggleModuleDetail(this)}">' +
    '<span class="module-ico">' +
    icoHtml +
    "</span>" +
    '<div class="module-card-info"><div class="module-name-row">' +
    '<span class="module-name">' +
    esc(m.name) +
    "</span>" +
    (m.version ? '<span class="module-version">v' + esc(m.version) + "</span>" : "") +
    '<span class="chip ' +
    statusClass +
    ' module-status-chip"' +
    (isLazyModule ? ' title="' + esc(t("module_lazy_desc")) + '"' : "") +
    ">" +
    esc(statusText) +
    "</span></div>" +
    '<div class="module-meta">' +
    meta +
    "</div></div>" +
    '<span class="module-card-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>' +
    "</div>" +
    "</div>" +
    '<div class="module-card-side">' +
    '<span class="module-enable-label">' +
    '<label class="switch"><input type="checkbox" ' +
    (m.enabled ? "checked" : "") +
    ' onchange="toggleModuleEnabled(\'' +
    _jsq(m.name) +
    "','" +
    _jsq(m.type) +
    '\',this)"><span class="switch-slider"></span></label>' +
    "</span>" +
    acts +
    "</div>" +
    detailHtml +
    "</div>";
  return html;
}

// 兜底图标：模块名首字母头像（token 化配色，见 .module-ico-initial）
export function moduleIconFallback(name) {
  var initial = ((name || "?").trim().charAt(0) || "?").toUpperCase();
  return (
    '<span class="module-ico-initial">' + esc(initial) + "</span>"
  );
}

export async function toggleModuleEnabled(name, type, el) {
  if (!authed) return showLogin();
  var action = el.checked ? "enable" : "disable";
  await moduleAction(name, action, type);
  loadModules();
}

export function toggleModuleDetail(el) {
  var wrap = el.closest(".module-card");
  if (!wrap) return;
  var detail = wrap.querySelector(".module-detail");
  if (!detail) return;
  if (detail.classList.contains("hidden")) {
    detail.classList.remove("hidden");
    wrap.classList.add("expanded");
  } else {
    detail.classList.add("hidden");
    wrap.classList.remove("expanded");
  }
}

export function _moduleMenuOutside(e) {
  var menu = document.getElementById("moduleActionMenu");
  if (!menu) return;
  if (menu.contains(e.target)) return;
  if (menu._anchor && menu._anchor.contains(e.target)) return;
  closeModuleMenu();
}

export function _moduleMenuEsc(e) {
  if (e.key === "Escape") closeModuleMenu();
}

export function closeModuleMenu() {
  var menu = document.getElementById("moduleActionMenu");
  if (menu) menu.remove();
  document.removeEventListener("click", _moduleMenuOutside);
  document.removeEventListener("keydown", _moduleMenuEsc);
}

export function toggleModuleMenu(ev, btn) {
  ev.stopPropagation();
  var existing = document.getElementById("moduleActionMenu");
  if (existing) {
    var same = existing._anchor === btn;
    closeModuleMenu();
    if (same) return;
  }
  var name = btn.dataset.name,
    type = btn.dataset.type,
    pkg = btn.dataset.pkg,
    loaded = btn.dataset.loaded === "1",
    enabled = btn.dataset.enabled === "1",
    isAd = btn.dataset.isad === "1";
  var items = [];
  if (loaded && !isAd)
    items.push({ action: "reload", label: t("reload"), danger: false });
  if (enabled) {
    items.push({
      action: "disable",
      label: t("disable_module"),
      danger: true,
    });
  } else {
    items.push({ action: "enable", label: t("enable_module"), danger: false });
  }
  if (!isAd && pkg)
    items.push({
      action: "uninstall",
      label: t("uninstall_module"),
      danger: true,
    });
  if (!items.length) return;
  var menu = document.createElement("div");
  menu.id = "moduleActionMenu";
  menu.className = "module-action-menu";
  menu._anchor = btn;
  menu.innerHTML = items
    .map(function (it) {
      var call =
        "closeModuleMenu();moduleAction('" +
        _jsq(name) +
        "','" +
        it.action +
        "','" +
        _jsq(type) +
        "'" +
        (it.action === "uninstall" ? ",'" + _jsq(pkg) + "'" : "") +
        ")";
      return (
        '<button class="module-menu-item' +
        (it.danger ? " danger" : "") +
        '" onclick="' +
        esc(call) +
        '">' +
        esc(it.label) +
        "</button>"
      );
    })
    .join("");
  document.body.appendChild(menu);
  var r = btn.getBoundingClientRect();
  var mw = menu.offsetWidth,
    mh = menu.offsetHeight;
  var left = Math.min(Math.max(8, r.right - mw), window.innerWidth - mw - 8);
  var top = r.bottom + 6;
  if (top + mh > window.innerHeight - 8) top = r.top - mh - 6;
  if (top < 8) top = 8;
  menu.style.left = left + "px";
  menu.style.top = top + "px";
  setTimeout(function () {
    document.addEventListener("click", _moduleMenuOutside);
    document.addEventListener("keydown", _moduleMenuEsc);
  }, 0);
}

export async function moduleAction(name, action, type, pkg) {
  if (!authed) return showLogin();
  if (action === "unload" && name === "Dashboard") {
    const ok = await confirm2(t("unload_self_title"), t("unload_self_confirm"));
    if (!ok) return;
  } else if (action === "unload") {
    const ok = await confirm2(
      t("unload_confirm_title"),
      t("unload_confirm_text"),
    );
    if (!ok) return;
  }
  if (action === "disable") {
    const ok = await confirm2(
      t("disable_confirm_title"),
      t("disable_confirm_text"),
    );
    if (!ok) return;
  }
  if (action === "uninstall") {
    const ok = await confirm2(
      t("uninstall_confirm_title"),
      t("uninstall_confirm_text") + " <strong>" + esc(name) + "</strong>",
    );
    if (!ok) return;
  }
  const body = { name, action, type };
  if (pkg) body.package = pkg;
  const d = await api("/api/modules/action", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (d && d.success) {
    if (d.task_id) {
      _installTaskIds.set(d.task_id, name);
      toast(t("module_uninstalling"), "");
    } else {
      setTimeout(loadModules, 300);
      toast(t("action_completed"), "ok");
    }
  } else toast(d?.error || t("action_failed"), "er");
}

export function goToModuleConfig() {
  go("adapter");
  var btn = document.querySelector('[data-tab="cfg-module"]');
  if (btn) btn.click();
}

