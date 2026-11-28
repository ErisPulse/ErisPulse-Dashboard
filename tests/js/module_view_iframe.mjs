// 模块外链视窗的 iframe 地址构建——node 侧冒烟。
//
// 用法: node module_view_iframe.mjs <static/js 目录>
//
// 背景：框架注册路由时剥掉结尾斜杠（/sandbox/ 落成 /sandbox），带斜杠请求会
// 吃 307 到绝对地址；反代未透传协议头时 Location 是 http://，被 HTTPS 页面当
// 混合内容拦截（外链视窗黑块的成因）。Dashboard 侧修正：框架自身的相对路径
// 去尾斜杠直接请求绕开重定向；绝对 http:// 在 HTTPS 页面改写为 https 并告警。

import path from "node:path";
import { pathToFileURL } from "node:url";

const staticJs = process.argv[2];
const failures = [];
let checks = 0;
const check = (name, cond, detail) => {
  checks += 1;
  if (!cond) failures.push(name + (detail ? "：" + detail : ""));
};

const warns = [];
const createElementCalls = [];

// ── 浏览器环境桩 ──
globalThis.window = globalThis;
globalThis.location = { protocol: "https:" };
globalThis.lang = "zh";
globalThis.esc = (s) => String(s);
globalThis.t = (k) => k;
globalThis.applyI18n = () => {};
globalThis.renderHomePins = () => {};
globalThis.go = () => {};
globalThis.currentNode = "local";
globalThis.nodeRuntimeInfo = {};
globalThis.TK = "test-token";
globalThis.localStorage = { getItem: () => globalThis.TK, setItem() {} };
globalThis._moduleViewLoaders = {}; // state.js 挂在 window 上，渲染时会重赋值
globalThis._moduleViewsLoaded = false;

const makeElement = (tag) => {
  const el = {
    tagName: tag,
    className: "",
    innerHTML: "",
    textContent: "",
    onclick: null,
    style: {},
    dataset: {},
    setAttribute(k, v) {
      el.dataset[k] = v;
    },
    classList: {
      add(c) {
        el.className = (el.className + " " + c).trim();
      },
      remove() {},
    },
    appendChild() {},
    remove() {},
  };
  createElementCalls.push(el);
  return el;
};

const sidebarNav = {
  querySelector: () => null,
  insertBefore() {},
  appendChild() {},
};
const content = { appendChild() {} };

globalThis.document = {
  querySelector(sel) {
    if (sel === ".sidebar-nav") return sidebarNav;
    if (sel === ".content") return content;
    return null;
  },
  querySelectorAll: () => [],
  createElement: makeElement,
  head: { appendChild() {} },
  body: { appendChild() {} },
};
globalThis.console.warn = (...args) => warns.push(args.join(" "));

const mod = await import(pathToFileURL(path.join(staticJs, "core", "moduleviews.js")).href);

// 渲染一组视图，返回 "page" 元素的 innerHTML（iframe 在其中）与 pages 列表
const render = (views) => {
  createElementCalls.length = 0;
  warns.length = 0;
  mod._renderModuleViews(views);
  const pages = createElementCalls.filter((el) =>
    String(el.className).includes("page-module-frame"),
  );
  return { pages, html: pages.map((el) => el.innerHTML).join("\n") };
};
const srcOf = (html) => /<iframe src="([^"]*)"/.exec(html)?.[1] || "";

// ── 结尾斜杠：框架相对路径去斜杠直接请求，绕开 307 ──
let r = render([{ id: "Sandbox", title: "沙箱", iframe_url: "/sandbox/" }]);
check("注册带尾斜杠：iframe 请求不带斜杠的路径", srcOf(r.html) === "/sandbox?token=test-token", srcOf(r.html));
check("token 仍以 ? 拼接", srcOf(r.html).includes("?token="));

r = render([{ id: "QvQChat", title: "QvQChat", iframe_url: "/QvQChat/view" }]);
check("本就无尾斜杠：地址不变", srcOf(r.html) === "/QvQChat/view?token=test-token", srcOf(r.html));

r = render([{ id: "Deep", title: "Deep", iframe_url: "/a/b/" }]);
check("深层路径同样去尾斜杠", srcOf(r.html) === "/a/b?token=test-token", srcOf(r.html));

r = render([{ id: "Root", title: "Root", iframe_url: "/" }]);
check("根路径保持不变", srcOf(r.html) === "/?token=test-token", srcOf(r.html));

r = render([{ id: "Query", title: "Query", iframe_url: "/x?a=1" }]);
check("已带查询串的地址用 & 拼 token", srcOf(r.html) === "/x?a=1&token=test-token", srcOf(r.html));

// ── 混合内容：HTTPS 页面里绝对 http:// 改写为 https 并告警 ──
r = render([{ id: "Ext", title: "Ext", iframe_url: "http://ex.com/app/" }]);
check("绝对 http:// 改写为 https（外部地址斜杠语义未知，不动）", srcOf(r.html) === "https://ex.com/app/?token=test-token", srcOf(r.html));
check("改写时输出控制台告警", warns.length === 1, JSON.stringify(warns));

r = render([{ id: "ExtHttps", title: "Ext", iframe_url: "https://ex.com/app" }]);
check("绝对 https:// 原样保留且不告警", srcOf(r.html) === "https://ex.com/app?token=test-token" && warns.length === 0, srcOf(r.html));

r = render([{ id: "NoUrl", title: "Html", html_content: "<div>hi</div>" }]);
check("html_content 视窗不受影响", r.pages.length === 0 && createElementCalls.some((el) => el.innerHTML === "<div>hi</div>"));

// ── 远程节点：先拼节点地址，再走同样的修正 ──
globalThis.currentNode = "node1";
globalThis.nodeRuntimeInfo = { node1: { url: "https://n1.example", token: "node-token" } };
r = render([{ id: "Sandbox", title: "沙箱", iframe_url: "/sandbox/" }]);
check("远程节点：节点地址拼上去后同样去尾斜杠", srcOf(r.html) === "https://n1.example/sandbox?token=node-token", srcOf(r.html));
check("远程节点使用节点令牌", srcOf(r.html).includes("token=node-token"));
globalThis.currentNode = "local";
globalThis.nodeRuntimeInfo = {};

console.log(JSON.stringify({ ok: failures.length === 0, checks, failures }));
process.exit(failures.length ? 1 : 0);
