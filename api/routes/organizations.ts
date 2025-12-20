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
  const isTestMode = c.get("isTestMode") as boolean;

  let sql = "SELECT * FROM organizations WHERE COALESCE(is_test, false) = $1";
  const args: unknown[] = [isTestMode];

  if (politicianId) {
    sql += " AND politician_id = $2";
    args.push(politicianId);
  }

  sql += " ORDER BY created_at DESC";

  const organizations = await query<Organization>(sql, args);
  return c.json({ data: organizations });
});

// 政治団体取得
organizationsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const isTestMode = c.get("isTestMode") as boolean;

  const organization = await queryOne<Organization>(
    "SELECT * FROM organizations WHERE id = $1 AND COALESCE(is_test, false) = $2",
    [id, isTestMode]
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
  const isTestMode = c.get("isTestMode") as boolean;

  if (!body.name || !body.type) {
    return c.json({ error: "name and type are required" }, 400);
  }

  const result = await query<Organization>(
    `INSERT INTO organizations (name, type, politician_id, is_test) 
     VALUES ($1, $2, $3, $4) 
     RETURNING *`,
    [body.name, body.type, body.politician_id || null, isTestMode]
  );

  return c.json({ data: result[0] }, 201);
});

// 管理している政治団体一覧取得（ledger_user_id で検索）
organizationsRouter.get("/managed", async (c) => {
  const ledgerUserId = c.req.query("ledger_user_id");
  const isTestMode = c.get("isTestMode") as boolean;

  if (!ledgerUserId) {
    return c.json({ error: "ledger_user_id is required" }, 400);
  }

  // organization_managers テーブルから管理団体を取得
  // API キーに応じて is_test フィルタリング
  const managedOrganizations = await query<{
    id: string;
    name: string;
    type: string;
    politician_id: string | null;
    official_url: string | null;
    registration_authority: string | null;
    established_date: string | null;
    office_address: string | null;
    representative_name: string | null;
    accountant_name: string | null;
    contact_email: string | null;
    description: string | null;
    sns_x: string | null;
    sns_instagram: string | null;
    sns_facebook: string | null;
    sns_tiktok: string | null;
    logo_url: string | null;
    is_verified: boolean;
    is_test: boolean;
    manager_verified_at: Date;
    manager_verified_domain: string;
  }>(
    `SELECT o.*, 
            om.verified_at as manager_verified_at, 
            om.verified_domain as manager_verified_domain
     FROM organizations o
     INNER JOIN organization_managers om ON o.id = om.organization_id
     WHERE om.ledger_user_id = $1 
       AND om.is_active = true
       AND COALESCE(o.is_test, false) = $2
     ORDER BY o.name`,
    [ledgerUserId, isTestMode]
  );

  return c.json({ data: managedOrganizations });
});

// 政治団体更新
organizationsRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  const isTestMode = c.get("isTestMode") as boolean;
  const body = await c.req.json<{
    name?: string;
    type?: string;
    politician_id?: string;
    official_url?: string;
    registration_authority?: string;
    established_date?: string;
    office_address?: string;
    representative_name?: string;
    accountant_name?: string;
    contact_email?: string;
    description?: string;
    sns_x?: string;
    sns_instagram?: string;
    sns_facebook?: string;
    sns_tiktok?: string;
    logo_url?: string;
  }>();

  const result = await query<Organization>(
    `UPDATE organizations 
     SET name = COALESCE($2, name),
         type = COALESCE($3, type),
         politician_id = COALESCE($4, politician_id),
         official_url = COALESCE($5, official_url),
         registration_authority = COALESCE($6, registration_authority),
         established_date = COALESCE($7, established_date),
         office_address = COALESCE($8, office_address),
         representative_name = COALESCE($9, representative_name),
         accountant_name = COALESCE($10, accountant_name),
         contact_email = COALESCE($11, contact_email),
         description = COALESCE($12, description),
         sns_x = COALESCE($13, sns_x),
         sns_instagram = COALESCE($14, sns_instagram),
         sns_facebook = COALESCE($15, sns_facebook),
         sns_tiktok = COALESCE($16, sns_tiktok),
         logo_url = COALESCE($17, logo_url),
         updated_at = NOW()
     WHERE id = $1 AND COALESCE(is_test, false) = $18
     RETURNING *`,
    [
      id,
      body.name,
      body.type,
      body.politician_id,
      body.official_url,
      body.registration_authority,
      body.established_date,
      body.office_address,
      body.representative_name,
      body.accountant_name,
      body.contact_email,
      body.description,
      body.sns_x,
      body.sns_instagram,
      body.sns_facebook,
      body.sns_tiktok,
      body.logo_url,
      isTestMode,
    ]
  );

  if (result.length === 0) {
    return c.json({ error: "Organization not found" }, 404);
  }

  return c.json({ data: result[0] });
});

