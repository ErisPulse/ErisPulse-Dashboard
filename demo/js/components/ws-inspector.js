// ErisPulse Dashboard – components/ws-inspector
// 连接详情面板：仅展示连接信息（地址/节点/时长/重连/帧计数）。
// WS 帧内容统一输出到浏览器控制台（console.debug，默认隐藏，DevTools 可展开查看）。

function wsSafeUrl(u) {
  return String(u || "").replace(/(token=)[^&]+/g, "$1******");
}

export function wsLogPush(type, raw) {
  _wsMeta.frames++;
  var obj = null;
  try {
    obj = JSON.parse(raw);
  } catch (e) {}
  if (obj !== null && typeof obj === "object") {
    console.debug("[WS] " + (type || "message"), obj);
  } else {
    console.debug("[WS] " + (type || "message"), raw);
  }
}

export function wsFmtUptime(ms) {
  if (!ms) return "—";
  var s = Math.floor(ms / 1000);
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  var sec = s % 60;
  return (
    (h ? h + "h " : "") + (h || m ? m + "m " : "") + sec + "s"
  );
}

export function renderWsInspector() {
  var info = document.getElementById("wsInspInfo");
  if (!info) return;
  var isLocal = currentNode === "local";
  var url =
    _wsMeta.url ||
    (function () {
      var p = location.protocol === "https:" ? "wss:" : "ws:";
      return p + "//" + location.host + API + "/ws";
    })();
  var safe = wsSafeUrl(url);
  info.innerHTML =
    '<div class="ws-insp-row"><span>' +
    esc(t("ws_url")) +
    '</span><code class="ws-insp-val" title="' +
    esc(safe) +
    '">' +
    esc(safe) +
    "</code></div>" +
    '<div class="ws-insp-row"><span>' +
    esc(t("ws_node")) +
    '</span><span class="ws-insp-val">' +
    esc(isLocal ? t("node_local") || "local" : currentNode) +
    "</span></div>" +
    '<div class="ws-insp-row"><span>' +
    esc(t("ws_uptime")) +
    '</span><span class="ws-insp-val">' +
    esc(wsFmtUptime(_wsMeta.connectedAt ? Date.now() - _wsMeta.connectedAt : 0)) +
    "</span></div>" +
    '<div class="ws-insp-row"><span>' +
    esc(t("ws_reconnects")) +
    '</span><span class="ws-insp-val">' +
    _wsMeta.reconnects +
    "</span></div>" +
    '<div class="ws-insp-row"><span>' +
    esc(t("ws_frames")) +
    '</span><span class="ws-insp-val">' +
    _wsMeta.frames +
    "</span></div>" +
    '<div class="ws-insp-row"><span>' +
    esc(t("ws_events")) +
    '</span><span class="ws-insp-val">' +
    _wsMeta.events +
    "</span></div>";
}

export function toggleWsInspector(ev) {
  if (ev && ev.stopPropagation) ev.stopPropagation();
  var p = document.getElementById("wsInspector");
  if (!p) return;
  if (p.classList.contains("open")) {
    closeWsInspector();
    return;
  }
  renderWsInspector();
  p.classList.add("open");
  document.addEventListener("click", _wsInspOutside);
  document.addEventListener("keydown", _wsInspEsc);
  if (_wsInspTimer) clearInterval(_wsInspTimer);
  _wsInspTimer = setInterval(function () {
    if (!document.getElementById("wsInspector")?.classList.contains("open")) {
      closeWsInspector();
      return;
    }
    renderWsInspector();
  }, 1000);
}
function closeWsInspector() {
  var p = document.getElementById("wsInspector");
  if (p) p.classList.remove("open");
  if (_wsInspTimer) {
    clearInterval(_wsInspTimer);
    _wsInspTimer = null;
  }
  document.removeEventListener("click", _wsInspOutside);
  document.removeEventListener("keydown", _wsInspEsc);
}
function _wsInspOutside(e) {
  var p = document.getElementById("wsInspector");
  if (!p) return;
  if (p.contains(e.target)) return;
  var badge = document.getElementById("connBadge");
  if (badge && badge.contains(e.target)) return;
  closeWsInspector();
}
function _wsInspEsc(e) {
  if (e.key === "Escape") closeWsInspector();
}