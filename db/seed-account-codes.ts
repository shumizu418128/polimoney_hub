/**
 * 勘定科目マスタ・選挙タイプ・選挙公営費目の seed スクリプト
 *
 * 実行: deno run --allow-env --allow-net db/seed-account-codes.ts
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseSecretKey = Deno.env.get("SUPABASE_SECRET_KEY");

if (!supabaseUrl || !supabaseSecretKey) {
  console.error("Error: SUPABASE_URL and SUPABASE_SECRET_KEY are required");
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ============================================
// 選挙タイプマスタ
// ============================================

const electionTypes = [
  { code: "HR", name: "衆議院議員選挙", description: "小選挙区・比例代表", display_order: 1 },
  { code: "HC", name: "参議院議員選挙", description: "選挙区・比例代表", display_order: 2 },
  { code: "PG", name: "都道府県知事選挙", description: "都道府県知事", display_order: 3 },
  { code: "PA", name: "都道府県議会議員選挙", description: "都道府県議会", display_order: 4 },
  { code: "CM", name: "市区町村長選挙", description: "市区町村長", display_order: 5 },
  { code: "GM", name: "市区町村議会議員選挙", description: "市区町村議会", display_order: 6 },
];

// ============================================
// 勘定科目マスタ（政治資金規正法準拠）
// ============================================

interface AccountCode {
  code: string;
  name: string;
  type: string;
  report_category: string;
  ledger_type: string;
  is_public_subsidy_eligible: boolean;
  display_order: number;
  polimoney_category: string;
  description?: string;
}

const accountCodes: AccountCode[] = [
  // ============================================
  // 資産科目 (type: asset)
  // ============================================
  { code: "ASSET_CASH", name: "現金", type: "asset", report_category: "資産", ledger_type: "both", is_public_subsidy_eligible: false, display_order: 100, polimoney_category: "資産" },
  { code: "ASSET_BANK", name: "普通預金", type: "asset", report_category: "資産", ledger_type: "both", is_public_subsidy_eligible: false, display_order: 101, polimoney_category: "資産" },
  { code: "ASSET_SAVINGS", name: "定期預金", type: "asset", report_category: "資産", ledger_type: "both", is_public_subsidy_eligible: false, display_order: 102, polimoney_category: "資産" },
  { code: "ASSET_PREPAID", name: "前払金", type: "asset", report_category: "資産", ledger_type: "both", is_public_subsidy_eligible: false, display_order: 103, polimoney_category: "資産" },
  { code: "ASSET_DEPOSIT", name: "敷金・保証金", type: "asset", report_category: "資産", ledger_type: "both", is_public_subsidy_eligible: false, display_order: 104, polimoney_category: "資産" },

  // ============================================
  // 負債科目 (type: liability)
  // ============================================
  { code: "LIAB_LOAN", name: "借入金", type: "liability", report_category: "負債", ledger_type: "both", is_public_subsidy_eligible: false, display_order: 200, polimoney_category: "負債" },
  { code: "LIAB_ACCOUNTS_PAYABLE", name: "未払金", type: "liability", report_category: "負債", ledger_type: "both", is_public_subsidy_eligible: false, display_order: 201, polimoney_category: "負債" },

  // ============================================
  // 純資産科目 (type: equity)
  // ============================================
  { code: "EQUITY_CAPITAL", name: "元入金", type: "equity", report_category: "純資産", ledger_type: "both", is_public_subsidy_eligible: false, display_order: 300, polimoney_category: "純資産" },
  { code: "EQUITY_CARRYOVER", name: "前年繰越額", type: "equity", report_category: "純資産", ledger_type: "both", is_public_subsidy_eligible: false, display_order: 301, polimoney_category: "純資産" },

  // ============================================
  // 収入科目 - 政治団体用 (type: revenue)
  // ============================================
  { code: "REV_MEMBERSHIP_FEE", name: "党費・会費", type: "revenue", report_category: "党費・会費", ledger_type: "organization", is_public_subsidy_eligible: false, display_order: 400, polimoney_category: "会費収入", description: "個人が負担する党費又は会費" },
  { code: "REV_DONATION_INDIVIDUAL", name: "個人からの寄附", type: "revenue", report_category: "寄附", ledger_type: "organization", is_public_subsidy_eligible: false, display_order: 401, polimoney_category: "寄附" },
  { code: "REV_DONATION_CORPORATE", name: "法人その他の団体からの寄附", type: "revenue", report_category: "寄附", ledger_type: "organization", is_public_subsidy_eligible: false, display_order: 402, polimoney_category: "寄附" },
  { code: "REV_DONATION_POLITICAL", name: "政治団体からの寄附", type: "revenue", report_category: "寄附", ledger_type: "organization", is_public_subsidy_eligible: false, display_order: 403, polimoney_category: "寄附" },
  { code: "REV_ANONYMOUS", name: "政党匿名寄附", type: "revenue", report_category: "寄附", ledger_type: "organization", is_public_subsidy_eligible: false, display_order: 404, polimoney_category: "寄附", description: "政党支部のみ" },
  { code: "REV_MAGAZINE", name: "機関紙誌の発行事業収入", type: "revenue", report_category: "事業収入", ledger_type: "organization", is_public_subsidy_eligible: false, display_order: 410, polimoney_category: "事業収入" },
  { code: "REV_PARTY_EVENT", name: "政治資金パーティー収入", type: "revenue", report_category: "事業収入", ledger_type: "organization", is_public_subsidy_eligible: false, display_order: 411, polimoney_category: "事業収入" },
  { code: "REV_OTHER_BUSINESS", name: "その他の事業収入", type: "revenue", report_category: "事業収入", ledger_type: "organization", is_public_subsidy_eligible: false, display_order: 412, polimoney_category: "事業収入" },
  { code: "REV_GRANT_HQ", name: "本部・支部からの交付金", type: "revenue", report_category: "交付金", ledger_type: "organization", is_public_subsidy_eligible: false, display_order: 420, polimoney_category: "交付金" },
  { code: "REV_INTEREST", name: "利子収入", type: "revenue", report_category: "その他の収入", ledger_type: "both", is_public_subsidy_eligible: false, display_order: 430, polimoney_category: "その他収入" },
  { code: "REV_MISC", name: "その他の収入", type: "revenue", report_category: "その他の収入", ledger_type: "organization", is_public_subsidy_eligible: false, display_order: 431, polimoney_category: "その他収入" },

  // ============================================
  // 収入科目 - 選挙運動用 (type: revenue)
  // ============================================
  { code: "REV_SELF_FINANCING", name: "自己資金", type: "revenue", report_category: "その他の収入", ledger_type: "election", is_public_subsidy_eligible: false, display_order: 450, polimoney_category: "自己資金", description: "候補者本人からの資金" },
  { code: "REV_LOAN_ELEC", name: "借入金", type: "revenue", report_category: "その他の収入", ledger_type: "election", is_public_subsidy_eligible: false, display_order: 451, polimoney_category: "借入金", description: "選挙運動のための借入" },
  { code: "REV_DONATION_INDIVIDUAL_ELEC", name: "個人からの寄附", type: "revenue", report_category: "寄附", ledger_type: "election", is_public_subsidy_eligible: false, display_order: 452, polimoney_category: "寄附" },
  { code: "REV_DONATION_POLITICAL_ELEC", name: "政治団体からの寄附", type: "revenue", report_category: "寄附", ledger_type: "election", is_public_subsidy_eligible: false, display_order: 453, polimoney_category: "寄附", description: "政党、政治団体等" },
  { code: "REV_MISC_ELEC", name: "その他の収入", type: "revenue", report_category: "その他の収入", ledger_type: "election", is_public_subsidy_eligible: false, display_order: 454, polimoney_category: "その他収入", description: "上記以外（利子等）" },

  // ============================================
  // 公費負担 (type: subsidy)
  // ============================================
  { code: "SUBSIDY_PUBLIC", name: "公費負担", type: "subsidy", report_category: "公費負担", ledger_type: "election", is_public_subsidy_eligible: false, display_order: 460, polimoney_category: "公費負担", description: "選挙公営による負担（参考記録用）" },

  // ============================================
  // 支出科目 - 経常経費（政治団体用）(type: expense)
  // ============================================
  { code: "EXP_PERSONNEL", name: "人件費", type: "expense", report_category: "経常経費", ledger_type: "organization", is_public_subsidy_eligible: false, display_order: 500, polimoney_category: "人件費", description: "給料、報酬、各種手当、社会保険料等" },
  { code: "EXP_UTILITIES", name: "光熱水費", type: "expense", report_category: "経常経費", ledger_type: "organization", is_public_subsidy_eligible: false, display_order: 501, polimoney_category: "事務所費", description: "電気、ガス、水道の使用料" },
  { code: "EXP_SUPPLIES", name: "備品・消耗品費", type: "expense", report_category: "経常経費", ledger_type: "organization", is_public_subsidy_eligible: false, display_order: 502, polimoney_category: "事務所費", description: "机、椅子、事務用品、ガソリン等" },
  { code: "EXP_OFFICE", name: "事務所費", type: "expense", report_category: "経常経費", ledger_type: "organization", is_public_subsidy_eligible: false, display_order: 503, polimoney_category: "事務所費", description: "家賃、公租公課、保険料、通信費、修繕料等" },

  // ============================================
  // 支出科目 - 政治活動費（政治団体用）(type: expense)
  // ============================================
  { code: "EXP_ORGANIZATION", name: "組織活動費", type: "expense", report_category: "政治活動費", ledger_type: "organization", is_public_subsidy_eligible: false, display_order: 510, polimoney_category: "組織活動費", description: "大会費、行事費、組織対策費、渉外費、交際費等" },
  { code: "EXP_ELECTION", name: "選挙関係費", type: "expense", report_category: "政治活動費", ledger_type: "organization", is_public_subsidy_eligible: false, display_order: 511, polimoney_category: "選挙関係費", description: "公認推薦料、陣中見舞、選挙活動費等" },
  { code: "EXP_MAGAZINE", name: "機関紙誌の発行事業費", type: "expense", report_category: "政治活動費", ledger_type: "organization", is_public_subsidy_eligible: false, display_order: 512, polimoney_category: "広報費", description: "材料費、印刷費、発送費、原稿料等" },
  { code: "EXP_PUBLICITY", name: "宣伝事業費", type: "expense", report_category: "政治活動費", ledger_type: "organization", is_public_subsidy_eligible: false, display_order: 513, polimoney_category: "広報費", description: "遊説費、広告料、ポスター・ビラ作成費等" },
  { code: "EXP_PARTY_EVENT", name: "政治資金パーティー開催事業費", type: "expense", report_category: "政治活動費", ledger_type: "organization", is_public_subsidy_eligible: false, display_order: 514, polimoney_category: "組織活動費", description: "会場費、記念品代、講演諸経費等" },
  { code: "EXP_OTHER_BUSINESS", name: "その他の事業費", type: "expense", report_category: "政治活動費", ledger_type: "organization", is_public_subsidy_eligible: false, display_order: 515, polimoney_category: "その他支出" },
  { code: "EXP_RESEARCH", name: "調査研究費", type: "expense", report_category: "政治活動費", ledger_type: "organization", is_public_subsidy_eligible: false, display_order: 516, polimoney_category: "調査研究費", description: "研修会費、資料費、書籍購入費等" },
  { code: "EXP_DONATION", name: "寄附・交付金", type: "expense", report_category: "政治活動費", ledger_type: "organization", is_public_subsidy_eligible: false, display_order: 517, polimoney_category: "寄附・交付金", description: "政治団体への寄附、本部・支部への交付金等" },
  { code: "EXP_MISC", name: "その他の経費", type: "expense", report_category: "政治活動費", ledger_type: "organization", is_public_subsidy_eligible: false, display_order: 518, polimoney_category: "その他支出", description: "上記以外の政治活動費" },

  // ============================================
  // 支出科目 - 選挙運動費用（公職選挙法に基づく10費目）(type: expense)
  // ============================================
  { code: "EXP_PERSONNEL_ELEC", name: "人件費", type: "expense", report_category: "選挙運動費用", ledger_type: "election", is_public_subsidy_eligible: false, display_order: 550, polimoney_category: "人件費", description: "事務員報酬、車上運動員報酬、労務者報酬等" },
  { code: "EXP_BUILDING_ELEC", name: "家屋費", type: "expense", report_category: "選挙運動費用", ledger_type: "election", is_public_subsidy_eligible: false, display_order: 551, polimoney_category: "事務所費", description: "選挙事務所費（賃借料・設営費等）、集合会場費等" },
  { code: "EXP_COMMUNICATION_ELEC", name: "通信費", type: "expense", report_category: "選挙運動費用", ledger_type: "election", is_public_subsidy_eligible: false, display_order: 552, polimoney_category: "通信費", description: "電話料、切手代、郵便料等" },
  { code: "EXP_TRANSPORT_ELEC", name: "交通費", type: "expense", report_category: "選挙運動費用", ledger_type: "election", is_public_subsidy_eligible: false, display_order: 553, polimoney_category: "交通費", description: "運動員への交通費実費弁償、鉄道賃、車賃等" },
  { code: "EXP_PRINTING_ELEC", name: "印刷費", type: "expense", report_category: "選挙運動費用", ledger_type: "election", is_public_subsidy_eligible: true, display_order: 554, polimoney_category: "広報費", description: "はがき、ビラ、ポスター等の印刷代" },
  { code: "EXP_ADVERTISING_ELEC", name: "広告費", type: "expense", report_category: "選挙運動費用", ledger_type: "election", is_public_subsidy_eligible: true, display_order: 555, polimoney_category: "広報費", description: "看板・たすき作成費、拡声機借上料、新聞折込料等" },
  { code: "EXP_STATIONERY_ELEC", name: "文具費", type: "expense", report_category: "選挙運動費用", ledger_type: "election", is_public_subsidy_eligible: false, display_order: 556, polimoney_category: "事務所費", description: "用紙、ボールペン、コピー代、事務所消耗品等" },
  { code: "EXP_FOOD_ELEC", name: "食料費", type: "expense", report_category: "選挙運動費用", ledger_type: "election", is_public_subsidy_eligible: false, display_order: 557, polimoney_category: "組織活動費", description: "茶菓代、弁当代、運動員への弁当料・茶菓料実費弁償" },
  { code: "EXP_LODGING_ELEC", name: "休泊費", type: "expense", report_category: "選挙運動費用", ledger_type: "election", is_public_subsidy_eligible: false, display_order: 558, polimoney_category: "組織活動費", description: "運動員への宿泊料実費弁償、休憩所費用等" },
  { code: "EXP_MISC_ELEC", name: "雑費", type: "expense", report_category: "選挙運動費用", ledger_type: "election", is_public_subsidy_eligible: false, display_order: 559, polimoney_category: "その他支出", description: "上記以外の選挙運動費用" },
];

// ============================================
// 選挙公営費目マスタ（公費負担の費目と上限額）
// ============================================

interface PublicSubsidyItem {
  election_type_code: string;
  account_code: string;
  item_name: string;
  unit?: string;
  unit_price_limit?: number;
  quantity_formula?: string;
  max_quantity?: number;
  total_limit?: number;
  notes?: string;
}

const publicSubsidyItems: PublicSubsidyItem[] = [
  // ============================================
  // 衆議院議員選挙（小選挙区）
  // ============================================
  {
    election_type_code: "HR",
    account_code: "EXP_PRINTING_ELEC",
    item_name: "選挙運動用ポスター",
    unit: "枚",
    unit_price_limit: 525 + 31500, // 単価 525.06円 + 企画費31,500円を枚数按分
    quantity_formula: "掲示場数 × 2",
    notes: "公職選挙法第143条・第144条、1枚あたり525.06円、企画費31,500円（枚数按分）",
  },
  {
    election_type_code: "HR",
    account_code: "EXP_PRINTING_ELEC",
    item_name: "選挙運動用ビラ",
    unit: "枚",
    unit_price_limit: 8, // 1枚7.73円
    max_quantity: 70000,
    notes: "公職選挙法第142条第1項第5号、70,000枚まで、1枚7.73円",
  },
  {
    election_type_code: "HR",
    account_code: "EXP_COMMUNICATION_ELEC",
    item_name: "選挙運動用通常葉書",
    unit: "枚",
    max_quantity: 35000,
    notes: "公職選挙法第142条第1項第1号、35,000枚まで（無料）",
  },
  {
    election_type_code: "HR",
    account_code: "EXP_ADVERTISING_ELEC",
    item_name: "選挙運動用自動車",
    unit: "日",
    unit_price_limit: 16100, // 1日16,100円
    max_quantity: 12,
    notes: "公職選挙法第141条、使用日数12日以内、1日16,100円（燃料費含む）",
  },

  // ============================================
  // 参議院議員選挙（選挙区）
  // ============================================
  {
    election_type_code: "HC",
    account_code: "EXP_PRINTING_ELEC",
    item_name: "選挙運動用ポスター",
    unit: "枚",
    unit_price_limit: 525 + 31500,
    quantity_formula: "掲示場数 × 2",
    notes: "公職選挙法第143条・第144条",
  },
  {
    election_type_code: "HC",
    account_code: "EXP_PRINTING_ELEC",
    item_name: "選挙運動用ビラ",
    unit: "枚",
    unit_price_limit: 8,
    max_quantity: 100000,
    notes: "公職選挙法第142条第1項第6号、100,000枚まで",
  },
  {
    election_type_code: "HC",
    account_code: "EXP_COMMUNICATION_ELEC",
    item_name: "選挙運動用通常葉書",
    unit: "枚",
    max_quantity: 150000,
    notes: "公職選挙法第142条第1項第2号、150,000枚まで（無料）",
  },
  {
    election_type_code: "HC",
    account_code: "EXP_ADVERTISING_ELEC",
    item_name: "選挙運動用自動車",
    unit: "日",
    unit_price_limit: 16100,
    max_quantity: 17,
    notes: "公職選挙法第141条、使用日数17日以内",
  },

  // ============================================
  // 都道府県知事選挙
  // ============================================
  {
    election_type_code: "PG",
    account_code: "EXP_PRINTING_ELEC",
    item_name: "選挙運動用ポスター",
    unit: "枚",
    unit_price_limit: 525 + 31500,
    quantity_formula: "掲示場数 × 2",
    notes: "公職選挙法第143条・第144条",
  },
  {
    election_type_code: "PG",
    account_code: "EXP_PRINTING_ELEC",
    item_name: "選挙運動用ビラ",
    unit: "枚",
    unit_price_limit: 8,
    max_quantity: 500000,
    notes: "都道府県によって異なる場合あり",
  },
  {
    election_type_code: "PG",
    account_code: "EXP_ADVERTISING_ELEC",
    item_name: "選挙運動用自動車",
    unit: "日",
    unit_price_limit: 16100,
    max_quantity: 17,
    notes: "公職選挙法第141条",
  },

  // ============================================
  // 市区町村長選挙
  // ============================================
  {
    election_type_code: "CM",
    account_code: "EXP_PRINTING_ELEC",
    item_name: "選挙運動用ポスター",
    unit: "枚",
    unit_price_limit: 525 + 31500,
    quantity_formula: "掲示場数",
    notes: "条例による。市区町村によって異なる",
  },
  {
    election_type_code: "CM",
    account_code: "EXP_PRINTING_ELEC",
    item_name: "選挙運動用ビラ",
    unit: "枚",
    unit_price_limit: 8,
    max_quantity: 16000,
    notes: "条例による。一般市16,000枚、政令市100,000枚",
  },
  {
    election_type_code: "CM",
    account_code: "EXP_ADVERTISING_ELEC",
    item_name: "選挙運動用自動車",
    unit: "日",
    unit_price_limit: 16100,
    notes: "条例による",
  },

  // ============================================
  // 市区町村議会議員選挙
  // ============================================
  {
    election_type_code: "GM",
    account_code: "EXP_PRINTING_ELEC",
    item_name: "選挙運動用ポスター",
    unit: "枚",
    unit_price_limit: 525 + 31500,
    quantity_formula: "掲示場数",
    notes: "条例による。市区町村によって異なる",
  },
  {
    election_type_code: "GM",
    account_code: "EXP_PRINTING_ELEC",
    item_name: "選挙運動用ビラ",
    unit: "枚",
    unit_price_limit: 8,
    max_quantity: 4000,
    notes: "条例による。一般市4,000枚、政令市8,000枚",
  },
  {
    election_type_code: "GM",
    account_code: "EXP_ADVERTISING_ELEC",
    item_name: "選挙運動用自動車",
    unit: "日",
    unit_price_limit: 16100,
    notes: "条例による",
  },
];

// ============================================
// メイン処理
// ============================================

async function seedElectionTypes() {
  console.log("📋 選挙タイプを登録中...");

  const { error } = await supabase.from("election_types").upsert(electionTypes, {
    onConflict: "code",
  });

  if (error) {
    console.error("選挙タイプ登録エラー:", error);
    throw error;
  }

  console.log(`✅ 選挙タイプ ${electionTypes.length} 件を登録しました`);
}

async function seedAccountCodes() {
  console.log("📋 勘定科目を登録中...");

  const { error } = await supabase.from("account_codes").upsert(accountCodes, {
    onConflict: "code",
  });

  if (error) {
    console.error("勘定科目登録エラー:", error);
    throw error;
  }

  console.log(`✅ 勘定科目 ${accountCodes.length} 件を登録しました`);
}

async function seedPublicSubsidyItems() {
  console.log("📋 選挙公営費目を登録中...");

  // 既存データを削除してから再登録（IDを自動生成するため）
  const { error: deleteError } = await supabase
    .from("public_subsidy_items")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // 全削除

  if (deleteError) {
    console.error("既存データ削除エラー:", deleteError);
    // 無視して続行
  }

  const { error } = await supabase.from("public_subsidy_items").insert(publicSubsidyItems);

  if (error) {
    console.error("選挙公営費目登録エラー:", error);
    throw error;
  }

  console.log(`✅ 選挙公営費目 ${publicSubsidyItems.length} 件を登録しました`);
}

async function updateMasterMetadata() {
  const tables = ["account_codes", "election_types", "public_subsidy_items"];

  for (const table of tables) {
    const { error } = await supabase
      .from("master_metadata")
      .upsert({ table_name: table, last_updated_at: new Date().toISOString() }, {
        onConflict: "table_name",
      });

    if (error) {
      console.error(`master_metadata 更新エラー (${table}):`, error);
    }
  }

  console.log("✅ master_metadata を更新しました");
}

async function main() {
  console.log("🚀 勘定科目・選挙公営費目の seed を開始します...\n");

  try {
    // 選挙タイプを先に登録（public_subsidy_items の外部キー参照のため）
    await seedElectionTypes();

    // 勘定科目を登録（public_subsidy_items の外部キー参照のため）
    await seedAccountCodes();

    // 選挙公営費目を登録
    await seedPublicSubsidyItems();

    // マスタメタデータを更新
    await updateMasterMetadata();

    console.log("\n✅ 全ての seed が完了しました！");
  } catch (error) {
    console.error("\n❌ エラーが発生しました:", error);
    Deno.exit(1);
  }
}

main();
