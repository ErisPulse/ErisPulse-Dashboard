<div align="center">

![](.github/dash_bot.png)

# ErisPulse Dashboard

**ErisPulse Web 管理面板模組**

[![PyPI](https://img.shields.io/pypi/v/ErisPulse-Dashboard?style=flat-square)](https://pypi.org/project/ErisPulse-Dashboard/)

[English](README.md) | [简体中文](README.zh-CN.md) | **繁體中文** | [日本語](README.ja.md) | [Русский](README.ru.md)

</div>

---

## 簡介

ErisPulse Dashboard 是 ErisPulse 框架的官方 Web 管理面板模組。透過瀏覽器即可監控框架執行狀態、管理模組與適配器、檢視即時事件流、編輯設定和儲存資料，無需依賴任何外部前端建置工具。

## 核心特性

- **系統概覽** — 框架版本、執行時間、適配器與模組狀態一目了然
- **Bot 管理** — 檢視所有平台的 Bot 連線狀態與資訊
- **模組管理** — 啟用、停用、載入模組與適配器
- **外掛商店** — 瀏覽遠端套件倉庫，線上安裝依賴套件
- **主人系統** — 管理框架主人，支援全域或按平台設定權限
- **設定編輯** — 執行時檢視與修改框架設定
- **儲存管理** — 檢視、編輯、刪除持久化儲存的鍵值資料
- **遠端重啟** — 透過 Web 介面安全重啟框架
- **叢集管理** — 多節點叢集監控與管理

## 安裝

```bash
pip install ErisPulse-Dashboard

# 國內鏡像
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple ErisPulse-Dashboard
```

安裝後模組將被 ErisPulse 框架自動發現並載入。

## 存取地址

安裝並啟動 ErisPulse 框架後，在瀏覽器中開啟：

```
http://<host>:<port>/Dashboard/
```

其中 `<host>` 和 `<port>` 為 ErisPulse 框架的監聽地址與連接埠。

## 認證

模組首次載入時會自動產生一個存取 Token，並輸出到框架日誌中：

```
[Dashboard] ╔══════════════════════════════════════════════╗
[Dashboard] ║           ErisPulse Dashboard                ║
[Dashboard] ║  存取地址: /Dashboard                       ║
[Dashboard] ║  存取權杖: <your-token-here>                 ║
[Dashboard] ║  權杖已儲存至設定檔 Dashboard.token           ║
[Dashboard] ╚══════════════════════════════════════════════╝
```

為避免權杖洩露，僅在首次產生時在日誌中以明文輸出。

開啟 Dashboard 時需輸入該 Token 完成認證。您也可以在設定檔中預設 Token：

```toml
[Dashboard]
token = "your-custom-token"
title = "ErisPulse Dashboard"
max_event_log = 500
```

## 設定項

| 設定鍵 | 類型 | 預設值 | 說明 |
|--------|------|--------|------|
| `Dashboard.title` | `str` | `"ErisPulse Dashboard"` | 面板標題 |
| `Dashboard.max_event_log` | `int` | `500` | 事件日誌最大保留條數 |
| `Dashboard.token` | `str` | 自動產生 | 存取 Token |

## 授權條款

MIT
