/**
 * Polimoney 向け API ルーター
 *
 * 選挙収支データを Polimoney JSON 形式で提供
 *
 * エンドポイント:
 * - GET /elections/:electionId/journals - 選挙の収支データを取得
 * - GET /ledgers/:ledgerId/journals - 台帳ID指定で収支データを取得
 */

import { Hono } from "hono";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createPolimoneyResponse,
  type PublicJournal,
  type PublicLedger,
  type Politician,
  type Election,
} from "../lib/polimoney-transform.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SECRET_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const polimoneyRouter = new Hono();

/**
 * GET /elections/:electionId/journals
 *
 * 選挙IDを指定して収支データを取得
 * 複数の候補者が同じ選挙に出ている場合は politician_id でフィルタ
 *
 * Query Parameters:
 * - politician_id: 政治家ID（必須: 同じ選挙に複数候補者がいる場合）
 */
polimoneyRouter.get("/elections/:electionId/journals", async (c) => {
  const { electionId } = c.req.param();
  const politicianId = c.req.query("politician_id");

  try {
    // 1. 選挙情報を取得（district を JOIN）
    const { data: election, error: electionError } = await supabase
      .from("elections")
      .select(`
        id,
        name,
        type,
        election_date,
        district:districts(id, name)
      `)
      .eq("id", electionId)
      .single();

    if (electionError || !election) {
      return c.json({ error: "Election not found" }, 404);
    }

    // 2. 該当する public_ledger を取得
    let ledgerQuery = supabase
      .from("public_ledgers")
      .select("*")
      .eq("election_id", electionId);

    if (politicianId) {
      ledgerQuery = ledgerQuery.eq("politician_id", politicianId);
    }

    const { data: ledgers, error: ledgerError } = await ledgerQuery;

    if (ledgerError) {
      console.error("Ledger query error:", ledgerError);
      return c.json({ error: "Failed to fetch ledger" }, 500);
    }

    if (!ledgers || ledgers.length === 0) {
      return c.json({ error: "No ledger found for this election" }, 404);
    }

    // 複数候補者がいる場合は politician_id が必須
    if (ledgers.length > 1 && !politicianId) {
      return c.json({
        error: "Multiple candidates found for this election. Please specify politician_id.",
        candidates: ledgers.map((l) => ({
          politician_id: l.politician_id,
          ledger_id: l.id,
        })),
      }, 400);
    }

    const ledger = ledgers[0] as PublicLedger;

    // 3. 政治家情報を取得
    const { data: politician, error: politicianError } = await supabase
      .from("politicians")
      .select("id, name, name_kana")
      .eq("id", ledger.politician_id)
      .single();

    if (politicianError || !politician) {
      return c.json({ error: "Politician not found" }, 404);
    }

    // 4. 仕訳データを取得
    const { data: journals, error: journalsError } = await supabase
      .from("public_journals")
      .select("*")
      .eq("ledger_id", ledger.id)
      .order("date", { ascending: true });

    if (journalsError) {
      console.error("Journals query error:", journalsError);
      return c.json({ error: "Failed to fetch journals" }, 500);
    }

    // 5. Polimoney 形式に変換
    const response = createPolimoneyResponse(
      (journals || []) as PublicJournal[],
      ledger,
      politician as Politician,
      election as unknown as Election
    );

    return c.json(response);
  } catch (error) {
    console.error("Unexpected error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /ledgers/:ledgerId/journals
 *
 * 台帳IDを直接指定して収支データを取得
 */
polimoneyRouter.get("/ledgers/:ledgerId/journals", async (c) => {
  const { ledgerId } = c.req.param();

  try {
    // 1. 台帳情報を取得
    const { data: ledger, error: ledgerError } = await supabase
      .from("public_ledgers")
      .select("*")
      .eq("id", ledgerId)
      .single();

    if (ledgerError || !ledger) {
      return c.json({ error: "Ledger not found" }, 404);
    }

    // 選挙台帳のみ対応（政治団体台帳は別フォーマットの可能性）
    if (!ledger.election_id) {
      return c.json({
        error: "Only election ledgers are supported in this endpoint",
      }, 400);
    }

    // 2. 選挙情報を取得
    const { data: election, error: electionError } = await supabase
      .from("elections")
      .select(`
        id,
        name,
        type,
        election_date,
        district:districts(id, name)
      `)
      .eq("id", ledger.election_id)
      .single();

    if (electionError || !election) {
      return c.json({ error: "Election not found" }, 404);
    }

    // 3. 政治家情報を取得
    const { data: politician, error: politicianError } = await supabase
      .from("politicians")
      .select("id, name, name_kana")
      .eq("id", ledger.politician_id)
      .single();

    if (politicianError || !politician) {
      return c.json({ error: "Politician not found" }, 404);
    }

    // 4. 仕訳データを取得
    const { data: journals, error: journalsError } = await supabase
      .from("public_journals")
      .select("*")
      .eq("ledger_id", ledgerId)
      .order("date", { ascending: true });

    if (journalsError) {
      console.error("Journals query error:", journalsError);
      return c.json({ error: "Failed to fetch journals" }, 500);
    }

    // 5. Polimoney 形式に変換
    const response = createPolimoneyResponse(
      (journals || []) as PublicJournal[],
      ledger as PublicLedger,
      politician as Politician,
      election as unknown as Election
    );

    return c.json(response);
  } catch (error) {
    console.error("Unexpected error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /elections
 *
 * 利用可能な選挙一覧を取得（公開データがあるもののみ）
 */
polimoneyRouter.get("/elections", async (c) => {
  try {
    // public_ledgers に紐づく選挙のみ取得
    const { data: ledgers, error: ledgerError } = await supabase
      .from("public_ledgers")
      .select(`
        election_id,
        elections:election_id(
          id,
          name,
          type,
          election_date,
          district:districts(id, name)
        )
      `)
      .not("election_id", "is", null);

    if (ledgerError) {
      console.error("Ledger query error:", ledgerError);
      return c.json({ error: "Failed to fetch elections" }, 500);
    }

    // 重複を除去して選挙情報をまとめる
    const electionMap = new Map();
    for (const ledger of ledgers || []) {
      if (ledger.elections && !electionMap.has(ledger.elections.id)) {
        electionMap.set(ledger.elections.id, ledger.elections);
      }
    }

    const elections = Array.from(electionMap.values()).map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      election_date: e.election_date,
      district_id: e.district?.id ?? null,
      district_name: e.district?.name ?? null,
    }));

    // 選挙日の降順でソート
    elections.sort((a, b) =>
      new Date(b.election_date).getTime() - new Date(a.election_date).getTime()
    );

    return c.json({
      api_version: "v1",
      data: elections,
      total_count: elections.length,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /elections/:electionId/candidates
 *
 * 指定選挙の候補者一覧を取得
 */
polimoneyRouter.get("/elections/:electionId/candidates", async (c) => {
  const { electionId } = c.req.param();

  try {
    // 該当選挙の台帳を取得
    const { data: ledgers, error: ledgerError } = await supabase
      .from("public_ledgers")
      .select(`
        id,
        politician_id,
        total_income,
        total_expense,
        journal_count,
        politicians:politician_id(id, name, name_kana)
      `)
      .eq("election_id", electionId);

    if (ledgerError) {
      console.error("Ledger query error:", ledgerError);
      return c.json({ error: "Failed to fetch candidates" }, 500);
    }

    if (!ledgers || ledgers.length === 0) {
      return c.json({ error: "No candidates found for this election" }, 404);
    }

    const candidates = ledgers.map((l) => ({
      ledger_id: l.id,
      politician: l.politicians
        ? {
            id: l.politicians.id,
            name: l.politicians.name,
            name_kana: l.politicians.name_kana,
          }
        : null,
      summary: {
        total_income: l.total_income,
        total_expense: l.total_expense,
        balance: l.total_income - l.total_expense,
        journal_count: l.journal_count,
      },
    }));

    return c.json({
      api_version: "v1",
      election_id: electionId,
      data: candidates,
      total_count: candidates.length,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});
