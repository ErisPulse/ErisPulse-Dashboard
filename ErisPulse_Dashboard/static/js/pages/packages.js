// ErisPulse Dashboard – pages/packages (auto-split from dash.js)

export function debouncePkgs() {
  clearTimeout(_pkgDebounceTimer);
  _pkgDebounceTimer = setTimeout(renderPkgInstalled, 300);
}

export async function loadPackages(forceRefresh) {
  const force = forceRefresh === true;
  // 首次进入渲染骨架占位，避免列表区闪空
  if (!_pkgCache) {
    document.getElementById("pkgInstalledList").innerHTML =
      '<div class="pkg-skeleton">' +
      '<div class="skeleton skeleton-text" style="width: 42%"></div>' +
      '<div class="skeleton skeleton-text" style="width: 68%"></div>' +
      '<div class="skeleton skeleton-text" style="width: 55%"></div>' +
      '<div class="skeleton skeleton-text" style="width: 61%"></div>' +
      "</div>";
  }
  const params = force ? "?force=true" : "";
  const d = await api("/api/packages" + params);
  if (!d || d.error) return;
  _pkgCache = d.packages || [];
  document.getElementById("pkgInstalledCount").textContent = _pkgCache.length;
  renderPkgInstalled();
}

export function renderPkgInstalled() {
  if (!_pkgCache) return;
  const search = (
    document.getElementById("pkgSearch")?.value || ""
  ).toLowerCase();
  const filtered = search
    ? _pkgCache.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          (p.summary || "").toLowerCase().includes(search),
      )
    : _pkgCache;

  if (filtered.length === 0) {
    document.getElementById("pkgInstalledList").innerHTML =
      '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg><p>' +
      t("pkg_no_installed") +
      "</p></div>";
    return;
  }

  const html = filtered
    .map((p) => {
      // 类型徽标胶囊：模块 / 适配器 / 依赖库，语义色三件套
      let typeBadges = "";
      if (p.is_module)
        typeBadges +=
          '<span class="chip chip-pr pkg-type-chip">' +
          t("pkg_type_module") +
          "</span>";
      if (p.is_adapter)
        typeBadges +=
          '<span class="chip chip-sc pkg-type-chip">' +
          t("pkg_type_adapter") +
          "</span>";
      if (!p.is_module && !p.is_adapter)
        typeBadges +=
          '<span class="chip chip-muted pkg-type-chip">' +
          t("pkg_type_library") +
          "</span>";

      const isProtected =
        p.name.toLowerCase().replace(/[-_]/g, "") === "erispulse" ||
        p.name.toLowerCase().replace(/[-_]/g, "") === "erispulsedashboard";
      let actions = "";
      if (!isProtected) {
        actions +=
          '<button class="btn btn-secondary btn-xs" onclick="upgradePkg(\'' +
          esc(p.name) +
          "')\">" +
          t("pkg_upgrade") +
          "</button> ";
        actions +=
          '<button class="btn btn-danger btn-xs" onclick="uninstallPkg(\'' +
          esc(p.name) +
          "')\">" +
          t("uninstall_module") +
          "</button>";
      }

      return (
        '<div class="pkg-row">' +
        '<div class="pkg-info">' +
        '<div class="pkg-name-row">' +
        '<span class="pkg-name">' +
        esc(p.name) +
        "</span>" +
        typeBadges +
        "</div>" +
        '<div class="pkg-summary">' +
        esc(p.summary || "") +
        "</div>" +
        "</div>" +
        '<div class="pkg-row-side">' +
        '<span class="pkg-version">v' +
        esc(p.version) +
        "</span>" +
        actions +
        "</div>" +
        "</div>"
      );
    })
    .join("");

  document.getElementById("pkgInstalledList").innerHTML = html;
}

export async function loadPackageUpdates(forceRefresh) {
  const countEl = document.getElementById("pkgUpdateCount");
  const countInnerEl = document.getElementById("pkgUpdateCountInner");

  if (!_pkgUpdateCache || forceRefresh) {
    document.getElementById("pkgUpdateList").innerHTML =
      '<div class="pkg-skeleton">' +
      '<div class="skeleton skeleton-text" style="width: 50%"></div>' +
      '<div class="skeleton skeleton-text" style="width: 64%"></div>' +
      "</div>";
    const force = forceRefresh === true;
    const params = force ? "?force=true" : "";
    const d = await api("/api/packages/updates" + params);
    if (!d || d.error) {
      document.getElementById("pkgUpdateList").innerHTML =
        '<div class="empty-state"><p>' +
        (d?.error || t("action_failed")) +
        "</p></div>";
      return;
    }
    _pkgUpdateCache = d.updates || [];
  }

  const updates = _pkgUpdateCache;
  countEl.textContent = updates.length;
  countEl.style.display = updates.length > 0 ? "inline-flex" : "none";
  countInnerEl.textContent = updates.length;

  if (updates.length === 0) {
    document.getElementById("pkgUpdateList").innerHTML =
      '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="20 6 9 17 4 12"/></svg><p>' +
      t("pkg_no_updates") +
      "</p></div>";
    return;
  }

  const html = updates
    .map((u) => {
      return (
        '<div class="pkg-row pkg-row-update">' +
        '<div class="pkg-info">' +
        '<span class="pkg-name">' +
        esc(u.name) +
        "</span>" +
        "</div>" +
        '<div class="pkg-row-side">' +
        '<span class="pkg-version-old">v' +
        esc(u.current) +
        "</span>" +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="pkg-arrow"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>' +
        '<span class="pkg-version-new">v' +
        esc(u.latest) +
        "</span>" +
        '<button class="btn btn-primary btn-xs" onclick="upgradePkg(\'' +
        esc(u.name) +
        "')\">" +
        t("pkg_upgrade") +
        "</button>" +
        "</div>" +
        "</div>"
      );
    })
    .join("");

  document.getElementById("pkgUpdateList").innerHTML = html;
}

export async function upgradePkg(pkgName) {
  if (!authed) return showLogin();
  const ok = await confirm2(
    t("pkg_upgrade"),
    t("pkg_upgrade_confirm") + " <strong>" + esc(pkgName) + "</strong>?",
  );
  if (!ok) return;
  const d = await api("/api/packages/upgrade", {
    method: "POST",
    body: JSON.stringify({ packages: [pkgName] }),
  });
  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, pkgName);
    toast(t("pkg_upgrading"), "");
  } else {
    toast(t("pkg_upgrade_failed") + ": " + (d?.error || ""), "er");
  }
}

export async function upgradeAllPkgs() {
  if (!authed) return showLogin();
  if (!_pkgUpdateCache || _pkgUpdateCache.length === 0) {
    toast(t("pkg_no_updates"), "");
    return;
  }
  const ok = await confirm2(t("upgrade_all"), t("pkg_upgrade_all_confirm"));
  if (!ok) return;
  const packages = _pkgUpdateCache.map((u) => u.name);
  const d = await api("/api/packages/upgrade", {
    method: "POST",
    body: JSON.stringify({ packages }),
  });
  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, packages.join(", "));
    toast(t("pkg_upgrading"), "");
  } else {
    toast(t("pkg_upgrade_failed") + ": " + (d?.error || ""), "er");
  }
}

export async function installNewPkg() {
  if (!authed) return showLogin();
  const input = document.getElementById("pkgInstallInput");
  const val = input.value.trim();
  if (!val) return;
  const packages = val.split(/\s+/).filter((s) => s.length > 0);
  const ok = await confirm2(
    t("install"),
    t("install") + " <strong>" + esc(packages.join(", ")) + "</strong>?",
  );
  if (!ok) return;
  const d = await api("/api/packages/install", {
    method: "POST",
    body: JSON.stringify({ packages }),
  });
  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, packages.join(", "));
    toast(t("installing"), "");
    input.value = "";
  } else {
    toast(t("install_failed") + ": " + (d?.error || ""), "er");
  }
}

export async function installNewGitPkg() {
  if (!authed) return showLogin();
  const input = document.getElementById("pkgGitInput");
  const val = input.value.trim();
  if (!val) return;
  if (!val.startsWith("git+")) {
    toast(t("install_failed") + ": URL must start with git+", "er");
    return;
  }
  const ok = await confirm2(
    t("install"),
    t("install") + " <strong>" + esc(val) + "</strong>?",
  );
  if (!ok) return;
  const d = await api("/api/packages/install", {
    method: "POST",
    body: JSON.stringify({ packages: [val] }),
  });
  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, val);
    toast(t("installing"), "");
    input.value = "";
  } else {
    toast(t("install_failed") + ": " + (d?.error || ""), "er");
  }
}

export async function loadGitPackages() {
  if (!authed) return;
  const d = await api("/api/packages/git");
  if (!d) return;
  const container = document.getElementById("pkgGitList");
  const pkgs = d.packages || [];
  const updates = d.updates || [];
  const updateMap = {};
  updates.forEach((u) => {
    updateMap[u.git_url] = u;
  });
  if (pkgs.length === 0) {
    container.innerHTML =
      '<div class="empty-state">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.01" y1="12" x2="22.96" y2="12"/></svg>' +
      "<p>" +
      t("pkg_git_no_packages") +
      "</p>" +
      "</div>";
    return;
  }
  const html = pkgs
    .map((p) => {
      const isUpdatable = updateMap[p.git_url];
      const urlEsc = esc(p.git_url);
      const label = isUpdatable
        ? `<span class="chip chip-wr">${t("pkg_git_update_available")}</span>`
        : `<span class="chip chip-ok">${t("latest_version")}</span>`;
      const btn = isUpdatable
        ? `<button class="btn btn-primary btn-xs" onclick="upgradeGitPkg('${urlEsc}')">${t("pkg_git_upgrade")}</button>`
        : "";
      return `
        <div class="pkg-row">
          <div class="pkg-info">
            <div class="pkg-git-url">${urlEsc}</div>
            <div class="pkg-git-meta">${label}</div>
          </div>
          <div class="pkg-row-side">${btn}</div>
        </div>`;
    })
    .join("");
  container.innerHTML = html;
}

export async function upgradeGitPkg(gitUrl) {
  if (!authed) return showLogin();
  const ok = await confirm2(
    t("pkg_git_upgrade"),
    t("pkg_upgrade_confirm") + " <strong>" + esc(gitUrl) + "</strong>?",
  );
  if (!ok) return;
  const d = await api("/api/packages/git-upgrade", {
    method: "POST",
    body: JSON.stringify({ git_url: gitUrl }),
  });
  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, gitUrl);
    toast(t("pkg_upgrading"), "");
  } else {
    toast(t("pkg_upgrade_failed") + ": " + (d?.error || ""), "er");
  }
}

export async function uninstallPkg(pkgName) {
  if (!authed) return showLogin();
  const ok = await confirm2(
    t("uninstall_module"),
    t("pkg_uninstall_confirm") + " <strong>" + esc(pkgName) + "</strong>",
  );
  if (!ok) return;
  const d = await api("/api/packages/uninstall", {
    method: "POST",
    body: JSON.stringify({ package: pkgName }),
  });
  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, pkgName);
    toast(t("module_uninstalling"), "");
  } else if (d && d.error === "Cannot uninstall core package") {
    toast(t("pkg_cannot_uninstall"), "er");
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

