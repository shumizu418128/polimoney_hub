import { Hono } from "hono";
import { query, queryOne } from "../db/client.ts";

export const electionsRouter = new Hono();

interface Election {
  id: string; // 例: HR-13-01-20241027
  name: string;
  type: string; // HR, HC, PG, CM, GM
  area_code: string; // 都道府県コード(2桁) + 選挙区番号(2桁)
  election_date: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * 選挙 ID を生成
 * 形式: {type}-{area_code}-{date}
 * 例: HR-13-01-20241027
 */
function generateElectionId(
  type: string,
  areaCode: string,
  electionDate: Date
): string {
  const dateStr = electionDate
    .toISOString()
    .split("T")[0]
    .replace(/-/g, "");
  return `${type}-${areaCode}-${dateStr}`;
}

// 選挙一覧取得
electionsRouter.get("/", async (c) => {
  const type = c.req.query("type");
  const year = c.req.query("year");
  const isTestMode = c.get("isTestMode") as boolean;

  let sql = "SELECT * FROM elections WHERE COALESCE(is_test, false) = $1";
  const args: unknown[] = [isTestMode];
  let argIndex = 2;

  if (type) {
    sql += ` AND type = $${argIndex++}`;
    args.push(type);
  }

  if (year) {
    sql += ` AND EXTRACT(YEAR FROM election_date) = $${argIndex++}`;
    args.push(parseInt(year));
  }

  sql += " ORDER BY election_date DESC";

  const elections = await query<Election>(sql, args);
  return c.json({ data: elections });
});

// 選挙取得
electionsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const isTestMode = c.get("isTestMode") as boolean;

  const election = await queryOne<Election>(
    "SELECT * FROM elections WHERE id = $1 AND COALESCE(is_test, false) = $2",
    [id, isTestMode]
  );

  if (!election) {
    return c.json({ error: "Election not found" }, 404);
  }

  return c.json({ data: election });
});

// 選挙 ID 発行
electionsRouter.post("/", async (c) => {
  const body = await c.req.json<{
    name: string;
    type: string;
    area_code: string;
    election_date: string; // ISO 8601 形式
  }>();

  if (!body.name || !body.type || !body.area_code || !body.election_date) {
    return c.json(
      { error: "name, type, area_code, and election_date are required" },
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

  const electionDate = new Date(body.election_date);
  const id = generateElectionId(body.type, body.area_code, electionDate);

  // 既存チェック
  const existing = await queryOne<Election>(
    "SELECT id FROM elections WHERE id = $1",
    [id]
  );

  if (existing) {
    return c.json({ error: "Election with this ID already exists", id }, 409);
  }

  const isTestMode = c.get("isTestMode") as boolean;

  const result = await query<Election>(
    `INSERT INTO elections (id, name, type, area_code, election_date, is_test) 
     VALUES ($1, $2, $3, $4, $5, $6) 
     RETURNING *`,
    [id, body.name, body.type, body.area_code, electionDate, isTestMode]
  );

  return c.json({ data: result[0] }, 201);
});

// 選挙更新
electionsRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ name?: string }>();
  const isTestMode = c.get("isTestMode") as boolean;

  // 選挙 ID は不変（type, area_code, date から生成されるため）
  // 更新可能なのは name のみ

  const result = await query<Election>(
    `UPDATE elections 
     SET name = COALESCE($2, name),
         updated_at = NOW()
     WHERE id = $1 AND COALESCE(is_test, false) = $3
     RETURNING *`,
    [id, body.name, isTestMode]
  );

  if (result.length === 0) {
    return c.json({ error: "Election not found" }, 404);
  }

  return c.json({ data: result[0] });
});

