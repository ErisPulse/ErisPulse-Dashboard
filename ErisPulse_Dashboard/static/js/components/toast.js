// ErisPulse Dashboard – components/toast (auto-split from dash.js)

export function toast(msg, type) {
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(12px);padding:10px 24px;border-radius:8px;font-size:14px;font-family:inherit;box-shadow:0 8px 24px rgba(0,0,0,.15);z-index:9999;opacity:0;transition:opacity .25s ease,transform .25s cubic-bezier(.4,0,.2,1);pointer-events:none";
  if (type === "ok") {
    el.style.background = "var(--ok-bg)";
    el.style.color = "var(--ok-c)";
    el.style.border = "1px solid var(--ok-bd)";
  } else if (type === "er") {
    el.style.background = "var(--er-bg)";
    el.style.color = "var(--er-c)";
    el.style.border = "1px solid var(--er-bd)";
  } else {
    el.style.background = "var(--bg-t)";
    el.style.color = "var(--tx-p)";
    el.style.border = "1px solid var(--bd)";
  }
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "translateX(-50%) translateY(0)";
  });
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateX(-50%) translateY(12px)";
    setTimeout(() => el.remove(), 250);
  }, 2500);
}

export function toastUndo(msg, undoFn) {
  var el = document.createElement("div");
  el.style.cssText =
    "position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(12px);display:flex;align-items:center;gap:12px;padding:10px 14px 10px 24px;border-radius:8px;font-size:14px;font-family:inherit;background:var(--bg-t);color:var(--tx-p);border:1px solid var(--bd);box-shadow:0 8px 24px rgba(0,0,0,.15);z-index:9999;opacity:0;transition:opacity .25s ease,transform .25s cubic-bezier(.4,0,.2,1)";
  var span = document.createElement("span");
  span.textContent = msg;
  el.appendChild(span);
  var btn = document.createElement("button");
  btn.className = "btn btn-secondary btn-xs";
  btn.textContent = t("undo");
  btn.onclick = function () {
    try {
      undoFn();
    } catch (e) {}
    el.remove();
  };
  el.appendChild(btn);
  document.body.appendChild(el);
  requestAnimationFrame(function () {
    el.style.opacity = "1";
    el.style.transform = "translateX(-50%) translateY(0)";
  });
  setTimeout(function () {
    el.style.opacity = "0";
    el.style.transform = "translateX(-50%) translateY(12px)";
    setTimeout(function () {
      el.remove();
    }, 250);
  }, 4000);
}

