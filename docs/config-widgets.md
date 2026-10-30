# 配置组件系统（Config Widgets）

> 版本：Dashboard 2.4.0 起。适配器/模块在 dataclass 配置的 `metadata["ui"]` 中声明控件元数据，SDK `get_config_schema()` 透传为 JSON Schema，本面板按 widget 分发渲染。完整 schema 约定与全部控件参考见本文档。

## 总览

| 能力 | 说明 |
|------|------|
| 控件库 | text / textarea / password / number / slider / switch / select / multiselect / color / date / time / datetime / kv / list |
| 字段绑定 | `show_if` / `disabled_if`：字段值变化驱动其它字段显隐/禁用（渲染期预计算 + change 事件实时重算） |
| 嵌套 | dataclass 嵌套自动渲染为可折叠分组，任意深度递归；`list` 行内可再嵌套对象字段 |
| 旧组件兼容 | 旧 widget 名与推断规则（boolean→switch、secret→password 等）行为不变；未知 widget 回退 text |
| 值收集 | 单一原生控件直接带 `data-ackey`；复合控件（multiselect/kv/list）由 hidden input 承载序列化值，保存路径（逐字段/整表/账户）全部兼容 |

## 声明方式（适配器/模块侧）

```python
from dataclasses import dataclass, field
from ErisPulse.Core.Bases import BaseConfig

@dataclass
class MyConfig(BaseConfig):
    mode: str = field(
        default="websocket",
        metadata={
            "description": "接收方式",
            "ui": {
                "widget": "select",
                "group": "connection",
                "order": 1,
                "options": [
                    {"label": "WebSocket 长连接", "value": "websocket"},
                    {"label": "Webhook 回调", "value": "webhook"},
                ],
            },
        },
    )
    webhook_path: str = field(
        default="/webhook",
        metadata={
            "description": "回调路径",
            "ui": {
                "widget": "text",
                "show_if": {"field": "mode", "op": "eq", "value": "webhook"},
            },
        },
    )
```

SDK ≥ 2.11.1 起 `ui` 子表中的扩展键（`min/max/step/rows/show_if/disabled_if/value_type/item`）会透传到前端；旧版 SDK 未透传时面板优雅降级（绑定不生效、控件按类型推断），不影响功能。

## 控件参考

### 基础控件

| widget | 值类型 | 附加元数据 | 说明 |
|--------|--------|-----------|------|
| `text`（默认） | string | `placeholder` | 单行文本 |
| `textarea` | string | `rows`、`placeholder` | 多行文本 |
| `password` | string | — | 密码框（`secret: True` 自动推断）；带明文切换 |
| `number` | integer/float | `min`、`max`、`step` | 数字输入（类型为 number 类时自动推断） |
| `switch` | boolean | — | 开关（boolean 自动推断） |
| `select` | string | `options` | 下拉单选；`options: [{label, value}]`，label 支持 i18n 字典 |

### 增强控件

| widget | 值类型 | 附加元数据 | 说明 |
|--------|--------|-----------|------|
| `slider` | integer | `min`、`max`、`step` | 滑杆 + 实时数值显示 |
| `color` | string | — | 颜色选择器，值 `#rrggbb`；非法值回退 `#000000` |
| `date` | string | — | 日期选择，值 `YYYY-MM-DD` |
| `time` | string | — | 时间选择，值 `HH:MM` |
| `datetime` | string | — | 日期时间，值 `YYYY-MM-DDTHH:MM`（本地时区） |
| `multiselect` | 见下 | `options`、`value_type` | 复选框组，见下节 |
| `kv` | object | — | 键值对编辑器（`dict[str, str]`），动态增删行 |
| `list` | array | `item` | 列表编辑器，动态增删行，见下节 |

### multiselect 三种值形态（`value_type`）

| value_type | 存储形态 | 适用 |
|-----------|---------|------|
| `json`（默认） | JSON 数组字符串，如 `"[0, 25]"` | 字段类型为 str 存 JSON 文本（如 QQBot `intents`） |
| `array` | 原生数组 | 字段类型为 list |
| `mask` | 位掩码整数（勾选值按 2^v 求和） | 位标志字段，选项 `value` 为位序号 |

### list 行类型（`item`）

```python
# 标量行：单输入
"item": {"widget": "select", "options": [{"label": "允许", "value": "yes"}]}

# 对象行：行内嵌套多字段（可为任意控件）
"item": {
    "fields": {
        "host": {"widget": "text"},
        "port": {"type": "integer"},
        "proto": {"widget": "select", "options": [...]},
    }
}
```

## 字段绑定（show_if / disabled_if）

```python
"ui": {
    "widget": "text",
    "show_if": {"field": "mode", "op": "eq", "value": "webhook"},
    "disabled_if": {"field": "retries", "op": "gt", "value": 2},
}
```

- `field`：同配置作用域内的字段名（支持完整键，如 `accounts.default.mode`）
- `op`：`eq` / `ne` / `in` / `nin`（value 为数组）/ `gt` / `gte` / `lt` / `lte` / `truthy`
- `show_if` 不满足时整行隐藏（**值保留**，不做删除）；`disabled_if` 满足时禁用（置灰锁定）
- 绑定在渲染时按当前值预计算初始态，字段变更时实时重算

## 嵌套

dataclass 字段类型为另一个 dataclass 时，SDK 生成 `fields` 子树，面板渲染为可折叠分组并递归应用全部控件与绑定：

```python
@dataclass
class RetryConfig(BaseConfig):
    retries: int = field(default=3, metadata={"ui": {"widget": "slider", "min": 0, "max": 10}})

@dataclass
class MyConfig(BaseConfig):
    retry: RetryConfig  # → 可折叠分组，字段键 mymod.retry.retries
```

## 自动推断（适配器零声明的默认体验）

适配器只需按常规声明 dataclass 配置（类型 / required / secret / options），面板自动推断全部基础交互：

| 推断来源 | 面板行为 |
|---------|---------|
| 字段 `type` 为 boolean | switch 开关 |
| `secret: True` | 密码框 |
| `type` 为 integer/float | 数字输入（配合 min/max/step） |
| `options` 存在且 type 为 string | 下拉单选 |
| 嵌套 dataclass | 折叠分组，递归以上规则 |
| **唯一账户 + required 字段存在空值** | **首配置引导条**：提示"账户尚未完成配置"并一键进入配置向导（编辑该账户而非新建） |

首配置引导完全由 schema 推断触发，适配器无需任何额外代码；多账户或已配置时不出现。

## 账户添加向导与扩展区（register_section）

「+ 添加账户」为分步向导：方式选择 → 配置 → 完成。手动步骤按账户 schema 的必填字段自动生成表单；适配器可注册**自包含 HTML 扩展区**提供一键接入能力（如扫码）：

```python
sdk.Dashboard.register_section(
    id="my-quick-connect",
    target="account_wizard",          # 挂载点：账户添加向导
    title="扫码一键接入",
    title_en="Scan to connect",
    icon_svg="<svg>...</svg>",
    platforms=["qqbot"],              # 仅在这些平台下出现；省略则所有平台
    html="<!DOCTYPE html>...",        # 自包含 HTML（内联脚本/样式）
    order=10,
)
```

扩展区由向导以 iframe srcdoc 渲染，约定：

- HTML 内可 `fetch` 同源 API（相对路径）；如需面板鉴权 API，携带 `Authorization: Bearer <localStorage token>`
- 完成后通知父页：`parent.postMessage({type: "ep_section_done", success: true}, "*")`（`success:false` 时可附 `message` 提示）
- 退出页面用 `sdk.Dashboard.unregister_section(id)`

未注册任何扩展区的适配器，向导自动跳过方式选择直达手动配置——**基础体验零声明，特殊能力才写 section**。

## 兼容性

- **旧 widget**：`text/password/switch/select` 及类型推断行为与 2.3.x 完全一致
- **旧 SDK**：未透传扩展键时，新控件退回类型推断控件（如 slider→number），绑定不生效但渲染正常
- **保存路径**：逐字段保存、整表保存（适配器/模块）、账户卡片保存均收集复合控件的 hidden input，无需模块侧适配
