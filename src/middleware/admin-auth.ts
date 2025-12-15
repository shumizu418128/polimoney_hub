import { Context, Next } from "hono";
import { getUserFromToken, getServiceClient } from "../lib/supabase.ts";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

/**
 * 管理者認証ミドルウェア
 * 
 * 認証方式（優先順）:
 * 1. Supabase Auth（Authorization: Bearer <token>）
 * 2. API Key（X-Admin-Key ヘッダー）- レガシー/開発用
 */
export async function adminAuth(c: Context, next: Next) {
  // 1. Authorization ヘッダーから Bearer トークンを取得
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const adminUser = await verifySupabaseToken(token);

    if (adminUser) {
      // コンテキストに管理者情報を設定
      c.set("adminUser", adminUser);
      await next();
      return;
    }

    return c.json({ error: "Invalid or expired token" }, 401);
  }

  // 2. レガシー: X-Admin-Key ヘッダー
  const adminKey = c.req.header("X-Admin-Key");
  const validAdminKey = Deno.env.get("ADMIN_API_KEY");

  if (adminKey && validAdminKey && adminKey === validAdminKey) {
    // レガシー認証成功
    c.set("adminUser", { id: "legacy", email: "admin", name: "Admin", role: "admin" });
    await next();
    return;
  }

  // 3. 開発環境ではスキップ可能
  if (Deno.env.get("DENO_ENV") === "development") {
    console.warn("Warning: Admin auth skipped in development mode");
    c.set("adminUser", { id: "dev", email: "dev@localhost", name: "Developer", role: "admin" });
    await next();
    return;
  }

  return c.json({ error: "Authentication required" }, 401);
}

/**
 * Supabase トークンを検証し、admin_users テーブルと照合
 */
async function verifySupabaseToken(token: string): Promise<AdminUser | null> {
  try {
    // トークンからユーザー情報を取得
    const user = await getUserFromToken(token);
    if (!user) {
      return null;
    }

    // admin_users テーブルで管理者権限を確認
    const supabase = getServiceClient();
    const { data: adminUser, error } = await supabase
      .from("admin_users")
      .select("id, email, name, role")
      .eq("id", user.id)
      .eq("is_active", true)
      .single();

    if (error || !adminUser) {
      console.warn(`User ${user.email} is not an admin or inactive`);
      return null;
    }

    return adminUser as AdminUser;
  } catch (e) {
    console.error("Error verifying Supabase token:", e);
    return null;
  }
}

/**
 * スーパー管理者のみ許可するミドルウェア
 */
export async function superAdminOnly(c: Context, next: Next) {
  const adminUser = c.get("adminUser") as AdminUser | undefined;

  if (!adminUser) {
    return c.json({ error: "Authentication required" }, 401);
  }

  if (adminUser.role !== "super_admin") {
    return c.json({ error: "Super admin access required" }, 403);
  }

  await next();
}
