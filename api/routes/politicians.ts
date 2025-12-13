import { Hono } from "hono";
import { query, queryOne } from "../db/client.ts";
import { createTableHelper } from "../db/schema.ts";

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
  const apiKey = c.req.header("X-API-Key");
  const tables = createTableHelper(apiKey);

  const politicians = await query<Politician>(
    `SELECT * FROM ${tables.politicians} ORDER BY created_at DESC`
  );
  return c.json({ data: politicians });
});

// 政治家取得
politiciansRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const apiKey = c.req.header("X-API-Key");
  const tables = createTableHelper(apiKey);

  const politician = await queryOne<Politician>(
    `SELECT * FROM ${tables.politicians} WHERE id = @id`,
    { id }
  );

  if (!politician) {
    return c.json({ error: "Politician not found" }, 404);
  }

  return c.json({ data: politician });
});

// 政治家 ID 発行
politiciansRouter.post("/", async (c) => {
  const body = await c.req.json<{ name: string; name_kana?: string }>();
  const apiKey = c.req.header("X-API-Key");
  const tables = createTableHelper(apiKey);

  if (!body.name) {
    return c.json({ error: "name is required" }, 400);
  }

  const result = await query<Politician>(
    `INSERT INTO ${tables.politicians} (name, name_kana) 
     OUTPUT INSERTED.*
     VALUES (@name, @name_kana)`,
    { name: body.name, name_kana: body.name_kana || null }
  );

  return c.json({ data: result[0] }, 201);
});

// 政治家更新
politiciansRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ name?: string; name_kana?: string }>();
  const apiKey = c.req.header("X-API-Key");
  const tables = createTableHelper(apiKey);

  const result = await query<Politician>(
    `UPDATE ${tables.politicians} 
     SET name = COALESCE(@name, name),
         name_kana = COALESCE(@name_kana, name_kana),
         updated_at = GETUTCDATE()
     OUTPUT INSERTED.*
     WHERE id = @id`,
    { id, name: body.name || null, name_kana: body.name_kana || null }
  );

  if (result.length === 0) {
    return c.json({ error: "Politician not found" }, 404);
  }

  return c.json({ data: result[0] });
});
