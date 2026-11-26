// 设置页「框架行为」与配置页共用同一份定义——回归测试的 node 侧。
//
// 用法: node fw_behavior_sync.mjs <static/js 目录>
//
// 给页面依赖的全局函数打桩，渲染设置页的「框架行为」，把渲染出的选项、默认值
// 与配置页的定义（framework.js 的 fwFieldOptions / fwFieldDefault）逐项比对。
// 两处各写一份曾漂移过：日志等级一边缺 TRACE / EVENT、多出不存在的 SUCCESS，
// 选项文字空白，数字被当字符串写进配置。

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const staticJs = process.argv[2];
const failures = [];
let checks = 0;

const check = (name, cond, detail) => {
  checks += 1;
  if (!cond) failures.push(name + (detail ? "：" + detail : ""));
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── 浏览器环境桩 ──
const elements = {};
// classList 的任意方法都是空函数（contains 返回 undefined，按假值处理）
const makeElement = (id) =>
  (elements[id] = {
    id,
    innerHTML: "",
    dataset: {},
    style: {},
    classList: new Proxy({}, { get: () => () => {} }),
  });
globalThis.window = globalThis;
globalThis._fwKnownKeys = null; // 以下为 core/state.js 里挂在 window 上的框架配置页状态
globalThis._fwVersions = [];
globalThis._fwCurrentVer = "";
globalThis._fwBadgeChecked = false;
globalThis._changelogCache = null;
globalThis.matchMedia = () => ({ matches: false, addEventListener: null, addListener: null });
globalThis.Storage = class Storage {
  setItem() {}
  getItem() {
    return null;
  }
};
globalThis.document = {
  readyState: "complete",
  addEventListener() {},
  getElementById: (id) => elements[id] || makeElement(id),
  querySelector: () => null,
  querySelectorAll: () => [],
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.requestAnimationFrame = (fn) => fn();
globalThis.t = (key) => key; // 回键名，便于断言
globalThis.esc = (text) => String(text);
globalThis.applyI18n = () => {};
globalThis.toast = () => {};
globalThis.go = () => {};
// core/utils.js：实时配置覆盖到默认值上（嵌套对象递归）
globalThis.deepMerge = (live, defaults) => {
  const out = { ...defaults };
  for (const key of Object.keys(live || {})) {
    const isNested = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
    out[key] = isNested(live[key]) && isNested(defaults[key]) ? globalThis.deepMerge(live[key], defaults[key]) : live[key];
  }
  return out;
};

let liveConfig = {};
globalThis.api = async (url, opts) => {
  if (url === "/api/config" && !(opts && opts.method === "PUT")) {
    return { config: { ErisPulse: liveConfig } };
  }
  return {};
};
process.on("unhandledRejection", (e) => failures.push("未处理的异步异常：" + String(e)));

const load = (page) => import(pathToFileURL(path.join(staticJs, "pages", page)).href);
const fw = await load("framework.js");
const settings = await load("settings.js");
// main.js 把每个页面模块的导出挂到 window 上，页面之间的调用都走全局
Object.assign(globalThis, fw);
Object.assign(globalThis, settings);

// core/i18n.js 是界面语言列表的权威来源（配置页下拉与首次运行向导都跟着它）。
// 它依赖浏览器环境，不导入，直接读源码解析；main.js 同样把它的导出挂到 window
const readSource = (file) => fs.readFileSync(path.join(staticJs, file), "utf8");
const i18nSrc = readSource(path.join("core", "i18n.js"));
const literal = (name) => {
  const match = new RegExp("export const " + name + " = (\\[[^;]*\\]|\\{[^;]*\\});").exec(i18nSrc);
  return match ? new Function("return " + match[1])() : null;
};
const supportedLangs = literal("SUPPORTED_LANGS");
const langNames = literal("LANG_NAMES");
globalThis.SUPPORTED_LANGS = supportedLangs;
globalThis.LANG_NAMES = langNames;

// ── 渲染结果解析 ──
const attr = (tag, name) => {
  const match = tag.match(new RegExp("\\s" + name + '="([^"]*)"'));
  return match ? match[1] : null;
};
const tagOf = (html, kind, id) => {
  const match = html.match(new RegExp("<" + kind + '[^>]*\\bid="' + id + '"[^>]*>'));
  return match ? match[0] : null;
};
const selectOf = (html, id) => {
  const block = html.match(new RegExp('<select[^>]*\\bid="' + id + '"[^>]*>([\\s\\S]*?)</select>'));
  if (!block) return null;
  return {
    key: attr(block[0].slice(0, block[0].indexOf(">")), "data-fwb-key"),
    options: [...block[1].matchAll(/<option value="([^"]*)"([^>]*)>([^<]*)<\/option>/g)].map((m) => ({
      value: m[1],
      selected: /\bselected\b/.test(m[2]),
      label: m[3],
    })),
  };
};
const numOf = (html, id) => {
  const tag = tagOf(html, "input", id);
  if (!tag) return null;
  const head = tag.slice(0, tag.indexOf(">"));
  return { key: attr(head, "data-fwb-key"), value: attr(head, "value"), coerce: /Number\(this\.value\)/.test(head) };
};
const switchOf = (html, id) => {
  const tag = tagOf(html, "input", id);
  if (!tag) return null;
  const head = tag.slice(0, tag.indexOf(">"));
  // 只认独立的 checked 属性：onchange 里的 this.checked 不算
  return { key: attr(head, "data-fwb-key"), checked: /\schecked(\s|\/|$)/.test(head) };
};

const CARDS = ["fwbTranscriptCard", "fwbEventCard", "fwbLoggerCard"];
const renderSettings = async (config) => {
  liveConfig = config || {};
  CARDS.forEach(makeElement);
  await settings.loadFwBehaviorPane();
  return CARDS.map((id) => elements[id].innerHTML).join("\n");
};

const expectSelect = (html, id, key, selected, labelPrefix) => {
  const select = selectOf(html, id);
  check(`${id}: 渲染出下拉`, !!select);
  if (!select) return;
  check(`${id}: 写入的配置键是 ${key}`, select.key === key, String(select.key));
  const want = fw.fwFieldOptions(key);
  check(`${id}: 配置页为 ${key} 定义了下拉选项`, Array.isArray(want) && want.length > 0);
  check(`${id}: 选项与配置页一致`, same(select.options.map((o) => o.value), want), JSON.stringify(select.options.map((o) => o.value)));
  check(`${id}: 当前选中 ${selected}`, select.options.filter((o) => o.selected).map((o) => o.value).join(",") === String(selected));
  check(`${id}: 每个选项都有可见文字`, select.options.every((o) => o.label.length > 0), JSON.stringify(select.options));
  if (labelPrefix) {
    check(`${id}: 文案键按 ${labelPrefix}<取值> 取`, select.options.every((o) => new RegExp('data-i18n-option="' + labelPrefix).test(html)));
  }
};
const expectNumber = (html, id, key, expected) => {
  const input = numOf(html, id);
  check(`${id}: 渲染出数字输入框`, !!input);
  if (!input) return;
  check(`${id}: 写入的配置键是 ${key}`, input.key === key, String(input.key));
  check(`${id}: 显示值 ${expected}`, input.value === String(expected), String(input.value));
  check(`${id}: 写入前转成数字`, input.coerce);
  check(`${id}: 配置页为 ${key} 定义了默认值`, fw.fwFieldDefault(key) !== undefined);
};
const expectSwitch = (html, id, key, expected) => {
  const input = switchOf(html, id);
  check(`${id}: 渲染出开关`, !!input);
  if (!input) return;
  check(`${id}: 写入的配置键是 ${key}`, input.key === key, String(input.key));
  check(`${id}: 状态 ${expected}`, input.checked === !!expected);
  check(`${id}: 配置页为 ${key} 定义了默认值`, fw.fwFieldDefault(key) !== undefined);
};

// ── 定义本身 ──
check("配置页的日志等级就是框架的七个等级", same(fw.fwFieldOptions("logger.level"), ["TRACE", "DEBUG", "INFO", "EVENT", "WARNING", "ERROR", "CRITICAL"]), JSON.stringify(fw.fwFieldOptions("logger.level")));
// 配置页上出现的每一项都有说明（设置页「框架行为」里的项在配置页同样可见）
for (const key of [
  "transcript.enabled",
  "transcript.max_per_session",
  "transcript.ttl_hours",
  "transcript.self_echo",
  "event.message.ignore_self",
  "event.wait_reply.block",
  "event.wait_reply.cmdpass",
  "event.overrides.acl_default_allow",
  "interaction.checkpoint_ttl",
  "logger.level",
  "logger.log_rotation",
  "logger.log_max_size_mb",
  "logger.log_backup_count",
  "logger.memory_limit",
]) {
  check(`配置页为 ${key} 写了说明`, typeof fw.fwFieldDesc(key) === "string" && fw.fwFieldDesc(key).length > 0);
}

// ── 配置为空：全部走配置页的默认值 ──
const d = (key) => fw.fwFieldDefault(key);
const empty = await renderSettings({});
expectSelect(empty, "fwbTrEcho", "transcript.self_echo", d("transcript.self_echo"), "fwb_tr_echo_");
expectSwitch(empty, "fwbTrEnabled", "transcript.enabled", d("transcript.enabled"));
expectNumber(empty, "fwbTrMax", "transcript.max_per_session", d("transcript.max_per_session"));
expectNumber(empty, "fwbTrTtl", "transcript.ttl_hours", d("transcript.ttl_hours"));
expectSwitch(empty, "fwbIgnoreSelf", "event.message.ignore_self", d("event.message.ignore_self"));
expectSwitch(empty, "fwbWrBlock", "event.wait_reply.block", d("event.wait_reply.block"));
expectSwitch(empty, "fwbWrCmdpass", "event.wait_reply.cmdpass", d("event.wait_reply.cmdpass"));
expectSwitch(empty, "fwbAclDefault", "event.overrides.acl_default_allow", d("event.overrides.acl_default_allow"));
expectNumber(empty, "fwbCkptTtl", "interaction.checkpoint_ttl", d("interaction.checkpoint_ttl"));
expectSelect(empty, "fwbLogLevel", "logger.level", d("logger.level"));
check("日志等级选项显示的是等级名本身", (selectOf(empty, "fwbLogLevel").options || []).every((o) => o.label === o.value));
expectSelect(empty, "fwbLogRotation", "logger.log_rotation", d("logger.log_rotation"), "fwb_lg_rotation_");
expectNumber(empty, "fwbLogMaxSize", "logger.log_max_size_mb", d("logger.log_max_size_mb"));
expectNumber(empty, "fwbLogBackup", "logger.log_backup_count", d("logger.log_backup_count"));
expectNumber(empty, "fwbLogMemory", "logger.memory_limit", d("logger.memory_limit"));
check("没有渲染成 undefined", !empty.includes("undefined"));

// 这几项曾与框架的真实默认值对不上
check("wait_reply.block 未设置时按框架默认显示为开", switchOf(empty, "fwbWrBlock").checked === true);
check("logger.memory_limit 未设置时显示 1000", numOf(empty, "fwbLogMemory").value === "1000", String(numOf(empty, "fwbLogMemory").value));

// ── 配置已有值：以配置为准 ──
const live = await renderSettings({
  transcript: { enabled: false, max_per_session: 7, ttl_hours: 24, self_echo: "skip" },
  event: {
    message: { ignore_self: false },
    wait_reply: { block: false, cmdpass: true },
    overrides: { acl_default_allow: false },
  },
  interaction: { checkpoint_ttl: 600 },
  logger: { level: "event", log_rotation: "date", log_max_size_mb: 20, log_backup_count: 9, memory_limit: 0 },
});
expectSelect(live, "fwbTrEcho", "transcript.self_echo", "skip", "fwb_tr_echo_");
expectSwitch(live, "fwbTrEnabled", "transcript.enabled", false);
expectNumber(live, "fwbTrMax", "transcript.max_per_session", 7);
expectNumber(live, "fwbTrTtl", "transcript.ttl_hours", 24);
expectSwitch(live, "fwbIgnoreSelf", "event.message.ignore_self", false);
expectSwitch(live, "fwbWrBlock", "event.wait_reply.block", false);
expectSwitch(live, "fwbWrCmdpass", "event.wait_reply.cmdpass", true);
expectSwitch(live, "fwbAclDefault", "event.overrides.acl_default_allow", false);
expectNumber(live, "fwbCkptTtl", "interaction.checkpoint_ttl", 600);
expectSelect(live, "fwbLogLevel", "logger.level", "EVENT");
expectSelect(live, "fwbLogRotation", "logger.log_rotation", "date", "fwb_lg_rotation_");
expectNumber(live, "fwbLogMaxSize", "logger.log_max_size_mb", 20);
expectNumber(live, "fwbLogBackup", "logger.log_backup_count", 9);
expectNumber(live, "fwbLogMemory", "logger.memory_limit", 0);

// 手改成列表外的值：保留为可选项，不能凭空消失
const odd = await renderSettings({ logger: { level: "VERBOSE" } });
const oddSelect = selectOf(odd, "fwbLogLevel");
check("列表外的当前值保留为可选项", oddSelect.options[0].value === "VERBOSE" && oddSelect.options[0].selected);

// ── 配置页自身：self_echo 也是下拉，选项与设置页同源 ──
elements.fwConfigBody = makeElement("fwConfigBody");
liveConfig = { transcript: { self_echo: "user" } };
await fw.loadFrameworkConfig();
await new Promise((r) => setTimeout(r, 0));
const cfgHtml = elements.fwConfigBody.innerHTML;
const cfgEcho = /<select[^>]*data-fk="ErisPulse.transcript.self_echo"[^>]*data-prev="user"[^>]*>([\s\S]*?)<\/select>/.exec(cfgHtml);
check("配置页把 self_echo 渲染成下拉", !!cfgEcho);
if (cfgEcho) {
  const values = [...cfgEcho[1].matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]);
  check("配置页与设置页的 self_echo 选项一致", same(values, selectOf(empty, "fwbTrEcho").options.map((o) => o.value)), JSON.stringify(values));
}

// ── 语言列表：core/i18n.js 是权威来源，配置页下拉与首次运行向导都跟着它 ──
check("core/i18n.js 声明了界面语言列表", Array.isArray(supportedLangs) && supportedLangs.length > 0);
check("配置页的 i18n.language 选项跟随界面语言列表", same(fw.fwFieldOptions("i18n.language"), ["auto", ...(supportedLangs || [])]), JSON.stringify(fw.fwFieldOptions("i18n.language")));
check("每种界面语言都有母语名", (supportedLangs || []).every((code) => typeof langNames?.[code] === "string" && langNames[code].length > 0));
const wizardSrc = readSource(path.join("components", "first-run-setup.js"));
check(
  "首次运行向导从界面语言列表取语言，不另写一份",
  /SUPPORTED_LANGS\.map\(/.test(wizardSrc) && /LANG_NAMES\[/.test(wizardSrc) && !/\{\s*v:\s*"(zh|en|ja|ru)/.test(wizardSrc),
);
// 光看源码不够：向导取列表的函数没有导出，拷贝一份补上导出后真正执行一遍
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ep-fw-behavior-"));
  const copy = path.join(dir, "first-run-setup.js");
  fs.writeFileSync(copy, wizardSrc + "\nexport { _frLangs };\n");
  try {
    const wizard = await import(pathToFileURL(copy).href);
    const list = wizard._frLangs();
    check("向导语言列表跟随界面语言列表", same(list.map((l) => l.v), supportedLangs), JSON.stringify(list));
    check("向导每种语言都有母语名", list.every((l) => typeof l.label === "string" && l.label.length > 0), JSON.stringify(list));
  } catch (e) {
    check("向导语言列表能取到", false, String(e));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log(JSON.stringify({ ok: failures.length === 0, checks, failures }));
process.exit(failures.length ? 1 : 0);
