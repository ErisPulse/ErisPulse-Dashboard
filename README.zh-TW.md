<div align="center">

![](.github/dash_bot.png)

# ErisPulse Dashboard

**ErisPulse Web 管理面板模組**

[![PyPI](https://img.shields.io/pypi/v/ErisPulse-Dashboard?style=flat-square)](https://pypi.org/project/ErisPulse-Dashboard/)

[English](README.md) | [简体中文](README.zh-CN.md) | **繁體中文** | [日本語](README.ja.md) | [Русский](README.ru.md)

</div>

---

## 介面預覽

| | |
|---|---|
| **儀表板** | **模組商店** |
| ![](.github/screenshots/dashboard.png) | ![](.github/screenshots/store.png) |
| **模組管理** | **會話收件匣** |
| ![](.github/screenshots/modules.png) | ![](.github/screenshots/transcript.png) |
| **設定** | **檔案管理** |
| ![](.github/screenshots/settings.png) | ![](.github/screenshots/files.png) |
| **拓撲圖譜** | |
| ![](.github/screenshots/topology.png) | |

> 截圖含使用者自訂背景與強調色，實際外觀會隨你的設定自由變化。


## 簡介

ErisPulse Dashboard 是 ErisPulse 框架的官方 Web 管理面板模組。透過瀏覽器即可監控框架執行狀態、管理模組與適配器、檢視即時事件流、編輯設定和儲存資料，無需依賴任何外部前端建置工具。

## 能做什麼

裝好之後，日常操作都在瀏覽器裡完成，不用碰命令行：

- **看狀態** — 框架版本、執行時長、CPU / 記憶體、介面卡與模組啟停、Bot 上線情況
- **會話收件匣** — 各會話近期的使用者與機器人訊息記錄，支援按鏈路回放（需 ErisPulse 2.11.0+）
- **事件流** — 即時滾動的事件與訊息，可過濾搜尋，也能自己構造事件發給介面卡
- **模組與介面卡** — 啟停、重載、改設定；商店線上安裝，pip 套件管理與批次更新
- **拓撲圖譜** — 模組 / 介面卡 / Bot 和資源的歸屬連線，可拖曳縮放（需 ErisPulse 2.8.0+）
- **權限控制** — 主人列表，模組 / 身份 / 出站三維作用域，帶判定測試器
- **設定管理** — 表單或直接改原始碼，設定和儲存支援備份匯入匯出
- **儲存瀏覽** — 鍵值資料和資料庫表都能檢視、清理
- **檔案管理** — 瀏覽編輯專案檔案，圖片影片線上預覽
- **系統日誌** — 即時日誌、生命週期事件、稽核記錄，一鍵匯出
- **叢集管理** — 新增遠端節點，跨節點管理

## 外觀隨你定

深色 / 淺色 / OLED 純黑，賽璐璐動畫皮膚，8 種強調色，自訂背景圖（介面會為背景讓利，半透明展示），上傳自己的字體，開桌面通知——都在設定裡。手機瀏覽器打開也一樣好用。

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
