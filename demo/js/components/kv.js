// ErisPulse Dashboard – components/kv (auto-split from dash.js)

export function kvRow(k, v, mode, fk) {
  const tp = v === null ? "null" : typeof v;
  const ds = tp === "object" ? JSON.stringify(v) : String(v);
  const isMultiline = ds.includes("\n") || ds.length > 100;
  const saveFn = mode === "config" ? "saveConfig(this)" : "saveStorage(this)";

  // 只允许编辑子项属性，不允许定义根值
  const isRootLevel = fk && !fk.includes(".");
  const canEdit = mode === "config" ? !isRootLevel : true;

  const inputHtml = isMultiline
    ? `<textarea class="kv-input kv-textarea" data-key="${esc(fk)}" data-type="${tp}"
                 rows="3" onfocus="this.select()"
                 onkeydown="if(event.key==='Enter' && !event.shiftKey){event.preventDefault();${saveFn}}">${esc(ds)}</textarea>`
    : `<input class="kv-input" type="text" value="${esc(ds)}" data-key="${esc(fk)}" data-type="${tp}"
                 ${canEdit ? "" : "readonly"} onfocus="this.select()"
                 onkeydown="if(event.key==='Enter'){event.preventDefault();${saveFn}}">`;

  const delBtn =
    mode === "storage"
      ? `<button class="kv-btn kv-btn-del" onclick="delStorage('${esc(fk)}',this)" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>`
      : "";

  const readOnlyIndicator = !canEdit
    ? '<span style="font-size:11px;color:var(--wr-c);margin-left:8px">' +
      t("read_only") +
      "</span>"
    : "";

  return `<div class="kv-row"><div class="kv-key">${esc(k)}</div><div class="kv-actions">${inputHtml}<button class="kv-btn kv-btn-save" onclick="${saveFn}" title="Save" ${!canEdit ? 'style="display:none"' : ""}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></button>${delBtn}${readOnlyIndicator}</div></div>`;
}

export function kvTreeChunks(obj, mode, pfx, dep) {
  dep = dep || 0;
  const chunks = [];
  for (const [k, v] of Object.entries(obj)) {
    const fk = pfx ? pfx + "." + k : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      chunks.push(
        '<div class="kv-group collapsed" style="margin-left:' +
          dep * 12 +
          'px" data-pfx="' +
          esc(fk) +
          '" data-mode="' +
          mode +
          '" data-dep="' +
          (dep + 1) +
          '"><div class="kv-group-hd" onclick="toggleKvGroup(this)"><span class="kv-chevron">\u25BC</span><span style="flex:1">' +
          esc(k) +
          '</span><span class="kv-count">' +
          Object.keys(v).length +
          '</span></div><div class="kv-group-body"></div></div>',
      );
    } else {
      chunks.push(
        '<div style="margin-left:' +
          dep * 12 +
          'px">' +
          kvRow(k, v, mode, fk) +
          "</div>",
      );
    }
  }
  return chunks;
}

export function _appendKvChunks(container, chunks) {
  if (!chunks.length) return;
  let i = 0;
  function step() {
    const end = Math.min(i + 120, chunks.length);
    let html = "";
    for (; i < end; i++) html += chunks[i];
    container.insertAdjacentHTML("beforeend", html);
    if (i < chunks.length) requestAnimationFrame(step);
  }
  step();
}

export function kvTree(obj, mode, pfx, dep) {
  return kvTreeChunks(obj, mode, pfx, dep).join("");
}

