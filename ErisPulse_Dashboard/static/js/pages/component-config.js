// ErisPulse Dashboard – pages/component-config (auto-split from dash.js)

export async function loadAdapterConfigPage() {
  const d = await api("/api/adapters");
  if (!d) return;
  _adapterConfigPlatforms = d.adapters || [];

  const panel = document.getElementById("adapterConfigPanel");
  const empty = document.getElementById("adapterConfigEmpty");

  if (_adapterConfigPlatforms.length === 0) {
    // 没适配器 — 显示空状态 + 引导去商店安装
    if (empty) empty.style.display = "flex";
    panel.innerHTML = "";
    panel.appendChild(empty);
    var cta = document.createElement("button");
    cta.className = "empty-action";
    cta.innerHTML =
      t("store") +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>';
    cta.onclick = function () {
      go("store");
    };
    panel.appendChild(cta);
    return;
  }

  if (empty) empty.style.display = "none";

  // 创建水平适配器选择列表
  let selectorHtml = [
    '<div class="adapter-selector-bar">',
    '<div class="adapter-chip-list" id="adapterChipList">',
  ];

  _adapterConfigPlatforms.forEach((a) => {
    const isActive = a.platform === _adapterConfigCurrent;
    const cls = isActive ? " adapter-chip active" : " adapter-chip";
    const logo = adapterLogoImg(a.platform, 22) || "";
    const dotColor = a.running ? "var(--ok-c)" : "var(--tx-t)";
    const plat = esc(a.platform);
    selectorHtml.push(
      '<div class="' +
        cls +
        '" data-platform="' +
        plat +
        '" onclick="selectAdapter(\'' +
        plat +
        "')\">",
      logo,
      '<span class="adapter-chip-name">' + plat + "</span>",
      '<span class="adapter-chip-dot" style="background:' +
        dotColor +
        '"></span>',
      "</div>",
    );
  });

  selectorHtml.push("</div></div>");
  selectorHtml = selectorHtml.join("");

  // 先放选择器
  panel.innerHTML = selectorHtml;

  // 加载第一个适配器
  if (
    !_adapterConfigCurrent ||
    !_adapterConfigPlatforms.some((a) => a.platform === _adapterConfigCurrent)
  ) {
    _adapterConfigCurrent = _adapterConfigPlatforms[0].platform;
  }
  // 高亮当前选中
  document.querySelectorAll(".adapter-chip").forEach((el) => {
    el.classList.toggle(
      "active",
      el.dataset.platform === _adapterConfigCurrent,
    );
  });
  loadAdapterConfigDetail(_adapterConfigCurrent);
}

export function selectAdapter(platform) {
  _adapterConfigCurrent = platform;
  document.querySelectorAll(".adapter-chip").forEach((el) => {
    el.classList.toggle("active", el.dataset.platform === platform);
  });
  loadAdapterConfigDetail(platform);
}

export async function loadAdapterConfigDetail(platform) {
  const panel = document.getElementById("adapterConfigPanel");
  if (!panel) return;

  // 保留选择器，只替换内容区
  let container = document.getElementById("adapterConfigContent");
  if (!container) {
    container = document.createElement("div");
    container.id = "adapterConfigContent";
    panel.appendChild(container);
  }
  container.innerHTML =
    '<div style="padding:40px;text-align:center;color:var(--tx-s)">' +
    t("loading") +
    "...</div>";

  const d = await api(
    "/api/adapter/" + encodeURIComponent(platform) + "/config",
  );
  if (!d || d.error) {
    container.innerHTML =
      '<div class="empty-state"><p>' +
      esc(d ? d.error : t("unknown_error")) +
      "</p></div>";
    return;
  }

  var html = '<div class="adapter-config-detail">';

  if (d.has_config && d.schema) {
    html +=
      '<div class="fw-section"><div class="fw-section-title">' +
      t("adapter_global_config") +
      '</div><div class="fw-section-body">';
    html +=
      '<div id="adapterGlobalConfigFields">' +
      renderAdapterSchemaFields(d.schema.fields, d.values || {}, d.config_key) +
      "</div>";
    html +=
      '<div style="margin-top:12px;text-align:right"><button class="btn btn-primary btn-sm" onclick="saveAdapterConfigAll(\'' +
      esc(platform) +
      "')\">" +
      t("save_adapter_config") +
      "</button></div>";
    html += "</div></div>";
  }

  html += "</div>";

  container.innerHTML = html;

  if (d.has_accounts) {
    loadAdapterAccounts(platform);
  }
}

export function renderAdapterSchemaFields(fields, values, keyPrefix, opts) {
  if (!fields || Object.keys(fields).length === 0)
    return (
      '<div style="padding:12px;color:var(--tx-s)">' +
      t("no_config_schema") +
      "</div>"
    );

  var groups = {};
  var groupOrder = {};
  for (const [name, fs] of Object.entries(fields)) {
    var g = fs.group || "_default";
    if (!groups[g]) {
      groups[g] = [];
      groupOrder[g] = 100;
    }
    groups[g].push({
      name: name,
      schema: fs,
      value: values[name] !== undefined ? values[name] : fs.default,
    });
  }

  var html = "";
  var sortedGroups = Object.keys(groups).sort(function (a, b) {
    var oa = groupOrder[a] || 100,
      ob = groupOrder[b] || 100;
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b);
  });

  for (const g of sortedGroups) {
    var items = groups[g].sort(function (a, b) {
      var oa = a.schema.order || 100,
        ob = b.schema.order || 100;
      return oa - ob;
    });
    for (const item of items) {
      html += renderAdapterConfigField(
        item.name,
        item.schema,
        item.value,
        keyPrefix,
        opts,
      );
    }
  }
  return html;
}

export function toggleSecretVisibility(btn) {
  var input = btn.parentElement.querySelector("input");
  if (!input) return;
  if (input.type === "password") {
    input.type = "text";
    btn.innerHTML = EYE_CLOSED_SVG;
    btn.title = t("hide_secret");
  } else {
    input.type = "password";
    btn.innerHTML = EYE_OPEN_SVG;
    btn.title = t("show_secret");
  }
}

export function renderAdapterConfigField(name, schema, value, keyPrefix, opts) {
  opts = opts || {};
  var fieldSave = opts.fieldSave !== false;
  var saveFn = opts.saveFn || "saveAdapterConfigField";
  var saveTitle = opts.saveTitle || t("save_adapter_config");
  var desc = schema.description || "";
  var tp = schema.type || "string";
  var widget = schema.widget || "";
  var fullKey = (keyPrefix ? keyPrefix + "." : "") + name;
  var onChg = fieldSave ? ' onchange="' + saveFn + '(this)"' : "";
  var saveBtn = fieldSave
    ? '<button class="kv-btn" onclick="' + saveFn + '(this.parentElement.querySelector(\'input,textarea\'))" title="' +
      saveTitle +
      '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></button>'
    : "";

  var ctrl = "";
  // 嵌套 dataclass 子树（schema 带 fields）：渲染为可折叠嵌套分组，递归渲染子字段
  if (schema.fields && typeof schema.fields === "object" && !Array.isArray(schema.fields)) {
    var subValues = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    var subHtml = renderAdapterSchemaFields(schema.fields, subValues, fullKey, opts);
    ctrl =
      '<details class="fw-nested" style="border:1px solid rgba(128,128,128,.25);border-radius:8px;padding:8px 10px;margin:4px 0">' +
      '<summary style="cursor:pointer;font-weight:600;user-select:none">' +
      esc(name) +
      "</summary>" +
      (desc ? '<div class="fw-desc">' + esc(desc) + "</div>" : "") +
      '<div style="margin-top:6px">' +
      subHtml +
      "</div></details>";
    return (
      '<div class="fw-row" style="display:block"><div class="fw-control" style="width:100%">' +
      ctrl +
      "</div></div>"
    );
  }
  if (widget === "switch" || tp === "boolean") {
    var checked = value === true || value === "true" || value === 1;
    ctrl =
      '<label class="switch"><input type="checkbox" ' +
      (checked ? "checked" : "") +
      ' data-ackey="' +
      esc(fullKey) +
      '" data-adapter-tp="boolean" data-adapter-widget="switch"' +
      onChg +
      '><span class="switch-slider"></span></label>';
  } else if (widget === "password" || schema.secret) {
    var eyeBtn =
      '<button class="kv-btn" type="button" onclick="toggleSecretVisibility(this)" title="' +
      esc(t("show_secret")) +
      '">' +
      EYE_OPEN_SVG +
      "</button>";
    ctrl =
      '<div style="display:flex;gap:4px"><input class="fw-input" type="password" value="' +
      esc(String(value != null ? value : "")) +
      '" autocomplete="new-password" data-ackey="' +
      esc(fullKey) +
      '" data-adapter-tp="string">' +
      eyeBtn +
      saveBtn +
      "</div>";
  } else if (widget === "select" || (schema.options && schema.options.length)) {
    var options = schema.options || [];
    var optsHtml = options
      .map(function (o) {
        var optVal = typeof o === "object" ? o.value : o;
        var optLabel = typeof o === "object" ? o.label : o;
        // label 兼容 i18n 字典形态（服务端已解析为文本；此处兜底未解析的场景）
        if (optLabel && typeof optLabel === "object") {
          optLabel =
            optLabel.default != null
              ? optLabel.default
              : String(optLabel.i18n != null ? optLabel.i18n : "");
        }
        var sel =
          String(value).toLowerCase() === String(optVal).toLowerCase()
            ? " selected"
            : "";
        return (
          '<option value="' +
          esc(optVal) +
          '"' +
          sel +
          ">" +
          esc(optLabel) +
          "</option>"
        );
      })
      .join("");
    ctrl =
      '<select class="settings-select" data-ackey="' +
      esc(fullKey) +
      '" data-adapter-tp="string"' +
      onChg +
      ">" +
      optsHtml +
      "</select>";
  } else if (widget === "number" || tp === "integer" || tp === "float") {
    ctrl =
      '<div style="display:flex;gap:4px"><input class="fw-input" type="number" value="' +
      esc(String(value != null ? value : "")) +
      '" data-ackey="' +
      esc(fullKey) +
      '" data-adapter-tp="' +
      esc(tp) +
      '">' +
      saveBtn +
      "</div>";
  } else if (
    tp === "array" ||
    tp === "object" ||
    tp === "table" ||
    (value && typeof value === "object" && !Array.isArray(value)) ||
    Array.isArray(value) ||
    schema.widget === "textarea"
  ) {
    // dict/list 值以 JSON 文本进 textarea（保存路径按 tp=object JSON.parse 回写）
    var strVal =
      value && typeof value === "object"
        ? JSON.stringify(value, null, 2)
        : String(value != null ? value : "");
    ctrl =
      '<div style="display:flex;gap:4px"><textarea class="fw-input fw-textarea" rows="2" data-ackey="' +
      esc(fullKey) +
      '" data-adapter-tp="object">' +
      esc(strVal) +
      "</textarea>" +
      saveBtn +
      "</div>";
  } else {
    ctrl =
      '<div style="display:flex;gap:4px"><input class="fw-input" type="text" value="' +
      esc(String(value != null ? value : "")) +
      '" data-ackey="' +
      esc(fullKey) +
      '" data-adapter-tp="' +
      esc(tp) +
      '">' +
      saveBtn +
      "</div>";
  }

  var descHtml = desc ? '<div class="fw-desc">' + esc(desc) + "</div>" : "";
  return (
    '<div class="fw-row"><div class="fw-label">' +
    esc(name) +
    descHtml +
    '</div><div class="fw-control">' +
    ctrl +
    "</div></div>"
  );
}

export async function saveAdapterConfigField(el) {
  var ackey = el.dataset.ackey;
  var tp = el.dataset.adapterTp || "string";
  var val = el.type === "checkbox" ? el.checked : el.value;
  if (tp === "number" || tp === "integer" || tp === "float") val = Number(val);
  else if (tp === "object") {
    try {
      val = JSON.parse(val);
    } catch (e) {
      return toast(t("validation_failed"), "er");
    }
  }

  var d = await api("/api/config", {
    method: "PUT",
    body: JSON.stringify({ key: ackey, value: val }),
  });
  if (d && d.success) {
    el.style.border = "2px solid var(--ok-c)";
    setTimeout(function () {
      el.style.border = "";
    }, 1200);
    toast(t("adapter_config_saved"), "ok");
  } else {
    toast(t("save_failed") + ": " + (d?.error || t("unknown_error")), "er");
  }
}

export async function saveModuleConfigField(el) {
  var ackey = el.dataset.ackey;
  var tp = el.dataset.adapterTp || "string";
  var val = el.type === "checkbox" ? el.checked : el.value;
  if (tp === "number" || tp === "integer" || tp === "float") val = Number(val);
  else if (tp === "object") {
    try {
      val = JSON.parse(val);
    } catch (e) {
      return toast(t("validation_failed"), "er");
    }
  }

  var d = await api("/api/config", {
    method: "PUT",
    body: JSON.stringify({ key: ackey, value: val }),
  });
  if (d && d.success) {
    el.style.border = "2px solid var(--ok-c)";
    setTimeout(function () {
      el.style.border = "";
    }, 1200);
    toast(t("module_config_saved"), "ok");
  } else {
    toast(t("save_failed") + ": " + (d?.error || t("unknown_error")), "er");
  }
}

export async function saveAdapterConfigAll(platform) {
  var d = await api("/api/adapter/" + encodeURIComponent(platform) + "/config");
  if (!d || !d.schema) return;

  var values = {};
  var inputs = document.querySelectorAll(
    "#adapterGlobalConfigFields [data-ackey]",
  );
  for (var i = 0; i < inputs.length; i++) {
    var el = inputs[i];
    var ackey = el.dataset.ackey;
    var parts = ackey.split(".");
    var keyName = parts[parts.length - 1];
    var tp = el.dataset.adapterTp || "string";
    var val = el.type === "checkbox" ? el.checked : el.value;
    if (tp === "number" || tp === "integer" || tp === "float")
      val = Number(val);
    else if (tp === "object") {
      try {
        val = JSON.parse(val);
      } catch (e) {
        continue;
      }
    }
    values[keyName] = val;
  }

  var result = await api(
    "/api/adapter/" + encodeURIComponent(platform) + "/config",
    {
      method: "PUT",
      body: JSON.stringify({ values: values }),
    },
  );

  if (result && result.success) {
    toast(t("adapter_config_saved"), "ok");
    if (result.errors && result.errors.length > 0) {
      toast(
        t("config_validation_failed") + ": " + result.errors.join(", "),
        "er",
      );
    }
  } else {
    toast(
      t("save_failed") + ": " + (result?.error || t("unknown_error")),
      "er",
    );
    if (result?.errors) toast(result.errors.join(", "), "er");
  }
}

export async function loadAdapterAccounts(platform) {
  var panel = document.getElementById("adapterConfigPanel");
  if (!panel) return;

  var d = await api(
    "/api/adapter/" + encodeURIComponent(platform) + "/accounts",
  );
  if (!d || d.error) return;

  // 先清除旧账户内容
  var oldSection = document.getElementById("adapterAccountsSection");
  if (oldSection) oldSection.remove();

  var html =
    '<div id="adapterAccountsSection" class="adapter-accounts-section">' +
    '<div class="adapter-section-heading">' +
    t("adapter_accounts") +
    "</div>" +
    '<div class="adapter-account-list">';

  var accounts = d.accounts || {};
  var schema = d.schema;
  for (var aname in accounts) {
    var adata = accounts[aname] || {};
    html += renderAdapterAccountCard(platform, aname, adata, schema);
  }

  html += "</div>";
  html +=
    '<button class="btn btn-primary btn-sm adapter-add-account-btn" onclick="addAdapterAccount(\'' +
    esc(platform) +
    "')\">+ " +
    t("add_account") +
    "</button>";
  html += "</div>";

  // 追加到内容区
  var container = document.getElementById("adapterConfigContent");
  if (container) {
    container.insertAdjacentHTML("beforeend", html);
  } else {
    panel.innerHTML += html;
  }
}

export function renderAdapterAccountCard(platform, accountName, accountData, schema) {
  var fieldsHtml = "";
  if (schema && schema.fields) {
    var items = Object.entries(schema.fields).sort(function (a, b) {
      var oa = a[1].order || 100,
        ob = b[1].order || 100;
      return oa - ob;
    });
    for (var i = 0; i < items.length; i++) {
      var fname = items[i][0],
        fschema = items[i][1];
      if (fname === "enabled" || fname === "name") continue;
      var fval =
        accountData[fname] !== undefined ? accountData[fname] : fschema.default;
      fieldsHtml += renderAdapterConfigField(
        fname,
        fschema,
        fval,
        "accounts." + accountName + "." + platform,
        { fieldSave: false },
      );
    }
  }

  var isEnabled = accountData.enabled !== false;
  return (
    '<div class="account-card"><div class="account-card-header">' +
    '<label class="switch" style="margin-right:8px"><input type="checkbox" ' +
    (isEnabled ? "checked" : "") +
    " onchange=\"saveAdapterAccountField('" +
    esc(platform) +
    "','" +
    esc(accountName) +
    "','enabled',this.checked)\"><span class=\"switch-slider\"></span></label>" +
    '<span class="account-card-name">' +
    esc(accountName) +
    "</span>" +
    '<div style="flex:1"></div>' +
    '<button class="btn btn-danger btn-sm" onclick="removeAdapterAccount(\'' +
    esc(platform) +
    "','" +
    esc(accountName) +
    "')\">" +
    t("remove_account") +
    "</button>" +
    "</div>" +
    '<div class="account-card-body">' +
    fieldsHtml +
    "</div>" +
    '<div class="account-card-footer"><button class="btn btn-primary btn-sm" onclick="saveAdapterAccount(\'' +
    esc(platform) +
    "','" +
    esc(accountName) +
    "')\">" +
    t("save_adapter_config") +
    "</button></div>" +
    "</div>"
  );
}

export async function saveAdapterAccountField(
  platform,
  accountName,
  fieldName,
  value,
) {
  var d = await api(
    "/api/adapter/" + encodeURIComponent(platform) + "/accounts",
  );
  if (!d || !d.accounts) return;
  var accounts = d.accounts;
  if (!accounts[accountName]) accounts[accountName] = {};
  accounts[accountName][fieldName] = value;
  var result = await api(
    "/api/adapter/" + encodeURIComponent(platform) + "/accounts",
    {
      method: "PUT",
      body: JSON.stringify({ accounts: accounts }),
    },
  );
  if (result && result.success) {
    toast(t("adapter_config_saved"), "ok");
  } else {
    toast(t("save_failed"), "er");
  }
}

export async function saveAdapterAccount(platform, accountName) {
  var accountData = {};
  var inputs = document.querySelectorAll("#adapterConfigPanel [data-ackey]");
  var prefix = "accounts." + accountName + "." + platform + ".";
  for (var i = 0; i < inputs.length; i++) {
    var el = inputs[i];
    var ackey = el.dataset.ackey;
    if (!ackey.startsWith(prefix)) continue;
    var keyName = ackey.substring(prefix.length);
    var tp = el.dataset.adapterTp || "string";
    var val = el.type === "checkbox" ? el.checked : el.value;
    if (tp === "number" || tp === "integer" || tp === "float")
      val = Number(val);
    else if (tp === "object") {
      try {
        val = JSON.parse(val);
      } catch (e) {
        continue;
      }
    }
    accountData[keyName] = val;
  }

  var d = await api(
    "/api/adapter/" + encodeURIComponent(platform) + "/accounts",
  );
  if (!d || !d.accounts) return;
  var accounts = d.accounts;
  accounts[accountName] = accountData;

  var result = await api(
    "/api/adapter/" + encodeURIComponent(platform) + "/accounts",
    {
      method: "PUT",
      body: JSON.stringify({ accounts: accounts }),
    },
  );
  if (result && result.success) {
    toast(t("adapter_config_saved"), "ok");
    if (result.message) {
      toast(result.message);
      showAdapterReloadLog(result.module || platform, platform);
    }
    if (result.errors && result.errors.length > 0) {
      toast(
        t("config_validation_failed") + ": " + result.errors.join(", "),
        "er",
      );
    }
  } else {
    toast(
      t("save_failed") + ": " + (result?.error || t("unknown_error")),
      "er",
    );
    if (result?.errors) toast(result.errors.join(", "), "er");
  }
}

export async function addAdapterAccount(platform) {
  var name = await prompt2(
    t("add_account"),
    t("account_name"),
    t("new_account_default_name"),
  );
  if (!name) return;
  var result = await api(
    "/api/adapter/" + encodeURIComponent(platform) + "/accounts/add",
    {
      method: "POST",
      body: JSON.stringify({ name: name }),
    },
  );
  if (result && result.success) {
    toast(t("account_added"), "ok");
    if (result.message) toast(result.message);
    loadAdapterConfigDetail(platform);
  } else {
    toast(
      t("save_failed") + ": " + (result?.error || t("unknown_error")),
      "er",
    );
  }
}

export async function removeAdapterAccount(platform, accountName) {
  var ok = await confirm2(
    t("confirm_remove_account"),
    t("remove_account") + ": " + esc(accountName),
  );
  if (!ok) return;
  var result = await api(
    "/api/adapter/" +
      encodeURIComponent(platform) +
      "/accounts/" +
      encodeURIComponent(accountName),
    {
      method: "DELETE",
    },
  );
  if (result && result.success) {
    toast(t("account_removed"), "ok");
    if (result.message) {
      toast(result.message);
      showAdapterReloadLog(result.module || platform, platform);
    }
    loadAdapterConfigDetail(platform);
  } else {
    toast(
      t("save_failed") + ": " + (result?.error || t("unknown_error")),
      "er",
    );
  }
}

export async function loadModuleConfigPage() {
  const d = await api("/api/modules");
  if (!d) return;

  // 只保留有配置 schema 的模块
  _moduleConfigNames = (d.modules || []).filter(function (m) {
    return m.type === "module" && m.has_config;
  });

  const panel = document.getElementById("moduleConfigPanel");
  const empty = document.getElementById("moduleConfigEmpty");

  if (_moduleConfigNames.length === 0) {
    if (empty) empty.style.display = "flex";
    let container = document.getElementById("moduleConfigContent");
    if (container) container.remove();
    return;
  }

  if (empty) empty.style.display = "none";

  // 构建选择器（与适配器配置一致的芯片式布局）
  var selectorHtml = [
    '<div class="adapter-selector-bar">',
    '<div class="adapter-chip-list" id="moduleChipList">',
  ];
  _moduleConfigNames.forEach(function (m) {
    var isActive = m.name === _moduleConfigCurrent;
    var cls = isActive ? " adapter-chip active" : " adapter-chip";
    var dotColor = m.loaded ? "var(--ok-c)" : m.enabled ? "var(--wr-c)" : "var(--tx-t)";
    var iconSvg =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;flex-shrink:0"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';
    selectorHtml.push(
      '<div class="' +
        cls +
        '" data-module="' +
        esc(m.name) +
        '" onclick="selectModuleConfig(\'' +
        esc(m.name) +
        '\')">',
      iconSvg,
      '<span class="adapter-chip-name">' + esc(m.name) + "</span>",
      '<span class="adapter-chip-dot" style="background:' +
        dotColor +
        '"></span>',
      "</div>",
    );
  });
  selectorHtml.push("</div></div>");

  // 保留内容区
  var existingContent = document.getElementById("moduleConfigContent");
  panel.innerHTML = selectorHtml.join("");
  if (existingContent) {
    panel.appendChild(existingContent);
  } else {
    var c = document.createElement("div");
    c.id = "moduleConfigContent";
    panel.appendChild(c);
  }

  if (
    !_moduleConfigCurrent ||
    !_moduleConfigNames.some(function (m) {
      return m.name === _moduleConfigCurrent;
    })
  ) {
    _moduleConfigCurrent = _moduleConfigNames[0].name;
  }

  // 高亮当前
  var chips = panel.querySelectorAll(".adapter-chip[data-module]");
  chips.forEach(function (el) {
    el.classList.toggle("active", el.dataset.module === _moduleConfigCurrent);
  });

  loadModuleConfigDetail(_moduleConfigCurrent);
}

export function selectModuleConfig(name) {
  _moduleConfigCurrent = name;
  var panel = document.getElementById("moduleConfigPanel");
  if (panel) {
    var chips = panel.querySelectorAll(".adapter-chip[data-module]");
    chips.forEach(function (el) {
      el.classList.toggle("active", el.dataset.module === name);
    });
  }
  loadModuleConfigDetail(name);
}

export async function loadModuleConfigDetail(moduleName) {
  let container = document.getElementById("moduleConfigContent");
  if (!container) {
    var panel = document.getElementById("moduleConfigPanel");
    if (!panel) return;
    container = document.createElement("div");
    container.id = "moduleConfigContent";
    panel.appendChild(container);
  }
  container.innerHTML =
    '<div style="padding:40px;text-align:center;color:var(--tx-s)">' +
    t("loading") +
    "...</div>";

  const d = await api(
    "/api/module/" + encodeURIComponent(moduleName) + "/config",
  );
  if (!d || d.error) {
    container.innerHTML =
      '<div class="empty-state"><p>' +
      esc(d ? d.error : t("unknown_error")) +
      "</p></div>";
    return;
  }

  var html = '<div class="adapter-config-detail">';

  if (d.has_config && d.schema) {
    html +=
      '<div class="fw-section"><div class="fw-section-title">' +
      esc(moduleName) +
      '</div><div class="fw-section-body">';
    html +=
      '<div id="moduleConfigFields">' +
      renderAdapterSchemaFields(d.schema.fields, d.values || {}, d.config_key, { saveFn: "saveModuleConfigField", saveTitle: t("save_module_config") }) +
      "</div>";
    html +=
      '<div style="margin-top:12px;text-align:right"><button class="btn btn-primary btn-sm" onclick="saveModuleConfigAll(\'' +
      esc(moduleName) +
      '\')">' +
      t("save_module_config") +
      "</button></div>";
    html += "</div></div>";
  } else {
    html +=
      '<div class="empty-state"><p>' +
      t("no_config_schema") +
      "</p></div>";
  }

  html += "</div>";
  container.innerHTML = html;
}

export async function saveModuleConfigAll(moduleName) {
  var d = await api(
    "/api/module/" + encodeURIComponent(moduleName) + "/config",
  );
  if (!d || !d.schema) return;

  var values = {};
  var inputs = document.querySelectorAll(
    "#moduleConfigFields [data-ackey]",
  );
  for (var i = 0; i < inputs.length; i++) {
    var el = inputs[i];
    var ackey = el.dataset.ackey;
    var parts = ackey.split(".");
    var keyName = parts[parts.length - 1];
    var tp = el.dataset.adapterTp || "string";
    var val = el.type === "checkbox" ? el.checked : el.value;
    if (tp === "number" || tp === "integer" || tp === "float")
      val = Number(val);
    else if (tp === "object") {
      try {
        val = JSON.parse(val);
      } catch (e) {
        continue;
      }
    }
    values[keyName] = val;
  }

  var result = await api(
    "/api/module/" + encodeURIComponent(moduleName) + "/config",
    {
      method: "PUT",
      body: JSON.stringify({ values: values }),
    },
  );

  if (result && result.success) {
    toast(t("module_config_saved"), "ok");
  } else {
    toast(
      t("save_failed") + ": " + (result?.error || t("unknown_error")),
      "er",
    );
    if (result?.errors) toast(result.errors.join(", "), "er");
  }
}

