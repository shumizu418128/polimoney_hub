/**
 * マスタデータ API
 *
 * 勘定科目、選挙タイプ、選挙公営費目などの共通マスタデータを提供
 */

import { Hono } from "hono";
import { getServiceClient } from "../lib/supabase.ts";

export const masterRouter = new Hono();

// ============================================
// 勘定科目マスタ
// ============================================

/**
 * GET /master/account-codes
 * 勘定科目一覧を取得
 */
masterRouter.get("/account-codes", async (c) => {
  const ledgerType = c.req.query("ledger_type"); // 'both', 'organization', 'election'
  const type = c.req.query("type"); // 'asset', 'liability', 'equity', 'revenue', 'expense', 'subsidy'
  const reportCategory = c.req.query("report_category");

  const supabase = getServiceClient();
  let query = supabase
    .from("account_codes")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (ledgerType && ledgerType !== "both") {
    // 'both' または指定されたタイプにマッチするもの
    query = query.or(`ledger_type.eq.both,ledger_type.eq.${ledgerType}`);
  }

  if (type) {
    query = query.eq("type", type);
  }

  if (reportCategory) {
    query = query.eq("report_category", reportCategory);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[Master] Account codes fetch error:", error);
    return c.json({ error: "Failed to fetch account codes" }, 500);
  }

  return c.json({ data });
});

/**
 * GET /master/account-codes/:code
 * 特定の勘定科目を取得
 */
masterRouter.get("/account-codes/:code", async (c) => {
  const code = c.req.param("code");

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("account_codes")
    .select("*")
    .eq("code", code)
    .single();

  if (error || !data) {
    return c.json({ error: "Account code not found" }, 404);
  }

  return c.json({ data });
});

// ============================================
// 選挙タイプマスタ
// ============================================

/**
 * GET /master/election-types
 * 選挙タイプ一覧を取得
 */
masterRouter.get("/election-types", async (c) => {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("election_types")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[Master] Election types fetch error:", error);
    return c.json({ error: "Failed to fetch election types" }, 500);
  }

  return c.json({ data });
});

/**
 * GET /master/election-types/:code
 * 特定の選挙タイプを取得
 */
masterRouter.get("/election-types/:code", async (c) => {
  const code = c.req.param("code");

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("election_types")
    .select("*")
    .eq("code", code)
    .single();

  if (error || !data) {
    return c.json({ error: "Election type not found" }, 404);
  }

  return c.json({ data });
});

// ============================================
// 選挙公営費目マスタ
// ============================================

/**
 * GET /master/public-subsidy-items
 * 選挙公営費目一覧を取得
 */
masterRouter.get("/public-subsidy-items", async (c) => {
  const electionType = c.req.query("election_type");
  const accountCode = c.req.query("account_code");

  const supabase = getServiceClient();
  let query = supabase
    .from("public_subsidy_items")
    .select(`
      *,
      election_type:election_types(code, name),
      account:account_codes(code, name)
    `)
    .eq("is_active", true);

  if (electionType) {
    query = query.eq("election_type_code", electionType);
  }

  if (accountCode) {
    query = query.eq("account_code", accountCode);
  }

  const { data, error } = await query.order("election_type_code");

  if (error) {
    console.error("[Master] Public subsidy items fetch error:", error);
    return c.json({ error: "Failed to fetch public subsidy items" }, 500);
  }

  return c.json({ data });
});

/**
 * GET /master/public-subsidy-items/:id
 * 特定の選挙公営費目を取得
 */
masterRouter.get("/public-subsidy-items/:id", async (c) => {
  const id = c.req.param("id");

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("public_subsidy_items")
    .select(`
      *,
      election_type:election_types(code, name),
      account:account_codes(code, name)
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    return c.json({ error: "Public subsidy item not found" }, 404);
  }

  return c.json({ data });
});

// ============================================
// マスタメタデータ（更新日時確認用）
// ============================================

/**
 * GET /master/metadata
 * マスタテーブルの最終更新日時を取得
 */
masterRouter.get("/metadata", async (c) => {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("master_metadata")
    .select("*")
    .order("table_name");

  if (error) {
    console.error("[Master] Metadata fetch error:", error);
    return c.json({ error: "Failed to fetch metadata" }, 500);
  }

  // オブジェクト形式に変換
  const metadata: Record<string, string> = {};
  for (const row of data || []) {
    metadata[row.table_name] = row.last_updated_at;
  }

  return c.json({ data: metadata });
});

// ============================================
// 市区町村マスタ
// ============================================

/**
 * GET /master/municipalities
 * 市区町村一覧を取得
 */
masterRouter.get("/municipalities", async (c) => {
  const prefecture = c.req.query("prefecture");
  const search = c.req.query("search");
  const limit = parseInt(c.req.query("limit") || "100");

  const supabase = getServiceClient();
  let query = supabase
    .from("municipalities")
    .select("*")
    .eq("is_active", true)
    .order("code");

  if (prefecture) {
    query = query.eq("prefecture_name", prefecture);
  }

  if (search) {
    query = query.or(`city_name.ilike.%${search}%,city_name_kana.ilike.%${search}%`);
  }

  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error("[Master] Municipalities fetch error:", error);
    return c.json({ error: "Failed to fetch municipalities" }, 500);
  }

  return c.json({ data });
});

/**
 * GET /master/prefectures
 * 都道府県一覧を取得
 */
masterRouter.get("/prefectures", async (c) => {
  const supabase = getServiceClient();

  // municipalities から都道府県を抽出（distinct）
  const { data, error } = await supabase
    .from("municipalities")
    .select("prefecture_name, prefecture_name_kana")
    .eq("is_active", true)
    .order("prefecture_name");

  if (error) {
    console.error("[Master] Prefectures fetch error:", error);
    return c.json({ error: "Failed to fetch prefectures" }, 500);
  }

  // 重複除去
  const seen = new Set<string>();
  const prefectures = (data || []).filter((row) => {
    if (seen.has(row.prefecture_name)) return false;
    seen.add(row.prefecture_name);
    return true;
  });

  return c.json({ data: prefectures });
});

