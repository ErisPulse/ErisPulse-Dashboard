// ErisPulse Dashboard – pages/topology (auto-split from dash.js)
//
// 渲染与性能契约：
// - 单 <canvas> 绘制，无逐元素 DOM/SVG；布局收敛后 rAF 循环自动停止，
//   平移/缩放/悬停等交互按需单帧重绘，仅在「流动动画模式」下持续重绘。
// - 数据刷新按节点 id 复用旧节点位置（增量），不重置视图，不闪白。
// - 视口外节点/边跳过绘制；标签截断结果缓存在节点上；邻居查询 O(1)。
// - 流动动画（scope 边 marching-ants）默认关闭，需用户显式开启；
//   尊重设置页动效开关（data-anim="off"）与 prefers-reduced-motion。

var _TOPO_ANIM_NODE_CAP = 160; // 流动动画的节点数上限，超过自动降级为静态
var _topoAnimUserOn = null;    // 用户动画开关（缓存 localStorage）
var _topoFlowOn = false;       // 当前是否处于流动动画（连续重绘）状态
var _topoDegradeNotified = false;
var _topoPrevById = null;      // 增量重建时上一轮节点快照（保留位置）
var _topoTipNodeId = null;     // tooltip 增量渲染：当前已渲染的节点 id
var _topoTipW = 0;
var _topoTipH = 0;
var _topoThemeTimer = 0;
var _topoMql = null;

function _topoT(key, zh, en) {
  // i18n 词条缺失时的兜底文案（语言包文件不在本页可编辑范围）
  var s = t(key);
  if (s === key) {
    var lg = window.lang || "";
    s = lg === "zh" || lg === "zh-TW" ? zh : en;
  }
  return s;
}

export async function loadTopology() {
  var d = await api("/api/topology");
  _topoRaw = d;
  var unsupported = document.getElementById("topoUnsupported");
  if (unsupported) unsupported.style.display = d && d.supported ? "none" : "";
  if (!d || !d.supported) return;
  _refreshTopoColors();
  _topoWatchTheme();
  _topoBindEvents();
  _topoRebuild(false); // 增量刷新：保留已有节点位置与视图
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

// 画布取色一律走 token；主题/accent/皮肤切换时由 _topoWatchTheme 触发重读
export function _refreshTopoColors() {
  _topoColors = {
    module: _cssVar("--accent"),
    adapter: _cssVar("--ok-c"),
    bot: _cssVar("--wr-c"),
    resource: _cssVar("--tx-t"),
    edge: _cssVar("--bd-h"),
    edgeActive: _cssVar("--accent"),
    text: _cssVar("--tx-s"),
    grid: _cssVar("--bd"),
    surface: _cssVar("--bg-t"),
  };
}

export function _topoMotionOK() {
  if (document.documentElement.getAttribute("data-anim") === "off") return false;
  try {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  } catch (e) {}
  return true;
}

export function _topoAnimPref() {
  if (_topoAnimUserOn === null) {
    try {
      _topoAnimUserOn = localStorage.getItem("ep_topo_anim") === "1";
    } catch (e) {
      _topoAnimUserOn = false;
    }
  }
  return _topoAnimUserOn;
}

// 计算流动动画是否生效（用户开启 && 动效允许 && 图规模未超限）
export function _topoEvalFlow() {
  _topoFlowOn =
    _topoAnimPref() &&
    _topoMotionOK() &&
    _topoGraph.nodes.length <= _TOPO_ANIM_NODE_CAP;
  return _topoFlowOn;
}

export function _topoSyncAnimUI() {
  var cb = document.getElementById("topoShowAnim");
  if (cb) cb.checked = _topoFlowOn;
  var lb = document.getElementById("topoAnimLabel");
  if (lb) lb.textContent = _topoT("topo_show_anim", "流动动画", "Flow animation");
}

export function topoSetAnim(on) {
  _topoAnimUserOn = !!on;
  try {
    localStorage.setItem("ep_topo_anim", on ? "1" : "0");
  } catch (e) {}
  var was = _topoFlowOn;
  _topoEvalFlow();
  _topoSyncAnimUI();
  if (_topoFlowOn) {
    _startTopoSim();
  } else if (was) {
    _topoStopSim();
    _topoDraw(0);
  }
  if (on && !_topoFlowOn && _topoMotionOK() && !_topoDegradeNotified) {
    _topoDegradeNotified = true;
    toast(_topoT("topo_anim_degrade", "节点较多，已自动降级为静态渲染", "Large graph: static rendering enabled"), "");
  }
}

// 主题 / accent / 皮肤 / 动效设置变化 → 重读 token 并重绘（rAF 级防抖）
export function _topoWatchTheme() {
  if (window._topoThemeWatched) return;
  window._topoThemeWatched = true;
  var observer = new MutationObserver(function () {
    if (_topoThemeTimer) return;
    _topoThemeTimer = setTimeout(function () {
      _topoThemeTimer = 0;
      if (!_topoRaw || !_topoRaw.supported) return;
      _refreshTopoColors();
      _topoTipNodeId = null; // 字号/字体可能变化，tooltip 尺寸缓存失效
      var was = _topoFlowOn;
      _topoEvalFlow();
      _topoSyncAnimUI();
      if (_topoFlowOn && !was) _startTopoSim();
      else if (!_topoFlowOn && was) _topoStopSim();
      _topoDraw(0);
    }, 80);
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-oled", "data-anim", "data-density", "data-ui-style", "style"],
  });
  try {
    _topoMql = window.matchMedia("(prefers-reduced-motion: reduce)");
    var onMql = function () {
      var was = _topoFlowOn;
      _topoEvalFlow();
      _topoSyncAnimUI();
      if (!_topoFlowOn && was) _topoStopSim();
      _topoDraw(0);
    };
    if (_topoMql.addEventListener) _topoMql.addEventListener("change", onMql);
    else if (_topoMql.addListener) _topoMql.addListener(onMql);
  } catch (e) {}
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
  _topoEvalFlow();
  _topoSyncAnimUI();
  if (
    _topoAnimPref() &&
    _topoMotionOK() &&
    _topoGraph.nodes.length > _TOPO_ANIM_NODE_CAP &&
    !_topoDegradeNotified
  ) {
    _topoDegradeNotified = true;
    toast(_topoT("topo_anim_degrade", "节点较多，已自动降级为静态渲染", "Large graph: static rendering enabled"), "");
  }
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
    adj: {},
  };
  // 增量刷新：同 id 节点继承上一轮位置，避免全量重排导致的跳变
  var prev = _topoPrevById && _topoPrevById[id];
  if (prev) {
    node.x = prev.x;
    node.y = prev.y;
  }
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
  source.adj[target.id] = target;
  target.adj[source.id] = source;
}

export function _buildTopoGraph(includeRes, includeScope, includeDep) {
  _topoPrevById = (_topoGraph && _topoGraph.nodeById) || {};
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
  var i, node;
  if (reset) {
    var radius = Math.min(360, 90 + n * 8);
    for (i = 0; i < n; i++) {
      node = nodes[i];
      var angle = (2 * Math.PI * i) / Math.max(1, n);
      var ring = node.type === "module" || node.type === "adapter" ? 0.55 : 1;
      node.x = Math.cos(angle) * radius * ring;
      node.y = Math.sin(angle) * radius * ring;
      node.vx = 0;
      node.vy = 0;
    }
    _topoView = { x: 0, y: 0, k: 1 };
    return;
  }
  // 增量摆放：已定位节点原位保留；新节点（x==0&&y==0）BFS 摆到已定位邻居旁
  var queue = [];
  for (i = 0; i < n; i++) {
    node = nodes[i];
    if (node.x === 0 && node.y === 0) node._new = 1;
    else queue.push(node);
  }
  if (!queue.length) {
    // 首次加载：根节点（模块/适配器）落内环，其余由 BFS 展开
    var roots = [];
    for (i = 0; i < n; i++) {
      if (nodes[i].type === "module" || nodes[i].type === "adapter") roots.push(nodes[i]);
    }
    if (!roots.length && n) roots = [nodes[0]];
    var radius0 = Math.min(360, 90 + roots.length * 14);
    roots.forEach(function (r, idx) {
      var a = (2 * Math.PI * idx) / Math.max(1, roots.length);
      r.x = Math.cos(a) * radius0;
      r.y = Math.sin(a) * radius0;
      r._new = 0;
      queue.push(r);
    });
  }
  var seed = 0;
  var qi = 0;
  while (qi < queue.length) {
    var cur = queue[qi++];
    var nbrs = cur.adj ? Object.keys(cur.adj) : [];
    for (var j = 0; j < nbrs.length; j++) {
      var nb = cur.adj[nbrs[j]];
      if (!nb || !nb._new) continue;
      var ang = (seed * 2.399963) % (2 * Math.PI); // 黄金角散布，避免堆叠
      var dist = 70 + (seed % 3) * 24;
      nb.x = cur.x + Math.cos(ang) * dist;
      nb.y = cur.y + Math.sin(ang) * dist;
      nb._new = 0;
      queue.push(nb);
      seed++;
    }
  }
  // 兜底：与已定位部分无连接的孤立新节点落外环
  var left = [];
  for (i = 0; i < n; i++) if (nodes[i]._new) left.push(nodes[i]);
  if (left.length) {
    var radius = Math.min(420, 120 + n * 6);
    left.forEach(function (nd, idx) {
      var a = (2 * Math.PI * idx) / left.length;
      nd.x = Math.cos(a) * radius;
      nd.y = Math.sin(a) * radius;
    });
  }
  for (i = 0; i < n; i++) delete nodes[i]._new;
}

export function _topoMaxTicks() {
  return _topoGraph.nodes.length > 120 ? 160 : 300;
}

export function _topoSettleEpsilon() {
  return Math.max(0.4, _topoGraph.nodes.length * 0.02);
}

export function _startTopoSim() {
  _topoSim.ticks = 0;
  _topoSim.still = 0;
  _topoSim.settled = false;
  if (_topoSim.running) return;
  _topoSim.running = true;
  function frame(ts) {
    if (!_topoSim.running) return;
    var canvas = document.getElementById("topoCanvas");
    if (!canvas) {
      _topoSim.running = false;
      _topoSim.raf = 0;
      return;
    }
    if (_topoIsVisible(canvas)) {
      if (!_topoSim.settled) {
        var moved = _topoTick();
        _topoSim.ticks++;
        if (moved < _topoSettleEpsilon()) _topoSim.still++;
        else _topoSim.still = 0;
        if (_topoSim.ticks >= _topoMaxTicks() || _topoSim.still >= 30) _topoSim.settled = true;
      }
      _topoDraw(ts || 0);
      // 布局已定格且无流动动画 → 停止常驻循环，之后由交互事件按需单帧重绘
      if (_topoSim.settled && !_topoFlowOn) {
        _topoSim.running = false;
        _topoSim.raf = 0;
        return;
      }
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
  var moved = 0;
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
    var mx = Math.max(-12, Math.min(12, a.vx));
    var my = Math.max(-12, Math.min(12, a.vy));
    a.x += mx;
    a.y += my;
    moved += Math.abs(mx) + Math.abs(my);
  }
  return moved;
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
  var bw = Math.round(w * dpr);
  var bh = Math.round(h * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  var ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  _topoDrawGrid(ctx, w, h);
  ctx.save();
  ctx.translate(w / 2 + _topoView.x, h / 2 + _topoView.y);
  var k = _topoView.k;
  ctx.scale(k, k);

  // 视口（世界坐标）粗裁剪：视口外的边与节点直接跳过绘制
  var pad = 80 / k;
  var vx0 = (-w / 2 - _topoView.x) / k - pad;
  var vx1 = (w / 2 - _topoView.x) / k + pad;
  var vy0 = (-h / 2 - _topoView.y) / k - pad;
  var vy1 = (h / 2 - _topoView.y) / k + pad;

  var edges = _topoGraph.edges;
  var i, e;
  var flow = _topoFlowOn;
  for (i = 0; i < edges.length; i++) {
    e = edges[i];
    var sx = e.source.x;
    var sy = e.source.y;
    var tx = e.target.x;
    var ty = e.target.y;
    if (Math.min(sx, tx) > vx1 || Math.max(sx, tx) < vx0 || Math.min(sy, ty) > vy1 || Math.max(sy, ty) < vy0) continue;
    var isActive = _topoHover && (e.source === _topoHover || e.target === _topoHover);
    var kv = e.kind === "own" ? 0.1 : 0.16;
    var c = _topoQuadCtrl(e.source, e.target, kv);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(c.x, c.y, tx, ty);
    if (e.kind === "depends") {
      ctx.setLineDash([7, 5]);
    } else if (e.kind === "scope") {
      ctx.setLineDash([2, 5]);
      // marching-ants 仅在流动动画模式下运行；静态模式不产生持续重绘
      if (flow) ctx.lineDashOffset = -(((ts / 40) % 7) * 2);
    } else {
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = isActive ? _topoColors.edgeActive : _topoColors.edge;
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
      ctx.fillStyle = isActive ? _topoColors.edgeActive : _topoColors.edge;
      ctx.globalAlpha = _topoHover && !isActive ? 0.12 : 0.9;
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;

  var nodes = _topoGraph.nodes;
  var total = nodes.length;
  // 缩放过深/图过大时隐藏小节点标签，主节点标签低缩放仍保留
  var showSmallLabels = k >= 0.65 && total <= 240;
  var showMainLabels = k >= 0.3;
  for (i = 0; i < total; i++) {
    var node = nodes[i];
    var nx = node.x;
    var ny = node.y;
    if (nx < vx0 || nx > vx1 || ny < vy0 || ny > vy1) continue;
    var r = _topoNodeRadius(node);
    var dim = _topoHover && node !== _topoHover && !_nodeAdjacent(node, _topoHover);
    var color = _topoNodeColor(node);
    var isMain = node.type === "module" || node.type === "adapter" || node.type === "bot";
    ctx.globalAlpha = dim ? 0.15 : 1;
    _topoShapePath(ctx, node.type, nx, ny, r);
    ctx.fillStyle = color;
    ctx.fill();
    if (isMain) {
      // 用卡面 token 色描边，替代硬编码 rgba(0,0,0,.28)，双主题下均可分离
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = _topoColors.surface;
      ctx.globalAlpha = dim ? 0.15 : 0.9;
      _topoShapePath(ctx, node.type, nx, ny, r);
      ctx.stroke();
    }
    if (_topoSelected === node) {
      ctx.beginPath();
      ctx.arc(nx, ny, r + 4.5, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.globalAlpha = dim ? 0.2 : 0.8;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.globalAlpha = dim ? 0.15 : 1;
    }
    var showLabel = isMain ? showMainLabels : showSmallLabels;
    if (!showLabel) continue;
    // 标签截断结果缓存于节点，避免每帧 slice/measure
    var lbl = node._lbl;
    if (lbl === undefined) {
      lbl = node.label.length > 26 ? node.label.slice(0, 24) + "…" : node.label;
      node._lbl = lbl;
    }
    ctx.globalAlpha = dim ? 0.12 : 0.95;
    ctx.font = isMain ? "600 11px sans-serif" : "10px sans-serif";
    ctx.textAlign = "center";
    var tw = ctx.measureText(lbl).width;
    var ly = ny + r + 12;
    ctx.fillStyle = _topoColors.surface;
    ctx.globalAlpha = dim ? 0.12 : 0.75;
    ctx.fillRect(nx - tw / 2 - 4, ly - 8, tw + 8, 13);
    ctx.globalAlpha = dim ? 0.12 : 0.95;
    ctx.fillStyle = _topoColors.text;
    ctx.fillText(lbl, nx, ly + 2);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function _nodeAdjacent(a, b) {
  if (!a || !b) return false;
  if (a.adj) return !!a.adj[b.id]; // O(1) 邻接表，替代 O(E) 全边扫描
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
      var inside = px >= 0 && py >= 0 && px <= rect.width && py <= rect.height;
      var node = inside ? _topoNodeAt(px, py) : null;
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
    _topoDraw();
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
      var tch = ev.touches[0];
      var rect = canvas.getBoundingClientRect();
      var px = tch.clientX - rect.left;
      var py = tch.clientY - rect.top;
      var node = _topoNodeAt(px, py);
      canvas._tapStart = { x: tch.clientX, y: tch.clientY };
      canvas._tapLast = { x: tch.clientX, y: tch.clientY };
      if (node) {
        _topoDrag = node;
      } else {
        _topoPanning = true;
        canvas._panStart = { x: tch.clientX, y: tch.clientY, vx: _topoView.x, vy: _topoView.y };
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
      var tch = ev.touches[0];
      canvas._tapLast = { x: tch.clientX, y: tch.clientY };
      var rect = canvas.getBoundingClientRect();
      var px = tch.clientX - rect.left;
      var py = tch.clientY - rect.top;
      if (_topoDrag) {
        var pos = _topoScreenToWorld(px, py);
        _topoDrag.x = pos.x;
        _topoDrag.y = pos.y;
        _startTopoSim();
        ev.preventDefault();
      } else if (_topoPanning && canvas._panStart) {
        _topoView.x = canvas._panStart.vx + (tch.clientX - canvas._panStart.x);
        _topoView.y = canvas._panStart.vy + (tch.clientY - canvas._panStart.y);
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
        _topoDraw();
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
  var id = node ? node.id : null;
  // 增量渲染：节点未变时只更新坐标，不重建 innerHTML（避免每帧 DOM 读写）
  if (id !== _topoTipNodeId) {
    _topoTipNodeId = id;
    if (!node) {
      tip.style.display = "none";
      return;
    }
    tip.innerHTML =
      "<b>" + esc((node.data && node.data.full) || node.label) + '</b><span class="tt-type">' + esc(_topoTypeLabel(node.type)) + "</span>";
    tip.style.display = "block";
    _topoTipW = tip.offsetWidth;
    _topoTipH = tip.offsetHeight;
  }
  if (!node) return;
  var canvas = document.getElementById("topoCanvas");
  var wrapW = canvas.parentElement.clientWidth;
  var wrapH = canvas.clientHeight || 560;
  var tw = _topoTipW || tip.offsetWidth;
  var th = _topoTipH || tip.offsetHeight;
  tip.style.left = Math.max(4, Math.min(px + 14, wrapW - tw - 8)) + "px";
  tip.style.top = Math.max(4, Math.min(py + 14, wrapH - th - 8)) + "px";
}

export function _topoHideTooltip() {
  var tip = document.getElementById("topoTooltip");
  if (tip) tip.style.display = "none";
  _topoTipNodeId = null;
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

// 图例颜色全部由 CSS token 类驱动，主题切换即时生效，无需 JS 重染
export function _renderTopoLegend() {
  var legend = document.getElementById("topoLegend");
  if (!legend) return;
  function item(cls, label) {
    return (
      '<span class="topo-legend-item"><span class="topo-legend-dot ' + cls + '"></span>' + esc(label) + "</span>"
    );
  }
  legend.innerHTML =
    item("module", t("topo_type_module")) +
    item("adapter", t("topo_type_adapter")) +
    item("bot", t("topo_type_bot")) +
    item("resource", t("topo_detail_resources")) +
    '<span class="topo-legend-item"><span class="topo-legend-line"></span>' + esc(t("topo_edge_own")) + "</span>" +
    '<span class="topo-legend-item"><span class="topo-legend-line dashed"></span>' + esc(t("topo_edge_depends")) + "</span>" +
    '<span class="topo-legend-item"><span class="topo-legend-line dotted"></span>' + esc(t("topo_edge_scope")) + "</span>";
}

export function _topoStopSim() {
  _topoSim.running = false;
  _topoSim.settled = true;
  if (_topoSim.raf) {
    cancelAnimationFrame(_topoSim.raf);
    _topoSim.raf = 0;
  }
}

window.addEventListener("resize", function () {
  if (_topoIsVisible(document.getElementById("topoCanvas"))) _topoDraw();
});;
