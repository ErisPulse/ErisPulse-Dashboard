<div align="center">

![](.github/dash_bot.png)

# ErisPulse Dashboard

**ErisPulse Web 管理面板模块**

[![PyPI](https://img.shields.io/pypi/v/ErisPulse-Dashboard?style=flat-square)](https://pypi.org/project/ErisPulse-Dashboard/)

</div>

---

## 简介

ErisPulse Dashboard 是 ErisPulse 框架的官方 Web 管理面板模块。通过浏览器即可监控框架运行状态、管理模块与适配器、查看实时事件流、编辑配置和存储数据，无需依赖任何外部前端构建工具。

## 核心特性

- **系统概览** — 框架版本、运行时间、适配器与模块状态一目了然
- **Bot 管理** — 查看所有平台的 Bot 连接状态与信息
- **模块管理** — 启用、禁用、加载模块与适配器
- **插件商店** — 浏览远程包仓库，在线安装依赖包
- **配置编辑** — 运行时查看与修改框架配置
- **存储管理** — 查看、编辑、删除持久化存储的键值数据
- **远程重启** — 通过 Web 界面安全重启框架

## 安装

```bash
pip install ErisPulse-Dashboard

# 国内镜像
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple ErisPulse-Dashboard
```

安装后模块将被 ErisPulse 框架自动发现并加载。

## 访问地址

安装并启动 ErisPulse 框架后，在浏览器中打开：

```
http://<host>:<port>/Dashboard/
```

其中 `<host>` 和 `<port>` 为 ErisPulse 框架的监听地址与端口。

## 认证

模块首次加载时会自动生成一个访问 Token，并输出到框架日志中：

```
[Dashboard] WebUI token generated: <your-token-here>
```

打开 Dashboard 时需输入该 Token 完成认证。您也可以在配置文件中预设 Token：

```toml
[Dashboard]
token = "your-custom-token"
title = "ErisPulse Dashboard"
max_event_log = 500
```

## 配置项

| 配置键 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `Dashboard.title` | `str` | `"ErisPulse Dashboard"` | 面板标题 |
| `Dashboard.max_event_log` | `int` | `500` | 事件日志最大保留条数 |
| `Dashboard.token` | `str` | 自动生成 | 访问 Token |

