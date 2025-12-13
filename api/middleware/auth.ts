import { Context, Next } from "hono";

/**
 * API Key 認証ミドルウェア
 * ヘッダー: X-API-Key
 */
export async function apiKeyAuth(c: Context, next: Next) {
  const apiKey = c.req.header("X-API-Key");
  const validApiKey = Deno.env.get("API_KEY");

  if (!validApiKey) {
    console.warn("Warning: API_KEY environment variable is not set");
    // 開発環境では警告のみで通過
    if (Deno.env.get("DENO_ENV") === "development") {
      await next();
      return;
    }
  }

  if (!apiKey) {
    return c.json({ error: "API Key is required" }, 401);
  }

  if (apiKey !== validApiKey) {
    return c.json({ error: "Invalid API Key" }, 401);
  }

  // サービス名をログ用に記録
  const serviceName = c.req.header("X-Service-Name") || "unknown";
  c.set("serviceName", serviceName);

  await next();
}

