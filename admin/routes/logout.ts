import { Handlers } from "$fresh/server.ts";
import { clearSessionCookies } from "../lib/auth.ts";

export const handler: Handlers = {
  GET(_req, _ctx) {
    const headers = new Headers();
    clearSessionCookies(headers);
    headers.set("Location", "/login");

    return new Response(null, {
      status: 302,
      headers,
    });
  },

  POST(_req, _ctx) {
    const headers = new Headers();
    clearSessionCookies(headers);
    headers.set("Location", "/login");

    return new Response(null, {
      status: 302,
      headers,
    });
  },
};
