// ErisPulse Dashboard – components/first-run-setup
// 首次进入的三步初始设置：界面语言 → 默认 PyPI 镜像源 → 主要页面导览。
// 导览两种方式：点击卡片直接进入，或逐步聚光高亮侧边栏项（可点高亮项直接跳转）。
// 完成后写 localStorage(ep_setup_done)，不再弹出；关闭视为跳过（可在设置页随时再改）。
// 全程不阻塞：登录态确立 1.5s 后检查触发（见 main.js）。

var SETUP_DONE_KEY = "ep_setup_done";
var _frShown = false;
var _frTourIdx = -1;
var _frReposition = null;

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

// 导览站点：page 为 go() 路由名，sel 为侧边栏导航项（聚光目标），文案复用现有导航键
var TOUR_PAGES = [
  {
    page: "dashboard",
    sel: '[data-page="dashboard"]',
    labelKey: "dashboard",
    descKey: "dashboard_desc",
  },
  {
    page: "event-stream",
    sel: '[data-page="event-stream"]',
    labelKey: "event_stream",
    descKey: "events_desc",
  },
  {
    page: "adapter",
    sel: '[data-page="adapter"]',
    labelKey: "adapter_config",
    descKey: "adapter_config_desc",
  },
  {
    page: "config",
    sel: '[data-page="config"]',
    labelKey: "config",
    descKey: "config_desc",
  },
  {
    page: "store",
    sel: '[data-page="store"]',
    labelKey: "store",
    descKey: "store_desc",
  },
  {
    page: "logs",
    sel: '[data-page="logs"]',
    labelKey: "sys_logs",
    descKey: "logs_desc",
  },
];

function frEl(html) {
  var d = document.createElement("div");
  d.innerHTML = html.trim();
  return d.firstChild;
}

// 收尾：移除弹窗与聚光层，解绑监听
function frTeardown() {
  var el = document.getElementById("firstRunSetup");
  if (el) el.remove();
  var sp = document.getElementById("frSpot");
  if (sp) sp.remove();
  if (_frReposition) {
    window.removeEventListener("resize", _frReposition);
    window.removeEventListener("scroll", _frReposition, true);
    _frReposition = null;
  }
  _frTourIdx = -1;
}

function frFinish() {
  try {
    localStorage.setItem(SETUP_DONE_KEY, "1");
  } catch (e) {}
  frTeardown();
}

// 触发检查：已登录、未完成过设置时弹窗（main.js 启动序列调用）
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
      return;
    }
    frRender(step + 1, ctx);
  };
}

// 聚光导览：隐藏向导弹窗，逐站高亮侧边栏项并浮出说明
function frStartTour() {
  var wiz = document.getElementById("firstRunSetup");
  if (wiz) wiz.remove();
  var ov = frEl(
    '<div class="fr-spot" id="frSpot">' +
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
  frTourGo(0);
}

function frTourGo(i) {
  _frTourIdx = i;
  var st = TOUR_PAGES[i];
  var el = document.querySelector(st.sel);
  if (el) {
    var r = el.getBoundingClientRect();
    if (r.width > 0 && (r.top < 0 || r.bottom > window.innerHeight)) {
      el.scrollIntoView({ block: "center" });
    }
  }
  var last = i === TOUR_PAGES.length - 1;
  var tip = document.getElementById("frSpotTip");
  tip.innerHTML =
    '<div class="fr-spot-step">' +
    i + 1 + " / " + TOUR_PAGES.length +
    "</div>" +
    '<div class="fr-spot-title">' +
    esc(t(st.labelKey)) +
    "</div>" +
    '<div class="fr-spot-desc">' +
    esc(t(st.descKey)) +
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
}

// 定位：洞对齐导航项，浮窗贴其右侧（放不下换左侧），随滚动/缩放跟随
function frTourPlace() {
  var i = _frTourIdx;
  if (i < 0) return;
  var st = TOUR_PAGES[i];
  var hole = document.getElementById("frSpotHole");
  var tip = document.getElementById("frSpotTip");
  if (!hole || !tip) return;
  var el = document.querySelector(st.sel);
  var r = el ? el.getBoundingClientRect() : null;
  if (!r || r.width === 0) {
    // 目标不可见（如窄屏侧边栏收起）：整屏压暗，浮窗居中
    hole.style.opacity = "0";
    tip.style.left = Math.max(12, (window.innerWidth - 300) / 2) + "px";
    tip.style.top = "18vh";
    return;
  }
  var pad = 6;
  hole.style.opacity = "1";
  hole.style.top = r.top - pad + "px";
  hole.style.left = r.left - pad + "px";
  hole.style.width = r.width + pad * 2 + "px";
  hole.style.height = r.height + pad * 2 + "px";
  var tw = tip.offsetWidth || 300;
  var th = tip.offsetHeight || 170;
  var left = r.right + 14;
  if (left + tw > window.innerWidth - 12) left = r.left - tw - 14;
  left = Math.max(12, Math.min(left, window.innerWidth - tw - 12));
  var top = r.top + r.height / 2 - th / 2;
  top = Math.max(12, Math.min(top, window.innerHeight - th - 12));
  tip.style.left = left + "px";
  tip.style.top = top + "px";
}
