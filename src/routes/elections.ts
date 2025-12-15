import { Hono } from "hono";
import { getServiceClient } from "../lib/supabase.ts";

export const electionsRouter = new Hono();

interface Election {
  id: string;
  name: string;
  type: string;
  district_id: string | null;
  election_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 選挙一覧取得
electionsRouter.get("/", async (c) => {
  const type = c.req.query("type");
  const year = c.req.query("year");

  const supabase = getServiceClient();
  let query = supabase.from("elections").select("*");

  if (type) {
    query = query.eq("type", type);
  }

  if (year) {
    // election_date の年でフィルター
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    query = query.gte("election_date", startDate).lte("election_date", endDate);
  }

  query = query.order("election_date", { ascending: false });

  const { data, error } = await query;

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data });
});

// 選挙取得
electionsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("elections")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Election not found" }, 404);
    }
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data });
});

// 選挙作成
electionsRouter.post("/", async (c) => {
  const body = await c.req.json<{
    name: string;
    type: string;
    district_id?: string;
    election_date: string;
  }>();

  if (!body.name || !body.type || !body.election_date) {
    return c.json(
      { error: "name, type, and election_date are required" },
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

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("elections")
    .insert({
      name: body.name,
      type: body.type,
      district_id: body.district_id || null,
      election_date: body.election_date,
    })
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data }, 201);
});

// 選挙更新
electionsRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ name?: string }>();

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("elections")
    .update({
      name: body.name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Election not found" }, 404);
    }
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data });
});
