<div align="center">

![](.github/dash_bot.png)

# ErisPulse Dashboard

**ErisPulse Web 管理パネルモジュール**

[![PyPI](https://img.shields.io/pypi/v/ErisPulse-Dashboard?style=flat-square)](https://pypi.org/project/ErisPulse-Dashboard/)

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | **日本語** | [Русский](README.ru.md)

</div>

---

## スクリーンショット

| | |
|---|---|
| **ダッシュボード** | **モジュールストア** |
| ![](.github/screenshots/dashboard.png) | ![](.github/screenshots/store.png) |
| **モジュール管理** | **セッション受信箱** |
| ![](.github/screenshots/modules.png) | ![](.github/screenshots/transcript.png) |
| **設定** | **ファイル管理** |
| ![](.github/screenshots/settings.png) | ![](.github/screenshots/files.png) |
| **トポロジーマップ** | |
| ![](.github/screenshots/topology.png) | |

> スクリーンショットにはユーザー独自の背景とアクセントカラーが含まれます。実際の見た目は設定によって自由に変わります。


## 概要

ErisPulse Dashboard は ErisPulse公式の Web 管理パネルです。ボットをサーバーに置いたあとの、状態確認・モジュール管理・設定変更・ログの確認などをすべてブラウザから行えます。

オンラインデモ：[dashdemo.erisdev.com](https://dashdemo.erisdev.com)（トークンは `demo`。デモデータなので自由に触ってください）。

## 機能

**モニタリング**

- システム概要：フレームワークのバージョン、稼働時間、CPU / メモリ、ストレージと接続の状態
- イベントストリーム：リアルタイムのイベントとメッセージ。絞り込み・検索・イベントの構築送信
- トポロジーマップ：モジュール / アダプター / Bot とリソースの帰属関係。ドラッグ・ズーム対応
- Bot 管理：各プラットフォームの Bot 接続状態

**管理**

- モジュールとアダプター：起動停止 / 再読み込み / 設定変更。シャドーテスト対応
- モジュールストア：オンラインインストール、複数選択
- パッケージ管理：pip パッケージの更新 / アンインストール / whl アップロード
- 権限管理：オーナー一覧と三次元スコープ（モジュール / 身元 / 送信）
- コマンド管理：コマンドルール、エイリアス、パラメータ上書き

**データと運用**

- セッション受信箱：各セッションの最近のユーザー / ボットメッセージ（ErisPulse 2.11.0+ 必要）
- ストレージブラウザ：KV データとテーブルの閲覧・クリア
- ファイル管理：コードのオンライン編集、画像や動画のプレビュー
- システムログ：リアルタイムログ、ライフサイクルイベント、監査記録、export 対応
- クラスタ管理：リモートノードの接続と運用

## 外観とモバイル

ダーク / ライト / OLED 純黒、セルアニメ風スキン、8 色のアクセントカラー、背景画像の差し替え（UI は背景に譲り半透明表示）、フォントのアップロード、デスクトップ通知に対応。設定は複数デバイス間で同期できます。スマホブラウザにも対応しています。

## インストール

```bash
pip install ErisPulse-Dashboard

# 中国ミラー
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple ErisPulse-Dashboard
```

インストール後、モジュールは ErisPulse フレームワークによって自動的に検出され、読み込まれます。

## アクセス URL

ErisPulse フレームワークをインストールして起動した後、ブラウザで開きます：

```
http://<host>:<port>/Dashboard/
```

`<host>` と `<port>` は ErisPulse フレームワークのリッスンアドレスとポートです。

## 認証

モジュールの初回読み込み時にアクセストークンが自動的に生成され、フレームワークのログに出力されます：

```
[Dashboard] ╔══════════════════════════════════════════════╗
[Dashboard] ║           ErisPulse Dashboard                ║
[Dashboard] ║  URL: /Dashboard                             ║
[Dashboard] ║  トークン: <your-token-here>                  ║
[Dashboard] ║  トークンは設定ファイル Dashboard.token に保存 ║
[Dashboard] ╚══════════════════════════════════════════════╝
```

トークン漏洩を防ぐため、初回生成時のみログに平文で出力されます。

Dashboard を開く際にこのトークンを入力して認証します。設定ファイルでトークンを事前設定することもできます：

```toml
[Dashboard]
token = "your-custom-token"
title = "ErisPulse Dashboard"
max_event_log = 500
```

## 設定項目

| 設定キー | 型 | デフォルト値 | 説明 |
|----------|-----|-------------|------|
| `Dashboard.title` | `str` | `"ErisPulse Dashboard"` | パネルタイトル |
| `Dashboard.max_event_log` | `int` | `500` | 保持するイベントログの最大件数 |
| `Dashboard.token` | `str` | 自動生成 | アクセストークン |

## ライセンス

MIT
