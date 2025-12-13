import { Hono } from "hono";
import { query, queryOne } from "../db/client.ts";

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

