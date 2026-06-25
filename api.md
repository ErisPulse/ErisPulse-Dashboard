# ErisPulse Dashboard API 文档

> 基于 `Core.py` 源码自动提取生成
>
> 所有 API 路径前缀为 `/Dashboard`（模块名），除特殊说明外均需在请求头携带 Token 认证。

## 目录

- [认证机制](#认证机制)
- [静态资源](#静态资源)
- [认证 API](#认证-api)
- [系统状态 API](#系统状态-api)
- [适配器 API](#适配器-api)
- [模块 API](#模块-api)
- [机器人 API](#机器人-api)
- [事件 API](#事件-api)
- [配置 API](#配置-api)
- [存储 API](#存储-api)
- [商店 API](#商店-api)
- [包管理 API](#包管理-api)
- [框架管理 API](#框架管理-api)
- [事件构建器 API](#事件构建器-api)
- [日志 API](#日志-api)
- [生命周期 API](#生命周期-api)
- [性能监控 API](#性能监控-api)
- [路由信息 API](#路由信息-api)
- [消息统计 API](#消息统计-api)
- [审计日志 API](#审计日志-api)
- [备份恢复 API](#备份恢复-api)
- [文件管理 API](#文件管理-api)
- [命令管理 API](#命令管理-api)
- [视图 API](#视图-api)
- [集群管理 API](#集群管理-api)
- [WebSocket](#websocket)

---

## 认证机制

| 项目 | 说明 |
|------|------|
| 认证方式 | Token（通过 Query 参数 `?token=xxx` 或 Header `Authorization: Bearer xxx` 传递） |
| 登录限流 | 连续失败 10 次后锁定 60 秒 |
| 安全说明 | 敏感文件（`.env`、`*.key`、`*.pem` 等）禁止读取 |

**通用错误响应：**

| 状态码 | 说明 |
|--------|------|
| 401 | `{"error": "Unauthorized"}` - Token 无效或缺失 |
| 400 | `{"error": "..."}` - 参数错误 |
| 404 | `{"error": "... not found"}` - 资源不存在 |
| 500 | `{"error": "..."}` - 服务器内部错误 |

---

## 静态资源

### GET `/`

获取 Dashboard 主页面 HTML。

**响应：** HTML 文本

---

### GET `/static/dash.css`

获取 Dashboard 样式表。

**响应：** `text/css`

---

### GET `/static/dash.js`

获取 Dashboard 脚本。

**响应：** `application/javascript`

---

### GET `/static/res/{path}`

获取静态资源文件（图片、图标等）。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `path` | path | string | 是 | 相对于 `static/res/` 的文件路径 |

**响应：** 对应 MIME 类型的二进制内容

---

## 认证 API

### POST `/api/auth`

使用 Token 登录认证。

**请求体：**

```json
{
  "token": "string"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `token` | string | 是 | 认证 Token |

**响应：**

```json
{
  "success": true
}
```

**错误：** 401（Token 无效）、429（尝试次数过多）

---

### GET `/api/auth/status`

检查当前认证状态。

**响应：**

```json
{
  "authenticated": true
}
```

---

## 系统状态 API

### GET `/api/status`

获取系统状态概览（框架信息 + 适配器 + 模块）。

**响应：**

```json
{
  "framework": {
    "name": "ErisPulse",
    "version": "string"
  },
  "adapters": {},
  "modules": {
    "ModuleName": true
  }
}
```

---

### GET `/api/system`

获取详细系统资源信息（CPU、内存、磁盘、运行时间等）。

**响应：**

```json
{
  "uptime_seconds": 3600,
  "uptime_human": "1 小时",
  "cpu": {},
  "memory": {},
  "disk": {}
}
```

---

## 适配器 API

### GET `/api/adapters`

获取所有已注册适配器及其运行状态、机器人列表。

**响应：**

```json
{
  "adapters": [
    {
      "platform": "qq",
      "enabled": true,
      "running": true,
      "bots": [
        {
          "bot_id": "123456",
          "status": "online",
          "last_active": 1700000000,
          "info": {}
        }
      ]
    }
  ]
}
```

---

### GET `/api/adapter-logos`

获取所有适配器 Logo 路径。

**响应：**

```json
{
  "logos": {
    "qq": "/Dashboard/static/res/adapter_logo/qq.png",
    "telegram": "/Dashboard/static/res/adapter_logo/telegram.png"
  }
}
```

> 标签：`无需认证`

---

### GET `/api/adapter/{platform}/config`

获取指定适配器的配置信息（含 Schema）。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `platform` | path | string | 是 | 平台名称 |

**响应：**

```json
{
  "platform": "qq",
  "config_key": "ErisPulse.adapter.qq",
  "has_config": true,
  "has_accounts": true,
  "schema": {},
  "values": {},
  "account_schema": {},
  "accounts": {},
  "accounts_key": "ErisPulse.adapter.qq.accounts"
}
```

---

### PUT `/api/adapter/{platform}/config`

更新适配器配置（支持批量或单个更新，自动校验 + 热重载）。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `platform` | path | string | 是 | 平台名称 |
| `values` | body | object | 否 | 批量配置值（与 `key` 二选一） |
| `key` | body | string | 否 | 单个配置键 |
| `value` | body | any | 否 | 单个配置值 |

**响应：**

```json
{
  "success": true
}
```

---

### GET `/api/adapter/{platform}/accounts`

获取适配器账户配置。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `platform` | path | string | 是 | 平台名称 |

**响应：**

```json
{
  "schema": {},
  "accounts": {},
  "accounts_key": "string"
}
```

---

### PUT `/api/adapter/{platform}/accounts`

批量更新适配器账户配置（自动校验 + 运行中重载）。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `platform` | path | string | 是 | 平台名称 |
| `accounts` | body | object | 是 | 账户配置对象 |

**响应：**

```json
{
  "success": true,
  "module": "QQAdapter",
  "message": "部分缓存可能导致不可知的问题..." // 仅重载时出现
}
```

---

### POST `/api/adapter/{platform}/accounts/add`

添加新账户（仅刷新内存，不重启适配器）。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `platform` | path | string | 是 | 平台名称 |
| `name` | body | string | 是 | 账户名称 |
| `data` | body | object | 否 | 账户初始数据 |

**响应：**

```json
{
  "success": true
}
```

---

### DELETE `/api/adapter/{platform}/accounts/{name}`

删除指定账户。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `platform` | path | string | 是 | 平台名称 |
| `name` | path | string | 是 | 账户名称 |

**响应：**

```json
{
  "success": true,
  "module": "QQAdapter"
}
```

---

## 模块 API

### GET `/api/modules`

获取所有模块和适配器的详细信息（含路由计数、能力列表、Git 包信息等）。

**响应：**

```json
{
  "modules": [
    {
      "name": "ModuleName",
      "type": "module",
      "enabled": true,
      "loaded": true,
      "version": "1.0.0",
      "description": "模块描述",
      "author": "作者",
      "package": "package-name",
      "load_strategy": {
        "lazy_load": false,
        "priority": 0,
        "depends": []
      },
      "routes_count": 5,
      "views_count": 1,
      "is_git": false
    },
    {
      "name": "qq",
      "type": "adapter",
      "enabled": true,
      "loaded": true,
      "bots_count": 2,
      "capabilities": ["text", "image"]
    }
  ]
}
```

---

### POST `/api/modules/action`

执行模块操作（加载、卸载、重载、启用、禁用、卸载包）。

**请求体：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `action` | string | 是 | `load` / `unload` / `reload` / `enable` / `disable` / `uninstall` |
| `name` | string | 是 | 模块名称 |
| `type` | string | 否 | `module`（默认） / `adapter` |
| `package` | string | 否 | 卸载时需要的包名 |

**响应：**

```json
{
  "success": true,
  "requires_restart": true,  // 适配器操作时出现
  "task_id": "abc123"        // uninstall 操作时出现
}
```

---

## 机器人 API

### GET `/api/bots`

获取所有平台的机器人列表（含能力、运行状态）。

**响应：**

```json
{
  "bots": [
    {
      "platform": "qq",
      "bot_id": "123456",
      "status": "online",
      "last_active": 1700000000,
      "info": {},
      "capabilities": ["text", "image"],
      "adapter_running": true,
      "adapter_enabled": true,
      "adapter_status": "started"
    }
  ]
}
```

---

## 事件 API

### GET `/api/events`

获取事件日志（支持过滤和限制）。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `limit` | query | int | 否 | 返回条数（默认 50） |
| `type` | query | string | 否 | 事件类型过滤 |
| `platform` | query | string | 否 | 平台过滤 |

**响应：**

```json
{
  "events": [],
  "total": 100,
  "total_count": 5000
}
```

---

### POST `/api/events/clear`

清空事件日志缓存。

**响应：**

```json
{
  "success": true
}
```

---

## 配置 API

### GET `/api/config`

获取完整配置缓存。

**响应：**

```json
{
  "config": {}
}
```

---

### PUT `/api/config`

更新单个配置项。

**请求体：**

```json
{
  "key": "ErisPulse.adapter.qq.token",
  "value": "new_token"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `key` | string | 是 | 配置键 |
| `value` | any | 是 | 配置值（`"******"` 表示不更新密钥） |

**响应：**

```json
{
  "success": true
}
```

---

### GET|POST `/api/config/source`

获取或更新 `config.toml` 配置文件源码。

**GET 响应：**

```json
{
  "content": "# TOML 配置内容..."
}
```

**POST 请求体：**

```json
{
  "content": "# 新的 TOML 内容..."
}
```

**POST 响应：**

```json
{
  "success": true
}
```

---

## 存储 API

### GET `/api/storage`

获取所有存储键值对（最多 200 条）。

**响应：**

```json
{
  "keys": ["key1", "key2"],
  "data": {
    "key1": "value1"
  },
  "total": 2
}
```

---

### POST `/api/storage`

设置存储键值对。

**请求体：**

```json
{
  "key": "string",
  "value": "any"
}
```

**响应：**

```json
{
  "success": true
}
```

---

### POST `/api/storage/delete`

删除存储键值对。

**请求体：**

```json
{
  "key": "string"
}
```

**响应：**

```json
{
  "success": true
}
```

---

## 商店 API

### GET `/api/store/remote`

获取远程商店数据（模块列表）。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `force` | query | string | 否 | `true` 强制刷新缓存 |

**响应：** 商店数据对象

---

### POST `/api/store/install`

从商店安装包（异步任务）。

**请求体：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `packages` | string[] | 是 | 包名列表 |
| `force` | boolean | 否 | 强制安装 |
| `index_url` | string | 否 | 自定义 PyPI 源 |

**响应：**

```json
{
  "success": true,
  "task_id": "abc123"
}
```

---

### POST `/api/store/upload`

上传本地包文件安装（支持 `.whl`、`.zip`）。

**请求体：** `multipart/form-data`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | file | 是 | 包文件（`.whl` / `.zip`） |
| `force` | string | 否 | `true` 强制安装 |
| `index_url` | string | 否 | 自定义源 |

**响应：**

```json
{
  "success": true,
  "task_id": "abc123"
}
```

---

### GET `/api/store/install/status`

查询安装任务状态。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `task_id` | query | string | 是 | 任务 ID |

**响应：**

```json
{
  "status": "running|success|error|timeout",
  "started_at": 1700000000,
  "packages": [],
  "output": [],
  "error": "string"
}
```

> 标签：`无需认证`

---

### GET `/api/store/package/detail`

获取指定包的详细信息。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `package` | query | string | 是 | 包名 |

**响应：** 包详情对象

---

## 包管理 API

### GET `/api/packages`

获取已安装包列表。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `force` | query | string | 否 | `true` 强制刷新 |

---

### GET `/api/packages/updates`

检查包更新。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `force` | query | string | 否 | `true` 强制刷新 |

**响应：**

```json
{
  "updates": []
}
```

---

### POST `/api/packages/upgrade`

升级指定包（异步任务）。

**请求体：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `packages` | string[] | 是 | 包名列表 |
| `index_url` | string | 否 | 自定义源 |

**响应：**

```json
{
  "success": true,
  "task_id": "abc123"
}
```

---

### POST `/api/packages/install`

安装指定包（异步任务，支持 `git+` URL）。

**请求体：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `packages` | string[] | 是 | 包名列表 |
| `force` | boolean | 否 | 强制安装 |
| `index_url` | string | 否 | 自定义源 |

**响应：**

```json
{
  "success": true,
  "task_id": "abc123"
}
```

---

### POST `/api/packages/uninstall`

卸载指定包（核心包受保护）。

**请求体：**

```json
{
  "package": "package-name"
}
```

**响应：**

```json
{
  "success": true,
  "task_id": "abc123"
}
```

**错误：** 400（试图卸载核心包 `erispulse`、`erispulse-dashboard`）

---

### GET `/api/packages/git`

获取 Git 安装的包及其更新信息。

**响应：**

```json
{
  "packages": [],
  "updates": {}
}
```

---

### POST `/api/packages/git-upgrade`

升级 Git 安装的包。

**请求体：**

```json
{
  "git_url": "git+https://github.com/..."
}
```

**响应：**

```json
{
  "success": true,
  "task_id": "abc123"
}
```

---

## 框架管理 API

### GET `/api/framework/versions`

获取 ErisPulse 框架可用版本列表（从 PyPI 获取）。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `pre` | query | string | 否 | `true` 包含预发布版本 |

**响应：**

```json
{
  "current": "2.0.0",
  "versions": ["2.0.1", "2.0.0", "1.9.0"],
  "can_update": true
}
```

---

### POST `/api/framework/update`

更新 ErisPulse 框架到指定版本（异步任务）。

**请求体：**

```json
{
  "version": "2.0.1"
}
```

**响应：**

```json
{
  "success": true,
  "task_id": "abc123"
}
```

---

### POST `/api/restart`

重启框架。

**响应：**

```json
{
  "success": true
}
```

> 延迟 0.5 秒后执行重启，优先使用 `hard_restart`。

---

## 事件构建器 API

### POST `/api/builder/validate`

验证事件数据格式。

**请求体：**

```json
{
  "type": "message|notice|request|meta",
  "message": "string",
  "alt_message": "string",
  "user_id": "string",
  "time": 1700000000
}
```

**响应：**

```json
{
  "valid": true,
  "errors": [],
  "warnings": []
}
```

**事件类型说明：**

| 类型 | detail_types | 必填字段 |
|------|-------------|----------|
| `message` | private, group, channel, guild, thread, user | message, alt_message, user_id |
| `notice` | friend_increase/decrease, group_member_increase/decrease | user_id |
| `request` | friend, group | user_id, comment |
| `meta` | connect, disconnect, heartbeat | 无 |

---

### POST `/api/builder/submit`

提交构建的事件到适配器系统。

**请求体：** 同 validate 的完整事件数据。

**响应：**

```json
{
  "success": true,
  "message": "事件已提交"
}
```

---

### GET `/api/builder/segments`

获取支持的消息段类型。

**响应：**

```json
{
  "standard_segments": [
    {
      "type": "text",
      "name": "文本",
      "fields": [
        { "name": "text", "type": "string", "required": true }
      ]
    },
    {
      "type": "mention",
      "name": "@用户",
      "fields": [
        { "name": "user_id", "type": "string", "required": true },
        { "name": "user_name", "type": "string", "required": false }
      ]
    },
    { "type": "mention_all", "name": "@全体", "fields": [] },
    {
      "type": "image",
      "name": "图片",
      "fields": [
        { "name": "file", "type": "string", "required": true }
      ]
    },
    {
      "type": "reply",
      "name": "回复",
      "fields": [
        { "name": "message_id", "type": "string", "required": true }
      ]
    }
  ],
  "platform_segments": {
    "yunhu": [
      { "type": "yunhu_form", "name": "表单", "fields": [{ "name": "form_id", "type": "string" }] }
    ],
    "telegram": [
      { "type": "telegram_sticker", "name": "贴纸", "fields": [{ "name": "file_id", "type": "string" }] }
    ]
  }
}
```

---

## 日志 API

### GET `/api/logs`

获取日志列表（支持过滤和搜索）。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `limit` | query | int | 否 | 返回条数（默认 100） |
| `module` | query | string | 否 | 模块名过滤（部分匹配） |
| `level` | query | string | 否 | 等级过滤（暂未实现） |
| `search` | query | string | 否 | 关键词搜索 |

**响应：**

```json
{
  "logs": [
    {
      "module": "Core",
      "timestamp": "2024-01-01 12:00:00",
      "message": "日志内容",
      "level": "",
      "full": "完整日志行"
    }
  ],
  "total": 150
}
```

---

### POST `/api/logs/clear`

清空 Dashboard 日志缓存。

**响应：**

```json
{
  "success": true,
  "message": "日志缓存已清空"
}
```

---

## 生命周期 API

### GET `/api/lifecycle`

获取生命周期事件列表。

**响应：**

```json
{
  "events": [],
  "total": 10
}
```

---

### POST `/api/lifecycle/clear`

清空生命周期事件。

**响应：**

```json
{
  "success": true
}
```

---

## 性能监控 API

### GET `/api/performance`

获取性能监控数据（系统状态 + WebSocket 连接统计 + 生命周期计数）。

**响应：**

```json
{
  "system": {},
  "websocket": {
    "active_connections": 3,
    "uptime_seconds": 3600,
    "uptime_human": "1 小时"
  },
  "lifecycle_counts": {}
}
```

---

## 路由信息 API

### GET `/api/routes`

获取所有已注册的 HTTP 和 WebSocket 路由。

**响应：**

```json
{
  "http_routes": [
    {
      "path": "/api/status",
      "full_path": "/Dashboard/api/status",
      "method": "GET",
      "module": "Dashboard",
      "handler": {
        "name": "_api_status",
        "file": "Core.py",
        "line": 1534
      }
    }
  ],
  "ws_routes": [
    {
      "path": "/ws",
      "full_path": "/Dashboard/ws",
      "module": "Dashboard",
      "has_auth": false,
      "auto_accept": true,
      "handler": {}
    }
  ]
}
```

---

## 消息统计 API

### GET `/api/message-stats`

获取消息统计（按类型、平台、小时聚合）。

**响应：**

```json
{
  "total_events": 5000,
  "by_type": {
    "message": 3000,
    "notice": 2000
  },
  "by_platform": {
    "qq": 4000,
    "telegram": 1000
  },
  "hourly": {
    "1700000000": 150
  }
}
```

---

## 审计日志 API

### GET `/api/audit`

获取操作审计日志。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `limit` | query | int | 否 | 返回条数（默认 200） |
| `action` | query | string | 否 | 操作类型过滤 |

**响应：**

```json
{
  "logs": [],
  "total": 50
}
```

---

### POST `/api/audit/clear`

清空审计日志。

**响应：**

```json
{
  "success": true
}
```

---

## 备份恢复 API

### GET `/api/backup/export`

导出配置、存储和审计日志备份。

**响应：**

```json
{
  "version": "1.0",
  "timestamp": 1700000000,
  "config": {},
  "storage": {},
  "audit_log": []
}
```

---

### POST `/api/backup/import`

导入备份数据（跳过 Dashboard 自身配置和 `__ep_` 存储键）。

**请求体：** 备份导出的完整 JSON 对象。

**响应：**

```json
{
  "success": true,
  "config_restored": 50,
  "storage_restored": 10
}
```

---

## 文件管理 API

> 所有路径相对于项目根目录，自动防止目录穿越攻击。

### GET `/api/files/browse`

浏览目录内容。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `path` | query | string | 否 | 目录路径（默认 `.`） |
| `sort` | query | string | 否 | 排序方式：`name`/`size`/`modified`/`type` |
| `hidden` | query | string | 否 | `true` 显示隐藏文件 |

**响应：**

```json
{
  "path": "src",
  "absolute_path": "/project/src",
  "entries": [
    {
      "name": "main.py",
      "path": "src/main.py",
      "type": "file",
      "size": 1024,
      "modified": 1700000000,
      "permissions": "rw-r--r--",
      "mode_octal": "0o644",
      "readable": true,
      "writable": true
    }
  ],
  "total": 1
}
```

---

### GET `/api/files/read`

读取文件内容（最大 2MB，敏感文件禁止读取）。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `path` | query | string | 是 | 文件路径 |
| `encoding` | query | string | 否 | 编码（默认 `utf-8`） |

**响应：**

```json
{
  "content": "文件内容...",
  "size": 1024,
  "encoding": "utf-8",
  "path": "src/main.py"
}
```

**错误：** 403（敏感文件）、413（文件过大）、415（二进制文件）

---

### PUT `/api/files/write`

写入文件内容。

**请求体：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `path` | string | 是 | 文件路径 |
| `content` | string | 是 | 文件内容 |
| `encoding` | string | 否 | 编码（默认 `utf-8`） |

**响应：**

```json
{
  "success": true,
  "path": "src/main.py",
  "size": 1024
}
```

---

### POST `/api/files/upload`

上传文件（最大 50MB）。

**请求体：** `multipart/form-data`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `files` / `file` | form | file[] | 是 | 文件列表 |
| `path` | query | string | 否 | 目标目录（默认 `.`） |

**响应：**

```json
{
  "success": true,
  "uploaded": [
    { "name": "test.py", "size": 1024 }
  ],
  "count": 1
}
```

---

### GET `/api/files/download`

下载文件（流式响应）。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `path` | query | string | 是 | 文件路径 |

**响应：** 二进制文件流（`application/octet-stream`）

---

### POST `/api/files/mkdir`

创建目录。

**请求体：**

```json
{
  "path": "new_dir",
  "recursive": true
}
```

**响应：**

```json
{
  "success": true,
  "path": "new_dir"
}
```

---

### POST `/api/files/delete`

批量删除文件/目录。

**请求体：**

```json
{
  "paths": ["file1.txt", "dir1"]
}
```

**响应：**

```json
{
  "success": true,
  "deleted": ["file1.txt"],
  "count": 1
}
```

---

### POST `/api/files/rename`

重命名/移动文件或目录。

**请求体：**

```json
{
  "old_path": "old_name.txt",
  "new_path": "new_name.txt"
}
```

---

### POST `/api/files/copy`

复制文件或目录。

**请求体：**

```json
{
  "src": "source.txt",
  "dst": "copy.txt"
}
```

---

### POST `/api/files/chmod`

修改文件权限。

**请求体：**

```json
{
  "path": "script.sh",
  "mode": "755"
}
```

**响应：**

```json
{
  "success": true,
  "mode": "0o755"
}
```

---

### GET `/api/files/stat`

获取文件/目录详细信息。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `path` | query | string | 是 | 文件路径 |

**响应：**

```json
{
  "name": "main.py",
  "path": "src/main.py",
  "type": "file",
  "size": 1024,
  "modified": 1700000000,
  "created": 1700000000,
  "permissions": "rw-r--r--",
  "mode_octal": "0o644",
  "readable": true,
  "writable": true,
  "executable": false,
  "is_symlink": false
}
```

---

### GET `/api/files/search`

递归搜索文件（通配符匹配）。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `path` | query | string | 否 | 搜索目录（默认 `.`） |
| `pattern` | query | string | 否 | 通配符模式（默认 `*`） |
| `limit` | query | int | 否 | 最大结果数（默认 100） |

**响应：**

```json
{
  "results": [],
  "total": 5,
  "pattern": "*.py"
}
```

---

### POST `/api/files/compress`

压缩文件/目录为 ZIP。

**请求体：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `paths` | string[] | 是 | 要压缩的路径列表 |
| `archive_name` | string | 否 | 压缩包名（默认 `archive.zip`） |

**响应：** ZIP 文件二进制流

---

### POST `/api/files/decompress`

解压压缩包（支持 `.zip`、`.tar.gz`、`.tgz`、`.tar.bz2`、`.tar.xz`、`.tar`）。

**请求体：**

```json
{
  "path": "archive.zip"
}
```

**响应：**

```json
{
  "success": true,
  "path": "extracted_dir"
}
```

---

## 命令管理 API

### GET `/api/commands`

获取所有命令信息及全局设置。

**响应：**

```json
{
  "commands": [],
  "global_settings": {
    "prefix": "/",
    "prefixes": ["/"],
    "case_sensitive": true,
    "allow_space_prefix": false,
    "must_at_bot": false
  },
  "platforms": ["qq", "telegram"],
  "total": 10
}
```

---

### PUT `/api/commands/{name}`

更新命令规则。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `name` | path | string | 是 | 命令名称 |

**请求体：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `enabled` | boolean | 否 | 是否启用 |
| `aliases` | string[] | 否 | 别名列表 |
| `allowed_platforms` | string[] | 否 | 允许的平台列表 |
| `blocked_platforms` | string[] | 否 | 屏蔽的平台列表 |
| `transform_to` | string | 否 | 命令转换目标 |

**响应：**

```json
{
  "success": true,
  "rule": {
    "enabled": true,
    "aliases": ["h"],
    "allowed_platforms": [],
    "blocked_platforms": []
  }
}
```

---

## 视图 API

### GET `/api/views`

获取所有已注册的模块视图。

**响应：**

```json
{
  "views": []
}
```

---

## 集群管理 API

### GET `/api/cluster/nodes`

获取集群节点列表。

**响应：**

```json
{
  "nodes": [],
  "local": {
    "id": "local",
    "name": "本地实例"
  }
}
```

---

### POST `/api/cluster/nodes`

添加集群节点。

**请求体：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 节点 ID（不能为 `local`） |
| `name` | string | 否 | 节点名称 |
| `url` | string | 是 | 节点 URL |
| `token` | string | 是 | 节点认证 Token |

**响应：**

```json
{
  "success": true,
  "node": {}
}
```

---

### PUT `/api/cluster/nodes/{node_id}`

更新集群节点信息。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `node_id` | path | string | 是 | 节点 ID |

**请求体：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 否 | 节点名称 |
| `url` | string | 否 | 节点 URL |
| `token` | string | 否 | 认证 Token |
| `enabled` | boolean | 否 | 是否启用 |

---

### DELETE `/api/cluster/nodes/{node_id}`

删除集群节点。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `node_id` | path | string | 是 | 节点 ID |

---

### POST `/api/cluster/nodes/{node_id}/ping`

Ping 测试节点连通性。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `node_id` | path | string | 是 | 节点 ID |

**响应：**

```json
{
  "online": true,
  "latency_ms": 50
}
```

---

### POST `/api/cluster/nodes/{node_id}/probe`

探测节点详细信息。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `node_id` | path | string | 是 | 节点 ID |

---

### GET `/api/cluster/nodes/{node_id}/status`

获取节点运行状态和系统信息。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `node_id` | path | string | 是 | 节点 ID |

**响应：**

```json
{
  "online": true,
  "latency_ms": 50,
  "dashboard_version": "1.0.0",
  "status": {},
  "system": {},
  "capabilities": {}
}
```

---

### ANY `/api/cluster/proxy/{node_id}/{path}`

代理请求到指定节点（支持 GET/POST/PUT/DELETE）。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `node_id` | path | string | 是 | 目标节点 ID |
| `path` | path | string | 是 | 代理路径 |

**请求体：** 根据 HTTP 方法自动转发 JSON / Query 参数。

---

### GET `/api/cluster/overview`

获取集群总览（本地 + 所有远程节点状态）。

**响应：**

```json
{
  "nodes": {
    "local": {
      "online": true,
      "name": "本地实例",
      "latency_ms": 0,
      "dashboard_version": "1.0.0",
      "status": {
        "framework": {},
        "adapters": {},
        "modules": {},
        "adapters_count": 2,
        "modules_count": 5,
        "events_count": 5000
      },
      "system": {}
    }
  }
}
```

---

### POST `/api/cluster/sync/events`

同步事件到目标节点。

**请求体：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `source_node` | string | 是 | 源节点 ID |
| `target_nodes` | string[] | 是 | 目标节点 ID 列表 |
| `event_types` | string[] | 否 | 事件类型过滤 |

**响应：**

```json
{
  "results": {
    "node1": { "success": true },
    "node2": { "success": false, "error": "node_not_found" }
  }
}
```

---

## WebSocket

### WS `/ws`

WebSocket 实时推送连接。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `token` | query | string | 是 | 认证 Token |

**心跳：** 每 30 秒发送 `{"type": "ping"}`

**推送消息类型：**

| type | 说明 |
|------|------|
| `ping` | 心跳 |
| `install_progress` | 安装/升级进度 |
| `module_changed` | 模块状态变更 |
| `event` | 实时事件 |

---

## API 标签总览

| 标签 | 说明 | 涉及 API |
|------|------|----------|
| `无需认证` | 不需要 Token 即可访问 | `/api/adapter-logos`、`/api/store/install/status` |
| `异步任务` | 返回 `task_id`，需轮询状态 | 所有安装/升级/卸载接口 |
| `审计记录` | 操作会被记录到审计日志 | 所有写操作 |
| `热重载` | 修改后自动生效，无需重启 | 适配器配置/账户更新 |
| `受保护` | 核心包不可卸载，Dashboard 不可禁用 | `/api/packages/uninstall`、模块 disable |

---

## 状态码说明

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 参数错误 |
| 401 | 未认证（Token 无效） |
| 403 | 禁止访问（路径越权、敏感文件） |
| 404 | 资源不存在 |
| 409 | 冲突（已存在） |
| 413 | 文件过大 |
| 415 | 不支持的媒体类型 |
| 429 | 请求过多（登录限流） |
| 500 | 服务器内部错误 |
| 502 | 代理错误（集群） |
| 503 | 服务不可用（集群未初始化） |
