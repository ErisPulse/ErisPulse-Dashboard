// ErisPulse Dashboard – components/status-icon (auto-split from dash.js)

const STATUS_FRAMES = {
  conn: ["Disconnected.png", "Connected.png", "Connection Error  Broken.png"],
};;

const STATUS_STATE_KEYS = {
  conn: [
    "status_conn_disconnected",
    "status_conn_connected",
    "status_conn_error",
  ],
};;

const _statusRegistry = {};;

export function createStatusIcon(container, config) {
  const group = config.group;
  const size = config.size || "lg";
  const showLabel = config.showLabel !== false;
  const frames = STATUS_FRAMES[group];
  if (!frames) return null;

  const wrapper = document.createElement("div");
  wrapper.className = "status-icon-container";

  const framesDiv = document.createElement("div");
  framesDiv.className = "status-icon-frames size-" + size;

  frames.forEach(function (src, i) {
    var img = document.createElement("img");
    img.src = "res/" + group + "/" + encodeURIComponent(src);
    img.alt = src.replace(/\.png$/, "");
    img.dataset.frame = String(i);
    if (i === 0) img.classList.add("active");
    framesDiv.appendChild(img);
  });

  wrapper.appendChild(framesDiv);

  var labelEl = null,
    stateEl = null;
  if (showLabel) {
    labelEl = document.createElement("div");
    labelEl.className = "status-icon-label";
    labelEl.textContent = t("status_icons_" + group) || group;
    wrapper.appendChild(labelEl);

    stateEl = document.createElement("div");
    stateEl.className = "status-icon-state";
    stateEl.textContent = t(STATUS_STATE_KEYS[group][0]) || "";
    wrapper.appendChild(stateEl);
  }

  container.appendChild(wrapper);

  var instance = {
    id: "si_" + group + "_" + Math.random().toString(36).substr(2, 6),
    group: group,
    container: container,
    wrapper: wrapper,
    framesDiv: framesDiv,
    stateEl: stateEl,
    currentFrame: 0,
    animating: false,
    _timers: [],
    destroy: function () {
      instance._timers.forEach(clearTimeout);
      instance._timers = [];
      if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
      delete _statusRegistry[instance.id];
    },
    setState: function (frameIndex, animate) {
      if (frameIndex < 0 || frameIndex >= frames.length) return;
      if (frameIndex === instance.currentFrame && !instance.animating) return;
      instance._timers.forEach(clearTimeout);
      instance._timers = [];
      instance.animating = false;

      if (animate) {
        _crtTransition(instance, frameIndex);
      } else {
        _setFrameDirect(instance, frameIndex);
      }
    },
  };

  _statusRegistry[instance.id] = instance;
  return instance;
}

export function _setFrameDirect(inst, frameIndex) {
  var imgs = inst.framesDiv.querySelectorAll("img");
  imgs.forEach(function (img) {
    img.classList.remove("active", "crt-out", "crt-in");
    img.style.clipPath = "";
  });
  if (imgs[frameIndex]) imgs[frameIndex].classList.add("active");

  var beam = inst.framesDiv.querySelector(".scanline-beam");
  if (beam) beam.remove();
  inst.framesDiv.classList.remove("scanning");

  inst.currentFrame = frameIndex;
  if (inst.stateEl) {
    var key =
      STATUS_STATE_KEYS[inst.group] &&
      STATUS_STATE_KEYS[inst.group][frameIndex];
    if (key) inst.stateEl.textContent = t(key) || "";
  }
}

export function _crtTransition(inst, newFrame) {
  if (inst.animating) {
    inst._timers.forEach(clearTimeout);
    inst._timers = [];
    var oldImgs = inst.framesDiv.querySelectorAll("img");
    oldImgs.forEach(function (img) {
      img.classList.remove("active", "crt-out", "crt-in");
      img.style.clipPath = "";
    });
    var oldBeam = inst.framesDiv.querySelector(".scanline-beam");
    if (oldBeam) oldBeam.remove();
    inst.framesDiv.classList.remove("scanning");
  }

  inst.animating = true;
  inst.framesDiv.classList.add("scanning");

  var imgs = inst.framesDiv.querySelectorAll("img");
  var oldFrame = inst.currentFrame;
  var oldImg = imgs[oldFrame];
  var newImg = imgs[newFrame];

  var sameFrame = oldImg === newImg;

  if (oldImg && !sameFrame) {
    oldImg.classList.remove("active", "crt-in");
    oldImg.classList.add("crt-out");
  }

  var beamOut = document.createElement("div");
  beamOut.className = "scanline-beam sweep-up";
  inst.framesDiv.appendChild(beamOut);

  inst._timers.push(
    setTimeout(function () {
      if (oldImg && !sameFrame) {
        oldImg.classList.remove("crt-out");
        oldImg.style.clipPath = "inset(100% 0 0 0)";
      }
      beamOut.remove();

      if (newImg) {
        newImg.classList.remove("crt-out");
        newImg.style.clipPath = "";
        newImg.classList.add("crt-in");
      }

      var beamIn = document.createElement("div");
      beamIn.className = "scanline-beam sweep-down";
      inst.framesDiv.appendChild(beamIn);

      inst._timers.push(
        setTimeout(function () {
          imgs.forEach(function (img) {
            img.classList.remove("crt-out", "crt-in", "active");
            img.style.clipPath = "";
          });
          if (imgs[newFrame]) imgs[newFrame].classList.add("active");

          beamIn.remove();
          inst.framesDiv.classList.remove("scanning");
          inst.currentFrame = newFrame;
          inst.animating = false;

          if (inst.stateEl) {
            var key =
              STATUS_STATE_KEYS[inst.group] &&
              STATUS_STATE_KEYS[inst.group][newFrame];
            if (key) inst.stateEl.textContent = t(key) || "";
          }
        }, 280),
      );
    }, 280),
  );
}

export function updateStatusGroup(group, frameIndex, animate) {
  Object.keys(_statusRegistry).forEach(function (id) {
    var inst = _statusRegistry[id];
    if (inst.group === group) {
      inst.setState(frameIndex, animate !== false);
    }
  });
}

export function initHeaderStatusIcon() {
  var badgeContainer = document.getElementById("status-badge-icon");
  var panelContainer = document.getElementById("status-panel-icon");
  if (!badgeContainer || !panelContainer || badgeContainer.dataset.init === "1")
    return;
  badgeContainer.dataset.init = "1";

  _badgeInst = createStatusIcon(badgeContainer, {
    group: "conn",
    size: "custom",
    showLabel: false,
  });
  _panelInst = createStatusIcon(panelContainer, {
    group: "conn",
    size: "custom",
    showLabel: false,
  });

  _badgeInst.setState(0, false);
  _panelInst.setState(0, false);
}

export function showConnPanel(title, desc) {
  var panel = document.getElementById("connPanel");
  var titleEl = document.getElementById("connPanelTitle");
  var descEl = document.getElementById("connPanelDesc");
  if (titleEl) titleEl.textContent = title || "";
  if (descEl) descEl.textContent = desc || "";
  if (panel) panel.classList.add("expanded");

  if (_collapseTimer) clearTimeout(_collapseTimer);
  _collapseTimer = setTimeout(function () {
    if (panel) panel.classList.remove("expanded");
  }, 2600);
}

export function updateConnBadge(state) {
  var badge = document.getElementById("connBadge");
  var text = document.getElementById("connBadgeText");
  if (badge) {
    badge.classList.remove("connected", "disconnected");
    if (state === 1) badge.classList.add("connected");
    else if (state === 0) badge.classList.add("disconnected");
  }
  if (text) {
    var labels = [
      t("status_conn_disconnected"),
      t("status_conn_connected"),
      t("status_conn_error"),
    ];
    text.textContent = labels[state] || "";
  }
}

export function connStateChange(state, animate) {
  if (_badgeInst) _badgeInst.setState(state, false);
  updateConnBadge(state);

  if (animate) {
    var titleKey = STATUS_STATE_KEYS.conn[state];
    showConnPanel(t(titleKey), t("status_icons_conn"));

    if (_panelInst) {
      _panelInst.setState(_panelInst.currentFrame, false);
      setTimeout(function () {
        if (_panelInst) _panelInst.setState(state, true);
      }, 400);
    }
  } else {
    if (_panelInst) _panelInst.setState(state, false);
  }
}

export function createBotStatusIcon(botCard) {
  var container = document.createElement("div");
  container.className = "bot-card-status";
  botCard.appendChild(container);
  return createStatusIcon(container, {
    group: "conn",
    size: "bot",
    showLabel: false,
  });
}

export function refreshConnBadgeText() {
  var badge = document.getElementById("connBadge");
  var text = document.getElementById("connBadgeText");
  if (!badge || !text) return;
  var state = 0;
  if (badge.classList.contains("connected")) state = 1;
  else if (badge.classList.contains("disconnected")) state = 0;
  text.textContent = t(STATUS_STATE_KEYS.conn[state]);
}

