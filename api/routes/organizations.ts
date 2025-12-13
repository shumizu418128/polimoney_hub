import { Hono } from "hono";
import { query, queryOne } from "../db/client.ts";

export const organizationsRouter = new Hono();

interface Organization {
  id: string;
  name: string;
  type: string; // 'political_party' | 'support_group' | 'other'
  politician_id: string | null;
  created_at: Date;
  updated_at: Date;
}

// 政治団体一覧取得
organizationsRouter.get("/", async (c) => {
  const politicianId = c.req.query("politician_id");

  let sql = "SELECT * FROM organizations";
  const args: unknown[] = [];

  if (politicianId) {
    sql += " WHERE politician_id = $1";
    args.push(politicianId);
  }

  sql += " ORDER BY created_at DESC";

  const organizations = await query<Organization>(sql, args);
  return c.json({ data: organizations });
});

// 政治団体取得
organizationsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const organization = await queryOne<Organization>(
    "SELECT * FROM organizations WHERE id = $1",
    [id]
  );

  if (!organization) {
    return c.json({ error: "Organization not found" }, 404);
  }

  return c.json({ data: organization });
});

// 政治団体 ID 発行
organizationsRouter.post("/", async (c) => {
  const body = await c.req.json<{
    name: string;
    type: string;
    politician_id?: string;
  }>();

  if (!body.name || !body.type) {
    return c.json({ error: "name and type are required" }, 400);
  }

  const result = await query<Organization>(
    `INSERT INTO organizations (name, type, politician_id) 
     VALUES ($1, $2, $3) 
     RETURNING *`,
    [body.name, body.type, body.politician_id || null]
  );

  return c.json({ data: result[0] }, 201);
});

// 政治団体更新
organizationsRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    name?: string;
    type?: string;
    politician_id?: string;
  }>();

  const result = await query<Organization>(
    `UPDATE organizations 
     SET name = COALESCE($2, name),
         type = COALESCE($3, type),
         politician_id = COALESCE($4, politician_id),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, body.name, body.type, body.politician_id]
  );

  if (result.length === 0) {
    return c.json({ error: "Organization not found" }, 404);
  }

  return c.json({ data: result[0] });
});

