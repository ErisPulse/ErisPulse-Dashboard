// ErisPulse Dashboard – pages/files (auto-split from dash.js)

try {
  _fmIsWindows =
    /win/i.test(navigator.platform || "") ||
    /Windows/.test(navigator.userAgent) ||
    String(navigator.userAgentData && navigator.userAgentData.platform || "").toLowerCase() === "windows";
} catch (e) {
  _fmIsWindows = false;
};

export function debounceFmSearch() {
  clearTimeout(_fmSearchTimer);
  _fmSearchTimer = setTimeout(() => fmBrowse(_fmCurrentPath), 300);
}

export function fmGetMode(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  const modes = {
    js: "javascript",
    json: "javascript",
    mjs: "javascript",
    py: "python",
    pyw: "python",
    html: "htmlmixed",
    htm: "htmlmixed",
    css: "css",
    xml: "xml",
    svg: "xml",
    md: "markdown",
    markdown: "markdown",
    toml: "toml",
    yaml: "yaml",
    yml: "yaml",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    txt: "text",
  };
  return modes[ext] || "text";
}

export function fmFormatSize(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + " " + units[i];
}

export function fmFormatTime(ts) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleString(getLocale(), {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmGetIcon(type, name) {
  if (type === "directory")
    return '<svg class="fm-icon folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>';
  var ext = (name || "").split(".").pop().toLowerCase();
  var color = FM_EXT_COLORS[ext] || FM_EXT_COLORS._;
  return (
    '<svg class="fm-icon file" style="color:' +
    color +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
  );
}

export function fmUpdateBreadcrumb(path, count) {
  const bc = document.getElementById("fmBreadcrumb");
  const parts = path === "." ? [] : path.split("/");
  let html =
    '<span class="fm-crumb' +
    (parts.length === 0 ? " active" : "") +
    '" onclick="fmNavigateTo(\'.\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;vertical-align:middle"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg></span>';
  let accumulated = "";
  parts.forEach((part, i) => {
    accumulated += (accumulated ? "/" : "") + part;
    const p = accumulated;
    html +=
      '<span class="fm-crumb-sep">/</span><span class="fm-crumb' +
      (i === parts.length - 1 ? " active" : "") +
      '" onclick="fmNavigateTo(\'' +
      esc(p) +
      "')\">" +
      esc(part) +
      "</span>";
  });
  if (count !== undefined) {
    html += '<span class="fm-crumb-count">(' + count + ")</span>";
  }
  bc.innerHTML = html;
}

export function fmNavigateTo(path) {
  _fmCurrentPath = path;
  fmBrowse(path);
}

export function fmGoUp() {
  if (_fmCurrentPath === ".") return;
  const parts = _fmCurrentPath.split("/");
  parts.pop();
  fmNavigateTo(parts.length ? parts.join("/") : ".");
}

export function fmToggleHidden() {
  _fmShowHidden = !_fmShowHidden;
  const btn = document.getElementById("fmHiddenBtn");
  btn.style.background = _fmShowHidden ? "var(--accent)" : "";
  fmBrowse(_fmCurrentPath);
}

export function fmRefresh() {
  fmBrowse(_fmCurrentPath);
}

export async function fmBrowse(path) {
  _fmCurrentPath = path;
  const search = document.getElementById("fmSearch")?.value || "";
  const params = new URLSearchParams({
    path,
    hidden: _fmShowHidden ? "true" : "false",
  });
  if (search) params.set("pattern", "*" + search + "*");
  const d = search
    ? await api("/api/files/search?" + params)
    : await api("/api/files/browse?" + params);
  if (!d) return;
  if (d.error) {
    toast(d.error, "er");
    return;
  }

  const entries = d.entries || d.results || [];
  fmUpdateBreadcrumb(d.path || path, entries.length);

  const fileList = document.getElementById("fmFileList");
  if (entries.length === 0) {
    fileList.innerHTML = renderUxEmpty(
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
      "no_data"
    );
    return;
  }

  fileList.innerHTML = entries
    .map((e) => {
      const isDir = e.type === "directory";
      const icon = fmGetIcon(e.type, e.name);
      const size = isDir ? "--" : fmFormatSize(e.size || 0);
      const mtime = fmFormatTime(e.modified);
      const rowActions = !isDir
        ? '<button class="fm-card-action" onclick="event.stopPropagation();fmDownload(\'' +
          esc(e.path) +
          '\')" title="' + esc(t("download")) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>' +
          '<button class="fm-card-action" onclick="event.stopPropagation();fmEditFile(\'' +
          esc(e.path) +
          '\')" title="' + esc(t("edit")) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'
        : "";
      return (
        '<div class="fm-file-card' + (isDir ? " is-dir" : "") + '" ondblclick="' +
        (isDir
          ? "fmNavigateTo('" + esc(e.path) + "')"
          : "fmEditFile('" + esc(e.path) + "')") +
        '" oncontextmenu="fmContextMenu(event,\'' +
        esc(e.path) +
        "','" +
        esc(e.type) +
        "')\">" +
        '<div class="fm-card-icon">' + icon + "</div>" +
        '<div class="fm-card-body">' +
        '<span class="fm-card-name' + (isDir ? " folder-name" : "") + '">' + esc(e.name) + "</span>" +
        '<span class="fm-card-meta">' + size + " · " + esc(mtime) + "</span>" +
        "</div>" +
        '<div class="fm-card-actions">' + rowActions + "</div>" +
        "</div>"
      );
    })
    .join("");
}

export function fmContextMenu(event, path, type) {
  event.preventDefault();
  event.stopPropagation();
  if (_fmContextMenu) _fmContextMenu.remove();

  const isDir = type === "directory";
  const menu = document.createElement("div");
  menu.className = "fm-context-menu";
  menu.style.left = event.clientX + "px";
  menu.style.top = event.clientY + "px";

  let items = "";
  if (isDir) {
    items += fmCtxItem(
      t("files"),
      '<polyline points="9 18 15 12 9 6"/>',
      "fmNavigateTo('" + esc(path) + "')",
    );
  } else {
    items += fmCtxItem(
      t("files"),
      '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>',
      "fmEditFile('" + esc(path) + "')",
    );
    items += fmCtxItem(
      t("download"),
      '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
      "fmDownload('" + esc(path) + "')",
    );
  }
  items += '<div class="fm-ctx-sep"></div>';
  if (!_fmIsWindows) {
    items += fmCtxItem(
      t("permissions"),
      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-2.82 1.18V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001-1.51 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 002.82-1.18V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.2.65.77 1.09 1.51 1.08H21a2 2 0 010 4h-.09c-.74 0-1.31.44-1.51 1.08z"/>',
      "fmChmod('" + esc(path) + "')",
    );
  }
  items += fmCtxItem(
    t("rename_label"),
    '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/>',
    "fmRename('" + esc(path) + "')",
  );
  const fname = path.split("/").pop().toLowerCase();
  if (
    fname.endsWith(".zip") ||
    fname.endsWith(".tar.gz") ||
    fname.endsWith(".tgz") ||
    fname.endsWith(".tar.bz2") ||
    fname.endsWith(".tar.xz") ||
    fname.endsWith(".tar")
  ) {
    items += fmCtxItem(
      t("decompress"),
      '<polyline points="17 1 21 5 17 9"/><path d="M3 7V5a2 2 0 012-2h12"/><line x1="9" y1="12" x2="15" y2="12"/>',
      "fmDecompress('" + esc(path) + "')",
    );
  }
  items += '<div class="fm-ctx-sep"></div>';
  items +=
    '<div class="fm-ctx-item danger" onclick="fmDelete(\'' +
    esc(path) +
    '\');this.closest(\'.fm-context-menu\').remove()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg><span>' +
    t("delete") +
    "</span></div>";

  menu.innerHTML = items;
  document.body.appendChild(menu);
  _fmContextMenu = menu;

  const close = () => {
    menu.remove();
    _fmContextMenu = null;
    document.removeEventListener("click", close);
  };
  setTimeout(() => document.addEventListener("click", close), 0);
}

export function fmCtxItem(label, svgPath, onclick) {
  return (
    '<div class="fm-ctx-item" onclick="' +
    onclick +
    ';this.closest(\'.fm-context-menu\').remove()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
    svgPath +
    "</svg><span>" +
    label +
    "</span></div>"
  );
}

export async function fmEditFile(path) {
  const d = await api("/api/files/read?path=" + encodeURIComponent(path));
  if (!d) return;
  if (d.error) {
    if (d.binary) toast(t("binary_file"), "er");
    else if (d.error === "File too large")
      toast(t("file_too_large") + " (" + fmFormatSize(d.size) + ")", "er");
    else toast(d.error, "er");
    return;
  }
  _fmEditPath = path;
  _fmDirty = false;
  const overlay = document.getElementById("fmEditorOv");
  document.getElementById("fmEditorTitle").textContent = path;
  document.getElementById("fmEditorStatus").textContent = "";

  const container = document.getElementById("fmEditorContainer");
  if (typeof CodeMirror !== "undefined") {
    if (_fmEditor) _fmEditor.toTextArea();
    const textarea = document.createElement("textarea");
    container.innerHTML = "";
    container.appendChild(textarea);
    textarea.value = d.content;
    _fmEditor = CodeMirror.fromTextArea(textarea, {
      mode: fmGetMode(path),
      theme:
        document.documentElement.getAttribute("data-theme") === "dark"
          ? "dracula"
          : "default",
      lineNumbers: true,
      matchBrackets: true,
      autoCloseBrackets: true,
      lineWrapping: true,
      tabSize: 4,
      indentUnit: 4,
    });
    _fmEditor.on("change", () => {
      _fmDirty = true;
      document.getElementById("fmEditorStatus").textContent = "●";
      document.getElementById("fmEditorStatus").style.color = "var(--wr-c)";
    });
    _fmEditor.setSize("100%", "100%");
  } else {
    container.innerHTML =
      '<textarea id="fmFallbackEditor" class="code-editor" style="width:100%;height:100%;box-sizing:border-box" spellcheck="false">' +
      esc(d.content) +
      "</textarea>";
    document.getElementById("fmFallbackEditor").addEventListener("input", () => {
      _fmDirty = true;
      document.getElementById("fmEditorStatus").textContent = "●";
      document.getElementById("fmEditorStatus").style.color = "var(--wr-c)";
    });
  }
  overlay.classList.add("show");
  setTimeout(() => { if (_fmEditor) _fmEditor.refresh(); }, 100);
}

export async function fmSaveFile() {
  if (!_fmEditPath) return;
  let content;
  if (_fmEditor) {
    content = _fmEditor.getValue();
  } else {
    const ta = document.getElementById("fmFallbackEditor");
    content = ta ? ta.value : "";
  }
  const d = await api("/api/files/write", {
    method: "PUT",
    body: JSON.stringify({ path: _fmEditPath, content }),
  });
  if (d && d.success) {
    _fmDirty = false;
    document.getElementById("fmEditorStatus").textContent = t("file_saved");
    document.getElementById("fmEditorStatus").style.color = "var(--ok-c)";
    toast(t("file_saved"), "ok");
  } else {
    toast(d?.error || t("file_save_failed"), "er");
  }
}

export async function fmCloseEditor(force) {
  // 有未保存修改时先确认（Esc/遮罩/× 都走这里）
  if (_fmDirty && !force) {
    const ok = await confirm2(
      t("unsaved_confirm_title"),
      t("fm_unsaved_confirm"),
    );
    if (!ok) return;
  }
  document.getElementById("fmEditorOv").classList.remove("show");
  if (_fmEditor) {
    _fmEditor.toTextArea();
    _fmEditor = null;
  }
  _fmEditPath = "";
  _fmDirty = false;
}

export function fmDownload(path) {
  const tk = localStorage.getItem(TK);
  const url =
    API +
    "/api/files/download?path=" +
    encodeURIComponent(path) +
    (tk ? "&token=" + encodeURIComponent(tk) : "");
  window.open(url, "_blank");
}

export async function fmNewFile() {
  const name = await showModal(
    t("new_file"),
    '<input type="text" id="fmNewName" class="form-input" data-i18n-placeholder="new_file_name" placeholder="' +
      esc(t("new_file_name")) +
      '" style="width:100%">',
    [
      { label: t("cancel"), value: null },
      { label: t("ok"), value: "ok", primary: true },
    ],
  );
  if (!name) return;
  const input = document.getElementById("fmNewName");
  const fileName = input ? input.value.trim() : "";
  if (!fileName) return;
  const fullPath =
    _fmCurrentPath === "." ? fileName : _fmCurrentPath + "/" + fileName;
  const d = await api("/api/files/write", {
    method: "PUT",
    body: JSON.stringify({ path: fullPath, content: "" }),
  });
  if (d && d.success) {
    toast(t("file_saved"), "ok");
    fmBrowse(_fmCurrentPath);
  } else {
    toast(d?.error || t("file_save_failed"), "er");
  }
}

export async function fmNewFolder() {
  const name = await showModal(
    t("new_folder"),
    '<input type="text" id="fmNewName" class="form-input" data-i18n-placeholder="new_folder_name" placeholder="' +
      esc(t("new_folder_name")) +
      '" style="width:100%">',
    [
      { label: t("cancel"), value: null },
      { label: t("ok"), value: "ok", primary: true },
    ],
  );
  if (!name) return;
  const input = document.getElementById("fmNewName");
  const folderName = input ? input.value.trim() : "";
  if (!folderName) return;
  const fullPath =
    _fmCurrentPath === "." ? folderName : _fmCurrentPath + "/" + folderName;
  const d = await api("/api/files/mkdir", {
    method: "POST",
    body: JSON.stringify({ path: fullPath, recursive: true }),
  });
  if (d && d.success) {
    toast(t("action_completed"), "ok");
    fmBrowse(_fmCurrentPath);
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

export function fmUpload() {
  document.getElementById("fmUploadInput").click();
}

export async function fmDoUpload(input) {
  const files = input.files;
  if (!files || files.length === 0) return;
  const fd = new FormData();
  for (let i = 0; i < files.length; i++) {
    fd.append("files", files[i]);
  }
  const d = await api(
    "/api/files/upload?path=" + encodeURIComponent(_fmCurrentPath),
    {
      method: "POST",
      body: fd,
    },
  );
  if (d && d.success) {
    toast(t("upload_success") + " (" + d.count + ")", "ok");
    fmBrowse(_fmCurrentPath);
  } else {
    toast(d?.error || t("upload_failed"), "er");
  }
  input.value = "";
}

export async function fmDelete(path) {
  const ok = await confirm2(t("delete"), t("delete_confirm"));
  if (!ok) return;
  const d = await api("/api/files/delete", {
    method: "POST",
    body: JSON.stringify({ paths: [path] }),
  });
  if (d && d.success) {
    toast(t("delete_success"), "ok");
    fmBrowse(_fmCurrentPath);
  } else {
    toast(d?.error || t("delete_failed"), "er");
  }
}

export async function fmRename(path) {
  const oldName = path.split("/").pop();
  const result = await showModal(
    t("rename_label"),
    '<input type="text" id="fmRenameInput" class="form-input" value="' +
      esc(oldName) +
      '" style="width:100%">',
    [
      { label: t("cancel"), value: null },
      { label: t("ok"), value: "ok", primary: true },
    ],
  );
  if (!result) return;
  const input = document.getElementById("fmRenameInput");
  const newName = input ? input.value.trim() : "";
  if (!newName || newName === oldName) return;
  const dir = path.includes("/")
    ? path.substring(0, path.lastIndexOf("/"))
    : ".";
  const newPath = dir === "." ? newName : dir + "/" + newName;
  const d = await api("/api/files/rename", {
    method: "POST",
    body: JSON.stringify({ old_path: path, new_path: newPath }),
  });
  if (d && d.success) {
    toast(t("rename_success"), "ok");
    fmBrowse(_fmCurrentPath);
  } else {
    toast(d?.error || t("rename_failed"), "er");
  }
}

export async function fmChmod(path) {
  const result = await showModal(
    t("chmod"),
    '<input type="text" id="fmChmodInput" class="form-input" placeholder="755" style="width:100%">',
    [
      { label: t("cancel"), value: null },
      { label: t("ok"), value: "ok", primary: true },
    ],
  );
  if (!result) return;
  const input = document.getElementById("fmChmodInput");
  const mode = input ? input.value.trim() : "";
  if (!mode || !/^[0-7]{3,4}$/.test(mode)) {
    toast("Invalid mode", "er");
    return;
  }
  const d = await api("/api/files/chmod", {
    method: "POST",
    body: JSON.stringify({ path, mode }),
  });
  if (d && d.success) {
    toast(t("action_completed"), "ok");
    fmBrowse(_fmCurrentPath);
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

document.addEventListener("keydown", function (e) {
  if (e.ctrlKey && e.key === "s" && _fmEditPath) {
    e.preventDefault();
    fmSaveFile();
  }
});;

export async function fmCompress() {
  if (!authed) return showLogin();
  const allRows = document.querySelectorAll("#fmFileList .fm-file-card");
  if (allRows.length === 0) {
    toast(t("no_data"), "");
    return;
  }
  const archiveName = await showModal(
    t("compress"),
    '<input type="text" id="fmCompressName" class="form-input" value="archive.zip" style="width:100%">',
    [
      { label: t("cancel"), value: null },
      { label: t("ok"), value: "ok", primary: true },
    ],
  );
  if (!archiveName) return;
  const name =
    document.getElementById("fmCompressName")?.value?.trim() || "archive.zip";
  const paths = [];
  allRows.forEach((row) => {
    const nameEl = row.querySelector(".fm-card-name");
    if (nameEl) {
      const n = nameEl.textContent;
      paths.push(_fmCurrentPath === "." ? n : _fmCurrentPath + "/" + n);
    }
  });
  if (paths.length === 0) return;
  const resp = await fetch(API + "/api/files/compress", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + localStorage.getItem(TK),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paths, archive_name: name }),
  });
  if (resp.ok) {
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    toast(t("action_completed"), "ok");
    fmBrowse(_fmCurrentPath);
  } else {
    const err = await resp.json().catch(() => ({}));
    toast(err.error || t("action_failed"), "er");
  }
}

export async function fmDecompress(path) {
  if (!authed) return showLogin();
  const d = await api("/api/files/decompress", {
    method: "POST",
    body: JSON.stringify({ path }),
  });
  if (d && d.success) {
    toast(t("action_completed"), "ok");
    fmBrowse(_fmCurrentPath);
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}



// ── 文件编辑器：Esc / 点击遮罩关闭（含未保存确认）──
document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape") return;
  const ov = document.getElementById("fmEditorOv");
  if (ov && ov.classList.contains("show")) {
    e.preventDefault();
    e.stopPropagation();
    fmCloseEditor();
  }
});
document.addEventListener("DOMContentLoaded", function () {
  const ov = document.getElementById("fmEditorOv");
  if (!ov) return;
  ov.addEventListener("mousedown", function (e) {
    if (e.target === ov) fmCloseEditor();
  });
});
