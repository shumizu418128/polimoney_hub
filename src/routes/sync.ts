// deno-lint-ignore-file
// @ts-nocheck
/**
 * Ledger → Hub 同期 API
 *
 * Ledger からの仕訳データを受け付けて public_journals に保存
 */

import { Hono } from "hono";

const syncRouter = new Hono();

// ============================================
// 型定義
// ============================================

/** Ledger から送信される同期データ */
interface SyncJournalInput {
  /** Ledger 側の仕訳 ID */
  journal_source_id: string;
  /** 台帳 ID（Hub 側の public_ledgers.id） */
  ledger_id: string;
  /** 取引日 */
  date: string | null;
  /** 摘要（目的） */
  description: string | null;
  /** 金額 */
  amount: number;
  /** 関係者名（匿名化済み） */
  contact_name: string | null;
  /** 関係者種別 */
  contact_type: string | null;
  /** 勘定科目コード */
  account_code: string;
  /** 活動区分 (campaign / pre-campaign) */
  classification: string | null;
  /** 金銭以外の寄附の見積根拠 */
  non_monetary_basis: string | null;
  /** 備考 */
  note: string | null;
  /** 公費負担額 */
  public_expense_amount: number | null;
  /** コンテンツハッシュ（重複検知用） */
  content_hash: string;
}

interface SyncRequest {
  /** 同期する仕訳データ */
  journals: SyncJournalInput[];
}

interface SyncResult {
  /** 作成された件数 */
  created: number;
  /** 更新された件数 */
  updated: number;
  /** スキップされた件数（変更なし） */
  skipped: number;
  /** エラー件数 */
  errors: number;
  /** エラー詳細 */
  error_details?: { journal_source_id: string; error: string }[];
}

// ============================================
// エンドポイント
// ============================================

/**
 * POST /sync/journals
 * Ledger から仕訳データを同期
 */
syncRouter.post("/journals", async (c) => {
  const body = await c.req.json<SyncRequest>();

  if (!body.journals || !Array.isArray(body.journals)) {
    return c.json({ error: "journals array is required" }, 400);
  }

  if (body.journals.length === 0) {
    return c.json({
      data: {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
      } as SyncResult,
    });
  }

  // バリデーション
  const errors: { journal_source_id: string; error: string }[] = [];
  for (const journal of body.journals) {
    if (!journal.journal_source_id) {
      errors.push({
        journal_source_id: "unknown",
        error: "journal_source_id is required",
      });
    }
    if (!journal.ledger_id) {
      errors.push({
        journal_source_id: journal.journal_source_id || "unknown",
        error: "ledger_id is required",
      });
    }
    if (!journal.account_code) {
      errors.push({
        journal_source_id: journal.journal_source_id || "unknown",
        error: "account_code is required",
      });
    }
    if (typeof journal.amount !== "number") {
      errors.push({
        journal_source_id: journal.journal_source_id || "unknown",
        error: "amount must be a number",
      });
    }
    if (!journal.content_hash) {
      errors.push({
        journal_source_id: journal.journal_source_id || "unknown",
        error: "content_hash is required",
      });
    }
  }

  if (errors.length > 0) {
    return c.json(
      {
        error: "Validation failed",
        details: errors,
      },
      400
    );
  }

  // TODO: DB が繋がったら実際に保存する
  // 今は成功レスポンスを返す（モック）
  console.log(`[Sync] Received ${body.journals.length} journals`);
  console.log("[Sync] First journal:", JSON.stringify(body.journals[0], null, 2));

  const result: SyncResult = {
    created: body.journals.length,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  return c.json({ data: result });
});

/**
 * GET /sync/status
 * 同期ステータス確認（ヘルスチェック）
 */
syncRouter.get("/status", (c) => {
  return c.json({
    status: "ready",
    message: "Sync API is ready to receive data",
    // TODO: DB 接続確認などを追加
  });
});

export { syncRouter };

