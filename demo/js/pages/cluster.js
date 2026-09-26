// ErisPulse Dashboard – pages/cluster (auto-split from dash.js)

export function isCapabilitySupported(capId) {
  if (currentNode === "local") {
    // 本机会话：受限令牌按能力集判定（管理员全量放行）
    var sc = window.sessionCaps;
    if (sc && !sc.admin) return (sc.caps || []).indexOf(capId) !== -1;
    return true;
  }
  var caps = nodeCapabilities[currentNode];
  if (!caps) return true;
  if (!caps[capId]) return true;
  return caps[capId].supported !== false;
}

export function switchNode(nodeId) {
  if (nodeId === currentNode) return;
  currentNode = nodeId;
  allEvents = [];
  updateNodeSelectorUI();
  updateSidebarForNode();
  _clearModuleViews();
  wsConnect();
  loadModuleViews();
  var activePage = document.querySelector(".page.active");
  if (activePage) {
    var pageId = activePage.id.replace("p-", "");
    go(pageId, document.querySelector('.nav-item[data-page="' + pageId + '"]'));
  }
}

export function updateSidebarForNode() {
  document.querySelectorAll(".nav-item[data-page]").forEach(function (el) {
    var page = el.getAttribute("data-page");
    var cap = _PAGE_CAPABILITY_MAP[page];
    if (!isCapabilitySupported(cap)) {
      el.classList.add("nav-disabled");
      el.title = t("unsupported_on_node");
    } else {
      el.classList.remove("nav-disabled");
      el.title = "";
    }
  });
  document
    .querySelectorAll(".nav-item[data-module-view]")
    .forEach(function (el) {
      if (!isCapabilitySupported("module_views")) {
        el.classList.add("nav-disabled");
      } else {
        el.classList.remove("nav-disabled");
      }
    });
}

export function toggleNodeDropdown() {
  var dd = document.getElementById("nodeDropdown");
  dd.classList.toggle("open");
}

export function closeNodeDropdown() {
  document.getElementById("nodeDropdown").classList.remove("open");
}

document.addEventListener("click", function (e) {
  var sel = document.getElementById("nodeSelector");
  if (sel && !sel.contains(e.target)) closeNodeDropdown();
});;

export function updateNodeSelectorUI() {
  var label = document.getElementById("nodeSelectorLabel");
  var dot = document.getElementById("nodeDot");
  if (currentNode === "local") {
    label.textContent = t("node_local");
    dot.className = "node-dot node-dot-local";
  } else {
    var info = nodeRuntimeInfo[currentNode] || {};
    label.textContent = info.name || currentNode;
    dot.className =
      "node-dot " + (info.online ? "node-dot-online" : "node-dot-offline");
  }
}

export async function loadClusterNodes() {
  var d = await api("/api/cluster/nodes");
  if (!d) return;
  if (d.nodes) {
    d.nodes.forEach(function (n) {
      nodeRuntimeInfo[n.id] = n;
      if (n.capabilities) {
        nodeCapabilities[n.id] = n.capabilities;
      }
    });
  }
  renderNodeDropdown(d.nodes || []);
  updateNodeSelectorVisibility();
}

export function renderNodeDropdown(nodes) {
  var list = document.getElementById("nodeDropdownList");
  if (!list) return;
  var html = "";
  html +=
    '<div class="node-dropdown-item' +
    (currentNode === "local" ? " active" : "") +
    '" onclick="switchNode(\'local\'); closeNodeDropdown();">';
  html += '<span class="node-dot node-dot-local"></span>';
  html += "<span>" + esc(t("node_local")) + "</span>";
  html += "</div>";
  nodes.forEach(function (n) {
    var info = nodeRuntimeInfo[n.id] || {};
    var dotClass = info.online ? "node-dot-online" : "node-dot-offline";
    html +=
      '<div class="node-dropdown-item' +
      (currentNode === n.id ? " active" : "") +
      '" onclick="switchNode(\'' +
      esc(n.id) +
      "'); closeNodeDropdown();\">";
    html += '<span class="node-dot ' + dotClass + '"></span>';
    html +=
      '<span class="node-dropdown-label">' + esc(n.name || n.id) + "</span>";
    if (info.latency_ms >= 0) {
      html += '<span class="node-latency">' + info.latency_ms + "ms</span>";
    }
    html += "</div>";
  });
  list.innerHTML = html;
}

export function _clusterNodeCardHtml(n) {
  var info = nodeRuntimeInfo[n.id] || {};
  var online = info.online;
  var dotClass = online ? "node-dot-online" : "node-dot-offline";
  var caps = info.capabilities || {};
  var capKeys = _capKeys;
  var supportedCaps = [];
  var unsupportedCaps = [];
  capKeys.forEach(function (k) {
    var c = caps[k];
    if (c && c.supported) supportedCaps.push(k);
    else if (c && c.supported === false) unsupportedCaps.push(k);
  });

  var capsHtml = "";
  if (supportedCaps.length > 0 || unsupportedCaps.length > 0) {
    capsHtml += '<div class="cluster-card-caps">';
    supportedCaps.forEach(function (k) {
      capsHtml +=
        '<span class="cluster-cap-tag cap-supported" title="' +
        esc(t("cap_" + k + "_desc")) +
        '">' +
        esc(t("cap_" + k)) +
        "</span>";
    });
    unsupportedCaps.forEach(function (k) {
      capsHtml +=
        '<span class="cluster-cap-tag cap-unsupported" title="' +
        esc(t("cap_" + k + "_desc")) +
        '">' +
        esc(t("cap_" + k)) +
        "</span>";
    });
    capsHtml += "</div>";
  }

  var meta = "";
  if (info.latency_ms >= 0)
    meta += "<span>" + esc(t("latency")) + ": " + info.latency_ms + "ms</span>";
  if (info.dashboard_version)
    meta += "<span>v" + esc(info.dashboard_version) + "</span>";

  var cardId = "clusterCard-" + esc(n.id);
  var h = '<div class="cluster-node-card" id="' + cardId + '">';
  h += '<div class="cluster-card-header">';
  h +=
    '<div class="cluster-card-title"><span class="node-dot ' +
    dotClass +
    '"></span><span class="cluster-card-name">' +
    esc(n.name || n.id) +
    "</span>";
  h += online
    ? '<span class="cluster-badge badge-online">' +
      esc(t("node_online")) +
      "</span>"
    : '<span class="cluster-badge badge-offline">' +
      esc(t("node_offline")) +
      "</span>";
  h += "</div>";
  h += '<div class="cluster-node-actions">';
  h +=
    '<button class="btn-icon-sm" onclick="openClusterEditModal(\'' +
    esc(n.id) +
    '\')" title="' +
    esc(t("node_edit")) +
    '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';
  h +=
    '<button class="btn-icon-sm" onclick="pingClusterNode(\'' +
    esc(n.id) +
    '\')" title="' +
    esc(t("node_ping")) +
    '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></button>';
  h +=
    '<button class="btn-icon-sm" onclick="probeClusterNode(\'' +
    esc(n.id) +
    '\')" title="' +
    esc(t("node_probe")) +
    '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg></button>';
  h +=
    '<button class="btn-icon-sm btn-icon-danger" onclick="removeClusterNode(\'' +
    esc(n.id) +
    '\')" title="' +
    esc(t("node_delete")) +
    '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>';
  h += "</div></div>";
  var maskedUrl = _maskUrl(n.url);
  h += '<div class="cluster-node-url-wrap">';
  h +=
    '<span class="cluster-node-url" id="' +
    cardId +
    '-url" data-full-url="' +
    esc(n.url) +
    '" data-masked-url="' +
    esc(maskedUrl) +
    '">' +
    esc(maskedUrl) +
    "</span>";
  h +=
    '<button class="btn-icon-sm cluster-url-eye" id="' +
    cardId +
    '-eye" onclick="_toggleUrlVisibility(\'' +
    cardId +
    '\')" title="' +
    esc(t("toggle_url_visibility") || "Show/Hide") +
    '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg></button>';
  h += "</div>";
  if (meta) h += '<div class="cluster-node-meta">' + meta + "</div>";

  h +=
    '<button class="cluster-card-toggle" onclick="toggleClusterCardDetail(\'' +
    cardId +
    "')\">";
  h +=
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="toggle-arrow"><polyline points="6 9 12 15 18 9"/></svg>';
  h += "<span>" + esc(t("cluster_card_detail") || "Details") + "</span>";
  if (supportedCaps.length > 0)
    h +=
      '<span class="cluster-cap-count">' +
      supportedCaps.length +
      "/" +
      capKeys.length +
      "</span>";
  h += "</button>";
  h += '<div class="cluster-card-detail" id="' + cardId + '-detail">';
  h +=
    '<div class="cluster-card-stats-loading"><div class="cluster-spinner"></div></div>';
  h += "</div>";

  h += "</div>";
  return h;
}

export function _maskUrl(url) {
  if (!url) return "";
  try {
    var u = new URL(url);
    var host = u.host;
    if (host.length <= 6)
      return u.protocol + "//" + "*".repeat(host.length) + u.pathname;
    var visible = host.substring(0, 3);
    var masked = "*".repeat(Math.min(host.length - 6, 12));
    var end = host.substring(host.length - 3);
    return u.protocol + "//" + visible + masked + end + u.pathname;
  } catch (e) {
    return url.substring(0, 4) + "***";
  }
}

export function _toggleUrlVisibility(cardId) {
  var el = document.getElementById(cardId + "-url");
  var btn = document.getElementById(cardId + "-eye");
  if (!el || !btn) return;
  var full = el.getAttribute("data-full-url");
  var masked = el.getAttribute("data-masked-url");
  if (el.textContent === masked) {
    el.textContent = full;
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  } else {
    el.textContent = masked;
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  }
}

export function toggleClusterCardDetail(cardId) {
  var card = document.getElementById(cardId);
  if (!card) return;
  var wasExpanded = card.classList.contains("card-expanded");
  card.classList.toggle("card-expanded");
  if (!wasExpanded) {
    var nodeId = cardId.replace("clusterCard-", "");
    var od =
      _lastOverview && _lastOverview.nodes && _lastOverview.nodes[nodeId];
    if (od) _fillClusterCardDetail(nodeId, od);
  }
}

export function _buildStatsHtml(overviewData) {
  if (!overviewData || overviewData._error) return "";
  var mem = overviewData.memory || {};
  var status = overviewData.status || {};
  var system = overviewData.system || {};
  var proc = system.process || {};
  var stats = [];
  if (mem.cpu_percent !== undefined)
    stats.push({
      l: "CPU",
      v:
        (typeof mem.cpu_percent === "number"
          ? mem.cpu_percent.toFixed(1)
          : "-") + "%",
      c: _colorForUsage(mem.cpu_percent, 50, 80),
    });
  if (mem.system_percent !== undefined)
    stats.push({
      l: "RAM",
      v: mem.system_percent.toFixed(1) + "%",
      c: _colorForUsage(mem.system_percent, 60, 85),
    });
  if (mem.rss_mb !== undefined)
    stats.push({ l: t("process_memory"), v: mem.rss_mb + "MB" });
  var aCount;
  if (status.adapters_count !== undefined) aCount = status.adapters_count;
  else if (
    status.adapters &&
    typeof status.adapters === "object" &&
    !status.adapters.error
  )
    aCount = Object.keys(status.adapters).length;
  if (aCount !== undefined)
    stats.push({ l: t("adapters") || "Adapters", v: aCount });
  var mCount;
  if (status.modules_count !== undefined) mCount = status.modules_count;
  else if (
    status.modules &&
    typeof status.modules === "object" &&
    !status.modules.error
  )
    mCount = Object.values(status.modules).filter(function (v) {
      return v;
    }).length;
  if (mCount !== undefined)
    stats.push({ l: t("registered") || "Modules", v: mCount });
  var eCount;
  if (status.events_count !== undefined) eCount = status.events_count;
  else if (system.total_events !== undefined) eCount = system.total_events;
  if (eCount !== undefined)
    stats.push({ l: t("events") || "Events", v: eCount });
  if (system.uptime_human)
    stats.push({
      l: t("lifecycle") || "Uptime",
      v: system.uptime_human,
      c: "var(--tx-s)",
    });
  if (proc.threads !== undefined)
    stats.push({ l: t("threads"), v: proc.threads });
  if (proc.connections !== undefined)
    stats.push({ l: t("connections"), v: proc.connections });
  if (stats.length === 0) return "";
  var h = '<div class="cluster-card-stats">';
  stats.forEach(function (s) {
    h +=
      '<div class="cluster-card-stat"><span class="cluster-stat-val"' +
      (s.c ? ' style="color:' + s.c + '"' : "") +
      ">" +
      esc(s.v) +
      '</span><span class="cluster-stat-label">' +
      esc(s.l) +
      "</span></div>";
  });
  h += "</div>";
  return h;
}

export function _fillClusterCardDetail(nodeId, overviewData) {
  var el = document.getElementById("clusterCard-" + nodeId + "-detail");
  if (!el) return;
  var info = nodeRuntimeInfo[nodeId] || {};
  var caps = info.capabilities || {};
  var capKeys = _capKeys;
  var statsHtml = _buildStatsHtml(overviewData);
  var capsHtml = "";
  var supportedCaps = 0;
  capKeys.forEach(function (k) {
    var c = caps[k];
    if (c && c.supported) {
      supportedCaps++;
      capsHtml +=
        '<span class="cluster-cap-tag cap-supported" title="' +
        esc(t("cap_" + k + "_desc")) +
        '">' +
        esc(t("cap_" + k)) +
        "</span>";
    } else if (c && c.supported === false) {
      capsHtml +=
        '<span class="cluster-cap-tag cap-unsupported" title="' +
        esc(t("cap_" + k + "_desc")) +
        '">' +
        esc(t("cap_" + k)) +
        "</span>";
    }
  });
  var h = "";
  if (capsHtml) h += '<div class="cluster-card-caps">' + capsHtml + "</div>";
  h = statsHtml + h;
  el.innerHTML =
    h || '<div style="font-size:12px;color:var(--tx-t);padding:4px 0">-</div>';
  var countEl = el.parentElement.querySelector(".cluster-cap-count");
  if (countEl && capKeys.length > 0)
    countEl.textContent = supportedCaps + "/" + capKeys.length;
}

export async function loadClusterPage() {
  var container = document.getElementById("clusterContent");
  if (!container) return;

  await loadClusterNodes();
  var d = await api("/api/cluster/nodes");
  var nodes = d && d.nodes ? d.nodes : [];

  var html = "";
  html += '<div class="cluster-toolbar">';
  html +=
    '<div class="cluster-toolbar-info">' +
    nodes.length +
    " " +
    esc(
      t("cluster_node_count") ||
        (t("node_local") === "本地实例" ? "个节点" : "node(s)"),
    ) +
    "</div>";
  html +=
    '<button class="btn btn-primary btn-sm" onclick="openClusterAddModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:4px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
    esc(t("node_add")) +
    "</button>";
  html += "</div>";

  if (nodes.length === 0) {
    html +=
      '<div class="cluster-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg><div>' +
      esc(t("no_data") || "No nodes added yet") +
      "</div></div>";
  } else {
    html += '<div class="cluster-node-list">';
    nodes.forEach(function (n) {
      html += _clusterNodeCardHtml(n);
    });
    html += "</div>";
  }

  container.innerHTML = html;

  if (nodes.length > 0) {
    api("/api/cluster/overview").then(function (od) {
      if (!od || !od.nodes) return;
      _lastOverview = od;
      nodes.forEach(function (n) {
        if (od.nodes[n.id]) _fillClusterCardDetail(n.id, od.nodes[n.id]);
      });
    });
  }
}

export function openClusterAddModal() {
  if (!authed) return showLogin();
  ["addNodeName", "addNodeUrl", "addNodeToken"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = "";
  });
  applyI18n();
  document.getElementById("clusterAddOv").classList.add("show");
  var urlInput = document.getElementById("addNodeUrl");
  if (urlInput)
    setTimeout(function () {
      urlInput.focus();
    }, 100);
}

export function closeClusterAddModal() {
  document.getElementById("clusterAddOv").classList.remove("show");
}

export function openClusterEditModal(nodeId) {
  if (!authed) return showLogin();
  var d = nodeRuntimeInfo[nodeId] || {};
  document.getElementById("editNodeId").value = nodeId;
  document.getElementById("editNodeName").value = d.name || "";
  document.getElementById("editNodeUrl").value = d.url || "";
  document.getElementById("editNodeToken").value = "";
  document.getElementById("editNodeToken").placeholder =
    t("node_token_placeholder") + " (" + t("leave_empty_to_keep") + ")";
  applyI18n();
  document.getElementById("clusterEditOv").classList.add("show");
}

export function closeClusterEditModal() {
  document.getElementById("clusterEditOv").classList.remove("show");
}

export async function submitClusterNode() {
  var name = document.getElementById("addNodeName").value.trim();
  var url = document.getElementById("addNodeUrl").value.trim();
  var token = document.getElementById("addNodeToken").value.trim();
  if (!url || !token) {
    toast(t("node_add_failed") + ": URL, Token required", "er");
    return;
  }
  var d = await api("/api/cluster/nodes", {
    method: "POST",
    body: JSON.stringify({ name: name, url: url, token: token }),
  });
  if (d && d.success) {
    if (d.node) nodeRuntimeInfo[d.node.id] = d.node;
    closeClusterAddModal();
    toast(t("node_add_success"), "ok");
    loadClusterPage();
    loadClusterNodes();
  } else {
    toast(t("node_add_failed") + (d && d.error ? ": " + d.error : ""), "er");
  }
}

export async function submitEditNode() {
  var nodeId = document.getElementById("editNodeId").value.trim();
  var name = document.getElementById("editNodeName").value.trim();
  var url = document.getElementById("editNodeUrl").value.trim();
  var token = document.getElementById("editNodeToken").value.trim();
  if (!nodeId) return;
  var body = { name: name, url: url };
  if (token) body.token = token;
  var d = await api("/api/cluster/nodes/" + encodeURIComponent(nodeId), {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (d && d.success) {
    if (d.node) nodeRuntimeInfo[d.node.id] = d.node;
    if (currentNode === nodeId) wsConnect();
    closeClusterEditModal();
    toast(t("node_edit") + " OK", "ok");
    loadClusterPage();
  } else {
    toast(
      t("node_edit") +
        " " +
        (t("failed") || "failed") +
        (d && d.error ? ": " + d.error : ""),
      "er",
    );
  }
}

export async function removeClusterNode(nodeId) {
  if (!confirm(t("node_remove_confirm"))) return;
  var d = await api("/api/cluster/nodes/" + encodeURIComponent(nodeId), {
    method: "DELETE",
  });
  if (d && d.success) {
    toast(t("node_delete") + " OK", "ok");
    if (currentNode === nodeId) switchNode("local");
    loadClusterPage();
  } else {
    toast(t("node_not_found"), "er");
  }
}

export async function pingClusterNode(nodeId) {
  var btn = document.querySelector(
    "#clusterCard-" +
      nodeId +
      " .cluster-node-actions .btn-icon-sm:nth-child(2)",
  );
  if (btn) btn.classList.add("spin");
  var d = await api(
    "/api/cluster/nodes/" + encodeURIComponent(nodeId) + "/ping",
    { method: "POST" },
  );
  if (btn) btn.classList.remove("spin");
  if (d && d.online) {
    toast(t("node_ping_success") + " (" + d.latency_ms + "ms)", "ok");
  } else {
    toast(t("node_ping_failed"), "er");
  }
  await loadClusterNodes();
  loadClusterPage();
}

export async function probeClusterNode(nodeId) {
  toast(t("node_probing"), "wr");
  var d = await api(
    "/api/cluster/nodes/" + encodeURIComponent(nodeId) + "/probe",
    { method: "POST" },
  );
  if (d && d.capabilities) {
    nodeCapabilities[nodeId] = d.capabilities;
    toast(t("node_probe_complete"), "ok");
    loadClusterPage();
  } else {
    toast(t("node_probe_complete"), "er");
  }
}

export function _colorForUsage(val, warn, danger) {
  if (val > (danger || 85)) return "var(--er-c)";
  if (val > (warn || 60)) return "var(--wr-c)";
  return "var(--ok-c)";
}

// ── 按会话能力隐藏侧边栏未授权页面 ──
export function updateSidebarForCaps() {
  var sc = window.sessionCaps;
  if (!sc || sc.admin) return; // 管理员/默认态：全部可见
  document
    .querySelectorAll(".sidebar .nav-item[data-page]")
    .forEach(function (a) {
      var page = a.getAttribute("data-page");
      var visible;
      if (page && page.indexOf("ext-") === 0) {
        // 模块视图：view:<id> 能力
        visible = (sc.caps || []).indexOf("view:" + page.slice(4)) !== -1;
      } else {
        var cap = window._PAGE_CAPABILITY_MAP
          ? window._PAGE_CAPABILITY_MAP[page]
          : null;
        visible = !cap || (sc.caps || []).indexOf(cap) !== -1;
      }
      a.style.display = visible ? "" : "none";
    });
  // 无可见项的分组整组隐藏
  document.querySelectorAll(".sidebar .nav-group").forEach(function (g) {
    var items = g.querySelectorAll(".nav-item[data-page]");
    if (!items.length) return;
    var anyVisible = Array.prototype.some.call(items, function (n) {
      return n.style.display !== "none";
    });
    g.style.display = anyVisible ? "" : "none";
  });
}
