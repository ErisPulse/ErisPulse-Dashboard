// ErisPulse Dashboard – pages/dashboard (auto-split from dash.js)

export async function refreshDashboard() {
  const d = await api("/api/status");
  if (!d) return;
  const fw = d.framework || {};
  window._fwStatus = fw;
  updateAboutCard();
  // 存储服务器平台（用于判断更新行为，而非客户端浏览器平台）
  window._serverPlatform = fw.platform || "";
  window._serverIsWindows = !!fw.is_windows;
  document.getElementById("fwDesc").textContent =
    "ErisPulse v" + fw.version + " | Python " + fw.python_version;
  document.getElementById("fwInfo").textContent = "ErisPulse v" + fw.version;
  const ad = d.adapters || {},
    mo = d.modules || {};
  // 适配器配置完整度（onboarding-card 动态步骤用）
  window._adapterConfigStatus = d.adapter_config_status || {};
  let ob = 0;
  Object.values(ad).forEach((a) =>
    Object.values(a.bots || {}).forEach((b) => {
      if (b.status === "online") ob++;
    }),
  );
  document.getElementById("statGrid").innerHTML =
    statCard(
      Object.keys(ad).length,
      t("adapters"),
      '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
      "adapter",
    ) +
    statCard(
      Object.keys(mo).filter((k) => mo[k]).length,
      t("modules_label"),
      '<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
      "module-mgmt",
    ) +
    statCard(
      ob,
      t("online_bots"),
      '<rect x="5" y="8" width="14" height="10" rx="2"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/><line x1="12" y1="4" x2="12" y2="8"/><circle cx="9" cy="4" r="1.5" fill="currentColor"/><circle cx="15" cy="4" r="1.5" fill="currentColor"/>',
      "bots",
    ) +
    statCard(
      _totalEventCount,
      t("total_events"),
      '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>',
      "event-stream",
    );
  // 统计数字变化时滚动动画（EP Live）
  if (window.EP && EP.animateStatVals)
    EP.animateStatVals(document.getElementById("statGrid"), "statGrid");

  updateOnboardingCard(ad);

  renderHomePins();

  let aH = "";
  Object.entries(ad).forEach(([n, i]) => {
    const on = i.status === "started";
    aH +=
      '<div class="list-row">' +
      adapterLogoImg(n, 20) +
      '<span class="dash-list-name">' +
      esc(n) +
      '</span><span class="dash-list-sub">' +
      Object.keys(i.bots || {}).length +
      " bots</span>" +
      '<span class="chip ' +
      (on ? "chip-ok" : "chip-er") +
      ' dash-list-chip">' +
      esc(i.status) +
      "</span></div>";
  });
  document.getElementById("dashAdapters").innerHTML =
    aH ||
    '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg><p>' +
      t("no_adapters") +
      "</p></div>";

  let mH = "";
  Object.entries(mo).forEach(([n, l]) => {
    mH +=
      '<div class="list-row"><span class="dash-list-name">' +
      esc(n) +
      '</span><span class="chip ' +
      (l ? "chip-ok" : "chip-er") +
      ' dash-list-chip">' +
      (l ? t("active") : t("inactive")) +
      "</span></div>";
  });
  document.getElementById("dashModules").innerHTML =
    mH ||
    '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg><p>' +
      t("no_modules") +
      "</p></div>";

  platforms = Object.keys(ad);
}

export function statCard(v, label, icon, page) {
  // v1.1 stat 瓦片：图标软底方块 + 大数字 + 小标签（.stat-val 类名被 EP 动画/WS 依赖，勿改）
  const tag = page
    ? '<div class="stat-card is-link" onclick="go(' + "'" + page + "'" + ')">'
    : '<div class="stat-card">';
  return (
    tag +
    (icon
      ? '<span class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
        icon +
        "</svg></span>"
      : "") +
    '<span class="stat-meta"><span class="stat-val">' +
    v +
    '</span><span class="stat-label">' +
    esc(label) +
    "</span></span></div>"
  );
}

export async function loadPerformance() {
  const d = await api("/api/performance");
  if (!d) return;

  const system = d.system || {};
  const process = system.process || {};
  const memory = system.memory || {};

  const fmt = (v, unit = "") => {
    if (v === null || v === undefined) return "--" + unit;
    if (typeof v === "string") v = parseFloat(v) || 0;
    return v.toFixed(1) + unit;
  };

  var _updateCircle = function (circleId, textId, pct) {
    var circleEl = document.getElementById(circleId);
    if (circleEl) {
      circleEl.setAttribute("stroke-dashoffset", 100 - Math.min(pct, 100));
      circleEl.classList.toggle("high", pct > 60);
      circleEl.classList.toggle("critical", pct > 85);
    }
    var textEl = document.getElementById(textId);
    if (textEl) textEl.textContent = (pct || 0).toFixed(0) + "%";
  };
  var _updateBar = function (barId, pct) {
    var bar = document.getElementById(barId);
    if (bar) {
      bar.style.width = Math.min(pct, 100) + "%";
      bar.classList.toggle("high", pct > 60);
      bar.classList.toggle("critical", pct > 85);
    }
  };

  // CPU 卡片：只显示进程CPU
  var procCpu = memory.cpu_percent || 0;
  var sysCpu = memory.system_cpu_percent || 0;
  _updateCircle("cpuProgressCircle", "cpuProgressText", procCpu);

  // 内存卡片：只显示进程内存
  var rssMb = memory.rss_mb || 0;
  var totalGb = memory.system_total_gb || 0;
  var procMemPct =
    totalGb > 0 ? Math.min((rssMb / (totalGb * 1024)) * 100, 100) : 0;
  var sysPct = memory.system_percent || 0;

  _updateCircle("memProgressCircle", "memProgressText", procMemPct);
  if (document.getElementById("procMemVal"))
    document.getElementById("procMemVal").textContent = fmt(rssMb, " MB");

  // psutil 不可用且降级链也未取到数据时显示 N/A（而非误导性 0%）
  if (memory.psutil_ok === false) {
    var naCpu = document.getElementById("cpuProgressText");
    if (naCpu) naCpu.textContent = "N/A";
    var naMem = document.getElementById("memProgressText");
    if (naMem) naMem.textContent = "N/A";
  }

  // popover详情
  const setEl = (id, v, unit = "") => {
    const el = document.getElementById(id);
    if (el) el.textContent = fmt(v, unit);
  };
  if (document.getElementById("cpuProcPct"))
    document.getElementById("cpuProcPct").textContent = fmt(procCpu, "%");
  if (document.getElementById("cpuSysPct"))
    document.getElementById("cpuSysPct").textContent = fmt(sysCpu, "%");
  setEl("cpuUser", process.cpu_user, " s");
  setEl("cpuSys", process.cpu_system, " s");
  if (document.getElementById("cpuThreads"))
    document.getElementById("cpuThreads").textContent = String(
      process.threads || "--",
    );

  if (document.getElementById("memRss"))
    document.getElementById("memRss").textContent = fmt(rssMb, " MB");
  if (document.getElementById("sysMemPct"))
    document.getElementById("sysMemPct").textContent = fmt(sysPct, "%");
  setEl("vmsMem", memory.vms_mb, " MB");
  setEl("sysTotal", memory.system_total_gb, " GB");
  setEl("sysAvail", memory.system_available_gb, " GB");
  setEl("swapMem", memory.swap_used_mb, " MB");
  setEl("ioRead", process.read_bytes_mb, " MB");
  setEl("ioWrite", process.write_bytes_mb, " MB");

  // 性能卡指标格：轻量三项（线程/交换内存已在 CPU/内存详情浮层，不在卡面堆叠）
  var extraRows = [];
  if (system.uptime_human)
    extraRows.push([t("instance_uptime"), system.uptime_human, ""]);
  if (system.disk && system.disk.percent !== undefined)
    extraRows.push([
      t("instance_disk"),
      (system.disk.percent || 0) + "%",
      system.disk.used_gb !== undefined && system.disk.total_gb !== undefined
        ? system.disk.used_gb + " / " + system.disk.total_gb + " GB"
        : "",
    ]);
  if (process.connections !== undefined)
    extraRows.push([t("instance_connections"), process.connections, ""]);
  var extraEl = document.getElementById("perfExtra");
  if (extraEl) {
    extraEl.innerHTML = extraRows
      .map(function (r) {
        return (
          '<div class="perf-extra-cell"' +
          (r[2] ? ' title="' + esc(r[2]) + '"' : "") +
          '><span class="perf-extra-label">' +
          esc(r[0]) +
          '</span><span class="perf-extra-val">' +
          esc(String(r[1])) +
          "</span></div>"
        );
      })
      .join("");
  }

  // 存储以便后续使用
  window._perfData = {
    vms: memory.vms_mb,
    threads: process.threads,
    connections: process.connections,
    listening: process.listening,
    readBytes: process.read_bytes_mb,
    writeBytes: process.write_bytes_mb,
    swapUsed: memory.swap_used_mb,
    swapPercent: memory.swap_percent,
    sysTotal: memory.system_total_gb,
    sysAvail: memory.system_available_gb,
  };
}
