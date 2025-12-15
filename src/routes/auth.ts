import { Hono } from "hono";
import { getServiceClient, getPublicClient } from "../lib/supabase.ts";

export const authRouter = new Hono();

/**
 * POST /auth/login
 * メールとパスワードでログイン
 */
authRouter.post("/login", async (c) => {
  const body = await c.req.json<{ email: string; password: string }>();

  if (!body.email || !body.password) {
    return c.json({ error: "email and password are required" }, 400);
  }

  try {
    const supabase = getPublicClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (error) {
      return c.json({ error: error.message }, 401);
    }

    // admin_users テーブルで管理者権限を確認
    const serviceClient = getServiceClient();
    const { data: adminUser, error: adminError } = await serviceClient
      .from("admin_users")
      .select("id, email, name, role")
      .eq("id", data.user.id)
      .eq("is_active", true)
      .single();

    if (adminError || !adminUser) {
      // 管理者ではない場合はサインアウト
      await supabase.auth.signOut();
      return c.json({ error: "Not authorized as admin" }, 403);
    }

    return c.json({
      data: {
        user: adminUser,
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        },
      },
    });
  } catch (e) {
    console.error("Login error:", e);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * POST /auth/refresh
 * アクセストークンを更新
 */
authRouter.post("/refresh", async (c) => {
  const body = await c.req.json<{ refresh_token: string }>();

  if (!body.refresh_token) {
    return c.json({ error: "refresh_token is required" }, 400);
  }

  try {
    const supabase = getPublicClient();
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: body.refresh_token,
    });

    if (error) {
      return c.json({ error: error.message }, 401);
    }

    return c.json({
      data: {
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        expires_at: data.session?.expires_at,
      },
    });
  } catch (e) {
    console.error("Refresh error:", e);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * POST /auth/logout
 * ログアウト
 */
authRouter.post("/logout", async (c) => {
  // クライアント側でトークンを破棄するだけで OK
  // サーバー側での処理は特に必要なし
  return c.json({ message: "Logged out" });
});

/**
 * GET /auth/me
 * 現在のユーザー情報を取得
 */
authRouter.get("/me", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Authorization header required" }, 401);
  }

  const token = authHeader.substring(7);

  try {
    const supabase = getServiceClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return c.json({ error: "Invalid token" }, 401);
    }

    const { data: adminUser, error: adminError } = await supabase
      .from("admin_users")
      .select("id, email, name, role")
      .eq("id", userData.user.id)
      .eq("is_active", true)
      .single();

    if (adminError || !adminUser) {
      return c.json({ error: "Not authorized as admin" }, 403);
    }

    return c.json({ data: adminUser });
  } catch (e) {
    console.error("Me error:", e);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * POST /auth/update-password
 * パスワードを更新（招待後の初回設定 or リセット）
 */
authRouter.post("/update-password", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Authorization header required" }, 401);
  }

  const token = authHeader.substring(7);
  const body = await c.req.json<{ password: string }>();

  if (!body.password) {
    return c.json({ error: "password is required" }, 400);
  }

  if (body.password.length < 8) {
    return c.json({ error: "Password must be at least 8 characters" }, 400);
  }

  try {
    const supabase = getServiceClient();

    // トークンでユーザーを検証
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return c.json({ error: "Invalid token" }, 401);
    }

    // パスワードを更新
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userData.user.id,
      { password: body.password }
    );

    if (updateError) {
      console.error("Password update error:", updateError);
      return c.json({ error: "Failed to update password" }, 500);
    }

    return c.json({ message: "Password updated successfully" });
  } catch (e) {
    console.error("Update password error:", e);
    return c.json({ error: "Internal server error" }, 500);
  }
});
