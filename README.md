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

## Overview

ErisPulse Dashboard is the official web admin panel for the ErisPulse framework. Monitor framework status, manage modules and adapters, watch the live event stream, edit config and storage — all from a browser, with no external frontend toolchain.

## Core Features

- **System overview** — framework version, uptime, adapter and module status at a glance
- **Bot management** — connection status and info for bots on every platform
- **Topology graph** — visualizes ownership links between modules / adapters / bots and their resources & scopes (ErisPulse 2.8.0+)
- **Module management** — enable, disable and load modules and adapters
- **Plugin store** — browse the remote registry and install packages online
- **Master system** — manage framework masters, global or per-platform permissions, identity-provider attribution
- **Scope management** — three-axis control plane (module binding / identity admission / outbound limits), global fallback switches, runtime stats, runtime binding ownership and a decision tester (ErisPulse 2.8.0+)
- **Command management** — edit command rules with owning-module display, ACL user allow/deny lists, argument overrides (`master` / `hidden`) and command conversion
- **Config editor** — view and modify framework config at runtime
- **Storage manager** — view, edit and delete persisted key-value data
- **Remote restart** — safely restart the framework from the web UI
- **Cluster management** — monitor and manage multi-node clusters
- **Unified UI components** — custom dropdowns and searchable multi-selects replace native controls while staying backward compatible

## Install

```bash
pip install ErisPulse-Dashboard

# China mirror
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple ErisPulse-Dashboard
```

Once installed, the module is auto-discovered and loaded by the ErisPulse framework.

## Access

After starting ErisPulse, open in your browser:

```
http://<host>:<port>/Dashboard/
```

where `<host>` and `<port>` are the framework's listen address and port.

## Authentication

On first load the module generates an access token and prints it to the framework log:

```
[Dashboard] ╔══════════════════════════════════════════════╗
[Dashboard] ║           ErisPulse Dashboard                ║
[Dashboard] ║  URL: /Dashboard                             ║
[Dashboard] ║  Token: <your-token-here>                    ║
[Dashboard] ║  Token saved to config key Dashboard.token   ║
[Dashboard] ╚══════════════════════════════════════════════╝
```

The token is printed in plain text only once, at first generation.

Enter it when opening the Dashboard. You can also preset it in the config file:

```toml
[Dashboard]
token = "your-custom-token"
title = "ErisPulse Dashboard"
max_event_log = 500
```

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `Dashboard.title` | `str` | `"ErisPulse Dashboard"` | Panel title |
| `Dashboard.max_event_log` | `int` | `500` | Max retained event log entries |
| `Dashboard.token` | `str` | auto-generated | Access token |

## License

MIT
