/**
 * スキーマ切り替えユーティリティ
 *
 * 環境変数 USE_DEV_SCHEMA で開発用スキーマと本番スキーマを切り替え
 *
 * USE_DEV_SCHEMA=true の場合:
 *   - municipalities, districts → dbo（本番データを共用）
 *   - その他 → dev（ダミーデータ）
 *
 * USE_DEV_SCHEMA=false または未設定:
 *   - すべて → dbo（本番データ）
 */

const USE_DEV_SCHEMA = Deno.env.get("USE_DEV_SCHEMA") === "true";

// 常に dbo を使うテーブル（本番データを共用）
const ALWAYS_DBO_TABLES = ["municipalities", "districts"];

/**
 * テーブル名に適切なスキーマを付与
 * @param tableName テーブル名
 * @returns スキーマ付きテーブル名（例: "dbo.politicians" or "dev.politicians"）
 */
export function table(tableName: string): string {
  if (!USE_DEV_SCHEMA) {
    return `dbo.${tableName}`;
  }

  // municipalities, districts は常に dbo
  if (ALWAYS_DBO_TABLES.includes(tableName)) {
    return `dbo.${tableName}`;
  }

  return `dev.${tableName}`;
}

/**
 * 現在のスキーマモードを取得
 */
export function getSchemaMode(): "dev" | "dbo" {
  return USE_DEV_SCHEMA ? "dev" : "dbo";
}

/**
 * 開発用スキーマを使用しているかどうか
 */
export function isDevSchema(): boolean {
  return USE_DEV_SCHEMA;
}

// テーブル名のショートカット
export const tables = {
  // 常に dbo
  municipalities: table("municipalities"),
  districts: table("districts"),
  // スキーマ切り替え対象
  politicians: table("politicians"),
  organizations: table("organizations"),
  elections: table("elections"),
  master_metadata: table("master_metadata"),
  public_ledgers: table("public_ledgers"),
  public_journals: table("public_journals"),
  ledger_change_logs: table("ledger_change_logs"),
  election_requests: table("election_requests"),
  organization_requests: table("organization_requests"),
} as const;

// 使用例:
// import { tables } from "./db/schema.ts";
// const sql = `SELECT * FROM ${tables.politicians}`;
// → USE_DEV_SCHEMA=true: "SELECT * FROM dev.politicians"
// → USE_DEV_SCHEMA=false: "SELECT * FROM dbo.politicians"

