// deno-lint-ignore-file
// @ts-nocheck
// ローカル開発時のみ .env を読み込む（Deno Deploy では不要）
try {
  await import("std/dotenv/load.ts");
} catch {
  // Deno Deploy では .env ファイルがないのでスキップ
}

import { Hono } from "hono";
import { cors } from "jsr:@hono/hono@^4.6.0/cors";
import { logger } from "jsr:@hono/hono@^4.6.0/logger";
import { serveStatic } from "jsr:@hono/hono@^4.6.0/deno";
import openApiSpec from "./openapi.json" with { type: "json" };
import { apiKeyAuth } from "./middleware/auth.ts";
import { adminAuth } from "./middleware/admin-auth.ts";
import { politiciansRouter } from "./routes/politicians.ts";
import { organizationsRouter } from "./routes/organizations.ts";
import { electionsRouter } from "./routes/elections.ts";
import { electionRequestsRouter } from "./routes/election-requests.ts";
import { organizationRequestsRouter } from "./routes/organization-requests.ts";
import { adminRouter } from "./routes/admin.ts";
import { syncRouter } from "./routes/sync.ts";
import { unlockRequestsRouter } from "./routes/unlock-requests.ts";
import { masterRouter } from "./routes/master.ts";
import { authRouter } from "./routes/auth.ts";
import { polimoneyRouter } from "./routes/polimoney.ts";
import { registrationRequestsRouter } from "./routes/registration-requests.ts";
import { politicianVerificationsRouter } from "./routes/politician-verifications.ts";
import { organizationManagerVerificationsRouter } from "./routes/organization-manager-verifications.ts";
import { publicRouter } from "./routes/public.ts";
import { impersonationReportsRouter } from "./routes/impersonation-reports.ts";
import { uploadsRouter } from "./routes/uploads.ts";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors());

// Health check (認証不要)
app.get("/", (c) => {
  return c.json({
    name: "Polimoney Hub",
    version: "0.1.0",
    status: "ok",
  });
});

app.get("/health", (c) => {
  return c.json({ status: "healthy" });
});

// OpenAPI Spec (JSON)
app.get("/openapi.json", (c) => {
  return c.json(openApiSpec);
});

// API ドキュメント (Scalar UI)
app.get("/api-reference", (c) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Polimoney Hub API - Reference</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📊</text></svg>">
</head>
<body>
  <script id="api-reference" data-url="/openapi.json"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
  return c.html(html);
});

// API routes (認証必要)
const api = new Hono();
api.use("*", apiKeyAuth);

api.route("/politicians", politiciansRouter);
api.route("/organizations", organizationsRouter);
api.route("/elections", electionsRouter);
api.route("/election-requests", electionRequestsRouter);
api.route("/organization-requests", organizationRequestsRouter);
api.route("/sync", syncRouter);
api.route("/unlock-requests", unlockRequestsRouter);
api.route("/master", masterRouter);
api.route("/polimoney", polimoneyRouter);
api.route("/registration-requests", registrationRequestsRouter);
// v2: 認証関連API
api.route("/politician-verifications", politicianVerificationsRouter);
api.route("/organization-manager-verifications", organizationManagerVerificationsRouter);
// v2.1: 画像アップロード
api.route("/uploads", uploadsRouter);

// Admin routes (管理者認証必要) - /api/v1 の前にマウント
const admin = new Hono();
admin.use("*", adminAuth);
admin.route("/", adminRouter);

// Auth routes (認証不要 - ログイン用)
app.route("/api/auth", authRouter);

// Public routes (認証不要 - 公開ページ用)
app.route("/api/public", publicRouter);
app.route("/api/public/impersonation-reports", impersonationReportsRouter);

// 注意: admin を先にマウントしないと /api/v1/* のミドルウェアが適用される
app.route("/api/admin", admin);
app.route("/api/v1", api);

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error(`Error: ${err.message}`);
  console.error(err.stack);
  // 開発環境ではエラー詳細を返す
  if (Deno.env.get("DENO_ENV") === "development") {
    return c.json({ error: err.message, stack: err.stack }, 500);
  }
  return c.json({ error: "Internal Server Error" }, 500);
});

const port = parseInt(Deno.env.get("PORT") || "3722");
console.log(`🚀 Polimoney Hub is running on http://localhost:${port}`);

Deno.serve({ port }, app.fetch);
