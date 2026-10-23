# ErisPulse Dashboard 智能体开发事项

你必须遵守以下规则：

## 项目结构
- 1. 后端 `ErisPulse_Dashboard/Core/` 子包：`__init__.py` 将 `Main` 组合自各职责 Mixin（`Base.py` 生命周期/配置/令牌、`Routes.py` 路由注册与注销、`Api*.py` 按域拆分的 API handler、`EventLog.py`/`Commands.py`/`PipOps.py`/`ModulesOps.py`/`Status.py`/`Views.py` 等机制层）；`Cluster.py` 集群管理与能力探测；`PackageManager.py` 包管理；`Config.py` / `Constants.py` / `I18n.py` / `Helpers.py` 为纯数据与工具文件
- 2. 前端 `ErisPulse_Dashboard/static/`：`dash.html`（单文件 SPA，页面 = `.page` div）+ `js/`（原生 ES Modules：`core/` `components/` `pages/`，经 `main.js` 挂载到 window）+ `css/`（按域拆分 22 文件，加载顺序 base → layout → components → … → overrides → style-cel，无构建步骤，缓存失效靠 `dash.html` 里的 `?v=` 查询串）
- 3. `demo/` 为 Cloudflare Pages 演示站，仅 `mock.js` 与 `build.sh` 手动维护，其余（`index.html`、`js`、`css`、`res/`）为构建产物，已被 `.gitignore` 忽略
- 4. **视觉契约：改任何样式先读 `docs/design-language.md`**（token 体系、圆角/间距阶梯、签名手法、透感体系、组件规范、模块开发者指南）；全站 0 渐变、0 硬编码色值（token 化）、明暗/auto/OLED/cel/主题包/双密度必须同时成立

## 后端
- 5. 新增 API 端点：`_register_routes()` 注册 + 实现 handler，共两处；token 由 `/Dashboard/api/*` 中间件统一校验，handler 内不得重复写校验；需公开的端点加入中间件放行列表；路由注销为自省式，无需维护路径清单
- 6. 具体路径必须先于参数化路径注册（`/api/commands/settings` 在 `/api/commands/{name}` 之前），否则被劫持
- 7. 修改框架配置必须 `setConfig(path, value, immediate=True)`，否则有 5 秒缓存延迟
- 8. 新增集群页面能力时同步 `Cluster.py` 两个字典：`API_TO_CAPABILITY_MAP` 与 `PAGE_CAPABILITY_MAP`（`CAPABILITY_TO_API` 不存在，勿依赖）
- 9. uv/pip 参数差异：`uv pip uninstall` 不支持 `-y`，`pip uninstall` 必须 `-y`；通过 `is_using_uv()` 分支构造命令
- 10. `/api/files/download` 支持 `?inline=1`（Content-Disposition: inline），但仅限 `_is_inline_safe` MIME 白名单（图片/视频/音频/pdf/text，排除 SVG/HTML 防 token 窃取）；download 支持 Range 请求，勿破坏

## 前端
- 11. 新增页面必须同步 5 处：`dash.html` 侧边栏 `nav-item`（结构 = `.nav-ico` 圆形图标卡包裹 SVG + 文字 span，参考现有项）、`js/core/router.js` 的 `go()` loader map 与 `js/core/i18n.js` 的 `toggleLang()` loader map、5 语言 i18n key、`Cluster.py` 能力映射、`Core/Routes.py` API 路由（如需新 API）
- 12. 侧边栏每组页面数不超过 4 个，按使用频率排序：概览 → 事件 → 扩展 → 管理 → 运维；包管理（`p-packages`）在扩展组，与商店分离
- 13. **JS 取导航项文字必须用 `span:not(.nav-ico)`**（`.nav-ico` 是图标卡容器，无文字）；折叠态 tooltip 走 `data-tip`（`applyI18n()` 自动同步）
- 14. 新增 `<select>` 无需手动处理，`window.EP` 组件库自动增强，保持 `.value` / `change` 契约即可
- 15. 新增框架配置字段必须同步三处：`_fwDefaults`（默认值）、`_fwFieldDescs`（中文兜底描述）、5 语言 `fw_field_*` i18n key
- 16. 主人配置：全局列表与平台字典互斥；保存时全局 ID 合并进各平台条目
- 17. 模块动态注册视图的分组由 `_renderModuleViews()` 自动创建，创建后需从 localStorage 恢复折叠状态；模块图标三级回退：`logo_url`/`icon_svg` → 名称首字母头像（`.module-ico-initial`，token 化配色）
- 18. 页面白屏优先排查：两个 loader maps 是否注册、`data-page` 与 key 是否匹配、控制台是否报错
- 19. **性能纪律**：高频列表（事件流/日志）渲染必须走"入队 + rAF + 250ms 节流批量 `insertAdjacentHTML` + DOM 子节点上限"管线，禁止逐条消息全量 `innerHTML` 重建；canvas/动画不得有永动 rAF 循环（收敛检测后自停，参考 topology.js）；大面积 `backdrop-filter` 禁用（仅 `.modal-box`/`.node-dropdown` 允许轻 blur）
- 20. 背景图透感：`html.bg-image` 状态类 + 三档 `bg-level-soft/strong`（`base.css` 尾部统一覆写 token），组件层禁止自写透明色
- 21. 按钮语言：主操作 `.btn-primary` 实色填充，次操作 `.btn-secondary` 描边；卡片 hover 只加深边框，可点卡片才上浮（`.is-clickable`）；live/状态标识一律静态色点，禁止脉冲动画

## 国际化与文档
- 22. 前端 i18n 位于 `static/res/i18n/*.js`（`window.__EP_I18N__`，5 文件），新增 key 必须同步全部 5 种语言（zh / en / zh-TW / ja / ru），取值用 `t("key")`；`t()` 缺 key 时返回 key 本身（会上屏裸字段名，新增 UI 文案后必查）
- 23. README 多语言 5 文件必须同步更新，当前语言在顶部切换链接中加粗，图片使用相对路径 `.github/dash_bot.png`（单张，勿堆叠多图）

## Demo
- 24. 修改前端或 mock 后必须运行 `bash demo/build.sh` 重新生成产物；构建时会把 `index.html` 与 JS/CSS 中的 `/Dashboard/static/` 路径重写为相对路径，前端 JS 中新增静态资源引用无需特殊处理
- 25. `mock.js` 拦截 `fetch` 与 `WebSocket` 模拟后端：简单路径加 `API_MAP`，动态路径加正则匹配；登录 token 固定为 `demo`
- 26. Demo 横幅由 `build.sh` 注入（左下角浮动胶囊，`sessionStorage` 记住关闭状态）；登录页 Demo 提示靠 `MutationObserver` 对抗 `applyI18n` 对 `#authHint` 的覆盖，改动登录提示渲染时不得破坏该机制

## 验证
- 27. 后端改动须重启 ErisPulse 验证新路由；前端改动须在浏览器实际验证页面可用；CSS/JS 改动后 `?v=` 版本号 +1（dash.html 内统一 bump）
- 28. 代码注释一律专业表述，禁止口语化字眼
