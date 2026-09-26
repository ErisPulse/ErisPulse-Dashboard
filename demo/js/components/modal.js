// ErisPulse Dashboard – components/modal (auto-split from dash.js)

export function showModal(title, text, actions) {
  return new Promise((r) => {
    const ov = document.getElementById("modalOv");
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalText").innerHTML = text;
    const ac = document.getElementById("modalActions");
    ac.innerHTML = "";
    function finish(value) {
      document.removeEventListener("keydown", onKey, true);
      ov.onclick = null;
      ov.classList.remove("show");
      r(value);
    }
    // Esc 与点击遮罩空白处都视为取消；捕获阶段拦截，避免其他全局 Esc 处理器抢先关闭
    function onKey(e) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      finish(null);
    }
    actions.forEach((a) => {
      const b = document.createElement("button");
      b.className = "btn " + (a.primary ? "btn-primary" : "btn-secondary");
      b.textContent = a.label;
      b.onclick = () => finish(a.value);
      ac.appendChild(b);
    });
    ov.onclick = (e) => {
      if (e.target === ov) finish(null);
    };
    document.addEventListener("keydown", onKey, true);
    ov.classList.add("show");
  });
}

export function confirm2(title, text) {
  return showModal(title, text, [
    { label: t("cancel"), value: false },
    { label: t("ok"), value: true, primary: true },
  ]);
}

export function prompt2(title, text, defaultValue) {
  return new Promise(function (r) {
    var ov = document.getElementById("modalOv");
    var input = document.createElement("input");
    input.className = "fw-input modal-input";
    input.type = "text";
    input.value = defaultValue || "";
    input.placeholder = text || "";
    input.style.width = "100%";
    input.style.boxSizing = "border-box";

    var textEl = document.getElementById("modalText");
    textEl.innerHTML = "";
    textEl.appendChild(input);
    document.getElementById("modalTitle").textContent = title;

    var ac = document.getElementById("modalActions");
    ac.innerHTML = "";
    var cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-secondary";
    cancelBtn.textContent = t("cancel");
    ac.appendChild(cancelBtn);

    var okBtn = document.createElement("button");
    okBtn.className = "btn btn-primary";
    okBtn.textContent = t("ok");
    ac.appendChild(okBtn);

    function finish(value) {
      document.removeEventListener("keydown", onKey, true);
      ov.onclick = null;
      ov.classList.remove("show");
      r(value);
    }
    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        finish(null);
      }
    }
    cancelBtn.onclick = function () {
      finish(null);
    };
    okBtn.onclick = function () {
      finish(input.value);
    };
    // Enter 直接确认；遮罩空白处点击取消
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        finish(input.value);
      }
    });
    ov.onclick = function (e) {
      if (e.target === ov) finish(null);
    };
    document.addEventListener("keydown", onKey, true);

    ov.classList.add("show");
    setTimeout(function () {
      input.focus();
      input.select();
    }, 100);
  });
}

export function showOutputModal(title, lines, actions) {
  return new Promise((r) => {
    document.getElementById("outputTitle").textContent = title;
    const pre = document.getElementById("outputPre");
    pre.textContent = (lines || []).join("\n") || "(no output)";
    const ac = document.getElementById("outputActions");
    ac.innerHTML = "";
    actions.forEach((a) => {
      const b = document.createElement("button");
      b.className = "btn " + (a.primary ? "btn-primary" : "btn-secondary");
      b.textContent = a.label;
      b.onclick = () => {
        document.getElementById("outputOv").classList.remove("show");
        r(a.value);
      };
      ac.appendChild(b);
    });
    document.getElementById("outputOv").classList.add("show");
  });
}

export function showAdapterReloadLog(module, displayName) {
  var overlay = document.getElementById("outputOv");
  document.getElementById("outputTitle").textContent =
    (displayName || module) + " — 重载日志";
  var pre = document.getElementById("outputPre");
  var origMaxHeight = pre.style.maxHeight;
  pre.style.maxHeight = "400px";
  pre.textContent = "正在收集日志...\n";

  var ac = document.getElementById("outputActions");
  ac.innerHTML = "";
  var closeBtn = document.createElement("button");
  closeBtn.className = "btn btn-primary";
  closeBtn.textContent = t("ok");
  ac.appendChild(closeBtn);

  var pollTimer = null;
  var startTime = Date.now();
  var seenLogs = new Set();
  var stopped = false;

  function stopPolling() {
    stopped = true;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  closeBtn.onclick = function () {
    stopPolling();
    pre.style.maxHeight = origMaxHeight;
    overlay.classList.remove("show");
  };

  overlay.classList.add("show");

  async function fetchLogs() {
    if (stopped) return;
    try {
      var data = await api(
        "/api/logs?module=" + encodeURIComponent(module) + "&limit=80",
      );
      if (!data || !data.logs) return;

      var entries = data.logs.slice().reverse();
      var newLines = [];
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        var key = e.full || e.timestamp + "|" + e.message;
        if (!seenLogs.has(key)) {
          seenLogs.add(key);
          newLines.push(e.message || "");
        }
      }

      if (newLines.length > 0) {
        if (pre.textContent.indexOf("正在收集日志") === 0) {
          pre.textContent = "";
        }
        pre.textContent += newLines.join("\n") + "\n";
        pre.scrollTop = pre.scrollHeight;
      }
    } catch (e) {}

    if (Date.now() - startTime > 15000) {
      stopPolling();
      pre.textContent += "\n— 日志收集已自动停止 —";
    }
  }

  fetchLogs();
  pollTimer = setInterval(fetchLogs, 800);
}

