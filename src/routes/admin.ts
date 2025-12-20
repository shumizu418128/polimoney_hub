import { Hono } from "hono";
import { query, queryOne } from "../db/client.ts";
import { getServiceClient } from "../lib/supabase.ts";

export const adminRouter = new Hono();

// ============================================
// 選挙リクエスト管理
// ============================================

interface ElectionRequest {
  id: string;
  name: string;
  type: string;
  area_description: string;
  election_date: Date;
  requested_by_politician_id: string | null;
  requested_by_email: string | null;
  evidence_url: string | null;
  notes: string | null;
  status: string;
  rejection_reason: string | null;
  approved_election_id: string | null;
  created_at: Date;
  reviewed_at: Date | null;
  reviewed_by: string | null;
}

interface Election {
  id: string;
  name: string;
  type: string;
  area_code: string;
  election_date: Date;
}

// 選挙リクエスト一覧（管理者用）
adminRouter.get("/election-requests", async (c) => {
  const status = c.req.query("status");

  let sql = "SELECT * FROM election_requests";
  const args: unknown[] = [];

  if (status) {
    sql += " WHERE status = $1";
    args.push(status);
  }

  sql += " ORDER BY created_at DESC";

  const requests = await query<ElectionRequest>(sql, args);
  return c.json({ data: requests });
});

// 選挙リクエスト承認
adminRouter.put("/election-requests/:id/approve", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    area_code: string; // 管理者が正式な選挙区コードを指定
    reviewed_by?: string;
  }>();

  if (!body.area_code) {
    return c.json({ error: "area_code is required for approval" }, 400);
  }

  // リクエストを取得
  const request = await queryOne<ElectionRequest>(
    "SELECT * FROM election_requests WHERE id = $1",
    [id]
  );

  if (!request) {
    return c.json({ error: "Election request not found" }, 404);
  }

  if (request.status !== "pending" && request.status !== "needs_info") {
    return c.json({ error: "Request is already processed" }, 400);
  }

  // 選挙IDを生成
  const dateStr = new Date(request.election_date)
    .toISOString()
    .split("T")[0]
    .replace(/-/g, "");
  const electionId = `${request.type}-${body.area_code}-${dateStr}`;

  // 既存チェック
  const existing = await queryOne<Election>(
    "SELECT id FROM elections WHERE id = $1",
    [electionId]
  );

  if (existing) {
    return c.json({
      error: "Election with this ID already exists",
      existing_id: electionId,
    }, 409);
  }

  // 選挙を作成
  await query(
    `INSERT INTO elections (id, name, type, area_code, election_date)
     VALUES ($1, $2, $3, $4, $5)`,
    [electionId, request.name, request.type, body.area_code, request.election_date]
  );

  // リクエストを更新
  const updated = await query<ElectionRequest>(
    `UPDATE election_requests
     SET status = 'approved',
         approved_election_id = $2,
         reviewed_at = NOW(),
         reviewed_by = $3
     WHERE id = $1
     RETURNING *`,
    [id, electionId, body.reviewed_by || null]
  );

  return c.json({
    data: updated[0],
    created_election_id: electionId,
  });
});

// 選挙リクエスト却下
adminRouter.put("/election-requests/:id/reject", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    rejection_reason: string;
    reviewed_by?: string;
  }>();

  if (!body.rejection_reason) {
    return c.json({ error: "rejection_reason is required" }, 400);
  }

  const result = await query<ElectionRequest>(
    `UPDATE election_requests
     SET status = 'rejected',
         rejection_reason = $2,
         reviewed_at = NOW(),
         reviewed_by = $3
     WHERE id = $1 AND status IN ('pending', 'needs_info')
     RETURNING *`,
    [id, body.rejection_reason, body.reviewed_by || null]
  );

  if (result.length === 0) {
    return c.json({ error: "Request not found or already processed" }, 404);
  }

  return c.json({ data: result[0] });
});

// ============================================
// 政治団体リクエスト管理
// ============================================

interface OrganizationRequest {
  id: string;
  name: string;
  type: string;
  registration_authority: string | null;
  requested_by_politician_id: string | null;
  requested_by_email: string | null;
  evidence_type: string;
  evidence_file_url: string;
  evidence_file_name: string | null;
  notes: string | null;
  status: string;
  rejection_reason: string | null;
  approved_organization_id: string | null;
  created_at: Date;
  reviewed_at: Date | null;
  reviewed_by: string | null;
}

interface Organization {
  id: string;
  name: string;
  type: string;
  politician_id: string | null;
}

// 政治団体リクエスト一覧（管理者用）
adminRouter.get("/organization-requests", async (c) => {
  const status = c.req.query("status");

  let sql = "SELECT * FROM organization_requests";
  const args: unknown[] = [];

  if (status) {
    sql += " WHERE status = $1";
    args.push(status);
  }

  sql += " ORDER BY created_at DESC";

  const requests = await query<OrganizationRequest>(sql, args);
  return c.json({ data: requests });
});

// 政治団体リクエスト承認
adminRouter.put("/organization-requests/:id/approve", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    politician_id?: string; // 紐づける政治家（後援会等の場合）
    reviewed_by?: string;
  }>();

  // リクエストを取得
  const request = await queryOne<OrganizationRequest>(
    "SELECT * FROM organization_requests WHERE id = $1",
    [id]
  );

  if (!request) {
    return c.json({ error: "Organization request not found" }, 404);
  }

  if (request.status !== "pending" && request.status !== "needs_info") {
    return c.json({ error: "Request is already processed" }, 400);
  }

  // 政治団体を作成
  const orgResult = await query<Organization>(
    `INSERT INTO organizations (name, type, politician_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [request.name, request.type, body.politician_id || request.requested_by_politician_id || null]
  );

  const newOrg = orgResult[0];

  // リクエストを更新
  const updated = await query<OrganizationRequest>(
    `UPDATE organization_requests
     SET status = 'approved',
         approved_organization_id = $2,
         reviewed_at = NOW(),
         reviewed_by = $3
     WHERE id = $1
     RETURNING *`,
    [id, newOrg.id, body.reviewed_by || null]
  );

  return c.json({
    data: updated[0],
    created_organization: newOrg,
  });
});

// 政治団体リクエスト却下
adminRouter.put("/organization-requests/:id/reject", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    rejection_reason: string;
    reviewed_by?: string;
  }>();

  if (!body.rejection_reason) {
    return c.json({ error: "rejection_reason is required" }, 400);
  }

  const result = await query<OrganizationRequest>(
    `UPDATE organization_requests
     SET status = 'rejected',
         rejection_reason = $2,
         reviewed_at = NOW(),
         reviewed_by = $3
     WHERE id = $1 AND status IN ('pending', 'needs_info')
     RETURNING *`,
    [id, body.rejection_reason, body.reviewed_by || null]
  );

  if (result.length === 0) {
    return c.json({ error: "Request not found or already processed" }, 404);
  }

  return c.json({ data: result[0] });
});

// ============================================
// 直接登録（管理者用）
// ============================================

// 選挙を直接登録
adminRouter.post("/elections", async (c) => {
  const body = await c.req.json<{
    name: string;
    type: string;
    area_code: string;
    election_date: string;
  }>();

  if (!body.name || !body.type || !body.area_code || !body.election_date) {
    return c.json(
      { error: "name, type, area_code, and election_date are required" },
      400
    );
  }

  const validTypes = ["HR", "HC", "PG", "CM", "GM"];
  if (!validTypes.includes(body.type)) {
    return c.json(
      { error: `type must be one of: ${validTypes.join(", ")}` },
      400
    );
  }

  const electionDate = new Date(body.election_date);
  const dateStr = electionDate.toISOString().split("T")[0].replace(/-/g, "");
  const id = `${body.type}-${body.area_code}-${dateStr}`;

  // 既存チェック
  const existing = await queryOne<Election>(
    "SELECT id FROM elections WHERE id = $1",
    [id]
  );

  if (existing) {
    return c.json({ error: "Election with this ID already exists", id }, 409);
  }

  const result = await query<Election>(
    `INSERT INTO elections (id, name, type, area_code, election_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, body.name, body.type, body.area_code, electionDate]
  );

  return c.json({ data: result[0] }, 201);
});

// 政治団体を直接登録
adminRouter.post("/organizations", async (c) => {
  const body = await c.req.json<{
    name: string;
    type: string;
    politician_id?: string;
  }>();

  if (!body.name || !body.type) {
    return c.json({ error: "name and type are required" }, 400);
  }

  const validTypes = ["political_party", "support_group", "fund_management", "other"];
  if (!validTypes.includes(body.type)) {
    return c.json(
      { error: `type must be one of: ${validTypes.join(", ")}` },
      400
    );
  }

  const result = await query<Organization>(
    `INSERT INTO organizations (name, type, politician_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [body.name, body.type, body.politician_id || null]
  );

  return c.json({ data: result[0] }, 201);
});

// ============================================
// 管理者ユーザー管理
// ============================================

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  is_active: boolean;
  dev_mode: boolean;
  created_at: string;
  updated_at: string;
}

// 管理者一覧取得
adminRouter.get("/users", async (c) => {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("admin_users")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch admin users:", error);
    return c.json({ error: "Failed to fetch admin users" }, 500);
  }

  return c.json({ data });
});

// 管理者詳細取得
adminRouter.get("/users/:id", async (c) => {
  const id = c.req.param("id");
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("admin_users")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return c.json({ error: "Admin user not found" }, 404);
  }

  return c.json({ data });
});

// 管理者招待（Magic Link で新規作成）
adminRouter.post("/users", async (c) => {
  const body = await c.req.json<{
    email: string;
    name?: string;
    role?: string;
  }>();

  if (!body.email) {
    return c.json({ error: "email is required" }, 400);
  }

  const validRoles = ["admin", "super_admin"];
  const role = body.role || "admin";
  if (!validRoles.includes(role)) {
    return c.json({ error: `role must be one of: ${validRoles.join(", ")}` }, 400);
  }

  const supabase = getServiceClient();

  // Supabase Auth でユーザーを招待（Magic Link 送信）
  const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(
    body.email,
    {
      redirectTo: `${Deno.env.get("ADMIN_URL") || "http://localhost:8001"}/auth/callback`,
    }
  );

  if (authError) {
    console.error("Failed to invite user:", authError);
    // 既存ユーザーの場合はエラーメッセージを確認
    if (authError.message.includes("already been registered")) {
      return c.json({ error: "User with this email already exists" }, 409);
    }
    return c.json({ error: "Failed to invite user: " + authError.message }, 500);
  }

  // admin_users テーブルに追加
  const { data: adminUser, error: dbError } = await supabase
    .from("admin_users")
    .insert({
      id: authData.user.id,
      email: body.email,
      name: body.name || null,
      role: role,
      is_active: true,
    })
    .select()
    .single();

  if (dbError) {
    console.error("Failed to create admin user record:", dbError);
    // Auth ユーザーは作成されたが DB 登録に失敗した場合
    return c.json({ error: "User invited but failed to create admin record" }, 500);
  }

  return c.json({
    data: adminUser,
    message: `招待メールを ${body.email} に送信しました`,
  }, 201);
});

// 管理者情報更新
// 注意: メールアドレス変更は OTP 確認付きで Admin UI 側で処理するため、
// この API では name, role, is_active, dev_mode のみ更新可能
adminRouter.put("/users/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    name?: string;
    role?: string;
    is_active?: boolean;
    dev_mode?: boolean;
  }>();

  const supabase = getServiceClient();

  // 更新するフィールドを構築
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.name !== undefined) {
    updates.name = body.name;
  }

  if (body.role !== undefined) {
    const validRoles = ["admin", "super_admin"];
    if (!validRoles.includes(body.role)) {
      return c.json({ error: `role must be one of: ${validRoles.join(", ")}` }, 400);
    }
    updates.role = body.role;
  }

  if (body.is_active !== undefined) {
    updates.is_active = body.is_active;
  }

  if (body.dev_mode !== undefined) {
    updates.dev_mode = body.dev_mode;
  }

  const { data, error } = await supabase
    .from("admin_users")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return c.json({ error: "Admin user not found or update failed" }, 404);
  }

  return c.json({ data });
});

// 管理者削除（論理削除 = is_active を false に）
adminRouter.delete("/users/:id", async (c) => {
  const id = c.req.param("id");
  const supabase = getServiceClient();

  // 論理削除（is_active = false）
  const { data, error } = await supabase
    .from("admin_users")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return c.json({ error: "Admin user not found" }, 404);
  }

  return c.json({ data, message: "Admin user deactivated" });
});

// パスワードリセットメール送信
adminRouter.post("/users/:id/reset-password", async (c) => {
  const id = c.req.param("id");
  const supabase = getServiceClient();

  // ユーザーのメールアドレスを取得
  const { data: adminUser, error: fetchError } = await supabase
    .from("admin_users")
    .select("email")
    .eq("id", id)
    .single();

  if (fetchError || !adminUser) {
    return c.json({ error: "Admin user not found" }, 404);
  }

  // パスワードリセットメールを送信
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(
    adminUser.email,
    {
      redirectTo: `${Deno.env.get("ADMIN_URL") || "http://localhost:8001"}/auth/reset-password`,
    }
  );

  if (resetError) {
    console.error("Failed to send reset email:", resetError);
    return c.json({ error: "Failed to send reset email" }, 500);
  }

  return c.json({ message: `パスワードリセットメールを ${adminUser.email} に送信しました` });
});

// ============================================
// ロック解除リクエスト管理（管理者用）
// ============================================

interface UnlockRequest {
  id: string;
  ledger_id: string;
  ledger_type: string;
  fiscal_year: number | null;
  requested_by_user_id: string;
  requested_by_email: string;
  reason: string;
  status: string;
  approved_at: string | null;
  approved_by: string | null;
  unlock_expires_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

// ロック解除リクエスト一覧（管理者用）
adminRouter.get("/unlock-requests", async (c) => {
  const status = c.req.query("status");
  const supabase = getServiceClient();

  let query = supabase.from("unlock_requests").select("*");

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch unlock requests:", error);
    return c.json({ error: "Failed to fetch unlock requests" }, 500);
  }

  return c.json({ data });
});

// ロック解除リクエスト詳細
adminRouter.get("/unlock-requests/:id", async (c) => {
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

// ロック解除リクエスト承認
adminRouter.put("/unlock-requests/:id/approve", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    approved_by?: string;
    unlock_days?: number; // デフォルト 7 日
  }>();

  const supabase = getServiceClient();

  // リクエストを取得
  const { data: request, error: fetchError } = await supabase
    .from("unlock_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !request) {
    return c.json({ error: "Unlock request not found" }, 404);
  }

  if (request.status !== "pending") {
    return c.json({ error: "Request is already processed" }, 400);
  }

  const now = new Date();
  const unlockDays = body.unlock_days || 7;
  const expiresAt = new Date(now.getTime() + unlockDays * 24 * 60 * 60 * 1000);

  // リクエストを承認
  const { data, error } = await supabase
    .from("unlock_requests")
    .update({
      status: "approved",
      approved_at: now.toISOString(),
      approved_by: body.approved_by || null,
      unlock_expires_at: expiresAt.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Failed to approve unlock request:", error);
    return c.json({ error: "Failed to approve unlock request" }, 500);
  }

  console.log(`[Admin] Unlock request approved: ${id}, expires at ${expiresAt.toISOString()}`);

  return c.json({
    data,
    message: `ロック解除を承認しました。${unlockDays}日間有効です。`,
  });
});

// ロック解除リクエスト却下
adminRouter.put("/unlock-requests/:id/reject", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    rejection_reason: string;
    rejected_by?: string;
  }>();

  if (!body.rejection_reason) {
    return c.json({ error: "rejection_reason is required" }, 400);
  }

  const supabase = getServiceClient();

  // リクエストを取得
  const { data: request, error: fetchError } = await supabase
    .from("unlock_requests")
    .select("status")
    .eq("id", id)
    .single();

  if (fetchError || !request) {
    return c.json({ error: "Unlock request not found" }, 404);
  }

  if (request.status !== "pending") {
    return c.json({ error: "Request is already processed" }, 400);
  }

  const { data, error } = await supabase
    .from("unlock_requests")
    .update({
      status: "rejected",
      rejection_reason: body.rejection_reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Failed to reject unlock request:", error);
    return c.json({ error: "Failed to reject unlock request" }, 500);
  }

  console.log(`[Admin] Unlock request rejected: ${id}`);

  return c.json({ data });
});

// ============================================
// Ledger 登録リクエスト管理（管理者用）
// ============================================

interface RegistrationRequest {
  id: string;
  email: string;
  full_name: string;
  role: string;
  ledger_user_id: string | null;
  ledger_supabase_url: string | null;
  verification_doc_url: string;
  verification_doc_type: string | null;
  verification_doc_name: string | null;
  status: string;
  rejection_reason: string | null;
  notes: string | null;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

// Ledger 登録リクエスト一覧（管理者用）
adminRouter.get("/registration-requests", async (c) => {
  const status = c.req.query("status");
  const supabase = getServiceClient();

  let query = supabase
    .from("registration_requests")
    .select("*", { count: "exact" });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query.order("created_at", {
    ascending: false,
  });

  if (error) {
    console.error("Failed to fetch registration requests:", error);
    return c.json({ error: "Failed to fetch registration requests" }, 500);
  }

  return c.json({ data, total: count });
});

// ============================================
// 政治家認証申請管理（管理者用）【v2 追加】
// ============================================

interface PoliticianVerification {
  id: string;
  ledger_user_id: string;
  politician_id: string | null;
  name: string;
  official_email: string;
  official_url: string | null;
  party: string | null;
  email_verified: boolean;
  email_verification_code: string | null;
  email_verification_sent_at: string | null;
  status: string;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

// 政治家認証申請一覧（管理者用）
adminRouter.get("/politician-verifications", async (c) => {
  const status = c.req.query("status");
  const supabase = getServiceClient();

  let query = supabase
    .from("politician_verifications")
    .select("*", { count: "exact" });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query.order("created_at", {
    ascending: false,
  });

  if (error) {
    console.error("Failed to fetch politician verifications:", error);
    return c.json({ error: "Failed to fetch politician verifications" }, 500);
  }

  return c.json({ data, total: count });
});

// 政治家認証申請詳細
adminRouter.get("/politician-verifications/:id", async (c) => {
  const id = c.req.param("id");
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("politician_verifications")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return c.json({ error: "Politician verification not found" }, 404);
  }

  return c.json({ data });
});

// 政治家認証申請承認
adminRouter.put("/politician-verifications/:id/approve", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    reviewed_by?: string;
  }>();

  const supabase = getServiceClient();

  // 申請を取得
  const { data: verification, error: fetchError } = await supabase
    .from("politician_verifications")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !verification) {
    return c.json({ error: "Politician verification not found" }, 404);
  }

  // メール認証またはDNS TXT認証が完了している必要がある
  if (verification.status !== "email_verified" && verification.status !== "dns_verified") {
    return c.json({ error: "認証が完了していない申請は承認できません" }, 400);
  }

  const now = new Date().toISOString();
  const emailDomain = verification.official_email.split("@")[1];

  // politician_id が指定されている場合は既存の政治家を更新
  // そうでない場合は新規作成
  let politicianId = verification.politician_id;

  if (politicianId) {
    // 既存の政治家を更新
    // ドメイン変更の場合は official_url を空にする（ドメインが変わるため）
    const updateData: Record<string, unknown> = {
      ledger_user_id: verification.ledger_user_id,
      party: verification.party,
      is_verified: true,
      verified_at: now,
      verified_domain: emailDomain,
      is_lg_verified: verification.is_lg_domain || false,
      updated_at: now,
    };

    if (verification.request_type === "domain_change") {
      // ドメイン変更時は公式URLをクリア
      updateData.official_url = null;
    } else {
      updateData.official_url = verification.official_url;
    }

    const { error: updatePoliticianError } = await supabase
      .from("politicians")
      .update(updateData)
      .eq("id", politicianId);

    if (updatePoliticianError) {
      console.error("Failed to update politician:", updatePoliticianError);
      return c.json({ error: "Failed to update politician" }, 500);
    }
  } else {
    // 新規政治家を作成
    const { data: newPolitician, error: createError } = await supabase
      .from("politicians")
      .insert({
        name: verification.politician_name,
        ledger_user_id: verification.ledger_user_id,
        official_url: verification.official_url,
        party: verification.party,
        is_verified: true,
        verified_at: now,
        verified_domain: emailDomain,
        is_lg_verified: verification.is_lg_domain || false,
      })
      .select()
      .single();

    if (createError) {
      console.error("Failed to create politician:", createError);
      return c.json({ error: "Failed to create politician" }, 500);
    }

    politicianId = newPolitician.id;
  }

  // 申請を承認済みに更新
  const { data, error } = await supabase
    .from("politician_verifications")
    .update({
      approved_politician_id: politicianId,
      status: "approved",
      reviewed_by: body.reviewed_by || null,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Failed to approve politician verification:", error);
    return c.json({ error: "Failed to approve politician verification" }, 500);
  }

  console.log(`[Admin] Politician verification approved: ${id}, politician_id: ${politicianId}`);

  return c.json({
    data,
    politician_id: politicianId,
    message: "政治家認証を承認しました",
  });
});

// 政治家認証申請却下
adminRouter.put("/politician-verifications/:id/reject", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    rejection_reason: string;
    reviewed_by?: string;
  }>();

  if (!body.rejection_reason) {
    return c.json({ error: "rejection_reason is required" }, 400);
  }

  const supabase = getServiceClient();

  // 申請を取得
  const { data: verification, error: fetchError } = await supabase
    .from("politician_verifications")
    .select("status")
    .eq("id", id)
    .single();

  if (fetchError || !verification) {
    return c.json({ error: "Politician verification not found" }, 404);
  }

  if (verification.status === "approved" || verification.status === "rejected") {
    return c.json({ error: "この申請はすでに処理されています" }, 400);
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("politician_verifications")
    .update({
      status: "rejected",
      rejection_reason: body.rejection_reason,
      reviewed_by: body.reviewed_by || null,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Failed to reject politician verification:", error);
    return c.json({ error: "Failed to reject politician verification" }, 500);
  }

  console.log(`[Admin] Politician verification rejected: ${id}`);

  return c.json({ data });
});

// ============================================
// 政治団体管理者認証申請管理（管理者用）【v2 追加】
// ============================================

interface OrganizationManagerVerification {
  id: string;
  ledger_user_id: string;
  organization_id: string | null;
  organization_name: string;
  official_email: string;
  role_in_organization: string | null;
  email_verified: boolean;
  status: string;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

// 政治団体管理者認証申請一覧（管理者用）
adminRouter.get("/organization-manager-verifications", async (c) => {
  const status = c.req.query("status");
  const supabase = getServiceClient();

  let query = supabase
    .from("organization_manager_verifications")
    .select("*", { count: "exact" });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query.order("created_at", {
    ascending: false,
  });

  if (error) {
    console.error("Failed to fetch organization manager verifications:", error);
    return c.json({ error: "Failed to fetch organization manager verifications" }, 500);
  }

  return c.json({ data, total: count });
});

// 政治団体管理者認証申請承認
adminRouter.put("/organization-manager-verifications/:id/approve", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    reviewed_by?: string;
  }>();

  const supabase = getServiceClient();

  // 申請を取得
  const { data: verification, error: fetchError } = await supabase
    .from("organization_manager_verifications")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !verification) {
    return c.json({ error: "Organization manager verification not found" }, 404);
  }

  // メール認証またはDNS TXT認証が完了している必要がある
  if (verification.status !== "email_verified" && verification.status !== "dns_verified") {
    return c.json({ error: "認証が完了していない申請は承認できません" }, 400);
  }

  const now = new Date().toISOString();
  const emailDomain = verification.official_email.split("@")[1];

  // organization_id が指定されていない場合は新規作成
  let organizationId = verification.organization_id;

  if (!organizationId) {
    // 新規政治団体を作成（認証済みで作成）
    const { data: newOrg, error: createError } = await supabase
      .from("organizations")
      .insert({
        name: verification.organization_name,
        type: verification.organization_type || "other",
        official_url: null,
        is_verified: true,
        verified_at: now,
        is_lg_verified: verification.is_lg_domain || false,
      })
      .select()
      .single();

    if (createError) {
      console.error("Failed to create organization:", createError);
      return c.json({ error: "Failed to create organization" }, 500);
    }

    organizationId = newOrg.id;
  } else {
    // 既存の政治団体を認証済みに更新
    // ドメイン変更の場合は official_url を空にする
    const updateData: Record<string, unknown> = {
      is_verified: true,
      verified_at: now,
      is_lg_verified: verification.is_lg_domain || false,
      updated_at: now,
    };

    if (verification.request_type === "domain_change") {
      updateData.official_url = null;
    }

    const { error: updateOrgError } = await supabase
      .from("organizations")
      .update(updateData)
      .eq("id", organizationId);

    if (updateOrgError) {
      console.error("Failed to update organization verification:", updateOrgError);
      return c.json({ error: "Failed to update organization verification" }, 500);
    }
  }

  // organization_managers に追加
  const { error: managerError } = await supabase
    .from("organization_managers")
    .upsert({
      ledger_user_id: verification.ledger_user_id,
      organization_id: organizationId,
      verified_at: now,
      verified_domain: emailDomain,
      verified_email: verification.official_email,
    });

  if (managerError) {
    console.error("Failed to add organization manager:", managerError);
    return c.json({ error: "Failed to add organization manager" }, 500);
  }

  // 申請を承認済みに更新
  const { data, error } = await supabase
    .from("organization_manager_verifications")
    .update({
      organization_id: organizationId,
      status: "approved",
      reviewed_by: body.reviewed_by || null,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Failed to approve organization manager verification:", error);
    return c.json({ error: "Failed to approve organization manager verification" }, 500);
  }

  console.log(`[Admin] Organization manager verification approved: ${id}, organization_id: ${organizationId}`);

  return c.json({
    data,
    organization_id: organizationId,
    message: "政治団体管理者認証を承認しました",
  });
});

// 政治団体管理者認証申請却下
adminRouter.put("/organization-manager-verifications/:id/reject", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    rejection_reason: string;
    reviewed_by?: string;
  }>();

  if (!body.rejection_reason) {
    return c.json({ error: "rejection_reason is required" }, 400);
  }

  const supabase = getServiceClient();

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("organization_manager_verifications")
    .update({
      status: "rejected",
      rejection_reason: body.rejection_reason,
      reviewed_by: body.reviewed_by || null,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .eq("status", "email_verified")
    .select()
    .single();

  if (error) {
    console.error("Failed to reject organization manager verification:", error);
    return c.json({ error: "Verification not found or already processed" }, 404);
  }

  console.log(`[Admin] Organization manager verification rejected: ${id}`);

  return c.json({ data });
});

// ============================================
// なりすまし通報管理（管理者用）【v2 追加】
// ============================================

// なりすまし通報一覧（管理者用）
adminRouter.get("/impersonation-reports", async (c) => {
  const status = c.req.query("status");
  const supabase = getServiceClient();

  let query = supabase
    .from("impersonation_reports")
    .select("*", { count: "exact" });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query.order("created_at", {
    ascending: false,
  });

  if (error) {
    console.error("Failed to fetch impersonation reports:", error);
    return c.json({ error: "Failed to fetch impersonation reports" }, 500);
  }

  return c.json({ data, total: count });
});

// なりすまし通報詳細
adminRouter.get("/impersonation-reports/:id", async (c) => {
  const id = c.req.param("id");
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("impersonation_reports")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return c.json({ error: "Impersonation report not found" }, 404);
  }

  return c.json({ data });
});

// なりすまし通報対応完了
adminRouter.put("/impersonation-reports/:id/resolve", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    resolution_notes: string;
    reviewed_by?: string;
  }>();

  if (!body.resolution_notes) {
    return c.json({ error: "resolution_notes is required" }, 400);
  }

  const supabase = getServiceClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("impersonation_reports")
    .update({
      status: "resolved",
      resolution_notes: body.resolution_notes,
      reviewed_by: body.reviewed_by || null,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select()
    .single();

  if (error) {
    console.error("Failed to resolve impersonation report:", error);
    return c.json({ error: "Report not found or already processed" }, 404);
  }

  console.log(`[Admin] Impersonation report resolved: ${id}`);

  return c.json({ data });
});

