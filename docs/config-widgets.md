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

## 兼容性

- **旧 widget**：`text/password/switch/select` 及类型推断行为与 2.3.x 完全一致
- **旧 SDK**：未透传扩展键时，新控件退回类型推断控件（如 slider→number），绑定不生效但渲染正常
- **保存路径**：逐字段保存、整表保存（适配器/模块）、账户卡片保存均收集复合控件的 hidden input，无需模块侧适配
