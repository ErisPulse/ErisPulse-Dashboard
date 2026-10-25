<div align="center">

![](.github/dash_bot.png)

# ErisPulse Dashboard

**ErisPulse 官方 Web 管理面板模块**

[![PyPI](https://img.shields.io/pypi/v/ErisPulse-Dashboard?style=flat-square)](https://pypi.org/project/ErisPulse-Dashboard/)

[English](README.md) | **简体中文** | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Русский](README.ru.md)

</div>

---

## 界面预览

| | |
|---|---|
| **仪表盘** | **模块商店** |
| ![](.github/screenshots/dashboard.png) | ![](.github/screenshots/store.png) |
| **模块管理** | **会话收件箱** |
| ![](.github/screenshots/modules.png) | ![](.github/screenshots/transcript.png) |
| **设置** | **文件管理** |
| ![](.github/screenshots/settings.png) | ![](.github/screenshots/files.png) |
| **拓扑图谱** | |
| ![](.github/screenshots/topology.png) | |

> 截图含用户自定义背景与强调色，实际外观随你的配置自由变化。


## 简介

**不用命令行，也能管好一个 bot。** 机器人挂在服务器上运行之后，看状态、开关模块、改配置、翻事件日志、清理数据这些日常操作，都可以在浏览器面板里完成。

先在线体验：**[dashdemo.erisdev.com](https://dashdemo.erisdev.com)**。演示站以模拟数据呈现完整面板，进入时 Token 填 `demo`，每个页面都可以实际点开操作。

## 能做什么

装好之后，日常操作都在浏览器里完成，不用碰命令行：

- **看状态** — 框架版本、运行时长、CPU / 内存、适配器与模块启停、Bot 在线情况
- **会话收件箱** — 各会话近期的用户与机器人消息记录，支持按链路回放（需 ErisPulse 2.11.0+）
- **事件流** — 实时滚动的事件与消息，可过滤搜索，也能自己构造事件发给适配器
- **模块与适配器** — 启停、重载、改配置；商店在线安装，pip 包管理与批量更新
- **拓扑图谱** — 模块 / 适配器 / Bot 和资源的归属连线，可拖拽缩放（需 ErisPulse 2.8.0+）
- **权限控制** — 主人列表，模块 / 身份 / 出站三维作用域，带判定测试器
- **配置管理** — 表单或直接改源码，配置和存储支持备份导入导出
- **存储浏览** — 键值数据和数据库表都能查看、清理
- **文件管理** — 浏览编辑项目文件，图片视频在线预览
- **系统日志** — 实时日志、生命周期事件、审计记录，一键导出
- **集群管理** — 添加远程节点，跨节点管理

## 外观随你定

深色 / 浅色 / OLED 纯黑，赛璐璐动画皮肤，8 种强调色，自定义背景图（界面会为背景让利，半透明展示），上传自己的字体，开桌面通知——都在设置里。手机浏览器打开也一样好用。

## 安装

```bash
pip install ErisPulse-Dashboard

# 国内镜像
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple ErisPulse-Dashboard
```

安装后模块将被 ErisPulse 框架自动发现并加载。面板前端资源内置于 pip 包中，开箱即用，不依赖任何外部前端构建工具。

## 访问地址

安装并启动 ErisPulse 框架后，在浏览器中打开：

```
http://<host>:<port>/Dashboard/
```

其中 `<host>` 和 `<port>` 为 ErisPulse 框架的监听地址与端口。

## 认证

模块首次加载时会自动生成一个访问 Token，并输出到框架日志中：

```
[Dashboard] ╔══════════════════════════════════════════════╗
[Dashboard] ║           ErisPulse Dashboard                ║
[Dashboard] ║  访问地址: /Dashboard                       ║
[Dashboard] ║  访问令牌: <your-token-here>                 ║
[Dashboard] ║  令牌已保存至配置文件 Dashboard.token         ║
[Dashboard] ╚══════════════════════════════════════════════╝
```

为避免令牌泄露，仅在首次生成时在日志中明文输出。

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

## 下一步

- **想先试用** → 打开[在线演示](https://dashdemo.erisdev.com)，Token 输入 `demo`
- **想部署** → 到 [erisdev.com](https://www.erisdev.com) 阅读 ErisPulse 安装与部署文档，再回到上方「安装」一节装上面板
- **想提需求 / 报问题** → 到 [Issues](https://github.com/ErisPulse/ErisPulse-Dashboard/issues) 告诉我们

## 许可证

MIT

## 字体归属 / Font Attribution

Dashboard 默认使用系统字体栈（覆盖中/繁/日/俄/英全部界面语言，零外部请求）。

用户可在 **设置 → 外观** 中上传自定义字体（`.ttf` / `.otf` / `.woff` / `.woff2`，≤15MB）自由替换界面字体；上传的字体保存在服务端 `static/res/fonts_upload/`，可随全局同步分发到所有设备。

字体文件的版权归各自作者所有，使用上传功能时请确认你拥有相应字体的合法授权。
