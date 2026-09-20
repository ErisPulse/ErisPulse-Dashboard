// ErisPulse Dashboard – pages/store (auto-split from dash.js)

export function debounceStore() {
  clearTimeout(_storeTimer);
  _storeTimer = setTimeout(loadStore, 300);
}

const STORE_CACHE_KEY = "__ep_store__",
  STORE_CACHE_TTL = 4 * 3600 * 1000;;

export function mirrorOptionsHtml() {
  return (
    '<option value="">PyPI (Default)</option>' +
    '<option value="https://pypi.tuna.tsinghua.edu.cn/simple">Tsinghua</option>' +
    '<option value="https://mirrors.aliyun.com/pypi/simple/">Aliyun</option>' +
    '<option value="https://pypi.doubanio.com/simple/">Douban</option>' +
    '<option value="https://repo.huaweicloud.com/repository/pypi/simple">Huawei</option>'
  );
}

export function initMirrorSelects() {
  ["uploadMirrorSelect", "detailMirrorSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el && !el.children.length) el.innerHTML = mirrorOptionsHtml();
  });
}

export function _renderStoreTags(data) {
  var tagSet = new Set();
  for (var key in data.modules || {}) {
    var tg = data.modules[key].tags;
    if (Array.isArray(tg))
      tg.forEach(function (tag) {
        tagSet.add(tag);
      });
  }
  for (var key in data.adapters || {}) {
    var tg = data.adapters[key].tags;
    if (Array.isArray(tg))
      tg.forEach(function (tag) {
        tagSet.add(tag);
      });
  }
  var container = document.getElementById("storeTags");
  if (!container) return;
  if (tagSet.size === 0) {
    container.style.display = "none";
    return;
  }
  container.style.display = "block";
  var tags = Array.from(tagSet).sort();
  if (!_storeTagMulti) {
    _storeTagMulti = EP.createMultiSelect({
      host: container,
      items: tags,
      selected: _selectedStoreTags,
      placeholder: t("store_tag_filter"),
      searchPlaceholder: t("search_packages"),
      selectAll: t("select_all"),
      clear: t("clear_all"),
      emptyText: t("no_matches"),
      countLabel: t("ep_selected"),
      onChange: function () {
        loadStore();
      },
    });
  } else {
    _storeTagMulti.setItems(tags);
  }
}

export async function loadStore(forceRefresh) {
  const q = document.getElementById("storeSearch")?.value?.toLowerCase() || "";
  const typeFilter = document.getElementById("storeTypeFilter")?.value || "all";
  let remotePackages = null;

  // 远程注册表数据变化少，可缓存；但已安装版本必须实时获取
  if (!forceRefresh) {
    try {
      const c = JSON.parse(localStorage.getItem(STORE_CACHE_KEY));
      if (c && c.packages && Date.now() - c.ts < STORE_CACHE_TTL)
        remotePackages = c.packages;
    } catch (e) {}
  }
  if (!remotePackages) {
    const resp = await api("/api/store/remote");
    if (resp && resp.packages) {
      remotePackages = resp.packages;
      localStorage.setItem(
        STORE_CACHE_KEY,
        JSON.stringify({ ts: Date.now(), packages: remotePackages }),
      );
    }
  }

  // 已安装版本始终实时获取（不缓存），避免升级后"有更新"徽章不消失
  const instResp = await api("/api/packages");
  const installedVersions = {};
  if (instResp && Array.isArray(instResp.packages)) {
    instResp.packages.forEach(function (p) {
      if (p.name) installedVersions[p.name.toLowerCase()] = p.version || "";
    });
  }

  const d = { packages: remotePackages, installed_versions: installedVersions };
  if (!d || !d.packages) {
    document.getElementById("storeGrid").innerHTML =
      '<div class="empty-state" style="grid-column:span 3"><p>' +
      t("failed_registry") +
      "</p></div>";
    return;
  }
  const pk = d.packages;

  // 渲染标签筛选项
  _renderStoreTags(pk);

  const all = [
    ...Object.entries(pk.modules || {}).map(([n, i]) => ({
      ...i,
      name: n,
      type: "module",
    })),
    ...Object.entries(pk.adapters || {}).map(([n, i]) => ({
      ...i,
      name: n,
      type: "adapter",
    })),
  ];
  // 多层筛选
  var f = all;
  if (typeFilter !== "all") {
    f = f.filter(function (i) {
      return i.type === typeFilter;
    });
  }
  if (q) {
    f = f.filter(function (i) {
      return (i.name + i.description + i.package).toLowerCase().indexOf(q) >= 0;
    });
  }
  if (_selectedStoreTags.size > 0) {
    f = f.filter(function (i) {
      var tags = i.tags;
      if (!Array.isArray(tags)) return false;
      for (var ti = 0; ti < tags.length; ti++) {
        if (_selectedStoreTags.has(tags[ti])) return true;
      }
      return false;
    });
  }
  document.getElementById("storeGrid").innerHTML = f.length
    ? f
        .map((i) => {
          const pkgLower = (i.package || "").toLowerCase();
          const installedVer = installedVersions[pkgLower] || "";
          const isInstalled = !!installedVer;
          const hasUpdate = isInstalled && cmpVer(i.version, installedVer) > 0;
          let statusBadge = "";
          let actionBtn = "";
          if (hasUpdate) {
            statusBadge =
              '<span class="chip chip-wr" style="margin-left:4px;font-size:10px">' +
              t("store_update_available") +
              "</span>";
            actionBtn =
              '<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();upgradePkg(\'' +
              esc(i.package) +
              "')\">" +
              t("pkg_upgrade") +
              "</button>";
          } else if (isInstalled) {
            statusBadge =
              '<span class="chip chip-ok" style="margin-left:4px;font-size:10px">v' +
              esc(installedVer) +
              "</span>";
            actionBtn =
              '<span style="font-size:12px;color:var(--ok-c);font-weight:500">' +
              t("active") +
              "</span>";
          } else {
            actionBtn =
              '<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();installPkg(\'' +
              esc(i.package) +
              "')\">" +
              t("install") +
              "</button>";
          }
          // 标签徽章
          var tagBadges = "";
          if (Array.isArray(i.tags) && i.tags.length) {
            tagBadges =
              '<div class="store-card-tags">' +
              i.tags
                .map(function (t) {
                  return '<span class="store-card-tag">' + esc(t) + "</span>";
                })
                .join("") +
              "</div>";
          }
          return (
            '<div class="store-card' +
            (hasUpdate ? " store-card-update" : "") +
            '" onclick="openPkgDetail(\'' +
            esc(i.name) +
            "','" +
            esc(i.package) +
            "','" +
            esc(i.type) +
            '\')"><div style="display:flex;align-items:center;gap:8px"><input type="checkbox" class="store-card-check" data-pkg="' +
            esc(i.package) +
            '" onclick="event.stopPropagation();updateBatchBar()"><span style="font-size:14px;font-weight:600">' +
            esc(i.name) +
            '</span><span class="chip chip-pr">' +
            esc(i.type) +
            "</span>" +
            statusBadge +
            '</div><div style="font-size:12px;color:var(--tx-t);font-family:Consolas,Monaco,monospace">' +
            esc(i.package) +
            '</div><div class="store-card-desc">' +
            esc(i.description || "-") +
            "</div>" +
            tagBadges +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:auto"><span style="font-size:12px;color:var(--tx-s);font-weight:500">v' +
            esc(i.version || "?") +
            (hasUpdate
              ? ' <span style="color:var(--wr-c);font-weight:600">&larr;</span> ' +
                t("store_version_current") +
                " v" +
                esc(installedVer)
              : "") +
            '</span><div style="display:flex;align-items:center;gap:6px">' +
            actionBtn +
            '<button class="store-card-detail-btn" onclick="event.stopPropagation();openPkgDetail(\'' +
            esc(i.name) +
            "','" +
            esc(i.package) +
            "','" +
            esc(i.type) +
            '\')" title="' +
            t("view_detail") +
            '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></button></div></div></div>'
          );
        })
        .join("")
    : '<div class="empty-state" style="grid-column:span 3"><p>' +
      t("no_packages") +
      "</p></div>";
}

export function showInstallConfirm(pkg, isBatch) {
  return new Promise((r) => {
    const ov = document.getElementById("modalOv");
    document.getElementById("modalTitle").textContent = t("install");
    const label = isBatch
      ? esc(pkg)
      : "Install <strong>" + esc(pkg) + "</strong>?";
    document.getElementById("modalText").innerHTML =
      label +
      '<div class="install-confirm-options">' +
      '<div class="install-confirm-option"><div><div class="install-confirm-option-label">' +
      t("force_install") +
      '</div><div style="font-size:11px;color:var(--tx-t)">' +
      t("force_install_desc") +
      '</div></div><label class="switch"><input type="checkbox" id="installConfirmForce"><span class="switch-slider"></span></label></div>' +
      '<div class="install-confirm-option"><div class="install-confirm-option-label">' +
      t("pip_mirror") +
      '</div><select class="upload-select" id="installConfirmMirror" style="width:160px">' +
      mirrorOptionsHtml() +
      "</select></div>" +
      "</div>";
    const ac = document.getElementById("modalActions");
    ac.innerHTML = "";
    const b1 = document.createElement("button");
    b1.className = "btn btn-secondary";
    b1.textContent = t("cancel");
    b1.onclick = () => {
      ov.classList.remove("show");
      r(null);
    };
    const b2 = document.createElement("button");
    b2.className = "btn btn-primary";
    b2.textContent = t("install");
    b2.onclick = () => {
      const force =
        document.getElementById("installConfirmForce")?.checked || false;
      const mirror =
        document.getElementById("installConfirmMirror")?.value || "";
      ov.classList.remove("show");
      r({ force, index_url: mirror });
    };
    ac.append(b1, b2);
    ov.classList.add("show");
  });
}

export async function installPkg(pkg) {
  if (!authed) return showLogin();
  const opts = await showInstallConfirm(pkg);
  if (!opts) return;
  const body = { packages: [pkg] };
  if (opts.force) body.force = true;
  if (opts.index_url) body.index_url = opts.index_url;
  const d = await api("/api/store/install", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, pkg);
    toast(t("installing"), "");
  } else {
    toast(t("install_failed"), "er");
  }
}

export function openUploadModal() {
  if (!authed) return showLogin();
  _uploadState = { file: null, taskId: null, uploaded: false };
  initMirrorSelects();
  const ov = document.getElementById("uploadOv");
  document.getElementById("uploadProgressSection").style.display = "none";
  document.getElementById("uploadProgressFill").style.width = "0%";
  document.getElementById("uploadProgressText").textContent = "0%";
  document.getElementById("uploadFileInfo").textContent = "";
  document.getElementById("uploadInstallBtn").disabled = true;
  document.getElementById("uploadForceInstall").checked = false;
  const ms = document.getElementById("uploadMirrorSelect");
  if (ms) ms.value = "";
  document.getElementById("uploadDropZone").classList.remove("drag-over");
  ov.classList.add("show");
}

export function closeUploadModal() {
  document.getElementById("uploadOv").classList.remove("show");
}

export function handleUploadDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add("drag-over");
}

export function handleUploadDragLeave(e) {
  e.currentTarget.classList.remove("drag-over");
}

export function handleUploadDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) processUploadFile(file);
}

export function handleUploadFileSelect(input) {
  const file = input.files && input.files[0];
  if (file) processUploadFile(file);
  input.value = "";
}

export function processUploadFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext !== "whl" && ext !== "zip") {
    toast(t("upload_failed"), "er");
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    toast(t("upload_file_too_large"), "er");
    return;
  }
  _uploadState.file = file;
  _uploadState.uploaded = false;
  document.getElementById("uploadFileInfo").textContent =
    file.name + " (" + formatFileSize(file.size) + ")";
  doUpload(file);
}

export function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + " " + u[i];
}

export function doUpload(file) {
  const fd = new FormData();
  fd.append("file", file);
  const force = document.getElementById("uploadForceInstall").checked;
  const mirror = document.getElementById("uploadMirrorSelect")?.value || "";
  if (force) fd.append("force", "true");
  if (mirror) fd.append("index_url", mirror);
  const xhr = new XMLHttpRequest();
  document.getElementById("uploadProgressSection").style.display = "flex";
  document.getElementById("uploadInstallBtn").disabled = true;
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      document.getElementById("uploadProgressFill").style.width = pct + "%";
      document.getElementById("uploadProgressText").textContent = pct + "%";
    }
  };
  xhr.onload = () => {
    try {
      const d = JSON.parse(xhr.responseText);
      if (d && d.success && d.task_id) {
        _uploadState.taskId = d.task_id;
        _uploadState.uploaded = true;
        _installTaskIds.set(d.task_id, file.name);
        document.getElementById("uploadProgressFill").style.width = "100%";
        document.getElementById("uploadProgressText").textContent =
          t("upload_complete");
        document.getElementById("uploadInstallBtn").disabled = false;
      } else {
        toast(d?.error || t("upload_failed"), "er");
        closeUploadModal();
      }
    } catch (err) {
      toast(t("upload_failed"), "er");
      closeUploadModal();
    }
  };
  xhr.onerror = () => {
    toast(t("upload_failed"), "er");
    closeUploadModal();
  };
  xhr.open("POST", API + "/api/store/upload");
  xhr.setRequestHeader("Authorization", "Bearer " + localStorage.getItem(TK));
  xhr.send(fd);
}

export function startUploadInstall() {
  closeUploadModal();
  toast(t("installing"), "");
}

export async function openPkgDetail(name, pkg, type) {
  if (!authed) return showLogin();
  initMirrorSelects();
  const ov = document.getElementById("pkgDetailOv");
  document.getElementById("pkgDetailTitle").textContent = name;
  document.getElementById("pkgDetailType").textContent = type;
  document.getElementById("pkgDetailVersion").innerHTML = "";
  document.getElementById("pkgDetailDesc").innerHTML =
    '<p style="color:var(--tx-t)">' + t("pkg_detail_loading") + "</p>";
  document.getElementById("pkgDetailInfoGrid").innerHTML = "";
  document.getElementById("pkgDetailDepsSection").style.display = "none";
  document.getElementById("pkgDetailVersionsSection").style.display = "none";
  document.getElementById("detailForceInstall").checked = false;
  const ms = document.getElementById("detailMirrorSelect");
  if (ms) ms.value = "";
  const vs = document.getElementById("detailVersionSelect");
  vs.innerHTML = '<option value="">' + t("latest_version") + "</option>";
  const ac = document.getElementById("pkgDetailActions");
  ac.innerHTML = "";
  ov.classList.add("show");

  const cacheKey = pkg.toLowerCase();
  let d = _pkgDetailCache[cacheKey];
  if (!d) {
    d = await api(
      "/api/store/package/detail?package=" + encodeURIComponent(pkg),
    );
    if (d && !d.error) _pkgDetailCache[cacheKey] = d;
  }
  if (!d || d.error) {
    document.getElementById("pkgDetailDesc").innerHTML =
      '<p style="color:var(--er-c)">' + t("pkg_detail_failed") + "</p>";
    return;
  }

  let verHtml = "";
  if (d.installed_version)
    verHtml +=
      '<span class="chip chip-ok" style="font-size:11px">v' +
      esc(d.installed_version) +
      " " +
      t("store_version_current") +
      "</span> ";
  if (d.latest_version)
    verHtml +=
      '<span class="chip chip-pr" style="font-size:11px">v' +
      esc(d.latest_version) +
      " " +
      t("store_version_latest") +
      "</span>";
  document.getElementById("pkgDetailVersion").innerHTML = verHtml;

  const descText = d.description || d.summary || "";
  if (descText && typeof marked !== "undefined") {
    document.getElementById("pkgDetailDesc").innerHTML = marked.parse(descText);
  } else if (descText) {
    const cleanDesc = descText.replace(/<[^>]*>/g, "").substring(0, 2000);
    document.getElementById("pkgDetailDesc").innerHTML =
      '<p style="white-space:pre-wrap">' + esc(cleanDesc) + "</p>";
  } else {
    document.getElementById("pkgDetailDesc").innerHTML =
      '<p style="color:var(--tx-t)">-</p>';
  }

  let infoHtml = "";
  if (d.author)
    infoHtml +=
      '<dt style="color:var(--tx-t);font-weight:500">Author</dt><dd style="color:var(--tx-s);margin:0">' +
      esc(d.author) +
      "</dd>";
  if (d.license)
    infoHtml +=
      '<dt style="color:var(--tx-t);font-weight:500">License</dt><dd style="color:var(--tx-s);margin:0">' +
      esc(d.license) +
      "</dd>";
  if (d.home_page)
    infoHtml +=
      '<dt style="color:var(--tx-t);font-weight:500">Homepage</dt><dd style="color:var(--tx-s);margin:0"><a href="' +
      esc(d.home_page) +
      '" target="_blank" style="color:var(--accent)">' +
      esc(d.home_page) +
      "</a></dd>";
  if (infoHtml)
    document.getElementById("pkgDetailInfoGrid").innerHTML = infoHtml;

  const deps = (d.requires_dist || []).filter(
    (dep) => !dep.includes("; extra ==") && !dep.includes(":"),
  );
  if (deps.length) {
    document.getElementById("pkgDetailDepsSection").style.display = "";
    document.getElementById("pkgDetailDeps").innerHTML = deps
      .map(
        (dep) =>
          '<span class="chip" style="margin:2px;font-size:11px;padding:2px 8px">' +
          esc(dep) +
          "</span>",
      )
      .join("");
  }

  const versions = d.versions || [];
  if (versions.length) {
    document.getElementById("pkgDetailVersionsSection").style.display = "";
    document.getElementById("pkgDetailVersions").innerHTML = versions
      .slice(0, 20)
      .map(
        (v) =>
          "<span style=\"display:inline-block;margin:2px 6px;cursor:pointer;color:var(--tx-s)\" onclick=\"document.getElementById('detailVersionSelect').value='" +
          esc(v) +
          "'\">" +
          esc(v) +
          "</span>",
      )
      .join("");
    vs.innerHTML =
      '<option value="">' +
      t("latest_version") +
      " (" +
      esc(d.latest_version || "") +
      ")</option>" +
      versions
        .slice(0, 30)
        .map((v) => '<option value="' + esc(v) + '">' + esc(v) + "</option>")
        .join("");
  }

  ac.innerHTML = "";
  const closeBtn = document.createElement("button");
  closeBtn.className = "btn btn-secondary";
  closeBtn.textContent = t("cancel");
  closeBtn.onclick = () => ov.classList.remove("show");

  const actionBtn = document.createElement("button");
  actionBtn.className = "btn btn-primary";
  if (
    d.installed_version &&
    d.latest_version &&
    cmpVer(d.latest_version, d.installed_version) > 0
  ) {
    actionBtn.textContent = t("pkg_upgrade");
    actionBtn.onclick = () => {
      ov.classList.remove("show");
      doInstallWithOptions(pkg, false, true);
    };
  } else if (!d.installed_version) {
    actionBtn.textContent = t("install");
    actionBtn.onclick = () => {
      ov.classList.remove("show");
      doInstallWithOptions(pkg);
    };
  } else {
    actionBtn.textContent = t("force_install");
    actionBtn.onclick = () => {
      ov.classList.remove("show");
      doInstallWithOptions(pkg, true);
    };
  }
  ac.append(closeBtn, actionBtn);
}

export function closePkgDetail() {
  document.getElementById("pkgDetailOv").classList.remove("show");
}

export async function doInstallWithOptions(pkg, defaultForce, isUpgrade) {
  const force =
    defaultForce !== undefined
      ? defaultForce
      : document.getElementById("detailForceInstall")?.checked || false;
  const mirror = document.getElementById("detailMirrorSelect")?.value || "";
  const version = document.getElementById("detailVersionSelect")?.value || "";
  const pkgSpec = version ? pkg + "==" + version : pkg;
  const body = { packages: [pkgSpec] };
  if (force) body.force = true;
  if (mirror) body.index_url = mirror;
  if (isUpgrade) {
    const d = await api("/api/packages/upgrade", {
      method: "POST",
      body: JSON.stringify({
        packages: [pkgSpec],
        index_url: mirror || undefined,
      }),
    });
    if (d && d.success && d.task_id) {
      _installTaskIds.set(d.task_id, pkg);
      toast(t("installing"), "");
    } else toast(t("install_failed"), "er");
  } else {
    const d = await api("/api/store/install", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (d && d.success && d.task_id) {
      _installTaskIds.set(d.task_id, pkg);
      toast(t("installing"), "");
    } else toast(t("install_failed"), "er");
  }
}

export function updateBatchBar() {
  const checked = document.querySelectorAll(".store-card-check:checked");
  const bar = document.getElementById("storeBatchBar");
  if (checked.length > 0) {
    bar.style.display = "flex";
    document.getElementById("storeBatchCount").textContent = t(
      "batch_install_count",
    ).replace("{n}", checked.length);
  } else {
    bar.style.display = "none";
  }
}

export async function batchInstall() {
  if (!authed) return showLogin();
  const checked = document.querySelectorAll(".store-card-check:checked");
  const pkgs = Array.from(checked).map((c) => c.dataset.pkg);
  if (!pkgs.length) return;
  const opts = await showInstallConfirm(pkgs.join(", "), true);
  if (!opts) return;
  const body = { packages: pkgs };
  if (opts.force) body.force = true;
  if (opts.index_url) body.index_url = opts.index_url;
  const d = await api("/api/store/install", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, pkgs.join(", "));
    toast(t("installing"), "");
  } else {
    toast(t("install_failed"), "er");
  }
  document
    .querySelectorAll(".store-card-check")
    .forEach((c) => (c.checked = false));
  updateBatchBar();
}

