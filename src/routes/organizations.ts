import { Hono } from "hono";
import { getServiceClient } from "../lib/supabase.ts";

export const organizationsRouter = new Hono();

interface Organization {
  id: string;
  name: string;
  type: string;
  politician_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 政治団体一覧取得
organizationsRouter.get("/", async (c) => {
  const politicianId = c.req.query("politician_id");

  const supabase = getServiceClient();
  let query = supabase.from("organizations").select("*");

  if (politicianId) {
    query = query.eq("politician_id", politicianId);
  }

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data });
});

// 【v2.1 更新】Ledgerユーザーが管理している政治団体一覧を取得（詳細情報含む）
// 注意: /:id より前に定義する必要がある（/managed が /:id にマッチしないように）
organizationsRouter.get("/managed", async (c) => {
  const ledgerUserId = c.req.query("ledger_user_id");
  const isTestMode = c.get("isTestMode") as boolean;

  if (!ledgerUserId) {
    return c.json({ error: "ledger_user_id is required" }, 400);
  }

  const supabase = getServiceClient();

  // organization_managers テーブルから、このユーザーが管理している政治団体を取得
  // is_test フィルタリング: DEV キー → is_test=true、PROD キー → is_test=false/null
  let query = supabase
    .from("organization_managers")
    .select(`
      organization_id,
      verified_at,
      verified_domain,
      is_test,
      organizations (
        id,
        name,
        type,
        official_url,
        registration_authority,
        established_date,
        office_address,
        representative_name,
        accountant_name,
        contact_email,
        description,
        sns_x,
        sns_instagram,
        sns_facebook,
        sns_tiktok,
        logo_url,
        is_verified,
        is_active,
        is_test,
        created_at,
        updated_at
      )
    `)
    .eq("ledger_user_id", ledgerUserId)
    .eq("is_active", true);

  // is_test フィルタリング
  if (isTestMode) {
    query = query.eq("is_test", true);
  } else {
    query = query.or("is_test.is.null,is_test.eq.false");
  }

  const { data: managers, error: managerError } = await query;

  if (managerError) {
    console.error("Failed to fetch managed organizations:", managerError);
    return c.json({ error: managerError.message }, 500);
  }

  // レスポンスを整形（organizations の is_test もフィルタ）
  // deno-lint-ignore no-explicit-any
  const data = managers?.filter((m: any) => {
    const orgIsTest = m.organizations?.is_test;
    if (isTestMode) {
      return orgIsTest === true;
    } else {
      return orgIsTest === null || orgIsTest === false;
    }
  }).map((m: any) => ({
    ...m.organizations,
    manager_verified_at: m.verified_at,
    manager_verified_domain: m.verified_domain,
  })) || [];

  return c.json({ data });
});

// 政治団体取得
organizationsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Organization not found" }, 404);
    }
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data });
});

// 政治団体作成
organizationsRouter.post("/", async (c) => {
  const body = await c.req.json<{
    name: string;
    type: string;
    politician_id?: string;
  }>();

  if (!body.name || !body.type) {
    return c.json({ error: "name and type are required" }, 400);
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("organizations")
    .insert({
      name: body.name,
      type: body.type,
      politician_id: body.politician_id || null,
    })
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data }, 201);
});

// 政治団体更新（v2.1: 詳細情報・SNS対応, v2.2: ロゴ追加）
organizationsRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    name?: string;
    type?: string;
    politician_id?: string;
    // 基本情報
    official_url?: string | null;
    registration_authority?: string | null;
    established_date?: string | null;
    office_address?: string | null;
    representative_name?: string | null;
    accountant_name?: string | null;
    contact_email?: string | null;
    description?: string | null;
    // SNS
    sns_x?: string | null;
    sns_instagram?: string | null;
    sns_facebook?: string | null;
    sns_tiktok?: string | null;
    // ロゴ（v2.2）
    logo_url?: string | null;
  }>();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  // 基本項目
  if (body.name !== undefined) updateData.name = body.name;
  if (body.type !== undefined) updateData.type = body.type;
  if (body.politician_id !== undefined) updateData.politician_id = body.politician_id;
  
  // 詳細情報
  if (body.official_url !== undefined) updateData.official_url = body.official_url;
  if (body.registration_authority !== undefined) updateData.registration_authority = body.registration_authority;
  if (body.established_date !== undefined) updateData.established_date = body.established_date;
  if (body.office_address !== undefined) updateData.office_address = body.office_address;
  if (body.representative_name !== undefined) updateData.representative_name = body.representative_name;
  if (body.accountant_name !== undefined) updateData.accountant_name = body.accountant_name;
  if (body.contact_email !== undefined) updateData.contact_email = body.contact_email;
  if (body.description !== undefined) updateData.description = body.description;
  
  // SNS
  if (body.sns_x !== undefined) updateData.sns_x = body.sns_x;
  if (body.sns_instagram !== undefined) updateData.sns_instagram = body.sns_instagram;
  if (body.sns_facebook !== undefined) updateData.sns_facebook = body.sns_facebook;
  if (body.sns_tiktok !== undefined) updateData.sns_tiktok = body.sns_tiktok;
  
  // ロゴ
  if (body.logo_url !== undefined) updateData.logo_url = body.logo_url;

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("organizations")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Organization not found" }, 404);
    }
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data });
});
