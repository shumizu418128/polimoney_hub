/**
 * スキーマ切り替えユーティリティ
 *
 * APIキーに応じて開発用スキーマと本番スキーマを切り替え
 *
 * API_KEY_PROD → dbo（本番データ）
 * API_KEY_DEV  → dev（ダミーデータ）
 *
 * スキーマの使い分け:
 *   - municipalities, districts → 常に dbo（本番データを共用）
 *   - その他 → APIキーに応じて dbo or dev
 */

// 常に dbo を使うテーブル（本番データを共用）
const ALWAYS_DBO_TABLES = ["municipalities", "districts"];

/**
 * APIキーが開発用かどうかを判定
 */
export function isDevApiKey(apiKey: string | undefined): boolean {
  const devKey = Deno.env.get("API_KEY_DEV");
  return devKey !== undefined && apiKey === devKey;
}

/**
 * テーブル名に適切なスキーマを付与
 * @param tableName テーブル名
 * @param useDevSchema 開発スキーマを使用するか
 * @returns スキーマ付きテーブル名（例: "dbo.politicians" or "dev.politicians"）
 */
export function table(tableName: string, useDevSchema: boolean = false): string {
  // municipalities, districts は常に dbo
  if (ALWAYS_DBO_TABLES.includes(tableName)) {
    return `dbo.${tableName}`;
  }

  return useDevSchema ? `dev.${tableName}` : `dbo.${tableName}`;
}

/**
 * リクエストのAPIキーからスキーマモードを取得
 */
export function getSchemaFromApiKey(apiKey: string | undefined): "dev" | "dbo" {
  return isDevApiKey(apiKey) ? "dev" : "dbo";
}

/**
 * テーブル名ヘルパーを生成（リクエストごとに使用）
 */
export function createTableHelper(apiKey: string | undefined) {
  const useDevSchema = isDevApiKey(apiKey);
  
  return {
    // 常に dbo
    municipalities: "dbo.municipalities",
    districts: "dbo.districts",
    // APIキーに応じて切り替え
    politicians: table("politicians", useDevSchema),
    organizations: table("organizations", useDevSchema),
    elections: table("elections", useDevSchema),
    master_metadata: table("master_metadata", useDevSchema),
    public_ledgers: table("public_ledgers", useDevSchema),
    public_journals: table("public_journals", useDevSchema),
    ledger_change_logs: table("ledger_change_logs", useDevSchema),
    election_requests: table("election_requests", useDevSchema),
    organization_requests: table("organization_requests", useDevSchema),
    // 現在のスキーマモード
    schema: useDevSchema ? "dev" : "dbo",
    isDevSchema: useDevSchema,
  } as const;
}

// 使用例:
// import { createTableHelper } from "./db/schema.ts";
//
// app.get("/api/politicians", (c) => {
//   const apiKey = c.req.header("X-API-Key");
//   const tables = createTableHelper(apiKey);
//   
//   const sql = `SELECT * FROM ${tables.politicians}`;
//   // API_KEY_PROD → "SELECT * FROM dbo.politicians"
//   // API_KEY_DEV  → "SELECT * FROM dev.politicians"
// });
