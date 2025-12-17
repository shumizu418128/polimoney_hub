/**
 * Ledger → Hub 同期 API
 *
 * Ledger からの仕訳データを受け付けて public_journals に保存
 */

import { Hono } from "hono";
import { getServiceClient } from "../lib/supabase.ts";

const syncRouter = new Hono();

// ============================================
// 型定義
// ============================================

/** Ledger から送信される同期データ */
interface SyncJournalInput {
  /** Ledger 側の仕訳 ID */
  journal_source_id: string;
  /** 台帳 ID（Hub 側の public_ledgers.ledger_source_id） */
  ledger_source_id: string;
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
  /** テストデータフラグ */
  is_test?: boolean;
}

interface SyncJournalsRequest {
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

/** Ledger から送信される台帳データ */
interface SyncLedgerInput {
  /** Ledger 側の台帳 ID */
  ledger_source_id: string;
  /** 政治家 ID (Hub の politicians.id) */
  politician_id: string;
  /** 政治団体 ID (Hub の organizations.id) - 団体台帳の場合 */
  organization_id?: string;
  /** 選挙 ID (Hub の elections.id) - 選挙台帳の場合 */
  election_id?: string;
  /** 会計年度 */
  fiscal_year: number;
  /** 収入合計 */
  total_income: number;
  /** 支出合計 */
  total_expense: number;
  /** 仕訳件数 */
  journal_count: number;
  /** テストデータフラグ */
  is_test?: boolean;
}

interface SyncLedgerRequest {
  ledger: SyncLedgerInput;
}

// ============================================
// エンドポイント
// ============================================

/**
 * POST /sync/journals
 * Ledger から仕訳データを同期
 */
syncRouter.post("/journals", async (c) => {
  const body = await c.req.json<SyncJournalsRequest>();

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
  const validationErrors: { journal_source_id: string; error: string }[] = [];
  for (const journal of body.journals) {
    if (!journal.journal_source_id) {
      validationErrors.push({
        journal_source_id: "unknown",
        error: "journal_source_id is required",
      });
    }
    if (!journal.ledger_source_id) {
      validationErrors.push({
        journal_source_id: journal.journal_source_id || "unknown",
        error: "ledger_source_id is required",
      });
    }
    if (!journal.account_code) {
      validationErrors.push({
        journal_source_id: journal.journal_source_id || "unknown",
        error: "account_code is required",
      });
    }
    if (typeof journal.amount !== "number") {
      validationErrors.push({
        journal_source_id: journal.journal_source_id || "unknown",
        error: "amount must be a number",
      });
    }
    if (!journal.content_hash) {
      validationErrors.push({
        journal_source_id: journal.journal_source_id || "unknown",
        error: "content_hash is required",
      });
    }
  }

  if (validationErrors.length > 0) {
    return c.json(
      {
        error: "Validation failed",
        details: validationErrors,
      },
      400
    );
  }

  const supabase = getServiceClient();
  const result: SyncResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    error_details: [],
  };

  // ledger_source_id から ledger_id を取得
  const ledgerSourceIds = [...new Set(body.journals.map((j) => j.ledger_source_id))];
  const { data: ledgers, error: ledgerError } = await supabase
    .from("public_ledgers")
    .select("id, ledger_source_id")
    .in("ledger_source_id", ledgerSourceIds);

  if (ledgerError) {
    return c.json({ error: `Failed to fetch ledgers: ${ledgerError.message}` }, 500);
  }

  const ledgerMap = new Map(ledgers?.map((l) => [l.ledger_source_id, l.id]) || []);

  // 既存の仕訳を取得（content_hash で比較）
  const journalSourceIds = body.journals.map((j) => j.journal_source_id);
  const { data: existingJournals, error: existingError } = await supabase
    .from("public_journals")
    .select("journal_source_id, content_hash")
    .in("journal_source_id", journalSourceIds);

  if (existingError) {
    return c.json({ error: `Failed to fetch existing journals: ${existingError.message}` }, 500);
  }

  const existingMap = new Map(
    existingJournals?.map((j) => [j.journal_source_id, j.content_hash]) || []
  );

  // 仕訳を分類
  const toCreate: Array<Record<string, unknown>> = [];
  const toUpdate: Array<{ journal_source_id: string; data: Record<string, unknown> }> = [];
  const synced_at = new Date().toISOString();

  for (const journal of body.journals) {
    const ledgerId = ledgerMap.get(journal.ledger_source_id);
    if (!ledgerId) {
      result.errors++;
      result.error_details?.push({
        journal_source_id: journal.journal_source_id,
        error: `Ledger not found: ${journal.ledger_source_id}`,
      });
      continue;
    }

    const existingHash = existingMap.get(journal.journal_source_id);

    if (!existingHash) {
      // 新規作成
      toCreate.push({
        ledger_id: ledgerId,
        journal_source_id: journal.journal_source_id,
        date: journal.date,
        description: journal.description,
        amount: journal.amount,
        contact_name: journal.contact_name,
        contact_type: journal.contact_type,
        account_code: journal.account_code,
        classification: journal.classification,
        non_monetary_basis: journal.non_monetary_basis,
        note: journal.note,
        public_expense_amount: journal.public_expense_amount,
        content_hash: journal.content_hash,
        is_test: journal.is_test === true,
        synced_at,
      });
    } else if (existingHash !== journal.content_hash) {
      // 更新（ハッシュが異なる）
      toUpdate.push({
        journal_source_id: journal.journal_source_id,
        data: {
          ledger_id: ledgerId,
          date: journal.date,
          description: journal.description,
          amount: journal.amount,
          contact_name: journal.contact_name,
          contact_type: journal.contact_type,
          account_code: journal.account_code,
          classification: journal.classification,
          non_monetary_basis: journal.non_monetary_basis,
          note: journal.note,
          public_expense_amount: journal.public_expense_amount,
          content_hash: journal.content_hash,
          is_test: journal.is_test === true,
          synced_at,
        },
      });
    } else {
      // スキップ（変更なし）
      result.skipped++;
    }
  }

  // 一括 INSERT
  if (toCreate.length > 0) {
    const { error: insertError } = await supabase.from("public_journals").insert(toCreate);

    if (insertError) {
      console.error("[Sync] Insert error:", insertError);
      result.errors += toCreate.length;
      result.error_details?.push({
        journal_source_id: "batch",
        error: `Insert failed: ${insertError.message}`,
      });
    } else {
      result.created = toCreate.length;
    }
  }

  // 個別 UPDATE（Supabase は一括 UPDATE が難しいため）
  for (const item of toUpdate) {
    const { error: updateError } = await supabase
      .from("public_journals")
      .update(item.data)
      .eq("journal_source_id", item.journal_source_id);

    if (updateError) {
      console.error(`[Sync] Update error for ${item.journal_source_id}:`, updateError);
      result.errors++;
      result.error_details?.push({
        journal_source_id: item.journal_source_id,
        error: `Update failed: ${updateError.message}`,
      });
    } else {
      result.updated++;
    }
  }

  // エラー詳細が空の場合は削除
  if (result.error_details?.length === 0) {
    delete result.error_details;
  }

  console.log(
    `[Sync] Journals - Created: ${result.created}, Updated: ${result.updated}, Skipped: ${result.skipped}, Errors: ${result.errors}`
  );

  return c.json({ data: result });
});

/**
 * POST /sync/ledger
 * Ledger から台帳データを同期（公開台帳の作成/更新）
 */
syncRouter.post("/ledger", async (c) => {
  const body = await c.req.json<SyncLedgerRequest>();

  if (!body.ledger) {
    return c.json({ error: "ledger object is required" }, 400);
  }

  const { ledger } = body;

  // バリデーション
  if (!ledger.ledger_source_id) {
    return c.json({ error: "ledger_source_id is required" }, 400);
  }
  if (!ledger.politician_id) {
    return c.json({ error: "politician_id is required" }, 400);
  }
  if (typeof ledger.fiscal_year !== "number") {
    return c.json({ error: "fiscal_year must be a number" }, 400);
  }

  const supabase = getServiceClient();
  const now = new Date().toISOString();

  // 既存チェック
  const { data: existing } = await supabase
    .from("public_ledgers")
    .select("id")
    .eq("ledger_source_id", ledger.ledger_source_id)
    .single();

  if (existing) {
    // 更新
    const { data, error } = await supabase
      .from("public_ledgers")
      .update({
        politician_id: ledger.politician_id,
        organization_id: ledger.organization_id || null,
        election_id: ledger.election_id || null,
        fiscal_year: ledger.fiscal_year,
        total_income: ledger.total_income,
        total_expense: ledger.total_expense,
        journal_count: ledger.journal_count,
        is_test: ledger.is_test === true,
        last_updated_at: now,
      })
      .eq("ledger_source_id", ledger.ledger_source_id)
      .select()
      .single();

    if (error) {
      console.error("[Sync] Ledger update error:", error);
      return c.json({ error: `Failed to update ledger: ${error.message}` }, 500);
    }

    console.log(`[Sync] Ledger updated: ${ledger.ledger_source_id}${ledger.is_test ? " (test)" : ""}`);
    return c.json({ data, action: "updated" });
  } else {
    // 新規作成
    const { data, error } = await supabase
      .from("public_ledgers")
      .insert({
        ledger_source_id: ledger.ledger_source_id,
        politician_id: ledger.politician_id,
        organization_id: ledger.organization_id || null,
        election_id: ledger.election_id || null,
        fiscal_year: ledger.fiscal_year,
        total_income: ledger.total_income,
        total_expense: ledger.total_expense,
        journal_count: ledger.journal_count,
        is_test: ledger.is_test === true,
        last_updated_at: now,
        first_synced_at: now,
      })
      .select()
      .single();

    if (error) {
      console.error("[Sync] Ledger insert error:", error);
      return c.json({ error: `Failed to create ledger: ${error.message}` }, 500);
    }

    console.log(`[Sync] Ledger created: ${ledger.ledger_source_id}${ledger.is_test ? " (test)" : ""}`);
    return c.json({ data, action: "created" }, 201);
  }
});

/**
 * DELETE /sync/journals/:journal_source_id
 * 仕訳を削除（Ledger 側で削除された場合）
 */
syncRouter.delete("/journals/:journal_source_id", async (c) => {
  const journalSourceId = c.req.param("journal_source_id");

  const supabase = getServiceClient();

  const { error } = await supabase
    .from("public_journals")
    .delete()
    .eq("journal_source_id", journalSourceId);

  if (error) {
    console.error(`[Sync] Delete error for ${journalSourceId}:`, error);
    return c.json({ error: `Failed to delete journal: ${error.message}` }, 500);
  }

  console.log(`[Sync] Journal deleted: ${journalSourceId}`);
  return c.json({ message: "Journal deleted", journal_source_id: journalSourceId });
});

/**
 * POST /sync/journals/batch-delete
 * 仕訳を一括削除
 */
syncRouter.post("/journals/batch-delete", async (c) => {
  const body = await c.req.json<{ journal_source_ids: string[] }>();

  if (!body.journal_source_ids || !Array.isArray(body.journal_source_ids)) {
    return c.json({ error: "journal_source_ids array is required" }, 400);
  }

  if (body.journal_source_ids.length === 0) {
    return c.json({ data: { deleted: 0 } });
  }

  const supabase = getServiceClient();

  const { error, count } = await supabase
    .from("public_journals")
    .delete()
    .in("journal_source_id", body.journal_source_ids);

  if (error) {
    console.error("[Sync] Batch delete error:", error);
    return c.json({ error: `Failed to delete journals: ${error.message}` }, 500);
  }

  console.log(`[Sync] Batch deleted ${count} journals`);
  return c.json({ data: { deleted: count || 0 } });
});

/**
 * GET /sync/status
 * 同期ステータス確認（ヘルスチェック）
 */
syncRouter.get("/status", async (c) => {
  const supabase = getServiceClient();

  try {
    // DB 接続確認
    const { count: ledgerCount } = await supabase
      .from("public_ledgers")
      .select("*", { count: "exact", head: true });

    const { count: journalCount } = await supabase
      .from("public_journals")
      .select("*", { count: "exact", head: true });

    return c.json({
      status: "ready",
      message: "Sync API is ready to receive data",
      stats: {
        public_ledgers: ledgerCount || 0,
        public_journals: journalCount || 0,
      },
    });
  } catch (error) {
    console.error("[Sync] Status check error:", error);
    return c.json({
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /sync/change-log
 * 変更ログを記録
 */
syncRouter.post("/change-log", async (c) => {
  const body = await c.req.json<{
    ledger_source_id: string;
    change_summary: string;
    change_details?: Record<string, unknown>;
  }>();

  if (!body.ledger_source_id || !body.change_summary) {
    return c.json({ error: "ledger_source_id and change_summary are required" }, 400);
  }

  const supabase = getServiceClient();

  // ledger_source_id から ledger_id を取得
  const { data: ledger, error: ledgerError } = await supabase
    .from("public_ledgers")
    .select("id")
    .eq("ledger_source_id", body.ledger_source_id)
    .single();

  if (ledgerError || !ledger) {
    return c.json({ error: `Ledger not found: ${body.ledger_source_id}` }, 404);
  }

  const { data, error } = await supabase
    .from("ledger_change_logs")
    .insert({
      ledger_id: ledger.id,
      changed_at: new Date().toISOString(),
      change_summary: body.change_summary,
      change_details: body.change_details || null,
    })
    .select()
    .single();

  if (error) {
    console.error("[Sync] Change log error:", error);
    return c.json({ error: `Failed to create change log: ${error.message}` }, 500);
  }

  return c.json({ data }, 201);
});

export { syncRouter };
