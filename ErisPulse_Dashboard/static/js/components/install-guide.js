// ErisPulse Dashboard – components/install-guide
// 安装完成后的配置引导：聚合新装的适配器/模块，弹窗询问是否立即配置；
// 同时提供 gotoComponentConfig 供模块管理页"去配置"按钮复用（跨页预选跳转）

var IG_DEBOUNCE_MS = 2000;
var _igQueue = [];
var _igTimer = null;

// ws 收到安装广播后调用：kind "adapter" | "module"
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

  // 逐个检查是否声明了配置（ConfigClass / AccountConfigClass）
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
      // 适配器装完目前没有任何完成反馈，无配置项时补一条 toast
      toast(t("adapter_installed_toast").replace("{name}", it.name), "ok");
    }
    // 无配置的模块：ws.js 已 toast 动态加载提示，不再打扰
  }
  if (!configurable.length) return;

  var text;
  if (configurable.length === 1) {
    text = t("install_guide_single").replace("{name}", esc(configurable[0].name));
  } else {
    // 分隔符按语言习惯：中日文用顿号，其余用逗号
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
    // 别让引导一闪而过就杳无音讯：告诉用户之后去哪里继续
    toast(t("install_guide_later_hint"), "");
    return;
  }
  var target = configurable[pick];
  if (target) gotoComponentConfig(target.kind, target.name);
}

// 预选并跳转到组件配置页（安装引导与模块管理页"去配置"共用入口）
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
