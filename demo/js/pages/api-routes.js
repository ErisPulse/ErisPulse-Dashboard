// ErisPulse Dashboard – pages/api-routes (auto-split from dash.js)

import {
  refreshDashboard as _dashboardRefresh,
  loadPerformance,
} from "./dashboard.js";

export async function loadApiRoutes() {
  const d = await api("/api/routes");
  if (!d) return;

  var groups = {};

  // 主路径：kind 分组数据（list_namespaces + get_module_routes/urls 派生）
  if (d.namespaces && typeof d.namespaces === "object") {
    Object.keys(d.namespaces).forEach(function (ns) {
      var kinds = d.namespaces[ns] || {};
      groups[ns] = {
        http: (kinds.http || []).map(function (row) {
          return {
            paths: [row.path || ""],
            methods: (row.methods || []).slice(),
            url: row.url || "",
          };
        }),
        websocket: (kinds.websocket || []).map(function (row) {
          return { path: row.path || "", url: row.url || "", auth: !!row.auth };
        }),
        sse: (kinds.sse || []).map(function (row) {
          return { path: row.path || "", url: row.url || "" };
        }),
      };
    });
  } else {
    // 回退：旧版扁平字段（集群旧节点 / demo mock 等旧数据源）
    const httpRoutes = d.http_routes || [];
    const wsRoutes = d.ws_routes || [];
    httpRoutes.forEach(function (r) {
      var m = r.module || "System";
      if (!groups[m]) groups[m] = { http: [], websocket: [], sse: [] };
      groups[m].http.push({
        paths: [r.full_path || r.path || ""],
        methods: [r.method || "GET"],
        url: "",
      });
    });
    wsRoutes.forEach(function (r) {
      var m = r.module || "System";
      if (!groups[m]) groups[m] = { http: [], websocket: [], sse: [] };
      groups[m].websocket.push({
        path: r.full_path || r.path || "",
        url: "",
        auth: !!r.has_auth,
      });
    });
  }

  // 头部计数（HTTP 按方法行计数，与表格行数一致）
  var httpCount = 0,
    wsCount = 0,
    sseCount = 0;
  Object.keys(groups).forEach(function (ns) {
    groups[ns].http.forEach(function (r) {
      httpCount += Math.max(r.methods.length, 1);
    });
    wsCount += groups[ns].websocket.length;
    sseCount += groups[ns].sse.length;
  });
  document.getElementById("httpRouteCount").textContent = httpCount;
  document.getElementById("wsRouteCount").textContent = wsCount;
  var sseEl = document.getElementById("sseRouteCount");
  if (sseEl) sseEl.textContent = sseCount;

  var moduleNames = Object.keys(groups).filter(function (ns) {
    var g = groups[ns];
    return g.http.length + g.websocket.length + g.sse.length > 0;
  });
  moduleNames.sort(function (a, b) {
    if (a === "System") return 1;
    if (b === "System") return -1;
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });

  var methodColor = {
    GET: "method-get",
    POST: "method-post",
    PUT: "method-put",
    DELETE: "method-delete",
    PATCH: "method-patch",
    OPTIONS: "method-options",
    HEAD: "method-head",
  };

  var html = "";

  moduleNames.forEach(function (mod) {
    var g = groups[mod];
    var totalRoutes = g.http.length + g.websocket.length + g.sse.length;

    html += '<div class="card route-group-card collapsed">';
    html += '<div class="card-header" onclick="toggleRouteGroup(this)">';
    html +=
      '<svg class="route-group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
    html += '<span class="route-group-name">' + esc(mod) + "</span>";
    html +=
      '<span class="chip chip-sc" style="margin:0">' +
      totalRoutes +
      " routes</span>";
    if (g.http.length > 0)
      html +=
        '<span class="chip chip-pr" style="margin:0">' +
        g.http.length +
        " HTTP</span>";
    if (g.websocket.length > 0)
      html +=
        '<span class="chip chip-sc" style="margin:0">' +
        g.websocket.length +
        " WS</span>";
    if (g.sse.length > 0)
      html +=
        '<span class="chip chip-ok" style="margin:0">' +
        g.sse.length +
        " SSE</span>";
    html += "</div>";

    // 表格化：sticky 表头 + 行 hover + 方法徽标胶囊
    html += '<div class="route-group-body" style="display:none">';
    html +=
      '<table class="route-table"><thead><tr>' +
      '<th class="th-method">Method</th><th>Path</th><th class="th-action"></th>' +
      "</tr></thead><tbody>";

    g.http.forEach(function (r) {
      r.methods.forEach(function (method, mi) {
        var mc = methodColor[method] || "method-get";
        var path = r.paths[0] || "";
        html += '<tr class="route-row">';
        html +=
          '<td class="td-method"><span class="method-badge ' +
          mc +
          '">' +
          esc(method) +
          "</span></td>";
        html +=
          '<td class="td-path"><code class="route-path">' +
          esc(path) +
          "</code>" +
          (mi === 0 && r.url
            ? '<span class="route-url" title="' + esc(r.url) + '">' + esc(r.url) + "</span>"
            : "") +
          "</td>";
        html +=
          '<td class="td-action"><button class="btn btn-secondary btn-xs" onclick="openRouteTest(\'' +
          esc(method) +
          "','" +
          esc(path) +
          "')\">" +
          t("test") +
          "</button></td>";
        html += "</tr>";
      });
    });

    g.websocket.forEach(function (r) {
      var authBadge = r.auth
        ? '<span class="chip chip-wr">' + t("requires_auth") + "</span>"
        : "";
      html += '<tr class="route-row">';
      html +=
        '<td class="td-method"><span class="method-badge method-ws">WS</span></td>';
      html +=
        '<td class="td-path"><code class="route-path">' +
        esc(r.path) +
        "</code>" +
        authBadge +
        "</td>";
      html += '<td class="td-action"></td>';
      html += "</tr>";
    });

    g.sse.forEach(function (r) {
      html += '<tr class="route-row">';
      html +=
        '<td class="td-method"><span class="method-badge method-sse">SSE</span></td>';
      html +=
        '<td class="td-path"><code class="route-path">' + esc(r.path) + "</code></td>";
      html += '<td class="td-action"></td>';
      html += "</tr>";
    });

    html += "</tbody></table></div></div>";
  });

  var container = document.getElementById("routeModulesContainer");
  container.innerHTML =
    html ||
    '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg><p>' +
      t("no_data") +
      "</p></div>";
}

export function toggleRouteGroup(hd) {
  var card = hd.parentElement;
  var body = card.querySelector(".route-group-body");
  var chevron = card.querySelector(".route-group-chevron");
  var hint = card.querySelector(".route-expand-hint");
  var collapsed = card.classList.contains("collapsed");

  if (collapsed) {
    body.style.display = "block";
    chevron.style.transform = "rotate(180deg)";
    card.classList.remove("collapsed");
    if (hint) hint.style.display = "none";
  } else {
    body.style.display = "none";
    chevron.style.transform = "rotate(0deg)";
    card.classList.add("collapsed");
    if (hint) hint.style.display = "";
  }
}

export function expandAllRouteGroups() {
  var cards = document.querySelectorAll(".route-group-card");
  cards.forEach(function (card) {
    card.classList.remove("collapsed");
    card.querySelector(".route-group-body").style.display = "block";
    card.querySelector(".route-group-chevron").style.transform =
      "rotate(180deg)";
    var hint = card.querySelector(".route-expand-hint");
    if (hint) hint.style.display = "none";
  });
}

export function collapseAllRouteGroups() {
  var cards = document.querySelectorAll(".route-group-card");
  cards.forEach(function (card) {
    card.classList.add("collapsed");
    card.querySelector(".route-group-body").style.display = "none";
    card.querySelector(".route-group-chevron").style.transform = "rotate(0deg)";
    var hint = card.querySelector(".route-expand-hint");
    if (hint) hint.style.display = "";
  });
}

export async function loadMessageStats() {
  const d = await api("/api/message-stats");
  if (!d) return;

  // 消息类型分布
  const typeStats = d.by_type || {};
  var ti = 0;
  const typeHtml = Object.entries(typeStats)
    .map(([type, count]) => {
      const total = d.total_events || 1;
      const percent = ((count / total) * 100).toFixed(1);
      return (
        '<div class="stat-bar-chart">' +
        '<span class="stat-bar-label">' +
        esc(type) +
        "</span>" +
        '<div class="stat-bar-track"><div class="stat-bar-fill" style="width:' +
        percent +
        '%"></div></div>' +
        '<span class="stat-bar-value">' +
        count +
        "</span></div>"
      );
    })
    .join("");
  document.getElementById("msgTypeStats").innerHTML =
    typeHtml ||
    '<div style="color:var(--tx-s);font-size:13px">' + t("no_data") + "</div>";

  // 平台分布
  const platformStats = d.by_platform || {};
  const platformHtml = Object.entries(platformStats)
    .map(([platform, count]) => {
      const total = d.total_events || 1;
      const percent = ((count / total) * 100).toFixed(1);
      return (
        '<div class="stat-bar-chart">' +
        '<span class="stat-bar-label">' +
        esc(platform) +
        "</span>" +
        '<div class="stat-bar-track"><div class="stat-bar-fill" style="width:' +
        percent +
        '%"></div></div>' +
        '<span class="stat-bar-value">' +
        count +
        "</span></div>"
      );
    })
    .join("");
  document.getElementById("msgPlatformStats").innerHTML =
    platformHtml ||
    '<div style="color:var(--tx-s);font-size:13px">' + t("no_data") + "</div>";

  // 每小时趋势（最近24小时）
  const hourlyStats = d.hourly || {};
  const now = Date.now() / 1000;
  const bars = [];
  var maxCount = Math.max(...Object.values(hourlyStats), 1);

  for (let i = 23; i >= 0; i--) {
    const hourKey = Math.floor((now - i * 3600) / 3600) * 3600;
    const count = hourlyStats[hourKey] || 0;
    const height = maxCount > 0 ? Math.max((count / maxCount) * 100, 1) : 1;
    bars.push(
      '<div class="hourly-bar-wrap"><div class="hourly-bar" style="height:' +
        height +
        '%"></div></div>',
    );
  }

  // 只显示首尾和中间时间
  const firstHour = new Date((now - 23 * 3600) * 1000).getHours();
  const midHour = new Date((now - 12 * 3600) * 1000).getHours();
  const lastHour = new Date(now * 1000).getHours();

  document.getElementById("msgHourlyTrend").innerHTML =
    '<div class="hourly-chart">' +
    bars.join("") +
    "</div>" +
    '<div class="hourly-labels"><span class="hourly-label">' +
    firstHour +
    ':00</span><span class="hourly-label">' +
    midHour +
    ':00</span><span class="hourly-label">' +
    lastHour +
    ":00</span></div>";
}

// ════════════════ 首页系统状态区（/api/health 健康行） ════════════════

var _lastStorageOk = null;

// 健康项 = 与指标格同语言的小格（label 上 / 状态值下），语义色仅用于状态字与异常点缀，
// 不再用胶囊/大色点——与 perf-extra 视觉统一
function _healthCell(name, ok, sub, err) {
  var okText = esc(t("health_ok"));
  var badText = esc(t("health_abnormal"));
  var stateVal = ok ? okText : badText;
  var titleAttr = err ? ' title="' + esc(err) + '"' : "";
  var subHtml = sub
    ? '<div class="perf-extra-label"' + titleAttr + ">" + esc(sub) + "</div>"
    : "";
  return (
    '<div class="perf-extra-cell health-cell' +
    (ok ? "" : " is-abnormal") +
    '">' +
    '<div class="perf-extra-label">' +
    esc(name) +
    "</div>" +
    '<div class="perf-extra-val health-state' +
    (ok ? " is-ok" : " is-warn") +
    '"' +
    titleAttr +
    ">" +
    stateVal +
    "</div>" +
    subHtml +
    "</div>"
  );
}

export async function loadHealthStatus() {
  const el = document.getElementById("dashHealthRows");
  if (!el) return;
  const d = await api("/api/health");
  if (!d || typeof d.storage === "undefined") {
    el.innerHTML =
      '<div class="empty-state"><p>' + esc(t("health_unknown")) + "</p></div>";
    _lastStorageOk = null;
    return;
  }

  // 断连检测：存储状态翻转时 toast（事件流同时经 WS 广播，桌面通知链路自动生效）
  if (_lastStorageOk === true && !d.storage) {
    toast(t("health_storage_lost"), "er");
  } else if (_lastStorageOk === false && d.storage) {
    toast(t("health_storage_recovered"), "ok");
  }
  _lastStorageOk = !!d.storage;

  const detail = d.detail || {};
  const storageDetail = detail.storage || {};
  const adapterDetail = detail.adapters || {};
  const moduleDetail = detail.modules || {};

  var storageSub = storageDetail.backend || "";
  if (!d.storage && storageDetail.error) {
    storageSub = (storageSub ? storageSub + " · " : "") + storageDetail.error;
  }
  var adapterSub = adapterDetail.total
    ? adapterDetail.started + " / " + adapterDetail.total
    : "";
  var moduleSub = moduleDetail.loaded !== undefined
    ? String(moduleDetail.loaded)
    : "";

  el.innerHTML =
    _healthCell(t("health_storage"), d.storage, storageSub, storageDetail.error || "") +
    _healthCell(t("health_adapters"), d.adapters, adapterSub, "") +
    _healthCell(t("health_modules"), d.modules, moduleSub, "") +
    _healthCell(t("health_router"), d.router, "", "");
}

// ── refreshDashboard 包装链（首页性能环 / 消息统计 / 系统状态健康行）──
// 时序契约：main.js 在全部页面模块求值完成后，按 __namespaces 顺序
// Object.assign(window, ns) 挂载各页面导出，且 m_pages_dashboard 先于
// m_pages_api_routes。旧实现（本模块体求值期 window.refreshDashboard = 包装）
// 有两个致命点：求值期 window.refreshDashboard 尚未挂载（_original 拿到
// undefined），且随后 dashboard 命名空间的赋值会把包装整个覆盖——
// loadHealthStatus 永远不被调用，首页健康卡停在骨架态。
// 改为具名导出组合函数：本命名空间在 dashboard 之后安装，组合版必然
// 最后落位，window.refreshDashboard 即含健康行的完整刷新链。
export async function refreshDashboard() {
  await _dashboardRefresh();
  await loadPerformance();
  await loadMessageStats();
  await loadHealthStatus();
}

export function openRouteTest(method, fullPath) {
  _rtMethod = method;
  _rtFullPath = fullPath;
  const methodColor =
    {
      GET: "method-get",
      POST: "method-post",
      PUT: "method-put",
      DELETE: "method-delete",
      PATCH: "method-patch",
    }[method] || "method-get";
  const mb = document.getElementById("rtMethod");
  mb.textContent = method;
  mb.className = "method-badge " + methodColor;
  document.getElementById("rtPath").textContent = fullPath;
  document.getElementById("rtBodySection").style.display = [
    "POST",
    "PUT",
    "PATCH",
  ].includes(method)
    ? "block"
    : "none";
  document.getElementById("rtParams").innerHTML = "";
  document.getElementById("rtBody").value = "";
  document.getElementById("rtResponse").textContent = "";
  document.getElementById("rtResponseStatus").style.display = "none";
  document.getElementById("routeTestOverlay").style.display = "flex";
}

export function closeRouteTest() {
  document.getElementById("routeTestOverlay").style.display = "none";
}

export function addRouteParam(k, v) {
  const c = document.getElementById("rtParams");
  const d = document.createElement("div");
  d.style.cssText = "display:flex;gap:6px;margin-bottom:4px";
  d.innerHTML =
    '<input class="rt-pk" style="flex:1;padding:4px 8px;border:1px solid var(--bd);border-radius:4px;font-size:12px;background:var(--bg-s);color:var(--tx-p)" placeholder="Key" value="' +
    esc(k || "") +
    '">' +
    '<input class="rt-pv" style="flex:2;padding:4px 8px;border:1px solid var(--bd);border-radius:4px;font-size:12px;background:var(--bg-s);color:var(--tx-p)" placeholder="Value" value="' +
    esc(v || "") +
    '">' +
    '<button class="btn-icon" onclick="this.parentElement.remove()" style="flex-shrink:0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
  c.appendChild(d);
}

export async function sendRouteTest() {
  const params = [];
  document.querySelectorAll("#rtParams > div").forEach((row) => {
    const k = row.querySelector(".rt-pk").value.trim();
    const v = row.querySelector(".rt-pv").value.trim();
    if (k) params.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
  });
  const qs = params.length ? "?" + params.join("&") : "";
  const url = _rtFullPath + qs;
  const tk = localStorage.getItem(TK);
  const headers = { Authorization: "Bearer " + tk };
  const bodyArea = document.getElementById("rtBody");
  const hasBody =
    ["POST", "PUT", "PATCH"].includes(_rtMethod) && bodyArea.value.trim();
  if (hasBody) headers["Content-Type"] = "application/json";
  document.getElementById("rtResponse").textContent = t("loading");
  document.getElementById("rtResponseStatus").style.display = "none";
  try {
    const opts = { method: _rtMethod, headers };
    if (hasBody) opts.body = bodyArea.value.trim();
    const resp = await fetch(url, opts);
    const statusEl = document.getElementById("rtResponseStatus");
    const isOk = resp.status >= 200 && resp.status < 300;
    statusEl.innerHTML =
      '<span class="chip ' +
      (isOk ? "chip-ok" : "chip-er") +
      '">' +
      resp.status +
      " " +
      esc(resp.statusText) +
      "</span>";
    statusEl.style.display = "block";
    const ct = resp.headers.get("content-type") || "";
    let text;
    if (ct.includes("json")) {
      const json = await resp.json();
      text = JSON.stringify(json, null, 2);
    } else {
      text = await resp.text();
      try {
        text = JSON.stringify(JSON.parse(text), null, 2);
      } catch (e) {}
    }
    document.getElementById("rtResponse").textContent = text;
  } catch (e) {
    document.getElementById("rtResponse").textContent = "Error: " + e.message;
  }
}

