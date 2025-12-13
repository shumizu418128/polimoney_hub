import { Context, Next } from "hono";

/**
 * 管理者 API Key 認証ミドルウェア
 * ヘッダー: X-Admin-Key
 */
export async function adminAuth(c: Context, next: Next) {
  const adminKey = c.req.header("X-Admin-Key");
  const validAdminKey = Deno.env.get("ADMIN_API_KEY");

  if (!validAdminKey) {
    console.warn("Warning: ADMIN_API_KEY environment variable is not set");
    // 開発環境では警告のみで通過
    if (Deno.env.get("DENO_ENV") === "development") {
      await next();
      return;
    }
    return c.json({ error: "Admin API is not configured" }, 500);
  }

  if (!adminKey) {
    return c.json({ error: "Admin API Key is required" }, 401);
  }

  if (adminKey !== validAdminKey) {
    return c.json({ error: "Invalid Admin API Key" }, 401);
  }

  await next();
}

