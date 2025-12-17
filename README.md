# Polimoney Hub

Polimoney エコシステムの中核となるデータハブサービス。  
政治家・政治団体・選挙の**共通識別子**を管理し、Polimoney Ledger と Polimoney (可視化サービス) 間のデータ連携を仲介します。

## アーキテクチャ

```
                    ┌─────────────────┐
                    │ Polimoney Hub   │ ← このサービス
                    │ (Deno + Hono)   │
                    └────────┬────────┘
                             │
         ┌───────────────────┴───────────────────┐
         ▼                                       ▼
┌─────────────────┐                     ┌─────────────────┐
│ Ledger          │                     │ Polimoney       │
│ (Supabase)      │                     │ (可視化)        │
│ 仕訳データ      │                     │ データ表示      │
└─────────────────┘                     └─────────────────┘
```

詳細: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## 技術スタック

| 項目               | 技術                  |
| ------------------ | --------------------- |
| ランタイム         | Deno                  |
| API フレームワーク | Hono                  |
| 管理画面           | Fresh                 |
| データベース       | Supabase (PostgreSQL) |
| 認証               | Supabase Auth         |
| ホスティング       | Deno Deploy           |

## クイックスタート

### 1. 環境変数を設定

```bash
cp env-example.txt .env
# .env を編集（Supabase の接続情報を入力）
```

### 2. Supabase プロジェクトをセットアップ

1. [Supabase Dashboard](https://supabase.com/dashboard) でプロジェクト作成
2. SQL Editor で `db/schema-supabase.sql` を実行
3. Settings > API から接続情報を取得し `.env` に設定

### 3. 開発サーバー起動

```bash
# API サーバー
deno task dev

# 管理画面（別ターミナル）
cd admin && deno task start
```

### Dev Container（オプション）

VS Code / Cursor で開き、「Reopen in Container」を選択するだけ！

**含まれるもの:**

- Deno ランタイム
- VS Code 拡張機能（Deno）

## API 概要

| エンドポイント          | 説明           | 認証         |
| ----------------------- | -------------- | ------------ |
| `GET /health`           | ヘルスチェック | 不要         |
| `/api/v1/politicians`   | 政治家 CRUD    | API Key      |
| `/api/v1/organizations` | 政治団体 CRUD  | API Key      |
| `/api/v1/elections`     | 選挙 CRUD      | API Key      |
| `/api/auth/login`       | ログイン       | 不要         |
| `/api/admin/*`          | 管理 API       | Bearer Token |

詳細: [docs/API.md](docs/API.md)

## 認証

### API 認証（Ledger/Polimoney 向け）

```bash
curl -H "X-API-Key: your-api-key" \
     http://localhost:3722/api/v1/politicians
```

### 管理画面認証

Supabase Auth を使用。管理者はメール + パスワードでログインし、JWT トークンで認証します。

## ドキュメント

| ドキュメント                                         | 内容                       |
| ---------------------------------------------------- | -------------------------- |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)           | 開発環境セットアップ       |
| [docs/API.md](docs/API.md)                           | API 詳細仕様               |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)         | アーキテクチャ設計         |
| [docs/DESIGN_DECISIONS.md](docs/DESIGN_DECISIONS.md) | エコシステム全体の設計方針 |

## 関連リポジトリ

| リポジトリ                                                          | 説明                   |
| ------------------------------------------------------------------- | ---------------------- |
| [polimoney_ledger](https://github.com/moai-redcap/polimoney_ledger) | 政治資金収支管理アプリ |
| [polimoney](https://github.com/digitaldemocracy2030/polimoney)      | 政治資金可視化サービス |

## ライセンス

AGPL-3.0
