// ErisPulse Dashboard – pages/bots (auto-split from dash.js)

export function _capabilityBadges(caps) {
  if (!caps || !caps.length) return "";
  var popular = ["Text", "Image", "Voice", "Markdown", "Video"];
  var shown = caps.filter(function (c) {
    return popular.indexOf(c) >= 0;
  });
  var rest = caps.length - shown.length;
  var html = shown
    .map(function (c) {
      return '<span class="bot-cap-tag">' + esc(c) + "</span>";
    })
    .join("");
  if (rest > 0)
    html += '<span class="bot-cap-tag bot-cap-more">+' + rest + "</span>";
  return '<div class="bot-caps">' + html + "</div>";
}

export function _adapterStatusBadge(status) {
  var map = {
    started: { cls: "chip-ok", label: "running" },
    starting: { cls: "chip-wr", label: "starting" },
    stopping: { cls: "chip-wr", label: "stopping" },
    stopped: { cls: "chip-er", label: "stopped" },
    unknown: { cls: "chip-default", label: "unknown" },
  };
  var s = map[status] || map.unknown;
  return (
    '<span class="chip ' +
    s.cls +
    ' adapter-status-chip">' +
    esc(s.label) +
    "</span>"
  );
}

export async function loadBots() {
  const d = await api("/api/bots");
  if (!d) return;
  const b = d.bots || [];
  document.getElementById("botGrid").innerHTML = b.length
    ? b
        .map((x) => {
          const i = x.info || {},
            nm = i.user_name || i.nickname || x.bot_id,
            av = i.avatar;
          const la = _relativeTime(x.last_active);
          const on = x.status === "online";
          const logoSrc = getAdapterLogo(x.platform);
          const useLogo = !av && logoSrc;
          const avCls = useLogo ? "bot-avatar has-logo" : "bot-avatar";
          const capsHtml = _capabilityBadges(x.capabilities);
          const adStatusHtml = _adapterStatusBadge(x.adapter_status);
          let avatarHtml;
          if (av) {
            avatarHtml =
              '<img src="' +
              esc(av) +
              '" data-logo="' +
              (logoSrc ? esc(logoSrc) : "") +
              '" onerror="_botAvatarFallback(this)">';
          } else if (logoSrc) {
            avatarHtml =
              '<img src="' +
              esc(logoSrc) +
              '" onerror="_botAvatarFallback(this)">';
          } else {
            avatarHtml =
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="8" width="14" height="10" rx="2"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/></svg>';
          }
          return (
            '<div class="bot-card" data-bot-status="' +
            (on ? "online" : "offline") +
            '"><div class="' +
            avCls +
            '">' +
            avatarHtml +
            '</div><div class="bot-card-body"><div class="bot-name-row">' +
            '<span class="bot-name">' +
            esc(nm) +
            "</span>" +
            '</div><div class="bot-platform-row">' +
            esc(x.platform) +
            " / " +
            '<code class="bot-id-code">' +
            esc(x.bot_id) +
            "</code>" +
            "</div>" +
            capsHtml +
            '</div><div class="bot-card-right"><div class="bot-status-row">' +
            '<span class="dot" style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:' +
            (on ? "var(--ok-c)" : "var(--tx-t)") +
            '"></span><span style="font-size:12px;font-weight:500;color:' +
            (on ? "var(--ok-c)" : "var(--tx-s)") +
            '">' +
            (on ? t("online") : t("offline")) +
            '</span></div><div class="bot-last-active">' +
            esc(la) +
            "</div>" +
            adStatusHtml +
            "</div></div>"
          );
        })
        .join("")
    : '<div class="empty-state" style="grid-column:span 3"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="8" width="14" height="10" rx="2"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/></svg><h3>' +
      t("no_bots") +
      '</h3><button class="empty-action" onclick="go(\'adapter\')">' +
      t("adapter_config") +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg></button></div>';
}

