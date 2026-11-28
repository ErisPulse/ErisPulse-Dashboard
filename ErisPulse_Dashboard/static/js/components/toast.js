// ErisPulse Dashboard – components/toast
// 显隐只切 .show 类；位移动画在 CSS

export function toast(msg, type) {
  const el = document.createElement("div");
  el.className =
    "toast" + (type === "ok" ? " toast-ok" : type === "er" ? " toast-er" : "");
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.classList.add("show");
  });
  // 错误文案常带原因（save_failed: ...），读得慢：错误停留 5s，其余 2.5s
  setTimeout(
    () => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 250);
    },
    type === "er" ? 5000 : 2500,
  );
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
