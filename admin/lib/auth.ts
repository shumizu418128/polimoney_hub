/**
 * 管理画面の認証ヘルパー
 *
 * Cookie ベースで JWT トークンを管理し、
 * Hub API との認証を行う。
 */

import { getCookies, setCookie, deleteCookie } from "$std/http/cookie.ts";

const API_BASE_URL = Deno.env.get("API_BASE_URL") || "http://localhost:8000";
const COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  secure: Deno.env.get("DENO_ENV") === "production",
  sameSite: "Lax" as const,
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export interface AuthSession {
  user: AdminUser;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * Cookie からセッション情報を取得
 */
export function getSessionFromCookies(req: Request): {
  accessToken: string | null;
  refreshToken: string | null;
} {
  const cookies = getCookies(req.headers);
  return {
    accessToken: cookies["access_token"] || null,
    refreshToken: cookies["refresh_token"] || null,
  };
}

/**
 * Cookie にセッション情報を保存
 */
export function setSessionCookies(
  headers: Headers,
  accessToken: string,
  refreshToken: string
): void {
  setCookie(headers, {
    name: "access_token",
    value: accessToken,
    ...COOKIE_OPTIONS,
  });
  setCookie(headers, {
    name: "refresh_token",
    value: refreshToken,
    ...COOKIE_OPTIONS,
  });
}

/**
 * Cookie からセッション情報を削除
 */
export function clearSessionCookies(headers: Headers): void {
  deleteCookie(headers, "access_token", { path: "/" });
  deleteCookie(headers, "refresh_token", { path: "/" });
}

/**
 * ログイン API を呼び出し
 */
export async function login(
  email: string,
  password: string
): Promise<{ success: true; data: AuthSession } | { success: false; error: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const json = await res.json();

    if (!res.ok) {
      return { success: false, error: json.error || "Login failed" };
    }

    return {
      success: true,
      data: {
        user: json.data.user,
        accessToken: json.data.session.access_token,
        refreshToken: json.data.session.refresh_token,
        expiresAt: json.data.session.expires_at,
      },
    };
  } catch (e) {
    console.error("Login error:", e);
    return { success: false, error: "Network error" };
  }
}

/**
 * トークンをリフレッシュ
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ success: true; accessToken: string; refreshToken: string } | { success: false; error: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    const json = await res.json();

    if (!res.ok) {
      return { success: false, error: json.error || "Refresh failed" };
    }

    return {
      success: true,
      accessToken: json.data.access_token,
      refreshToken: json.data.refresh_token,
    };
  } catch (e) {
    console.error("Refresh error:", e);
    return { success: false, error: "Network error" };
  }
}

/**
 * 現在のユーザー情報を取得
 */
export async function getCurrentUser(
  accessToken: string
): Promise<AdminUser | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    return json.data;
  } catch (e) {
    console.error("Get current user error:", e);
    return null;
  }
}

/**
 * 認証済みの API リクエストを送信
 */
export async function fetchWithAuth(
  accessToken: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
