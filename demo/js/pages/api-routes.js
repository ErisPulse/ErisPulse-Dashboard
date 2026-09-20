// ErisPulse Dashboard – pages/api-routes (auto-split from dash.js)

export async function loadApiRoutes() {
  const d = await api("/api/routes");
  if (!d) return;

  const httpRoutes = d.http_routes || [];
  const wsRoutes = d.ws_routes || [];

  document.getElementById("httpRouteCount").textContent = httpRoutes.length;
  document.getElementById("wsRouteCount").textContent = wsRoutes.length;

  var groups = {};

  httpRoutes.forEach(function (r) {
    var m = r.module || "System";
    if (!groups[m]) groups[m] = { http: [], ws: [] };
    groups[m].http.push(r);
  });

  wsRoutes.forEach(function (r) {
    var m = r.module || "System";
    if (!groups[m]) groups[m] = { http: [], ws: [] };
    groups[m].ws.push(r);
  });

  var moduleNames = Object.keys(groups).sort(function (a, b) {
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

  moduleNames.forEach(function (mod, idx) {
    var g = groups[mod];
    var totalRoutes = g.http.length + g.ws.length;
    if (totalRoutes === 0) return;
    var basePath = "/" + mod;

    html +=
      '<div class="card route-group-card collapsed" style="margin-bottom:12px">';
    html +=
      '<div class="card-header" style="cursor:pointer;user-select:none" onclick="toggleRouteGroup(this)">';
    html +=
      '<svg class="route-group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;transition:transform .2s">';
    html += '<polyline points="6 9 12 15 18 9"/></svg>';
    html += '<span style="flex:1;font-size:14px">' + esc(mod) + "</span>";
    html +=
      '<span class="chip chip-sc" style="margin:0">' +
      totalRoutes +
      " routes</span>";
    if (g.http.length > 0)
      html +=
        '<span class="chip chip-pr" style="margin:0;margin-left:4px">' +
        g.http.length +
        " HTTP</span>";
    if (g.ws.length > 0)
      html +=
        '<span class="chip chip-sc" style="margin:0;margin-left:4px">' +
        g.ws.length +
        " WS</span>";
    html += "</div>";
    html += '<div class="route-group-body" style="display:none">';

    g.http.forEach(function (r) {
      var mc = methodColor[r.method] || "method-get";
      html += '<div class="route-item">';
      html +=
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
      html += '<span class="method-badge ' + mc + '">' + r.method + "</span>";
      html +=
        '<code style="font-size:13px;font-weight:500;background:var(--bg-s);padding:2px 6px;border-radius:4px">' +
        esc(r.full_path) +
        "</code>";
      html += '<div style="margin-left:auto">';
      html +=
        '<button class="btn btn-secondary btn-xs" onclick="openRouteTest(\'' +
        esc(r.method) +
        "','" +
        esc(r.full_path) +
        "')\">" +
        t("test") +
        "</button>";
      html += "</div></div></div>";
    });

    g.ws.forEach(function (r) {
      var authBadge = r.has_auth
        ? '<span class="chip chip-wr" style="margin:0">' +
          t("requires_auth") +
          "</span>"
        : "";
      html += '<div class="route-item">';
      html +=
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
      html += '<span class="method-badge method-ws">WS</span>';
      html += authBadge;
      html +=
        '<code style="font-size:13px;font-weight:500;background:var(--bg-s);padding:2px 6px;border-radius:4px">' +
        esc(r.full_path) +
        "</code>";
      html += "</div></div>";
    });

    html += "</div></div>";
  });

  var container = document.getElementById("routeModulesContainer");
  container.innerHTML =
    html ||
    '<div style="padding:16px;font-size:13px;color:var(--tx-s);text-align:center">' +
      t("no_data") +
      "</div>";
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

const _originalRefreshDashboard = window.refreshDashboard;;

window.refreshDashboard = async function () {
  await _originalRefreshDashboard();
  await loadPerformance();
  await loadMessageStats();
};;

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

