// ErisPulse Dashboard – 入口
// 模块按依赖顺序求值；随后将全部导出挂载到 window，供内联 onclick 与跨模块调用

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
import * as m_components_subnav from "./components/subnav.js";
import * as m_components_account_wizard from "./components/account-wizard.js";
import * as m_components_kv from "./components/kv.js";
import * as m_components_tasks from "./components/tasks.js";
import * as m_components_update_hint from "./components/update-hint.js";
import * as m_components_lang_hint from "./components/lang-hint.js";
import * as m_components_install_guide from "./components/install-guide.js";
import * as m_components_search_palette from "./components/search-palette.js";
import * as m_components_onboarding_card from "./components/onboarding-card.js";
import * as m_components_first_run from "./components/first-run-setup.js";import * as m_components_status_icon from "./components/status-icon.js";
import * as m_components_ws_inspector from "./components/ws-inspector.js";
import * as m_core_router from "./core/router.js";
import * as m_core_moduleviews from "./core/moduleviews.js";
import * as m_core_auth from "./core/auth.js";
import * as m_core_ws from "./core/ws.js";
import * as m_core_drag_scroll from "./core/drag-scroll.js";
import * as m_core_viewer_guard from "./core/viewer-guard.js";
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
  m_components_subnav,
  m_components_account_wizard,
  m_components_kv,
  m_components_tasks,
  m_components_update_hint,
  m_components_lang_hint,
  m_components_install_guide,
  m_components_search_palette,
  m_components_onboarding_card,
  m_components_status_icon,
  m_components_ws_inspector,
  m_core_router,
  m_core_moduleviews,
  m_core_auth,
  m_core_ws,
  m_core_drag_scroll,
  m_core_viewer_guard,
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

// ── 启动语句──
(function () {
  applyTheme(getTheme());
  applyUiStyle(getUiStyle());
  applyOled(getOled());
  applyFont(getFont());
  // 触屏/VNC 拖拽滚动（默认开启，ep_touch_scroll: on/off）
  if (typeof initDragScroll === "function") initDragScroll();
  applyI18n();
  applyCustomTheme();
  // 用户主题包（上传的自定义 CSS 皮肤）
  themepackRestore();
  applyFullCustomTheme();
  applyAnimStyle(getAnimStyle());
  // Dashboard 版本回声：捕获绕过商店的手动 pip 安装（无升级广播），提示重启模块
  api("/api/status")
    .then(function (d) {
      if (d && d.dashboard_version)
        m_components_update_hint.echoDashboardVersion(d.dashboard_version);
    })
    .catch(function () {});
  // 首次进入：三步初始设置（语言 / 默认镜像源 / 页面导览），完成或跳过后不再弹出
  setTimeout(function () {
    m_components_first_run.maybeShowFirstRunSetup();
  }, 1500);
  // 滚动条显隐档位（防 FOUC：与主题同批挂载）
  if (typeof applyScrollbarMode === "function") applyScrollbarMode(getScrollbarMode());
  // 恢复保存的仪表盘标题（联动：appTitle / 标签页 / 侧边栏头部三者一致）
  var savedTitle = getSetting("dash_title", "");
  var effectiveTitle = savedTitle || "ErisPulse Dashboard";
  var titleEl = document.getElementById("appTitle");
  if (titleEl) titleEl.textContent = effectiveTitle;
  document.title = effectiveTitle;
  var sbTitleEl = document.getElementById("sidebarPageTitle");
  if (sbTitleEl) sbTitleEl.textContent = effectiveTitle;
  updateNodeSelectorUI();
  const collapsedSetting = localStorage.getItem("ep_sidebar_collapsed");
  // 默认收起侧边栏（首次使用或无设置时）
  const isCollapsed =
    collapsedSetting === null ? true : collapsedSetting === "true";
  // ≤1023px 为抽屉模式，不启用收起态
  if (isCollapsed && window.innerWidth > 1023)
    document.getElementById("sidebar").classList.add("collapsed");
  updateNodeSelectorVisibility();
  restoreNavGroupStates();
  // 启动画面在首次显示登录或仪表盘时消失
  var splashEl = document.getElementById("splash");
  var _splashReady = false;
  var _splashDismissed = false;
  // 保底时长与 splash 文字编排（dots 于 0.85s+0.4s 完成）对齐，此后即可揭示
  setTimeout(function () { _splashReady = true; if (_splashDismissed) dismissSplash(); }, 1200);
  function dismissSplash() {
    _splashDismissed = true;
    if (!_splashReady || !splashEl) return;
    splashEl.classList.add("hide");
    // 与 overrides.css 的 splashBubblePop 0.45s 对齐：动画播完再移除节点
    setTimeout(function () { if (splashEl) splashEl.remove(); }, 600);
  }
  const tk = localStorage.getItem(TK);
  if (tk) {
    // 启动鉴权带 8s 超时（超时重试一次），后端繁忙时不再无限转 splash
    const authStatus = (signal) =>
      fetch(API + "/api/auth/status", {
        headers: { Authorization: "Bearer " + tk },
        signal,
      });
    const boot = () => {
      authed = true;
      document.querySelector(".app").classList.add("authed");
      // 只读密钥：隐藏无权导航项（页面级白名单）
      if (typeof applyNavGuard === "function") applyNavGuard();
      dismissSplash();
      loadAll();
      // 恢复上次更新重载引导（如更新后刷新了页面）
      restoreUpdateHint();
      checkFrameworkLangSync();
      wsConnect();
      restartRefreshTimer();
      loadClusterNodes();
      applyDefaultPageOnLogin();
    };
    const fail = () => {
      localStorage.removeItem(TK);
      dismissSplash();
      showLogin();
    };
    let ctl = new AbortController();
    let timer = setTimeout(() => ctl.abort(), 8000);
    authStatus(ctl.signal)
      .then((r) => {
        clearTimeout(timer);
        return r.json();
      })
      .then((d) => {
        if (d && d.authenticated) {
          setAccess(d.role, d.pages);
          boot();
        } else fail();
      })
      .catch(() => {
        clearTimeout(timer);
        // 超时/网络抖动重试一次，仍失败则进入登录页（可手动重试）
        ctl = new AbortController();
        timer = setTimeout(() => ctl.abort(), 8000);
        authStatus(ctl.signal)
          .then((r) => {
            clearTimeout(timer);
            return r.json();
          })
          .then((d) => {
            if (d && d.authenticated) {
              setAccess(d.role, d.pages);
              boot();
            } else fail();
          })
          .catch(() => {
            clearTimeout(timer);
            dismissSplash();
            showLogin();
          });
      });
  } else {
    dismissSplash();
    showLogin();
  }
  initMirrorSelects();
  // ── 折叠态侧栏导航滚动裁剪切换：内容放得下保持 overflow visible（折叠气泡可探出），
  // 放不下切内部滚动——footer 吸底，折叠按钮不因高度不足被推出视口 ──
  (function () {
    var nav = null;
    function update() {
      if (!nav) nav = document.querySelector(".sidebar-nav");
      if (!nav) return;
      if (nav.scrollHeight > nav.clientHeight + 2) nav.classList.add("is-scrollable");
      else nav.classList.remove("is-scrollable");
    }
    window.addEventListener("resize", update);
    var sb = document.getElementById("sidebar");
    var navEl = document.querySelector(".sidebar-nav");
    if (window.MutationObserver) {
      if (sb)
        new MutationObserver(update).observe(sb, {
          attributes: true,
          attributeFilter: ["class"],
        });
      if (navEl)
        new MutationObserver(function () {
          setTimeout(update, 50);
        }).observe(navEl, { childList: true, subtree: true });
    }
    setTimeout(update, 300);
    setTimeout(update, 1500);
  })();
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
