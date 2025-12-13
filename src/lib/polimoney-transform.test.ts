/**
 * polimoney-transform.ts のテスト
 * 実行: deno test --allow-read src/lib/polimoney-transform.test.ts
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  deriveCategory,
  deriveType,
  transformToPolimoneyFormat,
  createPolimoneyResponse,
  isIncomeAccount,
  isExpenseAccount,
  type PublicJournal,
  type PublicLedger,
} from "./polimoney-transform.ts";

// ============================================
// deriveCategory テスト
// ============================================

Deno.test("deriveCategory - 人件費", () => {
  assertEquals(deriveCategory("EXP_PERSONNEL_ELEC"), "personnel");
});

Deno.test("deriveCategory - 印刷費", () => {
  assertEquals(deriveCategory("EXP_PRINTING_ELEC"), "printing");
});

Deno.test("deriveCategory - 収入（寄附）", () => {
  assertEquals(deriveCategory("REV_DONATION_INDIVIDUAL_ELEC"), "income");
});

Deno.test("deriveCategory - 未知の支出はmiscellaneous", () => {
  assertEquals(deriveCategory("EXP_UNKNOWN"), "miscellaneous");
});

Deno.test("deriveCategory - 未知の収入はincome", () => {
  assertEquals(deriveCategory("REV_UNKNOWN"), "income");
});

Deno.test("deriveCategory - nullはmiscellaneous", () => {
  assertEquals(deriveCategory(null), "miscellaneous");
});

// ============================================
// deriveType テスト
// ============================================

const electionLedger: PublicLedger = {
  id: "ledger-1",
  election_id: "election-1",
  organization_id: null,
};

const orgLedger: PublicLedger = {
  id: "ledger-2",
  election_id: null,
  organization_id: "org-1",
};

Deno.test("deriveType - 選挙台帳 + campaign → 選挙運動", () => {
  assertEquals(
    deriveType(electionLedger, "campaign", "EXP_PERSONNEL_ELEC", true),
    "選挙運動"
  );
});

Deno.test(
  "deriveType - 選挙台帳 + pre-campaign → 立候補準備のための支出",
  () => {
    assertEquals(
      deriveType(electionLedger, "pre-campaign", "EXP_PRINTING_ELEC", true),
      "立候補準備のための支出"
    );
  }
);

Deno.test("deriveType - 選挙台帳 + 寄附収入 → 寄附", () => {
  assertEquals(
    deriveType(electionLedger, null, "REV_DONATION_INDIVIDUAL_ELEC", false),
    "寄附"
  );
});

Deno.test("deriveType - 選挙台帳 + その他収入 → その他の収入", () => {
  assertEquals(
    deriveType(electionLedger, null, "REV_SELF_FINANCING", false),
    "その他の収入"
  );
});

Deno.test("deriveType - 政治団体台帳 → null", () => {
  assertEquals(
    deriveType(orgLedger, "campaign", "EXP_PERSONNEL_ELEC", true),
    null
  );
});

// ============================================
// transformToPolimoneyFormat テスト
// ============================================

Deno.test("transformToPolimoneyFormat - 基本変換", () => {
  const journal: PublicJournal = {
    id: "journal-1",
    ledger_id: "ledger-1",
    journal_source_id: "source-1",
    date: "2025-06-10",
    description: "車上運動員報酬",
    amount: 30605,
    contact_name: "山田太郎",
    contact_type: "individual",
    account_code: "EXP_PERSONNEL_ELEC",
    classification: "campaign",
    non_monetary_basis: null,
    note: "5/23~25分",
    public_expense_amount: null,
    content_hash: "abc123",
    synced_at: "2025-06-15T10:00:00Z",
    created_at: "2025-06-15T10:00:00Z",
  };

  const result = transformToPolimoneyFormat(journal, electionLedger);

  assertEquals(result.data_id, "journal-1");
  assertEquals(result.date, "2025-06-10");
  assertEquals(result.price, 30605);
  assertEquals(result.category, "personnel");
  assertEquals(result.type, "選挙運動");
  assertEquals(result.purpose, "車上運動員報酬");
  assertEquals(result.note, "5/23~25分");
  assertEquals(result.public_expense_amount, undefined);
});

Deno.test("transformToPolimoneyFormat - 公費負担額あり", () => {
  const journal: PublicJournal = {
    id: "journal-2",
    ledger_id: "ledger-1",
    journal_source_id: "source-2",
    date: "2025-06-10",
    description: "選挙ポスター印刷",
    amount: 200000,
    contact_name: "印刷会社",
    contact_type: "corporation",
    account_code: "EXP_PRINTING_ELEC",
    classification: "campaign",
    non_monetary_basis: null,
    note: null,
    public_expense_amount: 150000,
    content_hash: "def456",
    synced_at: "2025-06-15T10:00:00Z",
    created_at: "2025-06-15T10:00:00Z",
  };

  const result = transformToPolimoneyFormat(journal, electionLedger);

  assertEquals(result.category, "printing");
  assertEquals(result.public_expense_amount, 150000);
});

Deno.test("transformToPolimoneyFormat - 公費負担額0は出力しない", () => {
  const journal: PublicJournal = {
    id: "journal-3",
    ledger_id: "ledger-1",
    journal_source_id: "source-3",
    date: "2025-06-10",
    description: "文具購入",
    amount: 5000,
    contact_name: null,
    contact_type: null,
    account_code: "EXP_STATIONERY_ELEC",
    classification: "campaign",
    non_monetary_basis: null,
    note: null,
    public_expense_amount: 0,
    content_hash: "ghi789",
    synced_at: "2025-06-15T10:00:00Z",
    created_at: "2025-06-15T10:00:00Z",
  };

  const result = transformToPolimoneyFormat(journal, electionLedger);

  assertEquals(result.public_expense_amount, undefined);
});

// ============================================
// createPolimoneyResponse テスト
// ============================================

Deno.test("createPolimoneyResponse - メタ情報付きレスポンス", () => {
  const journals: PublicJournal[] = [
    {
      id: "journal-1",
      ledger_id: "ledger-1",
      journal_source_id: "source-1",
      date: "2025-06-10",
      description: "テスト",
      amount: 1000,
      contact_name: null,
      contact_type: null,
      account_code: "EXP_MISC_ELEC",
      classification: "campaign",
      non_monetary_basis: null,
      note: null,
      public_expense_amount: null,
      content_hash: "abc",
      synced_at: "2025-06-15T10:00:00Z",
      created_at: "2025-06-15T10:00:00Z",
    },
  ];

  const response = createPolimoneyResponse(journals, electionLedger, {
    election: { id: "election-1", name: "2025年市議会議員選挙" },
  });

  assertEquals(response.meta.api_version, "v1");
  assertEquals(response.meta.total_count, 1);
  assertEquals(response.meta.election?.name, "2025年市議会議員選挙");
  assertEquals(response.data.length, 1);
});

// ============================================
// ユーティリティ関数テスト
// ============================================

Deno.test("isIncomeAccount", () => {
  assertEquals(isIncomeAccount("REV_DONATION_INDIVIDUAL_ELEC"), true);
  assertEquals(isIncomeAccount("EXP_PERSONNEL_ELEC"), false);
  assertEquals(isIncomeAccount(null), false);
});

Deno.test("isExpenseAccount", () => {
  assertEquals(isExpenseAccount("EXP_PERSONNEL_ELEC"), true);
  assertEquals(isExpenseAccount("REV_DONATION_INDIVIDUAL_ELEC"), false);
  assertEquals(isExpenseAccount(null), false);
});

console.log("✅ All tests passed!");
