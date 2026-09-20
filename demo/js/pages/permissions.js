// ErisPulse Dashboard – pages/permissions (auto-split from dash.js)

export async function loadAuditLog() {
  const actionFilterEl = document.getElementById("auditActionFilter");
  const actionFilter = actionFilterEl?.value || "";
  const params = new URLSearchParams();
  if (actionFilter) params.set("action", actionFilter);
  params.set("limit", "200");
  const d = await api("/api/audit?" + params);
  if (!d) return;
  const logs = d.logs || [];
  if (actionFilterEl) {
    var _acts = {};
    logs.forEach(function (l) {
      _acts[l.action] = 1;
    });
    if (actionFilter) _acts[actionFilter] = 1;
    var _actList = Object.keys(_acts).sort();
    var _opts = '<option value="">' + esc(t("all_actions")) + "</option>";
    _actList.forEach(function (a) {
      var _k = "action_" + a;
      var _lbl = t(_k) !== _k ? t(_k) : a;
      _opts +=
        '<option value="' +
        esc(a) +
        '"' +
        (a === actionFilter ? " selected" : "") +
        ">" +
        esc(_lbl) +
        "</option>";
    });
    actionFilterEl.innerHTML = _opts;
  }
  document.getElementById("auditCount").textContent = d.total || 0;
  if (logs.length === 0) {
    document.getElementById("auditList").innerHTML =
      '<div class="empty-state"><p>' + t("no_data") + "</p></div>";
    return;
  }
  const html = logs
    .slice()
    .reverse()
    .map((log) => {
      const tm = new Date(log.timestamp * 1000).toLocaleString(getLocale());
      const actionKey = "action_" + log.action;
      const actionLabel =
        t(actionKey) !== actionKey ? t(actionKey) : esc(log.action);
      const actionClass =
        {
          restart_framework: "chip-er",
          framework_update: "chip-er",
          file_delete: "chip-er",
          uninstall_module: "chip-er",
          package_uninstall: "chip-er",
          disable_module: "chip-er",
          disable_adapter: "chip-er",
          unload_module: "chip-er",
          unload_adapter: "chip-er",
          cluster_node_delete: "chip-er",
          audit_clear: "chip-er",
          login_failed: "chip-er",
          logs_clear: "chip-er",
          lifecycle_clear: "chip-er",
          clear_events: "chip-wr",
          file_rename: "chip-wr",
          file_write: "chip-wr",
          config_source_save: "chip-wr",
          appearance_update: "chip-wr",
          master_update: "chip-wr",
          command_update: "chip-wr",
          cluster_node_add: "chip-wr",
          cluster_node_update: "chip-wr",
          cluster_node_probe: "chip-wr",
          package_install: "chip-ok",
          package_upgrade: "chip-ok",
          package_git_upgrade: "chip-ok",
          login_success: "chip-ok",
          file_mkdir: "chip-ok",
          enable_module: "chip-ok",
          enable_adapter: "chip-ok",
          load_module: "chip-ok",
          load_adapter: "chip-ok",
          reload_module: "chip-ok",
          reload_adapter: "chip-ok",
          backup_import: "chip-pr",
          backup_export: "chip-pr",
          appearance_upload: "chip-pr",
          file_copy: "chip-pr",
          file_decompress: "chip-pr",
        }[log.action] || "chip-sc";
      return (
        '<div class="list-row" style="font-size:13px;gap:12px">' +
        '<span class="chip ' +
        actionClass +
        '" style="min-width:100px;justify-content:center">' +
        esc(actionLabel) +
        "</span>" +
        '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--tx-s)" title="' +
        esc(log.detail) +
        '">' +
        esc(log.detail || "-") +
        "</span>" +
        '<span style="font-size:11px;color:var(--tx-t);white-space:nowrap">' +
        esc(log.ip || "") +
        "</span>" +
        '<span style="font-size:11px;color:var(--tx-t);white-space:nowrap;min-width:140px;text-align:right">' +
        esc(tm) +
        "</span>" +
        "</div>"
      );
    })
    .join("");
  document.getElementById("auditList").innerHTML = html;
}

export async function clearAuditLog() {
  if (!authed) return showLogin();
  const ok = await confirm2(t("clear_events"), t("audit_clear_confirm"));
  if (!ok) return;
  await api("/api/audit/clear", { method: "POST" });
  toast(t("audit_cleared"), "ok");
  loadAuditLog();
}

export function switchPermTab(tab, btn) {
  var bar = btn.closest("#permTabBar");
  if (bar) {
    bar.querySelectorAll(".pkg-tab").forEach(function (b) {
      b.classList.remove("active");
    });
  }
  btn.classList.add("active");
  document.querySelectorAll("#p-master .tab-section").forEach(function (s) {
    s.style.display = "none";
  });
  var target = document.getElementById(tab + "-tab");
  if (target) target.style.display = "block";
  if (tab === "perm-master") loadMaster();
  if (tab === "perm-scope") loadScope();
}

export function loadPermPage() {
  var btn = document.querySelector('#permTabBar [data-tab="perm-scope"]');
  if (btn && !btn.classList.contains("active")) {
    switchPermTab("perm-scope", btn);
  } else {
    loadScope();
  }
}

export function onMasterFilterInput() {
  var el = document.getElementById("masterFilter");
  _masterFilter = el ? el.value.trim().toLowerCase() : "";
  renderMasterConfig();
}

export async function loadCommands() {
  const d = await api("/api/commands");
  if (!d) return;
  _cmdData = d;
  _cmdPlatforms = d.platforms || [];
  const gs = d.global_settings || {};
  renderCmdGlobalSettings(gs);
  document.getElementById("cmdCount").textContent = d.total || 0;
  const cmds = d.commands || [];
  if (!cmds.length) {
    document.getElementById("cmdListBody").innerHTML =
      '<div style="padding:32px 18px;text-align:center;color:var(--tx-t);font-size:13px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;opacity:.3;margin-bottom:8px"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg><div>' +
      t("cmd_no_commands") +
      "</div></div>";
    return;
  }
  let html = "";
  for (const c of cmds) {
    const enabled = c.enabled !== false;
    const dotClass = enabled ? "enabled" : "disabled";
    const statusText = enabled ? t("cmd_enabled") : t("cmd_disabled");
    let aliasesHtml = "";
    for (const a of c.original_aliases || []) {
      aliasesHtml +=
        '<span class="cmd-alias-chip original">' + esc(a) + "</span>";
    }
    for (const a of c.custom_aliases || []) {
      aliasesHtml +=
        '<span class="cmd-alias-chip custom">' + esc(a) + "</span>";
    }
    let metaParts = [];
    if (!aliasesHtml) aliasesHtml = "";
    if (aliasesHtml)
      metaParts.push(
        "<span>" + t("cmd_aliases_label") + ": " + aliasesHtml + "</span>",
      );
    if (c.help) metaParts.push("<span>" + esc(c.help) + "</span>");
    if (c.group)
      metaParts.push(
        "<span>" + t("cmd_group") + ": " + esc(c.group) + "</span>",
      );
    if (c.usage)
      metaParts.push(
        '<span style="font-family:Consolas,Monaco,monospace;font-size:11px">' +
          esc(c.usage) +
          "</span>",
      );
    let platformBadges = "";
    for (const p of c.allowed_platforms || []) {
      platformBadges +=
        '<span class="cmd-platform-chip allowed">' + esc(p) + "</span>";
    }
    for (const p of c.blocked_platforms || []) {
      platformBadges +=
        '<span class="cmd-platform-chip blocked">' + esc(p) + "</span>";
    }
    let transformBadge = "";
    if (c.transform_to) {
      transformBadge =
        '<span class="cmd-transform">&rarr; ' + esc(c.transform_to) + "</span>";
    }
    let badges = platformBadges + transformBadge;
    html +=
      '<div class="cmd-row">' +
      '<span class="cmd-status-dot ' +
      dotClass +
      '"></span>' +
      '<div class="cmd-info">' +
      '<div class="cmd-name-row">' +
      '<span class="cmd-name">' +
      esc(c.name) +
      "</span>" +
      (badges ? '<span class="cmd-badges">' + badges + "</span>" : "") +
      "</div>" +
      '<div class="cmd-meta">' +
      (metaParts.length
        ? metaParts.join("")
        : '<span style="color:var(--tx-t)">' +
          t("module_no_desc") +
          "</span>") +
      "</div>" +
      "</div>" +
      '<div class="cmd-actions">' +
      '<button class="btn btn-secondary btn-xs" onclick="openCmdEdit(\'' +
      esc(c.name).replace(/'/g, "\\'") +
      "')\">" +
      t("config") +
      "</button>" +
      "</div>" +
      "</div>";
  }
  document.getElementById("cmdListBody").innerHTML = html;
}

export function renderCmdGlobalSettings(gs) {
  var prefixes = gs.prefixes || [gs.prefix || "/"];
  var prefixStr = prefixes.join(",");
  var html =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 20px">' +
    '<div style="grid-column:1/-1">' +
    '<div style="color:var(--tx-s);font-size:13px;margin-bottom:4px">' +
    t("cmd_prefix") +
    "</div>" +
    '<input class="fw-input" id="cmdSetPrefix" value="' +
    esc(prefixStr) +
    '" placeholder="/" style="width:100%">' +
    '<div style="font-size:11px;color:var(--tx-t);margin-top:2px">' +
    t("cmd_prefix_hint") +
    "</div>" +
    "</div>" +
    renderCmdToggleRow("cmdSetCaseSensitive", t("cmd_case_sensitive"), gs.case_sensitive) +
    renderCmdToggleRow("cmdSetAllowSpace", t("cmd_allow_space_prefix"), gs.allow_space_prefix) +
    renderCmdToggleRow("cmdSetMustAtBot", t("cmd_must_at_bot"), gs.must_at_bot) +
    "</div>";
  document.getElementById("cmdGlobalSettingsBody").innerHTML = html;
  var settingsTimer = null;
  ["cmdSetPrefix", "cmdSetCaseSensitive", "cmdSetAllowSpace", "cmdSetMustAtBot"].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    var handler = function () {
      clearTimeout(settingsTimer);
      settingsTimer = setTimeout(saveCmdGlobalSettings, 800);
    };
    if (el.tagName === "INPUT" && el.type === "checkbox") el.addEventListener("change", handler);
    else el.addEventListener("input", handler);
  });
}

export function renderCmdToggleRow(id, label, checked) {
  return (
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0">' +
    '<span style="color:var(--tx-s);font-size:13px">' +
    esc(label) +
    "</span>" +
    '<label class="switch"><input type="checkbox" id="' +
    id +
    '"' +
    (checked ? " checked" : "") +
    '><span class="switch-slider"></span></label></div>'
  );
}

export async function saveCmdGlobalSettings() {
  if (!authed) return showLogin();
  var prefix = document.getElementById("cmdSetPrefix").value;
  var caseSensitive = document.getElementById("cmdSetCaseSensitive").checked;
  var allowSpace = document.getElementById("cmdSetAllowSpace").checked;
  var mustAtBot = document.getElementById("cmdSetMustAtBot").checked;
  var d = await api("/api/commands/settings", {
    method: "PUT",
    body: JSON.stringify({
      prefix: prefix,
      case_sensitive: caseSensitive,
      allow_space_prefix: allowSpace,
      must_at_bot: mustAtBot,
    }),
  });
  if (d && d.success) {
    toast(t("cmd_settings_saved"), "ok");
  } else {
    toast(t("cmd_save_failed") + ": " + (d?.error || t("unknown_error")), "er");
  }
}

export function initMasterState(masterConfig, platforms) {
  _masterPlatforms = platforms || [];
  _masterEntries = [];
  var users = (masterConfig && masterConfig.users) || {};
  if (Array.isArray(users)) {
    for (var i = 0; i < users.length; i++) {
      _masterEntries.push({ platform: "", userId: String(users[i]) });
    }
  } else if (typeof users === "object" && users !== null) {
    for (var platform in users) {
      var ids = users[platform];
      if (!Array.isArray(ids)) ids = [ids];
      for (var j = 0; j < ids.length; j++) {
        _masterEntries.push({ platform: String(platform), userId: String(ids[j]) });
      }
    }
  }
}

export function renderMasterConfig() {
  var body = document.getElementById("masterListBody");
  if (!body) return;
  var countEl = document.getElementById("masterCount");
  if (countEl) countEl.textContent = _masterEntries.length;

  // Update stats
  var globalCount = 0;
  var platformCount = 0;
  for (var i = 0; i < _masterEntries.length; i++) {
    if (_masterEntries[i].platform) platformCount++;
    else globalCount++;
  }
  var statTotal = document.getElementById("masterStatTotal");
  var statGlobal = document.getElementById("masterStatGlobal");
  var statPlatform = document.getElementById("masterStatPlatform");
  if (statTotal) statTotal.textContent = _masterEntries.length;
  if (statGlobal) statGlobal.textContent = globalCount;
  if (statPlatform) statPlatform.textContent = platformCount;

  // 平台分布可视化
  var distEl = document.getElementById("masterDist");
  if (distEl) {
    if (!_masterEntries.length) {
      distEl.innerHTML = "";
      distEl.style.display = "none";
    } else {
      distEl.style.display = "";
      var byPlatform = {};
      for (var di = 0; di < _masterEntries.length; di++) {
        var dp = _masterEntries[di].platform || "_global";
        byPlatform[dp] = (byPlatform[dp] || 0) + 1;
      }
      var maxCount = 1;
      Object.keys(byPlatform).forEach(function (k) {
        if (byPlatform[k] > maxCount) maxCount = byPlatform[k];
      });
      var distHtml = '<div class="perm-group-title" style="margin-bottom:8px">' + esc(t("master_dist")) + "</div>";
      Object.keys(byPlatform)
        .sort(function (a, b) { return byPlatform[b] - byPlatform[a]; })
        .forEach(function (k) {
          var pct = Math.round((byPlatform[k] / maxCount) * 100);
          var label = k === "_global" ? esc(t("master_global")) : esc(k);
          distHtml +=
            '<div class="master-dist-row">' +
            '<span class="master-dist-name">' + label + "</span>" +
            '<span class="master-dist-bar"><span class="master-dist-fill" style="width:' + pct + '%"></span></span>' +
            '<span class="master-dist-count">' + byPlatform[k] + "</span>" +
            "</div>";
        });
      distEl.innerHTML = distHtml;
    }
  }

  // Update add-form platform options
  renderMasterAddPlatformOptions();

  if (!_masterEntries.length) {
    body.innerHTML =
      '<div class="perm-empty">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="52" height="52" style="color:var(--accent);opacity:0.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>' +
      '<div class="perm-empty-title">' + t("master_empty") + "</div>" +
      '<div class="perm-empty-desc">' + t("master_merge_hint") + "</div>" +
      '<button class="btn btn-primary btn-sm" style="margin-top:14px" onclick="toggleMasterEditor()">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;margin-right:4px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
      t("master_add") +
      "</button>" +
      "</div>";
    if (_masterProviders.length) _renderMasterProviders(body);
    return;
  }

  var f = _masterFilter;
  var visible = [];
  for (var i = 0; i < _masterEntries.length; i++) {
    var en = _masterEntries[i];
    if (
      !f ||
      String(en.userId).toLowerCase().indexOf(f) !== -1 ||
      String(en.platform).toLowerCase().indexOf(f) !== -1
    ) {
      visible.push(i);
    }
  }

  if (countEl && f) {
    countEl.textContent = visible.length + "/" + _masterEntries.length;
  }

  if (!visible.length) {
    body.innerHTML =
      '<div class="perm-empty">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
      '<div class="perm-empty-title">' + t("no_matches") + "</div>" +
      "</div>";
    return;
  }

  // Group visible entries: global first, then by platform
  var globalEntries = [];
  var platformGroups = {};
  var platformOrder = [];
  for (var k = 0; k < visible.length; k++) {
    var v = visible[k];
    var ent = _masterEntries[v];
    if (!ent.platform) globalEntries.push(v);
    else {
      if (!platformGroups[ent.platform]) {
        platformGroups[ent.platform] = [];
        platformOrder.push(ent.platform);
      }
      platformGroups[ent.platform].push(v);
    }
  }

  var html = "";

  // Global section
  if (globalEntries.length > 0) {
    html +=
      '<div class="perm-group">' +
      '<div class="perm-group-head">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/></svg>' +
      '<span class="perm-group-title">' + t("master_global_users") + "</span>" +
      '<span class="perm-group-count">' + globalEntries.length + "</span>" +
      '<span class="perm-group-hint">' + t("master_global_users_hint") + "</span>" +
      "</div>" +
      '<div class="perm-members">';
    for (var j = 0; j < globalEntries.length; j++) {
      html += renderMasterTag(globalEntries[j]);
    }
    html += "</div></div>";
  }

  // Platform sections
  for (var pi = 0; pi < platformOrder.length; pi++) {
    var platform = platformOrder[pi];
    var indices = platformGroups[platform];
    html +=
      '<div class="perm-group">' +
      '<div class="perm-group-head">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/></svg>' +
      '<span class="perm-group-title">' + esc(platform) + "</span>" +
      '<span class="perm-group-count">' + indices.length + "</span>" +
      "</div>" +
      '<div class="perm-members">';
    for (var j = 0; j < indices.length; j++) {
      html += renderMasterTag(indices[j]);
    }
    html += "</div></div>";
  }

  // Hint at bottom
  html += '<div class="perm-hint">' + t("master_merge_hint") + "</div>";

  html += _masterProvidersHtml();

  body.innerHTML = html;
}

export function _masterProvidersHtml() {
  if (!_masterProviders.length) return "";
  return (
    '<div class="perm-group">' +
    '<div class="perm-group-head">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-3.6 8-10V5.4L12 2.5 4 5.4V12c0 6.4 8 10 8 10z"/></svg>' +
    '<span class="perm-group-title">' + t("master_providers_title") + "</span>" +
    '<span class="perm-group-count">' + _masterProviders.length + "</span>" +
    "</div>" +
    '<div class="perm-members">' +
    _masterProviders
      .map(function (p) {
        return (
          '<div class="perm-member">' +
          '<span class="perm-member-avatar">ƒ</span>' +
          '<span class="perm-member-id">' + esc(p.name) + "</span>" +
          (p.owner
            ? '<span class="scope-owner-chip">📦 ' + esc(p.owner) + "</span>"
            : "") +
          "</div>"
        );
      })
      .join("") +
    "</div></div>"
  );
}

export function _renderMasterProviders(container) {
  if (!container) return;
  var div = document.createElement("div");
  div.innerHTML = _masterProvidersHtml();
  if (div.firstChild) container.appendChild(div.firstChild);
}

export function renderMasterTag(idx) {
  var entry = _masterEntries[idx];
  var initial = (entry.userId || "?").trim().charAt(0).toUpperCase();
  return (
    '<div class="perm-member" data-uid="' + esc(entry.userId) + '">' +
    '<span class="perm-member-avatar">' + esc(initial) + "</span>" +
    '<span class="perm-member-id">' + esc(entry.userId) + "</span>" +
    '<button class="perm-member-remove" onclick="removeMasterEntry(' + idx + ')" title="' + t("master_remove") + '">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
    "</button></div>"
  );
}

export function renderMasterAddPlatformOptions() {
  var sel = document.getElementById("masterAddPlatform");
  if (!sel) return;
  var current = sel.value;
  var html = '<option value="">' + t("master_global") + "</option>";
  for (var i = 0; i < _masterPlatforms.length; i++) {
    var p = _masterPlatforms[i];
    html += '<option value="' + esc(p) + '">' + esc(p) + "</option>";
  }
  html += '<option value="__custom__">' + t("custom") + "</option>";
  sel.innerHTML = html;
  if (current && current !== "__custom__") sel.value = current;
}

export function onMasterAddPlatformChange() {
  var sel = document.getElementById("masterAddPlatform");
  if (!sel || sel.value !== "__custom__") return;
  // Replace select with text input for custom platform
  var wrapper = sel.parentElement;
  sel.outerHTML =
    '<input id="masterAddPlatform" class="fw-input" style="width:150px;flex-shrink:0;font-size:13px" placeholder="' + t("master_add_platform") +
    '" data-custom="1">';
  var newInput = document.getElementById("masterAddPlatform");
  if (newInput) newInput.focus();
}

export function addMasterFromForm() {
  var sel = document.getElementById("masterAddPlatform");
  var idInput = document.getElementById("masterAddId");
  if (!idInput) return;
  var userId = idInput.value.trim();
  if (!userId) {
    idInput.focus();
    return;
  }
  var platform = "";
  if (sel) {
    if (sel.value === "__custom__") return;
    if (sel.dataset && sel.dataset.custom === "1") {
      platform = sel.value.trim();
      if (!platform) {
        sel.focus();
        return;
      }
    } else {
      platform = sel.value;
    }
  }
  _masterEntries.push({ platform: platform, userId: userId });
  idInput.value = "";
  // Reset platform selector if it was custom
  if (sel && sel.dataset && sel.dataset.custom === "1") {
    renderMasterConfig();
  }
  idInput.focus();
  renderMasterConfig();
  saveMasterConfig();
}

export function removeMasterEntry(idx) {
  _masterEntries.splice(idx, 1);
  renderMasterConfig();
  saveMasterConfig();
}

export function toggleMasterEditor() {
  var card = document.getElementById("masterEditorCard");
  if (!card) return;
  var show = card.style.display === "none";
  card.style.display = show ? "" : "none";
  if (show) {
    renderMasterAddPlatformOptions();
    var idInput = document.getElementById("masterAddId");
    if (idInput) idInput.focus();
  }
}

export async function loadMaster() {
  var filterEl = document.getElementById("masterFilter");
  if (filterEl) filterEl.value = "";
  _masterFilter = "";
  var d = await api("/api/master");
  if (!d) return;
  _masterProviders = d.providers || [];
  var platforms = d.platforms || [];
  try {
    var ad = await api("/api/adapters");
    if (ad && ad.adapters) {
      platforms = ad.adapters.map(function (a) { return a.platform; });
    }
  } catch (e) {}
  initMasterState(d.master || {}, platforms);
  renderMasterConfig();
}

export function collectMasterEntries() {
  return _masterEntries.filter(function (e) { return e.userId; });
}

export async function saveMasterConfig() {
  if (!authed) return showLogin();
  var entries = collectMasterEntries();
  var globalEntries = entries.filter(function (e) { return !e.platform; });
  var platformEntries = entries.filter(function (e) { return e.platform; });
  var users;
  if (platformEntries.length === 0) {
    users = globalEntries.map(function (e) { return e.userId; });
  } else {
    users = {};
    for (var i = 0; i < platformEntries.length; i++) {
      var p = platformEntries[i].platform;
      if (!users[p]) users[p] = [];
      if (users[p].indexOf(platformEntries[i].userId) === -1) users[p].push(platformEntries[i].userId);
    }
    for (var i = 0; i < globalEntries.length; i++) {
      for (var p in users) {
        if (users[p].indexOf(globalEntries[i].userId) === -1) users[p].push(globalEntries[i].userId);
      }
    }
  }
  var d = await api("/api/master", {
    method: "PUT",
    body: JSON.stringify({ users: users }),
  });
  if (d && d.success) {
    toast(t("master_saved"), "ok");
  } else {
    toast(t("save_failed") + ": " + (d?.error || t("unknown_error")), "er");
  }
}

export async function loadScope() {
  var d = await api("/api/scope");
  if (!d) return;
  _scopeData = d;
  var unsupported = document.getElementById("scopeUnsupported");
  var main = document.getElementById("scopeMain");
  if (!d.supported) {
    if (unsupported) unsupported.style.display = "";
    if (main) main.style.display = "none";
    return;
  }
  if (unsupported) unsupported.style.display = "none";
  if (main) main.style.display = "";
  await _loadScopeContexts();
  renderScopeAll();
  onScopeTestKindChange();
}

export async function _loadScopeContexts() {
  _scopePlatformBots = {};
  _scopeRegisteredModules = [];
  try {
    var ad = await api("/api/adapters");
    (ad?.adapters || []).forEach(function (a) {
      _scopePlatformBots[a.platform] = (a.bots || []).map(function (b) {
        return b.bot_id;
      });
    });
  } catch (e) {}
  try {
    var md = await api("/api/modules");
    _scopeRegisteredModules = (md?.modules || [])
      .filter(function (m) {
        return m.type === "module";
      })
      .map(function (m) {
        return m.name;
      });
  } catch (e) {}
  var platforms = Object.keys(_scopePlatformBots);
  [["scopeModulePlatform", "scopeModuleBot"], ["scopeIdnPlatform", "scopeIdnBot"], ["scopeTestPlatform", "scopeTestBot"]].forEach(function (pair) {
    var pSel = document.getElementById(pair[0]);
    var bSel = document.getElementById(pair[1]);
    if (!pSel) return;
    var prevP = pSel.value;
    pSel.innerHTML =
      '<option value="">' + esc(t("topo_type_adapter")) + "…</option>" +
      platforms
        .map(function (p) {
          return '<option value="' + esc(p) + '">' + esc(p) + "</option>";
        })
        .join("");
    if (prevP && platforms.indexOf(prevP) >= 0) pSel.value = prevP;
    onScopePlatformChange(pair[0] === "scopeModulePlatform" ? "module" : pair[0] === "scopeIdnPlatform" ? "identity" : "test");
  });
  var mSel = document.getElementById("scopeActionModule");
  var tSel = document.getElementById("scopeTestModule");
  [mSel, tSel].forEach(function (sel) {
    if (!sel) return;
    var prev = sel.value;
    sel.innerHTML =
      '<option value="">' + esc(t("topo_type_module")) + "…</option>" +
      _scopeRegisteredModules
        .map(function (m) {
          return '<option value="' + esc(m) + '">' + esc(m) + "</option>";
        })
        .join("");
    if (prev && _scopeRegisteredModules.indexOf(prev) >= 0) sel.value = prev;
  });
}

export function onScopePlatformChange(kind) {
  var pSelId = kind === "module" ? "scopeModulePlatform" : kind === "identity" ? "scopeIdnPlatform" : "scopeTestPlatform";
  var bSelId = kind === "module" ? "scopeModuleBot" : kind === "identity" ? "scopeIdnBot" : "scopeTestBot";
  var pSel = document.getElementById(pSelId);
  var bSel = document.getElementById(bSelId);
  if (!pSel || !bSel) return;
  var bots = _scopePlatformBots[pSel.value] || [];
  bSel.innerHTML =
    '<option value="">' + esc(t("scope_all_bots")) + "</option>" +
    bots
      .map(function (b) {
        return '<option value="' + esc(b) + '">' + esc(b) + "</option>";
      })
      .join("");
  if (kind === "module") {
    var editorCard = document.getElementById("scopeModuleEditorCard");
    if (editorCard && editorCard.style.display !== "none") {
      renderScopeModuleCrumbsFromEditor();
    }
  }
}

export function onScopeIdnLevelChange() {
  var level = document.getElementById("scopeIdnLevel").value;
  var botField = document.getElementById("scopeIdnBotField");
  var targetField = document.getElementById("scopeIdnTargetField");
  var targetLabel = document.getElementById("scopeIdnTargetLabel");
  var target = document.getElementById("scopeIdnTarget");
  if (botField) botField.style.display = level === "adapter" ? "none" : "";
  if (targetField) targetField.style.display = level === "session" || level === "user" ? "" : "none";
  if (targetLabel) targetLabel.textContent = t(level === "user" ? "scope_level_user" : "scope_level_session");
  if (target) target.placeholder = t(level === "user" ? "scope_user_ph" : "scope_session_ph");
}

export function _scopeEntryChips(items, cls) {
  return (items || [])
    .map(function (x) {
      return '<span class="scope-entry-chip ' + (cls || "") + '">' + esc(x) + "</span>";
    })
    .join(" ");
}

export function renderScopeAll() {
  if (!_scopeData || !_scopeData.supported) return;
  var topo = _scopeData.topology || {};
  var stats = _scopeData.stats || {};
  var da = document.getElementById("scopeDefaultAllow");
  if (da) da.checked = !!_scopeData.default_allow;

  var moduleFiltered = stats.module_filtered || 0;
  var identityDenied = stats.identity_denied || 0;
  var actionDenied = stats.action_denied || 0;
  var hits = stats.cache_hits || 0;
  var misses = stats.cache_misses || 0;
  var hitRate = hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 0;
  _setText("scopeStatModule", moduleFiltered);
  _setText("scopeStatIdentity", identityDenied);
  _setText("scopeStatAction", actionDenied);
  _setText("scopeStatCache", hitRate + "%");

  var modCount = renderScopeModuleList(topo);
  var idnCount = renderScopeIdentityList(topo);
  var actCount = renderScopeActionList(topo);
  renderScopeRuntimeList();
  _setText("scopeNavCountMod", modCount);
  _setText("scopeNavCountIdn", idnCount);
  _setText("scopeNavCountAct", actCount);
  _setText("scopeNavCountRt", ((_scopeData && _scopeData.runtime_bindings) || []).length);
}

export function switchScopePanel(panel, btn) {
  var nav = document.getElementById("scopeNav");
  if (nav) {
    nav.querySelectorAll(".scope-nav-item").forEach(function (b) {
      b.classList.remove("active");
    });
  }
  if (btn) btn.classList.add("active");
  ["mod", "idn", "act", "rt", "test"].forEach(function (p) {
    var el = document.getElementById("scopePanel-" + p);
    if (el) el.style.display = p === panel ? "" : "none";
  });
  if (panel === "mod") {
    var editorCard = document.getElementById("scopeModuleEditorCard");
    if (editorCard) editorCard.style.display = "none";
  }
}

export function _scopeLevelBadge(level) {
  var labelKey = { P: "scope_level_platform", B: "scope_level_bot", S: "scope_level_session", A: "scope_level_adapter", U: "scope_level_user" }[level] || "scope_level_platform";
  var icons = {
    P: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/></svg>',
    B: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M12 8V4M8 4h8"/><circle cx="8.5" cy="14" r="1"/><circle cx="15.5" cy="14" r="1"/></svg>',
    S: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    A: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    U: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  };
  return (
    '<span class="scope-level-badge lv-' + level.toLowerCase() + '">' +
    (icons[level] || "") + "<span>" + esc(t(labelKey)) + "</span></span>"
  );
}

export function renderUxEmpty(iconSvg, titleKey, descKey, actionHtml) {
  return (
    '<div class="ux-empty">' +
    '<div class="ux-empty-icon">' + iconSvg + "</div>" +
    '<div class="ux-empty-title">' + esc(t(titleKey)) + "</div>" +
    (descKey ? '<div class="ux-empty-desc">' + esc(t(descKey)) + "</div>" : "") +
    (actionHtml ? '<div class="ux-empty-action">' + actionHtml + "</div>" : "") +
    "</div>"
  );
}

export function _setText(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value;
}

export function _scopeModuleNodeHtml(r, isLast) {
  var path = r.platform + (r.bot ? " / " + r.bot : "") + (r.session ? " / " + r.session : "");
  var cfg = r.cfg || {};
  var modList = (cfg.modules || []).map(String);
  var blockList = (cfg.blocked || []).map(String);
  var chips = "";
  if (modList.length) chips += _scopeEntryChips(modList, "");
  if (blockList.length) chips += (chips ? " " : "") + _scopeEntryChips(blockList, "blocked");
  if (cfg.merge) chips += ' <span class="scope-entry-chip merge">merge</span>';
  if (!chips) chips = '<span class="scope-inherit">' + esc(t("scope_inherit")) + "</span>";
  var target = { platform: r.platform, bot: r.bot || null, session: r.session || null };
  var editArgs = encodeURIComponent(JSON.stringify(target));
  var delArgs = "'" + _jsq(r.platform) + "','" + _jsq(r.bot || "") + "','" + _jsq(r.session || "") + "'";
  return (
    '<div class="scope-tree-node">' +
    (r.level === "P" ? "" : '<div class="scope-tree-guide' + (isLast ? " leaf" : "") + '"></div>') +
    '<div class="scope-tree-row lv-' + r.level.toLowerCase() + '">' +
    '<div class="scope-tree-main">' + _scopeLevelBadge(r.level) +
    '<span class="scope-tree-name">' + esc(path) + "</span>" +
    '<span class="scope-tree-chips">' + chips + "</span></div>" +
    '<div class="scope-tree-actions">' +
    '<button class="btn btn-secondary btn-sm" onclick="openScopeModuleEditor(decodeURIComponent(\'' + editArgs + '\'))">' + esc(t("node_edit")) + "</button>" +
    '<button class="btn btn-danger btn-sm" onclick="deleteScopeModule(' + delArgs + ')">' + esc(t("scope_delete")) + "</button>" +
    "</div></div></div>"
  );
}

export function renderScopeModuleList(topo) {
  topo = topo || (_scopeData && _scopeData.topology) || {};
  var container = document.getElementById("scopeModuleListBody");
  if (!container) return 0;
  var platforms = topo.platforms || {};
  var bots = topo.bots || {};
  var sessions = topo.sessions || {};
  var total = 0;
  var html = [];
  Object.keys(platforms).sort().forEach(function (p) {
    total++;
    html.push(_scopeModuleNodeHtml({ level: "P", platform: p, cfg: platforms[p] }, false));
    var children = [];
    Object.keys(bots[p] || {}).sort().forEach(function (b) {
      children.push({ level: "B", platform: p, bot: b, cfg: bots[p][b] });
    });
    Object.keys(sessions[p] || {}).sort().forEach(function (s) {
      children.push({ level: "S", platform: p, session: s, cfg: sessions[p][s] });
    });
    children.forEach(function (child, i) {
      total++;
      html.push(_scopeModuleNodeHtml(child, i === children.length - 1));
    });
  });
  var countEl = document.getElementById("scopeModuleCount");
  if (countEl) countEl.textContent = total;
  if (!total) {
    container.innerHTML = renderUxEmpty(
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
      "scope_no_rules"
    );
    return 0;
  }
  container.innerHTML = '<div class="scope-tree">' + html.join("") + "</div>";
  return total;
}

export function renderScopeIdentityList(topo) {
  topo = topo || (_scopeData && _scopeData.topology) || {};
  var container = document.getElementById("scopeIdentityListBody");
  if (!container) return 0;
  var identity = topo.identity || {};
  var buckets = [
    ["adapters", "A", "scope_level_adapter"],
    ["bots", "B", "scope_level_bot"],
    ["sessions", "S", "scope_level_session"],
    ["users", "U", "scope_level_user"],
  ];
  var rows = [];
  buckets.forEach(function (pair) {
    var bucket = identity[pair[0]] || {};
    Object.keys(bucket).sort().forEach(function (p) {
      var sub = bucket[p];
      if (pair[0] === "adapters") {
        rows.push({ bucket: pair[0], level: pair[1], labelKey: pair[2], platform: p, cfg: sub });
      } else {
        Object.keys(sub || {}).sort().forEach(function (k) {
          rows.push({ bucket: pair[0], level: pair[1], labelKey: pair[2], platform: p, key: k, cfg: sub[k] });
        });
      }
    });
  });
  var countEl = document.getElementById("scopeIdentityCount");
  if (countEl) countEl.textContent = rows.length;
  if (!rows.length) {
    container.innerHTML = renderUxEmpty(
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      "scope_no_rules"
    );
    return 0;
  }
  container.innerHTML = '<div class="scope-tree">' + rows
    .map(function (r) {
      var path = r.platform + (r.key ? " / " + r.key : "");
      var isDeny = r.cfg && r.cfg.deny;
      var chips = isDeny
        ? '<span class="scope-entry-chip deny">deny</span>'
        : '<span class="scope-entry-chip">allow</span>';
      var args =
        "'" + _jsq(r.bucket) + "','" + _jsq(r.platform) + "','" + _jsq(r.key || "") + "'";
      return (
        '<div class="scope-tree-node">' +
        '<div class="scope-tree-row lv-' + r.level.toLowerCase() + '">' +
        '<div class="scope-tree-main">' + _scopeLevelBadge(r.level) +
        '<span class="scope-tree-name">' + esc(path) + "</span>" +
        '<span class="scope-tree-chips">' + chips + "</span></div>" +
        '<div class="scope-tree-actions">' +
        '<button class="btn btn-danger btn-sm" onclick="deleteScopeIdentity(' + args + ')">' + esc(t("scope_delete")) + "</button>" +
        "</div></div></div>"
      );
    })
    .join("") + "</div>";
  return rows.length;
}

export function renderScopeActionList(topo) {
  topo = topo || (_scopeData && _scopeData.topology) || {};
  var container = document.getElementById("scopeActionListBody");
  if (!container) return 0;
  var actions = topo.actions || {};
  var rows = [];
  Object.keys(actions).sort().forEach(function (m) {
    Object.keys(actions[m] || {}).sort().forEach(function (a) {
      rows.push({ module: m, action: a, rule: actions[m][a] });
    });
  });
  var countEl = document.getElementById("scopeActionCount");
  if (countEl) countEl.textContent = rows.length;
  if (!rows.length) {
    container.innerHTML = renderUxEmpty(
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
      "scope_no_rules"
    );
    return 0;
  }
  container.innerHTML = '<div class="scope-tree">' + rows
    .map(function (r) {
      var rule = r.rule || {};
      var chips = "";
      if (rule.deny === true) {
        chips += '<span class="scope-entry-chip deny">deny *</span>';
      } else if (Array.isArray(rule.deny) && rule.deny.length) {
        chips += _scopeEntryChips(rule.deny, "deny");
      }
      if (Array.isArray(rule.allow) && rule.allow.length) {
        chips += (chips ? " " : "") + _scopeEntryChips(rule.allow, "");
      }
      if (!chips) chips = '<span class="scope-inherit">' + esc(t("scope_no_rules")) + "</span>";
      var args = "'" + _jsq(r.module) + "','" + _jsq(r.action) + "'";
      return (
        '<div class="scope-tree-node">' +
        '<div class="scope-tree-row">' +
        '<div class="scope-tree-main"><span class="scope-act-mod">' + esc(r.module) + "</span>" +
        '<span class="scope-act-type">' + esc(r.action) + "</span>" +
        '<span class="scope-tree-chips">' + chips + "</span></div>" +
        '<div class="scope-tree-actions">' +
        '<button class="btn btn-danger btn-sm" onclick="deleteScopeAction(' + args + ')">' + esc(t("scope_delete")) + "</button>" +
        "</div></div></div>"
      );
    })
    .join("") + "</div>";
  return rows.length;
}

export function renderScopeRuntimeList() {
  var container = document.getElementById("scopeRuntimeListBody");
  if (!container) return;
  var bindings = (_scopeData && _scopeData.runtime_bindings) || [];
  var countEl = document.getElementById("scopeRuntimeCount");
  if (countEl) countEl.textContent = bindings.length;
  var owners = {};
  bindings.forEach(function (b) {
    var o = b.owner || "-";
    owners[o] = (owners[o] || 0) + 1;
  });
  var html = "";
  if (bindings.length) {
    html += '<div style="margin-bottom:10px;display:flex;gap:6px;flex-wrap:wrap">';
    Object.keys(owners).forEach(function (o) {
      html +=
        '<button class="btn btn-secondary btn-sm" onclick="cleanupScopeRuntime(\'' +
        _jsq(o) +
        '\')">' + esc(t("scope_cleanup")) + ": " + esc(o) + " (" + owners[o] + ")</button>";
    });
    html += "</div>";
  }
  if (!bindings.length) {
    html += renderUxEmpty(
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
      "scope_no_runtime"
    );
  } else {
    html += bindings
      .map(function (b) {
        var preview = "";
        try {
          preview = JSON.stringify(b.value);
        } catch (e) {
          preview = String(b.value);
        }
        if (preview.length > 120) preview = preview.slice(0, 120) + "…";
        return (
          '<div class="scope-row"><div class="scope-row-main"><span class="scope-row-path">' +
          esc(b.path) +
          '</span>' +
          '<span class="scope-owner-chip">📦 ' + esc(b.owner || "-") + "</span>" +
          '<span class="scope-row-sub">' + esc(preview) + "</span></div></div>"
        );
      })
      .join("");
  }
  container.innerHTML = html;
}

export function _ensureScopeMultiselects() {
  if (_scopeMsWhite && _scopeMsBlock) return;
  _scopeMsWhite = EP.createMultiSelect({
    host: document.getElementById("scopeMsWhitelistHost"),
    items: [],
    selected: new Set(),
    placeholder: t("scope_ms_modules_ph"),
    searchPlaceholder: t("scope_ms_modules_ph"),
    selectAll: t("select_all"),
    clear: t("clear_all"),
    emptyText: t("no_matches"),
    countLabel: t("ep_selected"),
    onChange: function () {},
  });
  _scopeMsBlock = EP.createMultiSelect({
    host: document.getElementById("scopeMsBlocklistHost"),
    items: [],
    selected: new Set(),
    placeholder: t("scope_ms_modules_ph"),
    searchPlaceholder: t("scope_ms_modules_ph"),
    selectAll: t("select_all"),
    clear: t("clear_all"),
    emptyText: t("no_matches"),
    countLabel: t("ep_selected"),
    onChange: function () {},
  });
}

export function _renderScopeCrumbs(platform, bot, session) {
  var el = document.getElementById("scopeModuleCrumbs");
  if (!el) return;
  function part(level, value, anyText) {
    return (
      '<span style="display:inline-flex;align-items:center;gap:4px">' +
      _scopeLevelBadge(level) +
      '<span class="' + (value ? "scope-tree-name" : "scope-inherit") + '">' +
      esc(value || anyText) +
      "</span></span>"
    );
  }
  el.innerHTML =
    part("P", platform, platform || t("scope_crumbs_any")) +
    '<span class="scope-crumbs-sep">›</span>' +
    part("B", bot, t("scope_all_bots")) +
    '<span class="scope-crumbs-sep">›</span>' +
    part("S", session, t("scope_crumbs_any"));
}

export function renderScopeModuleCrumbsFromEditor() {
  _renderScopeCrumbs(
    document.getElementById("scopeModulePlatform").value,
    document.getElementById("scopeModuleBot").value,
    document.getElementById("scopeModuleSession").value.trim()
  );
}

export function openScopeModuleEditor(target) {
  if (typeof target === "string") {
    try {
      target = JSON.parse(target);
    } catch (e) {
      target = null;
    }
  }
  _scopeEditorTarget = target || null;
  var card = document.getElementById("scopeModuleEditorCard");
  if (!card) return;
  card.style.display = "";
  var titleEl = document.getElementById("scopeModuleEditorTitle");
  if (titleEl) titleEl.textContent = target ? t("scope_editor_edit") : t("scope_editor_new");

  var platform = target ? target.platform || "" : "";
  var bot = target ? target.bot || "" : "";
  var session = target ? target.session || "" : "";
  var platformSel = document.getElementById("scopeModulePlatform");
  if (platform && platformSel && !platformSel.querySelector('option[value="' + CSS.escape(platform) + '"]')) {
    var opt = document.createElement("option");
    opt.value = platform;
    opt.textContent = platform;
    platformSel.appendChild(opt);
  }
  if (platformSel) platformSel.value = platform;
  onScopePlatformChange("module");
  var botSel = document.getElementById("scopeModuleBot");
  if (bot && botSel && !botSel.querySelector('option[value="' + CSS.escape(bot) + '"]')) {
    var opt2 = document.createElement("option");
    opt2.value = bot;
    opt2.textContent = bot;
    botSel.appendChild(opt2);
  }
  if (botSel) botSel.value = bot;
  var sessionInput = document.getElementById("scopeModuleSession");
  if (sessionInput) sessionInput.value = session;

  // 读取现有绑定（会话 > Bot > 平台）
  var existing = {};
  if (_scopeData && _scopeData.topology) {
    var topo = _scopeData.topology;
    var bucket =
      session && topo.sessions && topo.sessions[platform]
        ? (topo.sessions[platform] || {})[session]
        : bot && topo.bots && topo.bots[platform]
          ? (topo.bots[platform] || {})[bot]
          : topo.platforms
            ? topo.platforms[platform]
            : null;
    if (bucket && typeof bucket === "object") existing = bucket;
  }
  var white = (existing.modules || []).map(String);
  var block = (existing.blocked || []).map(String);
  var mergeEl = document.getElementById("scopeModuleMerge");
  if (mergeEl) mergeEl.checked = !!existing.merge;

  _ensureScopeMultiselects();
  var globExtra = white.concat(block).filter(function (e) {
    return !_scopeRegisteredModules.some(function (m) {
      return m.toLowerCase() === e.toLowerCase();
    });
  });
  var allModules = _scopeRegisteredModules.concat(globExtra).sort();
  var whiteSet = _scopeMsWhite.getSelected();
  var blockSet = _scopeMsBlock.getSelected();
  whiteSet.clear();
  white.forEach(function (w) { whiteSet.add(w); });
  blockSet.clear();
  block.forEach(function (b) { blockSet.add(b); });
  _scopeMsWhite.setItems(allModules);
  _scopeMsBlock.setItems(allModules);
  renderScopeModuleCrumbsFromEditor();
}

export function closeScopeModuleEditor() {
  var card = document.getElementById("scopeModuleEditorCard");
  if (card) card.style.display = "none";
  _scopeEditorTarget = null;
}

export async function saveScopeModule() {
  if (!_scopeMsWhite || !_scopeMsBlock) return;
  var platform = document.getElementById("scopeModulePlatform").value;
  if (!platform) {
    toast(t("action_failed"), "er");
    return;
  }
  var bot = document.getElementById("scopeModuleBot").value;
  var session = document.getElementById("scopeModuleSession").value.trim();
  var modules = Array.from(_scopeMsWhite.getSelected());
  var blocked = Array.from(_scopeMsBlock.getSelected());
  var d = await api("/api/scope/module", {
    method: "POST",
    body: JSON.stringify({
      platform: platform,
      bot_id: bot || null,
      session_id: session || null,
      modules: modules,
      blocked: blocked,
      merge: document.getElementById("scopeModuleMerge").checked,
    }),
  });
  if (d && d.success) {
    toast(t("scope_saved"), "ok");
    closeScopeModuleEditor();
    loadScope();
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

export async function deleteScopeModule(platform, bot, session) {
  var d = await api("/api/scope/module", {
    method: "DELETE",
    body: JSON.stringify({
      platform: platform,
      bot_id: bot || null,
      session_id: session || null,
    }),
  });
  if (d && d.success) {
    toast(t("scope_saved"), "ok");
    loadScope();
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

export function setScopeIdnPolicy(policy) {
  _scopeIdnPolicy = policy === "deny" ? "deny" : "allow";
  var wrap = document.getElementById("scopeIdnPolicy");
  if (!wrap) return;
  wrap.querySelectorAll(".scope-policy-btn").forEach(function (b) {
    b.classList.toggle("active", b.getAttribute("data-policy") === _scopeIdnPolicy);
  });
}

export function toggleScopeIdentityEditor() {
  var card = document.getElementById("scopeIdentityEditorCard");
  if (!card) return;
  var show = card.style.display === "none";
  card.style.display = show ? "" : "none";
  if (!show) return;
  setScopeIdnPolicy("allow");
  onScopeIdnLevelChange();
}

export async function saveScopeIdentity() {
  var platform = document.getElementById("scopeIdnPlatform").value;
  if (!platform) {
    toast(t("action_failed"), "er");
    return;
  }
  var level = document.getElementById("scopeIdnLevel").value;
  var bot = document.getElementById("scopeIdnBot").value;
  var target = document.getElementById("scopeIdnTarget").value.trim();
  var policy = _scopeIdnPolicy;
  var body = {
    platform: platform,
    bot_id: level === "adapter" ? null : bot || null,
    session_id: level === "session" ? target || null : null,
    user_id: level === "user" ? target || null : null,
    allow: policy === "allow",
    deny: policy === "deny",
  };
  var d = await api("/api/scope/identity", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (d && d.success) {
    toast(t("scope_saved"), "ok");
    var card = document.getElementById("scopeIdentityEditorCard");
    if (card) card.style.display = "none";
    loadScope();
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

export async function deleteScopeIdentity(bucket, platform, key) {
  var body = { platform: platform };
  if (bucket === "bots") body.bot_id = key;
  else if (bucket === "sessions") body.session_id = key;
  else if (bucket === "users") body.user_id = key;
  var d = await api("/api/scope/identity", {
    method: "DELETE",
    body: JSON.stringify(body),
  });
  if (d && d.success) {
    toast(t("scope_saved"), "ok");
    loadScope();
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

export function toggleScopeActionEditor() {
  var card = document.getElementById("scopeActionEditorCard");
  if (!card) return;
  card.style.display = card.style.display === "none" ? "" : "none";
}

export async function saveScopeAction() {
  var moduleName = document.getElementById("scopeActionModule").value;
  var action = document.getElementById("scopeActionType").value;
  if (!moduleName) {
    toast(t("action_failed"), "er");
    return;
  }
  var denyAll = document.getElementById("scopeActionDenyAll").checked;
  var allow = document.getElementById("scopeActionAllow").value
    .split(",")
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
  var deny = document.getElementById("scopeActionDeny").value
    .split(",")
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
  var body = {
    module: moduleName,
    action: action,
    allow: denyAll ? null : allow,
    deny: denyAll ? true : deny.length ? deny : null,
  };
  var d = await api("/api/scope/action", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (d && d.success) {
    toast(t("scope_saved"), "ok");
    loadScope();
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

export async function deleteScopeAction(moduleName, action) {
  var d = await api("/api/scope/action", {
    method: "DELETE",
    body: JSON.stringify({ module: moduleName, action: action }),
  });
  if (d && d.success) {
    toast(t("scope_saved"), "ok");
    loadScope();
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

export async function cleanupScopeRuntime(owner) {
  var d = await api("/api/scope/runtime/cleanup", {
    method: "POST",
    body: JSON.stringify({ owner: owner }),
  });
  if (d && d.success) {
    toast(t("scope_saved"), "ok");
    loadScope();
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

export async function onScopeDefaultAllowChange(checked) {
  var d = await api("/api/scope/settings", {
    method: "PUT",
    body: JSON.stringify({ default_allow: checked }),
  });
  if (d && d.success) {
    toast(t("scope_saved"), "ok");
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

export async function resetScopeStats() {
  var d = await api("/api/scope/stats/reset", { method: "POST" });
  if (d && d.success) {
    loadScope();
  }
}

export function openScopeTransfer() {
  var overlay = document.getElementById("scopeTransferOverlay");
  if (overlay) overlay.style.display = "flex";
  switchScopeTransfer("export", document.querySelector('#scopeTransferTabs [data-tab="export"]'));
  _loadScopeTransferData();
}

export function closeScopeTransfer() {
  var overlay = document.getElementById("scopeTransferOverlay");
  if (overlay) overlay.style.display = "none";
}

export function switchScopeTransfer(tab, btn) {
  var bar = document.getElementById("scopeTransferTabs");
  if (bar) {
    bar.querySelectorAll(".view-btn").forEach(function (b) {
      b.classList.remove("active");
    });
  }
  if (btn) btn.classList.add("active");
  var ex = document.getElementById("scopeTransferExport");
  var im = document.getElementById("scopeTransferImport");
  if (ex) ex.style.display = tab === "export" ? "" : "none";
  if (im) im.style.display = tab === "import" ? "" : "none";
}

export async function _loadScopeTransferData() {
  var d = await api("/api/scope/export");
  _scopeTransferData = d && d.config ? d : null;
  _renderScopeExportDims();
}

export function _scopeDimCounts(config) {
  config = config || {};
  function countSub(sub) {
    var n = 0;
    Object.keys(sub || {}).forEach(function (k) {
      n += Object.keys(sub[k] || {}).length;
    });
    return n;
  }
  return {
    platforms: Object.keys(config.platforms || {}).length,
    bots: countSub(config.bots),
    sessions: countSub(config.sessions),
    identity:
      countSub((config.identity || {}).adapters) +
      countSub((config.identity || {}).bots) +
      countSub((config.identity || {}).sessions) +
      countSub((config.identity || {}).users),
    actions: countSub(config.actions),
  };
}

export function _scopeDimRowHtml(dim, checked, count) {
  var labels = {
    default_allow: t("scope_dim_default"),
    platforms: t("scope_dim_platforms"),
    bots: t("scope_dim_bots"),
    sessions: t("scope_dim_sessions"),
    identity: t("scope_nav_identity"),
    actions: t("scope_nav_action"),
  };
  return (
    '<label class="scope-dim-row">' +
    '<input type="checkbox" data-dim="' + dim + '"' + (checked ? " checked" : "") + "/>" +
    '<span class="scope-dim-label">' + esc(labels[dim] || dim) + "</span>" +
    '<span class="chip chip-sc">' + esc(String(count)) + "</span>" +
    "</label>"
  );
}

export function _renderScopeExportDims() {
  var el = document.getElementById("scopeExportDims");
  if (!el) return;
  if (!_scopeTransferData) {
    el.innerHTML = '<div class="scope-empty">…</div>';
    return;
  }
  var c = _scopeTransferData.config || {};
  var counts = _scopeDimCounts(c);
  el.innerHTML =
    _scopeDimRowHtml("platforms", counts.platforms > 0, counts.platforms) +
    _scopeDimRowHtml("bots", counts.bots > 0, counts.bots) +
    _scopeDimRowHtml("sessions", counts.sessions > 0, counts.sessions) +
    _scopeDimRowHtml("identity", counts.identity > 0, counts.identity) +
    _scopeDimRowHtml("actions", counts.actions > 0, counts.actions) +
    _scopeDimRowHtml("default_allow", true, _scopeTransferData.default_allow ? "ON" : "OFF");
}

export function _scopeCheckedDims(containerId) {
  var checked = {};
  document.querySelectorAll("#" + containerId + ' input[data-dim]').forEach(function (cb) {
    checked[cb.getAttribute("data-dim")] = cb.checked;
  });
  return checked;
}

export function _scopeFilterConfig(src, checked) {
  var config = {};
  ["platforms", "bots", "sessions", "actions"].forEach(function (k) {
    if (checked[k]) config[k] = src[k] || {};
  });
  if (checked.identity) {
    var idn = src.identity || {};
    config.identity = {};
    ["adapters", "bots", "sessions", "users"].forEach(function (k) {
      config.identity[k] = idn[k] || {};
    });
  }
  return config;
}

export function doScopeExport() {
  if (!_scopeTransferData) {
    toast(t("action_failed"), "er");
    return;
  }
  var checked = _scopeCheckedDims("scopeExportDims");
  if (!Object.keys(checked).some(function (k) { return checked[k]; })) {
    toast(t("scope_dim_none_selected"), "er");
    return;
  }
  var payload = {
    type: "erispulse_scope_config",
    version: 1,
    exported_at: new Date().toISOString().slice(0, 19),
    config: _scopeFilterConfig(_scopeTransferData.config || {}, checked),
  };
  if (checked.default_allow && typeof _scopeTransferData.default_allow === "boolean") {
    payload.default_allow = _scopeTransferData.default_allow;
  }
  var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "erispulse-scope-" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
  toast(t("scope_exported"), "ok");
}

export function setScopeImportMode(mode) {
  _scopeImportMode = mode === "replace" ? "replace" : "merge";
  var wrap = document.getElementById("scopeTransferImport");
  if (wrap) {
    wrap.querySelectorAll(".scope-policy-btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-mode") === _scopeImportMode);
    });
  }
  var warn = document.getElementById("scopeReplaceWarn");
  if (warn) warn.style.display = _scopeImportMode === "replace" ? "" : "none";
}

export async function onScopeImportFilePicked(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  try {
    var parsed = JSON.parse(await file.text());
    var cfg = parsed.config || parsed;
    if (!cfg || typeof cfg !== "object") throw new Error("bad config");
    _scopeImportParsed = parsed;
    var zone = document.getElementById("scopeFileZone");
    if (zone) zone.classList.add("loaded");
    var summary = document.getElementById("scopeFileSummary");
    if (summary) summary.textContent = "📁 " + file.name;
    var counts = _scopeDimCounts(cfg);
    var el = document.getElementById("scopeImportDims");
    if (el) {
      el.innerHTML =
        _scopeDimRowHtml("platforms", counts.platforms > 0, counts.platforms) +
        _scopeDimRowHtml("bots", counts.bots > 0, counts.bots) +
        _scopeDimRowHtml("sessions", counts.sessions > 0, counts.sessions) +
        _scopeDimRowHtml("identity", counts.identity > 0, counts.identity) +
        _scopeDimRowHtml("actions", counts.actions > 0, counts.actions) +
        (typeof parsed.default_allow === "boolean"
          ? _scopeDimRowHtml("default_allow", false, parsed.default_allow ? "ON" : "OFF")
          : "");
    }
    var parsedBox = document.getElementById("scopeImportParsed");
    if (parsedBox) parsedBox.style.display = "";
    setScopeImportMode("merge");
  } catch (e) {
    _scopeImportParsed = null;
    toast(t("scope_file_invalid"), "er");
  }
}

export async function doScopeImport() {
  if (!_scopeImportParsed) {
    toast(t("scope_file_invalid"), "er");
    return;
  }
  var checked = _scopeCheckedDims("scopeImportDims");
  if (!Object.keys(checked).some(function (k) { return checked[k]; })) {
    toast(t("scope_dim_none_selected"), "er");
    return;
  }
  var cfg = _scopeImportParsed.config || _scopeImportParsed;
  var body = {
    config: _scopeFilterConfig(cfg, checked),
    mode: _scopeImportMode,
  };
  if (checked.default_allow && typeof _scopeImportParsed.default_allow === "boolean") {
    body.default_allow = _scopeImportParsed.default_allow;
  }
  var d = await api("/api/scope/import", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (d && d.success) {
    var c = d.imported || {};
    toast(
      t("scope_imported") +
        " (P:" + (c.platforms || 0) + " B:" + (c.bots || 0) +
        " S:" + (c.sessions || 0) + " I:" + (c.identity || 0) +
        " A:" + (c.actions || 0) + ")",
      "ok"
    );
    closeScopeTransfer();
    loadScope();
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

export function onScopeTestKindChange() {
  var kind = document.getElementById("scopeTestKind").value;
  var map = {
    module: ["scopeTestPlatformField", "scopeTestBotField", "scopeTestSessionField", "scopeTestModuleField"],
    identity: ["scopeTestPlatformField", "scopeTestBotField", "scopeTestSessionField", "scopeTestUserField"],
    action: ["scopeTestModuleField", "scopeTestActionField", "scopeTestNameField"],
  };
  ["scopeTestPlatformField", "scopeTestBotField", "scopeTestSessionField", "scopeTestUserField", "scopeTestModuleField", "scopeTestActionField", "scopeTestNameField"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.style.display = (map[kind] || []).indexOf(id) >= 0 ? "" : "none";
  });
}

export async function runScopeTest() {
  var kind = document.getElementById("scopeTestKind").value;
  var body = { kind: kind };
  if (kind === "module") {
    body.platform = document.getElementById("scopeTestPlatform").value;
    body.bot_id = document.getElementById("scopeTestBot").value;
    body.session_id = document.getElementById("scopeTestSession").value.trim();
    body.module = document.getElementById("scopeTestModule").value;
  } else if (kind === "identity") {
    body.platform = document.getElementById("scopeTestPlatform").value;
    body.bot_id = document.getElementById("scopeTestBot").value;
    body.session_id = document.getElementById("scopeTestSession").value.trim();
    body.user_id = document.getElementById("scopeTestUser").value.trim();
  } else {
    body.module = document.getElementById("scopeTestModule").value;
    body.action = document.getElementById("scopeTestAction").value;
    body.name = document.getElementById("scopeTestName").value.trim();
  }
  var resultEl = document.getElementById("scopeTestResult");
  if (resultEl) resultEl.innerHTML = '<span style="color:var(--tx-t)">…</span>';
  var d = await api("/api/scope/test", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!resultEl) return;
  if (d && typeof d.allowed !== "undefined") {
    resultEl.innerHTML = d.allowed
      ? '<span class="ok">✓ ' + esc(t("scope_test_allowed")) + "</span>"
      : '<span class="bad">✗ ' + esc(t("scope_test_denied")) + "</span>";
  } else {
    resultEl.innerHTML = '<span class="bad">' + esc(d?.error || t("action_failed")) + "</span>";
  }
}

export function openCmdEdit(name) {
  if (!_cmdData) return;
  const cmd = (_cmdData.commands || []).find((c) => c.name === name);
  if (!cmd) return;
  _editCmdName = name;
  _editAliases = [...(cmd.custom_aliases || [])];
  _editAllowed = [...(cmd.allowed_platforms || [])];
  _editBlocked = [...(cmd.blocked_platforms || [])];
  _editAclAllow = [...((cmd.acl && cmd.acl.allow) || [])];
  _editAclDeny = [...((cmd.acl && cmd.acl.deny) || [])];
  document.getElementById("cmdEditTitle").textContent = "/" + name;
  document.getElementById("cmdEnabled").checked = cmd.enabled !== false;
  document.getElementById("cmdTransformTo").value = cmd.transform_to || "";
  var params = cmd.params || {};
  document.getElementById("cmdOverrideMaster").checked = !!params.master;
  document.getElementById("cmdOverrideHidden").checked = !!params.hidden;
  var ownerBadge = document.getElementById("cmdOwnerBadge");
  if (ownerBadge) {
    if (cmd.owner) {
      ownerBadge.style.display = "";
      ownerBadge.textContent = "📦 " + (t("cmd_owner") + ": " + cmd.owner);
      ownerBadge.title = t("cmd_owner") + ": " + cmd.owner;
      ownerBadge.onclick = function () {
        closeCmdEdit();
        goToModuleConfig();
        setTimeout(function () {
          try {
            if (typeof selectModuleConfig === "function") selectModuleConfig(cmd.owner);
          } catch (e) {}
        }, 600);
      };
    } else {
      ownerBadge.style.display = "none";
    }
  }
  renderCmdAclPlatformOptions();
  renderCmdAclTags();
  let origHtml = "";
  if ((cmd.original_aliases || []).length) {
    origHtml =
      '<span style="color:var(--tx-t);font-size:12px">' +
      t("cmd_original_aliases_label") +
      ": " +
      cmd.original_aliases.map((a) => esc(a)).join(", ") +
      "</span>";
  }
  if (cmd.help)
    origHtml +=
      '<span style="margin-left:12px;color:var(--tx-s);font-size:12px">' +
      t("cmd_help") +
      ": " +
      esc(cmd.help) +
      "</span>";
  if (cmd.group)
    origHtml +=
      '<span style="margin-left:12px;color:var(--tx-s);font-size:12px">' +
      t("cmd_group") +
      ": " +
      esc(cmd.group) +
      "</span>";
  document.getElementById("cmdOriginalAliases").innerHTML = origHtml;
  renderCmdAliasTags();
  renderCmdPlatformToggles();
  var dl = document.getElementById("cmdTransformOptions");
  if (dl) {
    dl.innerHTML = (_cmdData.commands || [])
      .filter(function (c) {
        return c.name !== name;
      })
      .map(function (c) {
        return '<option value="' + esc(c.name) + '"></option>';
      })
      .join("");
  }
  document.getElementById("cmdAliasInput").value = "";
  document.getElementById("cmdAclAllowInput").value = "";
  document.getElementById("cmdAclDenyInput").value = "";
  document.getElementById("cmdEditOverlay").style.display = "flex";
}

export function renderCmdAclPlatformOptions() {
  var platforms = (_cmdData && _cmdData.platforms) || _cmdPlatforms || [];
  ["cmdAclAllowPlatform", "cmdAclDenyPlatform"].forEach(function (id) {
    var sel = document.getElementById(id);
    if (!sel) return;
    var prev = sel.value;
    sel.innerHTML =
      platforms
        .map(function (p) {
          return '<option value="' + esc(p) + '">' + esc(p) + "</option>";
        })
        .join("") + '<option value="">*</option>';
    if (prev && platforms.indexOf(prev) >= 0) sel.value = prev;
  });
}

export function renderCmdAclTags() {
  renderCmdAclTagList("cmdAclAllowTags", _editAclAllow, "allow");
  renderCmdAclTagList("cmdAclDenyTags", _editAclDeny, "deny");
}

export function renderCmdAclTagList(containerId, list, kind) {
  var container = document.getElementById(containerId);
  if (!container) return;
  if (!list.length) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = list
    .map(function (tag, i) {
      var cls =
        kind === "allow" ? "scope-entry-chip" : "scope-entry-chip deny";
      return (
        '<span class="' + cls + '" style="cursor:pointer" onclick="removeCmdAclTag(\'' +
        kind +
        "'," +
        i +
        ')" title="' +
        t("scope_delete") +
        '">' +
        esc(tag) +
        " &times;</span>"
      );
    })
    .join("");
}

export function addCmdAclTag(kind) {
  var platformId = kind === "allow" ? "cmdAclAllowPlatform" : "cmdAclDenyPlatform";
  var inputId = kind === "allow" ? "cmdAclAllowInput" : "cmdAclDenyInput";
  var platform = document.getElementById(platformId).value || "";
  var uid = document.getElementById(inputId).value.trim();
  if (!uid) return;
  var tag = uid === "*" ? "*" : (platform ? platform + ":" + uid : uid);
  var list = kind === "allow" ? _editAclAllow : _editAclDeny;
  if (list.indexOf(tag) === -1) list.push(tag);
  document.getElementById(inputId).value = "";
  renderCmdAclTags();
}

export function removeCmdAclTag(kind, index) {
  if (kind === "allow") _editAclAllow.splice(index, 1);
  else _editAclDeny.splice(index, 1);
  renderCmdAclTags();
}

export function renderCmdAliasTags() {
  const container = document.getElementById("cmdAliasTags");
  if (!_editAliases.length) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = _editAliases
    .map(
      (a, i) =>
        '<span class="cmd-tag">' +
        esc(a) +
        '<span class="cmd-tag-remove" onclick="removeCmdAlias(' +
        i +
        ')">&times;</span></span>',
    )
    .join("");
}

export function addCmdAlias() {
  const input = document.getElementById("cmdAliasInput");
  const val = input.value.trim();
  if (!val || _editAliases.includes(val)) {
    input.value = "";
    return;
  }
  _editAliases.push(val);
  input.value = "";
  renderCmdAliasTags();
}

export function removeCmdAlias(index) {
  _editAliases.splice(index, 1);
  renderCmdAliasTags();
}

export function renderCmdPlatformToggles() {
  const allowedContainer = document.getElementById("cmdAllowedPlatforms");
  const blockedContainer = document.getElementById("cmdBlockedPlatforms");
  if (!_cmdPlatforms.length) {
    allowedContainer.innerHTML =
      '<span style="font-size:12px;color:var(--tx-t)">' +
      t("no_adapters") +
      "</span>";
    blockedContainer.innerHTML =
      '<span style="font-size:12px;color:var(--tx-t)">' +
      t("no_adapters") +
      "</span>";
    return;
  }
  allowedContainer.innerHTML = _cmdPlatforms
    .map((p) => {
      const active = _editAllowed.includes(p);
      return (
        '<span class="cmd-platform-toggle' +
        (active ? " active" : "") +
        "\" onclick=\"toggleCmdPlatform('allowed','" +
        esc(p) +
        "')\">" +
        esc(p) +
        "</span>"
      );
    })
    .join("");
  blockedContainer.innerHTML = _cmdPlatforms
    .map((p) => {
      const active = _editBlocked.includes(p);
      return (
        '<span class="cmd-platform-toggle' +
        (active ? " blocked" : "") +
        "\" onclick=\"toggleCmdPlatform('blocked','" +
        esc(p) +
        "')\">" +
        esc(p) +
        "</span>"
      );
    })
    .join("");
}

export function toggleCmdPlatform(type, platform) {
  if (type === "allowed") {
    const idx = _editAllowed.indexOf(platform);
    if (idx >= 0) _editAllowed.splice(idx, 1);
    else _editAllowed.push(platform);
  } else {
    const idx = _editBlocked.indexOf(platform);
    if (idx >= 0) _editBlocked.splice(idx, 1);
    else _editBlocked.push(platform);
  }
  renderCmdPlatformToggles();
}

export function closeCmdEdit() {
  document.getElementById("cmdEditOverlay").style.display = "none";
}

export async function saveCmdEdit() {
  const body = {
    enabled: document.getElementById("cmdEnabled").checked,
    aliases: _editAliases,
    allowed_platforms: _editAllowed,
    blocked_platforms: _editBlocked,
    transform_to:
      document.getElementById("cmdTransformTo").value.trim() || null,
    acl: { allow: _editAclAllow, deny: _editAclDeny },
    params: {
      master: document.getElementById("cmdOverrideMaster").checked,
      hidden: document.getElementById("cmdOverrideHidden").checked,
    },
  };
  const d = await api("/api/commands/" + encodeURIComponent(_editCmdName), {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (d && d.success) {
    toast(t("cmd_save_success"), "ok");
    closeCmdEdit();
    loadCommands();
  } else {
    toast(d?.error || t("cmd_save_failed"), "er");
  }
}

