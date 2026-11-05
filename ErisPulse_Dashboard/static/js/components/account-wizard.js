// ErisPulse Dashboard – components/account-wizard
// 通用账户添加向导：方式选择（手动 / 适配器注册的扩展区）→ 配置 → 完成。
// 扩展区（section）由适配器侧 sdk.Dashboard.register_section(target="account_wizard")
// 注册自包含 HTML，向导以 iframe srcdoc 渲染；section 通过 postMessage 通知结果：
//   parent.postMessage({ type: "ep_section_done", success: true, message: "..." }, "*")
// section 内可 fetch 同源 Dashboard API（携带 localStorage token 的 Bearer 头）。

var _awCleanup = null;

function _awEl(html) {
  var d = document.createElement("div");
  d.innerHTML = html.trim();
  return d.firstChild;
}

function _awCard(icon, title, desc) {
  return (
    '<button class="aw-card" type="button">' +
    '<span class="aw-card-icon">' +
    (icon ||
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>') +
    "</span>" +
    '<span class="aw-card-texts"><span class="aw-card-title">' +
    esc(title) +
    '</span><span class="aw-card-desc">' +
    esc(desc) +
    "</span></span>" +
    '<svg class="aw-card-arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' +
    "</button>"
  );
}

async function _awSections(platform) {
  var d = await api(
    "/api/dashboard/sections?target=account_wizard&platform=" +
      encodeURIComponent(platform),
  );
  return (d && d.sections) || [];
}

async function _awLoadAccounts(platform) {
  var d = await api("/api/adapter/" + encodeURIComponent(platform) + "/accounts");
  return (d && d.accounts) || {};
}

async function _awAccountSchema(platform) {
  var d = await api("/api/adapter/" + encodeURIComponent(platform) + "/accounts");
  return (d && d.schema) || null;
}

// 手动配置表单：账户名 + schema 自适应字段（复用组件配置页控件：select/密码/开关等；
// 容器带绑定根，show_if 显隐随选择实时联动）
function _awManualForm(platform, schema, ctx) {
  var fieldsHtml = "";
  if (schema && schema.fields) {
    var items = Object.entries(schema.fields).sort(function (a, b) {
      var oa = (a[1] || {}).order || 100,
        ob = (b[1] || {}).order || 100;
      return oa - ob;
    });
    for (var i = 0; i < items.length; i++) {
      var fname = items[i][0],
        fschema = items[i][1] || {};
      if (fname === "enabled" || fname === "name") continue;
      var fval =
        ctx && ctx.values && ctx.values[fname] !== undefined
          ? ctx.values[fname]
          : fschema.default;
      fieldsHtml += renderAdapterConfigField(
        fname,
        fschema,
        fval,
        "aw." + platform,
        { fieldSave: false, bindValues: (ctx && ctx.values) || {} },
      );
    }
  }
  return (
    '<div class="aw-form" data-cfgbind-root data-cfgbind-prefix="aw.' +
    esc(platform) +
    '">' +
    '<label class="aw-field"><span>' +
    esc(t("account_name")) +
    ' <i style="color:var(--er-c)">*</i></span><input class="fw-input" type="text" id="awAccountName" value="' +
    esc((ctx && ctx.editAccount) || "") +
    '"></label>' +
    fieldsHtml +
    "</div>"
  );
}

async function _awSubmitManual(platform, box, ctx) {
  var name = (box.querySelector("#awAccountName") || {}).value || "";
  name = name.trim();
  if (!name) {
    toast(t("account_wizard_name_invalid"), "er");
    return false;
  }
  var d = await api("/api/adapter/" + encodeURIComponent(platform) + "/accounts");
  if (!d || !d.accounts) {
    toast(t("save_failed"), "er");
    return false;
  }
  var isEdit = name === (ctx && ctx.editAccount);
  if (d.accounts[name] !== undefined && !isEdit) {
    toast(t("account_wizard_name_exists"), "er");
    return false;
  }
  var account = isEdit && d.accounts[name] ? d.accounts[name] : { enabled: true, name: "" };
  var awPrefix = "aw." + platform + ".";
  box.querySelectorAll("[data-ackey]").forEach(function (inp) {
    var key = inp.dataset.ackey || "";
    if (key.indexOf(awPrefix) !== 0) return;
    var fname = key.slice(awPrefix.length);
    if (!fname || fname.indexOf(".") !== -1) return;
    var tp = inp.dataset.adapterTp || "string";
    var val = inp.type === "checkbox" ? inp.checked : inp.value;
    if (tp === "number" || tp === "integer" || tp === "float") val = Number(val);
    else if (tp === "object") {
      try {
        val = JSON.parse(val);
      } catch (e) {
        return;
      }
    }
    account[fname] = val;
  });
  d.accounts[name] = account;
  var result = await api(
    "/api/adapter/" + encodeURIComponent(platform) + "/accounts",
    { method: "PUT", body: JSON.stringify({ accounts: d.accounts }) },
  );
  if (result && result.success) {
    toast(t("account_wizard_created") + ": " + name, "ok");
    return true;
  }
  toast(t("save_failed") + ": " + ((result && result.error) || ""), "er");
  return false;
}

function _awRender(ov, platform, step, sections, chosen, ctx) {
  var box = ov.querySelector(".aw-box");
  var body = box.querySelector(".aw-body");
  var foot = box.querySelector(".aw-foot");

  // 步骤指示
  var steps = box.querySelector(".aw-steps");
  if (sections.length) {
    steps.style.display = "";
    steps.innerHTML =
      '<span class="' + (step >= 1 ? "on" : "") + '">1 · ' +
      esc(t("account_wizard_step_mode")) +
      '</span><span class="' + (step >= 2 ? "on" : "") + '">2 · ' +
      esc(t("account_wizard_step_config")) +
      '</span><span class="' + (step >= 3 ? "on" : "") + '">3 · ' +
      esc(t("account_wizard_step_done")) +
      "</span>";
  } else {
    steps.style.display = "none";
  }

  if (step === 1) {
    var cards = _awCard("", t("account_wizard_manual"), t("account_wizard_manual_desc"));
    sections.forEach(function (sec) {
      cards += _awCard(
        sec.icon_svg || "",
        sec.title || sec.title_en || sec.id,
        t("account_wizard_section_desc"),
      );
    });
    body.innerHTML = '<div class="aw-cards">' + cards + "</div>";
    var btns = body.querySelectorAll(".aw-card");
    btns[0].onclick = function () {
      ctx.chosen = "manual";
      _awRender(ov, platform, 2, sections, "manual", ctx);
    };
    sections.forEach(function (sec, i) {
      btns[i + 1].onclick = function () {
        ctx.chosen = sec;
        _awRender(ov, platform, 2, sections, sec, ctx);
      };
    });
    foot.innerHTML =
      '<button class="btn btn-secondary" data-aw-cancel>' +
      esc(t("cancel")) +
      "</button>";
  } else if (step === 2) {
    if (chosen === "manual") {
      Promise.all([_awAccountSchema(platform), _awLoadAccounts(platform)]).then(function (rs) {
        ctx.values = (rs[1] && rs[1][ctx.editAccount]) || {};
        body.innerHTML = _awManualForm(platform, rs[0], ctx);
        var first = body.querySelector("input");
        if (first) first.focus();
      });
      foot.innerHTML =
        '<button class="btn btn-secondary" data-aw-back>' +
        esc(t("account_wizard_back")) +
        '</button><button class="btn btn-primary" data-aw-next>' +
        esc(t(ctx.editAccount ? "account_wizard_save" : "account_wizard_create")) +
        "</button>";
    } else {
      var sec = chosen;
      body.innerHTML =
        '<div class="aw-section-hint">' +
        esc(t("account_wizard_section_hint")) +
        '</div><iframe class="aw-frame" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>';
      var frame = body.querySelector(".aw-frame");
      frame.srcdoc = sec.html || "";
      ctx.onSectionMsg = function (e) {
        var d = e.data;
        if (!d || d.type !== "ep_section_done") return;
        if (d.success) {
          _awRender(ov, platform, 3, sections, chosen, ctx);
        } else if (d.message) {
          toast(String(d.message), "er");
        }
      };
      window.addEventListener("message", ctx.onSectionMsg);
      foot.innerHTML =
        '<button class="btn btn-secondary" data-aw-back>' +
        esc(t("account_wizard_back")) +
        "</button>";
    }
  } else {
    body.innerHTML =
      '<div class="aw-done"><svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="var(--ok-c)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg><div>' +
      esc(t("account_wizard_created_done")) +
      "</div></div>";
    foot.innerHTML =
      '<button class="btn btn-primary" data-aw-close>' +
      esc(t("close")) +
      "</button>";
  }

  var bind = function (sel, fn) {
    var b = foot.querySelector(sel);
    if (b) b.onclick = fn;
  };
  bind("[data-aw-cancel]", function () {
    ctx.close(false);
  });
  bind("[data-aw-close]", function () {
    ctx.close(true);
  });
  bind("[data-aw-back]", function () {
    _awRender(
      ov,
      platform,
      sections.length ? 1 : 2,
      sections,
      ctx.chosen,
      ctx,
    );
  });
  bind("[data-aw-next]", async function () {
    var ok = await _awSubmitManual(platform, body, ctx);
    if (ok) _awRender(ov, platform, 3, sections, ctx.chosen, ctx);
  });
}

/**
 * 打开账户添加向导。
 * @returns Promise<boolean> 用户是否完成添加（true 时调用方应刷新配置页）
 */
export async function openAccountWizard(platform, opts) {
  opts = opts || {};
  var sections = [];
  try {
    sections = await _awSections(platform);
    if (!sections.length) {
      await new Promise(function (r) {
        setTimeout(r, 800);
      });
      sections = await _awSections(platform);
    }
  } catch (e) {
    await new Promise(function (r) {
      setTimeout(r, 600);
    });
    try {
      sections = await _awSections(platform);
    } catch (e2) {
      console.warn(
        "[ErisPulse Dashboard] 获取账户向导扩展接入方式失败，已回退到手动配置：",
        e2,
      );
    }
  }

  if (_awCleanup) _awCleanup();
  var ov = _awEl(
    '<div class="modal-overlay show aw-overlay">' +
      '<div class="modal-box aw-box" style="max-width:560px;width:92vw">' +
      '<div class="modal-title">' +
      esc(t("account_wizard_title")) +
      " · " +
      esc(platform) +
      "</div>" +
      '<div class="aw-steps"></div>' +
      '<div class="aw-body"></div>' +
      '<div class="aw-foot"></div>' +
      "</div></div>",
  );
  document.body.appendChild(ov);

  var ctx = {
    chosen: "manual",
    editAccount: opts.editAccount || "",
    values: {},
    onSectionMsg: null,
    close: function (done) {
      if (ctx.onSectionMsg) window.removeEventListener("message", ctx.onSectionMsg);
      ov.remove();
      _awCleanup = null;
      ov._resolve(done);
    },
  };

  return new Promise(function (resolve) {
    ov._resolve = resolve;
    _awCleanup = function () {
      if (ctx.onSectionMsg) window.removeEventListener("message", ctx.onSectionMsg);
      ov.remove();
      _awCleanup = null;
      resolve(false);
    };
    ov.onclick = function (e) {
      if (e.target === ov) ctx.close(false);
    };
    document.addEventListener("keydown", function onKey(e) {
      if (e.key === "Escape" && document.body.contains(ov)) {
        document.removeEventListener("keydown", onKey, true);
        ctx.close(false);
      }
    }, true);
    // 无扩展区时跳过方式选择，直接手动配置
    _awRender(ov, platform, sections.length ? 1 : 2, sections, "manual", ctx);
  });
}
