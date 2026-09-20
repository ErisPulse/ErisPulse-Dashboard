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
    var s = document.getElementById("storeSearch");
    if (s) {
      e.preventDefault();
      s.focus();
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

