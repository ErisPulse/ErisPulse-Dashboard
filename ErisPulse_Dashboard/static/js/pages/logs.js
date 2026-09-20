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
  if (!_logStreamFlushTimer) {
    _logStreamFlushTimer = setTimeout(_flushLogStream, 300);
  }
}

export function _flushLogStream() {
  _logStreamFlushTimer = null;
  if (_logStreamBuffer.length === 0) return;
  var newLogs = _logStreamBuffer;
  _logStreamBuffer = [];

  // Collect new modules
  newLogs.forEach(function (log) {
    if (log.module && !_availableModules.has(log.module)) {
      _availableModules.add(log.module);
    }
  });
  if (newLogs.some(function (l) { return l.module; })) {
    updateModuleSelect();
  }

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

