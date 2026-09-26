// ErisPulse Dashboard – core/api (auto-split from dash.js)

const _realFetch = window.fetch;;

window.fetch = function (input, init) {
  if (
    currentNode !== "local" &&
    typeof input === "string" &&
    input.charAt(0) === "/" &&
    input.charAt(1) !== "/"
  ) {
    if (!input.startsWith(API + "/api/cluster/")) {
      input = API + "/api/cluster/proxy/" + currentNode + input;
    }
  }
  return _realFetch.call(this, input, init);
};;

export function api(path, opts) {
  const tk = localStorage.getItem(TK);
  const headers = {
    ...(opts?.headers || {}),
    ...(tk ? { Authorization: "Bearer " + tk } : {}),
  };
  if (opts?.body && !(opts.body instanceof FormData))
    headers["Content-Type"] = "application/json";
  return fetch(API + path, { ...opts, headers })
    .then((r) => {
      if (r.status === 401) {
        authed = false;
        localStorage.removeItem(TK);
        document.querySelector(".app").classList.remove("authed");
        showLogin();
        return null;
      }
      if (r.status === 502) {
        return r.json().then((d) => {
          if (
            d &&
            d.error === "remote_unauthorized" &&
            currentNode !== "local"
          ) {
            var now = Date.now();
            if (now - _remoteAuthToastTs > 5000) {
              _remoteAuthToastTs = now;
              toast(t("remote_unauthorized"), "er");
            }
          }
          return d;
        });
      }
      if (r.status >= 500) {
        var now = Date.now();
        if (now - _lastErrorToast > 5000) {
          _lastErrorToast = now;
          toast(t("server_error") + " (" + r.status + ")", "er");
        }
        return null;
      }
      return r.json();
    })
    .catch((e) => {
      var now = Date.now();
      if (now - _lastErrorToast > 5000) {
        _lastErrorToast = now;
        toast(t("connection_error"), "er");
      }
      return null;
    });
}

export async function fetchAdapterLogos() {
  const d = await api("/api/adapter-logos");
  if (d && d.logos) _adapterLogos = d.logos;
}

export function getAdapterLogo(name) {
  if (!name) return null;
  var low = name.toLowerCase(),
    best = null,
    bestLen = 0;
  for (var k in _adapterLogos) {
    if (low.indexOf(k.toLowerCase()) !== -1 && k.length > bestLen) {
      best = _adapterLogos[k];
      bestLen = k.length;
    }
  }
  return best;
}

export function adapterLogoImg(name, size) {
  var s = size || 20;
  var src = getAdapterLogo(name);
  if (!src) return '<span style="width:' + s + 'px;height:' + s + 'px;display:inline-block;flex-shrink:0"></span>';
  return (
    '<img src="' +
    esc(src) +
    '" style="width:' +
    s +
    "px;height:" +
    s +
    'px;border-radius:4px;object-fit:contain;flex-shrink:0" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{style:{width:\'' +
    s +
    "px',height:'" +
    s +
    "px',display:'inline-block',flexShrink:'0'}}))\">"
  );
}

export function _botAvatarFallback(el) {
  var logo = el.getAttribute("data-logo");
  if (logo && el.src !== logo) {
    el.removeAttribute("data-logo");
    el.src = logo;
    var container = el.parentElement;
    if (container) {
      container.classList.add("has-logo");
      container.classList.remove("bot-avatar");
      container.classList.add("bot-avatar");
    }
    return;
  }
  var container = el.parentElement;
  if (container) {
    container.classList.remove("has-logo");
  }
  el.outerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="8" width="14" height="10" rx="2"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/></svg>';
}

