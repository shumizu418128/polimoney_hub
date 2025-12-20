import { Context, Next } from "hono";

/**
 * API Key 認証ミドルウェア
 * ヘッダー: X-API-Key
 *
 * API_KEY_PROD: 本番用キー（is_test=false のデータのみ返す）
 * API_KEY_DEV: 開発用キー（is_test=true のデータのみ返す）
 */
export async function apiKeyAuth(c: Context, next: Next) {
  const apiKey = c.req.header("X-API-Key");
  const apiKeyProd = Deno.env.get("API_KEY_PROD") || Deno.env.get("API_KEY");
  const apiKeyDev = Deno.env.get("API_KEY_DEV");

  if (!apiKeyProd && !apiKeyDev) {
    console.warn("Warning: No API keys configured (API_KEY_PROD/API_KEY_DEV)");
    // 開発環境では警告のみで通過
    if (Deno.env.get("DENO_ENV") === "development") {
      c.set("isTestMode", false);
      await next();
      return;
    }
  }

  if (!apiKey) {
    return c.json({ error: "API Key is required" }, 401);
  }

  // DEV キーか PROD キーかを判定
  let isTestMode = false;
  if (apiKeyDev && apiKey === apiKeyDev) {
    isTestMode = true;
  } else if (apiKeyProd && apiKey === apiKeyProd) {
    isTestMode = false;
  } else {
    return c.json({ error: "Invalid API Key" }, 401);
  }

  // テストモードフラグをコンテキストに設定
  c.set("isTestMode", isTestMode);

  // サービス名をログ用に記録
  const serviceName = c.req.header("X-Service-Name") || "unknown";
  c.set("serviceName", serviceName);

  console.log(`[Auth] API call from ${serviceName}, isTestMode: ${isTestMode}`);

  await next();
}

