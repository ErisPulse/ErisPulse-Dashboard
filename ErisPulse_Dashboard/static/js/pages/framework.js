// ErisPulse Dashboard – pages/framework (auto-split from dash.js)

export async function restartFramework() {
  if (!authed) return showLogin();
  closeSettings();
  const ok = await confirm2(t("restart"), t("restart_confirm"));
  if (!ok) return;
  toast(t("restart_success"), "");
  const d = await api("/api/restart", { method: "POST" });
  if (!d || !d.success) {
    toast(t("restart_failed"), "er");
  }
}

const _fwDefaults = {
  server: {
    host: "0.0.0.0",
    port: 8000,
    auto_start: true,
    ssl_certfile: null,
    ssl_keyfile: null,
    ssl_cert: null,
    ssl_key: null,
  },
  logger: {
    level: "INFO",
    format: "rich",
    log_files: [],
    log_dir: "",
    log_rotation: "size",
    log_max_size_mb: 10,
    log_backup_count: 5,
    log_rotation_when: "midnight",
    memory_limit: 1000,
    exclude_levels: [],
  },
  storage: {
    backend: "sqlite",
    use_global_db: false,
    mysql: {
      host: "127.0.0.1",
      port: 3306,
      user: "erispulse",
      password: "",
      database: "erispulse",
      charset: "utf8mb4",
      pool_min: 1,
      pool_max: 10,
    },
    postgres: {
      host: "127.0.0.1",
      port: 5432,
      user: "erispulse",
      password: "",
      database: "erispulse",
      pool_min: 1,
      pool_max: 10,
    },
  },
  modules: {},
  adapters: {},
  event: {
    overrides: {
      message: {},
      notice: {},
      request: {},
      meta: {},
      command: {},
      acl: {},
      acl_default_allow: true,
    },
    message: { ignore_self: true },
    command: {
      prefix: "/",
      case_sensitive: true,
      allow_space_prefix: false,
      must_at_bot: false,
    },
  },
  master: { users: {} },
  framework: {
    enable_lazy_loading: true,
    plugins_dir: "plugins",
    uninit_timeout: 30,
    strict_mode: 0,
    strict_mode_exceptions: { modules: [], adapters: [] },
    handler_max_concurrency: 64,
    proactive_gc_interval: 300,
    proactive_gc_generation: 0,
    proactive_gc_full_every: 20,
    proactive_gc_memory_growth_mb: 32,
    proactive_gc_idle_only: false,
    proactive_gc_gen0_min: 500,
    offline_bot_expiry: 3600,
  },
  i18n: { language: "auto" },
  scope: {
    default_allow: true,
    cache_size: 1024,
    platforms: {},
    bots: {},
    sessions: {},
    identity: {
      adapters: {},
      bots: {},
      sessions: {},
      users: {},
    },
    actions: {},
  },
  interaction: { checkpoint_ttl: 86400 },
  transcript: {
    enabled: true,
    max_per_session: 50,
    ttl_hours: 168,
  },
};;

const _fwFieldDescs = {
  "server.host": "监听地址",
  "server.port": "监听端口",
  "server.auto_start": "初始化时自动启动 HTTP 路由服务器",
  "server.ssl_certfile": "SSL 证书文件路径，设为 null 则不使用 SSL",
  "server.ssl_keyfile": "SSL 密钥文件路径",
  "server.ssl_cert": "内联 PEM 证书内容（优先于 ssl_certfile，适合容器/无文件系统场景）",
  "server.ssl_key": "内联 PEM 密钥内容（优先于 ssl_keyfile）",
  "logger.level": "日志级别: TRACE / DEBUG / INFO / EVENT / WARNING / ERROR / CRITICAL",
  "logger.log_files": '日志文件列表（显式路径，不分段），如 ["logs/app.log"]；与 log_dir 互斥且优先',
  "logger.log_dir": "日志输出目录（自动创建），写入 erispulse.log 并按 log_rotation 自动分段",
  "logger.log_rotation": "分段方式: size（按大小）/ date（按时间）/ none（不分段）",
  "logger.log_max_size_mb": "size 模式单文件大小上限（MB），超过后轮转为备份",
  "logger.log_backup_count": "保留的历史日志文件数，超出最旧的自动删除",
  "logger.log_rotation_when": "date 模式轮转周期: S / M / H / D / midnight（每天零点）",
  "logger.memory_limit": "内存日志条数上限",
  "logger.exclude_levels": '屏蔽指定日志等级（完全丢弃），如 ["EVENT"] 隐藏消息收发内容保护隐私',
  "storage.backend": "存储后端: sqlite（默认零配置）/ mysql / postgres（需安装可选驱动，参数变更需重启）",
  "storage.use_global_db": "仅 SQLite：使用包内全局数据库（跨模块共享），变更需重启",
  "storage.mysql.host": "MySQL 主机（backend = mysql 时生效，需 pip install ErisPulse[mysql]）",
  "storage.mysql.port": "MySQL 端口",
  "storage.mysql.user": "MySQL 用户名",
  "storage.mysql.password": "MySQL 密码",
  "storage.mysql.database": "MySQL 数据库名",
  "storage.mysql.charset": "MySQL 字符集",
  "storage.mysql.pool_min": "MySQL 连接池最小连接数",
  "storage.mysql.pool_max": "MySQL 连接池最大连接数",
  "storage.postgres.host": "PostgreSQL 主机（backend = postgres 时生效，需 pip install ErisPulse[postgres]）",
  "storage.postgres.port": "PostgreSQL 端口",
  "storage.postgres.user": "PostgreSQL 用户名",
  "storage.postgres.password": "PostgreSQL 密码",
  "storage.postgres.database": "PostgreSQL 数据库名",
  "storage.postgres.pool_min": "PostgreSQL 连接池最小连接数",
  "storage.postgres.pool_max": "PostgreSQL 连接池最大连接数",
  "event.overrides.acl_default_allow": "ACL 兜底：true = 未配置 ACL 的命令放行；false = 严格模式（无 ACL 即拒）",
  "event.message.ignore_self": "忽略机器人自身发出的消息",
  "event.command.prefix": "命令触发前缀",
  "event.command.case_sensitive": "命令是否区分大小写",
  "event.command.allow_space_prefix": "是否允许命令前缀前有空格",
  "event.command.must_at_bot": "是否必须 @Bot 才能触发命令",
  "master.users": "框架主人：dict 按平台指定，list 为全局主人（所有平台生效）；支持热更新",
  "framework.enable_lazy_loading": "是否启用模块懒加载（按需加载）",
  "framework.plugins_dir": "本地插件文件夹（相对项目根目录，字符串或列表）",
  "framework.uninit_timeout": "优雅关闭总超时时间（秒），超过后强制终止；0 表示不设超时",
  "framework.strict_mode":
    "严格模式：0=宽松（仅警告，默认）/ 1=严格-跳过不合规组件 / 2=严格-致命（中止启动）",
  "framework.strict_mode_exceptions.modules": "严格模式豁免的模块名列表",
  "framework.strict_mode_exceptions.adapters": "严格模式豁免的适配器名列表",
  "framework.handler_max_concurrency": "事件处理器最大并发数（同时运行的 Task 数量，0 表示无限制），支持热更新",
  "framework.proactive_gc_interval": "主动 GC 间隔（秒，支持小数），0 表示禁用；变更即时重启任务",
  "framework.proactive_gc_generation": "常规轮次回收分代（0/1/2），0 保持轻量；深度回收由 full_every 周期触发",
  "framework.proactive_gc_full_every": "每 N 轮做一次全量回收，0 表示禁用；受内存增长门限约束",
  "framework.proactive_gc_memory_growth_mb": "全量回收的内存增长门限（MB），0 表示不设门限",
  "framework.proactive_gc_idle_only": "开启后事件洪峰时跳过 Python GC，避免停顿与消息处理竞争",
  "framework.proactive_gc_gen0_min": "gen0 垃圾量低于此值直接跳过回收（空转近乎零开销），0 表示始终回收",
  "framework.offline_bot_expiry": "离线 Bot 过期时间（秒），超过自动清除，0 表示不过期",
  "i18n.language": "语言设置（auto 为自动检测）",
  "scope.default_allow": "作用域全局兜底：false = 隐式拒绝严格模式（不影响出站维度）",
  "scope.cache_size": "作用域判定 LRU 缓存大小",
  "interaction.checkpoint_ttl": "对话自动检查点过期秒数，重启恢复时超期存档被丢弃",
  "transcript.enabled": "是否启用会话收件箱自动记录",
  "transcript.max_per_session": "每会话保留消息条数上限",
  "transcript.ttl_hours": "记录全局过期时间（小时），过期惰性清理",
};;

const _fwFieldWidgets = {
  "logger.level": {
    widget: "select",
    options: ["TRACE", "DEBUG", "INFO", "EVENT", "WARNING", "ERROR", "CRITICAL"],
  },
  "logger.format": { widget: "select", options: ["rich", "plain", "json"] },
  "logger.log_rotation": {
    widget: "select",
    options: ["size", "date", "none"],
  },
  "logger.log_rotation_when": {
    widget: "select",
    options: ["midnight", "S", "M", "H", "D"],
  },
  "storage.backend": {
    widget: "select",
    options: ["sqlite", "mysql", "postgres"],
  },
  "framework.strict_mode": {
    widget: "select",
    options: [0, 1, 2],
  },
  "i18n.language": {
    widget: "select",
    options: ["auto", "zh", "en", "zh-TW", "ja", "ru"],
  },
};;

export function _buildFwKnownKeys() {
  if (_fwKnownKeys) return _fwKnownKeys;
  _fwKnownKeys = {};
  (function walk(obj, prefix) {
    for (var k in obj) {
      var key = prefix ? prefix + "." + k : k;
      var v = obj[k];
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        walk(v, key);
      } else {
        _fwKnownKeys[key] = true;
      }
    }
  })(_fwDefaults, "");
  return _fwKnownKeys;
}

export function fwFieldDesc(fullKey) {
  const enKey = "fw_field_" + fullKey.replace(/\./g, "_");
  const en = t(enKey);
  if (en !== enKey) return en;
  const desc = _fwFieldDescs[fullKey];
  return desc || "";
}

export function fwSectionI18nKey(key) {
  const i18nKey = "fw_section_" + key.replace(/\./g, "_");
  const label = t(i18nKey);
  return label !== i18nKey ? label : key.replace(/\./g, " › ");
}

export async function loadFrameworkConfig() {
  const c = await api("/api/config");
  if (!c || !c.config) return;
  const live = c.config["ErisPulse"] || {};
  const merged = deepMerge(live, _fwDefaults);
  window._fwData = merged;
  const body = document.getElementById("fwConfigBody");
  if (!body) return;
  const sections = flattenFwSections(merged);
  body.innerHTML =
    '<div class="fw-add-field-bar"><button class="btn btn-secondary btn-sm" onclick="addFwField()">+ ' +
    t("fw_add_field") +
    "</button></div>" +
    sections.map((s) => renderFwSection(s)).join("");
  loadFrameworkVersions();
}

export async function addFwField() {
  var sectionKey = await prompt2(
    t("fw_add_field"),
    t("fw_add_field_section_hint"),
    "",
  );
  if (!sectionKey) return;
  sectionKey = sectionKey.trim();
  var fieldName = await prompt2(
    t("fw_add_field"),
    t("fw_add_field_name_hint"),
    "",
  );
  if (!fieldName) return;
  fieldName = fieldName.trim();
  var fullKey = "ErisPulse." + sectionKey + "." + fieldName;
  var value = await prompt2(
    t("fw_add_field"),
    t("fw_add_field_value_hint"),
    "",
  );
  if (value === null) return;
  var parsedValue = value;
  try {
    parsedValue = JSON.parse(value);
  } catch (e) {
    // keep as string
  }
  var d = await api("/api/config", {
    method: "PUT",
    body: JSON.stringify({ key: fullKey, value: parsedValue }),
  });
  if (d && d.success) {
    toast(t("config_saved"), "ok");
    loadFrameworkConfig();
  } else {
    toast(t("save_failed") + ": " + (d ? d.error : t("unknown_error")), "er");
  }
}

export function flattenFwSections(obj, prefix) {
  prefix = prefix || "";
  var knownKeys = _buildFwKnownKeys();
  const sections = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k === "ErisPulse") continue;
    const key = prefix ? prefix + "." + k : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      const allLeaf = Object.values(v).every(
        (x) => x === null || typeof x !== "object" || Array.isArray(x),
      );
      if (allLeaf) {
        var annotated = {};
        for (var fk in v) {
          var fullKey = key + "." + fk;
          var isKnown =
            !!knownKeys[fullKey] ||
            fullKey.startsWith("adapters.") ||
            fullKey.startsWith("modules.");
          annotated[fk] = { value: v[fk], known: isKnown };
        }
        sections.push({ key, values: annotated });
      } else {
        // 混合类型：先收集原始值（boolean/number/string/array）为当前 section
        var annotated = {};
        for (var fk in v) {
          var fv = v[fk];
          if (fv === null || typeof fv !== "object" || Array.isArray(fv)) {
            var fullKey = key + "." + fk;
            var isKnown =
              !!knownKeys[fullKey] ||
              fullKey.startsWith("adapters.") ||
              fullKey.startsWith("modules.");
            annotated[fk] = { value: fv, known: isKnown };
          }
        }
        if (Object.keys(annotated).length > 0) {
          sections.push({ key, values: annotated });
        }
        // 再递归处理嵌套对象
        sections.push(...flattenFwSections(v, key));
      }
    }
  }
  return sections;
}

export function renderFwSection(s) {
  const displayName = fwSectionI18nKey(s.key);
  const knownKeys = _buildFwKnownKeys();
  const rows = Object.entries(s.values)
    .map(([field, info]) => {
      var val =
        info && typeof info === "object" && "value" in info ? info.value : info;
      var keyForCheck = s.key + "." + field;
      var isKnown =
        info && typeof info === "object" && "known" in info
          ? info.known
          : !!knownKeys[keyForCheck];
      isKnown =
        isKnown ||
        keyForCheck.startsWith("adapters.") ||
        keyForCheck.startsWith("modules.");
      const fk = "ErisPulse." + s.key + "." + field;
      const descKey = s.key + "." + field;
      const desc = fwFieldDesc(descKey);
      const tp =
        val === null ? "null" : Array.isArray(val) ? "list" : typeof val;
      var rowClass = isKnown ? "fw-row" : "fw-row fw-row-unknown";
      var unknownLabel = isKnown
        ? ""
        : '<span class="fw-unknown-badge" title="' +
          esc(t("fw_unknown_field_desc")) +
          '">' +
          esc(t("fw_unknown_field")) +
          "</span>";

      var widgetDef = _fwFieldWidgets[descKey];
      var ctrl = "";
      if (widgetDef && widgetDef.widget === "select") {
        var optsHtml = widgetDef.options
          .map(function (o) {
            var sel =
              String(val).toLowerCase() === String(o).toLowerCase()
                ? " selected"
                : "";
            return (
              '<option value="' +
              esc(o) +
              '"' +
              sel +
              ">" +
              esc(o) +
              "</option>"
            );
          })
          .join("");
        ctrl =
          '<select class="settings-select" data-fk="' +
          esc(fk) +
          '" data-tp="string" onchange="saveFwConfig(this)">' +
          optsHtml +
          "</select>";
      } else if (tp === "boolean") {
        ctrl =
          '<label class="switch"><input type="checkbox" ' +
          (val ? "checked" : "") +
          ' data-fk="' +
          esc(fk) +
          '" data-tp="' +
          tp +
          '" onchange="saveFwConfig(this)"><span class="switch-slider"></span></label>';
      } else if (tp === "number") {
        ctrl =
          '<input class="fw-input" type="number" value="' +
          esc(String(val)) +
          '" data-fk="' +
          esc(fk) +
          '" data-tp="' +
          tp +
          '">';
      } else if (tp === "list") {
        ctrl = renderFwListField(fk, val);
      } else if (tp === "object") {
        ctrl =
          '<textarea class="fw-input fw-textarea" rows="2" data-fk="' +
          esc(fk) +
          '" data-tp="' +
          tp +
          '">' +
          esc(JSON.stringify(val)) +
          "</textarea>";
      } else {
        ctrl =
          '<input class="fw-input" type="text" value="' +
          esc(String(val)) +
          '" data-fk="' +
          esc(fk) +
          '" data-tp="' +
          tp +
          '">';
      }
      var saveBtn =
        tp === "boolean" || tp === "list"
          ? ""
          : '<button class="kv-btn kv-btn-save" onclick="saveFwConfig(this.previousElementSibling)" title="Save"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></button>';
      var resetBtn =
        '<button class="kv-btn kv-btn-del" onclick="resetFwField(\'' +
        esc(fk) +
        '\')" title="' +
        esc(isKnown ? t("fw_reset_default") : t("fw_delete_field")) +
        '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg></button>';
      var descHtml = desc ? '<div class="fw-desc">' + esc(desc) + "</div>" : "";
      return (
        '<div class="' +
        rowClass +
        '"><div class="fw-label">' +
        esc(field) +
        unknownLabel +
        descHtml +
        '</div><div class="fw-control">' +
        ctrl +
        saveBtn +
        resetBtn +
        "</div></div>"
      );
    })
    .join("");
  return (
    '<div class="fw-section"><div class="fw-section-title">' +
    esc(displayName) +
    '</div><div class="fw-section-body">' +
    rows +
    "</div></div>"
  );
}

export function renderFwListField(fk, val) {
  if (!Array.isArray(val)) val = [val];
  var itemsHtml = val
    .map(function (item, i) {
      return (
        '<div class="fw-list-item">' +
        '<input class="fw-input fw-list-input" type="text" value="' +
        esc(String(item)) +
        '" data-fk="' +
        esc(fk) +
        '" data-idx="' +
        i +
        '">' +
        '<button class="kv-btn kv-btn-del" onclick="removeFwListItem(this)" title="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
        "</div>"
      );
    })
    .join("");
  return (
    '<div class="fw-list-field" data-fk="' +
    esc(fk) +
    '">' +
    itemsHtml +
    '<button class="btn btn-secondary btn-xs fw-list-add-btn" onclick="addFwListItem(this)" data-fk="' +
    esc(fk) +
    '">+ Add</button>' +
    '<button class="btn btn-primary btn-xs fw-list-save-btn" onclick="saveFwListField(this)" data-fk="' +
    esc(fk) +
    '">' +
    t("save_config") +
    "</button>" +
    "</div>"
  );
}

export function addFwListItem(btn) {
  var container = btn.parentElement;
  var addBtn = container.querySelector(".fw-list-add-btn");
  var newItem = document.createElement("div");
  newItem.className = "fw-list-item";
  newItem.innerHTML =
    '<input class="fw-input fw-list-input" type="text" value="" data-fk="' +
    esc(btn.dataset.fk) +
    '" data-idx="' +
    container.querySelectorAll(".fw-list-input").length +
    '">' +
    '<button class="kv-btn kv-btn-del" onclick="removeFwListItem(this)" title="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
  container.insertBefore(newItem, addBtn);
  newItem.querySelector("input").focus();
}

export function removeFwListItem(btn) {
  var item = btn.parentElement;
  item.remove();
}

export async function saveFwListField(btnOrContainer) {
  var container =
    btnOrContainer.classList &&
    btnOrContainer.classList.contains("fw-list-field")
      ? btnOrContainer
      : btnOrContainer.closest(".fw-list-field");
  if (!container) return;
  var fk = container.dataset.fk;
  var inputs = container.querySelectorAll(".fw-list-input");
  var values = [];
  inputs.forEach(function (inp) {
    var v = inp.value.trim();
    if (v) values.push(v);
  });
  if (fk.startsWith("ErisPulse.server.")) {
    var ok = await confirm2(
      t("fw_server_warn_title"),
      t("fw_server_warn_text"),
    );
    if (!ok) return;
  }
  // If single value, save as string; if multiple, save as list
  var saveValue = values.length === 1 ? values[0] : values;
  var d = await api("/api/config", {
    method: "PUT",
    body: JSON.stringify({ key: fk, value: saveValue }),
  });
  if (d && d.success) {
    toast(t("config_saved"), "ok");
    loadFrameworkConfig();
  } else {
    toast(t("save_failed") + ": " + (d ? d.error : t("unknown_error")), "er");
  }
}

export async function saveFwConfig(el) {
  const fk = el.dataset.fk;
  if (fk.startsWith("ErisPulse.server.")) {
    const ok = await confirm2(
      t("fw_server_warn_title"),
      t("fw_server_warn_text"),
    );
    if (!ok) return;
  }
  const tp = el.dataset.tp;
  let v = el.type === "checkbox" ? el.checked : el.value;
  if (tp === "number") v = Number(v);
  else if (tp === "object") {
    try {
      v = JSON.parse(v);
    } catch (e) {
      return toast(t("validation_failed"), "er");
    }
  }
  const d = await api("/api/config", {
    method: "PUT",
    body: JSON.stringify({ key: fk, value: v }),
  });
  el.style.border =
    d && d.success ? "2px solid var(--ok-c)" : "2px solid var(--er-c)";
  setTimeout(() => (el.style.border = ""), 1200);
  if (d && d.success) toast(t("config_saved"), "ok");
  else toast(t("save_failed") + ": " + (d?.error || t("unknown_error")), "er");
}

export async function resetFwField(fk) {
  var knownKeys = _buildFwKnownKeys();
  var plainKey = fk.replace("ErisPulse.", "");
  var isKnown = !!knownKeys[plainKey];
  var msg = isKnown
    ? t("fw_reset_confirm").replace("{key}", fk)
    : t("fw_delete_confirm").replace("{key}", fk);
  var ok = await confirm2(
    isKnown ? t("fw_reset_default") : t("fw_delete_field"),
    msg,
  );
  if (!ok) return;
  var d = await api("/api/config", {
    method: "PUT",
    body: JSON.stringify({ key: fk, value: null }),
  });
  if (d && d.success) {
    toast(isKnown ? t("fw_reset_done") : t("fw_delete_done"), "ok");
    loadFrameworkConfig();
  } else {
    toast(t("save_failed") + ": " + (d?.error || t("unknown_error")), "er");
  }
}

export function isServerWindows() {
  if (typeof window._serverIsWindows === "boolean") return window._serverIsWindows;
  var p = (window._serverPlatform || "").toLowerCase();
  return p === "windows";
}

export async function checkFwUpdateBadge() {
  if (_fwBadgeChecked) return;
  _fwBadgeChecked = true;
  try {
    var d = await api("/api/framework/versions");
    if (!d || !d.current) return;
    // 同步服务器平台
    if (d.platform) {
      window._serverPlatform = d.platform;
      window._serverIsWindows = /^win/i.test(d.platform);
    }
    var versions = d.versions || [];
    var latest = versions.length > 0 ? versions[0] : "";
    var hasUpdate = latest && cmpVer(latest, d.current) > 0;
    if (!hasUpdate) return;
    // 红点
    document.getElementById("settingsBtn")?.classList.add("show-update");
    document.getElementById("settingsUpdateTab")?.classList.add("show-update");
    // 弹出提示（延迟显示，避免与连接状态面板同时弹出）
    var popupText = document.getElementById("fwUpdatePopupText");
    if (popupText) {
      popupText.textContent = t("fw_popup_msg").replace("{latest}", latest);
    }
    var popup = document.getElementById("fwUpdatePopup");
    if (popup) {
      setTimeout(function () {
        popup.classList.add("expanded");
        setTimeout(function () {
          popup.classList.remove("expanded");
        }, 4000);
      }, 3000);
    }
  } catch (e) { /* 静默失败 */ }
}

export async function loadFrameworkVersions() {
  var spinBtn = document.getElementById("fwRefreshBtn");
  if (spinBtn) spinBtn.classList.add("spinning");
  const d = await api(
    "/api/framework/versions?pre=" +
      (document.getElementById("fwPreRelease")?.checked || false),
  );
  if (spinBtn) spinBtn.classList.remove("spinning");
  if (!d) return;

  _fwCurrentVer = d.current;
  _fwVersions = d.versions || [];
  document.getElementById("fwCurrentVer").textContent = d.current;

  // 最新版本 + 状态徽章
  var latest = _fwVersions.length > 0 ? _fwVersions[0] : "-";
  var hasUpdate = latest !== "-" && cmpVer(latest, d.current) > 0;
  var latestEl = document.getElementById("fwLatestVer");
  if (latestEl) {
    latestEl.textContent = latest;
    latestEl.classList.toggle("has-update", hasUpdate);
  }
  var badge = document.getElementById("fwStatusBadge");
  if (badge) {
    badge.classList.toggle("ok", !hasUpdate);
    badge.classList.toggle("update", hasUpdate);
  }
  var badgeText = document.getElementById("fwStatusText");
  if (badgeText) {
    badgeText.textContent = t(
      hasUpdate ? "fw_update_available" : "fw_latest_already",
    );
  }

  // 服务器平台提示（点击安装时弹窗确认，此处不显横幅）
  if (d.platform) {
    window._serverPlatform = d.platform;
    window._serverIsWindows = /^win/i.test(d.platform);
  }
  var isWindows = isServerWindows();
  var winWarn = document.getElementById("fwWinWarn");
  if (winWarn) winWarn.style.display = isWindows ? "" : "none";

  // 更新按钮：所选版本 > 当前版本即可启用
  var updateBtn = document.getElementById("fwUpdateBtn");
  var sel = document.getElementById("fwVersionSelect");
  function refreshBtn() {
    if (!updateBtn || !sel) return;
    var sv = sel.value;
    if (!sv || sv === _fwCurrentVer) {
      updateBtn.disabled = true;
      updateBtn.style.opacity = "0.5";
    } else {
      updateBtn.disabled = false;
      updateBtn.style.opacity = "";
    }
  }
  sel.onchange = function () {
    refreshBtn();
    loadFwReleaseNotes();
  };

  // 填充版本选择器
  var versionRow = document.getElementById("fwVersionRow");
  if (sel && versionRow && _fwVersions.length > 0) {
    versionRow.style.display = "";
    sel.innerHTML = _fwVersions
      .map(function (v) {
        var isCurrent = v === d.current;
        return (
          '<option value="' +
          esc(v) +
          '"' +
          (v === latest ? " selected" : "") +
          ">" +
          esc(v) +
          (isCurrent ? " (" + t("fw_current") + ")" : "") +
          "</option>"
        );
      })
      .join("");
  }

  refreshBtn();
  if (sel && sel.value) loadFwReleaseNotes();
}

export async function fetchChangelog() {
  if (_changelogCache && Date.now() - _changelogCacheTs < 600000) return _changelogCache;
  for (var i = 0; i < CHANGELOG_PROXIES.length; i++) {
    try {
      var url = CHANGELOG_PROXIES[i] + CHANGELOG_BASE;
      var resp = await fetch(url);
      if (resp.ok) {
        _changelogCache = await resp.text();
        _changelogCacheTs = Date.now();
        return _changelogCache;
      }
    } catch (e) {}
  }
  return null;
}

export function findChangelogHead(text, version) {
  if (!text) return null;
  // CHANGELOG 用横杠，PyPI 用点号，都要试
  var variants = [version];
  if (version.indexOf(".dev") !== -1) variants.push(version.replace(/\.dev/, "-dev."));
  if (version.indexOf("-dev.") !== -1) variants.push(version.replace(/-dev\./, ".dev"));
  if (version.indexOf("-de.") !== -1) variants.push(version.replace(/-de\./, "-dev."));
  for (var i = 0; i < variants.length; i++) {
    var headRe = new RegExp("## \\[" + escRegex(variants[i]) + "\\][^\\n]*");
    var m = text.match(headRe);
    if (m) return m;
  }
  return null;
}

export function parseChangelogSection(text, version) {
  var m = findChangelogHead(text, version);
  if (!m) return null;
  // 正文：标题行之后到下一个版本标题之间
  var start = m.index + m[0].length;
  var rest = text.slice(start);
  var next = rest.search(/## \[/);
  var body = (next === -1 ? rest : rest.slice(0, next)).trim();
  // 日期取自标题行 "## [x] - 2026/08/28"
  var dm = m[0].match(/-\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s*$/);
  return { date: dm ? dm[1] : "", body: body };
}

export function aggregateDevGroups(text, version) {
  if (!text || /dev/i.test(version)) return null;
  var m = findChangelogHead(text, version);
  if (!m) return null;
  var rest = text.slice(m.index + m[0].length);
  var devs = 0;
  var merged = [];
  function mergeGroups(groups) {
    groups.forEach(function (g) {
      if (!g.lines.join("\n").trim()) return;
      var found = null;
      for (var i = 0; i < merged.length; i++) {
        if (merged[i].name === g.name) { found = merged[i]; break; }
      }
      if (found) found.lines = found.lines.concat(g.lines);
      else merged.push({ name: g.name, lines: g.lines.slice() });
    });
  }
  while (true) {
    var hm = rest.match(/^## \[([^\]]+)\][^\n]*/m);
    if (!hm) break;
    var vname = hm[1].trim();
    // 仅聚合属于该版本的开发段落，遇到其它版本（含上一个正式版）即停止
    if (
      vname.indexOf(version + "-dev") !== 0 &&
      vname.indexOf(version + ".dev") !== 0
    ) {
      break;
    }
    devs++;
    var start = hm.index + hm[0].length;
    var subRest = rest.slice(start);
    var next = subRest.search(/^## \[/m);
    var body = next === -1 ? subRest : subRest.slice(0, next);
    var sub = parseReleaseStructure(body);
    if (sub) mergeGroups(sub.groups);
    rest = subRest;
  }
  if (!devs || !merged.length) return null;
  merged.sort(function (a, b) {
    return fwCatOrder(a.name) - fwCatOrder(b.name);
  });
  return { count: devs, groups: merged };
}

export function fwCatMeta(name) {
  for (var i = 0; i < FW_CAT_MAP.length; i++) {
    if (FW_CAT_MAP[i][0].test(name)) {
      return { cls: FW_CAT_MAP[i][1], i18n: FW_CAT_MAP[i][2] };
    }
  }
  return { cls: "neutral", i18n: null };
}

export function fwCatOrder(name) {
  for (var i = 0; i < FW_CAT_MAP.length; i++) {
    if (FW_CAT_MAP[i][0].test(name)) return i;
  }
  return FW_CAT_MAP.length;
}

export function fwMdHtml(lines) {
  var md = (lines || []).join("\n").trim();
  if (!md) return "";
  return typeof marked !== "undefined" ? marked.parse(md) : md.replace(/</g, "&lt;");
}

export function fwCountItems(lines) {
  // 官方 CHANGELOG 顶层是贡献者、二级缩进才是变更条目；
  // 旧格式则顶层即变更。优先计二级，无二级时计顶层。
  var top = 0, nested = 0;
  for (var i = 0; i < (lines || []).length; i++) {
    if (/^([-*+]|\d+\.)\s+/.test(lines[i])) top++;
    else if (/^ {1,2}([-*+]|\d+\.)\s+/.test(lines[i])) nested++;
  }
  return nested > 0 ? nested : top;
}

export function parseReleaseStructure(md) {
  if (!md) return null;
  var res = {
    releaseType: "",
    summary: [],
    upgrade: [],
    notice: [],
    breaking: [],
    groups: [],
    summaryExplicit: false,
  };
  var bucket = null; // "summary" | "upgrade" | "notice" | 分组对象
  var sawContent = false;
  function push(s) {
    if (typeof bucket === "string") res[bucket].push(s);
    else bucket.lines.push(s);
  }
  var lines = md.split("\n");
  for (var i = 0; i < lines.length; i++) {
    var ln = lines[i].replace(/\s+$/, "");
    if (/^#{1,6}\s+\S/.test(ln)) {
      bucket = { type: "group", name: ln.replace(/^#{1,6}\s+/, "").trim(), lines: [] };
      res.groups.push(bucket);
      continue;
    }
    var mb = ln.match(/^\*\*([^*]+)\*\*\s*$/);
    if (mb) {
      var k = mb[1].trim();
      if (/摘要|summary/i.test(k)) {
        bucket = "summary";
        res.summaryExplicit = true;
        continue;
      }
      if (/升级|upgrade/i.test(k)) { bucket = "upgrade"; continue; }
      if (/注意|notice|caution/i.test(k)) { bucket = "notice"; continue; }
      if (/破坏|breaking|不兼容/i.test(k)) { bucket = "breaking"; continue; }
    }
    if (/^-{3,}\s*$/.test(ln)) continue;
    if (!sawContent && /^>\s?/.test(ln)) {
      var q = ln.replace(/^>\s?/, "").trim();
      if (q && !res.releaseType) { res.releaseType = q; continue; }
    }
    if (!ln.trim()) {
      if (bucket) push("");
      continue;
    }
    sawContent = true;
    if (!bucket) bucket = "summary";
    push(ln);
  }
  return res;
}

export function renderFwNotes(v, body, date, agg) {
  var notesEl = document.getElementById("fwReleaseNotes");
  if (!notesEl) return true;
  var s = parseReleaseStructure(body) || {
    releaseType: "",
    summary: [],
    upgrade: [],
    notice: [],
    breaking: [],
    groups: [],
    summaryExplicit: false,
  };
  var hasOwn =
    s.groups.length ||
    s.summaryExplicit ||
    s.upgrade.length ||
    s.notice.length ||
    s.breaking.length;
  // 正式版自身无分组时，合并其对应开发版本的分组
  var useAgg = !!(agg && agg.groups && agg.groups.length) && !s.groups.length;
  if (!hasOwn && !useAgg) {
    return false; // 无结构，交由调用方回退整段渲染
  }
  var h = '<div class="fw-notes-head"><span class="fw-notes-ver">v' + esc(v) + "</span>";
  if (date) h += '<span class="fw-notes-date">' + esc(date) + "</span>";
  if (s.releaseType) {
    var rt = s.releaseType;
    var kind = /正式|stable/i.test(rt)
      ? "stable"
      : /开发|dev/i.test(rt)
        ? "dev"
        : "";
    var label = kind === "stable"
      ? t("fw_release_stable")
      : kind === "dev"
        ? t("fw_release_dev")
        : esc(rt);
    h += '<span class="fw-notes-type' + (kind ? " " + kind : "") + '">' + label + "</span>";
  }
  h += "</div>";
  var summaryHtml = fwMdHtml(s.summary);
  if (summaryHtml) h += '<div class="fw-notes-summary">' + summaryHtml + "</div>";
  if (s.breaking.join("\n").trim()) {
    h +=
      '<div class="fw-notes-callout danger"><div class="fw-callout-label">' +
      esc(t("fw_notes_breaking")) +
      "</div>" +
      fwMdHtml(s.breaking) +
      "</div>";
  }
  if (s.upgrade.join("\n").trim()) {
    h +=
      '<div class="fw-notes-callout"><div class="fw-callout-label">' +
      esc(t("fw_notes_upgrade")) +
      "</div>" +
      fwMdHtml(s.upgrade) +
      "</div>";
  }
  if (s.notice.join("\n").trim()) {
    h +=
      '<div class="fw-notes-callout"><div class="fw-callout-label">' +
      esc(t("fw_notes_notice")) +
      "</div>" +
      fwMdHtml(s.notice) +
      "</div>";
  }
  var groups = s.groups;
  if (useAgg) {
    h +=
      '<div class="fw-notes-agg">' +
      esc(t("fw_notes_from_devs")).replace("{n}", agg.count) +
      "</div>";
    groups = agg.groups;
  }
  if (groups.length) {
    var total = 0;
    groups.forEach(function (g) { total += fwCountItems(g.lines); });
    var expandAll = total > 0 && total <= 6;
    h += '<div class="fw-notes-groups">';
    groups.forEach(function (g) {
      var meta = fwCatMeta(g.name);
      var name = meta.i18n ? t(meta.i18n) : esc(g.name);
      h +=
        '<details class="fw-notes-group fw-cat-' + meta.cls + '"' +
        (expandAll ? " open" : "") +
        '><summary><span class="fw-cat-dot"></span><span>' +
        name +
        '</span><span class="fw-cat-count">' +
        fwCountItems(g.lines) +
        "</span></summary>" +
        '<div class="fw-notes-group-body">' +
        fwMdHtml(g.lines) +
        "</div></details>";
    });
    h += "</div>";
  }
  notesEl.innerHTML = h;
  return true;
}

export async function loadFwReleaseNotes() {
  var sel = document.getElementById("fwVersionSelect");
  var notesEl = document.getElementById("fwReleaseNotes");
  if (!sel || !notesEl) return;
  var v = sel.value;
  if (!v) { notesEl.style.display = "none"; return; }
  notesEl.style.display = "";
  notesEl.innerHTML =
    '<div class="fw-notes-loading">' + esc(t("loading")) + "...</div>";

  // 1. 尝试从 CHANGELOG.md 提取并结构化渲染（正式版聚合其 dev 分组）
  var changelog = await fetchChangelog();
  if (changelog) {
    var section = parseChangelogSection(changelog, v);
    if (section) {
      var agg = aggregateDevGroups(changelog, v);
      if (renderFwNotes(v, section.body, section.date, agg)) return;
    }
  }

  // 2. 回退后端
  var d = await api("/api/framework/versions?notes=" + encodeURIComponent(v));
  if (d && d.notes) {
    if (renderFwNotes(v, d.notes, "")) return;
    notesEl.innerHTML =
      '<div class="fw-notes-head"><span class="fw-notes-ver">v' + esc(v) + "</span></div>" +
      '<div class="fw-notes-summary">' +
      (typeof marked !== "undefined" ? marked.parse(d.notes) : d.notes.replace(/</g, "&lt;")) +
      "</div>";
    return;
  }

  // 3. 最后显示链接
  var releaseUrl = "https://github.com/ErisPulse/ErisPulse/releases/tag/v" + v;
  notesEl.innerHTML =
    '<div class="fw-notes-loading">' +
    '<p style="margin:0 0 8px">' + esc(t("release_notes_unavailable")) + "</p>" +
    '<a href="' + esc(releaseUrl) +
    '" target="_blank" rel="noopener">' +
    esc(releaseUrl) + "</a></div>";
}

// 框架更新任务成功后（WS install_progress success）调用：
// 复位更新按钮、刷新版本显示，并给出"建议重启框架"引导
export function onFrameworkUpdateSuccess(version) {
  var btn = document.getElementById("fwUpdateBtn");
  if (btn) {
    btn.disabled = false;
    btn.innerHTML =
      '<span data-i18n="fw_install_update">' +
      t("fw_install_update") +
      "</span>";
  }
  loadFrameworkVersions();
  showUpdateHint("framework", version);
  toast(t("fw_update_done"), "ok");
}

export async function doFrameworkUpdate() {
  const sel = document.getElementById("fwVersionSelect");
  const version = sel?.value;
  if (!version) return;

  if (_fwCurrentVer && cmpVer(version, _fwCurrentVer) < 0) {
    const ok = await confirm2(
      t("fw_downgrade_title"),
      t("fw_downgrade_text").replace("{v}", version),
    );
    if (!ok) return;
  }

  // Windows 特别提示（基于服务器平台而非客户端浏览器平台）
  var isWin = isServerWindows();
  if (isWin) {
    var ok = await confirm2(t("fw_win_confirm_title"), t("fw_win_confirm_text"));
    if (!ok) return;
  }

  const btn = document.getElementById("fwUpdateBtn");
  btn.disabled = true;
  btn.innerHTML = "<span>" + t("installing") + "</span>";

  const d = await api("/api/framework/update", {
    method: "POST",
    body: JSON.stringify({ version, lang }),
  });

  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, "ErisPulse==" + version);
    if (isWin) {
      toast(t("fw_win_update_started"), "ok");
    } else {
      toast(t("installing"), "");
    }
  } else {
    toast(t("install_failed"), "er");
    btn.disabled = false;
    btn.innerHTML =
      '<span data-i18n="fw_install_update">' +
      t("fw_install_update") +
      "</span>";
  }
}

