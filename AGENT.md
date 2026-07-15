# ErisPulse Dashboard — 智能体维护手册

## 项目概述

ErisPulse Dashboard 是 ErisPulse 框架的官方 Web 管理面板模块。通过浏览器即可监控框架、管理模块与适配器、查看事件流、编辑配置等。

- 仓库: `ErisPulse-Dashboard`
- 后端: `ErisPulse_Dashboard/Core.py`（FastAPI 路由器）
- 前端: `ErisPulse_Dashboard/static/dash.html` + `dash.js` + `dash.css`
- Demo: `demo/` 目录，部署在 Cloudflare Pages

---

## 目录结构

```
ErisPulse-Dashboard/
├── .github/workflows/
│   └── python-publish.yml      # PyPI 发布
├── demo/
│   ├── build.sh                # Cloudflare Pages 构建脚本（自动同步主代码）
│   ├── mock.js                 # Demo 模拟数据（手动维护）
│   ├── dash.css / dash.js      # 构建时从 static/ 复制（被 .gitignore）
│   ├── index.html              # 构建时从 dash.html 生成（被 .gitignore）
│   └── res/                    # 构建时从 static/res 复制（被 .gitignore）
├── ErisPulse_Dashboard/
│   ├── Core.py                 # 主后端模块（API 接口、路由注册）
│   ├── Cluster.py              # 集群管理与能力探测
│   ├── PackageManager.py       # 包管理（pip/uv 安装卸载）
│   └── static/
│       ├── dash.html           # 前端主 HTML
│       ├── dash.js             # 前端主 JS（~13K 行）
│       └── dash.css            # 前端主 CSS（~9K 行）
├── README.md                   # 英文文档
├── README.zh-CN.md             # 简体中文
├── README.zh-TW.md             # 繁体中文
├── README.ja.md                # 日语
├── README.ru.md                # 俄语
└── .gitignore                  # demo 构建产物被忽略
```

---

## 后端核心 (`Core.py`)

### 路由注册
- `_register_routes()`: 注册所有 API 路由
- `_unregister_routes()`: 卸载路由（热重载时用）
- **重要**: 具体路径必须在参数化路径之前注册
  - ✅ `/api/commands/settings` → ✅ `/api/commands/{name}`
  - 反之则 settings 会被 {name} 匹配到

### 路由模式
```python
r.register_http_route(
    mn, "/api/commands/settings",
    handler=self._api_command_settings_update, methods=["PUT"],
)
```

### 新 API 端点需修改 3 处
1. `_register_routes()` — 注册
2. `_unregister_routes()` — 注销
3. 实现 handler 方法（token 验证 + 业务逻辑 + audit log）

### 配置写入
```python
self.sdk.config.setConfig("ErisPulse.event.command.prefix", value, immediate=True)
```
`immediate=True` 是必需的，否则 5 秒缓存延迟。

### 集群能力映射 (`Cluster.py`)
新增页面需要修改 3 个字典：
1. `CAPABILITY_TO_API` — `"master": "/api/master"`
2. `API_TO_CAPABILITY_MAP` — `"/api/master": "master"`
3. `PAGE_CAPABILITY_MAP` — `"master": "master"`

---

## 包管理 (`PackageManager.py`)

### pip 后端自动检测
- `get_pip_backend()`: 返回命令前缀
  - 优先: `["uv", "pip"]`
  - 回退: `[python_executable, "-m", "pip"]`
- `is_using_uv()`: 判断当前是否使用 uv

### uv 特殊处理
uv 和 pip 的参数不完全兼容：
- `uv pip uninstall` ❌ 不支持 `-y`（自身即非交互式）
- `pip uninstall` ✅ 需 `-y` 参数

### 卸载命令构造
```python
if pkg_mgr.is_using_uv():
    cmd = backend + ["uninstall", package_name]
else:
    cmd = backend + ["uninstall", "-y", package_name]
```

---

## 前端核心 (`dash.js`)

### i18n 多语言
位于文件顶部 `const I18N` 对象，按语言分组：
```javascript
const I18N = {
  zh: { key: "值", ... },
  en: { key: "Value", ... },
  "zh-TW": { ... },
  ja: { ... },
  ru: { ... },
};
```

**添加新 key 必须修改全部 5 种语言。**
使用 `t("key")` 获取当前语言的翻译。
`applyI18n()` 在页面加载和语言切换时触发。

### 全局设置变量
```javascript
let _cmdData = null;          # 命令列表数据
let _masterPlatforms = [];    # 可用平台列表
let _masterEntries = [];      # 主人条目 [{platform, userId}]
```

### 页面加载器（Loader Maps）
有**两处** loader maps，新页面必须在两个地方都注册：
1. `toggleLang()` 函数内（~L4055）
2. `go()` 函数内（~L4402）

格式: `"pageId": loadFunction`

### 侧边栏导航
侧边栏组和页面在 `dash.html` 中定义，分组结构：
```html
<div class="nav-group">
  <div class="nav-group-title" data-i18n="group_xxx" onclick="toggleNavGroup(this)"></div>
  <a class="nav-item" data-page="xxx" onclick="go('xxx', this)">
    <svg>...</svg>
    <span data-i18n="xxx"></span>
  </a>
</div>
```

**分组 i18n key**: `group_overview`, `group_events`, `group_extensions`, `group_management`, `group_operations`

**分组说明:**
| 分组 | 页面 |
|------|------|
| 概览 (overview) | dashboard, bots |
| 事件 (events) | event-stream, commands |
| 扩展 (extensions) | module-mgmt, store |
| 管理 (management) | master, adapter, config |
| 运维 (operations) | logs, files, api-routes, cluster |

### 模块视图动态分组
`_renderModuleViews()` 中处理模块注册的视图：
- 分组已存在 → 直接添加
- 分组不存在 → **自动创建**新的 `nav-group module-view-group`
- ⚠ 动态创建的分组**不会自动恢复折叠状态**，需要在创建后从 localStorage 读取

### 配置视图 (`fwFieldDesc`)
字段描述渲染使用 `fwFieldDesc(fullKey)`：
1. 优先查 i18n key: `fw_field_${key.replace(/\./g, "_")}`
2. 回退到 `_fwFieldDescs`（硬编码中文）
3. 最后返回空字符串

### 字段默认值 (`_fwDefaults`)
配置视图通过 `_fwDefaults` 判断字段是否"已知"并设置默认值。新增框架配置字段需同时更新：
1. `_fwDefaults` 中添加默认值
2. `_fwFieldDescs` 中添加描述
3. 5 种语言的 `fw_field_*` i18n key

---

## Demo 系统 (`demo/`)

### 架构
- Cloudflare Pages 部署（Git 连接模式）
- 仓库里只保留手动维护的文件，构建产物自动生成
- `.gitignore` 忽略: `demo/dash.css`, `demo/dash.js`, `demo/index.html`, `demo/res/`

### Cloudflare Pages 配置
| 字段 | 值 |
|------|-----|
| 构建命令 | `bash build.sh` |
| 部署命令 | **留空** |
| 根目录 | `/demo` |
| 构建令牌 | `builder-site build token` |

### 构建流程 (`demo/build.sh`)
1. 从 `ErisPulse_Dashboard/static/` 复制 `dash.css`、`dash.js` 到 `demo/`
2. 从 `dash.html` 生成 `index.html`（替换路径、注入 `mock.js`、加 Demo 横幅）
3. 复制 `res/` 资源目录

### mock.js 维护
`demo/mock.js` 是**唯一需要手动维护的 demo 文件**，包含所有模拟 API 响应。

**工作原理：**
- 覆盖 `window.fetch` → 拦截 `/api/` 请求 → 匹配 `API_MAP` 或正则处理器
- 覆盖 `window.WebSocket` → 模拟实时事件流
- Token: `demo`

**注册新 API 的 mock：**
1. 简单路径: 添加到 `API_MAP` 对象
2. 动态路径（含参数）：添加到 fetch 拦截器的正则匹配区域（L700+）

例如：
```javascript
API_MAP['/api/commands/settings'] = function () { return _json({ success: true, ... }); };
```

动态路径（带参数）：
```javascript
var match = matchPath.match(/^\/api\/module\/([^/]+)\/config$/);
if (match) { return _json({ ... }); }
```

### Demo 横幅
构建时注入到 `index.html`，显示 "⚠ Demo Mode — All data is simulated."

### 登录提示
`mock.js` 在登录页显示 "Demo Token: demo — 点击填入"，用户点击自动填入。

---

## README 多语言

| 文件 | 语言 |
|------|------|
| `README.md` | English（主文件） |
| `README.zh-CN.md` | 简体中文 |
| `README.zh-TW.md` | 繁體中文 |
| `README.ja.md` | 日本語 |
| `README.ru.md` | Русский |

**更新规范：**
- 所有 5 个文件必须同步更新
- 每个文件顶部有语言切换链接，当前语言**加粗**
- 新增特性需在所有语言中体现
- 图片路径使用相对路径 `.github/dash_bot.png`

### 文件头部格式
```markdown
<div align="center">

![](.github/dash_bot.png)

# ErisPulse Dashboard

[![PyPI](...)](...)

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | **Русский**

</div>
```

---

## 侧边栏分组优化

### 设计原则
- 每组的页面数量**不超过 4 个**（折叠时不会隐藏太多内容）
- 避免单项组（但重要功能如 master 可有自己的组）
- 分组按使用频率排序：概览 → 事件 → 扩展 → 管理 → 运维

### 新增页面
1. `dash.html` — 添加 `<a class="nav-item" data-page="xxx">` 到合适分组
2. `dash.js` — 添加 `"xxx": loadXxx` 到两个 loader maps
3. `dash.js` — 添加 i18n key 到 5 种语言
4. `Cluster.py` — 添加能力映射
5. `Core.py` — 注册 API 路由

---

## 主人系统 (Master System)

### 配置格式
```python
# 全局主人（列表）
users = ["user_001", "user_002"]
# 按平台划分（字典）
users = {"qq": ["user_001"], "telegram": ["user_002"]}
# 两者不能同时存在
```

### 保存逻辑
- 只有全局条目 → 保存为列表
- 有平台条目 → 保存为字典（全局 ID 合并到每个平台下）

### 前端交互
- 添加表单（平台选择 + ID 输入 + 添加按钮）
- 标签式展示（👑 + ID + × 删除）
- 按平台分组（全局组 + 各平台组）
- 顶部统计卡片（总数 / 全局 / 平台）

### SVG 图标
主人系统统一使用皇冠图标：
```svg
<path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
```

---

## 常见故障排查

### 1. 路由 404
- 检查 `_register_routes()` 是否注册
- 检查 `_unregister_routes()` 是否包含该路径
- 检查参数化路径是否劫持了具体路径
- **重启 ErisPulse 使新路由生效**

### 2. uv 安装/卸载失败
- 确保 `PackageManager.py` 有 `is_using_uv()` 方法
- uv 的 uninstall 命令不加 `-y`
- 输出流处理使用 `Popen` 而非 `run`

### 3. 配置视图字段显示"未知"
- `_fwDefaults.framework` 缺失该字段
- 添加默认值后即可被识别为已知字段

### 4. 配置字段描述不翻译
- `fwFieldDesc()` 先查 i18n，再查 `_fwFieldDescs`
- 如果 `_fwFieldDescs` 有值但 i18n 没有，显示中文
- 需要在 5 种语言中添加 `fw_field_${key}` key

### 5. Demo 资源 404
- `build.sh` 中 `html.replace("/Dashboard/static/", "")` 覆盖所有资源
- 如果 Demo 中另有未替换的路径，检查 `dash.html` 中的引用格式
- 重新构建部署

### 6. Demo 构建失败
- 检查 `build.sh` 中路径是否正确（根目录为 `/` 或 `/demo` 两种情况）
- `PWD` 在根目录为 `/demo` 时已处于 `demo/` 目录
- cp 命令前确保源文件存在

### 7. 页面访问白屏
- 检查 loader maps（两处）是否注册了加载函数
- 检查 `data-page` 属性是否与 loader key 匹配
- 检查 JS 是否有控制台报错
