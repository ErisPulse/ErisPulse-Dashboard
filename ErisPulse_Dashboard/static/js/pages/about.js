// ErisPulse Dashboard – pages/about (auto-split from dash.js)

export function updateAboutCard() {
  var fw = window._fwStatus || {};
  var ver = document.getElementById("aboutFwVer");
  if (ver) ver.textContent = fw.version ? "ErisPulse v" + fw.version : "-";
  var meta = document.getElementById("aboutFwMeta");
  if (meta) {
    var parts = [];
    if (fw.python_version) parts.push("Python " + fw.python_version);
    if (fw.platform) parts.push(fw.platform);
    meta.textContent = parts.join(" · ");
  }
}

export function initRippleEffects() {
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".btn");
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    btn.style.setProperty("--ripple-x", x + "%");
    btn.style.setProperty("--ripple-y", y + "%");
    btn.classList.remove("ripple");
    void btn.offsetWidth; // 强制重绘
    btn.classList.add("ripple");

    setTimeout(() => btn.classList.remove("ripple"), 600);
  });
}

export function animateContributors() {
  const items = document.querySelectorAll(".about-contrib-item");
  items.forEach((item, i) => {
    item.style.animationDelay = i * 0.05 + "s";
  });
}

export async function loadAbout() {
  loadAboutContributors();
}

export async function loadAboutContributors() {
  const container = document.getElementById("aboutContributors");
  if (!container) return;

  try {
    const resp = await fetch(
      "https://api.github.com/repos/ErisPulse/ErisPulse/contributors?per_page=100",
    );
    if (!resp.ok) throw new Error("Failed to fetch");
    const contributors = await resp.json();

    if (!Array.isArray(contributors) || contributors.length === 0) {
      container.innerHTML = '<span class="about-contrib-empty">-</span>';
      return;
    }

    container.innerHTML = contributors
      .map(
        (c) => `
            <a href="${esc(c.html_url)}" target="_blank" rel="noopener" class="about-contrib-item" title="${esc(c.login)}">
                <img src="${esc(c.avatar_url)}" alt="${esc(c.login)}" loading="lazy" width="36" height="36">
                <span class="about-contrib-name">${esc(c.login)}</span>
            </a>
        `,
      )
      .join("");
    animateContributors();
  } catch {
    container.innerHTML =
      '<span class="about-contrib-empty" data-i18n="about_contrib_failed"></span>';
  }
}

