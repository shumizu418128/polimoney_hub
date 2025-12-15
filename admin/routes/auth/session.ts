import { Handlers } from "$fresh/server.ts";
import { setSessionCookies, getCurrentUser } from "../../lib/auth.ts";

/**
 * セッション作成 API
 *
 * クライアントサイドで取得したトークンを
 * Cookie に保存する。
 */

export const handler: Handlers = {
  async POST(req, _ctx) {
    try {
      const body = await req.json();
      const { access_token, refresh_token } = body;

      if (!access_token || !refresh_token) {
        return new Response(JSON.stringify({ error: "Tokens required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // トークンの有効性を確認
      const user = await getCurrentUser(access_token);
      if (!user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Cookie にセッション情報を保存
      const headers = new Headers();
      setSessionCookies(headers, access_token, refresh_token);
      headers.set("Content-Type", "application/json");

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers,
      });
    } catch (e) {
      console.error("Session creation error:", e);
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
