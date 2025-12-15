/**
 * Supabase に市区町村データをシードするスクリプト
 * 
 * 使い方:
 * 1. .env に SUPABASE_URL, SUPABASE_SECRET_KEY を設定
 * 2. deno run --allow-net --allow-env --allow-read db/seed-supabase.ts
 */

import "std/dotenv/load.ts";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SECRET_KEY = Deno.env.get("SUPABASE_SECRET_KEY");

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("SUPABASE_URL or SUPABASE_SECRET_KEY is not set");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// 市区町村データ（city_code.csv から抽出）
const municipalities = [
  { code: "10006", prefecture_name: "北海道", city_name: null, prefecture_name_kana: "ﾎｯｶｲﾄﾞｳ", city_name_kana: null },
  { code: "11002", prefecture_name: "北海道", city_name: "札幌市", prefecture_name_kana: "ﾎｯｶｲﾄﾞｳ", city_name_kana: "ｻｯﾎﾟﾛｼ" },
  { code: "130001", prefecture_name: "東京都", city_name: null, prefecture_name_kana: "ﾄｳｷｮｳﾄ", city_name_kana: null },
  { code: "131016", prefecture_name: "東京都", city_name: "千代田区", prefecture_name_kana: "ﾄｳｷｮｳﾄ", city_name_kana: "ﾁﾖﾀﾞｸ" },
  { code: "131024", prefecture_name: "東京都", city_name: "中央区", prefecture_name_kana: "ﾄｳｷｮｳﾄ", city_name_kana: "ﾁｭｳｵｳｸ" },
  { code: "131032", prefecture_name: "東京都", city_name: "港区", prefecture_name_kana: "ﾄｳｷｮｳﾄ", city_name_kana: "ﾐﾅﾄｸ" },
  { code: "131041", prefecture_name: "東京都", city_name: "新宿区", prefecture_name_kana: "ﾄｳｷｮｳﾄ", city_name_kana: "ｼﾝｼﾞｭｸｸ" },
  { code: "131059", prefecture_name: "東京都", city_name: "文京区", prefecture_name_kana: "ﾄｳｷｮｳﾄ", city_name_kana: "ﾌﾞﾝｷｮｳｸ" },
  { code: "131067", prefecture_name: "東京都", city_name: "台東区", prefecture_name_kana: "ﾄｳｷｮｳﾄ", city_name_kana: "ﾀｲﾄｳｸ" },
  { code: "131075", prefecture_name: "東京都", city_name: "墨田区", prefecture_name_kana: "ﾄｳｷｮｳﾄ", city_name_kana: "ｽﾐﾀﾞｸ" },
  { code: "131083", prefecture_name: "東京都", city_name: "江東区", prefecture_name_kana: "ﾄｳｷｮｳﾄ", city_name_kana: "ｺｳﾄｳｸ" },
  { code: "131091", prefecture_name: "東京都", city_name: "品川区", prefecture_name_kana: "ﾄｳｷｮｳﾄ", city_name_kana: "ｼﾅｶﾞﾜｸ" },
  { code: "131105", prefecture_name: "東京都", city_name: "目黒区", prefecture_name_kana: "ﾄｳｷｮｳﾄ", city_name_kana: "ﾒｸﾞﾛｸ" },
  { code: "131113", prefecture_name: "東京都", city_name: "大田区", prefecture_name_kana: "ﾄｳｷｮｳﾄ", city_name_kana: "ｵｵﾀｸ" },
  { code: "131121", prefecture_name: "東京都", city_name: "世田谷区", prefecture_name_kana: "ﾄｳｷｮｳﾄ", city_name_kana: "ｾﾀｶﾞﾔｸ" },
  { code: "131130", prefecture_name: "東京都", city_name: "渋谷区", prefecture_name_kana: "ﾄｳｷｮｳﾄ", city_name_kana: "ｼﾌﾞﾔｸ" },
];

async function seed() {
  console.log("Seeding municipalities...");
  
  // upsert で既存データがあれば何もしない
  const { error } = await supabase
    .from("municipalities")
    .upsert(municipalities, { onConflict: "code", ignoreDuplicates: true });

  if (error) {
    console.error("Error seeding municipalities:", error);
    Deno.exit(1);
  }
  
  console.log("Done!");
  
  // 確認
  const { count } = await supabase
    .from("municipalities")
    .select("*", { count: "exact", head: true });
  
  console.log(`Total municipalities: ${count}`);
}

seed().catch(console.error);
