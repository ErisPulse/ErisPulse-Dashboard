// ErisPulse Dashboard – pages/topology (auto-split from dash.js)

export async function loadTopology() {
  var d = await api("/api/topology");
  _topoRaw = d;
  var unsupported = document.getElementById("topoUnsupported");
  if (unsupported) unsupported.style.display = d && d.supported ? "none" : "";
  if (!d || !d.supported) return;
  _topoColors = {
    module: _cssVar("--accent"),
    adapter: _cssVar("--ok-c"),
    bot: _cssVar("--wr-c"),
    resource: _cssVar("--tx-t"),
    edge: _cssVar("--bd"),
    text: _cssVar("--tx-s"),
    grid: _cssVar("--bd"),
  };
  _topoBindEvents();
  _topoRebuild(true);
  _renderTopoLegend();
  var topo = (_topoRaw && _topoRaw.topology) || {};
  var botCount = 0;
  Object.keys(topo.adapters || {}).forEach(function (p) {
    botCount += Object.keys((topo.adapters[p] || {}).bots || {}).length;
  });
  _setText("topoStatModules", Object.keys(topo.modules || {}).length);
  _setText("topoStatAdapters", Object.keys(topo.adapters || {}).length);
  _setText("topoStatBots", botCount);
}

export function _cssVar(name) {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
  } catch (e) {
    return "#888";
  }
}

export function _topoTypeLabel(type) {
  var map = {
    module: "topo_type_module",
    adapter: "topo_type_adapter",
    bot: "topo_type_bot",
    command: "topo_type_command",
    handler: "topo_type_handler",
    route: "topo_type_route",
  };
  return t(map[type] || "topo_type_module");
}

export function _topoRebuild(reset) {
  var canvas = document.getElementById("topoCanvas");
  if (!canvas) return;
  var showRes = document.getElementById("topoShowCommands");
  var showScope = document.getElementById("topoShowScope");
  var showDep = document.getElementById("topoShowDepends");
  var includeRes = !showRes || showRes.checked;
  var includeScope = !showScope || showScope.checked;
  var includeDep = !showDep || showDep.checked;
  _buildTopoGraph(includeRes, includeScope, includeDep);
  _initTopoLayout(reset);
  _startTopoSim();
}

export function topoRebuild() {
  _topoRebuild(false);
}

export function _addTopoNode(id, type, label, data) {
  if (_topoGraph.nodeById[id]) return _topoGraph.nodeById[id];
  var node = {
    id: id,
    type: type,
    label: label || id,
    data: data || {},
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    degree: 0,
  };
  _topoGraph.nodes.push(node);
  _topoGraph.nodeById[id] = node;
  return node;
}

export function _addTopoEdge(source, target, kind) {
  if (!source || !target) return;
  if (source.id === target.id) return;
  for (var i = 0; i < _topoGraph.edges.length; i++) {
    var e = _topoGraph.edges[i];
    if (e.source === source && e.target === target && e.kind === kind) return;
  }
  _topoGraph.edges.push({ source: source, target: target, kind: kind });
  source.degree++;
  target.degree++;
}

export function _buildTopoGraph(includeRes, includeScope, includeDep) {
  _topoGraph = { nodes: [], edges: [], nodeById: {} };
  var topo = (_topoRaw && _topoRaw.topology) || {};
  var modules = topo.modules || {};
  var adapters = topo.adapters || {};
  var emptyEl = document.getElementById("topoEmpty");
  if (emptyEl) emptyEl.style.display = "none";
  var detailEl = document.getElementById("topoDetail");
  if (detailEl) detailEl.style.display = "none";

  Object.keys(modules).forEach(function (name) {
    var info = modules[name] || {};
    var node = _addTopoNode("module:" + name, "module", name, info);
    if (includeRes) {
      (info.commands || []).forEach(function (c) {
        _addTopoEdge(node, _addTopoNode("command:" + name + ":" + c, "command", "/" + c, { owner: name }), "own");
      });
      Object.keys(info.handlers || {}).forEach(function (h) {
        _addTopoEdge(node, _addTopoNode("handler:" + name + ":" + h, "handler", h + " ×" + info.handlers[h], { owner: name }), "own");
      });
      var routes = info.routes || {};
      (routes.http || []).forEach(function (r) {
        var rn = _addTopoNode("route:" + name + ":http:" + r, "route", _topoRouteLabel("GET", r), { owner: name, full: "GET " + r });
        _addTopoEdge(node, rn, "own");
      });
      (routes.ws || []).forEach(function (r) {
        var rn = _addTopoNode("route:" + name + ":ws:" + r, "route", _topoRouteLabel("WS", r), { owner: name, full: "WS " + r });
        _addTopoEdge(node, rn, "own");
      });
      (routes.sse || []).forEach(function (r) {
        var rn = _addTopoNode("route:" + name + ":sse:" + r, "route", _topoRouteLabel("SSE", r), { owner: name, full: "SSE " + r });
        _addTopoEdge(node, rn, "own");
      });
    }
    if (includeDep) {
      (info.depends || []).forEach(function (dep) {
        if (modules[dep]) {
          var depNode = _addTopoNode("module:" + dep, "module", dep, modules[dep]);
          _addTopoEdge(node, depNode, "depends");
        }
      });
    }
  });

  var scopeTree = topo.scope || {};
  var scopePlatforms = scopeTree.platforms || {};
  var scopeBots = scopeTree.bots || {};

  Object.keys(adapters).forEach(function (platform) {
    var info = adapters[platform] || {};
    var adapterNode = _addTopoNode("adapter:" + platform, "adapter", platform, {
      status: info.status,
      enabled: info.enabled,
    });
    if (includeScope && scopePlatforms[platform]) {
      _bindScopeEdges(adapterNode, scopePlatforms[platform]);
    }
    Object.keys(info.bots || {}).forEach(function (botId) {
      var bot = info.bots[botId] || {};
      var botNode = _addTopoNode("bot:" + platform + ":" + botId, "bot", botId, {
        status: bot.status,
        last_active: bot.last_active,
        platform: platform,
      });
      _addTopoEdge(adapterNode, botNode, "own");
      if (includeScope && scopeBots[platform] && scopeBots[platform][botId]) {
        _bindScopeEdges(botNode, scopeBots[platform][botId]);
      }
    });
  });

  if (!_topoGraph.nodes.length && emptyEl) {
    emptyEl.style.display = "";
  }
}

export function _topoRouteLabel(method, path) {
  var clean = String(path || "").split("?")[0];
  var parts = clean.split("/").filter(Boolean);
  var seg = parts.pop() || clean;
  if (seg.length > 14) seg = seg.slice(0, 12) + "…";
  return method + " · " + seg;
}

export function _bindScopeEdges(sourceNode, binding) {
  if (!binding || typeof binding !== "object") return;
  var modules = binding.modules || [];
  modules.forEach(function (m) {
    var target = _topoGraph.nodeById["module:" + m];
    if (!target) {
      var all = (_topoRaw && _topoRaw.topology && _topoRaw.topology.modules) || {};
      var match = Object.keys(all).find(function (k) {
        return k.toLowerCase() === String(m).toLowerCase();
      });
      if (match) target = _topoGraph.nodeById["module:" + match];
    }
    if (target) _addTopoEdge(sourceNode, target, "scope");
  });
}

export function _initTopoLayout(reset) {
  var nodes = _topoGraph.nodes;
  var n = nodes.length;
  var radius = Math.min(360, 90 + n * 8);
  for (var i = 0; i < n; i++) {
    var node = nodes[i];
    if (reset || node.x === 0 && node.y === 0) {
      var angle = (2 * Math.PI * i) / Math.max(1, n);
      var ring = node.type === "module" || node.type === "adapter" ? 0.55 : 1;
      node.x = Math.cos(angle) * radius * ring;
      node.y = Math.sin(angle) * radius * ring;
      node.vx = 0;
      node.vy = 0;
    }
  }
  if (reset) _topoView = { x: 0, y: 0, k: 1 };
}

export function _startTopoSim() {
  _topoSim.ticks = 0;
  if (_topoSim.running) return;
  _topoSim.running = true;
  function frame(ts) {
    if (!_topoSim.running) return;
    if (_topoIsVisible(document.getElementById("topoCanvas"))) {
      if (_topoSim.ticks < 400) {
        _topoTick();
        _topoSim.ticks++;
      }
      _topoDraw(ts || 0);
    }
    _topoSim.raf = requestAnimationFrame(frame);
  }
  _topoSim.raf = requestAnimationFrame(frame);
}

export function _topoTick() {
  var nodes = _topoGraph.nodes;
  var edges = _topoGraph.edges;
  var n = nodes.length;
  var i, j, a, b;
  var repulsion = 9000;
  for (i = 0; i < n; i++) {
    a = nodes[i];
    for (j = i + 1; j < n; j++) {
      b = nodes[j];
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var d2 = dx * dx + dy * dy;
      if (d2 < 1) d2 = 1;
      if (d2 > 480 * 480) continue;
      var d = Math.sqrt(d2);
      var f = repulsion / d2;
      var fx = (dx / d) * f;
      var fy = (dy / d) * f;
      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;
    }
  }
  var spring = 0.015;
  var restLen = 110;
  for (i = 0; i < edges.length; i++) {
    a = edges[i].source;
    b = edges[i].target;
    var ddx = b.x - a.x;
    var ddy = b.y - a.y;
    var dist = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
    var force = spring * (dist - restLen);
    var fxx = (ddx / dist) * force;
    var fyy = (ddy / dist) * force;
    a.vx += fxx;
    a.vy += fyy;
    b.vx -= fxx;
    b.vy -= fyy;
  }
  var centerPull = 0.0035;
  var damping = 0.86;
  for (i = 0; i < n; i++) {
    a = nodes[i];
    a.vx -= a.x * centerPull;
    a.vy -= a.y * centerPull;
    if (a === _topoDrag) {
      a.vx = 0;
      a.vy = 0;
      continue;
    }
    a.vx *= damping;
    a.vy *= damping;
    a.x += Math.max(-12, Math.min(12, a.vx));
    a.y += Math.max(-12, Math.min(12, a.vy));
  }
}

export function _topoNodeRadius(node) {
  var base = { module: 11, adapter: 12, bot: 9, command: 5, handler: 5, route: 5 }[node.type] || 6;
  return base + Math.min(6, node.degree * 0.6);
}

export function _topoShapePath(ctx, type, x, y, r) {
  ctx.beginPath();
  if (type === "module") {
    var rr = r * 0.35;
    ctx.moveTo(x - r + rr, y - r);
    ctx.arcTo(x + r, y - r, x + r, y + r, rr);
    ctx.arcTo(x + r, y + r, x - r, y + r, rr);
    ctx.arcTo(x - r, y + r, x - r, y - r, rr);
    ctx.arcTo(x - r, y - r, x + r, y - r, rr);
    ctx.closePath();
  } else if (type === "adapter") {
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 6 + (i * Math.PI) / 3;
      var px = x + Math.cos(a) * r;
      var py = y + Math.sin(a) * r;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
  } else if (type === "handler") {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
  } else if (type === "route") {
    var rs = r * 0.4;
    ctx.moveTo(x - r + rs, y - r);
    ctx.arcTo(x + r, y - r, x + r, y + r, rs);
    ctx.arcTo(x + r, y + r, x - r, y + r, rs);
    ctx.arcTo(x - r, y + r, x - r, y - r, rs);
    ctx.arcTo(x - r, y - r, x + r, y - r, rs);
    ctx.closePath();
  } else {
    ctx.arc(x, y, r, 0, 2 * Math.PI);
  }
}

export function _topoNodeColor(node) {
  if (node.type === "module") {
    return node.data && node.data.loaded ? _topoColors.module : _topoColors.resource;
  }
  if (node.type === "adapter") return _topoColors.adapter;
  if (node.type === "bot") {
    var st = String((node.data && node.data.status) || "").toLowerCase();
    if (st === "online") return _topoColors.adapter;
    if (st === "offline" || st === "disabled") return _topoColors.resource;
    return _topoColors.bot;
  }
  return _topoColors.resource;
}

export function _topoQuadCtrl(p0, p1, k) {
  var mx = (p0.x + p1.x) / 2;
  var my = (p0.y + p1.y) / 2;
  return { x: mx - (p1.y - p0.y) * k, y: my + (p1.x - p0.x) * k };
}

export function _topoQuadPoint(p0, c, p1, t) {
  var u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
  };
}

export function _topoDrawGrid(ctx, w, h) {
  var gap = 30;
  var ox = (((w / 2 + _topoView.x) % gap) + gap) % gap;
  var oy = (((h / 2 + _topoView.y) % gap) + gap) % gap;
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = _topoColors.grid;
  for (var gx = ox; gx < w; gx += gap) {
    for (var gy = oy; gy < h; gy += gap) {
      ctx.fillRect(gx, gy, 1.2, 1.2);
    }
  }
  ctx.restore();
}

export function _topoDraw(ts) {
  ts = ts || 0;
  var canvas = document.getElementById("topoCanvas");
  if (!canvas) return;
  var wrap = canvas.parentElement;
  var dpr = window.devicePixelRatio || 1;
  var w = wrap.clientWidth;
  var h = canvas.clientHeight || 560;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  var ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  _topoDrawGrid(ctx, w, h);
  ctx.save();
  ctx.translate(w / 2 + _topoView.x, h / 2 + _topoView.y);
  ctx.scale(_topoView.k, _topoView.k);

  var edges = _topoGraph.edges;
  var i, e;
  for (i = 0; i < edges.length; i++) {
    e = edges[i];
    var isActive = _topoHover && (e.source === _topoHover || e.target === _topoHover);
    var k = e.kind === "own" ? 0.1 : 0.16;
    var c = _topoQuadCtrl(e.source, e.target, k);
    ctx.beginPath();
    ctx.moveTo(e.source.x, e.source.y);
    ctx.quadraticCurveTo(c.x, c.y, e.target.x, e.target.y);
    if (e.kind === "depends") {
      ctx.setLineDash([7, 5]);
    } else if (e.kind === "scope") {
      ctx.setLineDash([2, 5]);
      ctx.lineDashOffset = -(((ts / 40) % 7) * 2);
    } else {
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = isActive ? _topoColors.module : _topoColors.edge;
    ctx.globalAlpha = _topoHover && !isActive ? 0.12 : e.kind === "own" ? 0.55 : 0.85;
    ctx.lineWidth = isActive ? 2 : e.kind === "own" ? 1.2 : 1.4;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    if (e.kind === "depends") {
      var pt = _topoQuadPoint(e.source, c, e.target, 0.72);
      var ahead = _topoQuadPoint(e.source, c, e.target, 0.78);
      var ang = Math.atan2(ahead.y - pt.y, ahead.x - pt.x);
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(3, 0);
      ctx.lineTo(-4, 3.4);
      ctx.lineTo(-4, -3.4);
      ctx.closePath();
      ctx.fillStyle = isActive ? _topoColors.module : _topoColors.edge;
      ctx.globalAlpha = _topoHover && !isActive ? 0.12 : 0.9;
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;

  var nodes = _topoGraph.nodes;
  for (i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    var r = _topoNodeRadius(node);
    var dim = _topoHover && node !== _topoHover && !_nodeAdjacent(node, _topoHover);
    var color = _topoNodeColor(node);
    var isMain = node.type === "module" || node.type === "adapter" || node.type === "bot";
    ctx.globalAlpha = dim ? 0.15 : 1;
    _topoShapePath(ctx, node.type, node.x, node.y, r);
    ctx.fillStyle = color;
    ctx.fill();
    if (isMain) {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      _topoShapePath(ctx, node.type, node.x, node.y, r);
      ctx.stroke();
    }
    if (_topoSelected === node) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 4.5, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.globalAlpha = dim ? 0.2 : 0.8;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.globalAlpha = dim ? 0.15 : 1;
    }
    ctx.globalAlpha = dim ? 0.12 : 0.95;
    ctx.font = isMain ? "600 11px sans-serif" : "10px sans-serif";
    ctx.textAlign = "center";
    var fullLabel = node.label;
    var lbl = fullLabel.length > 26 ? fullLabel.slice(0, 24) + "…" : fullLabel;
    var tw = ctx.measureText(lbl).width;
    var ly = node.y + r + 12;
    ctx.fillStyle = "rgba(128,128,128,0.2)";
    ctx.fillRect(node.x - tw / 2 - 4, ly - 8, tw + 8, 13);
    ctx.fillStyle = _topoColors.text;
    ctx.fillText(lbl, node.x, ly + 2);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function _nodeAdjacent(a, b) {
  for (var i = 0; i < _topoGraph.edges.length; i++) {
    var e = _topoGraph.edges[i];
    if ((e.source === a && e.target === b) || (e.source === b && e.target === a)) return true;
  }
  return false;
}

export function _topoScreenToWorld(px, py) {
  var canvas = document.getElementById("topoCanvas");
  var w = canvas.parentElement.clientWidth;
  var h = canvas.clientHeight || 560;
  return {
    x: (px - w / 2 - _topoView.x) / _topoView.k,
    y: (py - h / 2 - _topoView.y) / _topoView.k,
  };
}

export function _topoNodeAt(px, py) {
  var pos = _topoScreenToWorld(px, py);
  var nodes = _topoGraph.nodes;
  for (var i = nodes.length - 1; i >= 0; i--) {
    var node = nodes[i];
    var r = _topoNodeRadius(node) + 4;
    var dx = node.x - pos.x;
    var dy = node.y - pos.y;
    if (dx * dx + dy * dy <= r * r) return node;
  }
  return null;
}

export function _topoBindEvents() {
  var canvas = document.getElementById("topoCanvas");
  if (!canvas || canvas._topoBound) return;
  canvas._topoBound = true;
  canvas.addEventListener("mousedown", function (ev) {
    var rect = canvas.getBoundingClientRect();
    var px = ev.clientX - rect.left;
    var py = ev.clientY - rect.top;
    var node = _topoNodeAt(px, py);
    if (node) {
      _topoDrag = node;
      canvas.classList.add("dragging");
      _topoHideTooltip();
    } else {
      _topoPanning = true;
      canvas.classList.add("dragging");
      canvas._panStart = { x: ev.clientX, y: ev.clientY, vx: _topoView.x, vy: _topoView.y };
    }
  });
  window.addEventListener("mousemove", function (ev) {
    var rect = canvas.getBoundingClientRect();
    var px = ev.clientX - rect.left;
    var py = ev.clientY - rect.top;
    if (_topoDrag) {
      var pos = _topoScreenToWorld(px, py);
      _topoDrag.x = pos.x;
      _topoDrag.y = pos.y;
      _startTopoSim();
    } else if (_topoPanning && canvas._panStart) {
      _topoView.x = canvas._panStart.vx + (ev.clientX - canvas._panStart.x);
      _topoView.y = canvas._panStart.vy + (ev.clientY - canvas._panStart.y);
      _topoDraw();
    } else if (_topoIsVisible(canvas)) {
      var node = _topoNodeAt(px, py);
      if (node !== _topoHover) {
        _topoHover = node;
        canvas.style.cursor = node ? "pointer" : "grab";
        _topoDraw(0);
      }
      _topoUpdateTooltip(node, px, py);
    }
  });
  window.addEventListener("mouseup", function () {
    if (_topoDrag) {
      _topoSelected = _topoDrag;
      _showTopoDetail(_topoDrag);
    }
    _topoDrag = null;
    _topoPanning = false;
    canvas.classList.remove("dragging");
  });
  canvas.addEventListener("wheel", function (ev) {
    ev.preventDefault();
    var factor = ev.deltaY < 0 ? 1.12 : 0.9;
    var newK = Math.max(0.15, Math.min(3.5, _topoView.k * factor));
    var rect = canvas.getBoundingClientRect();
    var px = ev.clientX - rect.left;
    var py = ev.clientY - rect.top;
    var w = canvas.parentElement.clientWidth;
    var h = canvas.clientHeight || 560;
    var cx = px - w / 2;
    var cy = py - h / 2;
    _topoView.x = cx - ((cx - _topoView.x) * newK) / _topoView.k;
    _topoView.y = cy - ((cy - _topoView.y) * newK) / _topoView.k;
    _topoView.k = newK;
    _topoDraw();
  }, { passive: false });
  canvas.addEventListener("dblclick", function () {
    _topoView = { x: 0, y: 0, k: 1 };
    _startTopoSim();
  });
  canvas.addEventListener("mouseleave", function () {
    if (_topoDrag || _topoPanning) return;
    _topoHover = null;
    _topoHideTooltip();
    _topoDraw(0);
  });

  // ---- 触摸：单指拖动/平移，双指捏合缩放，双击复位 ----

  canvas.addEventListener("touchstart", function (ev) {
    if (ev.touches.length === 1) {
      var t = ev.touches[0];
      var rect = canvas.getBoundingClientRect();
      var px = t.clientX - rect.left;
      var py = t.clientY - rect.top;
      var node = _topoNodeAt(px, py);
      canvas._tapStart = { x: t.clientX, y: t.clientY };
      canvas._tapLast = { x: t.clientX, y: t.clientY };
      if (node) {
        _topoDrag = node;
      } else {
        _topoPanning = true;
        canvas._panStart = { x: t.clientX, y: t.clientY, vx: _topoView.x, vy: _topoView.y };
      }
      canvas.classList.add("dragging");
      _topoHideTooltip();
      ev.preventDefault();
    } else if (ev.touches.length === 2) {
      _topoDrag = null;
      _topoPanning = false;
      var a = ev.touches[0];
      var b = ev.touches[1];
      canvas._pinch = {
        dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1,
        k: _topoView.k,
        midX: (a.clientX + b.clientX) / 2,
        midY: (a.clientY + b.clientY) / 2,
        vx: _topoView.x,
        vy: _topoView.y,
      };
      ev.preventDefault();
    }
  }, { passive: false });

  canvas.addEventListener("touchmove", function (ev) {
    if (ev.touches.length === 2 && canvas._pinch) {
      var a = ev.touches[0];
      var b = ev.touches[1];
      var p = canvas._pinch;
      var dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
      var midX = (a.clientX + b.clientX) / 2;
      var midY = (a.clientY + b.clientY) / 2;
      var newK = Math.max(0.15, Math.min(3.5, p.k * (dist / p.dist)));
      var rect = canvas.getBoundingClientRect();
      var w = canvas.parentElement.clientWidth;
      var h = canvas.clientHeight || 560;
      var cx = p.midX - rect.left - w / 2;
      var cy = p.midY - rect.top - h / 2;
      _topoView.x = cx - ((cx - p.vx) * newK) / p.k;
      _topoView.y = cy - ((cy - p.vy) * newK) / p.k;
      _topoView.k = newK;
      _topoView.x += midX - p.midX;
      _topoView.y += midY - p.midY;
      _topoDraw();
      ev.preventDefault();
    } else if (ev.touches.length === 1) {
      var t = ev.touches[0];
      canvas._tapLast = { x: t.clientX, y: t.clientY };
      var rect = canvas.getBoundingClientRect();
      var px = t.clientX - rect.left;
      var py = t.clientY - rect.top;
      if (_topoDrag) {
        var pos = _topoScreenToWorld(px, py);
        _topoDrag.x = pos.x;
        _topoDrag.y = pos.y;
        _startTopoSim();
        ev.preventDefault();
      } else if (_topoPanning && canvas._panStart) {
        _topoView.x = canvas._panStart.vx + (t.clientX - canvas._panStart.x);
        _topoView.y = canvas._panStart.vy + (t.clientY - canvas._panStart.y);
        _topoDraw();
        ev.preventDefault();
      }
    }
  }, { passive: false });

  function _topoTouchEnd() {
    if (_topoDrag) {
      _topoSelected = _topoDrag;
      _showTopoDetail(_topoDrag);
    }
    // 双击空白复位
    var moved = 0;
    if (canvas._tapStart && canvas._tapLast) {
      moved = Math.hypot(
        canvas._tapLast.clientX - canvas._tapStart.clientX,
        canvas._tapLast.clientY - canvas._tapStart.clientY,
      );
    }
    if (moved < 10) {
      var now = Date.now();
      if (now - (canvas._lastTap || 0) < 300) {
        _topoView = { x: 0, y: 0, k: 1 };
        _startTopoSim();
        canvas._lastTap = 0;
      } else {
        canvas._lastTap = now;
      }
    }
    _topoDrag = null;
    _topoPanning = false;
    canvas._pinch = null;
    canvas._panStart = null;
    canvas.classList.remove("dragging");
    _topoDraw(0);
  }
  canvas.addEventListener("touchend", _topoTouchEnd);
  canvas.addEventListener("touchcancel", _topoTouchEnd);
}

export function _topoUpdateTooltip(node, px, py) {
  var tip = document.getElementById("topoTooltip");
  if (!tip) return;
  if (!node) {
    tip.style.display = "none";
    return;
  }
  tip.innerHTML =
    "<b>" + esc((node.data && node.data.full) || node.label) + '</b><span class="tt-type">' + esc(_topoTypeLabel(node.type)) + "</span>";
  tip.style.display = "block";
  var canvas = document.getElementById("topoCanvas");
  var wrapW = canvas.parentElement.clientWidth;
  var wrapH = canvas.clientHeight || 560;
  var tw = tip.offsetWidth;
  var th = tip.offsetHeight;
  tip.style.left = Math.max(4, Math.min(px + 14, wrapW - tw - 8)) + "px";
  tip.style.top = Math.max(4, Math.min(py + 14, wrapH - th - 8)) + "px";
}

export function _topoHideTooltip() {
  var tip = document.getElementById("topoTooltip");
  if (tip) tip.style.display = "none";
}

export function _topoIsVisible(canvas) {
  return canvas && canvas.offsetParent !== null;
}

export function _showTopoDetail(node) {
  var panel = document.getElementById("topoDetail");
  if (!panel) return;
  var html = "";
  var closeBtn =
    '<button class="btn-icon topo-detail-close" onclick="closeTopoDetail()">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
  var typeLabel = '<span class="scope-entry-chip">' + esc(_topoTypeLabel(node.type)) + "</span>";
  html += closeBtn + "<h4>" + esc((node.data && node.data.full) || node.label) + " " + typeLabel + "</h4>";
  var d = node.data || {};
  function kv(k, v) {
    return '<div class="topo-detail-kv"><span class="topo-detail-k">' + esc(k) + ':</span><span class="topo-detail-v">' + esc(String(v)) + "</span></div>";
  }
  if (node.type === "module") {
    html += kv(t("topo_detail_status"), (d.loaded ? t("topo_detail_loaded") : "—") + " / " + (d.enabled ? t("topo_detail_enabled") : "—"));
    var meta = d.info || {};
    if (meta.version) html += kv(t("topo_detail_version"), meta.version);
    if (meta.description) html += kv("", meta.description);
    var res = [];
    if ((d.commands || []).length) res.push(t("topo_type_command") + " ×" + d.commands.length);
    Object.keys(d.handlers || {}).forEach(function (h) {
      res.push(h + " ×" + d.handlers[h]);
    });
    if (res.length) {
      html +=
        '<div class="topo-detail-kv"><span class="topo-detail-k">' + t("topo_detail_resources") + ':</span></div><div class="topo-detail-list">' +
        res.map(function (r2) { return '<span class="scope-entry-chip">' + esc(r2) + "</span>"; }).join(" ") +
        "</div>";
    }
    if ((d.depends || []).length) {
      html +=
        '<div class="topo-detail-kv"><span class="topo-detail-k">' + t("topo_edge_depends") + ':</span><span class="topo-detail-v">' + esc(d.depends.join(", ")) + "</span></div>";
    }
  } else if (node.type === "adapter") {
    html += kv(t("topo_detail_status"), String(d.status || "—"));
    if (typeof d.enabled !== "undefined") html += kv(t("topo_detail_enabled"), String(d.enabled));
    html += _topoScopeChipsHtml("platforms", node.label);
  } else if (node.type === "bot") {
    html += kv(t("topo_detail_status"), String(d.status || "—"));
    if (d.platform) html += kv(t("topo_type_adapter"), d.platform);
    if (d.platform) html += _topoScopeChipsHtml("bots", d.platform, node.label);
  } else if (node.type === "command" || node.type === "handler" || node.type === "route") {
    if (d.owner) html += kv(t("scope_owner"), d.owner);
  }
  var target = { module: "module-mgmt", adapter: "adapter", bot: "bots", command: "commands", handler: "event-stream", route: "api-routes" }[node.type];
  if (target) {
    html +=
      '<div class="topo-detail-actions">' +
      '<button class="btn btn-primary btn-sm" style="width:100%" onclick="closeTopoDetail();go(\'' + target + '\')">' +
      esc(t("topo_open")) + "</button></div>";
  }
  panel.innerHTML = html;
  panel.style.display = "";
}

export function closeTopoDetail() {
  var panel = document.getElementById("topoDetail");
  if (panel) panel.style.display = "none";
  _topoSelected = null;
  _topoDraw(0);
}

export function _topoScopeChipsHtml(bucket, platform, subKey) {
  try {
    var scopeTree = (_topoRaw && _topoRaw.topology && _topoRaw.topology.scope) || {};
    var binding;
    if (!subKey) {
      binding = (scopeTree.platforms || {})[platform];
    } else {
      binding = ((scopeTree[bucket] || {})[platform] || {})[subKey];
    }
    if (!binding || typeof binding !== "object") return "";
    var chips =
      _scopeEntryChips(binding.modules || [], "") +
      " " +
      _scopeEntryChips(binding.blocked || [], "blocked");
    if (binding.merge) chips += ' <span class="scope-entry-chip merge">merge</span>';
    if (!chips.trim()) return "";
    return (
      '<div class="topo-detail-kv" style="margin-top:6px"><span class="topo-detail-k">' +
      esc(t("topo_edge_scope")) + ':</span></div><div class="topo-detail-list">' + chips + "</div>"
    );
  } catch (e) {
    return "";
  }
}

export function _renderTopoLegend() {
  var legend = document.getElementById("topoLegend");
  if (!legend) return;
  function item(color, label) {
    return (
      '<span class="topo-legend-item"><span class="topo-legend-dot" style="background:' + color + '"></span>' + esc(label) + "</span>"
    );
  }
  legend.innerHTML =
    item(_topoColors.module, t("topo_type_module")) +
    item(_topoColors.adapter, t("topo_type_adapter")) +
    item(_topoColors.bot, t("topo_type_bot")) +
    item(_topoColors.resource, t("topo_detail_resources")) +
    '<span class="topo-legend-item"><span class="topo-legend-line"></span>' + esc(t("topo_edge_own")) + "</span>" +
    '<span class="topo-legend-item"><span class="topo-legend-line dashed"></span>' + esc(t("topo_edge_depends")) + "</span>" +
    '<span class="topo-legend-item"><span class="topo-legend-line dotted"></span>' + esc(t("topo_edge_scope")) + "</span>";
}

export function _topoStopSim() {
  _topoSim.running = false;
  if (_topoSim.raf) cancelAnimationFrame(_topoSim.raf);
}

window.addEventListener("resize", function () {
  if (_topoIsVisible(document.getElementById("topoCanvas"))) _topoDraw();
});;

