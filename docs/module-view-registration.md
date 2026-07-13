# 模块视窗注册指南（Module View Registration）

Dashboard 支持其他 ErisPulse 模块将自定义的管理页面注册到 Dashboard 的侧边栏中。注册后，用户可以直接在 Dashboard 中切换到该模块的专属视窗页面，无需额外开发独立的前端界面。

---

## 工作原理

```
模块 on_load()
  → 调用 sdk.Dashboard.register_view(...)
  → Dashboard 后端存储视窗信息
  → WebSocket 通知前端
  → 前端动态创建侧边栏导航项 + 页面容器
  → 用户点击即可查看模块视窗
```

---

## 注册 API

```python
sdk.Dashboard.register_view(
    id="MyModule",                    # 必填，唯一标识
    title="我的模块",                  # 中文名称（向后兼容）
    title_en="My Module",             # 英文名称（向后兼容）
    titles={                           # ✨ 多语言标题（优先于 title/title_en）
        "zh": "我的模块",
        "en": "My Module",
        "zh-TW": "我的模組",
        "ja": "マイモジュール",
        "ru": "Мой модуль",
    },
    icon_svg='<svg>...</svg>',        # 侧边栏图标 SVG
    html_content='<div>...</div>',     # 页面 HTML 内容
    js_content='function xxx() {}',    # 页面 JavaScript 逻辑
    css_content='.my-style {}',        # 可选自定义 CSS
    iframe_url='',                     # iframe 模式 URL（与 html_content 二选一）
    loader="loadMyModuleView",         # 切换到该页面时调用的 JS 函数名
    group="group_extensions",          # 侧边栏分组
    group_title="",                    # 自定义分组中文名（向后兼容）
    group_title_en="",                 # 自定义分组英文名（向后兼容）
    group_titles={                     # ✨ 多语言分组标题（优先于 group_title/group_title_en）
        "zh": "工具",
        "en": "Tools",
        "zh-TW": "工具",
        "ja": "ツール",
        "ru": "Инструменты",
    },
)
```

### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `str` | 是 | 视窗唯一标识，建议使用模块名称 |
| `title` | `str` | 否 | 中文显示名称，默认使用 `id`（向后兼容，推荐使用 `titles`） |
| `title_en` | `str` | 否 | 英文显示名称，默认使用 `title`（向后兼容，推荐使用 `titles`） |
| `titles` | `dict` | 否 | **🆕** 多语言标题字典，键为语言代码（`zh`/`en`/`zh-TW`/`ja`/`ru`），优先于 `title`/`title_en` |
| `icon_svg` | `str` | 否 | 侧边栏图标的完整 SVG 字符串 |
| `html_content` | `str` | 否* | 注入模式的页面 HTML 内容 |
| `js_content` | `str` | 否 | 页面 JavaScript 代码 |
| `css_content` | `str` | 否 | 页面自定义 CSS 样式 |
| `iframe_url` | `str` | 否* | iframe 模式的 URL，设置后忽略 `html_content` |
| `loader` | `str` | 否 | 页面激活时自动调用的 JS 函数名 |
| `group` | `str` | 否 | 侧边栏分组标识，默认 `group_extensions` |
| `group_title` | `str` | 否 | 自定义分组的中文标题（向后兼容，推荐使用 `group_titles`） |
| `group_title_en` | `str` | 否 | 自定义分组的英文标题（向后兼容，推荐使用 `group_titles`） |
| `group_titles` | `dict` | 否 | **🆕** 多语言分组标题字典，键为语言代码，优先于 `group_title`/`group_title_en` |

> *`html_content` 和 `iframe_url` 至少提供一个，否则页面为空白。

> **🆕 多语言支持**：`titles` 和 `group_titles` 支持所有 5 种前端语言（`zh`/`en`/`zh-TW`/`ja`/`ru`）。未提供的语言会自动回退到 `title`/`title_en` 或 `group_title`/`group_title_en`。

---

## 两种注入模式

### 模式一：HTML/JS 注入（推荐）

直接提供 HTML、JS、CSS 字符串，Dashboard 会将内容注入到页面中。该模式与 Dashboard 样式完全一致，推荐使用 Dashboard 提供的 CSS 类名。

```python
sdk.Dashboard.register_view(
    id="Weather",
    title="天气", title_en="Weather",
    icon_svg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    html_content='''
        <h1 class="page-title">天气查询</h1>
        <div class="grid-2">
            <div class="card">
                <div class="card-header">当前天气</div>
                <div class="card-body">
                    <div id="weather-info">加载中...</div>
                </div>
            </div>
            <div class="card">
                <div class="card-header">操作</div>
                <div class="card-body">
                    <button class="btn btn-primary" onclick="refreshWeather()">刷新</button>
                </div>
            </div>
        </div>
    ''',
    js_content='''
        async function loadWeatherView() {
            await refreshWeather();
        }
        async function refreshWeather() {
            var el = document.getElementById('weather-info');
            if (!el) return;
            try {
                var token = localStorage.getItem('__ep_tk__');
                var resp = await fetch('/Weather/api/current', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                var data = await resp.json();
                el.innerHTML = '<p>温度: ' + (data.temp || '--') + '°C</p>' +
                               '<p>湿度: ' + (data.humidity || '--') + '%</p>';
            } catch (e) {
                el.textContent = '加载失败: ' + e.message;
            }
        }
    ''',
    loader="loadWeatherView",
    group="group_tools",
)
```

### 模式二：iframe 嵌入

模块提供自己的 HTML 页面 URL（需自行注册路由），Dashboard 以 iframe 方式嵌入。适合需要完全独立 UI 或复杂交互的场景。

```python
sdk.Dashboard.register_view(
    id="MyVisualizer",
    title="数据可视化", title_en="Data Visualizer",
    iframe_url="/MyVisualizer/view",
    group="group_tools",
)
```

> iframe 模式会自动在 URL 后追加 `token` 参数用于认证。

---

## 侧边栏分组

模块可指定视窗所在的侧边栏分组。Dashboard 内置以下分组：

| 分组标识 | 中文名 | 位置 |
|---------|--------|------|
| `group_overview` | 概览 | 第1组 |
| `group_events` | 事件 | 第2组 |
| `group_extensions` | 扩展 | 第3组（默认） |
| `group_system` | 系统 | 第4组 |
| `group_tools` | 工具 | 第5组 |

指定内置分组名，模块视窗会追加到该分组末尾：

```python
group="group_tools"  # 追加到"工具"分组
```

也可以使用自定义分组名（不以 `group_` 开头），Dashboard 会自动创建新分组：

```python
group="my_group",
group_title="我的分组",
group_title_en="My Group",
```

---

## 常用 CSS 类名

模块视窗使用 HTML 注入模式时，可直接使用 Dashboard 已有的 CSS 类名来保持视觉一致性：

| 类名 | 用途 |
|------|------|
| `page-title` | 页面标题，如 `<h1 class="page-title">标题</h1>` |
| `card` | 卡片容器 |
| `card-header` | 卡片标题栏 |
| `card-body` | 卡片内容区域 |
| `grid-2` | 两列网格布局 |
| `grid-3` | 三列网格布局 |
| `btn` | 基础按钮 |
| `btn-primary` | 主按钮（蓝色） |
| `btn-secondary` | 次要按钮 |
| `btn-icon` | 图标按钮 |
| `btn-danger` | 危险操作按钮 |

Dashboard 使用 CSS 变量控制主题色，你可以在模块视窗中直接引用：

| CSS 变量 | 用途 |
|----------|------|
| `var(--bg-p)` | 主背景色 |
| `var(--bg-s)` | 次背景色 |
| `var(--bg-t)` | 三级背景色（卡片等） |
| `var(--tx-p)` | 主文字色 |
| `var(--tx-s)` | 次文字色 |
| `var(--tx-t)` | 辅助文字色 |
| `var(--bd)` | 边框色 |
| `var(--bd-h)` | 边框高亮色（hover） |
| `var(--accent)` | 强调色 |
| `var(--accent-rgb)` | 强调色 RGB 分量（用于 rgba/shadow） |
| `var(--accent-fill)` | 强调填充色（按钮背景） |
| `var(--accent-fill-h)` | 强调填充悬浮色 |
| `var(--accent-h)` | 强调悬浮色 |
| `var(--ok-c)` | 成功色 |
| `var(--er-c)` | 错误色 |
| `var(--wr-c)` | 警告色 |
| `var(--pr-c)` | 主要信息色 |
| `var(--sc-c)` | 次要信息色 |
| `var(--focus-ring)` | 焦点环色（`:focus-visible`） |
| `var(--sh)` | 阴影色 |
| `var(--modal)` | 模态背景遮罩色 |
| `var(--shadow-card)` | 卡片阴影 |
| `var(--shadow-hover)` | 卡片悬浮阴影 |

这些变量会根据 Dashboard 的主题（亮色/暗色/自动）自动切换，模块无需额外处理。

### 主题系统

Dashboard 支持三种主题模式：
- **亮色（Light）** — `[data-theme="light"]`
- **暗色（Dark）** — `[data-theme="dark"]`
- **自动（Auto）** — `[data-theme="auto"]`，跟随系统 `prefers-color-scheme`

主题通过 `data-theme` 属性设置在 `<html>` 元素上。CSS 变量会根据当前生效的主题自动切换值。

额外提供了 UI 风格切换（通过 `data-ui-style` 属性）：
- `data-ui-style="eris"` — ErisPulse 默认风格（蓝白色调）
- `data-ui-style="classic"` — Material Design 3 风格（默认回退）

模块视窗中引用 CSS 变量时，这些变量会自动响应主题和风格切换，无需额外适配。

---

## 认证与 API 调用

> **注意：** Dashboard 对登录接口实施了速率限制（10 次失败后锁定 60 秒）。`verify_token` / `verify_request` 方法本身不受此限制影响，仅 Dashboard 自身的 `/api/auth` 登录端点受限。

### 前端：携带 Token

在模块视窗的 JS 中调用模块自己的 API 时，需要携带 Dashboard 的 Token 进行认证：

```javascript
var token = localStorage.getItem('__ep_tk__');
var resp = await fetch('/YourModule/api/data', {
    headers: { 'Authorization': 'Bearer ' + token }
});
var data = await resp.json();
```

### 后端：验证 Token

Dashboard 提供两个公共方法供模块在 API 端点中验证请求身份：

#### `verify_request(request) -> bool`

从 FastAPI `Request` 对象中提取 Token 并验证。支持以下来源（按优先级）：

1. `Authorization: Bearer <token>` 请求头
2. `?token=<token>` 查询参数

```python
from fastapi.responses import JSONResponse

async def _api_handler(self, request):
    if not self._verify_request(request):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    # ... 业务逻辑 ...
```

#### `verify_token(token: str) -> bool`

验证原始 Token 字符串，使用 `secrets.compare_digest()` 进行时序安全比较。

```python
token = request.headers.get("Authorization", "").replace("Bearer ", "")
if hasattr(self.sdk, 'Dashboard') and self.sdk.Dashboard:
    if not self.sdk.Dashboard.verify_token(token):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
```

### 防御性验证模式

Dashboard 模块可能未安装或未加载，建议使用以下防御性模式：

```python
def _verify_request(self, request) -> bool:
    if hasattr(self.sdk, 'Dashboard') and self.sdk.Dashboard:
        return self.sdk.Dashboard.verify_request(request)
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    return bool(token)
```

> 当 Dashboard 未加载时，此 fallback 仅检查 Token 是否非空，不进行实际验证。如需严格验证，可在 fallback 中返回 `False`。

### 完整 API 验证示例

```python
from fastapi.responses import JSONResponse

async def _api_data(self, request):
    if not self._verify_request(request):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    return JSONResponse({"data": "hello"})

async def _api_delete(self, request):
    if not self._verify_request(request):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    # ... 删除逻辑 ...
    return JSONResponse({"success": True})
```

---

## 完整模块示例

以下是一个完整的天气模块示例，展示如何注册视窗、提供 API 数据、以及在卸载时清理资源：

```python
from ErisPulse import sdk
from ErisPulse.Core.Bases import BaseModule
from ErisPulse.Core.Event import command


class Main(BaseModule):
    def __init__(self):
        self.sdk = sdk
        self.logger = sdk.logger.get_child("Weather")
        self.config = self._load_config()

    @staticmethod
    def get_load_strategy():
        from ErisPulse.loaders import ModuleLoadStrategy
        return ModuleLoadStrategy(lazy_load=False, priority=50)

    async def on_load(self, event):
        self._register_routes()
        self._register_dashboard_view()
        self.logger.info("天气模块已加载")

    async def on_unload(self, event):
        self._unregister_routes()
        if hasattr(self.sdk, 'Dashboard') and self.sdk.Dashboard:
            self.sdk.Dashboard.unregister_view("Weather")
        self.logger.info("天气模块已卸载")

    def _load_config(self):
        config = self.sdk.config.getConfig("Weather")
        if not config:
            default = {"city": "北京", "api_key": ""}
            self.sdk.config.setConfig("Weather", default)
            return default
        return config

    def _register_routes(self):
        r = self.sdk.router
        r.register_http_route("Weather", "/api/current",
                              handler=self._api_current, methods=["GET"])

    def _unregister_routes(self):
        r = self.sdk.router
        try:
            r.unregister_http_route("Weather", "/api/current")
        except Exception:
            pass

    async def _api_current(self, request):
        from fastapi.responses import JSONResponse
        return JSONResponse({
            "city": self.config.get("city", "北京"),
            "temp": 25,
            "humidity": 60,
        })

    def _register_dashboard_view(self):
        try:
            dashboard = self.sdk.Dashboard
            dashboard.register_view(
                id="Weather",
                title="天气", title_en="Weather",
                icon_svg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
                html_content='''
                    <h1 class="page-title">天气查询</h1>
                    <p style="color:var(--tx-s);margin-bottom:16px">查看当前天气信息</p>
                    <div class="grid-2">
                        <div class="card">
                            <div class="card-header">当前天气</div>
                            <div class="card-body">
                                <div id="weather-info" style="font-size:14px;color:var(--tx-s)">点击刷新加载</div>
                            </div>
                        </div>
                        <div class="card">
                            <div class="card-header">操作</div>
                            <div class="card-body">
                                <button class="btn btn-primary" onclick="refreshWeather()">刷新</button>
                            </div>
                        </div>
                    </div>
                ''',
                js_content='''
                    async function loadWeatherView() { await refreshWeather(); }
                    async function refreshWeather() {
                        var el = document.getElementById('weather-info');
                        if (!el) return;
                        el.textContent = '加载中...';
                        try {
                            var resp = await fetch('/Weather/api/current', {
                                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('__ep_tk__') }
                            });
                            var data = await resp.json();
                            el.innerHTML = '<p>城市: ' + (data.city || '--') + '</p>' +
                                           '<p>温度: ' + (data.temp || '--') + '°C</p>' +
                                           '<p>湿度: ' + (data.humidity || '--') + '%</p>';
                        } catch (e) {
                            el.textContent = '加载失败: ' + e.message;
                        }
                    }
                ''',
                loader="loadWeatherView",
                group="group_tools",
            )
        except Exception as e:
            self.logger.warning(f"注册 Dashboard 视窗失败: {e}")
```

---

## 注销视窗

模块卸载时应调用 `unregister_view()` 清理已注册的视窗：

```python
async def on_unload(self, event):
    if hasattr(self.sdk, 'Dashboard') and self.sdk.Dashboard:
        self.sdk.Dashboard.unregister_view("Weather")
```

注销后 Dashboard 前端会通过 WebSocket 实时移除侧边栏导航项和页面内容，无需用户刷新。

---

## 注意事项

1. **加载顺序** — Dashboard 的加载优先级为 `99999`（高优先级），你的模块优先级应低于此值（如 `50`），确保 Dashboard 先加载完成
2. **防御性编程** — 注册视窗时使用 `try/except` 包裹，因为 Dashboard 模块可能未安装或未加载
3. **资源清理** — 在 `on_unload` 中调用 `unregister_view()` 移除已注册的视窗
4. **ID 唯一性** — `id` 参数在整个 Dashboard 中必须唯一，建议直接使用模块名称
5. **SVG 图标** — `icon_svg` 应为完整的 `<svg>` 标签，建议尺寸使用 `viewBox="0 0 24 24"`，使用 `stroke="currentColor"` 继承 Dashboard 主题色
6. **JS 函数命名** — `js_content` 中的函数名应具有唯一性（如 `loadWeatherView`），避免与其他模块冲突
7. **动态更新** — 模块注册/注销视窗后，Dashboard 前端会通过 WebSocket 实时更新侧边栏，无需刷新页面

---

## 多平台支持（Adapter API）

ErisPulse 支持多个聊天平台同时运行。模块如果需要跨平台推送消息，应使用 `sdk.adapter` API 动态获取可用平台列表。

### 核心 API

| 方法 | 说明 |
|------|------|
| `sdk.adapter.list_registered()` | 返回所有已注册平台名称列表，如 `["qq", "telegram"]` |
| `sdk.adapter.is_running(name)` | 判断指定平台是否正在运行 |
| `sdk.adapter.get(name)` | 获取平台适配器实例，用于发送消息 |
| `sdk.adapter.list_sends(name)` | 返回该平台支持的发送方法列表，如 `["Text", "Markdown", "Html", "Image"]` |

### 使用 Dashboard 已有的平台列表 API

Dashboard 已内置 `/Dashboard/api/adapters` 端点，返回所有已注册平台的详细信息。模块无需自行创建平台列表端点，直接在前端调用即可：

**API 响应示例** (`GET /Dashboard/api/adapters`)：

```json
{
    "adapters": [
        {
            "platform": "qq",
            "enabled": true,
            "running": true,
            "bots": [
                {"bot_id": "12345", "status": "online", "last_active": 1700000000, "info": {}}
            ]
        },
        {
            "platform": "telegram",
            "enabled": true,
            "running": false,
            "bots": []
        }
    ]
}
```

### 前端动态加载平台下拉框

直接调用 Dashboard 已有的 API，无需模块自行实现端点：

```javascript
function loadPlatforms() {
    fetch('/Dashboard/api/adapters', {
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('__ep_tk__') }
    }).then(function(r) { return r.json(); }).then(function(data) {
        var sel = document.getElementById('platform-select');
        if (!sel) return;
        sel.innerHTML = '<option value="">-- 请选择平台 --</option>';
        (data.adapters || []).forEach(function(a) {
            var opt = document.createElement('option');
            opt.value = a.platform;
            opt.textContent = a.platform + (a.running ? '' : ' (未运行)');
            sel.appendChild(opt);
        });
    });
}
```

### 目标类型

ErisPulse 支持以下目标类型（`target_type`）：

| 值 | 说明 |
|------|------|
| `user` | 私聊 |
| `group` | 群组 |
| `channel` | 频道 |
| `guild` | 服务器 |
| `thread` | 话题 |

在 HTML 下拉框中：

```html
<select id="target-type">
    <option value="global">全局</option>
    <option value="user">私聊 (user)</option>
    <option value="group">群组 (group)</option>
    <option value="channel">频道 (channel)</option>
    <option value="guild">服务器 (guild)</option>
    <option value="thread">话题 (thread)</option>
</select>
```

### 跨平台消息发送

发送消息时应根据目标平台选择最佳的发送格式。ErisPulse 的 SendDSL 支持链式调用：

```python
async def _send_to_target(self, platform: str, target_type: str, target_id: str, templates: dict, bot_id: str = None):
    try:
        adapter = sdk.adapter.get(platform)
        if not adapter:
            return
        send = adapter.Send
        if bot_id:
            send = send.Using(bot_id)
        send = send.To(target_type, target_id)
        try:
            methods = sdk.adapter.list_sends(platform)
            if "Html" in methods:
                await send.Html(templates["html"])
            elif "Markdown" in methods:
                await send.Markdown(templates["markdown"])
            else:
                await send.Text(templates["text"])
        except Exception:
            await send.Text(templates.get("text", ""))
    except Exception as e:
        self.logger.error(f"Send to {platform}/{target_type}/{target_id}: {e}")
```

### 多 Bot 发送（Using）

同一平台可能有多个 Bot 实例，使用 `.Using(bot_id)` 指定发送账号：

```python
adapter = sdk.adapter.get("onebot11")

# 默认 Bot 发送
await adapter.Send.To("group", "G1001").Text("Hello")

# 指定 Bot 发送
await adapter.Send.Using("bot1").To("group", "G1001").Text("Hello from bot1")
await adapter.Send.Using("bot2").To("user", "U1001").Text("Hello from bot2")
```

`/Dashboard/api/adapters` 的响应中包含每个平台的 `bots` 列表，前端可据此构建 Bot 选择下拉框：

```javascript
// 加载平台和 Bot 列表
fetch('/Dashboard/api/adapters', {
    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('__ep_tk__') }
}).then(function(r) { return r.json(); }).then(function(data) {
    var sel = document.getElementById('bot-select');
    (data.adapters || []).forEach(function(a) {
        var optGroup = document.createElement('optgroup');
        optGroup.label = a.platform;
        (a.bots || []).forEach(function(b) {
            var opt = document.createElement('option');
            opt.value = a.platform + ':' + b.bot_id;
            opt.textContent = a.platform + ' / ' + b.bot_id;
            optGroup.appendChild(opt);
        });
        sel.appendChild(optGroup);
    });
});
```

---

## HTTP 路由注册

模块通过 `sdk.router` 注册 HTTP API 路由，供 Dashboard 前端或外部调用。

### 注册路由

```python
def _register_routes(self):
    r = self.sdk.router
    r.register_http_route("ModuleName", "/api/data",
                          handler=self._api_data, methods=["GET"])
    r.register_http_route("ModuleName", "/api/data",
                          handler=self._api_create, methods=["POST"])
    r.register_http_route("ModuleName", "/api/items/{item_id}",
                          handler=self._api_item, methods=["PUT"])
    r.register_http_route("ModuleName", "/api/items/{item_id}",
                          handler=self._api_delete, methods=["DELETE"])
```

> 同一路径可以注册不同 HTTP 方法，分别指向不同 handler。

### 路由参数

路径参数使用 `{param_name}` 语法（FastAPI 风格），在 handler 中通过 `request.path_params` 获取：

```python
async def _api_item(self, request: Request) -> JSONResponse:
    item_id = int(request.path_params.get("item_id", 0))
    return JSONResponse({"id": item_id})
```

### 注销路由

模块卸载时应注销所有已注册的路由：

```python
def _unregister_routes(self):
    r = self.sdk.router
    for path in ["/api/data", "/api/items/{item_id}"]:
        try:
            r.unregister_http_route("ModuleName", path)
        except Exception:
            pass
```

> 对于带路径参数的路由（如 `{item_id}`），注销时使用模板路径而非具体值。
