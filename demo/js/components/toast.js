 
 
 

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
