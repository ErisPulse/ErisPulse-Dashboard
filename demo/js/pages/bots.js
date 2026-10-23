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
    started: { cls: "chip-ok", label: t("adapter_st_started") },
    starting: { cls: "chip-wr", label: t("adapter_st_starting") },
    stopping: { cls: "chip-wr", label: t("adapter_st_stopping") },
    stopped: { cls: "chip-er", label: t("adapter_st_stopped") },
    unknown: { cls: "chip-default", label: t("adapter_st_unknown") },
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
              '" alt="" onerror="_botAvatarFallback(this)">';
          } else if (logoSrc) {
            avatarHtml =
              '<img src="' + esc(logoSrc) + '" alt="" onerror="_botAvatarFallback(this)">';
          } else {
            avatarHtml =
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="8" width="14" height="10" rx="2"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/></svg>';
          }
          // v1.2 卡片结构：头部（logo+状态点 / 名称 / 连接 chip）+ 卡底元信息收纳
          return (
            '<div class="bot-card" data-bot-status="' +
            (on ? "online" : "offline") +
            '">' +
            '<div class="bot-head">' +
            '<span class="' +
            avCls +
            '">' +
            avatarHtml +
            '<i class="bot-status-dot" aria-hidden="true"></i></span>' +
            '<div class="bot-card-body">' +
            '<span class="bot-name">' +
            esc(nm) +
            "</span>" +
            '<span class="bot-platform-row">' +
            esc(x.platform) +
            ' <code class="bot-id-code">' +
            esc(x.bot_id) +
            "</code></span>" +
            "</div>" +
            '<span class="chip ' +
            (on ? "chip-ok" : "chip-er") +
            ' bot-conn-chip"><i class="bot-conn-dot"></i>' +
            (on ? t("online") : t("offline")) +
            "</span>" +
            "</div>" +
            '<div class="bot-foot">' +
            (capsHtml ||
              '<span class="bot-caps-empty" aria-hidden="true"></span>') +
            '<span class="bot-foot-meta">' +
            '<span class="bot-last-active">' +
            esc(la) +
            "</span>" +
            adStatusHtml +
            "</span>" +
            "</div>" +
            "</div>"
          );
        })
        .join("")
    : '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="8" width="14" height="10" rx="2"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/><line x1="12" y1="4" x2="12" y2="8"/><circle cx="9" cy="4" r="1.5" fill="currentColor"/><circle cx="15" cy="4" r="1.5" fill="currentColor"/></svg><h3>' +
      t("no_bots") +
      '</h3><button class="empty-action" onclick="go(\'adapter\')">' +
      t("adapter_config") +
      "</button></div>";
}

