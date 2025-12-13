# 開発環境セットアップ

## 前提条件

- Docker Desktop
- VS Code または Cursor
- Dev Containers 拡張機能

## 共有ネットワークの作成（初回のみ）

Polimoney の各サービス（Hub, Ledger）が通信できるように、共有 Docker ネットワークを作成します。

```bash
docker network create polimoney-network
```

## Dev Container の起動

1. このリポジトリを VS Code / Cursor で開く
2. `Ctrl + Shift + P` → `Dev Containers: Reopen in Container`
3. コンテナのビルドと起動を待つ

## サービスの起動

コンテナ内で以下を実行：

```bash
# API サーバー
deno task dev

# 管理画面（別ターミナル）
deno task admin:dev
```

- API: `http://localhost:8000`
- 管理画面: `http://localhost:3002`

## ポート一覧

| サービス     | ポート | 説明                |
| ------------ | ------ | ------------------- |
| Hub API      | 8000   | メイン API サーバー |
| Hub Admin UI | 3002   | 管理画面            |
| PostgreSQL   | 5432   | データベース        |

## 他サービスからの接続

同じ `polimoney-network` に参加している他のコンテナからは、以下の URL で接続できます：

```
# Hub API（コンテナ間）
http://hub-app:8000

# Hub API（ホストから）
http://localhost:8000

# PostgreSQL
postgres://postgres:postgres@hub-db:5432/polimoney_hub
```

> **注意:** コンテナ名は docker-compose.yml の service 名 + プロジェクト名で決まります。

## 構成図

```
┌─────────────────────────────────────────────────────────┐
│                   polimoney-network                      │
│                                                          │
│  ┌─────────────┐      ┌───────────────────────────────┐ │
│  │   Ledger    │ ──→  │            Hub                │ │
│  │   :3001     │      │  ┌─────────┐  ┌────────────┐ │ │
│  └─────────────┘      │  │   API   │  │  Admin UI  │ │ │
│                       │  │  :8000  │  │   :3002    │ │ │
│                       │  └────┬────┘  └────────────┘ │ │
│                       └───────┼───────────────────────┘ │
│                               │                          │
│                      ┌────────┴────────┐                │
│                      │   PostgreSQL    │                │
│                      │     :5432       │                │
│                      └─────────────────┘                │
└─────────────────────────────────────────────────────────┘
```

## ウィンドウの色

Dev Container を開くと、ウィンドウが **緑色** になります。
これにより、他のプロジェクト（Ledger: 赤）と区別できます。

## トラブルシューティング

### ネットワークが見つからない

```
Error: network polimoney-network not found
```

→ 共有ネットワークを作成してください：

```bash
docker network create polimoney-network
```

### データベースに接続できない

```bash
# コンテナ内でDBの状態を確認
docker logs devcontainer-db-1
```

### コンテナを完全にリセット

```bash
# コンテナを停止して削除
docker compose -f .devcontainer/docker-compose.yml down -v

# 再ビルド
# VS Code: Dev Containers: Rebuild Container
```
