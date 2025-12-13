# Polimoney Hub データベース設計書

## 概要

Polimoney Hub は、政治資金の透明性を実現するための **共通マスタデータベース**
です。\
選挙、選挙区、政治家、政治団体などの識別子を一元管理し、Polimoney・Ledger
などの各サービスから参照されます。

### データベース

- **Azure SQL Database** (Serverless)
- 接続情報は運営から共有

---

## テーブル一覧

| テーブル名              | 説明                        | 件数目安    |
| ----------------------- | --------------------------- | ----------- |
| `municipalities`        | 市区町村マスタ              | 約 1,800 件 |
| `districts`             | 選挙区マスタ                | 数百件      |
| `politicians`           | 政治家マスタ                | 随時追加    |
| `organizations`         | 政治団体マスタ              | 随時追加    |
| `elections`             | 選挙マスタ                  | 随時追加    |
| `master_metadata`       | マスタ更新日時              | 5 件        |
| `public_ledgers`        | 公開台帳（Ledger から同期） | -           |
| `public_journals`       | 公開仕訳（Ledger から同期） | -           |
| `ledger_change_logs`    | 台帳変更ログ                | -           |
| `election_requests`     | 選挙登録リクエスト          | -           |
| `organization_requests` | 政治団体登録リクエスト      | -           |

---

## ER 図

```
┌─────────────────┐
│  municipalities │ ← 市区町村マスタ（約1,800件）
│  code (PK)      │
└────────┬────────┘
         │
         │ (municipality_code)
         ▼
┌─────────────────┐       ┌─────────────────┐
│    districts    │       │   politicians   │
│    id (PK)      │       │    id (PK)      │
└────────┬────────┘       └────────┬────────┘
         │                         │
         │ (district_id)           │ (politician_id)
         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐
│    elections    │       │  organizations  │
│    id (PK)      │       │    id (PK)      │
└────────┬────────┘       └────────┬────────┘
         │                         │
         └──────────┬──────────────┘
                    │
                    ▼
          ┌─────────────────┐
          │  public_ledgers │ ← Ledger から同期
          │    id (PK)      │
          └────────┬────────┘
                   │
                   ▼
          ┌─────────────────┐
          │ public_journals │
          │    id (PK)      │
          └─────────────────┘
```

---

## テーブル詳細

### municipalities（市区町村マスタ）

地方選挙（知事選、市長選、議会選）の選挙区として使用。\
データソース:
[city_code.csv](https://github.com/digitaldemocracy2030/polimoney/blob/main/city_code.csv)

| カラム                 | 型            | 説明                          |
| ---------------------- | ------------- | ----------------------------- |
| `code`                 | VARCHAR(6) PK | 団体コード（総務省コード）    |
| `prefecture_name`      | NVARCHAR(10)  | 都道府県名                    |
| `city_name`            | NVARCHAR(50)  | 市区町村名（NULL = 都道府県） |
| `prefecture_name_kana` | NVARCHAR(20)  | 都道府県名（カナ）            |
| `city_name_kana`       | NVARCHAR(50)  | 市区町村名（カナ）            |
| `is_active`            | BIT           | 有効フラグ                    |
| `created_at`           | DATETIME2     | 作成日時                      |
| `updated_at`           | DATETIME2     | 更新日時                      |

**サンプルデータ:**

```sql
-- 都道府県のみ
('10006', '北海道', NULL, 'ﾎｯｶｲﾄﾞｳ', NULL)

-- 市区町村
('131016', '東京都', '千代田区', 'ﾄｳｷｮｳﾄ', 'ﾁﾖﾀﾞｸ')
```

---

### districts（選挙区マスタ）

衆参の選挙区、および地方選挙の区域を管理。

| カラム              | 型                  | 説明                                 |
| ------------------- | ------------------- | ------------------------------------ |
| `id`                | UNIQUEIDENTIFIER PK | UUID（自動生成）                     |
| `name`              | NVARCHAR(100)       | 選挙区名                             |
| `type`              | VARCHAR(10)         | 選挙タイプ（下記参照）               |
| `prefecture_codes`  | VARCHAR(50)         | 関連都道府県（衆参用、カンマ区切り） |
| `municipality_code` | VARCHAR(6) FK       | 市区町村コード（地方選挙用）         |
| `description`       | NVARCHAR(MAX)       | 説明                                 |
| `is_active`         | BIT                 | 有効フラグ                           |
| `created_at`        | DATETIME2           | 作成日時                             |
| `updated_at`        | DATETIME2           | 更新日時                             |

**選挙タイプ (`type`):**

| コード | 説明                                      |
| ------ | ----------------------------------------- |
| `HR`   | 衆議院議員選挙 (House of Representatives) |
| `HC`   | 参議院議員選挙 (House of Councillors)     |
| `PG`   | 都道府県知事選挙 (Prefectural Governor)   |
| `CM`   | 市区町村長選挙 (City/Town/Village Mayor)  |
| `GM`   | 議会議員選挙 (General/Municipal Assembly) |

**サンプルデータ:**

```sql
-- 衆院選
(NEWID(), '東京都第1区', 'HR', '13', NULL, NULL, 1, ...)

-- 参院選（合区）
(NEWID(), '鳥取県・島根県', 'HC', '31,32', NULL, NULL, 1, ...)

-- 市長選（地方）
(NEWID(), '渋谷区', 'CM', NULL, '131130', NULL, 1, ...)
```

---

### elections（選挙マスタ）

実際の選挙（日付あり）を管理。

| カラム          | 型                  | 説明             |
| --------------- | ------------------- | ---------------- |
| `id`            | UNIQUEIDENTIFIER PK | UUID（自動生成） |
| `name`          | NVARCHAR(255)       | 選挙名           |
| `type`          | VARCHAR(10)         | 選挙タイプ       |
| `district_id`   | UNIQUEIDENTIFIER FK | 選挙区 ID        |
| `election_date` | DATE                | 選挙日           |
| `is_active`     | BIT                 | 有効フラグ       |
| `created_at`    | DATETIME2           | 作成日時         |
| `updated_at`    | DATETIME2           | 更新日時         |

**サンプルデータ:**

```sql
(NEWID(), '第50回衆議院議員総選挙 東京都第1区', 'HR', '<district_id>', '2024-10-27', 1, ...)
```

---

### politicians（政治家マスタ）

| カラム       | 型                  | 説明             |
| ------------ | ------------------- | ---------------- |
| `id`         | UNIQUEIDENTIFIER PK | UUID（自動生成） |
| `name`       | NVARCHAR(255)       | 氏名             |
| `name_kana`  | NVARCHAR(255)       | 氏名（カナ）     |
| `created_at` | DATETIME2           | 作成日時         |
| `updated_at` | DATETIME2           | 更新日時         |

---

### organizations（政治団体マスタ）

| カラム          | 型                  | 説明                   |
| --------------- | ------------------- | ---------------------- |
| `id`            | UNIQUEIDENTIFIER PK | UUID（自動生成）       |
| `name`          | NVARCHAR(255)       | 団体名                 |
| `type`          | VARCHAR(50)         | 団体タイプ（下記参照） |
| `politician_id` | UNIQUEIDENTIFIER FK | 関連政治家 ID          |
| `is_active`     | BIT                 | 有効フラグ             |
| `created_at`    | DATETIME2           | 作成日時               |
| `updated_at`    | DATETIME2           | 更新日時               |

**団体タイプ (`type`):**

| 値                | 説明             |
| ----------------- | ---------------- |
| `political_party` | 政党             |
| `support_group`   | 後援会           |
| `fund_management` | 資金管理団体     |
| `other`           | その他の政治団体 |

---

### master_metadata（マスタ更新日時）

各マスタの最終更新日時を記録。Polimoney での「最終更新」表示に使用。

| カラム            | 型             | 説明         |
| ----------------- | -------------- | ------------ |
| `table_name`      | VARCHAR(50) PK | テーブル名   |
| `last_updated_at` | DATETIME2      | 最終更新日時 |

---

## 公開データ（Ledger 同期用）

### public_ledgers（公開台帳）

Ledger から同期された公開用の収支報告書。

| カラム             | 型                  | 説明           |
| ------------------ | ------------------- | -------------- |
| `id`               | UNIQUEIDENTIFIER PK | UUID           |
| `politician_id`    | UNIQUEIDENTIFIER FK | 政治家 ID      |
| `organization_id`  | UNIQUEIDENTIFIER FK | 政治団体 ID    |
| `election_id`      | UNIQUEIDENTIFIER FK | 選挙 ID        |
| `fiscal_year`      | INT                 | 会計年度       |
| `total_income`     | INT                 | 収入合計       |
| `total_expense`    | INT                 | 支出合計       |
| `journal_count`    | INT                 | 仕訳件数       |
| `ledger_source_id` | UNIQUEIDENTIFIER    | Ledger 側の ID |
| `last_updated_at`  | DATETIME2           | 最終更新日時   |
| `first_synced_at`  | DATETIME2           | 初回同期日時   |

### public_journals（公開仕訳）

| カラム                  | 型                  | 説明                                            |
| ----------------------- | ------------------- | ----------------------------------------------- |
| `id`                    | UNIQUEIDENTIFIER PK | UUID                                            |
| `ledger_id`             | UNIQUEIDENTIFIER FK | 台帳 ID                                         |
| `journal_source_id`     | UNIQUEIDENTIFIER    | Ledger 側の ID                                  |
| `date`                  | DATE                | 日付                                            |
| `description`           | NVARCHAR(MAX)       | 摘要（Polimoney: `purpose`）                    |
| `amount`                | INT                 | 金額（Polimoney: `price`）                      |
| `contact_name`          | NVARCHAR(MAX)       | 相手先名（匿名化済み）                          |
| `contact_type`          | VARCHAR(20)         | 相手先種別                                      |
| `account_code`          | VARCHAR(50)         | 勘定科目コード（Polimoney: `category` 導出用）  |
| `classification`        | VARCHAR(20)         | 活動区分（選挙台帳のみ: campaign/pre-campaign） |
| `non_monetary_basis`    | NVARCHAR(MAX)       | 金銭以外の寄附の見積根拠                        |
| `note`                  | NVARCHAR(MAX)       | 備考                                            |
| `public_expense_amount` | INT                 | 公費負担額（0 の場合は NULL）                   |
| `content_hash`          | VARCHAR(64)         | 改ざん検知用ハッシュ                            |

**Polimoney JSON との対応:**

| Polimoney JSON          | Hub カラム                                                             |
| ----------------------- | ---------------------------------------------------------------------- |
| `data_id`               | `id`                                                                   |
| `date`                  | `date`                                                                 |
| `price`                 | `amount`                                                               |
| `category`              | `account_code` から API 層で導出                                       |
| `type`                  | `ledger_id` → `public_ledgers.election_id` + `classification` から導出 |
| `purpose`               | `description`                                                          |
| `non_monetary_basis`    | `non_monetary_basis`                                                   |
| `note`                  | `note`                                                                 |
| `public_expense_amount` | `public_expense_amount`（>0 のみ出力）                                 |

---

## 登録リクエスト

### election_requests（選挙登録リクエスト）

ユーザーからの選挙登録リクエスト。運営が承認/却下。

| カラム                       | 型                  | 説明                       |
| ---------------------------- | ------------------- | -------------------------- |
| `id`                         | UNIQUEIDENTIFIER PK | UUID                       |
| `name`                       | NVARCHAR(255)       | 選挙名                     |
| `type`                       | VARCHAR(10)         | 選挙タイプ                 |
| `district_id`                | UNIQUEIDENTIFIER FK | 選挙区 ID                  |
| `area_description`           | NVARCHAR(MAX)       | 選挙区説明（未登録の場合） |
| `election_date`              | DATE                | 選挙日                     |
| `requested_by_politician_id` | UNIQUEIDENTIFIER FK | リクエスト者（政治家）     |
| `requested_by_email`         | VARCHAR(255)        | リクエスト者メール         |
| `evidence_url`               | NVARCHAR(MAX)       | 証拠 URL                   |
| `notes`                      | NVARCHAR(MAX)       | 備考                       |
| `status`                     | VARCHAR(20)         | ステータス                 |
| `rejection_reason`           | NVARCHAR(MAX)       | 却下理由                   |
| `approved_election_id`       | UNIQUEIDENTIFIER FK | 承認後の選挙 ID            |
| `reviewed_at`                | DATETIME2           | レビュー日時               |
| `reviewed_by`                | NVARCHAR(255)       | レビュー者                 |

**ステータス (`status`):**

| 値           | 説明         |
| ------------ | ------------ |
| `pending`    | 審査待ち     |
| `approved`   | 承認済み     |
| `rejected`   | 却下         |
| `needs_info` | 追加情報必要 |

### organization_requests（政治団体登録リクエスト）

同様の構造。`evidence_type` で証明書類の種類を指定。

---

## API との連携

### マスタ取得

```
GET /api/municipalities          # 市区町村一覧
GET /api/districts               # 選挙区一覧
GET /api/elections               # 選挙一覧
GET /api/politicians             # 政治家一覧
GET /api/organizations           # 政治団体一覧
GET /api/master-metadata         # 更新日時一覧
```

### 公開データ取得

```
GET /api/public/ledgers          # 公開台帳一覧
GET /api/public/ledgers/:id      # 台帳詳細
GET /api/public/journals/:ledgerId  # 仕訳一覧
```

---

## 初期データ

### 市区町村マスタ

- ファイル: `db/seed_municipalities.sql`
- 件数: 約 1,800 件
- ソース:
  [city_code.csv](https://github.com/digitaldemocracy2030/polimoney/blob/main/city_code.csv)

### 選挙区マスタ

衆院選 289 区、参院選 45 区は **今後登録予定**。

---

## 注意事項

1. **ID は UUID** - 全テーブルの主キーは `UNIQUEIDENTIFIER`（UUID）
2. **is_active フラグ** - 削除ではなく非アクティブ化で対応
3. **更新時は master_metadata も更新** - フロントでの「最終更新」表示に使用
4. **SQL Server 構文** - PostgreSQL ではなく Azure SQL Database

---

## 開発環境（スキーマ分離）

本番データに影響を与えずに開発するため、**スキーマ分離** を採用しています。

### スキーマ構成

```
polimoney-sql（Azure SQL Database）
├── dbo スキーマ  ← 本番データ
│   ├── municipalities（市区町村マスタ）
│   ├── districts（選挙区マスタ）
│   └── その他のテーブル
│
└── dev スキーマ  ← 開発用ダミーデータ
    ├── politicians
    ├── organizations
    ├── elections
    ├── master_metadata
    ├── public_ledgers
    ├── public_journals
    ├── ledger_change_logs
    ├── election_requests
    └── organization_requests
```

### 切り替え方法（API キー）

**Hub 側の .env:**

```bash
# 本番用APIキー → dbo スキーマ
API_KEY_PROD=xxxxx

# 開発用APIキー → dev スキーマ
API_KEY_DEV=yyyyy
```

**Polimoney / Ledger 側の .env:**

```bash
# 本番環境
HUB_API_KEY=xxxxx  # API_KEY_PROD の値

# 開発環境
HUB_API_KEY=yyyyy  # API_KEY_DEV の値
```

### 動作イメージ

```
┌─────────────────────────────────────────────────────────┐
│                        Hub API                           │
│                                                          │
│    API_KEY_PROD → dbo（本番データ）                      │
│    API_KEY_DEV  → dev（ダミーデータ）                    │
│                                                          │
└─────────────────────────────────────────────────────────┘
           ▲                    ▲
           │                    │
    ┌──────┴──────┐      ┌──────┴──────┐
    │  Polimoney   │      │   Ledger    │
    ├─────────────┤      ├─────────────┤
    │ 本番: PROD   │      │ 本番: PROD   │
    │ 開発: DEV    │      │ 開発: DEV    │
    └─────────────┘      └─────────────┘
```

### Hub API 内部での使い方

```typescript
import { createTableHelper } from "api/db/schema.ts";

app.get("/api/politicians", (c) => {
  const apiKey = c.req.header("X-API-Key");
  const tables = createTableHelper(apiKey);

  const sql = `SELECT * FROM ${tables.politicians}`;
  // API_KEY_PROD → "SELECT * FROM dbo.politicians"
  // API_KEY_DEV  → "SELECT * FROM dev.politicians"

  // municipalities, districts は常に dbo（本番データ）
  const sql2 = `SELECT * FROM ${tables.municipalities}`;
  // → "SELECT * FROM dbo.municipalities"
});
```

### セットアップ手順

```bash
# 1. dev スキーマとテーブルを作成
# Azure Portal → クエリエディター → db/schema-dev.sql を実行

# 2. ダミーデータを投入
# Azure Portal → クエリエディター → db/seed-dev.sql を実行

# 3. Hub の .env を設定
API_KEY_PROD=<本番用キー>
API_KEY_DEV=<開発用キー>

# 4. Polimoney / Ledger の .env を設定
# 本番環境: HUB_API_KEY=<本番用キー>
# 開発環境: HUB_API_KEY=<開発用キー>
```

### ダミーデータ内容

| データ             | 件数   |
| ------------------ | ------ |
| 政治家             | 5 名   |
| 政治団体           | 6 団体 |
| 選挙               | 3 件   |
| 公開台帳           | 2 件   |
| 公開仕訳           | 8 件   |
| 選挙登録リクエスト | 2 件   |
| 団体登録リクエスト | 1 件   |

---

## 問い合わせ

- Hub 管理画面: `http://localhost:3002`（開発環境）
- GitHub: [polimoney-hub](https://github.com/digitaldemocracy2030/polimoney-hub)
