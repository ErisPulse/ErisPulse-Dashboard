// ErisPulse Dashboard – components/ws-inspector (auto-split from dash.js)

export function wsSafeUrl(u) {
  return String(u || "").replace(/(token=)[^&]+/g, "$1******");
}

export function wsLogSig(type, pretty) {
  return (
    type +
    "|" +
    pretty
      .replace(/"(time|timestamp|ts)"\s*:\s*[-\d.]+/g, "")
      .replace(/\s+/g, "")
  );
}

export function wsLogPush(type, raw) {
  _wsMeta.frames++;
  // log_entry 帧高频且内容各异（系统日志页有专门视图），不入面板避免刷屏
  if (type === "log_entry") return;
  var pretty = raw;
  try {
    pretty = JSON.stringify(JSON.parse(raw), null, 2);
  } catch (e) {}
  var truncated = false;
  if (pretty.length > WS_LOG_PREVIEW_MAX) {
    pretty = pretty.slice(0, WS_LOG_PREVIEW_MAX) + "\n…";
    truncated = true;
  }
  var sig = wsLogSig(type || "message", pretty);
  var top = _wsLog[0];
  if (top && top.sig === sig) {
    top.count++;
    top.seq = ++_wsLogSeq;
    top.time = new Date().toLocaleTimeString(getLocale(), {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    return;
  }
  _wsLog.unshift({
    seq: ++_wsLogSeq,
    sig: sig,
    type: type || "message",
    pretty: pretty,
    size: raw.length,
    truncated: truncated,
    count: 1,
    time: new Date().toLocaleTimeString(getLocale(), {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  });
  if (_wsLog.length > WS_LOG_MAX) _wsLog.pop();
}

export function wsLogItemHtml(f) {
  return (
    '<div class="wslog-item' +
    (f.count > 1 ? " has-count" : "") +
    '" data-seq="' +
    f.seq +
    '" onclick="this.classList.toggle(\'open\')">' +
    '<div class="wslog-head"><span class="wslog-dir">&#8595;</span><span class="wslog-type">' +
    esc(f.type) +
    '</span><span class="wslog-count">&times;' +
    f.count +
    '</span><span class="wslog-size">' +
    f.size +
    "B" +
    (f.truncated ? "+" : "") +
    '</span><span class="wslog-time">' +
    esc(f.time) +
    "</span></div>" +
    '<pre class="wslog-payload">' +
    esc(f.pretty) +
    "</pre></div>"
  );
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
  var log = document.getElementById("wsInspLog");
  if (!log || !_wsLog.length) {
    if (log && _wsLogHeadSeq !== 0) {
      log.innerHTML = _wsLog.length
        ? ""
        : '<div class="wslog-empty">' + esc(t("ws_log_empty")) + "</div>";
      _wsLogHeadSeq = 0;
    }
    return;
  }
  var head = _wsLog[0];
  if (_wsLogHeadSeq === -1) {
    // 首次（或清空后）全量渲染
    log.innerHTML = _wsLog.map(wsLogItemHtml).join("");
    _wsLogHeadSeq = head.seq;
  } else if (_wsLogHeadSeq !== head.seq) {
    // 增量：把新条目插到最前，保留已有 DOM 的展开状态
    var idx = -1,
      i;
    for (i = 0; i < _wsLog.length; i++) {
      if (_wsLog[i].seq === _wsLogHeadSeq) {
        idx = i;
        break;
      }
    }
    if (idx === -1) {
      log.innerHTML = _wsLog.map(wsLogItemHtml).join("");
    } else {
      var frag = "";
      for (i = idx - 1; i >= 0; i--) frag += wsLogItemHtml(_wsLog[i]);
      var empty = log.querySelector(".wslog-empty");
      if (empty) empty.remove();
      log.insertAdjacentHTML("afterbegin", frag);
      while (log.children.length > WS_LOG_MAX) log.removeChild(log.lastChild);
    }
    _wsLogHeadSeq = head.seq;
  }
  // 首条折叠计数/时间可能原地更新
  var first = log.firstElementChild;
  if (first && String(head.seq) === first.dataset.seq) {
    var cnt = first.querySelector(".wslog-count");
    if (cnt) {
      cnt.textContent = "\u00d7" + head.count;
      first.classList.toggle("has-count", head.count > 1);
    }
    var tmEl = first.querySelector(".wslog-time");
    if (tmEl) tmEl.textContent = head.time;
  }
}

export function toggleWsInspector(ev) {
  if (ev && ev.stopPropagation) ev.stopPropagation();
  var p = document.getElementById("wsInspector");
  if (!p) return;
  if (p.classList.contains("open")) {
    closeWsInspector();
    return;
  }
  _wsLogHeadSeq = -1;
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

export function closeWsInspector() {
  var p = document.getElementById("wsInspector");
  if (p) p.classList.remove("open");
  if (_wsInspTimer) {
    clearInterval(_wsInspTimer);
    _wsInspTimer = null;
  }
  document.removeEventListener("click", _wsInspOutside);
  document.removeEventListener("keydown", _wsInspEsc);
}

export function _wsInspOutside(e) {
  var p = document.getElementById("wsInspector");
  if (!p) return;
  if (p.contains(e.target)) return;
  var badge = document.getElementById("connBadge");
  if (badge && badge.contains(e.target)) return;
  closeWsInspector();
}

export function _wsInspEsc(e) {
  if (e.key === "Escape") closeWsInspector();
}

export function clearWsLog() {
  _wsLog = [];
  _wsLogHeadSeq = 0;
  var log = document.getElementById("wsInspLog");
  if (log) log.innerHTML = '<div class="wslog-empty">' + esc(t("ws_log_empty")) + "</div>";
}

