// ErisPulse Dashboard – core/ws (auto-split from dash.js)

// 是否为 Dashboard 自身的包名
function isDashboardPkg(s) {
  return /erispulse[-_]dashboard/i.test(s || "");
}
// 是否为框架自身的包名（erispulse，精确匹配，不含 dashboard 等衍生包）
function isFrameworkPkg(s) {
  var v = (s || "").trim().toLowerCase();
  return v === "erispulse" || v.indexOf("erispulse==") === 0;
}
// Dashboard 更新完成后强制刷新（带时间戳绕过 HTML 缓存）
function reloadAfterDashboardUpdate() {
  // 埋下持久化提示：刷新后展示"已自动重载模块，异常可重启"引导
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
          (m.packages ? m.packages.join(", ") : "");
        if (m.status === "running") {
          addOrUpdateTask(m.task_id, pkg, "running", m.output || []);
        } else if (m.status === "success") {
          _installTaskIds.delete(m.task_id);
          addOrUpdateTask(m.task_id, pkg, "success", m.output || []);
          // 升级的是 Dashboard 自身：后端即将自重载，前端随后强制刷新拿到新资源
          if (
            isDashboardPkg(pkg) ||
            (m.packages || []).some((p) => isDashboardPkg(p))
          ) {
            reloadAfterDashboardUpdate();
          } else if (
            isFrameworkPkg(pkg) ||
            (m.packages || []).some((p) => isFrameworkPkg(p))
          ) {
            // 升级的是框架：新代码需重启才能生效，给出重启引导
            var fwSpec =
              (m.packages || []).find((p) => isFrameworkPkg(p)) || pkg;
            onFrameworkUpdateSuccess(fwSpec.split("==")[1] || "");
          } else {
            loadModules();
            loadPackages(true);
            loadStore(true);
          }
        } else if (m.status === "error") {
          _installTaskIds.delete(m.task_id);
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
        }
        if (m.data && m.data.action === "upgraded") {
          toast(t("pkg_upgrade_success"), "ok");
          loadPackages(true);
        }
        loadModules();
      } else if (m.type === "dashboard_reloaded") {
        // 后端已完成 Dashboard 模块重载：强制刷新以加载全新资源
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
      } else if (m.type === "log_entry") {
        _onWebSocketLog(m.data);
      }
    } catch (err) {}
  };
}

export function loadAll() {
  initMirrorSelects();
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

