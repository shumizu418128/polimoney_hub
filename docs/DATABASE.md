# Polimoney Hub データベース設計書

## 概要

Polimoney Hub は、政治資金の透明性を実現するための **共通マスタデータベース**
です。
選挙、選挙区、政治家、政治団体などの識別子を一元管理し、Polimoney・Ledger
などの各サービスから参照されます。

### データベース

- **Supabase (PostgreSQL)**
- RLS (Row Level Security) 有効
- 接続情報は運営から共有

---

## テーブル一覧

| テーブル名              | 説明                        | 件数目安    |
| ----------------------- | --------------------------- | ----------- |
| `municipalities`        | 市区町村マスタ              | 約 1,800 件 |
| `districts`             | 選挙区マスタ                | 約 4,000 件 |
| `politicians`           | 政治家マスタ                | 随時追加    |
| `organizations`         | 政治団体マスタ              | 随時追加    |
| `elections`             | 選挙マスタ                  | 随時追加    |
| `election_types`        | 選挙タイプマスタ            | 6 件        |
| `account_codes`         | 勘定科目マスタ              | 約 50 件    |
| `public_subsidy_items`  | 公費負担項目マスタ          | 約 20 件    |
| `master_metadata`       | マスタ更新日時              | 8 件        |
| `public_ledgers`        | 公開台帳（Ledger から同期） | -           |
| `public_journals`       | 公開仕訳（Ledger から同期） | -           |
| `ledger_change_logs`    | 台帳変更ログ                | -           |
| `election_requests`     | 選挙登録リクエスト          | -           |
| `organization_requests` | 政治団体登録リクエスト      | -           |
| `unlock_requests`       | ロック解除リクエスト        | -           |
| `admin_users`           | 管理者ユーザー              | -           |

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

┌─────────────────┐       ┌─────────────────────┐
│  election_types │←──────│  public_subsidy_items│
│  code (PK)      │       │  id (PK)            │
└─────────────────┘       └──────────┬──────────┘
                                     │
                          ┌──────────┴──────────┐
                          │    account_codes    │
                          │    code (PK)        │
                          └─────────────────────┘
```

---

## テーブル詳細

### municipalities（市区町村マスタ）

地方選挙（知事選、市長選、議会選）の選挙区として使用。
データソース:
[city_code.csv](https://github.com/digitaldemocracy2030/polimoney/blob/main/city_code.csv)

| カラム                 | 型                      | 説明                          |
| ---------------------- | ----------------------- | ----------------------------- |
| `code`                 | VARCHAR(6) PK           | 団体コード（総務省コード）    |
| `prefecture_name`      | VARCHAR                 | 都道府県名                    |
| `city_name`            | VARCHAR                 | 市区町村名（NULL = 都道府県） |
| `prefecture_name_kana` | VARCHAR                 | 都道府県名（カナ）            |
| `city_name_kana`       | VARCHAR                 | 市区町村名（カナ）            |
| `is_active`            | BOOLEAN DEFAULT TRUE    | 有効フラグ                    |
| `created_at`           | TIMESTAMPTZ DEFAULT NOW | 作成日時                      |
| `updated_at`           | TIMESTAMPTZ DEFAULT NOW | 更新日時                      |

---

### districts（選挙区マスタ）

衆参の選挙区、および地方選挙の区域を管理。

| カラム              | 型                      | 説明                                 |
| ------------------- | ----------------------- | ------------------------------------ |
| `id`                | UUID PK                 | UUID（自動生成）                     |
| `name`              | VARCHAR                 | 選挙区名                             |
| `type`              | VARCHAR(10)             | 選挙タイプ（下記参照）               |
| `prefecture_codes`  | VARCHAR                 | 関連都道府県（衆参用、カンマ区切り） |
| `municipality_code` | VARCHAR(6) FK           | 市区町村コード（地方選挙用）         |
| `description`       | TEXT                    | 説明                                 |
| `is_active`         | BOOLEAN DEFAULT TRUE    | 有効フラグ                           |
| `created_at`        | TIMESTAMPTZ DEFAULT NOW | 作成日時                             |
| `updated_at`        | TIMESTAMPTZ DEFAULT NOW | 更新日時                             |

---

### election_types（選挙タイプマスタ）

| カラム          | 型                      | 説明             |
| --------------- | ----------------------- | ---------------- |
| `code`          | VARCHAR PK              | 選挙タイプコード |
| `name`          | VARCHAR                 | 選挙タイプ名     |
| `description`   | TEXT                    | 説明             |
| `display_order` | INTEGER                 | 表示順           |
| `is_active`     | BOOLEAN DEFAULT TRUE    | 有効フラグ       |
| `created_at`    | TIMESTAMPTZ DEFAULT NOW | 作成日時         |

**選挙タイプ一覧:**

| コード | 名前                 | 説明                                       |
| ------ | -------------------- | ------------------------------------------ |
| `HR`   | 衆議院議員選挙       | House of Representatives（小選挙区・比例） |
| `HC`   | 参議院議員選挙       | House of Councillors（選挙区・比例）       |
| `PG`   | 都道府県知事選挙     | Prefectural Governor                       |
| `PA`   | 都道府県議会議員選挙 | Prefectural Assembly                       |
| `CM`   | 市区町村長選挙       | City/Town/Village Mayor                    |
| `GM`   | 市区町村議会議員選挙 | General/Municipal Assembly                 |

---

### elections（選挙マスタ）

実際の選挙（日付あり）を管理。

| カラム          | 型                      | 説明             |
| --------------- | ----------------------- | ---------------- |
| `id`            | UUID PK                 | UUID（自動生成） |
| `name`          | VARCHAR                 | 選挙名           |
| `type`          | VARCHAR(10)             | 選挙タイプ       |
| `district_id`   | UUID FK                 | 選挙区 ID        |
| `election_date` | DATE                    | 選挙日           |
| `is_active`     | BOOLEAN DEFAULT TRUE    | 有効フラグ       |
| `created_at`    | TIMESTAMPTZ DEFAULT NOW | 作成日時         |
| `updated_at`    | TIMESTAMPTZ DEFAULT NOW | 更新日時         |

---

### politicians（政治家マスタ）

| カラム       | 型                      | 説明             |
| ------------ | ----------------------- | ---------------- |
| `id`         | UUID PK                 | UUID（自動生成） |
| `name`       | VARCHAR                 | 氏名             |
| `name_kana`  | VARCHAR                 | 氏名（カナ）     |
| `created_at` | TIMESTAMPTZ DEFAULT NOW | 作成日時         |
| `updated_at` | TIMESTAMPTZ DEFAULT NOW | 更新日時         |

---

### organizations（政治団体マスタ）

| カラム          | 型                      | 説明                   |
| --------------- | ----------------------- | ---------------------- |
| `id`            | UUID PK                 | UUID（自動生成）       |
| `name`          | VARCHAR                 | 団体名                 |
| `type`          | VARCHAR(50)             | 団体タイプ（下記参照） |
| `politician_id` | UUID FK                 | 関連政治家 ID          |
| `is_active`     | BOOLEAN DEFAULT TRUE    | 有効フラグ             |
| `created_at`    | TIMESTAMPTZ DEFAULT NOW | 作成日時               |
| `updated_at`    | TIMESTAMPTZ DEFAULT NOW | 更新日時               |

**団体タイプ (`type`):**

| 値                | 説明             |
| ----------------- | ---------------- |
| `political_party` | 政党             |
| `support_group`   | 後援会           |
| `fund_management` | 資金管理団体     |
| `other`           | その他の政治団体 |

---

### account_codes（勘定科目マスタ）

| カラム                       | 型                      | 説明                 |
| ---------------------------- | ----------------------- | -------------------- |
| `code`                       | VARCHAR PK              | 科目コード           |
| `name`                       | VARCHAR                 | 科目名               |
| `name_kana`                  | VARCHAR                 | 科目名（カナ）       |
| `type`                       | VARCHAR                 | 勘定タイプ           |
| `report_category`            | VARCHAR                 | 報告書上の分類       |
| `ledger_type`                | VARCHAR DEFAULT 'both'  | 使用可能な台帳タイプ |
| `is_public_subsidy_eligible` | BOOLEAN DEFAULT FALSE   | 公費負担対象フラグ   |
| `display_order`              | INTEGER                 | 表示順               |
| `polimoney_category`         | VARCHAR                 | Polimoney カテゴリ   |
| `parent_code`                | VARCHAR FK              | 親科目コード         |
| `description`                | TEXT                    | 説明                 |
| `is_active`                  | BOOLEAN DEFAULT TRUE    | 有効フラグ           |
| `created_at`                 | TIMESTAMPTZ DEFAULT NOW | 作成日時             |
| `updated_at`                 | TIMESTAMPTZ DEFAULT NOW | 更新日時             |

**勘定タイプ (`type`):**

| 値          | 説明     |
| ----------- | -------- |
| `asset`     | 資産     |
| `liability` | 負債     |
| `equity`    | 純資産   |
| `revenue`   | 収入     |
| `expense`   | 支出     |
| `subsidy`   | 公費負担 |

**台帳タイプ (`ledger_type`):**

| 値             | 説明           |
| -------------- | -------------- |
| `organization` | 政治団体用     |
| `election`     | 選挙運動用     |
| `both`         | 両方で使用可能 |

---

### public_subsidy_items（公費負担項目マスタ）

| カラム               | 型                      | 説明             |
| -------------------- | ----------------------- | ---------------- |
| `id`                 | UUID PK                 | UUID             |
| `election_type_code` | VARCHAR FK              | 選挙タイプコード |
| `account_code`       | VARCHAR FK              | 勘定科目コード   |
| `item_name`          | VARCHAR                 | 項目名           |
| `unit`               | VARCHAR                 | 単位             |
| `unit_price_limit`   | INTEGER                 | 単価上限         |
| `quantity_formula`   | TEXT                    | 数量計算式       |
| `max_quantity`       | INTEGER                 | 最大数量         |
| `total_limit`        | INTEGER                 | 合計上限         |
| `notes`              | TEXT                    | 備考             |
| `effective_from`     | DATE                    | 適用開始日       |
| `effective_until`    | DATE                    | 適用終了日       |
| `is_active`          | BOOLEAN DEFAULT TRUE    | 有効フラグ       |
| `created_at`         | TIMESTAMPTZ DEFAULT NOW | 作成日時         |
| `updated_at`         | TIMESTAMPTZ DEFAULT NOW | 更新日時         |

---

### master_metadata（マスタ更新日時）

各マスタの最終更新日時を記録。Polimoney での「最終更新」表示に使用。

| カラム            | 型                      | 説明         |
| ----------------- | ----------------------- | ------------ |
| `table_name`      | VARCHAR PK              | テーブル名   |
| `last_updated_at` | TIMESTAMPTZ DEFAULT NOW | 最終更新日時 |

---

## 公開データ（Ledger 同期用）

### public_ledgers（公開台帳）

Ledger から同期された公開用の収支報告書。

| カラム             | 型                      | 説明           |
| ------------------ | ----------------------- | -------------- |
| `id`               | UUID PK                 | UUID           |
| `politician_id`    | UUID FK                 | 政治家 ID      |
| `organization_id`  | UUID FK                 | 政治団体 ID    |
| `election_id`      | UUID FK                 | 選挙 ID        |
| `fiscal_year`      | INTEGER                 | 会計年度       |
| `total_income`     | INTEGER DEFAULT 0       | 収入合計       |
| `total_expense`    | INTEGER DEFAULT 0       | 支出合計       |
| `journal_count`    | INTEGER DEFAULT 0       | 仕訳件数       |
| `ledger_source_id` | UUID UNIQUE             | Ledger 側の ID |
| `last_updated_at`  | TIMESTAMPTZ             | 最終更新日時   |
| `first_synced_at`  | TIMESTAMPTZ             | 初回同期日時   |
| `created_at`       | TIMESTAMPTZ DEFAULT NOW | 作成日時       |
| `is_test`          | BOOLEAN DEFAULT FALSE   | テストフラグ   |

### public_journals（公開仕訳）

| カラム                  | 型                      | 説明                                            |
| ----------------------- | ----------------------- | ----------------------------------------------- |
| `id`                    | UUID PK                 | UUID                                            |
| `ledger_id`             | UUID FK                 | 台帳 ID                                         |
| `journal_source_id`     | UUID UNIQUE             | Ledger 側の ID                                  |
| `date`                  | DATE                    | 日付                                            |
| `description`           | TEXT                    | 摘要（Polimoney: `purpose`）                    |
| `amount`                | INTEGER                 | 金額（Polimoney: `price`）                      |
| `contact_name`          | TEXT                    | 相手先名（匿名化済み）                          |
| `contact_type`          | VARCHAR(20)             | 相手先種別                                      |
| `account_code`          | VARCHAR                 | 勘定科目コード（Polimoney: `category` 導出用）  |
| `classification`        | VARCHAR(20)             | 活動区分（選挙台帳のみ: campaign/pre-campaign） |
| `non_monetary_basis`    | TEXT                    | 金銭以外の寄附の見積根拠                        |
| `note`                  | TEXT                    | 備考                                            |
| `public_expense_amount` | INTEGER                 | 公費負担額（0 の場合は NULL）                   |
| `content_hash`          | VARCHAR(64)             | 改ざん検知用ハッシュ                            |
| `synced_at`             | TIMESTAMPTZ             | 同期日時                                        |
| `created_at`            | TIMESTAMPTZ DEFAULT NOW | 作成日時                                        |
| `is_test`               | BOOLEAN DEFAULT FALSE   | テストフラグ                                    |

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

| カラム                       | 型                        | 説明                       |
| ---------------------------- | ------------------------- | -------------------------- |
| `id`                         | UUID PK                   | UUID                       |
| `name`                       | VARCHAR                   | 選挙名                     |
| `type`                       | VARCHAR(10)               | 選挙タイプ                 |
| `district_id`                | UUID FK                   | 選挙区 ID                  |
| `area_description`           | TEXT                      | 選挙区説明（未登録の場合） |
| `election_date`              | DATE                      | 選挙日                     |
| `requested_by_politician_id` | UUID FK                   | リクエスト者（政治家）     |
| `requested_by_email`         | VARCHAR                   | リクエスト者メール         |
| `evidence_url`               | TEXT                      | 証拠 URL                   |
| `notes`                      | TEXT                      | 備考                       |
| `status`                     | VARCHAR DEFAULT 'pending' | ステータス                 |
| `rejection_reason`           | TEXT                      | 却下理由                   |
| `approved_election_id`       | UUID FK                   | 承認後の選挙 ID            |
| `created_at`                 | TIMESTAMPTZ DEFAULT NOW   | 作成日時                   |
| `reviewed_at`                | TIMESTAMPTZ               | レビュー日時               |
| `reviewed_by`                | VARCHAR                   | レビュー者                 |

**ステータス (`status`):**

| 値           | 説明         |
| ------------ | ------------ |
| `pending`    | 審査待ち     |
| `approved`   | 承認済み     |
| `rejected`   | 却下         |
| `needs_info` | 追加情報必要 |

### organization_requests（政治団体登録リクエスト）

同様の構造。`evidence_type` で証明書類の種類を指定。

### unlock_requests（ロック解除リクエスト）

ロックされた台帳の一時解除リクエスト。

| カラム                 | 型                        | 説明               |
| ---------------------- | ------------------------- | ------------------ |
| `id`                   | UUID PK                   | UUID               |
| `ledger_id`            | UUID                      | 台帳 ID            |
| `ledger_type`          | VARCHAR                   | 台帳タイプ         |
| `fiscal_year`          | INTEGER                   | 会計年度           |
| `requested_by_user_id` | UUID                      | リクエスト者 ID    |
| `requested_by_email`   | VARCHAR                   | リクエスト者メール |
| `reason`               | TEXT                      | 理由               |
| `status`               | VARCHAR DEFAULT 'pending' | ステータス         |
| `approved_at`          | TIMESTAMPTZ               | 承認日時           |
| `approved_by`          | UUID                      | 承認者 ID          |
| `unlock_expires_at`    | TIMESTAMPTZ               | 解除期限           |
| `rejection_reason`     | TEXT                      | 却下理由           |
| `created_at`           | TIMESTAMPTZ DEFAULT NOW   | 作成日時           |
| `updated_at`           | TIMESTAMPTZ DEFAULT NOW   | 更新日時           |

---

## 管理者

### admin_users（管理者ユーザー）

| カラム       | 型                      | 説明              |
| ------------ | ----------------------- | ----------------- |
| `id`         | UUID PK FK              | Supabase Auth UID |
| `email`      | VARCHAR                 | メールアドレス    |
| `name`       | VARCHAR                 | 名前              |
| `role`       | VARCHAR DEFAULT 'admin' | 権限              |
| `is_active`  | BOOLEAN DEFAULT TRUE    | 有効フラグ        |
| `dev_mode`   | BOOLEAN DEFAULT FALSE   | 開発モードフラグ  |
| `created_at` | TIMESTAMPTZ DEFAULT NOW | 作成日時          |
| `updated_at` | TIMESTAMPTZ DEFAULT NOW | 更新日時          |

---

## API との連携

### マスタ取得

```
GET /api/v1/municipalities          # 市区町村一覧
GET /api/v1/districts               # 選挙区一覧
GET /api/v1/elections               # 選挙一覧
GET /api/v1/politicians             # 政治家一覧
GET /api/v1/organizations           # 政治団体一覧
GET /api/v1/master/account-codes    # 勘定科目一覧
GET /api/v1/master/election-types   # 選挙タイプ一覧
```

### 公開データ取得

```
GET /api/v1/public/ledgers             # 公開台帳一覧
GET /api/v1/public/ledgers/:id         # 台帳詳細
GET /api/v1/public/journals/:ledgerId  # 仕訳一覧
```

---

## 初期データ

### 市区町村マスタ

- ファイル: `db/seed-municipalities.ts`
- 件数: 約 1,800 件
- ソース:
  [city_code.csv](https://github.com/digitaldemocracy2030/polimoney/blob/main/city_code.csv)

### 勘定科目マスタ

- ファイル: `db/seed-account-codes.ts`
- 件数: 約 50 件
- 政治資金規正法・公職選挙法に準拠

### 選挙区マスタ

- ファイル: `db/seed-districts.ts`
- 衆院選 289 区、参院選 45 区、地方選挙区

---

## 注意事項

1. **ID は UUID** - 全テーブルの主キーは UUID（`gen_random_uuid()`）
2. **is_active フラグ** - 削除ではなく非アクティブ化で対応
3. **RLS 有効** - Row Level Security でアクセス制御
4. **PostgreSQL 構文** - Supabase は PostgreSQL ベース

---

## 開発環境

### ローカル開発

```bash
# Supabase CLI でローカル起動
supabase start

# マイグレーション適用
supabase db push

# シードデータ投入
deno run --allow-env --allow-net --allow-read db/seed-account-codes.ts
```

### 環境変数

**Hub 側の .env:**

```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJhbGci...
SUPABASE_SECRET_KEY=eyJhbGci...

# API 認証キー（Ledger/Polimoney からのアクセス用）
API_KEY_PROD=your-production-api-key
API_KEY_DEV=your-development-api-key
```

---

## 問い合わせ

- Hub 管理画面: `http://localhost:3722`（開発環境）
- GitHub: [polimoney_hub](https://github.com/digitaldemocracy2030/polimoney_hub)
