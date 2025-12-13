import { Hono } from "hono";
import { query, queryOne } from "../db/client.ts";

export const organizationRequestsRouter = new Hono();

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

// リクエスト一覧取得（自分のリクエストのみ）
organizationRequestsRouter.get("/", async (c) => {
  const politicianId = c.req.query("politician_id");
  const status = c.req.query("status");

  let sql = "SELECT * FROM organization_requests WHERE 1=1";
  const args: unknown[] = [];
  let argIndex = 1;

  if (politicianId) {
    sql += ` AND requested_by_politician_id = $${argIndex++}`;
    args.push(politicianId);
  }

  if (status) {
    sql += ` AND status = $${argIndex++}`;
    args.push(status);
  }

  sql += " ORDER BY created_at DESC";

  const requests = await query<OrganizationRequest>(sql, args);
  return c.json({ data: requests });
});

// リクエスト詳細取得
organizationRequestsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const request = await queryOne<OrganizationRequest>(
    "SELECT * FROM organization_requests WHERE id = $1",
    [id]
  );

  if (!request) {
    return c.json({ error: "Organization request not found" }, 404);
  }

  return c.json({ data: request });
});

// リクエスト作成
organizationRequestsRouter.post("/", async (c) => {
  const body = await c.req.json<{
    name: string;
    type: string;
    registration_authority?: string;
    requested_by_politician_id?: string;
    requested_by_email?: string;
    evidence_type: string;
    evidence_file_url: string;
    evidence_file_name?: string;
    notes?: string;
  }>();

  // バリデーション
  if (!body.name || !body.type || !body.evidence_type || !body.evidence_file_url) {
    return c.json(
      { error: "name, type, evidence_type, and evidence_file_url are required" },
      400
    );
  }

  // 団体タイプのバリデーション
  const validTypes = ["political_party", "support_group", "fund_management", "other"];
  if (!validTypes.includes(body.type)) {
    return c.json(
      { error: `type must be one of: ${validTypes.join(", ")}` },
      400
    );
  }

  // 証明書タイプのバリデーション
  const validEvidenceTypes = ["registration_form", "name_list", "financial_report"];
  if (!validEvidenceTypes.includes(body.evidence_type)) {
    return c.json(
      { error: `evidence_type must be one of: ${validEvidenceTypes.join(", ")}` },
      400
    );
  }

  const result = await query<OrganizationRequest>(
    `INSERT INTO organization_requests (
      name, type, registration_authority,
      requested_by_politician_id, requested_by_email,
      evidence_type, evidence_file_url, evidence_file_name, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      body.name,
      body.type,
      body.registration_authority || null,
      body.requested_by_politician_id || null,
      body.requested_by_email || null,
      body.evidence_type,
      body.evidence_file_url,
      body.evidence_file_name || null,
      body.notes || null,
    ]
  );

  return c.json({ data: result[0] }, 201);
});

