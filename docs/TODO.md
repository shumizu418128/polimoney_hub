# Polimoney Hub TODO

最終更新: 2025-12-17

---

## 📊 タスク一覧

### 🟢 完了済み

| # | タスク | 完了日 |
|---|--------|--------|
| ✓ | Azure → Supabase 移行 | 2024-12 |
| ✓ | Admin UI 認証 (Supabase Auth) | 2024-12 |
| ✓ | Admin UI: ダッシュボード | 2024-12 |
| ✓ | Admin UI: 選挙リクエスト承認画面 | 2024-12 |
| ✓ | Admin UI: 団体リクエスト承認画面 | 2024-12 |
| ✓ | Admin UI: ロック解除リクエスト承認画面 | 2024-12 |
| ✓ | `unlock_requests` テーブル作成 | 2024-12 |
| ✓ | `unlock_requests` API 実装 | 2024-12 |
| ✓ | Ledger → Hub 同期 API 実装 | 2024-12 |
| ✓ | 選挙区マスタ初期データ投入（4,016 区） | 2024-12 |
| ✓ | 市区町村マスタ投入（1,794 件） | 2024-12 |
| ✓ | 勘定科目マスタ、選挙タイプマスタ作成 | 2024-12 |
| ✓ | 公費負担項目マスタ作成 | 2024-12 |
| ✓ | OpenAPI 仕様書作成 | 2024-12 |
| ✓ | `public_journals` にカラム追加（classification, note 等） | 2024-12 |
| ✓ | 家屋費の子科目追加（選挙事務所費、集合会場費等） | 2025-12-17 |
| ✓ | ドキュメント更新（DATABASE.md Supabase 対応） | 2025-12-17 |

---

### 🔥 優先度高

#### 1. Polimoney 向け API 完成

**目標**: Polimoney の JSON 形式に合わせた API を完成させる

| 項目 | 状態 |
|------|------|
| `public_journals` スキーマ拡張 | ✅ 完了 |
| `polimoney-transform.ts` 作成 | 🔲 未着手 |
| API レスポンス形式整備 | 🔲 未着手 |
| `public_expense_amount > 0` のみ出力 | 🔲 未着手 |

**Polimoney JSON 形式:**

```json
{
  "data_id": "e7098ad7-f6a2-4dfd-a60c-fa814d0bb47c",
  "date": "2025-06-10",
  "price": 30605,
  "category": "personnel",
  "type": "選挙運動",
  "purpose": "車上運動員報酬",
  "non_monetary_basis": null,
  "note": "5/23~25...",
  "public_expense_amount": 123680
}
```

**account_code → category 変換表:**

```typescript
const ACCOUNT_CODE_TO_CATEGORY: Record<string, string> = {
  // 支出（選挙運動費用）
  EXP_PERSONNEL_ELEC: "personnel",
  EXP_BUILDING_ELEC: "building",
  EXP_BUILDING_ELEC_OFFICE: "building",
  EXP_BUILDING_ELEC_VENUE: "building",
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

---

#### 2. Ledger ↔ Hub 連携完成

| 項目 | Hub 側 | Ledger 側 |
|------|--------|-----------|
| 同期 API | ✅ 受信実装済 | 🔲 送信ロジック |
| ロック解除フロー | ✅ 承認 API 実装済 | 🔲 リクエスト送信 |
| 匿名化ロジック | - | 🔲 contacts 匿名化 |
| account_code → category 変換 | 🔲 変換テーブル | - |

---

### 📋 中優先度

| # | タスク | 状態 | 詳細 |
|---|--------|------|------|
| 1 | API バージョニング (v1/v2) | 🔲 未着手 | `/api/v1/polimoney/...` |
| 2 | Deno Deploy デプロイ | 🔲 未着手 | 環境変数設定 |
| 3 | ハッシュ生成ロジック | 🔲 未着手 | 改ざん検知用 |

---

### 📝 低優先度

| # | タスク | 状態 |
|---|--------|------|
| 1 | ユニットテスト | 🔲 未着手 |
| 2 | E2E テスト | 🔲 未着手 |

---

## 📊 API エンドポイント一覧

### 公開 API（API キー認証）

| Method | Endpoint | 説明 |
|--------|----------|------|
| GET | `/api/v1/politicians` | 政治家一覧 |
| GET | `/api/v1/organizations` | 政治団体一覧 |
| GET | `/api/v1/elections` | 選挙一覧 |
| POST | `/api/v1/election-requests` | 選挙登録リクエスト |
| POST | `/api/v1/organization-requests` | 団体登録リクエスト |
| POST | `/api/v1/sync/journals` | 仕訳データ同期 |
| POST | `/api/v1/sync/ledger` | 台帳データ同期 |
| DELETE | `/api/v1/sync/journals/:id` | 仕訳削除 |
| POST | `/api/v1/sync/journals/batch-delete` | 仕訳一括削除 |
| GET | `/api/v1/sync/status` | 同期ステータス確認 |
| POST | `/api/v1/unlock-requests` | ロック解除リクエスト作成 |
| GET | `/api/v1/unlock-requests/check/:id` | 解除状態確認 |
| GET | `/api/v1/master/account-codes` | 勘定科目一覧 |
| GET | `/api/v1/master/election-types` | 選挙タイプ一覧 |
| GET | `/api/v1/master/public-subsidy-items` | 選挙公営費目一覧 |
| GET | `/api/v1/master/municipalities` | 市区町村一覧 |
| GET | `/api/v1/master/prefectures` | 都道府県一覧 |

### Polimoney API（API キー認証）

| Method | Endpoint | 説明 |
|--------|----------|------|
| GET | `/api/v1/polimoney/elections` | 公開選挙一覧 |
| GET | `/api/v1/polimoney/elections/:id/journals` | 選挙収支データ取得 |
| GET | `/api/v1/polimoney/elections/:id/candidates` | 選挙の候補者一覧 |
| GET | `/api/v1/polimoney/ledgers/:id/journals` | 台帳 ID 指定でデータ取得 |

### 管理者 API（Bearer トークン認証）

| Method | Endpoint | 説明 |
|--------|----------|------|
| GET | `/api/admin/election-requests` | 選挙リクエスト一覧 |
| PUT | `/api/admin/election-requests/:id/approve` | 選挙リクエスト承認 |
| PUT | `/api/admin/election-requests/:id/reject` | 選挙リクエスト却下 |
| GET | `/api/admin/organization-requests` | 団体リクエスト一覧 |
| PUT | `/api/admin/organization-requests/:id/approve` | 団体リクエスト承認 |
| PUT | `/api/admin/organization-requests/:id/reject` | 団体リクエスト却下 |
| GET | `/api/admin/unlock-requests` | ロック解除リクエスト一覧 |
| PUT | `/api/admin/unlock-requests/:id/approve` | ロック解除承認 |
| PUT | `/api/admin/unlock-requests/:id/reject` | ロック解除却下 |
| GET | `/api/admin/users` | 管理者一覧 |
| POST | `/api/admin/users` | 管理者招待 |

---

## 更新履歴

- 2025-12-17: TODO.md と TASK_STATUS.md を統合、最新状態に更新
- 2024-12-14: 初版作成
