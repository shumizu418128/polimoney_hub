/**
 * Supabase にシードデータを投入するスクリプト
 *
 * 使い方:
 * 1. .env に SUPABASE_URL, SUPABASE_SECRET_KEY を設定
 * 2. deno run --allow-net --allow-env --allow-read db/seed-supabase.ts [options]
 *
 * オプション:
 *   --all          全てのシードデータを投入（デフォルト）
 *   --municipalities  市区町村のみ
 *   --dummy        ダミーデータのみ（政治家、団体、選挙など）
 */

import "std/dotenv/load.ts";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SECRET_KEY = Deno.env.get("SUPABASE_SECRET_KEY");

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("❌ SUPABASE_URL or SUPABASE_SECRET_KEY is not set");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ============================================
// 市区町村データ（抜粋 - 全件は seed_municipalities_supabase.sql）
// ============================================

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

// ============================================
// ダミーデータ: 政治家
// ============================================

const politicians = [
  { id: "11111111-1111-1111-1111-111111111111", name: "山田 太郎", name_kana: "ヤマダ タロウ" },
  { id: "22222222-2222-2222-2222-222222222222", name: "佐藤 花子", name_kana: "サトウ ハナコ" },
  { id: "33333333-3333-3333-3333-333333333333", name: "鈴木 一郎", name_kana: "スズキ イチロウ" },
  { id: "44444444-4444-4444-4444-444444444444", name: "田中 美咲", name_kana: "タナカ ミサキ" },
  { id: "55555555-5555-5555-5555-555555555555", name: "高橋 健太", name_kana: "タカハシ ケンタ" },
];

// ============================================
// ダミーデータ: 政治団体
// ============================================

const organizations = [
  // 山田太郎の団体
  { id: "aaaa1111-1111-1111-1111-111111111111", name: "山田太郎後援会", type: "support_group", politician_id: "11111111-1111-1111-1111-111111111111", is_active: true },
  { id: "aaaa1111-2222-2222-2222-222222222222", name: "山田太郎を応援する会", type: "fund_management", politician_id: "11111111-1111-1111-1111-111111111111", is_active: true },
  // 佐藤花子の団体
  { id: "bbbb2222-1111-1111-1111-111111111111", name: "佐藤花子後援会", type: "support_group", politician_id: "22222222-2222-2222-2222-222222222222", is_active: true },
  // 鈴木一郎の団体
  { id: "cccc3333-1111-1111-1111-111111111111", name: "鈴木一郎後援会", type: "support_group", politician_id: "33333333-3333-3333-3333-333333333333", is_active: true },
  // 政党（架空）
  { id: "dddd0000-0000-0000-0000-000000000001", name: "民主未来党", type: "political_party", politician_id: null, is_active: true },
  { id: "dddd0000-0000-0000-0000-000000000002", name: "国民改革党", type: "political_party", politician_id: null, is_active: true },
];

// ============================================
// ダミーデータ: 選挙区（テスト用）
// ============================================

const testDistricts = [
  { id: "dddd1111-1111-1111-1111-111111111111", name: "東京都第1区", type: "HR", prefecture_codes: "13", municipality_code: null, description: "衆議院小選挙区 東京都第1区（テスト）", is_active: true },
  { id: "dddd2222-2222-2222-2222-222222222222", name: "東京都知事選挙区", type: "PG", prefecture_codes: "13", municipality_code: null, description: "東京都知事選挙（テスト）", is_active: true },
  { id: "dddd3333-3333-3333-3333-333333333333", name: "渋谷区長選挙区", type: "GM", prefecture_codes: "13", municipality_code: "131130", description: "渋谷区長選挙（テスト）", is_active: true },
];

// ============================================
// ダミーデータ: 選挙
// ============================================

const elections = [
  { id: "eeee1111-1111-1111-1111-111111111111", name: "2024年 第50回衆議院議員総選挙（テスト）", type: "HR", district_id: "dddd1111-1111-1111-1111-111111111111", election_date: "2024-10-27", is_active: true },
  { id: "eeee2222-2222-2222-2222-222222222222", name: "令和7年東京都知事選挙（テスト）", type: "PG", district_id: "dddd2222-2222-2222-2222-222222222222", election_date: "2025-07-06", is_active: true },
  { id: "eeee3333-3333-3333-3333-333333333333", name: "渋谷区長選挙（テスト）", type: "GM", district_id: "dddd3333-3333-3333-3333-333333333333", election_date: "2025-04-20", is_active: true },
];

// ============================================
// ダミーデータ: 公開台帳
// ============================================

const publicLedgers = [
  {
    id: "ffff1111-1111-1111-1111-111111111111",
    politician_id: "11111111-1111-1111-1111-111111111111",  // 山田太郎
    organization_id: "aaaa1111-1111-1111-1111-111111111111",  // 山田太郎後援会
    election_id: "eeee1111-1111-1111-1111-111111111111",  // 第50回衆院選
    fiscal_year: 2024,
    total_income: 2000000,  // 自己100万 + 個人寄附50万 + 政治団体30万 + 個人寄附20万
    total_expense: 1837722,  // 各支出の合計
    journal_count: 20,
    ledger_source_id: "aaaa0000-0000-0000-0000-000000000001",
    last_updated_at: new Date().toISOString(),
    first_synced_at: new Date().toISOString(),
  },
  {
    id: "ffff2222-2222-2222-2222-222222222222",
    politician_id: "22222222-2222-2222-2222-222222222222",  // 佐藤花子
    organization_id: "bbbb2222-1111-1111-1111-111111111111",  // 佐藤花子後援会
    election_id: "eeee1111-1111-1111-1111-111111111111",  // 第50回衆院選
    fiscal_year: 2024,
    total_income: 800000,  // 自己50万 + 個人寄附30万
    total_expense: 963000,  // ポスター85万 + 事務所6万 + 弁当2.8万 + 人件費2.5万
    journal_count: 6,
    ledger_source_id: "aaaa0000-0000-0000-0000-000000000002",
    last_updated_at: new Date().toISOString(),
    first_synced_at: new Date().toISOString(),
  },
];

// ============================================
// ダミーデータ: 公開仕訳（Polimoney API テスト用に充実）
// ============================================

const publicJournals = [
  // ================================
  // 山田太郎の仕訳（選挙運動収支報告書風）
  // ================================
  // 収入
  { ledger_id: "ffff1111-1111-1111-1111-111111111111", journal_source_id: "00010001-0001-0001-0001-000000000001", date: "2024-10-01", description: "自己資金", amount: 1000000, contact_name: null, contact_type: null, account_code: "REV_SELF_FINANCING", classification: null, content_hash: "hash001", synced_at: new Date().toISOString() },
  { ledger_id: "ffff1111-1111-1111-1111-111111111111", journal_source_id: "00010001-0001-0001-0001-000000000002", date: "2024-10-05", description: "個人寄附", amount: 500000, contact_name: "個人A", contact_type: "person", account_code: "REV_DONATION_INDIVIDUAL_ELEC", classification: null, content_hash: "hash002", synced_at: new Date().toISOString() },
  { ledger_id: "ffff1111-1111-1111-1111-111111111111", journal_source_id: "00010001-0001-0001-0001-000000000003", date: "2024-10-10", description: "政治団体からの寄附", amount: 300000, contact_name: "民主未来党", contact_type: "organization", account_code: "REV_DONATION_POLITICAL_ELEC", classification: null, content_hash: "hash003", synced_at: new Date().toISOString() },
  { ledger_id: "ffff1111-1111-1111-1111-111111111111", journal_source_id: "00010001-0001-0001-0001-000000000004", date: "2024-10-12", description: "個人寄附", amount: 200000, contact_name: "個人B", contact_type: "person", account_code: "REV_DONATION_INDIVIDUAL_ELEC", classification: null, content_hash: "hash004", synced_at: new Date().toISOString() },

  // 支出 - 立候補準備
  { ledger_id: "ffff1111-1111-1111-1111-111111111111", journal_source_id: "00010001-0001-0001-0001-000000000010", date: "2024-10-01", description: "選挙カー看板制作", amount: 308800, contact_name: "○○看板店", contact_type: "corporation", account_code: "EXP_ADVERTISING_ELEC", classification: "pre-campaign", content_hash: "hash010", synced_at: new Date().toISOString() },
  { ledger_id: "ffff1111-1111-1111-1111-111111111111", journal_source_id: "00010001-0001-0001-0001-000000000011", date: "2024-10-05", description: "選挙運動用ビラ印刷", amount: 123680, contact_name: "△△印刷", contact_type: "corporation", account_code: "EXP_PRINTING_ELEC", classification: "pre-campaign", public_expense_amount: 123680, content_hash: "hash011", synced_at: new Date().toISOString() },
  { ledger_id: "ffff1111-1111-1111-1111-111111111111", journal_source_id: "00010001-0001-0001-0001-000000000012", date: "2024-10-08", description: "選挙運動用ポスター印刷", amount: 1012176, contact_name: "△△印刷", contact_type: "corporation", account_code: "EXP_PRINTING_ELEC", classification: "pre-campaign", public_expense_amount: 1012176, content_hash: "hash012", synced_at: new Date().toISOString() },

  // 支出 - 選挙運動
  { ledger_id: "ffff1111-1111-1111-1111-111111111111", journal_source_id: "00010001-0001-0001-0001-000000000020", date: "2024-10-15", description: "車上運動員報酬", amount: 30605, contact_name: "運動員A", contact_type: "person", account_code: "EXP_PERSONNEL_ELEC", classification: "campaign", note: "10/15~17 3日分", content_hash: "hash020", synced_at: new Date().toISOString() },
  { ledger_id: "ffff1111-1111-1111-1111-111111111111", journal_source_id: "00010001-0001-0001-0001-000000000021", date: "2024-10-18", description: "車上運動員報酬", amount: 20497, contact_name: "運動員A", contact_type: "person", account_code: "EXP_PERSONNEL_ELEC", classification: "campaign", note: "10/18~19 2日分", content_hash: "hash021", synced_at: new Date().toISOString() },
  { ledger_id: "ffff1111-1111-1111-1111-111111111111", journal_source_id: "00010001-0001-0001-0001-000000000022", date: "2024-10-20", description: "車上運動員報酬", amount: 20226, contact_name: "運動員A", contact_type: "person", account_code: "EXP_PERSONNEL_ELEC", classification: "campaign", note: "10/20~21 2日分", content_hash: "hash022", synced_at: new Date().toISOString() },
  { ledger_id: "ffff1111-1111-1111-1111-111111111111", journal_source_id: "00010001-0001-0001-0001-000000000023", date: "2024-10-15", description: "選挙事務所借り上げ", amount: 80000, contact_name: "○○不動産", contact_type: "corporation", account_code: "EXP_BUILDING_ELEC", classification: "campaign", note: "10/1~10/31", content_hash: "hash023", synced_at: new Date().toISOString() },
  { ledger_id: "ffff1111-1111-1111-1111-111111111111", journal_source_id: "00010001-0001-0001-0001-000000000024", date: "2024-10-18", description: "ビラの新聞折込", amount: 65736, contact_name: "○○新聞販売店", contact_type: "corporation", account_code: "EXP_ADVERTISING_ELEC", classification: "campaign", note: "35,000部", content_hash: "hash024", synced_at: new Date().toISOString() },
  { ledger_id: "ffff1111-1111-1111-1111-111111111111", journal_source_id: "00010001-0001-0001-0001-000000000025", date: "2024-10-15", description: "弁当代", amount: 36800, contact_name: "○○弁当", contact_type: "corporation", account_code: "EXP_FOOD_ELEC", classification: "campaign", note: "40個", content_hash: "hash025", synced_at: new Date().toISOString() },
  { ledger_id: "ffff1111-1111-1111-1111-111111111111", journal_source_id: "00010001-0001-0001-0001-000000000026", date: "2024-10-16", description: "弁当代", amount: 24800, contact_name: "○○弁当", contact_type: "corporation", account_code: "EXP_FOOD_ELEC", classification: "campaign", note: "32個", content_hash: "hash026", synced_at: new Date().toISOString() },
  { ledger_id: "ffff1111-1111-1111-1111-111111111111", journal_source_id: "00010001-0001-0001-0001-000000000027", date: "2024-10-17", description: "茶菓子", amount: 5638, contact_name: "コンビニ", contact_type: "corporation", account_code: "EXP_FOOD_ELEC", classification: "campaign", content_hash: "hash027", synced_at: new Date().toISOString() },
  { ledger_id: "ffff1111-1111-1111-1111-111111111111", journal_source_id: "00010001-0001-0001-0001-000000000028", date: "2024-10-15", description: "テープ・マジック等", amount: 2104, contact_name: "文具店", contact_type: "corporation", account_code: "EXP_STATIONERY_ELEC", classification: "campaign", content_hash: "hash028", synced_at: new Date().toISOString() },
  { ledger_id: "ffff1111-1111-1111-1111-111111111111", journal_source_id: "00010001-0001-0001-0001-000000000029", date: "2024-10-12", description: "スタッフTシャツ", amount: 104280, contact_name: "プリント会社", contact_type: "corporation", account_code: "EXP_MISC_ELEC", classification: "campaign", note: "30枚", content_hash: "hash029", synced_at: new Date().toISOString() },
  { ledger_id: "ffff1111-1111-1111-1111-111111111111", journal_source_id: "00010001-0001-0001-0001-000000000030", date: "2024-10-20", description: "電話回線使用料", amount: 2380, contact_name: "NTT", contact_type: "corporation", account_code: "EXP_COMMUNICATION_ELEC", classification: "campaign", content_hash: "hash030", synced_at: new Date().toISOString() },

  // ================================
  // 佐藤花子の仕訳
  // ================================
  // 収入
  { ledger_id: "ffff2222-2222-2222-2222-222222222222", journal_source_id: "00020002-0002-0002-0002-000000000001", date: "2024-10-01", description: "自己資金", amount: 500000, contact_name: null, contact_type: null, account_code: "REV_SELF_FINANCING", classification: null, content_hash: "hash101", synced_at: new Date().toISOString() },
  { ledger_id: "ffff2222-2222-2222-2222-222222222222", journal_source_id: "00020002-0002-0002-0002-000000000002", date: "2024-10-08", description: "個人寄附", amount: 300000, contact_name: "個人C", contact_type: "person", account_code: "REV_DONATION_INDIVIDUAL_ELEC", classification: null, content_hash: "hash102", synced_at: new Date().toISOString() },

  // 支出
  { ledger_id: "ffff2222-2222-2222-2222-222222222222", journal_source_id: "00020002-0002-0002-0002-000000000010", date: "2024-10-05", description: "選挙運動用ポスター印刷", amount: 850000, contact_name: "◇◇プリント", contact_type: "corporation", account_code: "EXP_PRINTING_ELEC", classification: "pre-campaign", public_expense_amount: 850000, content_hash: "hash110", synced_at: new Date().toISOString() },
  { ledger_id: "ffff2222-2222-2222-2222-222222222222", journal_source_id: "00020002-0002-0002-0002-000000000011", date: "2024-10-15", description: "選挙事務所借り上げ", amount: 60000, contact_name: "□□ビル管理", contact_type: "corporation", account_code: "EXP_BUILDING_ELEC", classification: "campaign", content_hash: "hash111", synced_at: new Date().toISOString() },
  { ledger_id: "ffff2222-2222-2222-2222-222222222222", journal_source_id: "00020002-0002-0002-0002-000000000012", date: "2024-10-18", description: "弁当代", amount: 28000, contact_name: "△△弁当", contact_type: "corporation", account_code: "EXP_FOOD_ELEC", classification: "campaign", note: "35個", content_hash: "hash112", synced_at: new Date().toISOString() },
  { ledger_id: "ffff2222-2222-2222-2222-222222222222", journal_source_id: "00020002-0002-0002-0002-000000000013", date: "2024-10-20", description: "車上運動員報酬", amount: 25000, contact_name: "運動員B", contact_type: "person", account_code: "EXP_PERSONNEL_ELEC", classification: "campaign", content_hash: "hash113", synced_at: new Date().toISOString() },
];

// ============================================
// ダミーデータ: 選挙登録リクエスト
// ============================================

const electionRequests = [
  {
    name: "令和7年参議院議員通常選挙（テスト）",
    type: "HC",
    district_id: null,
    area_description: "東京都選挙区",
    election_date: "2025-07-27",
    requested_by_politician_id: "33333333-3333-3333-3333-333333333333",  // 鈴木一郎
    requested_by_email: "test@example.com",
    evidence_url: "https://example.com/evidence",
    notes: "テスト用リクエストです",
    status: "pending",
  },
  {
    name: "○○市長選挙（テスト）",
    type: "CM",
    district_id: null,
    area_description: "○○県○○市",
    election_date: "2025-05-15",
    requested_by_politician_id: "44444444-4444-4444-4444-444444444444",  // 田中美咲
    requested_by_email: "test2@example.com",
    evidence_url: "https://example.com/evidence2",
    notes: "テスト用リクエスト2です",
    status: "pending",
  },
];

// ============================================
// ダミーデータ: 政治団体登録リクエスト
// ============================================

const organizationRequests = [
  {
    name: "高橋健太後援会（テスト）",
    type: "support_group",
    registration_authority: "東京都選挙管理委員会",
    requested_by_politician_id: "55555555-5555-5555-5555-555555555555",  // 高橋健太
    requested_by_email: "test3@example.com",
    evidence_type: "registration_form",
    evidence_file_url: "https://example.com/files/registration.pdf",
    evidence_file_name: "設立届出書.pdf",
    notes: "テスト用リクエストです",
    status: "pending",
  },
];

// ============================================
// シード関数
// ============================================

async function seedMunicipalities() {
  console.log("🏛️ Seeding municipalities...");
  const { error } = await supabase
    .from("municipalities")
    .upsert(municipalities, { onConflict: "code", ignoreDuplicates: true });

  if (error) throw error;

  const { count } = await supabase.from("municipalities").select("*", { count: "exact", head: true });
  console.log(`   ✅ municipalities: ${count} 件`);
}

async function seedTestDistricts() {
  console.log("🗺️ Seeding test districts...");
  const { error } = await supabase
    .from("districts")
    .upsert(testDistricts, { onConflict: "id", ignoreDuplicates: true });

  if (error) throw error;

  console.log(`   ✅ test districts: ${testDistricts.length} 件`);
}

async function seedPoliticians() {
  console.log("👤 Seeding politicians...");
  const { error } = await supabase
    .from("politicians")
    .upsert(politicians, { onConflict: "id", ignoreDuplicates: true });

  if (error) throw error;

  const { count } = await supabase.from("politicians").select("*", { count: "exact", head: true });
  console.log(`   ✅ politicians: ${count} 件`);
}

async function seedOrganizations() {
  console.log("🏢 Seeding organizations...");
  const { error } = await supabase
    .from("organizations")
    .upsert(organizations, { onConflict: "id", ignoreDuplicates: true });

  if (error) throw error;

  const { count } = await supabase.from("organizations").select("*", { count: "exact", head: true });
  console.log(`   ✅ organizations: ${count} 件`);
}

async function seedElections() {
  console.log("🗳️ Seeding elections...");
  const { error } = await supabase
    .from("elections")
    .upsert(elections, { onConflict: "id", ignoreDuplicates: true });

  if (error) throw error;

  const { count } = await supabase.from("elections").select("*", { count: "exact", head: true });
  console.log(`   ✅ elections: ${count} 件`);
}

async function seedPublicLedgers() {
  console.log("📒 Seeding public_ledgers...");
  const { error } = await supabase
    .from("public_ledgers")
    .upsert(publicLedgers, { onConflict: "id", ignoreDuplicates: true });

  if (error) throw error;

  const { count } = await supabase.from("public_ledgers").select("*", { count: "exact", head: true });
  console.log(`   ✅ public_ledgers: ${count} 件`);
}

async function seedPublicJournals() {
  console.log("📝 Seeding public_journals...");
  const { error } = await supabase
    .from("public_journals")
    .upsert(publicJournals, { onConflict: "journal_source_id", ignoreDuplicates: true });

  if (error) throw error;

  const { count } = await supabase.from("public_journals").select("*", { count: "exact", head: true });
  console.log(`   ✅ public_journals: ${count} 件`);
}

async function seedElectionRequests() {
  console.log("📋 Seeding election_requests...");
  // リクエストは id が自動生成なので、既存データがあれば何もしない
  const { count: existingCount } = await supabase.from("election_requests").select("*", { count: "exact", head: true });
  if (existingCount && existingCount > 0) {
    console.log(`   ⏭️ election_requests: 既存データあり (${existingCount} 件)、スキップ`);
    return;
  }

  const { error } = await supabase.from("election_requests").insert(electionRequests);

  if (error) throw error;
  console.log(`   ✅ election_requests: ${electionRequests.length} 件`);
}

async function seedOrganizationRequests() {
  console.log("📋 Seeding organization_requests...");
  const { count: existingCount } = await supabase.from("organization_requests").select("*", { count: "exact", head: true });
  if (existingCount && existingCount > 0) {
    console.log(`   ⏭️ organization_requests: 既存データあり (${existingCount} 件)、スキップ`);
    return;
  }

  const { error } = await supabase.from("organization_requests").insert(organizationRequests);

  if (error) throw error;
  console.log(`   ✅ organization_requests: ${organizationRequests.length} 件`);
}

// ============================================
// メイン
// ============================================

async function seedAll() {
  console.log("\n📦 Seeding all data...\n");

  await seedMunicipalities();
  await seedTestDistricts();  // 選挙より先に選挙区を投入
  await seedPoliticians();
  await seedOrganizations();
  await seedElections();
  await seedPublicLedgers();
  await seedPublicJournals();
  await seedElectionRequests();
  await seedOrganizationRequests();

  console.log("\n✅ All done!\n");
}

async function seedDummyOnly() {
  console.log("\n📦 Seeding dummy data only...\n");

  await seedTestDistricts();  // 選挙より先に選挙区を投入
  await seedPoliticians();
  await seedOrganizations();
  await seedElections();
  await seedPublicLedgers();
  await seedPublicJournals();
  await seedElectionRequests();
  await seedOrganizationRequests();

  console.log("\n✅ Done!\n");
}

// CLI引数パース
const args = Deno.args;
const option = args[0] || "--all";

try {
  switch (option) {
    case "--municipalities":
      await seedMunicipalities();
      break;
    case "--dummy":
      await seedDummyOnly();
      break;
    case "--all":
    default:
      await seedAll();
      break;
  }
} catch (error) {
  console.error("❌ Error:", error);
  Deno.exit(1);
}
