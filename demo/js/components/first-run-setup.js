// ErisPulse Dashboard – components/first-run-setup
// 首次进入的三步初始设置：界面语言 → 默认 PyPI 镜像源 → 主要页面导览。
// 导览每页两站：先高亮侧边栏入口，再切到该页高亮主要功能区。
// 窄屏抽屉收起时自动展开侧边栏（仅导览代开的，结束时收回）。
// 完成后写 localStorage(ep_setup_done)，不再弹出；设置页“系统”里可再次运行。

var SETUP_DONE_KEY = "ep_setup_done";
var _frShown = false;
var _frSteps = [];
var _frStepIdx = -1;
var _frReposition = null;
var _frDrawerOpened = false;

var MIRRORS = [
  { v: "", label: "PyPI (Default)" },
  { v: "https://pypi.tuna.tsinghua.edu.cn/simple", label: "Tsinghua 清华" },
  { v: "https://mirrors.aliyun.com/pypi/simple/", label: "Aliyun 阿里云" },
  { v: "https://pypi.doubanio.com/simple/", label: "Douban 豆瓣" },
  {
    v: "https://repo.huaweicloud.com/repository/pypi/simple",
    label: "Huawei 华为云",
  },
];

var LANGS = [
  { v: "zh-cn", label: "简体中文" },
  { v: "zh-tw", label: "繁體中文" },
  { v: "en", label: "English" },
  { v: "ja", label: "日本語" },
  { v: "ru", label: "Русский" },
];

// 导览站点：sel 为侧边栏入口，pageSel 为该页内的主要功能区（缺失则跳过内容站）
var TOUR_PAGES = [
  {
    page: "dashboard",
    sel: '[data-page="dashboard"]',
    labelKey: "dashboard",
    descKey: "dashboard_desc",
    pageSel: "#onboardingCard, .home-section-hd",
  },
  {
    page: "event-stream",
    sel: '[data-page="event-stream"]',
    labelKey: "event_stream",
    descKey: "events_desc",
    pageSel: "#p-event-stream .pkg-tabs",
  },
  {
    page: "adapter",
    sel: '[data-page="adapter"]',
    labelKey: "adapter_config",
    descKey: "adapter_config_desc",
    pageSel: "#p-adapter .pkg-tabs",
  },
  {
    page: "config",
    sel: '[data-page="config"]',
    labelKey: "config",
    descKey: "config_desc",
    pageSel: "#p-config .pkg-tabs",
  },
  {
    page: "store",
    sel: '[data-page="store"]',
    labelKey: "store",
    descKey: "store_desc",
    pageSel: "#p-store .pkg-tabs",
  },
  {
    page: "logs",
    sel: '[data-page="logs"]',
    labelKey: "sys_logs",
    descKey: "logs_desc",
    pageSel: "#p-logs .pkg-tabs",
  },
];

function frEl(html) {
  var d = document.createElement("div");
  d.innerHTML = html.trim();
  return d.firstChild;
}

// 组站：每页「侧边栏入口 → 页面内容」
function frBuildSteps() {
  var steps = [];
  TOUR_PAGES.forEach(function (p) {
    steps.push({ type: "nav", p: p });
    if (p.pageSel) steps.push({ type: "page", p: p });
  });
  return steps;
}

function frPageStepIndex(pg) {
  for (var k = 0; k < _frSteps.length; k++) {
    if (_frSteps[k].type === "nav" && _frSteps[k].p.page === pg) return k;
  }
  return 0;
}

function frOpenDrawer() {
  var sb = document.getElementById("sidebar");
  if (!sb || sb.classList.contains("open")) return false;
  sb.classList.add("open");
  var ovEl = document.getElementById("overlay");
  if (ovEl) ovEl.classList.add("show");
  _frDrawerOpened = true;
  return true;
}

function frCloseDrawerIfOurs() {
  if (!_frDrawerOpened) return;
  var sb = document.getElementById("sidebar");
  if (sb) sb.classList.remove("open");
  var ovEl = document.getElementById("overlay");
  if (ovEl) ovEl.classList.remove("show");
  _frDrawerOpened = false;
}

// 收尾：移除弹窗与聚光层，解绑监听，收回代开的抽屉
function frTeardown() {
  var el = document.getElementById("firstRunSetup");
  if (el) el.remove();
  var sp = document.getElementById("frSpot");
  if (sp) sp.remove();
  frCloseDrawerIfOurs();
  if (_frReposition) {
    window.removeEventListener("resize", _frReposition);
    window.removeEventListener("scroll", _frReposition, true);
    _frReposition = null;
  }
  _frStepIdx = -1;
  _frSteps = [];
}

function frFinish() {
  try {
    localStorage.setItem(SETUP_DONE_KEY, "1");
  } catch (e) {}
  frTeardown();
}

// 触发检查：已登录、未完成过设置时弹窗（main.js 启动序列 / auth.js 登录成功调用）
export function maybeShowFirstRunSetup() {
  if (_frShown) return;
  var done = false;
  try {
    done = localStorage.getItem(SETUP_DONE_KEY) === "1";
  } catch (e) {}
  if (done) return;
  if (!document.querySelector(".app.authed")) return;
  _frShown = true;
  frRender(0, { lang: localStorage.getItem("ep_lang") || "zh-cn", mirror: "" });
}

// 设置页“再次引导”：清除完成标记并从头运行向导（dash.html 内联 onclick 经 window 调用）
export function runFirstRunSetup() {
  try {
    localStorage.removeItem(SETUP_DONE_KEY);
  } catch (e) {}
  frTeardown();
  _frShown = true;
  frRender(0, {
    lang: localStorage.getItem("ep_lang") || "zh-cn",
    mirror: localStorage.getItem("ep_default_mirror") || "",
  });
}
window.runFirstRunSetupWizard = runFirstRunSetup;

function frRender(step, ctx) {
  var old = document.getElementById("firstRunSetup");
  if (old) old.remove();

  var bodyHtml = "";
  if (step === 0) {
    bodyHtml =
      '<div class="fr-question">' +
      esc(t("fr_setup_lang_q")) +
      "</div>" +
      '<select id="frLang" class="fw-input">' +
      LANGS.map(function (l) {
        return (
          '<option value="' +
          l.v +
          '"' +
          (l.v === ctx.lang ? " selected" : "") +
          ">" +
          esc(l.label) +
          "</option>"
        );
      }).join("") +
      "</select>";
  } else if (step === 1) {
    bodyHtml =
      '<div class="fr-question">' +
      esc(t("fr_setup_mirror_q")) +
      '</div><div class="fr-desc">' +
      esc(t("fr_setup_mirror_desc")) +
      "</div>" +
      '<select id="frMirror" class="fw-input">' +
      MIRRORS.map(function (m) {
        return (
          '<option value="' +
          esc(m.v) +
          '"' +
          (m.v === ctx.mirror ? " selected" : "") +
          ">" +
          esc(m.label) +
          "</option>"
        );
      }).join("") +
      "</select>";
  } else if (step === 2) {
    bodyHtml =
      '<div class="fr-question">' +
      esc(t("fr_setup_tour_q")) +
      '</div><div class="fr-tour-grid">' +
      TOUR_PAGES.map(function (p) {
        return (
          '<button class="fr-tour-card" data-fr-page="' +
          p.page +
          '">' +
          esc(t(p.labelKey)) +
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' +
          "</button>"
        );
      }).join("") +
      '</div><div class="fr-tour-row"><span class="fr-desc" style="margin:0">' +
      esc(t("fr_setup_tour_hint")) +
      '</span><button class="btn btn-primary btn-sm" data-fr-tour>' +
      esc(t("fr_tour_start")) +
      "</button></div>";
  } else {
    frFinish();
    return;
  }

  var ov = frEl(
    '<div class="modal-overlay show fr-overlay" id="firstRunSetup">' +
      '<div class="modal-box fr-box">' +
      '<div class="modal-title">' +
      esc(t("fr_setup_title")) +
      "</div>" +
      '<div class="fr-steps">' +
      [0, 1, 2]
        .map(function (n) {
          return '<span class="' + (n <= step ? "on" : "") + '">' + (n + 1) + "/3</span>";
        })
        .join("") +
      "</div>" +
      '<div class="fr-body">' +
      bodyHtml +
      "</div>" +
      '<div class="fr-foot">' +
      '<button class="btn btn-secondary btn-sm" data-fr-skip>' +
      esc(t("fr_setup_skip")) +
      "</button>" +
      '<button class="btn btn-primary btn-sm" data-fr-next>' +
      esc(step === 2 ? t("fr_setup_finish") : t("fr_setup_next")) +
      "</button>" +
      "</div></div></div>"
  );
  document.body.appendChild(ov);

  ov.querySelectorAll(".fr-tour-card").forEach(function (btn) {
    btn.onclick = function () {
      var pg = btn.getAttribute("data-fr-page");
      frFinish();
      go(pg);
      // 直达后从该页的导览站继续
      _frSteps = frBuildSteps();
      frStartTour(frPageStepIndex(pg) + 1);
    };
  });
  var tourBtn = ov.querySelector("[data-fr-tour]");
  if (tourBtn) tourBtn.onclick = frStartTour;
  ov.querySelector("[data-fr-skip]").onclick = frFinish;
  ov.querySelector("[data-fr-next]").onclick = function () {
    if (step === 0) {
      var lang = ov.querySelector("#frLang").value;
      try {
        localStorage.setItem("ep_lang", lang);
        window.lang = lang;
      } catch (e) {}
      if (typeof applyI18n === "function") applyI18n();
      ctx.lang = lang;
    } else if (step === 1) {
      var mirror = ov.querySelector("#frMirror").value;
      ctx.mirror = mirror;
      // 写入后端默认镜像：所有安装/更新入口自动走该源
      api("/api/config", {
        method: "PUT",
        body: JSON.stringify({
          key: "ErisPulse_Dashboard.default_mirror",
          value: mirror,
        }),
      }).catch(function () {});
      try {
        localStorage.setItem("ep_default_mirror", mirror);
      } catch (e) {}
    } else {
      frFinish();
      frStartTour(0);
      return;
    }
    frRender(step + 1, ctx);
  };
}

// 聚光导览：逐站高亮（侧边栏入口 / 页面内容），浮窗说明
function frStartTour(startIdx) {
  var wiz = document.getElementById("firstRunSetup");
  if (wiz) wiz.remove();
  if (!_frSteps.length) _frSteps = frBuildSteps();
  var ov = frEl(
    '<div class="fr-spot" id="frSpot">' +
      '<div class="fr-spot-shield" id="frShieldTop"></div>' +
      '<div class="fr-spot-shield" id="frShieldLeft"></div>' +
      '<div class="fr-spot-shield" id="frShieldRight"></div>' +
      '<div class="fr-spot-shield" id="frShieldBottom"></div>' +
      '<div class="fr-spot-hole" id="frSpotHole"></div>' +
      '<div class="fr-spot-tip" id="frSpotTip"></div>' +
      "</div>"
  );
  document.body.appendChild(ov);
  _frReposition = function () {
    frTourPlace();
  };
  window.addEventListener("resize", _frReposition, { passive: true });
  window.addEventListener("scroll", _frReposition, true);
  frTourGo(startIdx || 0);
}

function frTourGo(i) {
  _frStepIdx = i;
  var step = _frSteps[i];
  var p = step.p;
  var isNav = step.type === "nav";
  var delay = 0;
  if (isNav) {
    // 窄屏抽屉收起时先展开侧边栏，让目标真的可见
    var navEl = document.querySelector(p.sel);
    if (navEl) {
      navEl.scrollIntoView({ block: "center" });
      var r0 = navEl.getBoundingClientRect();
      var off0 =
        r0.width === 0 ||
        r0.right <= 0 ||
        r0.left >= window.innerWidth ||
        r0.bottom <= 0 ||
        r0.top >= window.innerHeight;
      if (off0 && frOpenDrawer()) delay = 420;
    }
  } else {
    // 内容站：切到目标页；窄屏收回代开的抽屉以免挡住内容
    frCloseDrawerIfOurs();
    go(p.page, null, { force: true });
    delay = 80;
  }
  var last = i === _frSteps.length - 1;
  var tip = document.getElementById("frSpotTip");
  tip.innerHTML =
    '<div class="fr-spot-step">' +
    (i + 1) + " / " + _frSteps.length +
    "</div>" +
    '<div class="fr-spot-title">' +
    esc(t(p.labelKey)) +
    "</div>" +
    '<div class="fr-spot-desc">' +
    esc(t(isNav ? p.descKey : "fr_tour_page_desc")) +
    "</div>" +
    '<div class="fr-foot" style="margin-top:12px">' +
    '<button class="btn btn-secondary btn-sm" data-fr-exit>' +
    esc(t("fr_setup_skip")) +
    "</button>" +
    '<button class="btn btn-primary btn-sm" data-fr-next>' +
    esc(last ? t("fr_setup_finish") : t("fr_setup_next")) +
    "</button>" +
    "</div>";
  tip.querySelector("[data-fr-exit]").onclick = frFinish;
  tip.querySelector("[data-fr-next]").onclick = function () {
    if (last) frFinish();
    else frTourGo(i + 1);
  };
  tip.classList.remove("tip-in");
  void tip.offsetWidth;
  tip.classList.add("tip-in");
  requestAnimationFrame(frTourPlace);
  if (delay) setTimeout(frTourPlace, delay);
}

// 屏蔽带围出洞口：带外点击全部落在 shield 上，洞内直达目标
function frPlaceShields(top, left, width, height) {
  var vw = window.innerWidth;
  var vh = window.innerHeight;
  var conf = [
    ["frShieldTop", 0, 0, vw, Math.max(0, top)],
    ["frShieldLeft", 0, top, Math.max(0, left), height],
    ["frShieldRight", left + width, top, Math.max(0, vw - left - width), height],
    ["frShieldBottom", 0, top + height, vw, Math.max(0, vh - top - height)],
  ];
  conf.forEach(function (c) {
    var el = document.getElementById(c[0]);
    if (!el) return;
    el.style.top = c[1] + "px";
    el.style.left = c[2] + "px";
    el.style.width = c[3] + "px";
    el.style.height = c[4] + "px";
  });
}

// 定位：洞对齐目标，浮窗依次尝试右侧 → 左侧 → 下方；随滚动/缩放跟随
function frTourPlace() {
  var i = _frStepIdx;
  if (i < 0 || !_frSteps[i]) return;
  var p = _frSteps[i].p;
  var isNav = _frSteps[i].type === "nav";
  var hole = document.getElementById("frSpotHole");
  var tip = document.getElementById("frSpotTip");
  if (!hole || !tip) return;
  var el = document.querySelector(isNav ? p.sel : p.pageSel);
  var r = el ? el.getBoundingClientRect() : null;
  var spot = document.getElementById("frSpot");
  var onScreen =
    r &&
    r.width > 0 &&
    r.right > 0 &&
    r.left < window.innerWidth &&
    r.bottom > 0 &&
    r.top < window.innerHeight;
  if (!onScreen) {
    spot.classList.add("fr-spot-full");
    hole.style.opacity = "0";
    frPlaceShields(0, 0, window.innerWidth, window.innerHeight);
    tip.style.left = Math.max(12, (window.innerWidth - 300) / 2) + "px";
    tip.style.top = "18vh";
    return;
  }
  spot.classList.remove("fr-spot-full");
  var pad = 6;
  hole.style.opacity = "1";
  hole.style.top = r.top - pad + "px";
  hole.style.left = r.left - pad + "px";
  hole.style.width = r.width + pad * 2 + "px";
  hole.style.height = r.height + pad * 2 + "px";
  frPlaceShields(
    r.top - pad,
    r.left - pad,
    r.width + pad * 2,
    r.height + pad * 2
  );
  var tw = tip.offsetWidth || 300;
  var th = tip.offsetHeight || 170;
  var left, top;
  if (r.right + 14 + tw <= window.innerWidth - 12) {
    left = r.right + 14;
    top = r.top + r.height / 2 - th / 2;
  } else if (r.left - tw - 14 >= 12) {
    left = r.left - tw - 14;
    top = r.top + r.height / 2 - th / 2;
  } else if (r.bottom + 12 + th <= window.innerHeight - 12) {
    top = r.bottom + 12;
    left = Math.max(12, Math.min(r.left, window.innerWidth - tw - 12));
  } else {
    top = Math.max(12, r.top - th - 12);
    left = Math.max(12, Math.min(r.left, window.innerWidth - tw - 12));
  }
  top = Math.max(12, Math.min(top, window.innerHeight - th - 12));
  tip.style.left = left + "px";
  tip.style.top = top + "px";
}
