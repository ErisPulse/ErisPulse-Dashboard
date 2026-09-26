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
    await loadSessionCaps();
    // 先加载仪表盘主体，外观延迟加载（不阻塞访问）
    loadAll();
    // 恢复上次更新遗留的重载引导（如更新后刷新了页面）
    restoreUpdateHint();
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

// ── 会话能力：当前令牌的身份与可访问页面（用户系统） ──
export async function loadSessionCaps() {
  try {
    const d = await api("/api/auth/permissions");
    if (d && typeof d.admin === "boolean") {
      window.sessionCaps = { admin: d.admin, name: d.name, caps: d.caps || [] };
    } else {
      window.sessionCaps = { admin: true, name: "admin", caps: [] };
    }
  } catch (e) {
    window.sessionCaps = { admin: true, name: "admin", caps: [] };
  }
  if (typeof updateSidebarForCaps === "function") updateSidebarForCaps();
}
