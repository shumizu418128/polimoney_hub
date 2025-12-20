/**
 * ロック解除リクエスト API
 *
 * Ledger から年度締め済み台帳のロック解除リクエストを受け付け
 * Hub 管理者が承認/却下する
 */

import { Hono } from "hono";
import { getServiceClient } from "../lib/supabase.ts";

export const unlockRequestsRouter = new Hono();

// ============================================
// 型定義
// ============================================

interface UnlockRequest {
  id: string;
  ledger_id: string;
  ledger_type: "election" | "organization";
  fiscal_year: number | null;
  requested_by_user_id: string;
  requested_by_email: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  approved_at: string | null;
  approved_by: string | null;
  unlock_expires_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface CreateUnlockRequestInput {
  ledger_id: string;
  ledger_type: "election" | "organization";
  fiscal_year?: number;
  requested_by_user_id: string;
  requested_by_email: string;
  reason: string;
}

// ============================================
// Ledger からのリクエスト送信用エンドポイント
// ============================================

/**
 * POST /unlock-requests
 * ロック解除リクエストを作成
 */
unlockRequestsRouter.post("/", async (c) => {
  const body = await c.req.json<CreateUnlockRequestInput>();

  // バリデーション
  if (!body.ledger_id) {
    return c.json({ error: "ledger_id is required" }, 400);
  }
  if (!body.ledger_type || !["election", "organization"].includes(body.ledger_type)) {
    return c.json({ error: "ledger_type must be 'election' or 'organization'" }, 400);
  }
  if (body.ledger_type === "organization" && typeof body.fiscal_year !== "number") {
    return c.json({ error: "fiscal_year is required for organization ledgers" }, 400);
  }
  if (!body.requested_by_user_id) {
    return c.json({ error: "requested_by_user_id is required" }, 400);
  }
  if (!body.requested_by_email) {
    return c.json({ error: "requested_by_email is required" }, 400);
  }
  if (!body.reason || body.reason.trim().length < 10) {
    return c.json({ error: "reason is required (at least 10 characters)" }, 400);
  }

  const supabase = getServiceClient();

  // 既存の pending リクエストをチェック
  const { data: existingRequest } = await supabase
    .from("unlock_requests")
    .select("id, status, created_at")
    .eq("ledger_id", body.ledger_id)
    .eq("status", "pending")
    .single();

  if (existingRequest) {
    return c.json(
      {
        error: "A pending unlock request already exists for this ledger",
        existing_request_id: existingRequest.id,
        created_at: existingRequest.created_at,
      },
      409
    );
  }

  // リクエストを作成
  const { data, error } = await supabase
    .from("unlock_requests")
    .insert({
      ledger_id: body.ledger_id,
      ledger_type: body.ledger_type,
      fiscal_year: body.fiscal_year || null,
      requested_by_user_id: body.requested_by_user_id,
      requested_by_email: body.requested_by_email,
      reason: body.reason.trim(),
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("[UnlockRequests] Create error:", error);
    return c.json({ error: `Failed to create unlock request: ${error.message}` }, 500);
  }

  console.log(`[UnlockRequests] Created: ${data.id} for ledger ${body.ledger_id}`);
  return c.json({ data }, 201);
});

/**
 * GET /unlock-requests
 * ロック解除リクエスト一覧（フィルター可）
 */
unlockRequestsRouter.get("/", async (c) => {
  const status = c.req.query("status");
  const ledgerId = c.req.query("ledger_id");
  const ledgerType = c.req.query("ledger_type");

  const supabase = getServiceClient();
  let query = supabase.from("unlock_requests").select("*");

  if (status) {
    query = query.eq("status", status);
  }
  if (ledgerId) {
    query = query.eq("ledger_id", ledgerId);
  }
  if (ledgerType) {
    query = query.eq("ledger_type", ledgerType);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("[UnlockRequests] List error:", error);
    return c.json({ error: `Failed to fetch unlock requests: ${error.message}` }, 500);
  }

  return c.json({ data });
});

/**
 * GET /unlock-requests/:id
 * ロック解除リクエスト詳細
 */
unlockRequestsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("unlock_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return c.json({ error: "Unlock request not found" }, 404);
  }

  return c.json({ data });
});

/**
 * GET /unlock-requests/check/:ledger_id
 * 特定の台帳の解除状態を確認
 */
unlockRequestsRouter.get("/check/:ledger_id", async (c) => {
  const ledgerId = c.req.param("ledger_id");

  const supabase = getServiceClient();

  // 承認済みかつ有効期限内のリクエストを検索
  const { data: activeUnlock } = await supabase
    .from("unlock_requests")
    .select("*")
    .eq("ledger_id", ledgerId)
    .eq("status", "approved")
    .gte("unlock_expires_at", new Date().toISOString())
    .order("approved_at", { ascending: false })
    .limit(1)
    .single();

  if (activeUnlock) {
    return c.json({
      is_unlocked: true,
      unlock_request: activeUnlock,
      expires_at: activeUnlock.unlock_expires_at,
    });
  }

  // pending のリクエストを検索
  const { data: pendingRequest } = await supabase
    .from("unlock_requests")
    .select("id, created_at, reason")
    .eq("ledger_id", ledgerId)
    .eq("status", "pending")
    .single();

  return c.json({
    is_unlocked: false,
    pending_request: pendingRequest || null,
  });
});

