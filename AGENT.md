# ErisPulse Dashboard 智能体开发事项

你必须遵守以下规则：

## 项目结构
- 1. 后端 `ErisPulse_Dashboard/Core.py`（生命周期、路由注册、全部 API handler）；`Cluster.py` 集群管理与能力探测；`PackageManager.py` 包管理；`Config.py` / `Constants.py` / `I18n.py` 为纯数据文件
- 2. 前端 `ErisPulse_Dashboard/static/`：`dash.html` + `dash.js` + `dash.css`，无构建步骤，直接修改源文件
- 3. `demo/` 为 Cloudflare Pages 演示站，仅 `mock.js` 与 `build.sh` 手动维护，其余（`index.html`、`dash.js`、`dash.css`、`res/`）为构建产物，已被 `.gitignore` 忽略

## 后端
- 4. 新增 API 端点：`_register_routes()` 注册 + 实现 handler，共两处；token 由 `/Dashboard/api/*` 中间件统一校验，handler 内不得重复写校验；需公开的端点加入中间件放行列表；路由注销为自省式，无需维护路径清单
- 5. 具体路径必须先于参数化路径注册（`/api/commands/settings` 在 `/api/commands/{name}` 之前），否则被劫持
- 6. 修改框架配置必须 `setConfig(path, value, immediate=True)`，否则有 5 秒缓存延迟
- 7. 新增集群页面能力时同步 `Cluster.py` 两个字典：`API_TO_CAPABILITY_MAP` 与 `PAGE_CAPABILITY_MAP`（`CAPABILITY_TO_API` 不存在，勿依赖）
- 8. uv/pip 参数差异：`uv pip uninstall` 不支持 `-y`，`pip uninstall` 必须 `-y`；通过 `is_using_uv()` 分支构造命令

## 前端
- 9. 新增页面必须同步 5 处：`dash.html` 侧边栏 `nav-item`、`dash.js` 两个 loader maps（`toggleLang()` 与 `go()` 内各一处）、5 语言 i18n key、`Cluster.py` 能力映射、`Core.py` API 路由
- 10. 侧边栏每组页面数不超过 4 个，按使用频率排序：概览 → 事件 → 扩展 → 管理 → 运维
- 11. 新增 `<select>` 无需手动处理，`window.EP` 组件库自动增强，保持 `.value` / `change` 契约即可
- 12. 新增框架配置字段必须同步三处：`_fwDefaults`（默认值）、`_fwFieldDescs`（中文兜底描述）、5 语言 `fw_field_*` i18n key
- 13. 主人配置：全局列表与平台字典互斥；保存时全局 ID 合并进各平台条目
- 14. 模块动态注册视图的分组由 `_renderModuleViews()` 自动创建，创建后需从 localStorage 恢复折叠状态
- 15. 页面白屏优先排查：两个 loader maps 是否注册、`data-page` 与 key 是否匹配、控制台是否报错

## 国际化与文档
- 16. 前端 i18n 位于 `dash.js` 顶部 `const I18N`，新增 key 必须同步全部 5 种语言（zh / en / zh-TW / ja / ru），取值用 `t("key")`
- 17. README 多语言 5 文件必须同步更新，当前语言在顶部切换链接中加粗，图片使用相对路径 `.github/dash_bot.png`

## Demo
- 18. 修改前端或 mock 后必须运行 `bash demo/build.sh` 重新生成产物
- 19. `mock.js` 拦截 `fetch` 与 `WebSocket` 模拟后端：简单路径加 `API_MAP`，动态路径加正则匹配；登录 token 固定为 `demo`
- 20. Demo 横幅由 `build.sh` 注入（左下角浮动胶囊，`sessionStorage` 记住关闭状态）；登录页 Demo 提示靠 `MutationObserver` 对抗 `applyI18n` 对 `#authHint` 的覆盖，改动登录提示渲染时不得破坏该机制

## 验证
- 21. 后端改动须重启 ErisPulse 验证新路由；前端改动须在浏览器实际验证页面可用
