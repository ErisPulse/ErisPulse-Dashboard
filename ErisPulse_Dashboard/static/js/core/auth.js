// ErisPulse Dashboard – core/auth (auto-split from dash.js)

export function showLogin() {
  document.querySelector(".app").classList.remove("authed");
  document.getElementById("loginOv").classList.add("show");
  const ls = document.getElementById("loginLangSelect");
  if (ls) ls.value = lang;
  document.getElementById("loginInput").focus();
}

export function closeLogin() {
  document.getElementById("loginOv").classList.remove("show");
}

export async function doLogin() {
  if (_loginLock) return;
  _loginLock = true;
  const inp = document.getElementById("loginInput");
  const btn = inp.closest(".login-card").querySelector(".btn-primary");
  btn.disabled = true;
  btn.style.opacity = ".5";
  const v = inp.value.trim();
  if (!v) {
    _loginLock = false;
    btn.disabled = false;
    btn.style.opacity = "";
    return;
  }
  const d = await api("/api/auth", {
    method: "POST",
    body: JSON.stringify({ token: v }),
  });
  if (d && d.success) {
    localStorage.setItem(TK, v);
    authed = true;
    closeLogin();
    document.querySelector(".app").classList.add("authed");
    // 先加载仪表盘主体，外观延迟加载（不阻塞访问）
    loadAll();
    wsConnect();
    restartRefreshTimer();
    loadClusterNodes();
    loadGlobalAppearance();
    applyDefaultPageOnLogin();
    toast(t("logged_in"), "ok");
  } else {
    if (!authed) localStorage.removeItem(TK);
    toast(t("invalid_token"), "er");
    inp.select();
  }
  btn.disabled = false;
  btn.style.opacity = "";
  _loginLock = false;
}

export function doLogout() {
  localStorage.removeItem(TK);
  authed = false;
  closeSettings();
  document.querySelector(".app").classList.remove("authed");
  showLogin();
}

