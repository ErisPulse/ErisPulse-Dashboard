[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Русский](README.ru.md)

<div align="center">

<img src="https://raw.githubusercontent.com/ErisPulse/ErisPulse/main/.github/assets/ErisPulseLogo.png" width="180" alt="ErisPulse-Dashboard" />

# ErisPulse-Dashboard

**Web admin panel for ErisPulse — system monitor, module management, config editor & event stream**

<p>
  <a href="https://github.com/ErisPulse/ErisPulse/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License"></a>
  <img src="https://raw.githubusercontent.com/ErisPulse/.github/main/assets/badges/official.svg" alt="ErisPulse">
</p>

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

ErisPulse Dashboard 是 ErisPulse 的官方 Web 管理面板：机器人挂在服务器上之后，看状态、管模块、改配置、翻日志这些事都在浏览器里完成，不用碰命令行。

在线演示：[dashdemo.erisdev.com](https://dashdemo.erisdev.com)（Token 填 `demo`，演示数据，可以随便点）。

## 功能

**监控**

- 系统概览：框架版本、运行时长、CPU / 内存、存储与连接状态
- 事件流：实时事件与消息，可过滤搜索，也能自己构造事件发给适配器
- 拓扑图谱：模块 / 适配器 / Bot 和资源的归属关系，可拖拽缩放
- Bot 管理：各平台 Bot 的连接状态

**管理**

- 模块与适配器：启停、重载、改配置，支持影子测试
- 模块商店：在线安装，批量多选
- 包管理：pip 包升级、卸载、whl 上传安装
- 权限控制：主人列表与三维作用域（模块 / 身份 / 出站）
- 命令管理：命令规则、别名、参数覆写

**数据与运维**

- 会话收件箱：各会话近期的用户与机器人消息（需 ErisPulse 2.11.0+）
- 存储浏览：键值数据与数据库表的查看和清理
- 文件管理：在线编辑代码，图片视频直接预览
- 系统日志：实时日志、生命周期事件、审计记录，可导出
- 集群管理：接入远程节点，跨节点操作

## 外观与移动端

深色 / 浅色 / OLED 纯黑，赛璐璐动画皮肤，8 种强调色，背景图随便换（界面会为背景让利，半透明展示），字体也能上传替换。设置支持多设备同步。手机浏览器打开一样能用。

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
