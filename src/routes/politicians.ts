import { Hono } from "hono";
import { getServiceClient } from "../lib/supabase.ts";

export const politiciansRouter = new Hono();

interface Politician {
  id: string;
  name: string;
  name_kana: string | null;
  created_at: string;
  updated_at: string;
}

// 政治家一覧取得
politiciansRouter.get("/", async (c) => {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("politicians")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data });
});

// 政治家取得
politiciansRouter.get("/:id", async (c) => {
  const id = c.req.param("id");

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("politicians")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Politician not found" }, 404);
    }
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data });
});

// 政治家作成
politiciansRouter.post("/", async (c) => {
  const body = await c.req.json<{ name: string; name_kana?: string }>();

  if (!body.name) {
    return c.json({ error: "name is required" }, 400);
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("politicians")
    .insert({
      name: body.name,
      name_kana: body.name_kana || null,
    })
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data }, 201);
});

// 政治家更新（認証済み政治家の情報編集）
politiciansRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    name?: string;
    name_kana?: string;
    official_url?: string | null;
    party?: string | null;
    photo_url?: string | null;
  }>();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.name !== undefined) updateData.name = body.name;
  if (body.name_kana !== undefined) updateData.name_kana = body.name_kana;
  if (body.official_url !== undefined) updateData.official_url = body.official_url;
  if (body.party !== undefined) updateData.party = body.party;
  if (body.photo_url !== undefined) updateData.photo_url = body.photo_url;

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("politicians")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Politician not found" }, 404);
    }
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data });
});
