import { Hono } from "hono";
import { cors } from "jsr:@hono/hono@^4.6.0/cors";
import { logger } from "jsr:@hono/hono@^4.6.0/logger";
import { apiKeyAuth } from "./middleware/auth.ts";
import { politiciansRouter } from "./routes/politicians.ts";
import { organizationsRouter } from "./routes/organizations.ts";
import { electionsRouter } from "./routes/elections.ts";

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

// API routes (認証必要)
const api = new Hono();
api.use("*", apiKeyAuth);

api.route("/politicians", politiciansRouter);
api.route("/organizations", organizationsRouter);
api.route("/elections", electionsRouter);

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

const port = parseInt(Deno.env.get("PORT") || "8000");
console.log(`🚀 Polimoney Hub is running on http://localhost:${port}`);

Deno.serve({ port }, app.fetch);

