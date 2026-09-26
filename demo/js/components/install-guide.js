 
 
 

var IG_DEBOUNCE_MS = 2000;
var _igQueue = [];
var _igTimer = null;

 
export function queueInstallGuide(name, kind) {
  if (!name || !authed) return;
  var key = kind + ":" + name;
  for (var i = 0; i < _igQueue.length; i++) if (_igQueue[i].key === key) return;
  _igQueue.push({ key: key, name: name, kind: kind });
  if (_igTimer) clearTimeout(_igTimer);
  _igTimer = setTimeout(_flushInstallGuide, IG_DEBOUNCE_MS);
}

async function _flushInstallGuide() {
  _igTimer = null;
  var pending = _igQueue.splice(0, _igQueue.length);
  if (!pending.length) return;

   
  var configurable = [];
  for (var i = 0; i < pending.length; i++) {
    var it = pending[i];
    var ok = false;
    if (it.kind === "adapter") {
      var d = await api(
        "/api/adapter/" + encodeURIComponent(it.name) + "/config",
      );
      ok = !!(d && !d.error && (d.has_config || d.has_accounts));
    } else {
      var d2 = await api(
        "/api/module/" + encodeURIComponent(it.name) + "/config",
      );
      ok = !!(d2 && !d2.error && d2.has_config);
    }
    if (ok) {
      configurable.push(it);
    } else if (it.kind === "adapter") {
       
      toast(t("adapter_installed_toast").replace("{name}", it.name), "ok");
    }
     
  }
  if (!configurable.length) return;

  var text;
  if (configurable.length === 1) {
    text = t("install_guide_single").replace("{name}", esc(configurable[0].name));
  } else {
     
    var igLang = localStorage.getItem("ep_lang") || "zh";
    var joiner = igLang === "en" || igLang === "ru" ? ", " : "、";
    var names = configurable
      .map(function (c) {
        return "<strong>" + esc(c.name) + "</strong>";
      })
      .join(joiner);
    text = t("install_guide_multi") + "<br>" + names;
  }
  var actions = [{ label: t("install_guide_later"), value: null }];
  configurable.forEach(function (c, idx) {
    actions.push({
      label: t("install_guide_config_btn").replace("{name}", c.name),
      value: idx,
      primary: idx === 0,
    });
  });
  var pick = await showModal(t("install_guide_title"), text, actions);
  if (pick == null) {
     
    toast(t("install_guide_later_hint"), "");
    return;
  }
  var target = configurable[pick];
  if (target) gotoComponentConfig(target.kind, target.name);
}

 
export function gotoComponentConfig(kind, name) {
  if (!authed) return showLogin();
  _igQueue = _igQueue.filter(function (q) {
    return !(q.kind === kind && q.name === name);
  });
  if (kind === "module") _moduleConfigCurrent = name;
  else _adapterConfigCurrent = name;
  go("adapter");
  var btn = document.querySelector(
    '[data-tab="' + (kind === "module" ? "cfg-module" : "cfg-adapter") + '"]',
  );
  if (btn) btn.click();
}
