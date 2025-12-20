import { Hono } from "hono";
import { getServiceClient } from "../lib/supabase.ts";

export const organizationManagerVerificationsRouter = new Hono();

// 政治資金収支報告書情報
interface PoliticalFundReportInfo {
  organization_name: string; // 団体名
  representative_name: string; // 代表者名
  registration_authority: string; // 届出先（総務省/都道府県選管）
}

interface OrganizationManagerVerificationRequest {
  ledger_user_id: string;
  ledger_user_email: string;
  organization_id?: string;
  organization_name: string;
  organization_type?: string;
  official_email: string;
  role_in_organization?: string;
  // ドメイン変更用
  request_type?: "new" | "domain_change";
  previous_domain?: string;
  // 認証用追加情報（必須）
  political_fund_report_info: PoliticalFundReportInfo;
}

// lg.jpドメインかどうかを判定
function isLgJpDomain(domain: string): boolean {
  const lowerDomain = domain.toLowerCase();
  return lowerDomain === "lg.jp" || lowerDomain.endsWith(".lg.jp");
}

// UUID v4を生成
function generateUUID(): string {
  return crypto.randomUUID();
}

// 認証申請作成
organizationManagerVerificationsRouter.post("/", async (c) => {
  const body = await c.req.json<OrganizationManagerVerificationRequest>();

  if (!body.ledger_user_id || !body.ledger_user_email || !body.organization_name || !body.official_email) {
    return c.json(
      { error: "ledger_user_id, ledger_user_email, organization_name, and official_email are required" },
      400,
    );
  }

  // 政治資金収支報告書情報は必須
  if (!body.political_fund_report_info) {
    return c.json(
      { error: "政治資金収支報告書情報を入力してください。" },
      400,
    );
  }

  // メールアドレスからドメインを抽出
  const emailDomain = body.official_email.split("@")[1];
  if (!emailDomain) {
    return c.json({ error: "Invalid email address" }, 400);
  }

  // lg.jpドメインかどうかを判定
  const isLgDomain = isLgJpDomain(emailDomain);

  // lg.jp以外の場合、フリーメールドメインをブロック
  if (!isLgDomain) {
    const blockedDomains = [
      "gmail.com",
      "yahoo.co.jp",
      "yahoo.com",
      "hotmail.com",
      "outlook.com",
      "icloud.com",
      "docomo.ne.jp",
      "softbank.ne.jp",
      "ezweb.ne.jp",
      "au.com",
    ];
    if (blockedDomains.includes(emailDomain.toLowerCase())) {
      return c.json(
        { error: "フリーメールアドレスは使用できません。公式ドメインのメールアドレスを入力してください。" },
        400,
      );
    }
  }

  // 認証方式を決定
  const verificationMethod = isLgDomain ? "email" : "dns_txt";
  // DNS TXT認証の場合はトークンを生成
  const dnsTxtToken = verificationMethod === "dns_txt" ? generateUUID() : null;

  const supabase = getServiceClient();

  // 同一ユーザーの未承認申請数をチェック（最大3件）
  const { count: pendingCount, error: countError } = await supabase
    .from("organization_manager_verifications")
    .select("*", { count: "exact", head: true })
    .eq("ledger_user_id", body.ledger_user_id)
    .in("status", ["pending", "email_sent", "email_verified", "dns_verified"]);

  if (countError) {
    return c.json({ error: countError.message }, 500);
  }

  if (pendingCount && pendingCount >= 3) {
    return c.json(
      { error: "未承認の申請が3件あります。承認されるまでお待ちください。" },
      400,
    );
  }

  // 24時間以内の申請をチェック
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentRequest, error: recentError } = await supabase
    .from("organization_manager_verifications")
    .select("created_at")
    .eq("ledger_user_id", body.ledger_user_id)
    .gte("created_at", oneDayAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentError) {
    return c.json({ error: recentError.message }, 500);
  }

  if (recentRequest) {
    return c.json(
      { error: "申請は24時間に1回のみ可能です。" },
      400,
    );
  }

  // 申請を作成
  const { data, error } = await supabase
    .from("organization_manager_verifications")
    .insert({
      ledger_user_id: body.ledger_user_id,
      ledger_user_email: body.ledger_user_email,
      organization_id: body.organization_id || null,
      organization_name: body.organization_name,
      organization_type: body.organization_type || null,
      official_email: body.official_email,
      official_domain: emailDomain,
      status: "pending",
      request_type: body.request_type || "new",
      previous_domain: body.previous_domain || null,
      // 新規追加フィールド
      verification_method: verificationMethod,
      is_lg_domain: isLgDomain,
      dns_txt_token: dnsTxtToken,
      political_fund_report_info: body.political_fund_report_info,
    })
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data }, 201);
});

// メール認証コード送信（lg.jpドメインのみ）
organizationManagerVerificationsRouter.post("/:id/send-verification", async (c) => {
  const id = c.req.param("id");

  const supabase = getServiceClient();

  // 申請を取得
  const { data: verification, error: fetchError } = await supabase
    .from("organization_manager_verifications")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      return c.json({ error: "Verification request not found" }, 404);
    }
    return c.json({ error: fetchError.message }, 500);
  }

  // メール認証はlg.jpドメインのみ許可
  if (verification.verification_method !== "email") {
    return c.json(
      { error: "この申請はDNS TXT認証が必要です。メール認証は使用できません。" },
      400,
    );
  }

  if (verification.status !== "pending" && verification.status !== "email_sent") {
    return c.json(
      { error: "この申請はすでに処理されています" },
      400,
    );
  }

  // 6桁の認証コードを生成
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

  // 申請を更新
  const { error: updateError } = await supabase
    .from("organization_manager_verifications")
    .update({
      verification_code: verificationCode,
      verification_code_sent_at: new Date().toISOString(),
      status: "email_sent",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return c.json({ error: updateError.message }, 500);
  }

  // TODO: 実際のメール送信実装（Resend, SendGrid等）
  console.log(`[DEV] Verification code for ${verification.official_email}: ${verificationCode}`);

  return c.json({
    message: "認証コードを送信しました",
    ...(Deno.env.get("DENO_ENV") === "development" && { code: verificationCode }),
  });
});

// メール認証確認（lg.jpドメインのみ）
organizationManagerVerificationsRouter.post("/:id/verify-email", async (c) => {
  const id = c.req.param("id");
  const { code } = await c.req.json<{ code: string }>();

  if (!code) {
    return c.json({ error: "code is required" }, 400);
  }

  const supabase = getServiceClient();

  // 申請を取得
  const { data: verification, error: fetchError } = await supabase
    .from("organization_manager_verifications")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      return c.json({ error: "Verification request not found" }, 404);
    }
    return c.json({ error: fetchError.message }, 500);
  }

  if (verification.status !== "email_sent") {
    return c.json(
      { error: "認証コードが送信されていません" },
      400,
    );
  }

  // コードの有効期限チェック（30分）
  const sentAt = new Date(verification.verification_code_sent_at);
  const now = new Date();
  const diffMinutes = (now.getTime() - sentAt.getTime()) / (1000 * 60);
  if (diffMinutes > 30) {
    return c.json(
      { error: "認証コードの有効期限が切れています。再送信してください。" },
      400,
    );
  }

  // コードの検証
  if (verification.verification_code !== code) {
    return c.json(
      { error: "認証コードが正しくありません" },
      400,
    );
  }

  // 申請を更新
  const { error: updateError } = await supabase
    .from("organization_manager_verifications")
    .update({
      verification_code_verified_at: new Date().toISOString(),
      status: "email_verified",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return c.json({ error: updateError.message }, 500);
  }

  return c.json({
    message: "メール認証が完了しました。管理者の承認をお待ちください。",
  });
});

// DNS TXT認証検証
organizationManagerVerificationsRouter.post("/:id/verify-dns", async (c) => {
  const id = c.req.param("id");

  const supabase = getServiceClient();

  // 申請を取得
  const { data: verification, error: fetchError } = await supabase
    .from("organization_manager_verifications")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      return c.json({ error: "Verification request not found" }, 404);
    }
    return c.json({ error: fetchError.message }, 500);
  }

  // DNS TXT認証のみ許可
  if (verification.verification_method !== "dns_txt") {
    return c.json(
      { error: "この申請はメール認証が必要です。DNS TXT認証は使用できません。" },
      400,
    );
  }

  if (verification.status !== "pending") {
    return c.json(
      { error: "この申請はすでに処理されています" },
      400,
    );
  }

  if (!verification.dns_txt_token) {
    return c.json({ error: "DNS TXTトークンが設定されていません" }, 500);
  }

  // DNS TXTレコードを検証
  const domain = verification.official_domain;
  const expectedValue = `polimoney-verify=${verification.dns_txt_token}`;

  try {
    // Deno.resolveDnsを使用してTXTレコードを取得
    const txtRecords = await Deno.resolveDns(domain, "TXT");
    
    // TXTレコードの中から期待する値を探す
    let found = false;
    for (const records of txtRecords) {
      // TXTレコードは文字列の配列として返される
      const recordValue = Array.isArray(records) ? records.join("") : records;
      if (recordValue === expectedValue) {
        found = true;
        break;
      }
    }

    if (!found) {
      return c.json({
        error: "DNS TXTレコードが見つかりませんでした。設定を確認してください。",
        expected: {
          domain: domain,
          type: "TXT",
          value: expectedValue,
        },
      }, 400);
    }

    // 申請を更新
    const { error: updateError } = await supabase
      .from("organization_manager_verifications")
      .update({
        dns_txt_verified: true,
        dns_txt_verified_at: new Date().toISOString(),
        status: "dns_verified",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return c.json({ error: updateError.message }, 500);
    }

    return c.json({
      message: "DNS TXT認証が完了しました。管理者の承認をお待ちください。",
    });
  } catch (error) {
    console.error("DNS lookup error:", error);
    return c.json({
      error: "DNSの検索に失敗しました。ドメイン名を確認してください。",
      details: error instanceof Error ? error.message : "Unknown error",
    }, 400);
  }
});

// 申請一覧取得（Ledgerユーザー用）
organizationManagerVerificationsRouter.get("/user/:ledgerUserId", async (c) => {
  const ledgerUserId = c.req.param("ledgerUserId");

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("organization_manager_verifications")
    .select("*")
    .eq("ledger_user_id", ledgerUserId)
    .order("created_at", { ascending: false });

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data });
});

// 申請詳細取得
organizationManagerVerificationsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("organization_manager_verifications")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Verification request not found" }, 404);
    }
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data });
});
