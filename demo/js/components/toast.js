// ErisPulse Dashboard – components/toast (auto-split from dash.js)
// 显隐只切 .show 类；位移动画在 CSS（历史版 JS 写死内联 translateX(-50%)，
// 会覆盖移动端媒体查询导致 toast 左移半屏被裁切，v2.6 已收归 CSS）

export function toast(msg, type) {
  const el = document.createElement("div");
  el.className =
    "toast" + (type === "ok" ? " toast-ok" : type === "er" ? " toast-er" : "");
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.classList.add("show");
  });
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 250);
  }, 2500);
}

export function toastUndo(msg, undoFn) {
  var el = document.createElement("div");
  el.className = "toast toast-undo";
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
    el.classList.add("show");
  });
  setTimeout(function () {
    el.classList.remove("show");
    setTimeout(function () {
      el.remove();
    }, 250);
  }, 4000);
}
