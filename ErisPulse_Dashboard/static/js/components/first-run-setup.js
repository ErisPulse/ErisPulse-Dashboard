// ErisPulse Dashboard – components/first-run-setup
// 首次进入的三步初始设置：界面语言 → 默认 PyPI 镜像源 → 主要页面导览。
// 完成后写 localStorage(ep_setup_done)，不再弹出；关闭视为跳过（可在设置页随时再改）。
// 全程不阻塞：登录态确立 1.5s 后检查触发（见 main.js）。

var SETUP_DONE_KEY = "ep_setup_done";
var _frShown = false;

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

// 导览页（label 用现有页面标题 i18n 键；page 为 go() 路由名）
var TOUR_PAGES = [
  { page: "dashboard", labelKey: "dashboard" },
  { page: "event-stream", labelKey: "event_stream" },
  { page: "component-config", labelKey: "adapter_config" },
  { page: "config", labelKey: "fw_config" },
  { page: "store", labelKey: "module_store" },
  { page: "logs", labelKey: "logs" },
];

function frEl(html) {
  var d = document.createElement("div");
  d.innerHTML = html.trim();
  return d.firstChild;
}

function frFinish() {
  try {
    localStorage.setItem(SETUP_DONE_KEY, "1");
  } catch (e) {}
  var el = document.getElementById("firstRunSetup");
  if (el) el.remove();
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
          '<button class="fr-tour-card" onclick="frClose();go(\'' +
          p.page +
          "')\">" +
          esc(t(p.labelKey)) +
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' +
          "</button>"
        );
      }).join("") +
      "</div>";
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

  ov.querySelector("[data-fr-skip]").onclick = function () {
    frFinish();
  };
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
    }
    frRender(step + 1, ctx);
  };
}
