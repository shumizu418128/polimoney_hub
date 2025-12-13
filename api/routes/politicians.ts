import { Hono } from "hono";
import { query, queryOne, execute } from "../db/client.ts";

export const politiciansRouter = new Hono();

interface Politician {
  id: string;
  name: string;
  name_kana: string | null;
  created_at: Date;
  updated_at: Date;
}

// 政治家一覧取得
politiciansRouter.get("/", async (c) => {
  const politicians = await query<Politician>(
    "SELECT * FROM politicians ORDER BY created_at DESC"
  );
  return c.json({ data: politicians });
});

// 政治家取得
politiciansRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const politician = await queryOne<Politician>(
    "SELECT * FROM politicians WHERE id = $1",
    [id]
  );

  if (!politician) {
    return c.json({ error: "Politician not found" }, 404);
  }

  return c.json({ data: politician });
});

// 政治家 ID 発行
politiciansRouter.post("/", async (c) => {
  const body = await c.req.json<{ name: string; name_kana?: string }>();

  if (!body.name) {
    return c.json({ error: "name is required" }, 400);
  }

  const result = await query<Politician>(
    `INSERT INTO politicians (name, name_kana) 
     VALUES ($1, $2) 
     RETURNING *`,
    [body.name, body.name_kana || null]
  );

  return c.json({ data: result[0] }, 201);
});

// 政治家更新
politiciansRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ name?: string; name_kana?: string }>();

  const result = await query<Politician>(
    `UPDATE politicians 
     SET name = COALESCE($2, name),
         name_kana = COALESCE($3, name_kana),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, body.name, body.name_kana]
  );

  if (result.length === 0) {
    return c.json({ error: "Politician not found" }, 404);
  }

  return c.json({ data: result[0] });
});

