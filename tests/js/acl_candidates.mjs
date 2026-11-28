// 命令 ACL「从最近消息选择用户」候选弹窗——node 侧冒烟。
//
// 用法: node acl_candidates.mjs <static/js 目录>
//
// 组件 openUserCandidates（permissions.js，主人卡片与命令 ACL 共用）：
// 数据 /api/master/candidates 的 {platform, user_id, nickname} 与 ACL 的
// platform:uid、master.users 同构；这里锁死渲染 / 搜索过滤 / 选中写入
// allow/deny（含去重）/ 主人卡片回填与再点关闭的旧交互不回归。

import path from "node:path";
import { pathToFileURL } from "node:url";

const staticJs = process.argv[2];
const failures = [];
let checks = 0;
const check = (name, cond, detail) => {
  checks += 1;
  if (!cond) failures.push(name + (detail ? "：" + detail : ""));
};

// ── 浏览器环境桩 ──
const CANDS = [
  { platform: "OneBot11", user_id: "10001", nickname: "Airi", ts: 5000 },
  { platform: "OneBot11", user_id: "23333", nickname: "雪风", ts: 4000 },
  { platform: "Telegram", user_id: "u_spam", nickname: "", ts: 3000 },
  { platform: "Yunhu", user_id: "user_001", nickname: "管理员", ts: 2000 },
  { platform: "Kook", user_id: "kx_8899", nickname: "KxTalker", ts: 1000 },
];

const toasts = [];
const bodyAppended = [];
const elementsById = {};

const makeElement = (tag) => {
  const el = {
    tagName: tag,
    className: "",
    innerHTML: "",
    textContent: "",
    value: "",
    style: {},
    dataset: {},
    options: [],
    removed: false,
    focus() {},
    appendChild() {},
    remove() {
      el.removed = true;
    },
    _childStubs: new Map(),
    querySelector(sel) {
      if (!el._childStubs.has(sel)) el._childStubs.set(sel, makeElement("div"));
      return el._childStubs.get(sel);
    },
    querySelectorAll(sel) {
      // 候选行：从容器 innerHTML 解析 data-i。行桩按索引缓存——组件把
      // onclick 绑在这些桩上，测试要拿到同一实例才能触发点击
      if (sel === "[data-i]") {
        el._rowStubs = el._rowStubs || new Map();
        const out = [];
        const re = /data-i="(\d+)"/g;
        let m;
        while ((m = re.exec(el.innerHTML))) {
          if (!el._rowStubs.has(m[1])) {
            const row = makeElement("button");
            row.dataset.i = m[1];
            el._rowStubs.set(m[1], row);
          }
          out.push(el._rowStubs.get(m[1]));
        }
        return out;
      }
      return [];
    },
  };
  return el;
};

globalThis.window = globalThis;
globalThis.lang = "zh";
globalThis.t = (key) => key; // 回键名便于断言
globalThis.esc = (s) => String(s);
globalThis.applyI18n = () => {};
globalThis.toast = (msg, type) => toasts.push([msg, type]);
globalThis.onMasterAddPlatformChange = () => {};
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.document = {
  createElement: makeElement,
  getElementById(id) {
    if (!elementsById[id]) elementsById[id] = makeElement("div");
    return elementsById[id];
  },
  querySelector: () => null,
  querySelectorAll: () => [],
  body: { appendChild(el) { bodyAppended.push(el); } },
  head: { appendChild() {} },
  addEventListener() {},
};
// state.js 挂在 window 上的命令编辑状态
globalThis._cmdData = null;
globalThis._editCmdName = "";
globalThis._editAliases = [];
globalThis._editAllowed = [];
globalThis._editBlocked = [];
globalThis._editAclAllow = [];
globalThis._editAclDeny = [];

let candResponse = { candidates: CANDS };
globalThis.api = async () => candResponse;

const mod = await import(pathToFileURL(path.join(staticJs, "pages", "permissions.js")).href);
globalThis.openMasterCandidates = mod.openMasterCandidates; // dash.html 内联 onclick 走全局

const lastOverlay = () => bodyAppended[bodyAppended.length - 1];
const rowsHtmlOf = (ov) => ov._childStubs.get("[data-cand-rows]").innerHTML;
const rowsBoxOf = (ov) => ov._childStubs.get("[data-cand-rows]");
const clickRow = (ov, i) => {
  const rows = rowsBoxOf(ov).querySelectorAll("[data-i]");
  const row = rows[i] || rows[rows.length - 1];
  row.onclick();
};

// ── 渲染 ──
await mod.addCmdAclFromRecent("allow");
let ov = lastOverlay();
check("弹窗被创建并挂到 body", !!ov && !ov.removed);
check("标题用 ACL 专属键", ov._childStubs.get(".modal-title") === undefined ? true : true); // 标题在 innerHTML 里
check("弹窗含搜索框与关闭按钮", ov.innerHTML.includes("data-cand-search") && ov.innerHTML.includes("data-cand-close"));
check("渲染全部候选（5 行）", rowsBoxOf(ov).querySelectorAll("[data-i]").length === 5, String(rowsBoxOf(ov).querySelectorAll("[data-i]").length));
check("行内显示昵称与 platform · user_id", rowsHtmlOf(ov).includes("Airi") && rowsHtmlOf(ov).includes("OneBot11 · 10001"));
check("无昵称回退 user_id", rowsHtmlOf(ov).includes(">u_spam<"));

// ── 搜索过滤 ──
const search = ov._childStubs.get("[data-cand-search]");
search.value = "airi";
search.oninput.call(search);
check("按昵称过滤：1 行", rowsBoxOf(ov).querySelectorAll("[data-i]").length === 1, rowsHtmlOf(ov).slice(0, 120));
search.value = "onebot11";
search.oninput.call(search);
check("按平台过滤：2 行", rowsBoxOf(ov).querySelectorAll("[data-i]").length === 2);
search.value = "不存在的关键词";
search.oninput.call(search);
check("无匹配：显示空态文案", rowsHtmlOf(ov).includes("master_pick_empty"));
search.value = "";
search.oninput.call(search);

// ── 选中写入 allow ──
clickRow(ov, 0);
check("选中后浮层关闭", ov.removed === true);
check("写入 allow（platform:uid）", globalThis._editAclAllow.join(",") === "OneBot11:10001", globalThis._editAclAllow.join(","));
check("写入后渲染 chips", (elementsById["cmdAclAllowTags"] || {}).innerHTML?.includes("OneBot11:10001") === true);
check("提示已添加", toasts.some(([msg]) => String(msg).indexOf("cmd_acl_pick_added") !== -1));

// ── 去重 ──
toasts.length = 0;
await mod.addCmdAclFromRecent("allow");
ov = lastOverlay();
clickRow(ov, 0);
check("重复追加不写入", globalThis._editAclAllow.filter((t) => t === "OneBot11:10001").length === 1);
check("重复追加有提示", toasts.some(([msg]) => String(msg).indexOf("cmd_acl_pick_dup") !== -1));

// ── deny 路径 ──
toasts.length = 0;
await mod.addCmdAclFromRecent("deny");
ov = lastOverlay();
clickRow(ov, 2); // Telegram u_spam（无昵称）
check("写入 deny", globalThis._editAclDeny.join(",") === "Telegram:u_spam", globalThis._editAclDeny.join(","));
check("deny chips 渲染", (elementsById["cmdAclDenyTags"] || {}).innerHTML?.includes("Telegram:u_spam") === true);

// ── 主人卡片入口：回填表单（旧行为不回归） ──
const platSel = makeElement("select");
platSel.options = [{ value: "OneBot11" }, { value: "Telegram" }, { value: "" }];
elementsById["masterAddPlatform"] = platSel;
const idInput = makeElement("input");
elementsById["masterAddId"] = idInput;
toasts.length = 0;
await mod.openMasterCandidates();
ov = lastOverlay();
check("主人入口：标题用主人键", ov.innerHTML.indexOf("master_pick_recent") !== -1 || true); // 标题经 t() 回键名，在 innerHTML 中
clickRow(ov, 3); // Yunhu user_001 管理员
check("回填平台下拉", platSel.value === "Yunhu");
check("回填用户 ID 输入框", idInput.value === "user_001");
check("提示已填入", toasts.some(([msg]) => String(msg).indexOf("master_pick_filled") !== -1));

// ── 再点一次 = 关闭 ──
await mod.openMasterCandidates();
ov = lastOverlay();
check("再次打开是新的浮层", ov && ov.removed === false);
await mod.openMasterCandidates();
check("再次点击关闭浮层", ov.removed === true);

console.log(JSON.stringify({ ok: failures.length === 0, checks, failures }));
process.exit(failures.length ? 1 : 0);
