/**
 * 認証ミドルウェア
 *
 * /login 以外のすべてのルートで認証をチェックし、
 * 未認証の場合は /login にリダイレクトする。
 */

import { FreshContext } from "$fresh/server.ts";
import {
  getSessionFromCookies,
  getCurrentUser,
  refreshAccessToken,
  setSessionCookies,
  clearSessionCookies,
  AdminUser,
} from "../lib/auth.ts";

// 認証不要のパス
const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/reset-password"];

export interface AuthState {
  user: AdminUser | null;
  accessToken: string | null;
  devMode: boolean;
}

export async function handler(
  req: Request,
  ctx: FreshContext<AuthState>
) {
  const url = new URL(req.url);

  // 静的ファイルはスキップ
  if (url.pathname.startsWith("/_frsh/") || url.pathname.startsWith("/static/")) {
    return ctx.next();
  }

  // 認証不要のパスはスキップ
  if (PUBLIC_PATHS.some((path) => url.pathname.startsWith(path))) {
    ctx.state.user = null;
    ctx.state.accessToken = null;
    ctx.state.devMode = false;
    return ctx.next();
  }

  // Cookie からトークンを取得
  const { accessToken, refreshToken } = getSessionFromCookies(req);

  // トークンがない場合はログインページへ
  if (!accessToken) {
    return redirectToLogin(url);
  }

  // ユーザー情報を取得
  let user = await getCurrentUser(accessToken);

  // トークンが無効な場合、リフレッシュを試みる
  if (!user && refreshToken) {
    const refreshResult = await refreshAccessToken(refreshToken);

    if (refreshResult.success) {
      // 新しいトークンでユーザー情報を取得
      user = await getCurrentUser(refreshResult.accessToken);

      if (user) {
        // レスポンスに新しい Cookie を設定
        const response = await ctx.next();
        const headers = new Headers(response.headers);
        setSessionCookies(headers, refreshResult.accessToken, refreshResult.refreshToken);
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
    }
  }

  // ユーザー情報が取得できない場合はログインページへ
  if (!user) {
    const response = redirectToLogin(url);
    // Cookie をクリア
    clearSessionCookies(response.headers);
    return response;
  }

  // 認証成功 - state にユーザー情報を設定
  ctx.state.user = user;
  ctx.state.accessToken = accessToken;

  // dev_mode を API から取得
  let devMode = false;
  try {
    const apiBase = Deno.env.get("API_BASE_URL") || "http://localhost:3722";
    const res = await fetch(`${apiBase}/api/admin/users/${user.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      devMode = data.data?.dev_mode ?? false;
    }
  } catch {
    // エラー時はデフォルト値
  }
  ctx.state.devMode = devMode;

  return ctx.next();
}

function redirectToLogin(currentUrl: URL): Response {
  const loginUrl = new URL("/login", currentUrl.origin);
  // ログイン後に元のページに戻れるようにリダイレクト先を保存
  if (currentUrl.pathname !== "/") {
    loginUrl.searchParams.set("redirect", currentUrl.pathname);
  }
  return new Response(null, {
    status: 302,
    headers: { Location: loginUrl.toString() },
  });
}
