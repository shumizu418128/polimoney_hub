# Polimoney Hub TODO

このドキュメントは Hub 開発の残タスクを管理します。

---

## 🔥 優先度高

### 1. Polimoney 向け API レスポンス形式の整備

**目標**: [Polimoney の JSON 形式](https://github.com/digitaldemocracy2030/polimoney/blob/main/tools_election/output_json_example/%E5%B2%A9%E6%B0%B8%E3%81%95%E3%82%93.json) に合わせた API レスポンスを返す

#### Polimoney JSON 仕様（岩永さん.json より確認）

```json
{
  "data_id": "e7098ad7-f6a2-4dfd-a60c-fa814d0bb47c",
  "date": "2025-06-10",
  "price": 30605,
  "category": "personnel",
  "type": "選挙運動",
  "purpose": "車上運動員報酬",
  "non_monetary_basis": null,
  "note": "5/23~25\n(11,100円/日 - その日の昼食・夕食代)*3",
  "public_expense_amount": 123680
}
```

**フィールド説明:**

| フィールド              | 型      | 必須 | 説明                                      | 例                               |
| ----------------------- | ------- | ---- | ----------------------------------------- | -------------------------------- |
| `data_id`               | UUID    | ✅   | 仕訳 ID                                   | `e7098ad7-...`                   |
| `date`                  | DATE    | ❌   | 取引日（null の場合あり：公費負担のみ等） | `2025-06-10`, `null`             |
| `price`                 | DECIMAL | ✅   | 金額（小数あり）                          | `30605`, `20496.6`               |
| `category`              | STRING  | ✅   | 費目カテゴリ（下記一覧参照）              | `personnel`                      |
| `type`                  | STRING  | ✅   | 活動区分                                  | `選挙運動`, `立候補準備`, `寄附` |
| `purpose`               | STRING  | ✅   | 目的（摘要）                              | `車上運動員報酬`                 |
| `non_monetary_basis`    | STRING  | ❌   | 金銭以外の寄附の見積根拠                  | `看板1枚`                        |
| `note`                  | STRING  | ❌   | 備考（改行含む場合あり）                  | `5月7日〜6月7日`                 |
| `public_expense_amount` | INT     | ❌   | 公費負担額（任意、0 の場合は省略）        | `123680`                         |

**category 一覧（JSON から確認）:**

| category        | 日本語名 | 対応 Ledger account_code |
| --------------- | -------- | ------------------------ |
| `personnel`     | 人件費   | `EXP_PERSONNEL_ELEC`     |
| `building`      | 家屋費   | `EXP_BUILDING_ELEC`      |
| `communication` | 通信費   | `EXP_COMMUNICATION_ELEC` |
| `printing`      | 印刷費   | `EXP_PRINTING_ELEC`      |
| `advertising`   | 広告費   | `EXP_ADVERTISING_ELEC`   |
| `stationery`    | 文具費   | `EXP_STATIONERY_ELEC`    |
| `food`          | 食料費   | `EXP_FOOD_ELEC`          |
| `miscellaneous` | 雑費     | `EXP_MISC_ELEC`          |
| `income`        | 収入     | `REV_*` 系すべて         |

※ `transport`（交通費）、`lodging`（休泊費）は岩永さん.json には存在しないが、Ledger では対応している

**type 一覧（JSON から確認）:**

| type                     | 説明                             | Ledger journals.classification |
| ------------------------ | -------------------------------- | ------------------------------ |
| `選挙運動`               | 選挙期間中の活動費用             | `campaign`                     |
| `立候補準備`             | 立候補準備のための支出（告示前） | `pre-campaign`                 |
| `立候補準備のための支出` | 同上（表記揺れ）                 | `pre-campaign`                 |
| `寄附`                   | 収入（寄附金）                   | - （収入科目で判断）           |
| `その他の収入`           | 収入（自己資金等）               | - （収入科目で判断）           |

---

#### 対応表（完全版）

##### Hub DB (Azure) → Polimoney JSON マッピング

| Polimoney JSON          | Hub public_journals        | Ledger ソース                       | Hub での導出方法                                    |
| ----------------------- | -------------------------- | ----------------------------------- | --------------------------------------------------- |
| `data_id`               | `id`                       | `journals.id`                       | ✅ そのまま出力                                     |
| `date`                  | `date`                     | `journals.journal_date`             | ✅ そのまま出力（Ledger 側で必須に）                |
| `price`                 | `amount`                   | `SUM(journal_entries.debit_amount)` | ✅ そのまま出力                                     |
| `category`              | 🔵 `account_code` から導出 | `journal_entries.account_code`      | API 層でマッピング変換（下記変換表参照）            |
| `type`                  | 🔵 `ledger_id` から導出    | `journals.classification`           | 選挙台帳のみ: API 層で変換（campaign→ 選挙運動 等） |
| `purpose`               | `description`              | `journals.description`              | ✅ そのまま出力（摘要）                             |
| `non_monetary_basis`    | 🔴 **追加**                | `journals.non_monetary_basis`       | Ledger から同期、そのまま出力                       |
| `note`                  | 🔴 **追加**                | `journals.notes`                    | Ledger から同期、そのまま出力（備考）               |
| `public_expense_amount` | 🔴 **追加**                | `journals.amount_public_subsidy`    | Ledger から同期、>0 の場合のみ出力                  |

**凡例:**

- ✅ 既存カラムをそのまま使用
- 🔵 既存カラム/関連テーブルから API 層で導出可能（DB 追加不要）
- 🔴 DB にカラム追加が必要

##### type の導出ロジック

```typescript
// public_ledgers.election_id の有無で判断
function deriveType(
  ledger: PublicLedger,
  classification: string | null
): string | null {
  // 選挙台帳の場合のみ type を出力
  if (!ledger.election_id) {
    return null; // 政治団体台帳では type は不要
  }

  // classification から変換
  if (classification === "campaign") return "選挙運動";
  if (classification === "pre-campaign") return "立候補準備のための支出";
  return "選挙運動"; // デフォルト
}
```

##### Hub DB カラム追加計画 ✅ 実装済み

**ファイル:**

- `db/schema.sql` - 新規テーブル作成時用
- `db/migrations/001_add_polimoney_fields.sql` - 既存 DB 更新用

```sql
-- public_journals テーブルへの追加カラム
ALTER TABLE public_journals ADD classification VARCHAR(20);     -- 'campaign' or 'pre-campaign' ※選挙台帳のみ
ALTER TABLE public_journals ADD non_monetary_basis NVARCHAR(MAX);
ALTER TABLE public_journals ADD note NVARCHAR(MAX);             -- 備考
ALTER TABLE public_journals ADD public_expense_amount INT;
```

**適用方法:**

```bash
# Azure Portal → クエリエディター → 以下を実行
db/migrations/001_add_polimoney_fields.sql
```

##### API 層での導出ロジック（TypeScript）

```typescript
// src/lib/polimoney-transform.ts

/**
 * Hub public_journals → Polimoney JSON 変換
 */
export function transformToPolimoneyFormat(
  journal: PublicJournal
): PolimoneyEntry {
  const category = deriveCategory(journal.account_code);
  const isExpense = !category.startsWith("income");
  const type = deriveType(
    journal.classification,
    journal.account_code,
    isExpense
  );

  return {
    data_id: journal.id,
    date: journal.date,
    price: journal.amount,
    category,
    type,
    purpose: journal.description,
    non_monetary_basis: journal.non_monetary_basis || null,
    note: journal.note || null,
    // 0 の場合は出力しない
    ...(journal.public_expense_amount > 0 && {
      public_expense_amount: journal.public_expense_amount,
    }),
  };
}
```

##### account_code → category マッピング表

```typescript
const ACCOUNT_CODE_TO_CATEGORY: Record<string, string> = {
  // 支出（選挙運動費用）
  EXP_PERSONNEL_ELEC: "personnel",
  EXP_BUILDING_ELEC: "building",
  EXP_COMMUNICATION_ELEC: "communication",
  EXP_TRANSPORT_ELEC: "transport",
  EXP_PRINTING_ELEC: "printing",
  EXP_ADVERTISING_ELEC: "advertising",
  EXP_STATIONERY_ELEC: "stationery",
  EXP_FOOD_ELEC: "food",
  EXP_LODGING_ELEC: "lodging",
  EXP_MISC_ELEC: "miscellaneous",

  // 収入（すべて income）
  REV_SELF_FINANCING: "income",
  REV_LOAN_ELEC: "income",
  REV_DONATION_INDIVIDUAL_ELEC: "income",
  REV_DONATION_POLITICAL_ELEC: "income",
  REV_MISC_ELEC: "income",
};
```

##### classification/account_code → type マッピングロジック

```typescript
function deriveType(
  classification: string | null,
  accountCode: string,
  isExpense: boolean
): string {
  // 収入の場合
  if (!isExpense) {
    if (accountCode.includes("DONATION")) {
      return "寄附";
    }
    return "その他の収入";
  }

  // 支出の場合
  if (classification === "campaign") {
    return "選挙運動";
  }
  if (classification === "pre-campaign") {
    return "立候補準備のための支出";
  }

  return "選挙運動"; // デフォルト
}
```

---

#### TODO

- [x] `public_journals` テーブルに以下を追加: ✅ **完了**
  - `classification` (VARCHAR(20)) - campaign, pre-campaign
  - `non_monetary_basis` (NVARCHAR(MAX)) - 金銭以外の寄附の基礎
  - `note` (NVARCHAR(MAX)) - 備考
  - `public_expense_amount` (INT) - 公費負担額（0 の場合は null）
  - ※ `category` は DB に持たず、API 層で `account_code` から導出
- [ ] Ledger → Hub 同期時のマッピングロジック実装
- [ ] `polimoney-transform.ts` 作成（上記 TypeScript 参照）
- [ ] API レスポンスで `public_expense_amount` は >0 の場合のみ出力

---

### 2. Polimoney 向け API バージョニング戦略

Polimoney のビュー更新に合わせて API を進化させつつ、過去バージョンとの互換性を維持する。

#### URL 設計

```
# バージョン付き URL
GET /api/v1/polimoney/elections/{election_id}/journals
GET /api/v2/polimoney/elections/{election_id}/journals
GET /api/v3/polimoney/elections/{election_id}/journals

# バージョンなし（最新版にリダイレクト or エイリアス）
GET /api/polimoney/elections/{election_id}/journals  → 最新版 (v3等)

# その他のエンドポイント
GET /api/v1/polimoney/politicians/{politician_id}/journals
GET /api/v1/polimoney/organizations/{organization_id}/journals
```

#### バージョン管理方針

| バージョン | ステータス | 説明                                 |
| ---------- | ---------- | ------------------------------------ |
| v1         | 🟢 Current | 現行 JSON 形式（岩永さん.json 互換） |
| v2         | 🔵 Planned | 将来：構造変更、新フィールド追加等   |
| v3+        | ⚪ Future  | Polimoney ビュー大幅更新時           |

#### v1 レスポンス形式（現行）

```json
{
  "data": [
    {
      "data_id": "e7098ad7-...",
      "date": "2025-06-10",
      "price": 30605,
      "category": "personnel",
      "type": "選挙運動",
      "purpose": "車上運動員報酬",
      "non_monetary_basis": null,
      "note": "5/23~25...",
      "public_expense_amount": 123680
    }
  ],
  "meta": {
    "api_version": "v1",
    "total_count": 59,
    "election": { "id": "...", "name": "2025年○○市議会議員選挙" }
  }
}
```

#### バージョン互換性ルール

1. **後方互換性**: 既存フィールドの削除・型変更は新バージョンで
2. **追加は OK**: 新フィールドの追加は同一バージョン内で可（クライアントは無視）
3. **廃止通知**: 古いバージョンを廃止する場合、最低 6 ヶ月前に告知
4. **デフォルト**: バージョン指定なし → 最新安定版

#### 実装構造（推奨）

```
src/
├── routes/
│   └── api/
│       └── polimoney/
│           ├── v1/
│           │   └── elections/[id]/journals.ts
│           └── v2/
│               └── elections/[id]/journals.ts
├── lib/
│   └── polimoney/
│       ├── v1/
│       │   └── transform.ts
│       └── v2/
│           └── transform.ts
```

#### TODO

- [ ] API ルーティングにバージョンプレフィックス追加
- [ ] v1 用の transform 関数作成
- [ ] レスポンスに `meta.api_version` を含める
- [ ] バージョン指定なしの場合のデフォルト動作決定
- [ ] API ドキュメントにバージョン情報を明記

---

### 3. Hub ↔ Ledger スキーマ整合性チェック

#### Ledger 側テーブル → Hub 側対応

| Ledger テーブル           | Hub テーブル                   | 状態          | 備考                         |
| ------------------------- | ------------------------------ | ------------- | ---------------------------- |
| `politicians`             | `politicians`                  | ✅ OK         | Hub がマスタ                 |
| `political_organizations` | `organizations`                | ✅ OK         | Hub がマスタ                 |
| `elections`               | `elections`                    | ✅ OK         | Hub がマスタ                 |
| `journals`                | `public_journals`              | ⚠️ 拡張必要   | 上記 TODO 参照               |
| `journal_entries`         | `public_journals.account_code` | ✅ 統合       | 勘定科目コードのみ必要       |
| `contacts`                | `public_journals.contact_*`    | ✅ 匿名化済み | 匿名化ルールは Ledger で適用 |
| `sub_accounts`            | （なし）                       | ❌ 不要       | Ledger 内部用                |
| `ledger_members`          | （なし）                       | ❌ 不要       | Ledger 内部用                |
| `account_master`          | （アプリ内定義）               | ℹ️ 静的定義   | 変換表として Hub 側にも持つ  |

#### Ledger journals/journal_entries → Hub public_journals 完全マッピング

| Ledger ソース                       | Hub public_journals                 | 変換              |
| ----------------------------------- | ----------------------------------- | ----------------- |
| `journals.id`                       | `journal_source_id`                 | ✅ そのまま       |
| `journals.journal_date`             | `date`                              | ✅ そのまま       |
| `journals.description`              | `description`                       | ✅ そのまま       |
| `journals.classification`           | `type` ❌ **不足**                  | 🔴 マッピング変換 |
| `journals.non_monetary_basis`       | `non_monetary_basis` ❌ **不足**    | 🔴 追加           |
| `journals.notes`                    | `note` ❌ **不足**                  | 🔴 追加           |
| `journals.amount_public_subsidy`    | `public_expense_amount` ❌ **不足** | 🔴 追加           |
| `contacts.contact_type`             | `contact_type`                      | ✅ 匿名化         |
| `contacts.name` (匿名化済)          | `contact_name`                      | ✅ 匿名化         |
| `journal_entries.account_code`      | `account_code`                      | ✅ そのまま       |
| `journal_entries.account_code`      | `category` ❌ **不足**              | 🔴 マッピング変換 |
| `SUM(journal_entries.debit_amount)` | `amount`                            | ✅ 計算           |

#### Ledger contacts 匿名化ルール（Ledger 側で適用）

| contacts カラム | 条件                            | Hub へ送信する値 |
| --------------- | ------------------------------- | ---------------- |
| `name`          | `is_name_private == true`       | `"非公開"`       |
| `name`          | `is_name_private == false`      | そのまま         |
| `address`       | `is_address_private == true`    | 送信しない       |
| `occupation`    | `is_occupation_private == true` | 送信しない       |
| `contact_type`  | 常に                            | そのまま公開     |

#### TODO

- [ ] Hub `public_journals` スキーマ拡張（ALTER TABLE）
- [ ] Ledger → Hub 同期 API 設計・実装
- [ ] 匿名化ロジックを Ledger 側に実装
- [ ] account_code → category 変換表を Hub 側に実装

---

## 📋 中優先度

### 4. Deno Deploy デプロイ

- [ ] Deno Deploy にデプロイ（個人アカウント）
- [ ] 環境変数設定（DATABASE_URL, API_KEY_PROD, API_KEY_DEV）
- [ ] 動作確認

### 5. 選挙区マスタの初期データ投入

- [ ] 衆議院小選挙区（289 区）
- [ ] 参議院選挙区（45 区 + 比例）
- [ ] `db/seed_districts.sql` 作成

### 6. Admin UI 完成

- [ ] 選挙リクエスト承認/却下機能
- [ ] 政治団体リクエスト承認/却下機能
- [ ] 選挙区管理機能
- [ ] ダッシュボード統計

---

## 📝 低優先度

### 7. ドキュメント整備

- [ ] API 仕様書（OpenAPI/Swagger）
- [ ] Ledger 連携仕様書
- [ ] Polimoney 連携仕様書

### 8. テスト

- [ ] API エンドポイントのユニットテスト
- [ ] DB 接続テスト
- [ ] E2E テスト

---

## 🔍 要検討事項（調査結果反映）

### 1. 勘定科目マスタの管理場所 → ✅ 結論

- **Ledger 側**: アプリ内定義（`account_master.dart` 等で静的定義）
- **Hub 側**: `account_code → category` 変換表のみ保持
- **結論**: Hub では DB テーブルとして持たず、TypeScript 定数として変換ロジックを実装

```typescript
// src/lib/account-mapping.ts
export const ACCOUNT_CODE_TO_CATEGORY = { ... } as const;
```

### 2. journal_entries の扱い → ✅ 結論

- **Ledger**: 複式簿記（借方/貸方を分けて記録）
- **Hub**: `account_code` と `amount`（借方合計）のみ保持
- **結論**: 明細は不要。仕訳単位でカテゴリ判定するため、**借方の勘定科目コード**のみ必要

**理由**: Polimoney の JSON 形式は 1 仕訳 1 レコード。複合仕訳（複数の支払元）でも、目的（借方）は 1 つ。

### 3. 収入/支出の区別 → ✅ 結論

- **Ledger**: `journal_entries.account_code` のプレフィックスで判断
  - `EXP_*`: 支出
  - `REV_*`: 収入
- **Hub**: `category` で判断
  - `income`: 収入
  - その他: 支出
- **結論**: `account_code` から `category` への変換時に自動判定

### 4. 金額の小数対応 → ⚠️ 新規課題

- **Polimoney JSON**: `price: 20496.6` のように小数あり
- **Ledger journals**: `INTEGER` で定義
- **Hub public_journals**: `INT` で定義
- **課題**: 小数を扱う必要があるか？
- **対応案**:
  - A) 円単位で四捨五入（現行のまま）
  - B) DECIMAL/FLOAT 型に変更
  - C) 銭単位（×100）で保存し、表示時に変換

→ Polimoney 側の要件を確認する必要あり

### 5. date が null のケース → ✅ 対応方針

- **Polimoney JSON**: `date: null` のレコードが存在
  - 例: 公費負担のみの印刷費（日付不明）
- **Ledger journals**: `journal_date` は必須（NOT NULL）
- **対応方針**:
  - Ledger 側で日付不明の場合は選挙日を仮設定
  - または、`journal_date` を NULL 許容に変更検討

---

## 📅 更新履歴

- 2025-12-14: 対応表を完全版に更新（Polimoney JSON 仕様、Ledger スキーマ反映）
- 2025-12-14: 初版作成
