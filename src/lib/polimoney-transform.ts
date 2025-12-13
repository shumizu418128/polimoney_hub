/**
 * Polimoney 向けデータ変換ロジック
 *
 * Hub の public_journals データを Polimoney JSON 形式に変換する
 */

// ============================================
// 型定義
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

/** 関連する public_ledgers の情報 */
export interface PublicLedger {
  id: string;
  election_id: string | null;
  organization_id: string | null;
}

/** Polimoney JSON 形式のエントリ */
export interface PolimoneyEntry {
  data_id: string;
  date: string | null;
  price: number;
  category: string;
  type: string | null;
  purpose: string | null;
  non_monetary_basis: string | null;
  note: string | null;
  public_expense_amount?: number;
}

/** Polimoney API レスポンス形式 */
export interface PolimoneyResponse {
  data: PolimoneyEntry[];
  meta: {
    api_version: string;
    total_count: number;
    election?: {
      id: string;
      name: string;
    };
    organization?: {
      id: string;
      name: string;
    };
  };
}

// ============================================
// account_code → category マッピング
// ============================================

const ACCOUNT_CODE_TO_CATEGORY: Record<string, string> = {
  // 支出（選挙運動費用）
  EXP_PERSONNEL_ELEC: "personnel",
  EXP_BUILDING_ELEC: "building",
  EXP_COMMUNICATION_ELEC: "communication",
  EXP_TRANSPORT_ELEC: "transport",
  EXP_PRINTING_ELEC: "printing",
  EXP_ADVERTISING_ELEC: "advertising",
  EXP_STATIONERY_ELEC: "stationery",
  EXP_FOOD_ELEC: "food",
  EXP_LODGING_ELEC: "lodging",
  EXP_MISC_ELEC: "miscellaneous",

  // 収入（すべて income）
  REV_SELF_FINANCING: "income",
  REV_LOAN_ELEC: "income",
  REV_DONATION_INDIVIDUAL_ELEC: "income",
  REV_DONATION_POLITICAL_ELEC: "income",
  REV_MISC_ELEC: "income",
} as const;

/**
 * account_code から category を導出
 */
export function deriveCategory(accountCode: string | null): string {
  if (!accountCode) {
    return "miscellaneous"; // デフォルト
  }

  const category = ACCOUNT_CODE_TO_CATEGORY[accountCode];
  if (category) {
    return category;
  }

  // プレフィックスで判断
  if (accountCode.startsWith("REV_")) {
    return "income";
  }
  if (accountCode.startsWith("EXP_")) {
    return "miscellaneous";
  }

  return "miscellaneous";
}

// ============================================
// type 導出ロジック
// ============================================

/**
 * type を導出（選挙台帳のみ）
 *
 * @param ledger - 関連する台帳情報
 * @param classification - 活動区分 ('campaign' | 'pre-campaign')
 * @param accountCode - 勘定科目コード
 * @param isExpense - 支出かどうか
 */
export function deriveType(
  ledger: PublicLedger,
  classification: string | null,
  accountCode: string | null,
  isExpense: boolean
): string | null {
  // 政治団体台帳（election_id がない）の場合は type を出力しない
  if (!ledger.election_id) {
    return null;
  }

  // 収入の場合
  if (!isExpense) {
    if (accountCode?.includes("DONATION")) {
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
// メイン変換関数
// ============================================

/**
 * Hub public_journals → Polimoney JSON 形式に変換
 */
export function transformToPolimoneyFormat(
  journal: PublicJournal,
  ledger: PublicLedger
): PolimoneyEntry {
  const category = deriveCategory(journal.account_code);
  const isExpense = category !== "income";
  const type = deriveType(
    ledger,
    journal.classification,
    journal.account_code,
    isExpense
  );

  const entry: PolimoneyEntry = {
    data_id: journal.id,
    date: journal.date,
    price: journal.amount,
    category,
    type,
    purpose: journal.description,
    non_monetary_basis: journal.non_monetary_basis,
    note: journal.note,
  };

  // public_expense_amount は > 0 の場合のみ出力
  if (journal.public_expense_amount && journal.public_expense_amount > 0) {
    entry.public_expense_amount = journal.public_expense_amount;
  }

  return entry;
}

/**
 * 複数の journals を一括変換
 */
export function transformJournalsToPolimoney(
  journals: PublicJournal[],
  ledger: PublicLedger
): PolimoneyEntry[] {
  return journals.map((journal) => transformToPolimoneyFormat(journal, ledger));
}

/**
 * Polimoney API レスポンスを生成
 */
export function createPolimoneyResponse(
  journals: PublicJournal[],
  ledger: PublicLedger,
  options: {
    election?: { id: string; name: string };
    organization?: { id: string; name: string };
  } = {}
): PolimoneyResponse {
  const data = transformJournalsToPolimoney(journals, ledger);

  return {
    data,
    meta: {
      api_version: "v1",
      total_count: data.length,
      ...(options.election && { election: options.election }),
      ...(options.organization && { organization: options.organization }),
    },
  };
}

// ============================================
// ユーティリティ
// ============================================

/**
 * account_code が収入かどうかを判定
 */
export function isIncomeAccount(accountCode: string | null): boolean {
  if (!accountCode) return false;
  return accountCode.startsWith("REV_");
}

/**
 * account_code が支出かどうかを判定
 */
export function isExpenseAccount(accountCode: string | null): boolean {
  if (!accountCode) return false;
  return accountCode.startsWith("EXP_");
}

/**
 * 利用可能な category 一覧を取得
 */
export function getAvailableCategories(): string[] {
  return [...new Set(Object.values(ACCOUNT_CODE_TO_CATEGORY))];
}

/**
 * 利用可能な type 一覧を取得
 */
export function getAvailableTypes(): string[] {
  return ["選挙運動", "立候補準備のための支出", "寄附", "その他の収入"];
}
