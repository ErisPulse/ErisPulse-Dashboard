<div align="center">

![](.github/dash_bot.png)

# ErisPulse Dashboard

**ErisPulse Web 管理パネルモジュール**

[![PyPI](https://img.shields.io/pypi/v/ErisPulse-Dashboard?style=flat-square)](https://pypi.org/project/ErisPulse-Dashboard/)

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | **日本語** | [Русский](README.ru.md)

</div>

---

## 概要

ErisPulse Dashboard は、ErisPulse フレームワークの公式 Web 管理パネルモジュールです。ブラウザからフレームワークの実行状態の監視、モジュールとアダプターの管理、リアルタイムイベントストリームの表示、設定やストレージデータの編集が行えます。外部フロントエンドビルドツールは不要です。

## 主な機能

- **システム概要** — フレームワークのバージョン、稼働時間、アダプターとモジュールの状態を一目で確認
- **Bot 管理** — 全プラットフォームの Bot 接続状態と情報を表示
- **モジュール管理** — モジュールとアダプターの有効化、無効化、読み込み
- **プラグインストア** — リモートパッケージリポジトリの閲覧、オンラインでの依存パッケージのインストール
- **マスターシステム** — フレームワークのマスターを管理、グローバルまたはプラットフォーム別の権限設定をサポート
- **設定編集** — 実行時にフレームワーク設定の表示と変更
- **ストレージ管理** — 永続化ストレージのキーバリューデータの表示、編集、削除
- **リモート再起動** — Web インターフェースからフレームワークを安全に再起動
- **クラスタ管理** — マルチノードクラスタの監視と管理

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
