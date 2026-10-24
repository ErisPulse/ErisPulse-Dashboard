// ErisPulse Dashboard – pages/logs (auto-split from dash.js)

export function debounceLogs() {
  clearTimeout(_logDebounceTimer);
  _logDebounceTimer = setTimeout(loadLogs, 300);
}

export function toggleLogAutoRefresh() {
  if (_logStreamActive || _logAutoRefreshTimer) {
    // Turn off
    _logStreamActive = false;
    if (_logAutoRefreshTimer) {
      clearInterval(_logAutoRefreshTimer);
      _logAutoRefreshTimer = null;
    }
    var btn = document.getElementById("logAutoRefreshBtn");
    if (btn) btn.style.opacity = "0.5";
    toast(t("auto_refresh_off"), "");
  } else {
    // Turn on - prefer WebSocket streaming, fall back to polling
    _logStreamActive = true;
    // Also do an initial load to get history
    loadLogs();
    var btn = document.getElementById("logAutoRefreshBtn");
    if (btn) btn.style.opacity = "1";
    toast(t("auto_refresh_on"), "ok");
  }
}

export function _onWebSocketLog(logData) {
  if (!_logStreamActive) return;
  _logStreamBuffer.push(logData);
  if (_logStreamFlushTimer) return;
  // 渲染合帧：WS 日志仅入队，至多每 250ms 合并一批，DOM 写入对齐下一动画帧；
  // 高频日志不再逐条触发列表重排（增量插入见 _flushLogStream，全量重建仅发生在
  // 切 tab / 变更过滤器 / 手动刷新等用户动作驱动的 loadLogs）
  _logStreamFlushTimer = setTimeout(function () {
    _logStreamFlushTimer = null;
    requestAnimationFrame(function () {
      _flushLogStream();
    });
  }, 250);
}

export function _flushLogStream() {
  _logStreamFlushTimer = null;
  if (_logStreamBuffer.length === 0) return;
  var newLogs = _logStreamBuffer;
  _logStreamBuffer = [];

  // 收集新出现的模块；仅在有真正新增时才重建模块下拉，避免每批次无谓刷新
  var hasNewModule = false;
  newLogs.forEach(function (log) {
    if (log.module && !_availableModules.has(log.module)) {
      _availableModules.add(log.module);
      hasNewModule = true;
    }
  });
  if (hasNewModule) updateModuleSelect();

  // Apply current filters
  var moduleFilter = document.getElementById("logModuleFilter")?.value || "";
  var levelSet = _getSelectedLevelsSet();
  var search = document.getElementById("logSearch")?.value?.toLowerCase() || "";

  var filtered = newLogs.filter(function (log) {
    if (moduleFilter && log.module && log.module.toLowerCase().indexOf(moduleFilter.toLowerCase()) === -1) return false;
    if (levelSet.size > 0 && !levelSet.has((log.level || "").toUpperCase())) return false;
    if (search && log.message && log.message.toLowerCase().indexOf(search) === -1) return false;
    return true;
  });

  // Prepend to existing log list
  var logList = document.getElementById("logList");
  if (!logList) return;

  var wasNearBottom = logList.scrollHeight - logList.scrollTop - logList.clientHeight < 50;
  var insertHTML = filtered.map(_renderLogEntry).join("");

  if (_logSortNewestBottom) {
    logList.insertAdjacentHTML("beforeend", insertHTML);
  } else {
    logList.insertAdjacentHTML("afterbegin", insertHTML);
  }

  // Trim excess entries (keep max 500)
  while (logList.children.length > 500) {
    if (_logSortNewestBottom) logList.removeChild(logList.firstChild);
    else logList.removeChild(logList.lastChild);
  }

  // Update count
  var countEl = document.getElementById("logCount");
  if (countEl) countEl.textContent = parseInt(countEl.textContent || "0") + filtered.length;

  // Auto-scroll
  if (!_logPaused && (_logStreamActive || wasNearBottom)) {
    logList.scrollTop = _logSortNewestBottom ? logList.scrollHeight : 0;
  }
}

export function _getSelectedLevels() {
  var container = document.getElementById("logLevelFilter");
  if (!container) return [];
  var checked = container.querySelectorAll('input[type="checkbox"]:checked');
  return Array.prototype.map.call(checked, function (cb) { return cb.value; });
}

export function _getSelectedLevelsSet() {
  return new Set(_getSelectedLevels());
}

export function _logLevelToNum(level) {
  var map = { TRACE: 5, DEBUG: 10, INFO: 20, EVENT: 21, WARNING: 30, ERROR: 40, CRITICAL: 50 };
  return map[(level || "").toUpperCase()] ?? null;
}

export function _renderLogEntry(log) {
  var moduleEsc = esc(log.module || "");
  var moduleTooltip = (log.module && log.module.length > 15) ? 'title="' + esc(log.module) + '"' : "";
  var lvl = (log.level || "").toLowerCase();
  var lvlClass = lvl ? " log-level-" + lvl : "";
  var lvlBadge = lvl
    ? '<span class="log-level-badge ' + lvl + '">' + esc(log.level) + "</span>"
    : "";
  // Short timestamp: HH:MM:SS, full on hover
  var ts = log.timestamp || "";
  var shortTs = ts;
  var m = ts.match(/(\d{2}:\d{2}:\d{2})/);
  if (m) shortTs = m[1];
  return '<div class="log-entry' + lvlClass + '" onclick="this.classList.toggle(\'log-expanded\')">' +
    '<span class="log-time" title="' + esc(ts) + '">' + esc(shortTs) + "</span>" +
    '<span class="log-module" ' + moduleTooltip + ">" + lvlBadge + moduleEsc + "</span>" +
    '<span class="log-message">' + esc(log.message) + "</span>" +
    "</div>";
}

export function toggleLogPause() {
  _logPaused = !_logPaused;
  var btn = document.getElementById("logPauseBtn");
  if (btn) {
    btn.classList.toggle("paused", _logPaused);
    btn.title = _logPaused ? t("resume_scroll") : t("pause_scroll");
  }
}

export function toggleLogSortOrder() {
  _logSortNewestBottom = !_logSortNewestBottom;
  var btn = document.getElementById("logSortBtn");
  if (btn) {
    btn.classList.toggle("active", _logSortNewestBottom);
    btn.title = _logSortNewestBottom
      ? t("sort_newest_bottom")
      : t("sort_newest_top");
  }
  loadLogs();
}

export async function _discoverLogModules() {
  var now = Date.now();
  if (now - _logLastModuleScan < 30000) return;
  _logLastModuleScan = now;
  const d = await api("/api/logs?limit=500");
  if (!d || !d.logs) return;
  var newModules = false;
  d.logs.forEach((log) => {
    if (log.module && !_availableModules.has(log.module)) {
      _availableModules.add(log.module);
      newModules = true;
    }
  });
  if (newModules) updateModuleSelect();
}

export async function loadLogs() {
  const moduleFilter = document.getElementById("logModuleFilter")?.value || "";
  const selectedLevels = _getSelectedLevels();
  const search = document.getElementById("logSearch")?.value || "";

  // 定期做一次全量扫描以发现新模块（不阻塞当前渲染）
  _discoverLogModules();

  const params = new URLSearchParams();
  if (moduleFilter) params.set("module", moduleFilter);
  if (selectedLevels.length) params.set("levels", selectedLevels.join(","));
  if (search) params.set("search", search);
  params.set("limit", "200");

  const d = await api("/api/logs?" + params);
  if (!d) return;

  const logs = d.logs || [];

  // 同时从当前筛选结果中收集新模块
  var newModules = false;
  logs.forEach((log) => {
    if (log.module && !_availableModules.has(log.module)) {
      _availableModules.add(log.module);
      newModules = true;
    }
  });
  if (newModules) updateModuleSelect();

  document.getElementById("logCount").textContent = d.total || 0;

  if (logs.length === 0) {
    document.getElementById("logList").innerHTML =
      '<div class="empty-state"><p>' + t("no_logs") + "</p></div>";
    return;
  }

  const sortedLogs = _logSortNewestBottom ? logs.slice().reverse() : logs;
  const logHtml = sortedLogs.map(_renderLogEntry).join("");

  const logList = document.getElementById("logList");
  const wasNearBottom =
    logList.scrollHeight - logList.scrollTop - logList.clientHeight < 50;

  logList.innerHTML = logHtml;

  if (!_logPaused && (_logAutoRefreshTimer || wasNearBottom)) {
    logList.scrollTop = _logSortNewestBottom ? logList.scrollHeight : 0;
  }
}

export function updateModuleSelect() {
  const select = document.getElementById("logModuleFilter");
  if (!select) return;

  const currentValue = select.value;

  // 清空并重新填充
  select.innerHTML = '<option value="">' + t("all_modules") + "</option>";

  const sortedModules = Array.from(_availableModules).sort();
  sortedModules.forEach((module) => {
    const opt = document.createElement("option");
    opt.value = module;
    opt.textContent = module;
    select.appendChild(opt);
  });

  // 恢复之前的选择
  if (currentValue && _availableModules.has(currentValue)) {
    select.value = currentValue;
  }
}

export function _copyToClipboard(text) {
  return new Promise((resolve, reject) => {
    if (
      navigator.clipboard &&
      navigator.clipboard.writeText &&
      window.isSecureContext
    ) {
      navigator.clipboard.writeText(text).then(resolve, reject);
      return;
    }
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error("execCommand failed"));
    } catch (e) {
      document.body.removeChild(ta);
      reject(e);
    }
  });
}

export async function _fetchFilteredLogs() {
  const moduleFilter = document.getElementById("logModuleFilter")?.value || "";
  const selectedLevels = _getSelectedLevels();
  const search = document.getElementById("logSearch")?.value || "";

  const params = new URLSearchParams();
  if (moduleFilter) params.set("module", moduleFilter);
  if (selectedLevels.length) params.set("levels", selectedLevels.join(","));
  if (search) params.set("search", search);
  params.set("limit", "10000");

  const d = await api("/api/logs?" + params);
  if (!d || !d.logs) return [];
  return d.logs.slice().reverse();
}

export function _formatLogText(logs) {
  return logs
    .map(function (log) {
      var ts = log.timestamp || "";
      var lvl = (log.level || "").toUpperCase();
      var mod = log.module || "";
      var msg = log.message || "";
      return "[" + ts + "] [" + lvl + "] [" + mod + "] " + msg;
    })
    .join("\n");
}

export function copyLogs() {
  _fetchFilteredLogs().then(function (logs) {
    if (!logs.length) {
      toast(t("no_logs"), "er");
      return;
    }
    _copyToClipboard(_formatLogText(logs))
      .then(() => {
        toast(t("copied_to_clipboard"), "ok");
      })
      .catch(() => {
        toast(t("copy_failed"), "er");
      });
  });
}

export function downloadLogs() {
  _fetchFilteredLogs().then(function (logs) {
    if (!logs.length) {
      toast(t("no_logs"), "er");
      return;
    }

    const text = _formatLogText(logs);
    const now = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const stamp =
      now.getFullYear() +
      "-" +
      p(now.getMonth() + 1) +
      "-" +
      p(now.getDate()) +
      "_" +
      p(now.getHours()) +
      p(now.getMinutes()) +
      p(now.getSeconds());

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "erispulse_logs_" + stamp + ".log";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

export async function loadLifecycle() {
  const d = await api("/api/lifecycle");
  if (!d) return;

  const events = d.events || [];
  const filter = document.getElementById("lifecycleFilter")?.value || "";

  const filtered = filter
    ? events.filter((e) => e.event.startsWith(filter + "."))
    : events;

  if (filtered.length === 0) {
    document.getElementById("lifecycleTimeline").innerHTML =
      '<div class="empty-state"><p>' + esc(t("no_lifecycle")) + "</p></div>";
    return;
  }

  const timelineHtml = filtered
    .map((event, idx) => {
      const eventParts = event.event.split(".");
      const eventType = eventParts[0] || "";
      const eventName = eventParts.slice(1).join(".");

      const time = new Date(event.timestamp * 1000).toLocaleTimeString();

      const hasData = event.data && Object.keys(event.data).length > 0;
      const dataJson = hasData ? JSON.stringify(event.data, null, 2) : "";

      return `<div class="lifecycle-item${hasData ? " has-data" : ""}" ${hasData ? `onclick="this.classList.toggle('expanded')"` : ""}>
            <span class="lifecycle-badge ${esc(eventType)}">${esc(eventType)}</span>
            <span class="lifecycle-event">${esc(eventName)}</span>
            <span class="lifecycle-time">${time}</span>
            ${hasData ? '<span class="lifecycle-expand-hint">▸</span>' : ""}
            ${hasData ? `<div class="lifecycle-data"><pre>${esc(dataJson)}</pre></div>` : ""}
        </div>`;
    })
    .join("");

  document.getElementById("lifecycleTimeline").innerHTML = timelineHtml;
}

export async function clearLifecycle() {
  const ok = await confirm2(t("clear_events"), t("clear_confirm"));
  if (!ok) return;
  await api("/api/lifecycle/clear", { method: "POST" });
  loadLifecycle();
}

// ════════════════ 服务端日志导出（sdk.logger.save_logs → 临时文件 → FileResponse） ════════════════

export async function exportServerLogs() {
  try {
    const tk = localStorage.getItem(TK);
    const resp = await fetch(API + "/api/logs/export", {
      headers: tk ? { Authorization: "Bearer " + tk } : {},
    });
    if (!resp.ok) {
      let msg = "";
      try {
        const j = await resp.json();
        msg = j && j.error ? j.error : "";
      } catch (e) {}
      if (resp.status === 404) msg = t("no_logs");
      toast(msg || t("server_error") + " (" + resp.status + ")", "er");
      return;
    }
    // 文件名优先取响应头（后端已按日期命名），缺失时本地补齐
    const cd = resp.headers.get("Content-Disposition") || "";
    let name = "";
    const mStar = cd.match(/filename\*=UTF-8''([^;]+)/i);
    const mPlain = cd.match(/filename="([^"]+)"/);
    if (mStar) name = decodeURIComponent(mStar[1]);
    else if (mPlain) name = mPlain[1];
    if (!name) {
      const p = (n) => String(n).padStart(2, "0");
      const now = new Date();
      name =
        "erispulse-logs-" +
        now.getFullYear() +
        "-" +
        p(now.getMonth() + 1) +
        "-" +
        p(now.getDate()) +
        ".log";
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(t("logs_export_ok"), "ok");
  } catch (e) {
    toast(t("logs_export_failed"), "er");
  }
}

// ════════════════ 实时连接面板（连接注册表 list + stats） ════════════════

export async function loadConnections() {
  const listEl = document.getElementById("connList");
  if (!listEl) return;
  const statsEl = document.getElementById("connStatsRow");
  const countEl = document.getElementById("connTotalCount");
  const unsupportedEl = document.getElementById("connUnsupported");
  const d = await api("/api/connections");

  // 旧 SDK 无 connections 模块：显示不支持态（与归属审计 tab 同构）
  if (!d || d.supported === false) {
    listEl.innerHTML = "";
    if (statsEl) statsEl.innerHTML = "";
    if (countEl) countEl.textContent = "0";
    if (unsupportedEl) {
      unsupportedEl.innerHTML = "<p>" + esc(t("conn_unsupported")) + "</p>";
      unsupportedEl.style.display = "";
    }
    return;
  }
  if (unsupportedEl) unsupportedEl.style.display = "none";

  const conns = d.connections || [];
  const stats = d.stats || {};
  if (countEl)
    countEl.textContent = String(
      stats.total !== undefined ? stats.total : conns.length,
    );

  // stats 概览行：总数 / 各 kind / 命名空间数 / 分组数
  if (statsEl) {
    const byKind = stats.by_kind || {};
    const nsNames = Object.keys(stats.by_namespace || {}).length;
    const groupNames = Object.keys(stats.groups || {}).length;
    const cells = [
      [t("conn_stat_total"), stats.total !== undefined ? stats.total : conns.length],
      ["server", byKind.server || 0],
      ["client", byKind.client || 0],
      ["sse", byKind.sse || 0],
      [t("conn_stat_namespaces"), nsNames],
      [t("conn_stat_groups"), groupNames],
    ];
    statsEl.innerHTML = cells
      .map(function (c) {
        return (
          '<div class="conn-stat-cell"><span class="conn-stat-val">' +
          esc(String(c[1])) +
          '</span><span class="conn-stat-label">' +
          esc(c[0]) +
          "</span></div>"
        );
      })
      .join("");
  }

  if (conns.length === 0) {
    listEl.innerHTML =
      '<div class="empty-state"><p>' + esc(t("conn_empty")) + "</p></div>";
    return;
  }

  // kind 语义 chip：server=sc / client=pr / sse=ok
  var kindClass = { server: "chip-sc", client: "chip-pr", sse: "chip-ok" };
  listEl.innerHTML = conns
    .map(function (c) {
      var kind = c.kind || "server";
      var kindCls = kindClass[kind] || "chip-sc";
      var groupsTxt = c.groups && c.groups.length ? esc(c.groups.join(", ")) : "";
      var ownerTxt = c.owner || "-";
      return (
        '<div class="conn-row">' +
        '<span class="conn-id" title="' +
        esc(c.id || "") +
        '">' +
        esc(c.id || "") +
        "</span>" +
        '<span class="conn-ns">' +
        esc(c.namespace || ownerTxt) +
        "</span>" +
        '<span class="chip ' +
        kindCls +
        ' conn-kind-chip">' +
        esc(kind) +
        "</span>" +
        '<span class="conn-owner" title="' +
        esc(t("conn_owner")) +
        '">' +
        esc(ownerTxt) +
        "</span>" +
        '<span class="conn-groups"' +
        (groupsTxt ? ' title="' + groupsTxt + '"' : "") +
        ">" +
        (groupsTxt || "-") +
        "</span>" +
        '<button class="btn btn-secondary btn-xs conn-close-btn" onclick="closeConnection(\'' +
        esc(c.id || "") +
        "')\">" +
        esc(t("conn_disconnect")) +
        "</button>" +
        "</div>"
      );
    })
    .join("");
}

export async function closeConnection(id) {
  const ok = await confirm2(
    t("conn_disconnect_title"),
    t("conn_disconnect_confirm").replace("{id}", id),
  );
  if (!ok) return;
  const d = await api("/api/connections/close", {
    method: "POST",
    body: JSON.stringify({ id: id }),
  });
  if (d && d.success) {
    toast(t("conn_disconnect_ok"), "ok");
  } else {
    toast((d && d.error) || t("conn_disconnect_failed"), "er");
  }
  loadConnections();
}

