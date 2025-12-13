# Polimoney Hub TODO

このドキュメントはHub開発の残タスクを管理します。

---

## 🔥 優先度高

### 1. Polimoney向けAPIレスポンス形式の整備

**目標**: [PolimoneyのJSON形式](https://github.com/digitaldemocracy2030/polimoney/blob/main/tools_election/output_json_example/%E5%B2%A9%E6%B0%B8%E3%81%95%E3%82%93.json) に合わせたAPIレスポンスを返す

#### 必要なJSON形式
```json
{
  "category": "personnel",
  "date": "2025-06-10",
  "price": 30605,
  "type": "選挙運動",
  "purpose": "車上運動員報酬",
  "non_monetary_basis": null,
  "note": "...",
  "public_expense_amount": 123680,
  "data_id": "uuid"
}
```

#### 対応表（Hub DB → Polimoney JSON）

| Polimoney JSON | Hub DB (public_journals) | Ledger DB (journals) | 備考 |
|----------------|-------------------------|---------------------|------|
| `data_id` | `id` | `id` | ✅ OK |
| `date` | `date` | `journal_date` | ✅ OK |
| `price` | `amount` | SUM(journal_entries.debit_amount) | ✅ OK |
| `note` | `description` | `description` + `notes` | 要確認 |
| `category` | ❌ **不足** | account_code から導出 | 🔴 追加必要 |
| `type` | ❌ **不足** | `classification` | 🔴 追加必要 |
| `purpose` | ❌ **不足** | `description` | 🔴 追加必要（別カラム？） |
| `non_monetary_basis` | ❌ **不足** | `non_monetary_basis` | 🔴 追加必要 |
| `public_expense_amount` | ❌ **不足** | `amount_public_subsidy` | 🔴 追加必要 |

#### TODO
- [ ] `public_journals` テーブルに以下を追加:
  - `category` (VARCHAR) - personnel, building, communication, etc.
  - `type` (VARCHAR) - 選挙運動, 立候補準備のための支出, etc.
  - `purpose` (NVARCHAR) - 目的
  - `non_monetary_basis` (NVARCHAR) - 金銭以外の寄附の基礎
  - `public_expense_amount` (INT) - 公費負担額
  - `note` (NVARCHAR) - 備考（descriptionとは別？）
- [ ] Ledger → Hub 同期時にこれらのフィールドをマッピング
- [ ] APIレスポンスを新形式に変換するロジック追加

#### 懸念事項
1. **category の導出ロジック**
   - account_code から category へのマッピングが必要
   - Ledger側の `account_master.report_category` を使う？
   
2. **purpose と description の違い**
   - Ledger: `description` = 摘要
   - Polimoney: `purpose` = 目的（より簡潔？）
   - 同じでいいのか、別管理すべきか

3. **収入データ（income）の扱い**
   - JSONには `category: "income"` のデータも含まれる
   - Hub側で収入/支出を区別する必要あり

---

### 2. Hub ↔ Ledger スキーマ整合性チェック

#### Ledger側テーブル → Hub側対応

| Ledger テーブル | Hub テーブル | 状態 |
|----------------|-------------|------|
| `politicians` | `politicians` | ✅ OK（Hubがマスタ） |
| `political_organizations` | `organizations` | ✅ OK（Hubがマスタ） |
| `elections` | `elections` | ✅ OK（Hubがマスタ） |
| `journals` | `public_journals` | ⚠️ 一部フィールド不足 |
| `journal_entries` | （なし） | ❓ 必要？ |
| `contacts` | （なし） | ❓ 公開時に匿名化 |
| `sub_accounts` | （なし） | ❌ 不要（Ledger内部用） |
| `ledger_members` | （なし） | ❌ 不要（Ledger内部用） |
| `account_master` | （なし） | ❓ 勘定科目マスタをHubで持つ？ |

#### Ledger journals → Hub public_journals マッピング

| Ledger journals | Hub public_journals | 備考 |
|-----------------|---------------------|------|
| `id` | `journal_source_id` | ✅ |
| `journal_date` | `date` | ✅ |
| `description` | `description` | ✅ |
| `contact_id` → contacts.name | `contact_name` | ✅ 匿名化済み |
| `contact_id` → contacts.contact_type | `contact_type` | ✅ |
| `classification` | ❌ **不足** | 🔴 追加：type |
| `non_monetary_basis` | ❌ **不足** | 🔴 追加 |
| `notes` | ❌ **不足** | 🔴 追加：note |
| `amount_public_subsidy` | ❌ **不足** | 🔴 追加：public_expense_amount |

#### TODO
- [ ] Hub `public_journals` スキーマを拡張
- [ ] Ledger → Hub 同期APIの設計
- [ ] 勘定科目マスタ（account_master）をHubで持つか検討

---

## 📋 中優先度

### 3. Deno Deploy デプロイ

- [ ] Deno Deploy にデプロイ（個人アカウント）
- [ ] 環境変数設定（DATABASE_URL, API_KEY_PROD, API_KEY_DEV）
- [ ] 動作確認

### 4. 選挙区マスタの初期データ投入

- [ ] 衆議院小選挙区（289区）
- [ ] 参議院選挙区（45区 + 比例）
- [ ] `db/seed_districts.sql` 作成

### 5. Admin UI 完成

- [ ] 選挙リクエスト承認/却下機能
- [ ] 政治団体リクエスト承認/却下機能
- [ ] 選挙区管理機能
- [ ] ダッシュボード統計

---

## 📝 低優先度

### 6. ドキュメント整備

- [ ] API仕様書（OpenAPI/Swagger）
- [ ] Ledger連携仕様書
- [ ] Polimoney連携仕様書

### 7. テスト

- [ ] APIエンドポイントのユニットテスト
- [ ] DB接続テスト
- [ ] E2Eテスト

---

## 🔍 要検討事項

1. **勘定科目マスタの管理場所**
   - Ledger側: `account_master` テーブルで管理
   - Hub側: 持つべき？Ledgerからの同期だけ？
   - → Polimoney表示用にcategoryへのマッピングが必要なので、Hubでも持つべきかも

2. **journal_entries の扱い**
   - Ledger: 複式簿記で借方/貸方を分けて記録
   - Hub: 合計金額だけ持つ？明細も持つ？
   - → Polimoneyの表示要件次第

3. **収入/支出の区別**
   - Ledger: account_master.type で区別（revenue/expense）
   - Hub: amount が正負で区別？別テーブル？
   - → 要検討

---

## 📅 更新履歴

- 2025-12-14: 初版作成

