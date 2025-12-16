# Polimoney Hub / Ledger タスク状況

最終更新: 2024-12-14

---

## 🔧 SQL エディターで実行が必要な作業

### Hub DB (Supabase)

| タスク                         | 状態    | 備考                                |
| ------------------------------ | ------- | ----------------------------------- |
| `unlock_requests` テーブル作成 | ✅ 完了 | スキーマ + RLS                      |
| 市区町村データ投入 (1,794 件)  | ✅ 完了 | seed スクリプトで実行済             |
| ダミーデータ投入               | ✅ 完了 | 政治家 5 名、団体 6 件、選挙 3 件等 |

### Ledger DB (Supabase)

| タスク                              | 状態    | SQL      |
| ----------------------------------- | ------- | -------- |
| `ledger_year_closures` テーブル作成 | ✅ 完了 | 実行済み |

```sql
-- Ledger DB で実行
CREATE TABLE IF NOT EXISTS ledger_year_closures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES political_organizations(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'locked', 'temporary_unlock')),
  closed_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  storage_migrated_at TIMESTAMPTZ,
  temporary_unlock_at TIMESTAMPTZ,
  temporary_unlock_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, fiscal_year)
);

CREATE INDEX IF NOT EXISTS idx_year_closures_org ON ledger_year_closures(organization_id);
CREATE INDEX IF NOT EXISTS idx_year_closures_status ON ledger_year_closures(status);
CREATE INDEX IF NOT EXISTS idx_year_closures_fiscal_year ON ledger_year_closures(fiscal_year);

ALTER TABLE ledger_year_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage closures for their organizations" ON ledger_year_closures
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM political_organizations WHERE owner_user_id = auth.uid()
    )
  );
```

---

## 📋 Hub タスク一覧

### 🔥 高優先度

| #   | タスク                        | 状態      | 詳細                              |
| --- | ----------------------------- | --------- | --------------------------------- |
| 1   | Azure → Supabase 移行         | ✅ 完了   | ファイル削除、スキーマ更新済      |
| 2   | Admin UI 認証 (Supabase Auth) | ✅ 完了   | Magic Link + Email/Password       |
| 3   | `unlock_requests` API 実装    | 🔲 未着手 | Ledger からのリクエスト受付・承認 |
| 4   | Polimoney JSON 形式 API       | 🔲 未着手 | `polimoney-transform.ts` 作成     |
| 5   | Ledger → Hub 同期 API         | 🔲 未着手 | public_journals への同期          |

### 📋 中優先度

| #   | タスク                       | 状態      | 詳細                     |
| --- | ---------------------------- | --------- | ------------------------ |
| 6   | API バージョニング (v1/v2)   | 🔲 未着手 | `/api/v1/polimoney/...`  |
| 7   | 選挙区マスタ初期データ       | 🔲 未着手 | 衆院 289 区 + 参院 45 区 |
| 8   | Admin UI: リクエスト承認機能 | 🔲 未着手 | 選挙・団体・ロック解除   |
| 9   | Admin UI: ダッシュボード統計 | 🔲 未着手 |                          |

### 📝 低優先度

| #   | タスク               | 状態      |
| --- | -------------------- | --------- |
| 10  | API 仕様書 (OpenAPI) | 🔲 未着手 |
| 11  | ユニットテスト       | 🔲 未着手 |
| 12  | E2E テスト           | 🔲 未着手 |

---

## 📋 Ledger タスク一覧

### 🔥 高優先度

| #   | タスク                              | 状態    | 詳細           |
| --- | ----------------------------------- | ------- | -------------- |
| 1   | `ledger_year_closures` テーブル作成 | ✅ 完了 | 年度締め機能用 |
| 2   | Hub 同期機能                        | 🔲 未着手       | 承認時の自動同期 + 手動再同期 |
| 3   | 領収証添付機能                      | 🔲 未着手       | media_assets 連携             |

### 📋 中優先度

| #   | タスク                     | 状態      | 詳細                 |
| --- | -------------------------- | --------- | -------------------- |
| 4   | 年度締め UI                | 🔲 未着手 | 締め/解除リクエスト  |
| 5   | 仕訳承認画面               | 🔲 未着手 | ApproveJournalScreen |
| 6   | 台帳設定・メンバー管理画面 | 🔲 未着手 | LedgerSettingsScreen |
| 7   | 複合仕訳対応               | 🔲 未着手 | 複数行の支払元       |

### 📝 低優先度

| #   | タスク                         | 状態      |
| --- | ------------------------------ | --------- |
| 8   | 外部連携 (Freee, MoneyForward) | 🔲 未着手 |
| 9   | AI 科目推奨                    | 🔲 未着手 |
| 10  | deprecated API 修正            | 🔲 未着手 |

---

## 🔗 連携タスク（Hub ↔ Ledger 両方に関係）

| #   | タスク                       | Hub 側             | Ledger 側           |
| --- | ---------------------------- | ------------------ | ------------------- |
| 1   | 同期 API                     | 受信エンドポイント | 送信ロジック        |
| 2   | ロック解除フロー             | 承認 UI + API      | リクエスト送信 UI   |
| 3   | 匿名化ルール                 | -                  | contacts 匿名化処理 |
| 4   | account_code → category 変換 | 変換テーブル実装   | -                   |

---

## 📅 推奨作業順序

### 今すぐ（SQL エディター）

1. **Ledger**: `ledger_year_closures` テーブル作成

### 次のスプリント

1. **Hub**: Ledger → Hub 同期 API 実装
2. **Ledger**: Hub 同期機能（送信側）実装
3. **Hub**: Polimoney JSON 形式 API

### その後

1. **Hub**: ロック解除承認 UI
2. **Ledger**: 年度締め UI
3. **両方**: E2E テスト

---

## 更新履歴

- 2024-12-14: 初版作成（Azure 移行完了後の状態を反映）
