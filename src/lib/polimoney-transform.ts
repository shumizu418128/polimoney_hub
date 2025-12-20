/**
 * Polimoney 向けデータ変換ロジック
 *
 * Hub の public_journals データを Polimoney JSON 形式に変換する
 */

import {
  getCategoryName,
  getElectionTypeName,
  CATEGORIES,
  type CategoryCode,
} from "./constants.ts";

// ============================================
// 型定義（Hub DB）
// ============================================

/** Hub の public_journals テーブルのレコード */
export interface PublicJournal {
  id: string;
  ledger_id: string;
  journal_source_id: string;
  date: string | null;
  description: string | null;
  amount: number;
  contact_name: string | null;
  contact_type: string | null;
  account_code: string | null;
  classification: string | null; // 'campaign' | 'pre-campaign'
  non_monetary_basis: string | null;
  note: string | null;
  public_expense_amount: number | null;
  content_hash: string;
  synced_at: string;
  created_at: string;
}

/** Hub の public_ledgers テーブルのレコード */
export interface PublicLedger {
  id: string;
  politician_id: string;
  organization_id: string | null;
  election_id: string | null;
  fiscal_year: number;
  total_income: number;
  total_expense: number;
  journal_count: number;
  ledger_source_id: string;
  last_updated_at: string;
  first_synced_at: string;
  created_at: string;
}

/** Hub の politicians テーブルのレコード */
export interface Politician {
  id: string;
  name: string;
  name_kana: string | null;
  is_lg_verified: boolean;
}

/** Hub の elections テーブルのレコード（JOIN済み） */
export interface Election {
  id: string;
  name: string;
  type: string;
  election_date: string;
  district?: {
    id: string;
    name: string;
  } | null;
}

// ============================================
// 型定義（Polimoney JSON 形式）
// ============================================

/** Polimoney JSON: 政治家情報 */
export interface PolimoneyPolitician {
  id: string;
  name: string;
  name_kana: string | null;
  /** lg.jpドメインで認証されたか（自治体ドメイン認証） */
  is_lg_verified: boolean;
}

/** Polimoney JSON: 選挙情報 */
export interface PolimoneyElection {
  id: string;
  name: string;
  type: string;
  type_name: string;
  district_id: string | null;
  district_name: string | null;
  election_date: string;
}

/** Polimoney JSON: 集計サマリー */
export interface PolimoneySummary {
  total_income: number;
  total_expense: number;
  balance: number;
  public_expense_total: number;
  journal_count: number;
}

/** Polimoney JSON: メタ情報 */
export interface PolimoneyMeta {
  api_version: string;
  politician: PolimoneyPolitician;
  election: PolimoneyElection;
  summary: PolimoneySummary;
  generated_at: string;
}

/** Polimoney JSON: 仕訳エントリ */
export interface PolimoneyJournalEntry {
  data_id: string;
  date: string | null;
  amount: number;
  category: string;
  category_name: string;
  type: string;
  purpose: string | null;
  non_monetary_basis: string | null;
  note: string | null;
  public_expense_amount: number | null;
}

/** Polimoney JSON: API レスポンス全体 */
export interface PolimoneyResponse {
  meta: PolimoneyMeta;
  data: PolimoneyJournalEntry[];
}

// ============================================
// account_code → category マッピング
// ============================================

const ACCOUNT_CODE_TO_CATEGORY: Record<string, CategoryCode> = {
  // 支出（選挙運動費用）
  EXP_PERSONNEL_ELEC: "personnel",
  EXP_BUILDING_ELEC: "building",
  EXP_COMMUNICATION_ELEC: "communication",
  EXP_TRANSPORT_ELEC: "transportation",
  EXP_PRINTING_ELEC: "printing",
  EXP_ADVERTISING_ELEC: "advertising",
  EXP_STATIONERY_ELEC: "stationery",
  EXP_FOOD_ELEC: "food",
  EXP_LODGING_ELEC: "lodging",
  EXP_MISC_ELEC: "miscellaneous",

  // 収入
  REV_SELF_FINANCING: "other_income",
  REV_LOAN_ELEC: "other_income",
  REV_DONATION_INDIVIDUAL_ELEC: "donation",
  REV_DONATION_POLITICAL_ELEC: "donation",
  REV_MISC_ELEC: "other_income",
} as const;

/**
 * account_code から category を導出
 */
export function deriveCategory(accountCode: string | null): CategoryCode {
  if (!accountCode) {
    return "miscellaneous";
  }

  const category = ACCOUNT_CODE_TO_CATEGORY[accountCode];
  if (category) {
    return category;
  }

  // プレフィックスで判断
  if (accountCode.startsWith("REV_")) {
    if (accountCode.includes("DONATION")) {
      return "donation";
    }
    return "other_income";
  }
  if (accountCode.startsWith("EXP_")) {
    return "miscellaneous";
  }

  return "miscellaneous";
}

/**
 * category が収入かどうか
 */
function isIncomeCategory(category: string): boolean {
  const cat = CATEGORIES[category as CategoryCode];
  return cat?.type === "income";
}

// ============================================
// type 導出ロジック
// ============================================

/**
 * type を導出（選挙台帳用）
 */
export function deriveType(
  classification: string | null,
  accountCode: string | null,
  category: string
): string {
  // 収入の場合
  if (isIncomeCategory(category)) {
    if (category === "donation") {
      return "寄附";
    }
    return "その他の収入";
  }

  // 支出の場合
  if (classification === "campaign") {
    return "選挙運動";
  }
  if (classification === "pre-campaign") {
    return "立候補準備のための支出";
  }

  // デフォルト（選挙台帳の支出）
  return "選挙運動";
}

// ============================================
// 変換関数
// ============================================

/**
 * PublicJournal → PolimoneyJournalEntry に変換
 */
export function transformJournal(
  journal: PublicJournal
): PolimoneyJournalEntry {
  const category = deriveCategory(journal.account_code);
  const type = deriveType(journal.classification, journal.account_code, category);

  return {
    data_id: journal.id,
    date: journal.date,
    amount: journal.amount,
    category,
    category_name: getCategoryName(category),
    type,
    purpose: journal.description,
    non_monetary_basis: journal.non_monetary_basis,
    note: journal.note,
    public_expense_amount: journal.public_expense_amount,
  };
}

/**
 * Election → PolimoneyElection に変換
 */
export function transformElection(
  election: Election
): PolimoneyElection {
  return {
    id: election.id,
    name: election.name,
    type: election.type,
    type_name: getElectionTypeName(election.type),
    district_id: election.district?.id ?? null,
    district_name: election.district?.name ?? null,
    election_date: election.election_date,
  };
}

/**
 * サマリーを計算
 */
export function calculateSummary(
  journals: PublicJournal[],
  ledger: PublicLedger
): PolimoneySummary {
  let publicExpenseTotal = 0;

  for (const journal of journals) {
    if (journal.public_expense_amount && journal.public_expense_amount > 0) {
      publicExpenseTotal += journal.public_expense_amount;
    }
  }

  return {
    total_income: ledger.total_income,
    total_expense: ledger.total_expense,
    balance: ledger.total_income - ledger.total_expense,
    public_expense_total: publicExpenseTotal,
    journal_count: journals.length,
  };
}

/**
 * Polimoney API レスポンスを生成
 */
export function createPolimoneyResponse(
  journals: PublicJournal[],
  ledger: PublicLedger,
  politician: Politician,
  election: Election
): PolimoneyResponse {
  const data = journals.map(transformJournal);
  const summary = calculateSummary(journals, ledger);

  return {
    meta: {
      api_version: "v1",
      politician: {
        id: politician.id,
        name: politician.name,
        name_kana: politician.name_kana,
        is_lg_verified: politician.is_lg_verified ?? false,
      },
      election: transformElection(election),
      summary,
      generated_at: new Date().toISOString(),
    },
    data,
  };
}

// ============================================
// ユーティリティ
// ============================================

/**
 * 利用可能な category 一覧を取得
 */
export function getAvailableCategories(): CategoryCode[] {
  return Object.keys(CATEGORIES) as CategoryCode[];
}

/**
 * 利用可能な type 一覧を取得
 */
export function getAvailableTypes(): string[] {
  return ["選挙運動", "立候補準備のための支出", "寄附", "その他の収入"];
}
