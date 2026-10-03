 
 
 
 

var ONBOARDING_KEY = "ep_onboarding_done";
var _onbLastAdapters = null;

var ONBOARDING_CHECK_SVG =
  '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
var ONBOARDING_CLOSE_SVG =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

export function isOnboardingDismissed() {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch (e) {
    return false;
  }
}

export function dismissOnboarding() {
  try {
    localStorage.setItem(ONBOARDING_KEY, "1");
  } catch (e) {}
  var el = document.getElementById("onboardingCard");
  if (el) el.innerHTML = "";
}

 
export function dismissOnboardingWithUndo() {
  dismissOnboarding();
  toastUndo(t("onboarding_hidden"), function () {
    try {
      localStorage.removeItem(ONBOARDING_KEY);
    } catch (e) {}
    updateOnboardingCard(_onbLastAdapters || {});
  });
}

 
export function updateOnboardingCard(adapters) {
  _onbLastAdapters = adapters || {};
  var host = document.getElementById("onboardingCard");
  if (!host) return;
  if (isOnboardingDismissed()) {
    host.innerHTML = "";
    return;
  }
  var list = Object.keys(adapters || {}).map(function (k) {
    return adapters[k];
  });
  var hasAdapter = list.length > 0;
  var hasAccount = list.some(function (a) {
    return Object.keys(a.bots || {}).length > 0;
  });
  var hasOnline = list.some(function (a) {
    return Object.keys(a.bots || {}).some(function (b) {
      return (a.bots[b] || {}).status === "online";
    });
  });
   
  var cfgStatus = window._adapterConfigStatus || {};
  var needCfg = Object.keys(cfgStatus).filter(function (p) {
    return cfgStatus[p] === "unconfigured" || cfgStatus[p] === "incomplete";
  });
  var cfgDone = hasAdapter ? needCfg.length === 0 : true;
  if (hasAdapter && hasAccount && hasOnline && cfgDone) {
     
    if (host.querySelector(".onboarding-card"))
      toast(t("onboarding_congrats"), "ok");
    dismissOnboarding();
    return;
  }

  var steps = [
    {
      done: hasAdapter,
      label: t("onboarding_step1"),
      cta: t("store"),
      page: "store",
    },
    {
      done: hasAccount,
       
      label: t("onboarding_step2"),
      cta: hasAdapter ? t("goto_config") : "",
      page: "adapter",
    },
  ];
  if (hasAdapter) {
    steps.push({
      done: cfgDone,
      label: needCfg.length
        ? t("onboarding_step_cfg").replace("{n}", String(needCfg.length))
        : t("onboarding_step_cfg"),
      cta: hasAdapter ? t("goto_config") : "",
      page: "adapter",
    });
  }
  steps.push({
    done: hasOnline,
    label: t("onboarding_step3"),
    cta: "",
    page: "",
  });
  var remaining = steps.filter(function (s) {
    return !s.done;
  }).length;
  var stepsHtml = steps
    .map(function (s, i) {
      return (
        '<div class="onboarding-step' +
        (s.done ? " done" : "") +
        '">' +
        '<span class="onboarding-check">' +
        (s.done ? ONBOARDING_CHECK_SVG : i + 1) +
        "</span>" +
        '<span class="onboarding-step-label">' +
        esc(s.label) +
        "</span>" +
        (s.done || !s.cta
          ? ""
          : '<button class="btn btn-secondary btn-xs" onclick="go(\'' +
            s.page +
            '\')">' +
            esc(s.cta) +
            "</button>") +
        "</div>"
      );
    })
    .join("");

  host.innerHTML =
    '<div class="onboarding-card">' +
    '<div class="onboarding-head">' +
    '<div class="onboarding-head-texts">' +
    '<span class="onboarding-title">' +
    esc(t("onboarding_title")) +
    '</span><span class="onboarding-sub">' +
    esc(t("onboarding_subtitle")) +
    "</span>" +
    "</div>" +
    '<button class="btn-icon onboarding-close" data-i18n-title="onboarding_never" title="' +
    esc(t("onboarding_never")) +
    '" onclick="dismissOnboardingWithUndo()">' +
    ONBOARDING_CLOSE_SVG +
    "</button>" +
    "</div>" +
    '<div class="onboarding-steps">' +
    stepsHtml +
    "</div>" +
    '<div class="onboarding-foot">' +
    esc(t("onboarding_progress").replace("{n}", remaining)) +
    "</div>" +
    "</div>";
}
