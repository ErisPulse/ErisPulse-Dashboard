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

async function _awAccountSchema(platform) {
  var d = await api("/api/adapter/" + encodeURIComponent(platform) + "/accounts");
  return (d && d.schema) || null;
}

// 手动步骤表单：账户名 + 必填字段（schema required 且无默认值）
function _awManualForm(platform, schema) {
  var fields = "";
  if (schema && schema.fields) {
    Object.entries(schema.fields).forEach(function (en) {
      var fname = en[0],
        fs = en[1] || {};
      if (fname === "enabled" || fname === "name") return;
      var required = !!fs.required;
      var hasDefault = fs.default !== undefined && fs.default !== "" && fs.default !== null;
      if (!required || hasDefault) return;
      var type = fs.secret || fs.widget === "password" ? "password" : "text";
      fields +=
        '<label class="aw-field"><span>' +
        esc(fname) +
        (required ? ' <i style="color:var(--er-c)">*</i>' : "") +
        '</span><input class="fw-input" type="' +
        type +
        '" data-aw-field="' +
        esc(fname) +
        '" autocomplete="new-password"></label>';
    });
  }
  return (
    '<div class="aw-form">' +
    '<label class="aw-field"><span>' +
    esc(t("account_name")) +
    ' <i style="color:var(--er-c)">*</i></span><input class="fw-input" type="text" id="awAccountName"></label>' +
    fields +
    "</div>"
  );
}

async function _awSubmitManual(platform, box) {
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
  if (d.accounts[name] !== undefined) {
    toast(t("account_wizard_name_exists"), "er");
    return false;
  }
  var account = { enabled: true, name: "" };
  box.querySelectorAll("[data-aw-field]").forEach(function (inp) {
    account[inp.dataset.awField] = inp.value;
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
      _awAccountSchema(platform).then(function (schema) {
        body.innerHTML = _awManualForm(platform, schema);
        var first = body.querySelector("input");
        if (first) first.focus();
      });
      foot.innerHTML =
        '<button class="btn btn-secondary" data-aw-back>' +
        esc(t("account_wizard_back")) +
        '</button><button class="btn btn-primary" data-aw-next>' +
        esc(t("account_wizard_create")) +
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
    var ok = await _awSubmitManual(platform, body);
    if (ok) _awRender(ov, platform, 3, sections, ctx.chosen, ctx);
  });
}

/**
 * 打开账户添加向导。
 * @returns Promise<boolean> 用户是否完成添加（true 时调用方应刷新配置页）
 */
export async function openAccountWizard(platform) {
  var sections = [];
  try {
    sections = await _awSections(platform);
  } catch (e) {}

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
