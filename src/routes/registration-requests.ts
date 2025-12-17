/**
 * 登録申請 API
 *
 * Ledger ユーザーの登録申請を受け付け・管理
 */

import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { getSupabaseClient } from "../lib/supabase.ts";

const app = new Hono();

// ============================================
// POST /registration-requests
// 新規登録申請を受け付け
// ============================================
app.post("/", async (c) => {
  try {
    const body = await c.req.json();

    // 必須フィールドの検証
    const requiredFields = [
      "email",
      "full_name",
      "role",
      "verification_doc_url",
    ];
    for (const field of requiredFields) {
      if (!body[field]) {
        return c.json({ error: `${field} is required` }, 400);
      }
    }

    // role の検証
    const validRoles = ["politician", "accountant", "both"];
    if (!validRoles.includes(body.role)) {
      return c.json(
        { error: "role must be one of: politician, accountant, both" },
        400
      );
    }

    const supabase = getSupabaseClient();

    // 重複チェック（同じメールで pending の申請がないか）
    const { data: existingRequest } = await supabase
      .from("registration_requests")
      .select("id, status")
      .eq("email", body.email)
      .eq("status", "pending")
      .single();

    if (existingRequest) {
      return c.json(
        {
          error: "既に審査中の申請があります",
          existing_request_id: existingRequest.id,
        },
        409
      );
    }

    // 登録申請を作成
    const { data, error } = await supabase
      .from("registration_requests")
      .insert({
        email: body.email,
        full_name: body.full_name,
        role: body.role,
        ledger_user_id: body.ledger_user_id || null,
        ledger_supabase_url: body.ledger_supabase_url || null,
        verification_doc_url: body.verification_doc_url,
        verification_doc_type: body.verification_doc_type || null,
        verification_doc_name: body.verification_doc_name || null,
        notes: body.notes || null,
        is_test: body.is_test === true, // テスト申請フラグ
      })
      .select()
      .single();

    if (error) {
      console.error("[Registration Request] Insert error:", error);
      return c.json({ error: error.message }, 500);
    }

    return c.json(
      {
        message: "登録申請を受け付けました",
        request_id: data.id,
        status: data.status,
      },
      201
    );
  } catch (error) {
    console.error("[Registration Request] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ============================================
// GET /registration-requests
// 登録申請一覧（管理者用）
// ============================================
app.get("/", async (c) => {
  try {
    const status = c.req.query("status");
    const includeTest = c.req.query("include_test") === "true";
    const limit = parseInt(c.req.query("limit") || "50");
    const offset = parseInt(c.req.query("offset") || "0");

    const supabase = getSupabaseClient();
    const isProduction = Deno.env.get("DENO_ENV") === "production";

    let query = supabase
      .from("registration_requests")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    // 本番環境ではテスト申請を除外（明示的に include_test=true でない限り）
    if (isProduction && !includeTest) {
      query = query.eq("is_test", false);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[Registration Request] List error:", error);
      return c.json({ error: error.message }, 500);
    }

    return c.json({
      data,
      pagination: {
        total: count,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("[Registration Request] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ============================================
// GET /registration-requests/:id
// 登録申請詳細
// ============================================
app.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("registration_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return c.json({ error: "Request not found" }, 404);
      }
      return c.json({ error: error.message }, 500);
    }

    return c.json(data);
  } catch (error) {
    console.error("[Registration Request] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ============================================
// PUT /registration-requests/:id/approve
// 登録申請を承認（管理者用）
// ============================================
app.put("/:id/approve", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const supabase = getSupabaseClient();

    // 現在の申請を取得
    const { data: request, error: fetchError } = await supabase
      .from("registration_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !request) {
      return c.json({ error: "Request not found" }, 404);
    }

    if (request.status !== "pending") {
      return c.json(
        { error: `Cannot approve request with status: ${request.status}` },
        400
      );
    }

    // 承認処理
    const { data, error } = await supabase
      .from("registration_requests")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: body.reviewed_by || null,
        admin_notes: body.admin_notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[Registration Request] Approve error:", error);
      return c.json({ error: error.message }, 500);
    }

    // TODO: Ledger 側にコールバックを送信してユーザーを有効化
    // または Ledger 側がポーリングで状態を確認

    return c.json({
      message: "登録申請を承認しました",
      data,
    });
  } catch (error) {
    console.error("[Registration Request] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ============================================
// PUT /registration-requests/:id/reject
// 登録申請を却下（管理者用）
// ============================================
app.put("/:id/reject", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const supabase = getSupabaseClient();

    if (!body.rejection_reason) {
      return c.json({ error: "rejection_reason is required" }, 400);
    }

    // 現在の申請を取得
    const { data: request, error: fetchError } = await supabase
      .from("registration_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !request) {
      return c.json({ error: "Request not found" }, 404);
    }

    if (request.status !== "pending") {
      return c.json(
        { error: `Cannot reject request with status: ${request.status}` },
        400
      );
    }

    // 却下処理
    const { data, error } = await supabase
      .from("registration_requests")
      .update({
        status: "rejected",
        rejection_reason: body.rejection_reason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: body.reviewed_by || null,
        admin_notes: body.admin_notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[Registration Request] Reject error:", error);
      return c.json({ error: error.message }, 500);
    }

    return c.json({
      message: "登録申請を却下しました",
      data,
    });
  } catch (error) {
    console.error("[Registration Request] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ============================================
// GET /registration-requests/check/:email
// メールアドレスで申請状態を確認（Ledger 用）
// ============================================
app.get("/check/:email", async (c) => {
  try {
    const email = decodeURIComponent(c.req.param("email"));
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("registration_requests")
      .select("id, status, rejection_reason, reviewed_at")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return c.json({ status: "not_found" });
      }
      return c.json({ error: error.message }, 500);
    }

    return c.json({
      request_id: data.id,
      status: data.status,
      rejection_reason: data.rejection_reason,
      reviewed_at: data.reviewed_at,
    });
  } catch (error) {
    console.error("[Registration Request] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default app;
