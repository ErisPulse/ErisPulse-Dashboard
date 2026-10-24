// ErisPulse Dashboard – pages/config (auto-split from dash.js)

export async function loadConfig() {
  const c = await api("/api/config");
  if (c && c.config) {
    window._kvData = c.config;
    window._fwData = c.config["ErisPulse"] || {};
    // 过滤掉 ErisPulse 键，不在树形视图中显示
    const treeData = {};
    for (const [k, v] of Object.entries(c.config)) {
      if (k !== "ErisPulse") treeData[k] = v;
    }
    requestAnimationFrame(function () {
      const treeEl = document.getElementById("configBodyTree");
      treeEl.innerHTML = "";
      _appendKvChunks(treeEl, kvTreeChunks(treeData, "config", ""));
    });
  }
  const s = await api("/api/storage");
  if (s) {
    document.getElementById("storageCount").textContent =
      (s.total || 0) + " " + t("storage_items");
    const k = s.keys || [];
    requestAnimationFrame(function () {
      document.getElementById("storageBody").innerHTML = k.length
        ? k
            .slice(0, 200)
            .map((x) => kvRow(esc(x), s.data[x], "storage", x))
            .join("")
        : '<div class="empty-state"><p>' + t("empty_storage") + "</p></div>";
    });
  }

  // 如果在源码视图，也加载源码
  if (document.getElementById("configBodySource").style.display !== "none") {
    await loadConfigSource();
  }
}

export function _cfgEditorTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dracula"
    : "default";
}

export async function _getCfgTomlMod() {
  if (_cfgTomlMod !== null) return _cfgTomlMod;
  try {
    _cfgTomlMod = await import(
      "https://cdn.jsdelivr.net/npm/smol-toml@1.7.1/+esm"
    );
  } catch (e) {
    _cfgTomlMod = false;
  }
  return _cfgTomlMod;
}

export function _ensureCfgSourceCM() {
  if (_cfgSourceCM) return _cfgSourceCM;
  var ta = document.getElementById("configSourceEditor");
  if (!ta || typeof CodeMirror === "undefined") return null;
  _cfgSourceCM = CodeMirror.fromTextArea(ta, {
    mode: "toml",
    theme: _cfgEditorTheme(),
    lineNumbers: true,
    matchBrackets: true,
    autoCloseBrackets: true,
    lineWrapping: true,
    tabSize: 4,
    indentUnit: 4,
  });
  _cfgSourceCM.setSize("100%", "500px");
  // 设置页编辑器偏好（主题/字号/缩进）需要触达实例，模块私有变量经 window 暴露
  window._cfgSourceCM = _cfgSourceCM;
  _cfgSourceCM.on("change", function () {
    _cfgSourceDirty = true;
    clearTimeout(_cfgValidateTimer);
    _cfgValidateTimer = setTimeout(_validateCfgToml, 300);
  });
  return _cfgSourceCM;
}

export async function _validateCfgToml() {
  var cm = _cfgSourceCM;
  if (!cm) return;
  var statusEl = document.getElementById("configSourceStatus");
  var content = cm.getValue();
  if (!content.trim()) {
    _cfgSourceOk = true;
    if (statusEl) {
      statusEl.textContent = "";
      statusEl.className = "cfg-source-status";
    }
    return;
  }
  var mod = await _getCfgTomlMod();
  if (!mod) {
    if (statusEl) {
      statusEl.textContent = "";
      statusEl.className = "cfg-source-status";
    }
    return;
  }
  try {
    mod.parse(content);
    _cfgSourceOk = true;
    if (statusEl) {
      statusEl.textContent = "✓ " + t("config_syntax_ok");
      statusEl.className = "cfg-source-status ok";
    }
  } catch (e) {
    _cfgSourceOk = false;
    var msg = e && e.message ? String(e.message).split("\n")[0] : String(e);
    if (statusEl) {
      statusEl.textContent = "✗ " + msg;
      statusEl.className = "cfg-source-status err";
    }
  }
}

export async function loadConfigSource() {
  const d = await api("/api/config/source");
  if (d && d.content != null) {
    var cm = _ensureCfgSourceCM();
    if (cm) {
      cm.setValue(d.content);
      _cfgSourceDirty = false;
      cm.setOption("theme", _cfgEditorTheme());
      setTimeout(function () {
        cm.refresh();
        _validateCfgToml();
      }, 100);
    } else {
      const editor = document.getElementById("configSourceEditor");
      if (editor) editor.value = d.content;
    }
  } else {
    toast(t("config_load_failed"), "er");
  }
}

// 危险操作守卫：源码有未保存修改时，重新加载前二次确认（丢弃修改不可撤销）
export async function reloadConfigSourceGuard() {
  if (_cfgSourceDirty) {
    var ok = await confirm2(t("unsaved_title"), t("unsaved_confirm"));
    if (!ok) return;
  }
  loadConfigSource();
}

export async function saveConfigSource() {
  var cm = _cfgSourceCM;
  var content = cm
    ? cm.getValue()
    : (document.getElementById("configSourceEditor") || {}).value;
  if (content == null) return;

  await _validateCfgToml();
  if (!_cfgSourceOk) {
    toast(t("config_syntax_err"), "er");
    return;
  }

  const d = await api("/api/config/source", {
    method: "POST",
    body: JSON.stringify({ content }),
  });

  if (d && d.success) {
    _cfgSourceDirty = false;
    toast(t("config_saved"), "ok");
    loadConfig();
  } else {
    toast(t("save_failed") + ": " + (d?.error || t("unknown_error")), "er");
  }
}

export async function switchConfigView(view, btn) {
  if (view === "tree" && _cfgSourceDirty) {
    var ok = await confirm2(t("unsaved_title"), t("unsaved_confirm"));
    if (!ok) return;
  }
  // 只作用于内部的 tree/source toggle，不影响外层 tab
  var headerActions = btn.closest(".header-actions");
  if (headerActions) {
    headerActions
      .querySelectorAll(".view-btn")
      .forEach((b) => b.classList.remove("active"));
  }
  btn.classList.add("active");
  const treeView = document.getElementById("configBodyTree");
  const sourceView = document.getElementById("configBodySource");
  if (view === "tree") {
    treeView.style.display = "block";
    sourceView.style.display = "none";
  } else {
    treeView.style.display = "none";
    sourceView.style.display = "block";
    loadConfigSource();
  }
}

document.addEventListener("keydown", function (e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  var tag = (e.target.tagName || "").toLowerCase();
  if (
    e.key === "/" &&
    tag !== "input" &&
    tag !== "textarea" &&
    !e.target.isContentEditable
  ) {
    e.preventDefault();
    // 商店页内保留原语义（聚焦商店搜索框），其他页面打开全局搜索
    if (document.querySelector(".page.active#p-store")) {
      var s = document.getElementById("storeSearch");
      if (s) s.focus();
    } else if (typeof openPalette === "function") {
      openPalette();
    }
  } else if (e.key === "Escape") {
    closeSidebar();
    var ov = document.getElementById("modalOv");
    if (ov && ov.classList.contains("show")) ov.classList.remove("show");
    if (typeof closeNodeDropdown === "function") closeNodeDropdown();
  } else if (e.key === "?") {
    e.preventDefault();
    showShortcutsHelp();
  }
});;

window.addEventListener("beforeunload", function (e) {
  if (_cfgSourceDirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});;

export function toggleKvGroup(hd) {
  const g = hd.parentElement;
  const body = g.querySelector(".kv-group-body");
  if (g.classList.contains("collapsed")) {
    if (!body.innerHTML) {
      const obj = window._kvData;
      function find(d, t) {
        const keys = t.split(".");
        let cur = d;
        for (const k of keys) {
          if (cur == null || typeof cur !== "object") return null;
          cur = cur[k];
        }
        return cur;
      }
      const data = find(obj, g.dataset.pfx);
      if (data && typeof data === "object") {
        body.innerHTML = "";
        _appendKvChunks(
          body,
          kvTreeChunks(
            data,
            g.dataset.mode,
            g.dataset.pfx,
            parseInt(g.dataset.dep),
          ),
        );
      }
    }
    g.classList.remove("collapsed");
  } else {
    g.classList.add("collapsed");
  }
}

export async function saveConfig(btn) {
  const inp = btn.previousElementSibling;
  const fk = inp.dataset.key;
  const tp = inp.dataset.type;
  let v = inp.value;
  if (tp === "boolean") v = v === "true";
  else if (tp === "number") v = Number(v);
  else if (tp === "object") {
    try {
      v = JSON.parse(v);
    } catch (e) {
      return;
    }
  }
  const d = await api("/api/config", {
    method: "PUT",
    body: JSON.stringify({ key: fk, value: v }),
  });
  inp.style.border =
    d && d.success ? "2px solid var(--ok-c)" : "2px solid var(--er-c)";
  setTimeout(() => (inp.style.border = ""), 1200);
}

export async function saveStorage(btn) {
  const inp = btn.previousElementSibling;
  const k = inp.dataset.key;
  let v = inp.value;
  try {
    v = JSON.parse(v);
  } catch (e) {}
  const d = await api("/api/storage", {
    method: "POST",
    body: JSON.stringify({ key: k, value: v }),
  });
  inp.style.border =
    d && d.success ? "2px solid var(--ok-c)" : "2px solid var(--er-c)";
  setTimeout(() => (inp.style.border = ""), 1200);
}

export async function delStorage(k, btn) {
  const row = btn.closest(".kv-row");
  const inp = row ? row.querySelector("input,textarea") : null;
  let oldVal = inp ? inp.value : "";
  if (/^[[{]/.test(oldVal)) {
    try {
      oldVal = JSON.parse(oldVal);
    } catch (e) {}
  }
  row.style.opacity = ".3";
  const d = await api("/api/storage/delete", {
    method: "POST",
    body: JSON.stringify({ key: k }),
  });
  if (d && d.success) {
    row.style.transition = "all .2s";
    requestAnimationFrame(() => {
      row.style.maxHeight = "0";
      row.style.padding = "0";
      row.style.overflow = "hidden";
      row.style.borderWidth = "0";
      setTimeout(() => row.remove(), 200);
    });
    toastUndo(t("storage_deleted") + ": " + k, function () {
      api("/api/storage", {
        method: "POST",
        body: JSON.stringify({ key: k, value: oldVal }),
      }).then(function () {
        toast(t("storage_restored"), "ok");
        loadConfig();
      });
    });
  } else row.style.opacity = "1";
}

// ════════════════ 存储表浏览器（Table Browser）════════════════
// KV 之上的表级浏览：表清单（搜索/行数/内建徽标）→ 表数据分页视图 → 危险清空。
// 后端端点：GET /api/storage/tables、GET /api/storage/table、POST /api/storage/table/clear

let _stBackend = "";
let _stTables = [];
let _stFilterText = "";
let _stCurrent = "";
let _stPage = 1;
let _stSize = 50;
let _stPages = 0;
let _stTotal = 0;
let _stBusy = false;

function _stSkeletonCards(n) {
  var h = "";
  for (var i = 0; i < n; i++)
    h +=
      '<div class="st-table-card"><div class="skeleton skeleton-text" style="width:62%"></div><div class="skeleton skeleton-text" style="width:38%"></div></div>';
  return h;
}

// 存储卡片内 KV / 数据表 视图切换（作用域限定本卡片 header-actions，与树形/源码切换互不影响）
export async function switchStorageView(view, btn) {
  var headerActions = btn.closest(".header-actions");
  if (headerActions)
    headerActions
      .querySelectorAll(".view-btn")
      .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  var kvPane = document.getElementById("storagePaneKv");
  var tablesPane = document.getElementById("storagePaneTables");
  if (view === "tables") {
    kvPane.style.display = "none";
    tablesPane.style.display = "block";
    await loadStorageTables();
  } else {
    kvPane.style.display = "block";
    tablesPane.style.display = "none";
  }
}

// 存储卡片刷新按钮：按当前视图分派（KV 视图保持原有 loadConfig 行为）
export function storageRefresh() {
  var tablesPane = document.getElementById("storagePaneTables");
  if (tablesPane && tablesPane.style.display !== "none") {
    if (
      _stCurrent &&
      document.getElementById("stDataView").style.display !== "none"
    ) {
      loadStorageTableData();
      loadStorageTables(true);
    } else {
      loadStorageTables();
    }
  } else loadConfig();
}

export async function loadStorageTables(silent) {
  if (_stBusy) return;
  _stBusy = true;
  var grid = document.getElementById("stTableGrid");
  if (!grid) {
    _stBusy = false;
    return;
  }
  if (!silent) grid.innerHTML = _stSkeletonCards(8);
  try {
    var d = await api("/api/storage/tables");
    if (!d || d.error) throw new Error(d && d.message ? d.message : "error");
    _stBackend = d.backend || "";
    _stTables = d.tables || [];
    _stRenderTables();
  } catch (e) {
    _stTables = [];
    if (grid) grid.innerHTML = "";
    var empty = document.getElementById("stListEmpty");
    if (empty) empty.style.display = "none";
    toast(
      t("storage_tables_load_failed") +
        ": " +
        (e.message || t("unknown_error")),
      "er",
    );
  } finally {
    _stBusy = false;
  }
}

export function stFilterTables(v) {
  _stFilterText = (v || "").toLowerCase();
  _stRenderTables();
}

function _stRenderTables() {
  var grid = document.getElementById("stTableGrid");
  var empty = document.getElementById("stListEmpty");
  var backendChip = document.getElementById("stBackendChip");
  if (backendChip) backendChip.textContent = _stBackend;
  if (!grid || !empty) return;
  var list = _stTables;
  if (_stFilterText)
    list = list.filter(
      (x) => x.name.toLowerCase().indexOf(_stFilterText) !== -1,
    );
  if (!list.length) {
    grid.innerHTML = "";
    empty.style.display = "flex";
    return;
  }
  empty.style.display = "none";
  grid.innerHTML = list
    .map(function (tb) {
      var rows = tb.rows == null ? "—" : String(tb.rows);
      var builtin = tb.builtin
        ? '<span class="chip chip-pr st-builtin">' +
          esc(t("storage_builtin")) +
          "</span>"
        : "";
      var open = "openStorageTable('" + _jsq(tb.name) + "')";
      return (
        '<div class="st-table-card" onclick="' + open + '">' +
        '<div class="st-table-card-head"><span class="st-table-card-name">' +
        esc(tb.name) +
        "</span>" +
        builtin +
        "</div>" +
        '<div class="st-table-card-meta"><span class="st-table-card-rows">' +
        rows +
        " " +
        esc(t("storage_rows")) +
        '</span><span class="st-table-card-view">' +
        esc(t("storage_view")) +
        " ›</span></div>" +
        "</div>"
      );
    })
    .join("");
}

export async function openStorageTable(name) {
  _stCurrent = String(name || "");
  if (!_stCurrent) return;
  _stPage = 1;
  var sizeSel = document.getElementById("stPageSize");
  if (sizeSel) sizeSel.value = String(_stSize);
  document.getElementById("stListView").style.display = "none";
  document.getElementById("stDataView").style.display = "block";
  document.getElementById("stCurrentName").textContent = _stCurrent;
  document.getElementById("stCurrentRows").textContent = "";
  await loadStorageTableData();
}

export function stBackToList() {
  _stCurrent = "";
  document.getElementById("stDataView").style.display = "none";
  document.getElementById("stListView").style.display = "block";
  // 返回清单时静默刷新行数（清空等操作后保持一致）
  loadStorageTables(true);
}

export async function loadStorageTableData() {
  if (!_stCurrent || _stBusy) return;
  _stBusy = true;
  var head = document.getElementById("stDataHead");
  var body = document.getElementById("stDataBody");
  var empty = document.getElementById("stDataEmpty");
  var pager = document.getElementById("stPager");
  if (!head || !body || !empty || !pager) {
    _stBusy = false;
    return;
  }
  head.innerHTML = "";
  body.innerHTML =
    '<tr><td colspan="99" style="padding:20px"><div class="skeleton skeleton-block" style="height:110px"></div></td></tr>';
  empty.style.display = "none";
  try {
    var d = await api(
      "/api/storage/table?name=" +
        encodeURIComponent(_stCurrent) +
        "&page=" +
        _stPage +
        "&size=" +
        _stSize,
    );
    if (!d || d.error) throw new Error(d && d.error ? d.error : "error");
    _stTotal = d.total || 0;
    _stPages = d.pages || 0;
    var cols = d.columns || [];
    var rows = d.rows || [];
    head.innerHTML =
      "<tr>" +
      cols
        .map(function (c) {
          return "<th>" + esc(c) + "</th>";
        })
        .join("") +
      "</tr>";
    if (!rows.length) {
      body.innerHTML = "";
      empty.style.display = "flex";
      pager.style.display = "none";
    } else {
      empty.style.display = "none";
      body.innerHTML = rows
        .map(function (r) {
          return "<tr>" + r.map(stCellHtml).join("") + "</tr>";
        })
        .join("");
      pager.style.display = "flex";
    }
    document.getElementById("stCurrentRows").textContent =
      _stTotal + " " + t("storage_rows");
    document.getElementById("stPagerInfo").textContent = t("storage_page_of")
      .replace("{page}", String(_stPage))
      .replace("{pages}", String(Math.max(_stPages, 1)))
      .replace("{total}", String(_stTotal));
    document.getElementById("stPageFirst").disabled = _stPage <= 1;
    document.getElementById("stPagePrev").disabled = _stPage <= 1;
    document.getElementById("stPageNext").disabled =
      _stPages <= 0 || _stPage >= _stPages;
    document.getElementById("stPageLast").disabled =
      _stPages <= 0 || _stPage >= _stPages;
  } catch (e) {
    body.innerHTML = "";
    pager.style.display = "none";
    toast(
      t("storage_table_load_failed") +
        ": " +
        (e.message || t("unknown_error")),
      "er",
    );
  } finally {
    _stBusy = false;
  }
}

// 单元格渲染：NULL 灰字 / BLOB 徽标 / 超长截断标记；title 承载全文
function stCellHtml(cell) {
  if (!cell || cell.v == null)
    return '<td><span class="st-cell st-cell-null">NULL</span></td>';
  var v = String(cell.v);
  var title = v;
  var inner = "";
  if (cell.bytes) {
    title = (cell.size != null ? cell.size + " bytes · " : "") + "base64: " + v;
    inner = '<span class="st-cell-blob">BLOB</span>';
  }
  if (cell.truncated)
    inner +=
      '<span class="st-cell-truncated">…</span>';
  return (
    '<td><span class="st-cell" title="' +
    esc(title) +
    '">' +
    inner +
    esc(v) +
    "</span></td>"
  );
}

export function stGotoPage(cmd) {
  var target = _stPage;
  if (cmd === "first") target = 1;
  else if (cmd === "prev") target = _stPage - 1;
  else if (cmd === "next") target = _stPage + 1;
  else if (cmd === "last") target = _stPages;
  else {
    var n = parseInt(cmd, 10);
    if (n >= 1) target = n;
  }
  if (target < 1) target = 1;
  if (_stPages > 0 && target > _stPages) target = _stPages;
  if (target === _stPage) return;
  _stPage = target;
  loadStorageTableData();
}

export async function stSetSize(v) {
  var n = parseInt(v, 10);
  if (!n || n < 1) n = 50;
  if (n === _stSize) return;
  _stSize = n;
  _stPage = 1;
  await loadStorageTableData();
}

// 危险操作：confirm2 说明后果 → 输入表名二次确认 → 后端 Delete 全表（记审计）
export async function clearStorageTable() {
  var name = _stCurrent;
  if (!name) return;
  var ok = await confirm2(
    t("storage_clear_title"),
    t("storage_clear_confirm")
      .replace("{name}", esc(name))
      .replace("{rows}", String(_stTotal)),
  );
  if (!ok) return;
  var typed = await prompt2(
    t("storage_clear_type_title"),
    t("storage_clear_type_hint").replace("{name}", name),
    "",
  );
  if (typed == null) return;
  if (typed.trim() !== name) {
    toast(t("storage_clear_mismatch"), "er");
    return;
  }
  var d = await api("/api/storage/table/clear", {
    method: "POST",
    body: JSON.stringify({ name: name }),
  });
  if (d && d.success) {
    toast(
      t("storage_cleared")
        .replace("{name}", name)
        .replace("{rows}", String(d.deleted == null ? 0 : d.deleted)),
      "ok",
    );
    await loadStorageTableData();
    loadStorageTables(true);
  } else {
    toast(
      t("save_failed") + ": " + (d && d.error ? d.error : t("unknown_error")),
      "er",
    );
  }
}

