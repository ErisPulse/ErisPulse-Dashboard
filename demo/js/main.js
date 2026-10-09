 
 

import * as m_core_state from "./core/state.js";
import * as m_core_api from "./core/api.js";
import * as m_core_i__n from "./core/i18n.js";
import * as m_core_utils from "./core/utils.js";
import * as m_core_themepack from "./core/themepack.js";
import * as m_components_modal from "./components/modal.js";
import * as m_components_toast from "./components/toast.js";
import * as m_components_popover from "./components/popover.js";
import * as m_components_ep_select from "./components/ep-select.js";
import * as m_components_tabs from "./components/tabs.js";
import * as m_components_kv from "./components/kv.js";
import * as m_components_tasks from "./components/tasks.js";
import * as m_components_update_hint from "./components/update-hint.js";
import * as m_components_install_guide from "./components/install-guide.js";
import * as m_components_search_palette from "./components/search-palette.js";
import * as m_components_onboarding_card from "./components/onboarding-card.js";import * as m_components_status_icon from "./components/status-icon.js";
import * as m_components_ws_inspector from "./components/ws-inspector.js";
import * as m_core_router from "./core/router.js";
import * as m_core_moduleviews from "./core/moduleviews.js";
import * as m_core_auth from "./core/auth.js";
import * as m_core_ws from "./core/ws.js";
import * as m_pages_appearance from "./pages/appearance.js";
import * as m_pages_settings from "./pages/settings.js";
import * as m_pages_dashboard from "./pages/dashboard.js";
import * as m_pages_events from "./pages/events.js";
import * as m_pages_bots from "./pages/bots.js";
import * as m_pages_modules from "./pages/modules.js";
import * as m_pages_store from "./pages/store.js";
import * as m_pages_packages from "./pages/packages.js";
import * as m_pages_config from "./pages/config.js";
import * as m_pages_component_config from "./pages/component-config.js";
import * as m_pages_framework from "./pages/framework.js";
import * as m_pages_logs from "./pages/logs.js";
import * as m_pages_about from "./pages/about.js";
import * as m_pages_api_routes from "./pages/api-routes.js";
import * as m_pages_permissions from "./pages/permissions.js";
import * as m_pages_files from "./pages/files.js";
import * as m_pages_cluster from "./pages/cluster.js";
import * as m_pages_topology from "./pages/topology.js";

const __namespaces = [
  m_core_state,
  m_core_api,
  m_core_i__n,
  m_core_utils,
  m_core_themepack,
  m_components_modal,
  m_components_toast,
  m_components_popover,
  m_components_ep_select,
  m_components_tabs,
  m_components_kv,
  m_components_tasks,
  m_components_update_hint,
  m_components_install_guide,
  m_components_search_palette,
  m_components_onboarding_card,
  m_components_status_icon,
  m_components_ws_inspector,
  m_core_router,
  m_core_moduleviews,
  m_core_auth,
  m_core_ws,
  m_pages_appearance,
  m_pages_settings,
  m_pages_dashboard,
  m_pages_events,
  m_pages_bots,
  m_pages_modules,
  m_pages_store,
  m_pages_packages,
  m_pages_config,
  m_pages_component_config,
  m_pages_framework,
  m_pages_logs,
  m_pages_about,
  m_pages_api_routes,
  m_pages_permissions,
  m_pages_files,
  m_pages_cluster,
  m_pages_topology,
];
for (const ns of __namespaces) Object.assign(window, ns);

 
(function () {
  applyTheme(getTheme());
  applyUiStyle(getUiStyle());
  applyOled(getOled());
  applyFont(getFont());
  applyI18n();
  applyCustomTheme();
   
  themepackRestore();
  applyFullCustomTheme();
  applyAnimStyle(getAnimStyle());
   
  var savedTitle = getSetting("dash_title", "");
  var effectiveTitle = savedTitle || "ErisPulse Dashboard";
  var titleEl = document.getElementById("appTitle");
  if (titleEl) titleEl.textContent = effectiveTitle;
  document.title = effectiveTitle;
  var sbTitleEl = document.getElementById("sidebarPageTitle");
  if (sbTitleEl) sbTitleEl.textContent = effectiveTitle;
  updateNodeSelectorUI();
  const collapsedSetting = localStorage.getItem("ep_sidebar_collapsed");
   
  const isCollapsed =
    collapsedSetting === null ? true : collapsedSetting === "true";
  if (isCollapsed && window.innerWidth > 768)
    document.getElementById("sidebar").classList.add("collapsed");
  updateNodeSelectorVisibility();
  restoreNavGroupStates();
   
  var splashEl = document.getElementById("splash");
  var _splashReady = false;
  var _splashDismissed = false;
   
  setTimeout(function () { _splashReady = true; if (_splashDismissed) dismissSplash(); }, 1200);
  function dismissSplash() {
    _splashDismissed = true;
    if (!_splashReady || !splashEl) return;
    splashEl.classList.add("hide");
     
    setTimeout(function () { if (splashEl) splashEl.remove(); }, 600);
  }
  const tk = localStorage.getItem(TK);
  if (tk) {
    fetch(API + "/api/auth/status", {
      headers: { Authorization: "Bearer " + tk },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d && d.authenticated) {
          authed = true;
          document.querySelector(".app").classList.add("authed");
          dismissSplash();
           
          loadAll();
           
          restoreUpdateHint();
          wsConnect();
          restartRefreshTimer();
          loadClusterNodes();
          loadGlobalAppearance();
          applyDefaultPageOnLogin();
        } else {
          localStorage.removeItem(TK);
          dismissSplash();
          showLogin();
        }
      })
      .catch(() => {
        dismissSplash();
        showLogin();
      });
  } else {
    dismissSplash();
    showLogin();
  }
  initMirrorSelects();
  const dz = document.getElementById("uploadDropZone");
  if (dz) {
    dz.addEventListener("dragover", function (e) {
      e.preventDefault();
      this.classList.add("drag-over");
    });
    dz.addEventListener("dragleave", function (e) {
      this.classList.remove("drag-over");
    });
    dz.addEventListener("drop", function (e) {
      e.preventDefault();
      this.classList.remove("drag-over");
      if (e.dataTransfer.files[0]) processUploadFile(e.dataTransfer.files[0]);
    });
  }
})();
