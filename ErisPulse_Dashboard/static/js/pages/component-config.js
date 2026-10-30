import { openAccountWizard } from "../components/account-wizard.js";
// ErisPulse Dashboard – pages/component-config (auto-split from dash.js)

// ── 未保存修改跟踪 ──
// [data-ackey] 控件输入/变更即记入脏 key；各保存点按前缀清除；router.go 借此拦截意外丢失
document.addEventListener("input", _cfgMarkDirty);
document.addEventListener("change", _cfgMarkDirty);

function _cfgMarkDirty(e) {
  var el = e.target;
  if (!el || !el.matches || !el.matches("[data-ackey]")) return;
  var key = el.dataset && el.dataset.ackey;
  if (!key) return;
  _cfgDirtyKeys.add(key);
  _cfgUpdateSaveDot();
}

function _cfgClearDirtyPrefix(prefix) {
  var keys = [];
  _cfgDirtyKeys.forEach(function (k) {
    if (k === prefix || k.startsWith(prefix)) keys.push(k);
  });
  keys.forEach(function (k) {
    _cfgDirtyKeys.delete(k);
  });
  if (keys.length) _cfgUpdateSaveDot();
}

// 保存按钮脏点：该按钮负责的前缀下仍有未保存字段时点亮
export function _cfgUpdateSaveDot() {
  document.querySelectorAll(".cfg-save-btn").forEach(function (btn) {
    var prefix = btn.dataset.cfgPrefix;
    if (prefix == null) {
      var host = btn.closest("[data-cfg-prefix]");
      prefix = host ? host.dataset.cfgPrefix : "";
    }
    var dirty = false;
    _cfgDirtyKeys.forEach(function (k) {
      if (!dirty && k.startsWith(prefix)) dirty = true;
    });
    btn.classList.toggle("dirty", dirty);
  });
}

window.addEventListener("beforeunload", function (e) {
  if (_cfgDirtyKeys && _cfgDirtyKeys.size > 0) {
    e.preventDefault();
    e.returnValue = "";
  }
});

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
    cta.textContent = t("store");
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
    var badge = "";
    if (a.config_status === "unconfigured")
      badge = '<span class="chip chip-er cfg-chip">' + esc(t("adapter_status_unconfigured")) + "</span>";
    else if (a.config_status === "incomplete")
      badge = '<span class="chip chip-wr cfg-chip">' + esc(t("adapter_status_incomplete")) + "</span>";
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
      badge,
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
    '<div class="cfg-skeleton">' +
    '<div class="skeleton skeleton-text" style="width: 38%"></div>' +
    '<div class="skeleton skeleton-text" style="width: 72%"></div>' +
    '<div class="skeleton skeleton-text" style="width: 56%"></div>' +
    '<div class="skeleton skeleton-text" style="width: 64%"></div>' +
    "</div>";

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
    var globalFieldsHtml = renderAdapterSchemaFields(
      d.schema.fields,
      d.values || {},
      d.config_key,
    );
    var hasRenderableFields =
      d.schema.fields && Object.keys(d.schema.fields).length > 0;
    html +=
      '<div class="fw-section"><div class="fw-section-title">' +
      t("adapter_global_config") +
      '</div><div class="fw-section-body">';
    html +=
      '<div id="adapterGlobalConfigFields" data-cfg-prefix="' +
      esc(d.config_key) +
      '" data-cfgbind-root data-cfgbind-prefix="' +
      esc(d.config_key) +
      '.">' +
      globalFieldsHtml +
      "</div>";
    if (hasRenderableFields) {
      html +=
        '<div class="cfg-fields-footer"><button class="btn btn-primary btn-sm cfg-save-btn" data-cfg-prefix="' +
        esc(d.config_key) +
        '." onclick="saveAdapterConfigAll(\'' +
        esc(platform) +
        "')\">" +
        t("save_adapter_config") +
        "</button></div>";
    }
    html += "</div></div>";
  }

  html += "</div>";

  container.innerHTML = html;

  if (d.has_accounts) {
    loadAdapterAccounts(platform);
  }
}

export function renderAdapterSchemaFields(fields, values, keyPrefix, opts) {
  opts = opts || {};
  // 顶层字段绑定的取值来源（show_if/disabled_if 渲染期预计算）
  opts.bindValues = values;
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

// ══════════════════════════════════════════════════════════════
// 满血配置组件系统
// 约定文档：docs/config-widgets.md
// 所有控件 renderer(name, schema, value, fullKey, ctx) 返回控件 HTML 字符串。
// 值收集约定：单一原生控件直接带 data-ackey；复合控件（多选/键值/列表）用
// hidden input 承载序列化值（tp=object → JSON.parse，tp=number → Number()），
// 编辑器操作经 msSync / kvSync / listSync 同步 hidden 后按需触发保存。
// 旧 widget（text/password/switch/select/textarea/number）行为完全兼容。
// ══════════════════════════════════════════════════════════════

function _cfgAttrs(fullKey, tp, widget) {
  return (
    ' data-ackey="' +
    esc(fullKey) +
    '" data-adapter-tp="' +
    esc(tp || "string") +
    '"' +
    (widget ? ' data-adapter-widget="' + esc(widget) + '"' : "")
  );
}

function _cfgNumAttrs(schema) {
  var a = "";
  if (schema.min != null) a += ' min="' + esc(String(schema.min)) + '"';
  if (schema.max != null) a += ' max="' + esc(String(schema.max)) + '"';
  if (schema.step != null) a += ' step="' + esc(String(schema.step)) + '"';
  return a;
}

// 字段绑定条件求值：{field, op, value}
// op: eq/ne/in/nin/gt/lt/gte/lte/truthy（value 为数组时用于 in/nin）
function _cfgEvalBind(cond, getVal) {
  if (!cond || !cond.field) return true;
  var v = getVal(cond.field);
  var op = cond.op || "eq";
  var target = cond.value;
  var arr = Array.isArray(target) ? target : [target];
  switch (op) {
    case "eq":
      return String(v) === String(target);
    case "ne":
      return String(v) !== String(target);
    case "in":
      return arr.some(function (x) {
        return String(x) === String(v);
      });
    case "nin":
      return !arr.some(function (x) {
        return String(x) === String(v);
      });
    case "gt":
      return Number(v) > Number(target);
    case "gte":
      return Number(v) >= Number(target);
    case "lt":
      return Number(v) < Number(target);
    case "lte":
      return Number(v) <= Number(target);
    case "truthy":
      return (
        v === true || (v !== "" && v != null && v !== "false" && v !== "0")
      );
    default:
      return true;
  }
}

// 运行时按 DOM 重算全部绑定行（change 事件驱动；页面字段量级下全量重算足够快）
function _cfgFieldValue(root, field) {
  if (!root || !field) return undefined;
  var el = null;
  try {
    el = root.querySelector('[data-ackey="' + field + '"]');
    if (!el && root.dataset && root.dataset.cfgbindPrefix) {
      el = root.querySelector(
        '[data-ackey="' + root.dataset.cfgbindPrefix + "." + field + '"]',
      );
    }
  } catch (e) {}
  if (!el) return undefined;
  if (el.type === "checkbox") return el.checked;
  return el.value;
}

function _cfgBindRescan() {
  document
    .querySelectorAll("[data-showif],[data-disabledif]")
    .forEach(function (row) {
      var root = (row.closest && row.closest("[data-cfgbind-root]")) || document;
      var getVal = function (f) {
        return _cfgFieldValue(root, f);
      };
      if (row.dataset.showif) {
        var showCond;
        try {
          showCond = JSON.parse(row.dataset.showif);
        } catch (e) {}
        if (showCond)
          row.style.display = _cfgEvalBind(showCond, getVal) ? "" : "none";
      }
      if (row.dataset.disabledif) {
        var disCond;
        try {
          disCond = JSON.parse(row.dataset.disabledif);
        } catch (e) {}
        if (disCond)
          row.classList.toggle(
            "cfg-bind-disabled",
            _cfgEvalBind(disCond, getVal),
          );
      }
    });
}

document.addEventListener("change", function (e) {
  if (e.target && e.target.matches && e.target.matches("[data-ackey]"))
    _cfgBindRescan();
});

// hidden input 同步后统一触发：脏键 + 按需逐字段保存
function _cfgCommitHidden(hidden) {
  hidden.dispatchEvent(new Event("input", { bubbles: true }));
  hidden.dispatchEvent(new Event("change", { bubbles: true }));
  var saveFnName = hidden.dataset.mssave;
  if (saveFnName && typeof window[saveFnName] === "function") {
    window[saveFnName](hidden);
  }
}

// 值形态推断：字段为整数/数字且选项为数字 → mask（位掩码）；数组字段 → array；
// 其余按 JSON 字符串。使多选在旧版 SDK 未透传 value_type 时仍写入正确类型。
function _cfgMsInferType(schema) {
  var tp = String(schema.type || "").toLowerCase();
  var opts = schema.options || [];
  var numericOpts = opts.length > 0 && opts.every(function (o) {
    var v = typeof o === "object" ? o.value : o;
    return typeof v === "number" || /^\d+$/.test(String(v));
  });
  if ((tp === "integer" || tp === "number" || tp === "int" || tp === "float") && numericOpts)
    return "mask";
  if (tp === "array" || tp === "list") return "array";
  return "json";
}

// multiselect 值形态：json（默认，存 JSON 字符串）/ array（存原生数组）/ mask（存位掩码整数）
function _cfgMsRead(value, valueType) {
  var items = [];
  if (valueType === "mask") {
    var m = Number(value) || 0;
    for (var b = 0; b < 31; b++) if (m & (1 << b)) items.push(b);
    return items;
  }
  if (Array.isArray(value)) return value.slice();
  if (typeof value === "string" && value.trim()) {
    try {
      var p = JSON.parse(value);
      if (Array.isArray(p)) return p;
    } catch (e) {}
  }
  return [];
}

function _cfgMsSerialize(items, valueType) {
  if (valueType === "mask") {
    var m = 0;
    items.forEach(function (x) {
      m |= 1 << Number(x);
    });
    return { raw: String(m), tp: "number" };
  }
  if (valueType === "array") return { raw: JSON.stringify(items), tp: "object" };
  return { raw: JSON.stringify(items), tp: "string" };
}

// ── 控件注册表 ──
var _cfgWidgets = {
  text: function (name, schema, value, fullKey, ctx) {
    return (
      '<div style="display:flex;gap:4px"><input class="fw-input" type="text" value="' +
      esc(String(value != null ? value : "")) +
      '"' +
      _cfgAttrs(fullKey, ctx.tp) +
      (schema.placeholder ? ' placeholder="' + esc(schema.placeholder) + '"' : "") +
      ">" +
      ctx.saveBtn +
      "</div>"
    );
  },

  textarea: function (name, schema, value, fullKey, ctx) {
    return (
      '<div style="display:flex;gap:4px"><textarea class="fw-input fw-textarea" rows="' +
      (schema.rows || 2) +
      '"' +
      _cfgAttrs(fullKey, ctx.tp) +
      (schema.placeholder ? ' placeholder="' + esc(schema.placeholder) + '"' : "") +
      ">" +
      esc(String(value != null ? value : "")) +
      "</textarea>" +
      ctx.saveBtn +
      "</div>"
    );
  },

  password: function (name, schema, value, fullKey, ctx) {
    var eyeBtn =
      '<button class="kv-btn" type="button" onclick="toggleSecretVisibility(this)" title="' +
      esc(t("show_secret")) +
      '">' +
      EYE_OPEN_SVG +
      "</button>";
    return (
      '<div style="display:flex;gap:4px"><input class="fw-input" type="password" value="' +
      esc(String(value != null ? value : "")) +
      '" autocomplete="new-password"' +
      _cfgAttrs(fullKey, "string") +
      ">" +
      eyeBtn +
      ctx.saveBtn +
      "</div>"
    );
  },

  number: function (name, schema, value, fullKey, ctx) {
    return (
      '<div style="display:flex;gap:4px"><input class="fw-input" type="number" value="' +
      esc(String(value != null ? value : "")) +
      '"' +
      _cfgAttrs(fullKey, ctx.tp) +
      _cfgNumAttrs(schema) +
      ">" +
      ctx.saveBtn +
      "</div>"
    );
  },

  slider: function (name, schema, value, fullKey, ctx) {
    var v = value != null ? value : schema.min != null ? schema.min : 0;
    var sMin = schema.min != null ? Number(schema.min) : 0;
    var sMax = schema.max != null ? Number(schema.max) : 100;
    var pct = sMax > sMin ? ((v - sMin) / (sMax - sMin)) * 100 : 0;
    return (
      '<div class="cfg-slider"><input type="range" value="' +
      esc(String(v)) +
      '"' +
      _cfgAttrs(fullKey, ctx.tp, "slider") +
      _cfgNumAttrs(schema) +
      ' style="--pct:' + Math.max(0, Math.min(100, pct)) + '%" oninput="cfgSliderPaint(this)">' +
      '<span class="cfg-slider-val" data-sliderval>' +
      esc(String(v)) +
      "</span>" +
      ctx.saveBtn +
      "</div>"
    );
  },

  color: function (name, schema, value, fullKey, ctx) {
    var v = String(value != null ? value : "");
    if (!/^#[0-9a-fA-F]{6}$/.test(v)) v = "#4aa3dd";
    var presets = schema.presets || [
      "#4aa3dd", "#22c55e", "#f59e0b", "#ef4444",
      "#a855f7", "#ec4899", "#64748b", "#111418",
    ];
    var dots = presets
      .map(function (c) {
        return (
          '<button type="button" class="cfg-color-dot" style="background:' +
          esc(c) +
          '" data-colortarget="' +
          esc(fullKey) +
          '" data-colorval="' +
          esc(c) +
          '" onclick="colorPick(this)" title="' +
          esc(c) +
          '"></button>'
        );
      })
      .join("");
    return (
      '<div class="cfg-color"><input type="color" value="' +
      v +
      '"' +
      _cfgAttrs(fullKey, "string", "color") +
      ' oninput="colorPaint(this)">' +
      '<input type="text" class="fw-input cfg-color-hex" value="' +
      esc(v) +
      '" data-colorhex="' +
      esc(fullKey) +
      '" maxlength="7" spellcheck="false" oninput="colorHex(this)">' +
      '<div class="cfg-color-dots">' +
      dots +
      "</div>" +
      ctx.saveBtn +
      "</div>"
    );
  },

  date: function (name, schema, value, fullKey, ctx) {
    return (
      '<div class="cfg-native"><input class="fw-input" type="date" value="' +
      esc(String(value != null ? value : "")) +
      '"' +
      _cfgAttrs(fullKey, "string", "date") +
      ">" +
      ctx.saveBtn +
      "</div>"
    );
  },

  time: function (name, schema, value, fullKey, ctx) {
    return (
      '<div class="cfg-native"><input class="fw-input" type="time" value="' +
      esc(String(value != null ? value : "")) +
      '"' +
      _cfgAttrs(fullKey, "string", "time") +
      ">" +
      ctx.saveBtn +
      "</div>"
    );
  },

  datetime: function (name, schema, value, fullKey, ctx) {
    return (
      '<div class="cfg-native"><input class="fw-input" type="datetime-local" value="' +
      esc(String(value != null ? value : "")) +
      '"' +
      _cfgAttrs(fullKey, "string", "datetime") +
      ">" +
      ctx.saveBtn +
      "</div>"
    );
  },

  switch: function (name, schema, value, fullKey, ctx) {
    var checked = value === true || value === "true" || value === 1;
    return (
      '<label class="switch"><input type="checkbox" ' +
      (checked ? "checked" : "") +
      _cfgAttrs(fullKey, "boolean", "switch") +
      ctx.onChg +
      '><span class="switch-slider"></span></label>'
    );
  },

  select: function (name, schema, value, fullKey, ctx) {
    var options = schema.options || [];
    var optsHtml = options
      .map(function (o) {
        var optVal = typeof o === "object" ? o.value : o;
        var optLabel = typeof o === "object" ? o.label : o;
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
    return (
      '<select class="settings-select"' +
      _cfgAttrs(fullKey, "string") +
      ctx.onChg +
      ">" +
      optsHtml +
      "</select>"
    );
  },

  multiselect: function (name, schema, value, fullKey, ctx) {
    // 值形态：显式 value_type 优先；缺省时按字段类型推断（旧 SDK 未透传时仍正确）
    var valueType = schema.value_type || _cfgMsInferType(schema);
    var items = _cfgMsRead(value, valueType);
    var sel = items.map(String);
    var boxes = (schema.options || [])
      .map(function (o) {
        var ov = typeof o === "object" ? o.value : o;
        var ol = typeof o === "object" ? o.label : o;
        var on = sel.indexOf(String(ov)) !== -1;
        return (
          '<label class="cfg-ms-chip' +
          (on ? " is-on" : "") +
          '"><input type="checkbox" data-msvalue="' +
          esc(String(ov)) +
          '" data-mskey="' +
          esc(fullKey) +
          '"' +
          (on ? " checked" : "") +
          ' onchange="msSync(this)"><span class="cfg-ms-box"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span><span class="cfg-ms-label">' +
          esc(String(ol)) +
          "</span></label>"
        );
      })
      .join("");
    var ser = _cfgMsSerialize(items, valueType);
    return (
      '<div class="cfg-ms" data-msgroup="' +
      esc(fullKey) +
      '">' +
      boxes +
      "</div>" +
      '<input type="hidden"' +
      _cfgAttrs(fullKey, ser.tp, "multiselect") +
      ' value="' +
      esc(ser.raw) +
      '"' +
      (ctx.fieldSave ? ' data-mssave="' + esc(ctx.saveFn) + '"' : "") +
      ' data-valuetype="' +
      esc(valueType) +
      '">'
    );
  },

  kv: function (name, schema, value, fullKey, ctx) {
    var obj = {};
    if (value && typeof value === "object" && !Array.isArray(value)) obj = value;
    else if (typeof value === "string" && value.trim()) {
      try {
        var p = JSON.parse(value);
        if (p && typeof p === "object" && !Array.isArray(p)) obj = p;
      } catch (e) {}
    }
    var rows = Object.keys(obj)
      .map(function (k) {
        return (
          '<div class="cfg-row">' +
          '<input class="fw-input cfg-row-key" type="text" value="' +
          esc(k) +
          '" data-kvkey placeholder="' +
          esc(t("cfg_kv_key")) +
          '">' +
          '<input class="fw-input cfg-row-val" type="text" value="' +
          esc(String(obj[k] != null ? obj[k] : "")) +
          '" data-kvval placeholder="' +
          esc(t("cfg_kv_value")) +
          '">' +
          '<button class="cfg-row-del" type="button" onclick="this.parentElement.remove();kvSync(this.closest(\'[data-kvgroup]\').querySelector(\'input[type=hidden]\'))" title="' +
          esc(t("cfg_remove_row")) +
          '">✕</button></div>'
        );
      })
      .join("");
    return (
      '<div class="cfg-ed" data-kvgroup="' +
      esc(fullKey) +
      '">' +
      (rows ||
        '<div class="cfg-empty-hint">' +
        esc(t("cfg_empty_list")) +
        "</div>") +
      '<button class="cfg-add-row" type="button" onclick="kvAddRow(this)">+ ' +
      esc(t("cfg_add_row")) +
      "</button>" +
      '<input type="hidden"' +
      _cfgAttrs(fullKey, "object", "kv") +
      ' value="' +
      esc(JSON.stringify(obj)) +
      '"' +
      (ctx.fieldSave ? ' data-mssave="' + esc(ctx.saveFn) + '"' : "") +
      ">"
    );
  },

  list: function (name, schema, value, fullKey, ctx) {
    var arr = [];
    if (Array.isArray(value)) arr = value;
    else if (typeof value === "string" && value.trim()) {
      try {
        var p = JSON.parse(value);
        if (Array.isArray(p)) arr = p;
      } catch (e) {}
    }
    var item = schema.item || {};
    var rows = arr
      .map(function (rv, idx) {
        return _cfgListRow(fullKey, item, rv);
      })
      .join("");
    return (
      '<div class="cfg-ed cfg-ed-list" data-listgroup="' +
      esc(fullKey) +
      '">' +
      (rows ||
        '<div class="cfg-empty-hint">' +
        esc(t("cfg_empty_list")) +
        "</div>") +
      '<button class="cfg-add-row" type="button" onclick="listAddRow(this)">+ ' +
      esc(t("cfg_add_row")) +
      "</button>" +
      '<input type="hidden"' +
      _cfgAttrs(fullKey, "object", "list") +
      ' value="' +
      esc(JSON.stringify(arr)) +
      '"' +
      (ctx.fieldSave ? ' data-mssave="' + esc(ctx.saveFn) + '"' : "") +
      ' data-item-schema="' +
      esc(JSON.stringify(item)) +
      '">'
    );
  },
};

// list 行渲染：item.fields 存在时为对象行（行内控件带 data-itemfield），
// 否则为标量行（单个输入带 data-itemvalue）
function _cfgListRow(fullKey, item, rowValue) {
  var delBtn =
    '<button class="kv-btn" type="button" onclick="this.parentElement.remove();listSync(this.closest(\'[data-listgroup]\').querySelector(\'input[type=hidden]\'))" title="' +
    esc(t("cfg_remove_row")) +
    '">✕</button>';
  if (item.fields && typeof item.fields === "object") {
    var inner = "";
    for (var fname in item.fields) {
      var fs = item.fields[fname] || {};
      var fv = rowValue && typeof rowValue === "object" ? rowValue[fname] : undefined;
      var fwidget = fs.widget || (fs.type === "boolean" ? "switch" : fs.type === "integer" || fs.type === "float" ? "number" : fs.options ? "select" : "text");
      if (fwidget === "multiselect") {
        inner += _cfgWidgets.multiselect(fname, fs, fv, fname, {
          fieldSave: false,
          saveFn: "",
          saveBtn: "",
          onChg: "",
          tp: "string",
        }).replace(/data-ackey="/g, 'data-itemfield="');
      } else {
        inner += _cfgWidgets[fwidget in _cfgWidgets ? fwidget : "text"](
          fname,
          fs,
          fv,
          fname,
          { fieldSave: false, saveFn: "", saveBtn: "", onChg: "", tp: fs.type === "integer" || fs.type === "float" ? "number" : "string" },
        ).replace(/data-ackey="/g, 'data-itemfield="');
      }
    }
    return (
      '<div class="cfg-row cfg-row-obj">' +
      '<div class="cfg-row-fields">' +
      inner +
      "</div>" +
      delBtn +
      "</div>"
    );
  }
  var w = item.widget || (item.type === "integer" || item.type === "number" ? "number" : "text");
  var html = _cfgWidgets[w in _cfgWidgets ? w : "text"](
    "",
    item,
    rowValue,
    "",
    { fieldSave: false, saveFn: "", saveBtn: "", onChg: "", tp: w === "number" ? "number" : "string" },
  ).replace(/data-ackey="/g, 'data-itemvalue="');
  return (
    '<div class="cfg-row">' +
    html +
    delBtn +
    "</div>"
  );
}

// ── 单控件交互（全局函数，经 main.js Object.assign(window, ns) 暴露）──

// slider 拖动：进度填充 + 数值徽标即时刷新
export function cfgSliderPaint(el) {
  var min = el.min !== "" ? Number(el.min) : 0;
  var max = el.max !== "" ? Number(el.max) : 100;
  var pct = max > min ? ((Number(el.value) - min) / (max - min)) * 100 : 0;
  el.style.setProperty("--pct", Math.max(0, Math.min(100, pct)) + "%");
  var val = el.parentElement.querySelector("[data-sliderval]");
  if (val) val.textContent = el.value;
}

// color 色板拖动 → 同步 hex 输入
export function colorPaint(el) {
  var hex = el.parentElement.querySelector("[data-colorhex]");
  if (hex && hex.value.toLowerCase() !== el.value.toLowerCase()) hex.value = el.value;
}

// hex 文本输入 → 合法时同步色板
export function colorHex(el) {
  var v = el.value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) {
    var picker = el.parentElement.querySelector('input[type="color"]');
    if (picker) picker.value = v.toLowerCase();
  }
}

// 预设色点选 → 设值并触发隐藏链保存
export function colorPick(dot) {
  var key = dot.dataset.colortarget;
  var v = dot.dataset.colorval;
  var wrap = dot.closest(".cfg-color");
  if (!wrap) return;
  var picker = wrap.querySelector('input[type="color"]');
  var hex = wrap.querySelector("[data-colorhex]");
  if (picker) picker.value = v;
  if (hex) hex.value = v;
  if (picker) _cfgCommitHidden(picker);
}

// ── 复合控件编辑操作 ──

// kv/list 增行统一构造（带删除按钮；group 为容器元素）
function _cfgNewRow(kind, itemHtml) {
  var row = document.createElement("div");
  row.className = "cfg-row";
  row.innerHTML =
    itemHtml +
    '<button class="cfg-row-del" type="button" onclick="this.parentElement.remove();var g=this.closest(\'[data-kvgroup],[data-listgroup]\');if(g){var h=g.querySelector(\'input[type=hidden]\');if(h){(typeof kvSync===\'function\'&&g.hasAttribute(\'data-kvgroup\')?kvSync(h):listSync(h));}}" title="' +
    esc(t("cfg_remove_row")) +
    '">✕</button>';
  return row;
}


export function msSync(box) {
  var key = box.dataset && box.dataset.mskey;
  if (!key) return;
  var group = box.closest("[data-msgroup]");
  if (!group) return;
  var hidden = group.parentElement.querySelector(
    'input[type="hidden"][data-ackey="' + key + '"], input[type="hidden"][data-itemfield="' + key + '"]',
  );
  if (!hidden) return;
  // 值形态优先读渲染时写入的 data-valuetype；缺失时按 hidden tp 推断兼容旧渲染
  var valueType = hidden.dataset.valuetype;
  if (!valueType) {
    var tpHint = hidden.dataset.adapterTp;
    valueType = tpHint === "number" ? "mask" : tpHint === "object" ? "array" : "json";
  }
  var items = [];
  group.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
    if (!cb.checked) return;
    var raw = cb.dataset.msvalue;
    var n = Number(raw);
    items.push(raw.trim() !== "" && Number.isFinite(n) ? n : raw);
  });
  var ser = _cfgMsSerialize(items, valueType);
  hidden.dataset.adapterTp = ser.tp;
  hidden.value = ser.raw;
  _cfgCommitHidden(hidden);
}

export function kvAddRow(btn) {
  var group = btn.closest("[data-kvgroup]");
  if (!group) return;
  var hint = group.querySelector(".cfg-empty-hint");
  if (hint) hint.remove();
  group.insertBefore(_cfgNewRow("kv", ""), btn);
  var last = group.querySelectorAll("[data-kvkey]");
  if (last.length) last[last.length - 1].focus();
}

export function kvSync(hidden) {
  if (!hidden) return;
  var group = hidden.closest("[data-kvgroup]");
  if (!group) return;
  var obj = {};
  group.querySelectorAll(".cfg-row").forEach(function (r) {
    var k = r.querySelector("[data-kvkey]").value.trim();
    if (!k) return;
    obj[k] = r.querySelector("[data-kvval]").value;
  });
  hidden.value = JSON.stringify(obj);
  _cfgCommitHidden(hidden);
}

export function listAddRow(btn) {
  var group = btn.closest("[data-listgroup]");
  if (!group) return;
  var hidden = group.querySelector("input[type=hidden]");
  if (!hidden) return;
  var item = {};
  try {
    item = JSON.parse(hidden.dataset.itemSchema || "{}");
  } catch (e) {}
  var hint = group.querySelector(".cfg-empty-hint");
  if (hint) hint.remove();
  var inner = _cfgListRow("", item, item.fields ? {} : "");
  // _cfgListRow 自带行壳（.cfg-row），抽出其 innerHTML 复用 _cfgNewRow 统一删除按钮
  var tmp = document.createElement("div");
  tmp.innerHTML = inner;
  var innerFields = tmp.querySelector(".cfg-row-fields");
  var payload = innerFields ? innerFields.innerHTML : tmp.querySelector(".cfg-row").innerHTML;
  group.insertBefore(_cfgNewRow("list", payload), btn);
}

export function listSync(hidden) {
  if (!hidden) return;
  var group = hidden.closest("[data-listgroup]");
  if (!group) return;
  var arr = [];
  group.querySelectorAll(".cfg-row").forEach(function (r) {
    if (r.querySelector("[data-itemvalue]")) {
      var el = r.querySelector("[data-itemvalue]");
      var v = el.type === "checkbox" ? el.checked : el.value;
      if (el.dataset.adapterTp === "number") v = Number(v);
      arr.push(v);
    } else if (r.querySelector("[data-itemfield]")) {
      var obj = {};
      r.querySelectorAll("[data-itemfield]").forEach(function (h) {
        var fname = h.dataset.itemfield;
        var v = h.type === "checkbox" ? h.checked : h.value;
        if (h.dataset.adapterTp === "number") v = Number(v);
        else if (h.dataset.adapterTp === "object") {
          try {
            v = JSON.parse(v);
          } catch (e) {}
        }
        obj[fname] = v;
      });
      arr.push(obj);
    }
  });
  hidden.value = JSON.stringify(arr);
  _cfgCommitHidden(hidden);
}

// ── 主渲染入口（控件分发表驱动；未知 widget 回退 text）──

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
  var ctx = {
    fieldSave: fieldSave,
    saveFn: saveFn,
    saveBtn: saveBtn,
    onChg: onChg,
    tp: tp,
  };

  // 嵌套 dataclass 子树（schema 带 fields）：渲染为可折叠嵌套分组，递归渲染子字段
  if (schema.fields && typeof schema.fields === "object" && !Array.isArray(schema.fields)) {
    var subValues = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    var subOpts = Object.assign({}, opts, { bindValues: Object.assign({}, opts.bindValues, subValues) });
    var subHtml = renderAdapterSchemaFields(schema.fields, subValues, fullKey, subOpts);
    var bind0 = _cfgBindRowAttrs(schema, name, keyPrefix, opts);
    var ctrl =
      '<details class="fw-nested' +
      (bind0.disable ? " cfg-bind-disabled" : "") +
      '" style="border:1px solid rgba(128,128,128,.25);border-radius:8px;padding:8px 10px;margin:4px 0">' +
      '<summary style="cursor:pointer;font-weight:600;user-select:none">' +
      esc(name) +
      "</summary>" +
      (desc ? '<div class="fw-desc">' + esc(desc) + "</div>" : "") +
      '<div style="margin-top:6px">' +
      subHtml +
      "</div></details>";
    return (
      '<div class="fw-row" style="display:block' +
      (bind0.hide ? ";display:none" : "") +
      '"' +
      bind0.attrs +
      '><div class="fw-control" style="width:100%">' +
      ctrl +
      "</div></div>"
    );
  }

  // 控件分发：显式 widget → 类型/选项推断 → text 兜底
  var w = widget;
  if (!w) {
    if (tp === "boolean") w = "switch";
    else if (schema.secret) w = "password";
    else if (tp === "integer" || tp === "float" || tp === "number") w = "number";
    else if (schema.options && schema.options.length && tp === "string") w = "select";
    else w = "text";
  }
  var renderer = _cfgWidgets[w] || _cfgWidgets.text;
  var ctrlHtml = renderer(name, schema, value, fullKey, ctx);

  var bind = _cfgBindRowAttrs(schema, name, keyPrefix, opts);
  var descHtml = desc ? '<div class="fw-desc">' + esc(desc) + "</div>" : "";
  return (
    '<div class="fw-row' +
    (bind.disable ? " cfg-bind-disabled" : "") +
    '"' +
    bind.attrs +
    (bind.hide ? ' style="display:none"' : "") +
    '><div class="fw-label">' +
    esc(name) +
    descHtml +
    '</div><div class="fw-control">' +
    ctrlHtml +
    "</div></div>"
  );
}

// 字段绑定行属性：show_if / disabled_if（渲染期用 bindValues 预计算初始态）
function _cfgBindRowAttrs(schema, name, keyPrefix, opts) {
  var out = { attrs: "", hide: false, disable: false };
  var bindValues = (opts && opts.bindValues) || {};
  var getVal = function (field) {
    if (field in bindValues) return bindValues[field];
    if (keyPrefix) {
      var full = keyPrefix + "." + field;
      // 逐级回溯完整键（a.b.c → a.b.c / a.c）
      var parts = keyPrefix.split(".");
      for (var i = parts.length; i >= 0; i--) {
        var k = parts.slice(0, i).concat(field).join(".");
        if (k in bindValues) return bindValues[k];
      }
    }
    return undefined;
  };
  ["show_if", "disabled_if"].forEach(function (key) {
    var raw = schema[key];
    if (!raw) return;
    var cond = raw;
    if (typeof raw === "string") {
      try {
        cond = JSON.parse(raw);
      } catch (e) {
        return;
      }
    }
    var ok = _cfgEvalBind(cond, getVal);
    var attr = key === "show_if" ? "data-showif" : "data-disabledif";
    out.attrs += " " + attr + '="' + esc(JSON.stringify(cond)) + '"';
    if (key === "show_if") out.hide = !ok;
    else out.disable = ok;
  });
  return out;
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
    _cfgDirtyKeys.delete(ackey);
    _cfgUpdateSaveDot();
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
    _cfgDirtyKeys.delete(ackey);
    _cfgUpdateSaveDot();
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
    _cfgClearDirtyPrefix(d.config_key + ".");
    toast(t("adapter_config_saved"), "ok");
    if (result.adapter_running) promptAdapterRestart(platform);
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

  // 首配置引导（通用推断）：唯一账户且声明为必填的字段存在空值 →
  // 提示用户完成配置（扫码扩展区若注册则一并给出）。适配器无需任何额外声明。
  var setupGuide = _accountNeedsSetup(accounts, schema);
  if (setupGuide) {
    html +=
      '<div class="account-setup-guide">' +
      '<div class="account-setup-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>' +
      '<div class="account-setup-texts">' +
      '<div class="account-setup-title">' +
      esc(t("account_setup_guide_title")) +
      "</div>" +
      '<div class="account-setup-desc">' +
      esc(t("account_setup_guide_desc")) +
      " · " +
      esc(setupGuide) +
      "</div></div>" +
      '<div style="display:flex;gap:8px;flex:none">' +
      '<button class="btn btn-primary btn-sm" onclick="openAccountWizard(\'' +
      esc(platform) +
      "', {editAccount:'" +
      esc(setupGuide) +
      "'})\">" +
      esc(t("account_setup_guide_btn")) +
      "</button></div></div>";
  }

  for (var aname in accounts) {
    var adata = accounts[aname] || {};
    html += renderAdapterAccountCard(platform, aname, adata, schema);
  }

  html += "</div>";

  if (Object.keys(accounts).length === 0) {
    // 账户空状态引导：说明账户的作用并引导添加第一个账户
    html +=
      '<div class="account-empty-guide">' +
      '<div class="account-empty-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></div>' +
      '<div class="account-empty-texts">' +
      '<div class="account-empty-title">' +
      t("accounts_empty_title") +
      "</div>" +
      '<div class="account-empty-desc">' +
      t("accounts_empty_desc") +
      "</div>" +
      "</div>" +
      '<button class="btn btn-primary btn-sm" onclick="addAdapterAccount(\'' +
      esc(platform) +
      "')\">" +
      t("add_first_account") +
      "</button>" +
      "</div>";
  } else {
    html +=
      '<button class="btn btn-primary btn-sm adapter-add-account-btn" onclick="addAdapterAccount(\'' +
      esc(platform) +
      "')\">+ " +
      t("add_account") +
      "</button>";
  }
  html += "</div>";

  // 追加到内容区
  var container = document.getElementById("adapterConfigContent");
  if (container) {
    container.insertAdjacentHTML("beforeend", html);
  } else {
    panel.innerHTML += html;
  }

  // 新增账户后自动定位并高亮新卡片，引导用户"去填这里"
  if (window._cfgNewAccountFlash) {
    _cfgNewAccountFlash = false;
    var cards = document.querySelectorAll(
      "#adapterAccountsSection .account-card",
    );
    var card = cards[cards.length - 1];
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.add("account-card-new");
      setTimeout(function () {
        card.classList.remove("account-card-new");
      }, 2600);
    }
  }
}

// 唯一账户且必填字段存在空值 → 返回该账户名（否则 null）。纯 schema 推断，零适配器声明。
function _accountNeedsSetup(accounts, schema) {
  var keys = Object.keys(accounts || {});
  if (keys.length !== 1) return null;
  var name = keys[0];
  var adata = accounts[name] || {};
  if (!schema || !schema.fields) return null;
  for (var fname in schema.fields) {
    var fs = schema.fields[fname] || {};
    if (!fs.required) continue;
    var v = adata[fname];
    if (v === undefined || v === null || v === "") return name;
  }
  return null;
}

// 向导入口包装（全局）：供内联 onclick 使用
export function openAccountWizardEntry(platform, opts) {
  openAccountWizard(platform, opts).then(function (done) {
    if (done) {
      window._cfgNewAccountFlash = true;
      loadAdapterConfigDetail(platform);
    }
  });
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
    '<div class="account-card-footer"><button class="btn btn-primary btn-sm cfg-save-btn" data-cfg-prefix="accounts.' +
    esc(accountName) +
    "." +
    esc(platform) +
    '." onclick="saveAdapterAccount(\'' +
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
    _cfgDirtyKeys.delete("accounts." + accountName + "." + platform + "." + fieldName);
    _cfgUpdateSaveDot();
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
    _cfgClearDirtyPrefix("accounts." + accountName + "." + platform + ".");
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
  // 分步向导：手动配置 / 适配器注册的扩展接入方式（如扫码）
  var done = await openAccountWizard(platform);
  if (!done) return;
  window._cfgNewAccountFlash = true;
  loadAdapterConfigDetail(platform);
  return;
}

async function _addAdapterAccountLegacy(platform) {
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
    // 重渲后自动滚动到新账户卡片
    window._cfgNewAccountFlash = true;
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
    '<div class="cfg-skeleton">' +
    '<div class="skeleton skeleton-text" style="width: 38%"></div>' +
    '<div class="skeleton skeleton-text" style="width: 72%"></div>' +
    '<div class="skeleton skeleton-text" style="width: 56%"></div>' +
    '<div class="skeleton skeleton-text" style="width: 64%"></div>' +
    "</div>";

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
      '<div id="moduleConfigFields" data-cfg-prefix="' +
      esc(d.config_key) +
      '" data-cfgbind-root data-cfgbind-prefix="' +
      esc(d.config_key) +
      '.">' +
      renderAdapterSchemaFields(d.schema.fields, d.values || {}, d.config_key, { saveFn: "saveModuleConfigField", saveTitle: t("save_module_config") }) +
      "</div>";
    html +=
      '<div style="margin-top:12px;text-align:right"><button class="btn btn-primary btn-sm cfg-save-btn" data-cfg-prefix="' +
      esc(d.config_key) +
      '." onclick="saveModuleConfigAll(\'' +
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
    _cfgClearDirtyPrefix(d.config_key + ".");
    toast(t("module_config_saved"), "ok");
  } else {
    toast(
      t("save_failed") + ": " + (result?.error || t("unknown_error")),
      "er",
    );
    if (result?.errors) toast(result.errors.join(", "), "er");
  }
}


// ── 保存后重启引导（适配器运行中且可能需要重启才能完全生效） ──
export async function promptAdapterRestart(platform) {
  const choice = await showModal(
    t("adapter_restart_title"),
    t("adapter_restart_desc"),
    [
      { label: t("adapter_restart_later"), value: "later" },
      { label: t("adapter_restart_now"), value: "restart", primary: true },
    ],
  );
  if (choice !== "restart") return;
  const r = await api("/api/modules/action", {
    method: "POST",
    body: JSON.stringify({ action: "reload", name: platform, type: "adapter" }),
  });
  if (r && r.success) {
    toast(t("adapter_restarted"), "ok");
  } else {
    toast(t("save_failed") + ": " + (r?.error || t("unknown_error")), "er");
  }
}
