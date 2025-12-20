import { Hono } from "hono";
import { query, queryOne } from "../db/client.ts";

export const politiciansRouter = new Hono();

interface Politician {
  id: string;
  name: string;
  name_kana: string | null;
  ledger_user_id: string | null;
  official_url: string | null;
  party: string | null;
  photo_url: string | null;
  is_verified: boolean;
  verified_at: Date | null;
  verified_domain: string | null;
  is_test: boolean;
  created_at: Date;
  updated_at: Date;
}

// 政治家一覧取得
politiciansRouter.get("/", async (c) => {
  const isTestMode = c.get("isTestMode") as boolean;

  const politicians = await query<Politician>(
    `SELECT * FROM politicians 
     WHERE COALESCE(is_test, false) = $1 
     ORDER BY created_at DESC`,
    [isTestMode]
  );
  return c.json({ data: politicians });
});

// 政治家取得
politiciansRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const isTestMode = c.get("isTestMode") as boolean;

  const politician = await queryOne<Politician>(
    `SELECT * FROM politicians WHERE id = $1 AND COALESCE(is_test, false) = $2`,
    [id, isTestMode]
  );

  if (!politician) {
    return c.json({ error: "Politician not found" }, 404);
  }

  return c.json({ data: politician });
});

// 政治家 ID 発行
politiciansRouter.post("/", async (c) => {
  const body = await c.req.json<{ name: string; name_kana?: string }>();
  const isTestMode = c.get("isTestMode") as boolean;

  if (!body.name) {
    return c.json({ error: "name is required" }, 400);
  }

  const result = await query<Politician>(
    `INSERT INTO politicians (name, name_kana, is_test) 
     VALUES ($1, $2, $3) 
     RETURNING *`,
    [body.name, body.name_kana || null, isTestMode]
  );

  return c.json({ data: result[0] }, 201);
});

// 政治家更新
politiciansRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    name?: string;
    name_kana?: string;
    official_url?: string;
    party?: string;
    photo_url?: string;
  }>();
  const isTestMode = c.get("isTestMode") as boolean;

  const result = await query<Politician>(
    `UPDATE politicians 
     SET name = COALESCE($2, name),
         name_kana = COALESCE($3, name_kana),
         official_url = COALESCE($4, official_url),
         party = COALESCE($5, party),
         photo_url = COALESCE($6, photo_url),
         updated_at = NOW()
     WHERE id = $1 AND COALESCE(is_test, false) = $7
     RETURNING *`,
    [
      id,
      body.name,
      body.name_kana,
      body.official_url,
      body.party,
      body.photo_url,
      isTestMode,
    ]
  );

  if (result.length === 0) {
    return c.json({ error: "Politician not found" }, 404);
  }

  return c.json({ data: result[0] });
});
