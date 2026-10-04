// ErisPulse Dashboard – pages/security
// 安全页：SSL 证书管理（热应用）、反向代理推荐（紧凑卡 + 模态窗生成配置）、
// 访问安全（token 管理）、路由安全配置、审计日志入口；卡片瀑布流布局

var _secSslMode = "path";
var _secSslCanReload = false;
var _secSslCertInfo = null;

function _secVal(id) {
  var el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

export async function loadSecurity() {
  if (!authed) return showLogin();
  loadSecuritySsl();
  loadSecurityProxy();
  loadSecurityAccess();
  loadSecurityRouter();
  loadSecurityAudit();
  // 瀑布流：等本轮卡片渲染后布局（ResizeObserver 会兜底后续高度变化）
  setTimeout(function () {
    layoutMasonry(document.getElementById("secGrid"), { colWidth: 430 });
  }, 60);
}

// ════════════════ SSL 证书管理 ════════════════

export async function loadSecuritySsl() {
  var d = await api("/api/framework/ssl/status");
  if (!d || !d.success) return;
  _secSslCanReload = !!d.can_reload;
  _secSslCertInfo = d.cert_info || null;
  var host = document.getElementById("secSslCard");
  if (!host) return;

  var chips = "";
  if (d.enabled) {
    chips += '<span class="chip chip-ok">' + esc(t("sec_ssl_on")) + "</span>";
  } else {
    chips += '<span class="chip">' + esc(t("sec_ssl_off")) + "</span>";
  }
  if (d.https_active) {
    chips += ' <span class="chip chip-ok">https</span>';
  }
  if (!_secSslCanReload) {
    chips +=
      ' <span class="chip chip-wr" data-i18n-title="sec_ssl_no_reload_tip">' +
      esc(t("sec_ssl_no_reload")) +
      "</span>";
  }
  var infoLine = t("sec_ssl_mode_" + (d.mode || "none"));
  var ci = _secSslCertInfo;
  if (ci) {
    infoLine +=
      " · " +
      esc(ci.subject_cn || "-") +
      " · " +
      esc(t("sec_ssl_expires")) +
      " " +
      esc(ci.not_after);
  }

  host.innerHTML =
    '<div class="card settings-card">' +
    '<div class="card-header">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>' +
    "<span>" +
    esc(t("sec_ssl_title")) +
    "</span>" +
    '<span style="margin-left:auto;display:flex;gap:6px;align-items:center">' +
    chips +
    "</span>" +
    "</div>" +
    '<div class="settings-card-body">' +
    '<div class="settings-item"><div>' +
    '<div class="settings-item-label">' +
    esc(t("sec_ssl_cert_info")) +
    "</div>" +
    '<div class="settings-item-desc">' +
    infoLine +
    "</div>" +
    _secCertInfoHtml(ci) +
    "</div></div>" +
    '<div class="sec-hint">' +
    esc(t("sec_ssl_proxy_hint")) +
    "</div>" +
    '<div class="sec-mode-tabs">' +
    '<button class="sec-mode-tab' +
    (_secSslMode === "path" ? " active" : "") +
    '" onclick="secSwitchMode(\'path\', this)">' +
    esc(t("sec_ssl_mode_path")) +
    "</button>" +
    '<button class="sec-mode-tab' +
    (_secSslMode === "inline" ? " active" : "") +
    '" onclick="secSwitchMode(\'inline\', this)">' +
    esc(t("sec_ssl_mode_inline")) +
    "</button>" +
    "</div>" +
    '<div id="secSslPathMode"' +
    (_secSslMode === "path" ? "" : ' style="display:none"') +
    ">" +
    _secPathRow("certfile", t("sec_ssl_certfile"), d.certfile, "cert", t("sec_ssl_upload_cert")) +
    _secPathRow("keyfile", t("sec_ssl_keyfile"), d.keyfile, "key", t("sec_ssl_upload_key")) +
    "</div>" +
    '<div id="secSslInlineMode"' +
    (_secSslMode === "inline" ? "" : ' style="display:none"') +
    ">" +
    _secInlineRow("cert", t("sec_ssl_cert_pem"), d.has_inline_cert) +
    _secInlineRow("key", t("sec_ssl_key_pem"), d.has_inline_key) +
    "</div>" +
    '<div class="sec-actions">' +
    '<button class="btn btn-primary btn-sm" onclick="secApplySsl()">' +
    esc(t("sec_ssl_apply")) +
    "</button>" +
    '<button class="btn btn-danger btn-sm" onclick="secClearSsl()">' +
    esc(t("sec_ssl_clear")) +
    "</button>" +
    "</div>" +
    "</div></div>";
}

function _secCertInfoHtml(ci) {
  if (!ci) return "";
  var days = typeof ci.days_remaining === "number" ? ci.days_remaining : null;
  var chip = "";
  if (days !== null) {
    var cls = days < 0 || days < 7 ? "chip-er" : days < 30 ? "chip-wr" : "chip-ok";
    var label =
      days < 0
        ? t("sec_ssl_expired_days").replace("{n}", String(-days))
        : t("sec_ssl_days_left").replace("{n}", String(days));
    chip = '<span class="chip ' + cls + '">' + esc(label) + "</span> ";
  }
  var sans = Array.isArray(ci.sans) && ci.sans.length ? esc(ci.sans.slice(0, 6).join(", ")) : "";
  return (
    "<div style=\"margin-top:6px\">" +
    chip +
    (sans
      ? '<span class="settings-item-desc">' +
        esc(t("sec_ssl_sans")) +
        ": " +
        sans +
        "</span>"
      : "") +
    "</div>"
  );
}

function _secPathRow(field, label, value, uploadField, uploadLabel) {
  var id = "sec" + field.charAt(0).toUpperCase() + field.slice(1) + "Path";
  return (
    '<div class="settings-item"><div style="flex:1">' +
    '<div class="settings-item-label">' +
    esc(label) +
    "</div>" +
    '<div class="sec-path-row">' +
    '<input class="form-input" id="' +
    id +
    '" value="' +
    esc(value || "") +
    '" placeholder="config/ssl/' +
    field.split("file")[0] +
    '.pem" spellcheck="false" />' +
    '<button class="btn btn-secondary btn-sm" onclick="secUploadCert(\'' +
    uploadField +
    "')\">" +
    esc(uploadLabel) +
    "</button>" +
    "</div></div></div>"
  );
}

function _secInlineRow(field, label, hasValue) {
  var id = "sec" + field.charAt(0).toUpperCase() + field.slice(1) + "Pem";
  var ph = hasValue ? t("sec_ssl_inline_set") : t("sec_ssl_inline_placeholder");
  return (
    '<div class="settings-item"><div style="flex:1">' +
    '<div class="settings-item-label">' +
    esc(label) +
    (hasValue
      ? ' <span class="chip chip-ok">' + esc(t("sec_ssl_inline_set_chip")) + "</span>"
      : "") +
    "</div>" +
    '<textarea class="form-input sec-ssl-textarea" id="' +
    id +
    '" rows="5" placeholder="' +
    esc(ph) +
    '" spellcheck="false"></textarea>' +
    '<button class="btn btn-secondary btn-xs" style="margin-top:6px" onclick="secReadLocal(\'' +
    field +
    "')\">" +
    esc(t("sec_ssl_read_local")) +
    "</button>" +
    "</div></div>"
  );
}

export function secSwitchMode(mode, btn) {
  _secSslMode = mode;
  var tabs = btn.parentElement.querySelectorAll(".sec-mode-tab");
  tabs.forEach(function (b) {
    b.classList.remove("active");
  });
  btn.classList.add("active");
  var pathEl = document.getElementById("secSslPathMode");
  var inlineEl = document.getElementById("secSslInlineMode");
  if (pathEl) pathEl.style.display = mode === "path" ? "" : "none";
  if (inlineEl) inlineEl.style.display = mode === "inline" ? "" : "none";
}

export function secUploadCert(field) {
  var input = document.createElement("input");
  input.type = "file";
  input.accept = ".pem,.crt,.cer,.key";
  input.onchange = async function () {
    if (!input.files || !input.files[0]) return;
    var fd = new FormData();
    fd.append(field, input.files[0]);
    var d = await api("/api/framework/ssl/upload", { method: "POST", body: fd });
    if (!d) return;
    if (d.success) {
      toast(t("sec_ssl_uploaded"), "ok");
      var path = field === "cert" ? d.cert_path : d.key_path;
      var id = field === "cert" ? "secCertfilePath" : "secKeyfilePath";
      var el = document.getElementById(id);
      if (el && path) el.value = path;
    } else {
      toast(d.error || t("unknown_error"), "er");
    }
  };
  input.click();
}

export function secReadLocal(field) {
  var input = document.createElement("input");
  input.type = "file";
  input.accept = ".pem,.crt,.cer,.key";
  input.onchange = function () {
    var f = input.files && input.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      var id = field === "cert" ? "secCertPem" : "secKeyPem";
      var el = document.getElementById(id);
      if (el) el.value = String(reader.result || "");
    };
    reader.readAsText(f);
  };
  input.click();
}

export async function secApplySsl() {
  if (!authed) return showLogin();
  var body;
  if (_secSslMode === "path") {
    body = {
      mode: "path",
      certfile: _secVal("secCertfilePath"),
      keyfile: _secVal("secKeyfilePath"),
    };
  } else {
    body = {
      mode: "inline",
      cert: _secVal("secCertPem"),
      key: _secVal("secKeyPem"),
    };
  }
  if (!body.certfile && !body.cert) {
    return toast(t("sec_ssl_need_pair"), "er");
  }
  var ok = await confirm2(
    t("sec_ssl_apply"),
    _secSslCanReload
      ? t("sec_ssl_apply_confirm_hot")
      : t("sec_ssl_apply_confirm_restart"),
  );
  if (!ok) return;
  var d = await api("/api/framework/ssl/apply", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!d) return;
  if (d.success) {
    toast(d.reloaded ? t("sec_ssl_applied_hot") : t("sec_ssl_saved_restart"), "ok");
    if (d.message && !d.reloaded) toast(d.message, "");
    loadSecuritySsl();
  } else {
    toast(d.error || t("unknown_error"), "er");
  }
}

export async function secClearSsl() {
  if (!authed) return showLogin();
  var ok = await confirm2(t("sec_ssl_clear"), t("sec_ssl_clear_confirm"));
  if (!ok) return;
  var d = await api("/api/framework/ssl/apply", {
    method: "POST",
    body: JSON.stringify({ clear: true }),
  });
  if (!d) return;
  if (d.success) {
    toast(d.reloaded ? t("sec_ssl_cleared_hot") : t("sec_ssl_saved_restart"), "ok");
    loadSecuritySsl();
  } else {
    toast(d.error || t("unknown_error"), "er");
  }
}

// ════════════════ 反向代理推荐（紧凑卡 + 模态窗生成） ════════════════

export async function loadSecurityProxy() {
  var host = document.getElementById("secProxyCard");
  if (!host) return;
  host.innerHTML =
    '<div class="card settings-card">' +
    '<div class="card-header">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>' +
    "<span>" +
    esc(t("sec_proxy_title")) +
    "</span>" +
    "</div>" +
    '<div class="settings-card-body">' +
    '<div class="settings-item-desc">' +
    esc(t("sec_proxy_desc_short")) +
    "</div>" +
    '<div class="sec-actions">' +
    '<button class="btn btn-primary btn-sm" onclick="secOpenProxyModal()">' +
    esc(t("sec_proxy_generate")) +
    "</button>" +
    "</div>" +
    '<div class="settings-item-desc" id="secProxySummary">' +
    esc(t("loading")) +
    "</div>" +
    "</div></div>";
  _secLoadProxySummary();
}

async function _secLoadProxySummary() {
  var el = document.getElementById("secProxySummary");
  if (!el) return;
  var d = await api("/api/routes");
  if (!d || !el.isConnected) return;
  var mods = {};
  (d.http_routes || []).forEach(function (r) {
    mods[r.module || "root"] = 1;
  });
  (d.ws_routes || []).forEach(function (r) {
    mods[r.module || "root"] = 1;
  });
  var nMod = Object.keys(mods).length;
  var nRoutes = (d.http_routes || []).length + (d.ws_routes || []).length;
  el.textContent = t("sec_proxy_summary")
    .replace("{n}", String(nMod))
    .replace("{m}", String(nRoutes));
}

async function _secUpstreamInfo() {
  // 上游地址自动识别：主机取浏览器地址栏（用户当前可达的入口），
  // 端口优先取地址栏端口（直连场景即框架端口），经代理访问时回退框架配置端口
  var hostName = location.hostname || "127.0.0.1";
  var cfgPort = 8000;
  var c = await api("/api/config");
  if (c && c.config) {
    var server = (c.config["ErisPulse"] || {}).server || {};
    var p = parseInt(server.port, 10);
    if (!isNaN(p) && p > 0) cfgPort = p;
  }
  var locPort = parseInt(location.port, 10);
  var port =
    !isNaN(locPort) && locPort > 0 && locPort !== 80 && locPort !== 443
      ? locPort
      : cfgPort;
  return { hostName: hostName, port: port, upstream: hostName + ":" + port };
}

function _secUpstreamHint(upstream) {
  return (
    '<div class="sec-hint">' +
    esc(t("sec_proxy_upstream_hint").replace("{upstream}", upstream)) +
    "</div>"
  );
}

// 模态第一步：选择「开放全部路由」或「按需选择模块」
export async function secOpenProxyModal() {
  if (!authed) return showLogin();
  var info = await _secUpstreamInfo();
  var html =
    '<div class="sec-proxy-modal">' +
    _secUpstreamHint(info.upstream) +
    '<div class="sec-choice-grid">' +
    '<button class="sec-proxy-choice" onclick="secProxyPick(\'all\')">' +
    "<b>" +
    esc(t("sec_proxy_pick_all")) +
    '</b><span class="settings-item-desc">' +
    esc(t("sec_proxy_pick_all_desc")) +
    "</span></button>" +
    '<button class="sec-proxy-choice" onclick="secProxyPick(\'custom\')">' +
    "<b>" +
    esc(t("sec_proxy_pick_custom")) +
    '</b><span class="settings-item-desc">' +
    esc(t("sec_proxy_pick_custom_desc")) +
    "</span></button>" +
    "</div>" +
    "</div>";
  showModal(t("sec_proxy_title"), html, [
    { label: t("ok"), value: true, primary: true },
  ]);
}

var _secProxyGroups = null;
var _secProxyOrder = [];

// 模态第二步：all 直接出全量配置；custom 出模块勾选列表
export async function secProxyPick(mode) {
  if (!authed) return showLogin();
  if (mode === "all") {
    _secProxyStageConfig(null);
    return;
  }
  var d = await api("/api/routes");
  var groups = {};
  (d.http_routes || []).forEach(function (r) {
    var m = r.module || "root";
    if (!groups[m]) groups[m] = { prefix: "/" + m, http: 0, ws: 0 };
    groups[m].http++;
  });
  (d.ws_routes || []).forEach(function (r) {
    var m = r.module || "root";
    if (!groups[m]) groups[m] = { prefix: "/" + m, http: 0, ws: 0 };
    groups[m].ws++;
  });
  var names = Object.keys(groups).sort(function (a, b) {
    if (a === "Dashboard") return -1;
    if (b === "Dashboard") return 1;
    return a.localeCompare(b);
  });
  if (!names.length) {
    toast(t("sec_routes_empty"), "er");
    return;
  }
  _secProxyGroups = groups;
  _secProxyOrder = names;

  var info = await _secUpstreamInfo();
  var rows = names
    .map(function (m, i) {
      var g = groups[m];
      return (
        '<label class="sec-mod-row">' +
        '<input type="checkbox" id="secModChk_' +
        i +
        '"' +
        (m === "Dashboard" ? " checked" : "") +
        " />" +
        '<code class="sec-route-prefix">' +
        esc(g.prefix) +
        "/</code>" +
        '<span class="settings-item-desc">' +
        esc(m) +
        " · " +
        g.http +
        " HTTP" +
        (g.ws ? " · " + g.ws + " WS" : "") +
        "</span>" +
        "</label>"
      );
    })
    .join("");
  var html =
    '<div class="sec-proxy-modal">' +
    _secUpstreamHint(info.upstream) +
    '<div class="settings-item-label" style="margin-bottom:8px">' +
    esc(t("sec_proxy_select_hint")) +
    "</div>" +
    '<div class="sec-mod-list">' +
    rows +
    "</div>" +
    '<div class="sec-actions">' +
    '<button class="btn btn-primary btn-sm" onclick="secProxyBuildCustom()">' +
    esc(t("sec_proxy_generate_selected")) +
    "</button>" +
    "</div>" +
    "</div>";
  showModal(t("sec_proxy_title"), html, [
    { label: t("ok"), value: true, primary: true },
  ]);
}

export function secProxyBuildCustom() {
  var selected = [];
  _secProxyOrder.forEach(function (m, i) {
    var el = document.getElementById("secModChk_" + i);
    if (el && el.checked) selected.push(_secProxyGroups[m].prefix);
  });
  if (!selected.length) return toast(t("sec_proxy_select_none"), "er");
  _secProxyStageConfig(selected);
}

// 模态第三步：输出 nginx / Caddy 配置（selected=null 为全量）
async function _secProxyStageConfig(selected) {
  var info = await _secUpstreamInfo();
  var nginx, caddy;
  if (!selected) {
    nginx = _secNginxSnippet("ep.example.com", "/", info.upstream);
    caddy = "ep.example.com {\n    reverse_proxy " + info.upstream + "\n}";
  } else {
    nginx = _secNginxMulti(selected, info.upstream);
    caddy = _secCaddyMulti(selected, info.upstream);
  }
  var html =
    '<div class="sec-proxy-modal">' +
    _secUpstreamHint(info.upstream) +
    '<div class="sec-proxy-block">' +
    _secCodeBlock("secCodeNginx", "nginx", nginx) +
    _secCodeBlock("secCodeCaddy", "caddy", caddy) +
    "</div>" +
    "</div>";
  showModal(t("sec_proxy_title"), html, [
    { label: t("ok"), value: true, primary: true },
  ]);
}

function _secNginxSnippet(serverName, location, upstream) {
  return (
    "server {\n" +
    "    listen 443 ssl;\n" +
    "    server_name " +
    serverName +
    ";\n" +
    "    # ssl_certificate     /path/fullchain.pem;\n" +
    "    # ssl_certificate_key /path/privkey.pem;\n" +
    "\n" +
    "    location " +
    location +
    " {\n" +
    "        proxy_pass http://" +
    upstream +
    ";\n" +
    "        proxy_http_version 1.1;\n" +
    "        proxy_set_header Host $host;\n" +
    "        proxy_set_header X-Real-IP $remote_addr;\n" +
    "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n" +
    "        proxy_set_header X-Forwarded-Proto $scheme;\n" +
    "        # WebSocket\n" +
    '        proxy_set_header Upgrade $http_upgrade;\n' +
    '        proxy_set_header Connection "upgrade";\n' +
    "        proxy_read_timeout 3600s;\n" +
    "    }\n" +
    "}"
  );
}

function _secNginxMulti(prefixes, upstream) {
  // 公共头放在 server 块（location 无自身 proxy_set_header 时自动继承），
  // 每个模块一个精简 location，配置整体可整段复制
  var locs = prefixes
    .map(function (p) {
      return (
        "    location " +
        p +
        "/ {\n        proxy_pass http://" +
        upstream +
        ";\n    }"
      );
    })
    .join("\n");
  return (
    "server {\n" +
    "    listen 443 ssl;\n" +
    "    server_name dashboard.example.com;\n" +
    "    # ssl_certificate     /path/fullchain.pem;\n" +
    "    # ssl_certificate_key /path/privkey.pem;\n" +
    "\n" +
    "    proxy_http_version 1.1;\n" +
    "    proxy_set_header Host $host;\n" +
    "    proxy_set_header X-Real-IP $remote_addr;\n" +
    "    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n" +
    "    proxy_set_header X-Forwarded-Proto $scheme;\n" +
    "    # WebSocket\n" +
    '    proxy_set_header Upgrade $http_upgrade;\n' +
    '    proxy_set_header Connection "upgrade";\n' +
    "    proxy_read_timeout 3600s;\n" +
    "\n" +
    locs +
    "\n}"
  );
}

function _secCaddyMulti(prefixes, upstream) {
  return (
    "dashboard.example.com {\n" +
    prefixes
      .map(function (p) {
        return (
          "    handle " +
          p +
          "/* {\n        reverse_proxy " +
          upstream +
          "\n    }"
        );
      })
      .join("\n") +
    "\n}"
  );
}

function _secCodeBlock(id, label, code) {
  return (
    '<div class="sec-code-wrap">' +
    '<div class="sec-code-head"><span class="sec-code-lang">' +
    esc(label) +
    "</span>" +
    '<button class="btn btn-secondary btn-xs" onclick="secCopyCode(\'' +
    id +
    "')\">" +
    esc(t("sec_copy")) +
    "</button></div>" +
    '<pre class="sec-code" id="' +
    id +
    '">' +
    esc(code) +
    "</pre></div>"
  );
}

export function secCopyCode(id) {
  var el = document.getElementById(id);
  if (!el) return;
  _copyToClipboard(el.textContent);
  toast(t("sec_copied"), "ok");
}

export function secCopyCodeText(text) {
  _copyToClipboard(text);
  toast(t("sec_copied"), "ok");
}

// ════════════════ 访问安全（token） ════════════════

export function loadSecurityAccess() {
  var host = document.getElementById("secAccessCard");
  if (!host) return;
  var tk = localStorage.getItem("__ep_tk__") || "";
  var masked =
    tk.length > 12
      ? tk.slice(0, 6) + "••••••" + tk.slice(-4)
      : "••••••";
  host.innerHTML =
    '<div class="card settings-card">' +
    '<div class="card-header">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>' +
    "<span>" +
    esc(t("sec_token_title")) +
    "</span>" +
    "</div>" +
    '<div class="settings-card-body">' +
    '<div class="settings-item"><div>' +
    '<div class="settings-item-label">' +
    esc(t("sec_token_label")) +
    "</div>" +
    '<div class="settings-item-desc">' +
    esc(t("sec_token_desc")) +
    "</div>" +
    "</div>" +
    '<div class="settings-item-control">' +
    "<code>" +
    esc(masked) +
    "</code>" +
    "</div></div>" +
    '<div class="settings-item"><div>' +
    '<div class="settings-item-label">' +
    esc(t("sec_lockout_label")) +
    "</div>" +
    '<div class="settings-item-desc">' +
    esc(t("sec_lockout_desc")) +
    "</div>" +
    "</div></div>" +
    '<div class="sec-actions">' +
    '<button class="btn btn-secondary btn-sm" onclick="secCopyToken()">' +
    esc(t("sec_copy")) +
    "</button>" +
    '<button class="btn btn-danger btn-sm" onclick="secRegenToken()">' +
    esc(t("sec_token_regen")) +
    "</button>" +
    "</div>" +
    "</div></div>";
}

export function secCopyToken() {
  var tk = localStorage.getItem("__ep_tk__") || "";
  if (!tk) return toast(t("unknown_error"), "er");
  _copyToClipboard(tk);
  toast(t("sec_copied"), "ok");
}

// ── 令牌重生成：预览 → 复制 → 确认应用（应用前旧令牌始终有效） ──
function _secRandomToken() {
  var bytes = new Uint8Array(32);
  if (window.crypto && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (var i = 0; i < 32; i++)
      bytes[i] = Math.floor(Math.random() * 256);
  }
  var s = btoa(String.fromCharCode.apply(null, bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function secRegenToken() {
  if (!authed) return showLogin();
  // 步骤 1：本地生成新令牌并预览，用户复制确认前什么都不会发生
  var newToken = _secRandomToken();
  var preview = await showModal(
    t("sec_token_preview_title"),
    '<div class="settings-item-desc" style="margin-bottom:10px">' +
      esc(t("sec_token_preview_desc")) +
      "</div>" +
      '<pre class="sec-code" id="secNewToken">' +
      esc(newToken) +
      "</pre>" +
      '<div style="margin-top:8px;text-align:right">' +
      '<button class="btn btn-secondary btn-xs" onclick="secCopyCode(\'secNewToken\')">' +
      esc(t("sec_copy")) +
      "</button></div>",
    [
      { label: t("cancel"), value: "cancel" },
      { label: t("sec_token_apply"), value: "apply", primary: true },
    ],
  );
  if (preview !== "apply") return; // 取消：旧令牌继续有效，本次生成作废
  // 步骤 2：应用（旧令牌立即失效）
  var d = await api("/api/security/token/regenerate", {
    method: "POST",
    body: JSON.stringify({ token: newToken }),
  });
  if (!d || !d.success) return toast(d && d.error ? d.error : t("unknown_error"), "er");
  localStorage.setItem("__ep_tk__", d.token);
  toast(t("sec_token_regen_ok"), "ok");
  loadSecurityAccess();
}

// ════════════════ 路由安全配置 ════════════════

export async function loadSecurityRouter() {
  var host = document.getElementById("secRouterCard");
  if (!host) return;
  var d = await api("/api/config");
  var routerCfg = ((d && d.config && d.config["ErisPulse"]) || {}).router || {};
  var cors = routerCfg.cors;
  var security = routerCfg.security;
  host.innerHTML =
    '<div class="card settings-card">' +
    '<div class="card-header">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>' +
    "<span>" +
    esc(t("sec_router_title")) +
    "</span>" +
    "</div>" +
    '<div class="settings-card-body">' +
    '<div class="settings-item-desc">' +
    esc(t("sec_router_desc")) +
    "</div>" +
    _secRouterRow("cors", "ErisPulse.router.cors", cors, t("sec_router_cors")) +
    _secRouterRow("security", "ErisPulse.router.security", security, t("sec_router_security")) +
    "</div></div>";
}

function _secRouterRow(field, key, value, label) {
  var text =
    value === undefined || value === null
      ? "{}"
      : JSON.stringify(value, null, 2);
  return (
    '<div class="settings-item"><div style="flex:1">' +
    '<div class="settings-item-label">' +
    esc(label) +
    ' <code class="sec-route-prefix">' +
    esc(key) +
    "</code></div>" +
    '<textarea class="form-input sec-ssl-textarea" id="secRouter' +
    field +
    '" rows="4" spellcheck="false">' +
    esc(text) +
    "</textarea>" +
    '<button class="btn btn-secondary btn-xs" style="margin-top:6px" onclick="secSaveRouter(\'' +
    field +
    "', '" +
    key +
    "')\">" +
    esc(t("sec_router_save")) +
    "</button>" +
    "</div></div>"
  );
}

export async function secSaveRouter(field, key) {
  if (!authed) return showLogin();
  var el = document.getElementById("secRouter" + field);
  if (!el) return;
  var value;
  try {
    value = JSON.parse(el.value || "null");
  } catch (e) {
    return toast(t("sec_router_invalid_json"), "er");
  }
  var ok = await confirm2(t("sec_router_save"), t("sec_router_restart_hint"));
  if (!ok) return;
  var d = await api("/api/config", {
    method: "PUT",
    body: JSON.stringify({ key: key, value: value }),
  });
  if (!d || !d.success) return toast(t("save_failed"), "er");
  toast(t("sec_router_saved"), "ok");
}

// ════════════════ 审计日志 ════════════════

export async function secShowAudit() {
  if (!authed) return showLogin();
  var d = await api("/api/audit?limit=100");
  var rows = "";
  if (d && d.logs && d.logs.length) {
    rows = d.logs
      .slice()
      .reverse()
      .map(function (l) {
        var ts = l.timestamp ? new Date(l.timestamp * 1000).toLocaleString() : "-";
        return (
          "<tr><td>" +
          esc(ts) +
          "</td><td>" +
          esc(l.action || "-") +
          "</td><td>" +
          esc(l.detail || "") +
          "</td><td>" +
          esc(l.ip || "") +
          "</td></tr>"
        );
      })
      .join("");
  }
  var html = rows
    ? '<div class="sec-audit-wrap"><table class="sec-audit-table"><thead><tr><th>' +
      esc(t("sec_audit_time")) +
      "</th><th>" +
      esc(t("sec_audit_action")) +
      "</th><th>" +
      esc(t("sec_audit_detail")) +
      "</th><th>IP</th></tr></thead><tbody>" +
      rows +
      "</tbody></table></div>"
    : '<p class="empty-state">' + esc(t("sec_audit_empty")) + "</p>";
  showModal(t("sec_audit_title"), html, [
    { label: t("ok"), value: true, primary: true },
  ]);
}

export function loadSecurityAudit() {
  var host = document.getElementById("secAuditCard");
  if (!host) return;
  host.innerHTML =
    '<div class="card settings-card">' +
    '<div class="card-header">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>' +
    "<span>" +
    esc(t("sec_audit_title")) +
    "</span>" +
    "</div>" +
    '<div class="settings-card-body">' +
    '<div class="settings-item"><div>' +
    '<div class="settings-item-label">' +
    esc(t("sec_audit_label")) +
    "</div>" +
    '<div class="settings-item-desc">' +
    esc(t("sec_audit_desc")) +
    "</div>" +
    "</div>" +
    '<div class="settings-item-control">' +
    '<button class="btn btn-secondary btn-sm" onclick="secShowAudit()">' +
    esc(t("sec_audit_view")) +
    "</button>" +
    "</div></div>" +
    "</div></div>";
}
