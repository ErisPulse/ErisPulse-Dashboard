// ErisPulse Dashboard – pages/files
// 资源管理器式文件管理：面包屑导航、列表/网格双视图、点选+Ctrl 多选、
// 行内 ⋮ 菜单（移动端）、排序表头、全屏编辑模态窗

// ── 视图状态（view/sort 持久化） ──
_fmView = localStorage.getItem("ep_fm_view") === "grid" ? "grid" : "list";
_fmSort = { key: "name", dir: 1 };
_fmEntries = [];
_fmSelection = new Set();

try {
  _fmIsWindows =
    /win/i.test(navigator.platform || "") ||
    /Windows/.test(navigator.userAgent) ||
    String(navigator.userAgentData && navigator.userAgentData.platform || "").toLowerCase() === "windows";
} catch (e) {
  _fmIsWindows = false;
}

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
  if (!ts) return "--";
  return new Date(ts * 1000).toLocaleString(getLocale(), {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 文件类型 → 分类图标（代码/配置/图片/压缩包/文档/日志/密钥），着色沿用扩展名色表
const FM_CATEGORY_ICONS = {
  code: '<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>',
  config:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-2.82 1.18V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001-1.51 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 002.82-1.18V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.2.65.77 1.09 1.51 1.08H21a2 2 0 010 4h-.09c-.74 0-1.31.44-1.51 1.08z"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  archive:
    '<path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><line x1="10" y1="12" x2="14" y2="12"/>',
  doc: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
  log: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  file: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>',
};

const FM_EXT_CATEGORY = {
  code: ["py", "pyw", "js", "mjs", "ts", "html", "htm", "css", "xml", "svg", "sh", "bash", "zsh", "sql"],
  config: ["json", "toml", "yaml", "yml", "ini", "cfg", "conf", "env", "lock"],
  image: ["png", "jpg", "jpeg", "gif", "svg", "ico", "webp", "bmp"],
  archive: ["zip", "tar", "gz", "tgz", "bz2", "xz", "7z", "rar"],
  doc: ["md", "markdown", "txt", "rst", "pdf", "doc", "docx"],
  log: ["log", "out"],
  key: ["pem", "key", "crt", "cer"],
};

export function fmGetIcon(type, name) {
  if (type === "directory")
    return '<svg class="fm-icon folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>';
  const ext = (name || "").split(".").pop().toLowerCase();
  let category = "file";
  for (const cat in FM_EXT_CATEGORY) {
    if (FM_EXT_CATEGORY[cat].indexOf(ext) !== -1) {
      category = cat;
      break;
    }
  }
  const color = FM_EXT_COLORS[ext] || FM_EXT_COLORS._;
  return (
    '<svg class="fm-icon file" style="color:' +
    color +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    FM_CATEGORY_ICONS[category] +
    "</svg>"
  );
}

// ── 导航 ──

export function fmNavigateTo(path) {
  fmClearSelection();
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
  if (btn) btn.style.background = _fmShowHidden ? "var(--accent)" : "";
  fmBrowse(_fmCurrentPath);
}

export function fmRefresh() {
  fmBrowse(_fmCurrentPath);
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
      '<span class="fm-crumb-sep">›</span><span class="fm-crumb' +
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

// ── 视图 / 排序 ──

export function fmToggleView() {
  _fmView = _fmView === "list" ? "grid" : "list";
  localStorage.setItem("ep_fm_view", _fmView);
  const btn = document.getElementById("fmViewBtn");
  if (btn) btn.setAttribute("data-i18n-title", _fmView === "list" ? "fm_view_list" : "fm_view_grid");
  fmRender();
}

export function fmSetSort(key) {
  if (_fmSort.key === key) {
    _fmSort.dir = -_fmSort.dir;
  } else {
    _fmSort = { key: key, dir: 1 };
  }
  fmRender();
}

function fmSortedEntries() {
  const dirs = [];
  const files = [];
  _fmEntries.forEach((e) => (e.type === "directory" ? dirs : files).push(e));
  const k = _fmSort.key;
  const dir = _fmSort.dir;
  const cmp = (a, b) => {
    if (k === "size") return ((a.size || 0) - (b.size || 0)) * dir;
    if (k === "date") return ((a.modified || 0) - (b.modified || 0)) * dir;
    return String(a.name || "").localeCompare(String(b.name || ""), getLocale()) * dir;
  };
  dirs.sort(cmp);
  files.sort(cmp);
  return dirs.concat(files);
}

// ── 浏览与渲染 ──

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

  _fmEntries = d.entries || d.results || [];
  // 根目录不显示 .. 上级条目（上级用面包屑/上跳按钮）
  if (_fmCurrentPath === "." || _fmCurrentPath === "") {
    _fmEntries = _fmEntries.filter(
      (e) => !(e.type === "directory" && e.name === ".."),
    );
  }
  fmClearSelection();
  fmUpdateBreadcrumb(d.path || path, _fmEntries.length);
  fmRender();
}

function fmRender() {
  const fileList = document.getElementById("fmFileList");
  if (!fileList) return;

  fmUpdateSelBar();
  fmRenderHeadRow();

  const entries = fmSortedEntries();
  if (entries.length === 0) {
    fileList.innerHTML = renderUxEmpty(
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
      "no_data"
    );
    return;
  }

  fileList.className = "fm2-list" + (_fmView === "grid" ? " fm2-grid" : "");
  fileList.innerHTML = entries
    .map((e) => {
      const isDir = e.type === "directory";
      const sel = _fmSelection.has(e.path) ? " selected" : "";
      const icon = fmGetIcon(e.type, e.name);
      const size = isDir ? "--" : fmFormatSize(e.size || 0);
      const mtime = fmFormatTime(e.modified);
      const open = fmOpenCall(e);
      if (_fmView === "grid") {
        return (
          '<div class="fm2-tile' + sel + '" data-path="' + esc(e.path) + '"' +
          ' onclick="fmRowClick(event, \'' + esc(e.path) + '\', \'' + e.type + '\')"' +
          ' ondblclick="' + open + '"' +
          ' oncontextmenu="fmContextMenu(event, \'' + esc(e.path) + '\', \'' + e.type + '\')">' +
          '<div class="fm2-tile-icon">' + icon + "</div>" +
          '<div class="fm2-tile-name" title="' + esc(e.name) + '">' + esc(e.name) + "</div>" +
          '<div class="fm2-tile-meta">' + size + "</div>" +
          "</div>"
        );
      }
      return (
        '<div class="fm2-row' + (isDir ? " is-dir" : "") + sel + '" data-path="' + esc(e.path) + '"' +
        ' data-meta="' + esc(size + " · " + mtime) + '"' +
        ' onclick="fmRowClick(event, \'' + esc(e.path) + '\', \'' + e.type + '\')"' +
        ' ondblclick="' + open + '"' +
        ' oncontextmenu="fmContextMenu(event, \'' + esc(e.path) + '\', \'' + e.type + '\')">' +
        '<span class="fm2-icon">' + icon + "</span>" +
        '<span class="fm2-name" title="' + esc(e.name) + '">' + esc(e.name) + "</span>" +
        '<span class="fm2-date">' + mtime + "</span>" +
        '<span class="fm2-size">' + size + "</span>" +
        '<button class="fm2-rowmenu" onclick="fmToggleRowMenu(event, \'' + esc(e.path) + '\', \'' + e.type + '\')" aria-label="menu">' +
        '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>' +
        "</button>" +
        "</div>"
      );
    })
    .join("");
}

function fmOpenCall(e) {
  const p = esc(e.path);
  return e.type === "directory" ? "fmNavigateTo('" + p + "')" : "fmEditFile('" + p + "')";
}

function fmRenderHeadRow() {
  const head = document.getElementById("fmHeadRow");
  if (!head) return;
  head.style.display = _fmView === "list" ? "" : "none";
  const arrow = (key) =>
    _fmSort.key === key
      ? '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-left:2px">' +
        (_fmSort.dir > 0 ? '<polyline points="18 15 12 9 6 15"/>' : '<polyline points="6 9 12 15 18 9"/>') +
        "</svg>"
      : "";
  head.querySelector(".fm2-col-name").innerHTML =
    t("fm_col_name") + arrow("name");
  head.querySelector(".fm2-col-date").innerHTML =
    t("fm_col_modified") + arrow("date");
  head.querySelector(".fm2-col-size").innerHTML =
    t("fm_col_size") + arrow("size");
}

// ── 选择（桌面：单击选中，Ctrl 加选；移动端：直接打开，⋮ 出菜单） ──

export function fmRowClick(event, path, type) {
  // 移动端：单击即打开（桌面双击打开）
  if (window.innerWidth <= 768) {
    if (type === "directory") fmNavigateTo(path);
    else fmEditFile(path);
    return;
  }
  // 桌面普通单击不动作（正常交互）；选择是主动行为——Ctrl/Cmd+点击，
  // 避免误触即弹出操作条
  if (event.ctrlKey || event.metaKey) {
    event.stopPropagation();
    if (path === "..") return;
    if (_fmSelection.has(path)) _fmSelection.delete(path);
    else _fmSelection.add(path);
    fmRender();
  }
}

function fmSelectedPaths() {
  return Array.from(_fmSelection);
}

export function fmClearSelection() {
  _fmSelection = new Set();
  fmUpdateSelBar();
  document
    .querySelectorAll("#fmFileList .selected")
    .forEach((el) => el.classList.remove("selected"));
}

export function fmUpdateSelBar() {
  const bar = document.getElementById("fmSelBar");
  if (!bar) return;
  const n = _fmSelection.size;
  bar.style.display = n > 0 ? "" : "none";
  if (n === 0) return;
  const count = document.getElementById("fmSelCount");
  if (count)
    count.textContent = t("fm_selected_count").replace("{n}", n);
  const dl = document.getElementById("fmSelDownload");
  if (dl) {
    // 仅选中单个文件时提供下载（多选/目录隐藏）
    const entry = n === 1 ? _fmEntries.find((e) => e.path === fmSelectedPaths()[0]) : null;
    dl.style.display = entry && entry.type !== "directory" ? "" : "none";
  }
}

export async function fmDeleteSelected() {
  const paths = fmSelectedPaths();
  if (paths.length === 0) return;
  const ok = await confirm2(
    t("delete"),
    t("delete_confirm") + " (" + paths.length + ")",
  );
  if (!ok) return;
  const d = await api("/api/files/delete", {
    method: "POST",
    body: JSON.stringify({ paths }),
  });
  if (d && d.success) {
    toast(t("delete_success"), "ok");
    fmClearSelection();
    fmBrowse(_fmCurrentPath);
  } else {
    toast(d?.error || t("delete_failed"), "er");
  }
}

export function fmDownloadSelected() {
  const paths = fmSelectedPaths();
  if (paths.length === 1) fmDownload(paths[0]);
}

export async function fmCompressSelected() {
  const paths = fmSelectedPaths();
  if (paths.length === 0) return;
  await fmCompressPaths(paths);
}

// ── 行菜单（右键 / 移动端 ⋮） ──

export function fmToggleRowMenu(event, path, type) {
  event.stopPropagation();
  event.preventDefault();
  // 移动端 ⋮：菜单贴屏幕底部成 bottom-sheet
  fmShowContextMenu(event, path, type, window.innerWidth <= 768);
}

export function fmContextMenu(event, path, type) {
  event.preventDefault();
  event.stopPropagation();
  fmShowContextMenu(event, path, type, false);
}

function fmShowContextMenu(event, path, type, bottomSheet) {
  if (_fmContextMenu) _fmContextMenu.remove();

  const isDir = type === "directory";
  const menu = document.createElement("div");
  menu.className =
    "fm-context-menu" + (bottomSheet ? " fm-ctx-sheet" : "");

  let items = "";
  if (isDir) {
    items += fmCtxItem(
      t("files"),
      '<polyline points="9 18 15 12 9 6"/>',
      "fmNavigateTo('" + esc(path) + "')",
    );
  } else {
    items += fmCtxItem(
      t("edit"),
      '<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>',
      "fmEditFile('" + esc(path) + "')",
    );
    items += fmCtxItem(
      t("download"),
      '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
      "fmDownload('" + esc(path) + "')",
    );
  }
  items += fmCtxItem(
    t("compress"),
    '<path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><line x1="10" y1="12" x2="14" y2="12"/>',
    "fmCompressPaths(['" + esc(path) + "'], true)",
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

  if (bottomSheet) {
    menu.style.left = "";
    menu.style.top = "";
  } else {
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.min(event.clientX, window.innerWidth - r.width - 8) + "px";
    menu.style.top = Math.min(event.clientY, window.innerHeight - r.height - 8) + "px";
  }

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

// ── 编辑器模态窗 ──

// 编辑器 IDE 化：状态栏（光标位置/语言）+ 活动行 + 词法补全
function fmEditorStatusUpdate(cm) {
  const pos = cm.getCursor();
  const el = document.getElementById("fmStatusPos");
  if (el) el.textContent = "Ln " + (pos.line + 1) + ", Col " + (pos.ch + 1);
}

function fmEditorLangUpdate(path) {
  const el = document.getElementById("fmStatusLang");
  if (!el) return;
  const mode = fmGetMode(path);
  const names = {
    javascript: "JavaScript",
    python: "Python",
    htmlmixed: "HTML",
    css: "CSS",
    xml: "XML",
    markdown: "Markdown",
    toml: "TOML",
    yaml: "YAML",
    shell: "Shell",
    text: "Text",
  };
  el.textContent = names[mode] || "Text";
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
  const name = path.split("/").pop();
  // 头部图标与列表一致：按扩展名分类着色
  document.getElementById("fmEditorIcon").innerHTML = fmGetIcon("file", name);
  document.getElementById("fmEditorTitle").textContent = name;
  document.getElementById("fmEditorPath").textContent =
    path === name ? "/" : path.slice(0, path.length - name.length - 1);
  fmEditorLangUpdate(path);
  const st = document.getElementById("fmEditorStatus");
  st.textContent = "";
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
      styleActiveLine: true,
      lineWrapping: true,
      tabSize: 4,
      indentUnit: 4,
      extraKeys: {
        "Ctrl-Space": "autocomplete",
        "Ctrl-S": function (cm) { fmSaveFile(); },
      },
    });
    // 词法补全：输入单词字符 800ms 后自动弹出（Esc/点选关闭）
    let hintTimer = null;
    _fmEditor.on("inputRead", function (cm, change) {
      const ch = (change.text && change.text[0]) || "";
      if (!/^[A-Za-z0-9_$]$/.test(ch)) return;
      clearTimeout(hintTimer);
      hintTimer = setTimeout(function () {
        if (_fmEditor && String(_fmEditor.getValue()).length < 200000)
          _fmEditor.showHint({
            hint: CodeMirror.hint.anyword,
            completeSingle: false,
          });
      }, 800);
    });
    _fmEditor.on("cursorActivity", function (cm) {
      fmEditorStatusUpdate(cm);
    });
    _fmEditor.on("change", () => {
      _fmDirty = true;
      st.textContent = "● " + t("fm_status_unsaved");
      st.style.color = "var(--wr-c)";
    });
    _fmEditor.setSize("100%", "100%");
    fmEditorStatusUpdate(_fmEditor);
  } else {
    container.innerHTML =
      '<textarea id="fmFallbackEditor" class="code-editor" style="width:100%;height:100%;box-sizing:border-box" spellcheck="false">' +
      esc(d.content) +
      "</textarea>";
    document.getElementById("fmFallbackEditor").addEventListener("input", () => {
      _fmDirty = true;
      st.textContent = "● " + t("fm_status_unsaved");
      st.style.color = "var(--wr-c)";
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
  const st = document.getElementById("fmEditorStatus");
  if (d && d.success) {
    _fmDirty = false;
    st.textContent = t("file_saved");
    st.style.color = "var(--ok-c)";
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

// ── 增删改上传 ──

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

export function fmUploadFolder() {
  document.getElementById("fmUploadFolderInput").click();
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
});

// 压缩：优先压缩选区，无选区时压缩全部；download 压缩产物
export async function fmCompress() {
  const paths =
    _fmSelection.size > 0
      ? fmSelectedPaths()
      : fmSortedEntries().map((e) => e.path);
  if (paths.length === 0) {
    toast(t("no_data"), "");
    return;
  }
  await fmCompressPaths(paths);
}

export async function fmCompressPaths(paths, keepName) {
  const defaultName = "archive.zip";
  const archiveName = await showModal(
    t("compress"),
    '<input type="text" id="fmCompressName" class="form-input" value="' +
      defaultName +
      '" style="width:100%">',
    [
      { label: t("cancel"), value: null },
      { label: t("ok"), value: "ok", primary: true },
    ],
  );
  if (!archiveName) return;
  const name =
    document.getElementById("fmCompressName")?.value?.trim() || defaultName;
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
    fmClearSelection();
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

// ── 文件编辑器：Esc / 点击遮罩关闭（含未保存确认） ──
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
