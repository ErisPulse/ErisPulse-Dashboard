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

ErisPulse Dashboard は、ErisPulse フレームワークの公式 Web 管理パネルモジュールです。ブラウザからフレームワークの実行状態の監視、モジュールとアダプターの管理、リアルタイムイベントストリームの表示、設定やストレージデータの編集が行えます。外部フロントエンドビルドツールは不要です。

## できること

インストール後は、日々の操作をすべてブラウザから行えます。コマンドラインは不要です：

- **ステータス確認** — フレームワークのバージョン、稼働時間、CPU / メモリ、アダプターとモジュールの状態、Bot のオンライン状況
- **セッション受信箱** — 各セッションの最近のユーザー / ボットメッセージ記録、トレース再生対応（ErisPulse 2.11.0+ 必要）
- **イベントストリーム** — リアルタイムのイベントとメッセージ。絞り込み・検索・イベントの構築送信も可能
- **モジュールとアダプター** — 起動停止 / 再読み込み / 設定変更。ストアからオンラインインストール、pip パッケージ管理と一括更新
- **トポロジーマップ** — モジュール / アダプター / Bot とリソースの帰属関係をドラッグ・ズーム操作で可視化（ErisPulse 2.8.0+ 必要）
- **権限管理** — オーナー一覧、モジュール / 身元 / 送信の三次元スコープ、判定テスト付き
- **設定管理** — フォームまたはソース直接編集、設定とストレージのバックアップ import / export 対応
- **ストレージブラウザ** — KV データもデータベーステーブルも閲覧・クリア可能
- **ファイル管理** — プロジェクトファイルの閲覧・編集、画像や動画をブラウザでプレビュー
- **システムログ** — リアルタイムログ、ライフサイクルイベント、監査記録、ワンクリック export
- **クラスタ管理** — リモートノードを追加して跨ノード管理

## 見た目は自由

ダーク / ライト / OLED 純黒、セルアニメ風スキン、8 色のアクセントカラー、背景画像のカスタム（UI は背景に譲り半透明表示）、フォントのアップロード、デスクトップ通知——すべて設定から。スマホブラウザでも快適に使えます。

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
