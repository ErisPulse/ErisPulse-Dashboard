// ErisPulse Dashboard – core/utils (auto-split from dash.js)

export function cmpVer(a, b) {
  var parseVer = function (v) {
    var m = v
      .replace(/^v/, "")
      .toLowerCase()
      .match(/^(\d+(?:\.\d+)*)(?:[-.]?(dev|a|alpha|b|beta|c|rc|pre|post)(?:[-.]?(\d+))?)?/);
    var nums = m && m[1] ? m[1].split(".").map(Number) : [];
    var tag = m && m[2] ? m[2] : "";
    var pnum = m && m[3] ? parseInt(m[3], 10) : 0;
    var rank;
    if (!tag) rank = Infinity;
    else if (tag === "dev") rank = -3;
    else if (tag === "a" || tag === "alpha") rank = -2;
    else if (tag === "b" || tag === "beta") rank = -1;
    else if (tag === "c" || tag === "rc" || tag === "pre") rank = 0;
    else if (tag === "post") rank = 1;
    else rank = Infinity;
    return { nums: nums, rank: rank, pnum: pnum };
  };
  var va = parseVer(a),
    vb = parseVer(b);
  var len = Math.max(va.nums.length, vb.nums.length);
  for (var i = 0; i < len; i++) {
    var na = va.nums[i] || 0,
      nb = vb.nums[i] || 0;
    if (na !== nb) return na > nb ? 1 : -1;
  }
  if (va.rank !== vb.rank) return va.rank > vb.rank ? 1 : -1;
  if (va.pnum !== vb.pnum) return va.pnum > vb.pnum ? 1 : -1;
  return 0;
}

export function esc(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function _jsq(s) {
  if (s == null) return "";
  return esc(
    String(s)
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
  );
}

export function getPrivacyMode() {
  return getSetting("privacy_mode", "0") !== "0";
}

export function privText(txt) {
  if (!getPrivacyMode() || txt == null) return txt;
  var n = Math.max(4, Math.min(String(txt).length, 20));
  return "\u2022".repeat(n);
}

export function deepMerge(target, source) {
  const r = {};
  for (const k of Object.keys(source)) {
    if (
      k in target &&
      target[k] !== null &&
      typeof target[k] === "object" &&
      !Array.isArray(target[k]) &&
      typeof source[k] === "object" &&
      !Array.isArray(source[k])
    ) {
      r[k] = deepMerge(target[k], source[k]);
    } else {
      r[k] = k in target ? target[k] : source[k];
    }
  }
  for (const k of Object.keys(target)) {
    if (!(k in source)) r[k] = target[k];
  }
  return r;
}

export function escRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

