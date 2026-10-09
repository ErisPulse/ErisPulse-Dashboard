 

 
function isDashboardPkg(s) {
  return /erispulse[-_]dashboard/i.test(s || "");
}
 
function isFrameworkPkg(s) {
  var v = (s || "").trim().toLowerCase();
  return v === "erispulse" || v.indexOf("erispulse==") === 0;
}
 
 
function getFwUpdateIntent(taskId) {
  try {
    var raw = localStorage.getItem("ep_fw_task");
    if (!raw) return null;
    var intent = JSON.parse(raw);
    if (!intent || !intent.task_id) return null;
    if (taskId && intent.task_id !== taskId) return null;
    return intent;
  } catch (e) {
    return null;
  }
}

function clearFwUpdateIntent() {
  try {
    localStorage.removeItem("ep_fw_task");
  } catch (e) {}
}
 
function reloadAfterDashboardUpdate() {
   
  try { showUpdateHint("dashboard", ""); } catch (e) {}
  toast(t("dashboard_updated_reload"), "ok");
  setTimeout(function () {
    location.href =
      location.pathname + "?_r=" + Date.now() + (location.hash || "");
  }, 1800);
}

export function wsConnect() {
  if (ws) {
    ws.onclose = null;
    ws.onerror = null;
    try {
      ws.close();
    } catch (e) {}
    ws = null;
  }
  var u;
  if (currentNode === "local") {
    const p = location.protocol === "https:" ? "wss:" : "ws:";
    u =
      p +
      "//" +
      location.host +
      API +
      "/ws?token=" +
      encodeURIComponent(localStorage.getItem(TK) || "");
  } else {
    var info = nodeRuntimeInfo[currentNode] || {};
    var nodeUrl = info.url || "";
    if (!nodeUrl) {
      connStateChange(0, false);
      return;
    }
    var wsProto = nodeUrl.startsWith("https") ? "wss:" : "ws:";
    var wsHost = nodeUrl.replace(/^https?:\/\//, "");
    u =
      wsProto +
      "//" +
      wsHost +
      "/Dashboard/ws?token=" +
      encodeURIComponent(info.token || "");
  }
  ws = new WebSocket(u);
  _wsMeta.url = u;
  ws.onopen = () => {
    _wsMeta.connectedAt = Date.now();
    connStateChange(1, true);
  };
  ws.onclose = () => {
    if (_wsMeta.connectedAt) _wsMeta.reconnects++;
    _wsMeta.connectedAt = 0;
    connStateChange(0, true);
    setTimeout(wsConnect, 3000);
  };
  ws.onerror = () => ws.close();
  ws.onmessage = (e) => {
    try {
      const m = JSON.parse(e.data);
      wsLogPush(m.type, e.data);
      if (m.type === "event") {
        _wsMeta.events++;
        allEvents.push(m.data);
        _totalEventCount++;
        if (allEvents.length > 500) allEvents.shift();
        const sv = document.getElementById("statGrid");
        const statCards = sv?.querySelectorAll(".stat-val");
        if (statCards && statCards[3]) {
          if (window.EP && EP.countUp) EP.countUp(statCards[3], _totalEventCount);
          else statCards[3].textContent = _totalEventCount;
          if (window.EP && EP._statPrev && EP._statPrev.statGrid)
            EP._statPrev.statGrid[3] = _totalEventCount;
        }
        if (document.querySelector(".page.active")?.id === "p-dashboard") {
          const dh = document.getElementById("dashEvents");
          const em = dh?.querySelector(".empty-state");
          if (em) em.remove();
          if (dh) prependEventHtml(dh, m.data);
          while (dh && dh.children.length > 20) dh.removeChild(dh.lastChild);
        }
        if (
          document.querySelector(".page.active")?.id === "p-event-stream" &&
          _eventStreamLive
        ) {
          _wsEventBuffer.push(m.data);
          if (!_wsFlushTimer) {
            _wsFlushTimer = setTimeout(() => {
              _wsFlushTimer = null;
              _flushEventStream();
            }, 500);
          }
        }
      } else if (m.type === "install_progress") {
        const pkg =
          _installTaskIds.get(m.task_id) ||
          (m.packages ? m.packages.join(", ") : "") ||
          (_tasks.find((t) => t.id === m.task_id) || {}).name ||
          "";
        if (m.status === "running") {
           
          addOrUpdateTask(
            m.task_id,
            pkg,
            "running",
            m.output && m.output.length ? m.output : undefined,
          );
        } else if (m.status === "success") {
          _installTaskIds.delete(m.task_id);
          addOrUpdateTask(m.task_id, pkg, "success", m.output || []);
           
          if (
            isDashboardPkg(pkg) ||
            (m.packages || []).some((p) => isDashboardPkg(p))
          ) {
            reloadAfterDashboardUpdate();
          } else if (
            isFrameworkPkg(pkg) ||
            (m.packages || []).some((p) => isFrameworkPkg(p))
          ) {
             
            var fwSpec =
              (m.packages || []).find((p) => isFrameworkPkg(p)) || pkg;
            clearFwUpdateIntent();
            onFrameworkUpdateSuccess(fwSpec.split("==")[1] || "");
          } else if (getFwUpdateIntent(m.task_id)) {
            var fwIntent = getFwUpdateIntent(m.task_id);
            clearFwUpdateIntent();
            onFrameworkUpdateSuccess(fwIntent.version || "");
          } else {
            loadModules();
            loadPackages(true);
            loadStore(true);
          }
        } else if (m.status === "error") {
          _installTaskIds.delete(m.task_id);
          if (getFwUpdateIntent(m.task_id)) clearFwUpdateIntent();
          addOrUpdateTask(
            m.task_id,
            pkg,
            "error",
            m.output || [],
            m.message || t("install_failed"),
          );
        }
      } else if (m.type === "module_changed") {
        if (m.data && m.data.action === "installed") {
          toast(m.data.name + ": " + t("module_loaded_dynamic"), "ok");
           
          addOrUpdateTask(
            "mod:installed:" + m.data.name,
            m.data.name + " · " + t("module_loaded_dynamic"),
            "success",
            [],
          );
           
          queueInstallGuide(m.data.name, "module");
        }
        if (m.data && m.data.action === "installed_adapter") {
           
          queueInstallGuide(m.data.name, "adapter");
          addOrUpdateTask(
            "mod:adapter:" + m.data.name,
            m.data.name + " · " + t("module_loaded_dynamic"),
            "success",
            [],
          );
        }
        if (m.data && m.data.action === "upgraded") {
          toast(t("pkg_upgrade_success"), "ok");
          addOrUpdateTask(
            "mod:upgraded",
            t("pkg_upgrade_success"),
            "success",
            [],
          );
          loadPackages(true);
        }
        loadModules();
      } else if (m.type === "dashboard_reloaded") {
         
        reloadAfterDashboardUpdate();
      } else if (m.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      } else if (m.type === "views_changed") {
        if (m.data && m.data.action === "unregister" && m.data.id) {
          _removeModuleView(m.data.id);
        } else {
          loadModuleViews();
        }
      } else if (m.type === "appearance_changed") {
        loadGlobalAppearance();
      } else if (m.type === "cert_files_changed") {
         
      } else if (m.type === "config_updated") {
         
        toast(t("config_changed_externally"), "");
        const fwBody = document.getElementById("fwConfigBody");
        if (
          fwBody &&
          document.querySelector("#p-settings.page.active") &&
          typeof loadFrameworkConfig === "function"
        ) {
          loadFrameworkConfig();
        }
      } else if (m.type === "log_entry") {
        _onWebSocketLog(m.data);
      }
    } catch (err) {}
  };
}

export function loadAll() {
  initMirrorSelects();
   
  api("/api/capabilities")
    .then(function (c) {
      window.CAPS = (c && c.capabilities) || {};
    })
    .catch(function () {});
  loadGlobalAppearance();
  initHeaderStatusIcon();
  applySettingDensity(getDensity());
  initCustomCss();
  _applyEditorOptions();
  fetchAdapterLogos();
  document.body.classList.toggle("privacy-on", getPrivacyMode());
  window.refreshDashboard();
  checkFwUpdateBadge();
  loadEvents();
  loadBots();
  loadModules();
  loadConfig();
  loadStore();
  loadMessageStats();
  loadAuditLog();
  loadPerformance();
  loadPackages();
  loadPackageUpdates();
  loadModuleViews();
  loadMaster();
  restartRefreshTimer();
}

