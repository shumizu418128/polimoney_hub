import { Hono } from "hono";
import { query, queryOne } from "../db/client.ts";

export const electionRequestsRouter = new Hono();

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

// リクエスト一覧取得（自分のリクエストのみ）
electionRequestsRouter.get("/", async (c) => {
  const politicianId = c.req.query("politician_id");
  const status = c.req.query("status");

  let sql = "SELECT * FROM election_requests WHERE 1=1";
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

  const requests = await query<ElectionRequest>(sql, args);
  return c.json({ data: requests });
});

// リクエスト詳細取得
electionRequestsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const request = await queryOne<ElectionRequest>(
    "SELECT * FROM election_requests WHERE id = $1",
    [id]
  );

  if (!request) {
    return c.json({ error: "Election request not found" }, 404);
  }

  return c.json({ data: request });
});

// リクエスト作成
electionRequestsRouter.post("/", async (c) => {
  const body = await c.req.json<{
    name: string;
    type: string;
    area_description: string;
    election_date: string;
    requested_by_politician_id?: string;
    requested_by_email?: string;
    evidence_url?: string;
    notes?: string;
  }>();

  // バリデーション
  if (!body.name || !body.type || !body.area_description || !body.election_date) {
    return c.json(
      { error: "name, type, area_description, and election_date are required" },
      400
    );
  }

  // 選挙タイプのバリデーション
  const validTypes = ["HR", "HC", "PG", "CM", "GM"];
  if (!validTypes.includes(body.type)) {
    return c.json(
      { error: `type must be one of: ${validTypes.join(", ")}` },
      400
    );
  }

  const result = await query<ElectionRequest>(
    `INSERT INTO election_requests (
      name, type, area_description, election_date,
      requested_by_politician_id, requested_by_email,
      evidence_url, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      body.name,
      body.type,
      body.area_description,
      new Date(body.election_date),
      body.requested_by_politician_id || null,
      body.requested_by_email || null,
      body.evidence_url || null,
      body.notes || null,
    ]
  );

  return c.json({ data: result[0] }, 201);
});

