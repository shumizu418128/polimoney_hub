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

// 政治団体更新
organizationsRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    name?: string;
    type?: string;
    politician_id?: string;
  }>();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.name !== undefined) updateData.name = body.name;
  if (body.type !== undefined) updateData.type = body.type;
  if (body.politician_id !== undefined) updateData.politician_id = body.politician_id;

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
