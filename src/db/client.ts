import { Pool } from "postgres";

// Azure PostgreSQL 接続設定
const connectionString = Deno.env.get("DATABASE_URL");

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    pool = new Pool(connectionString, 3, true);
  }
  return pool;
}

export async function query<T>(sql: string, args?: unknown[]): Promise<T[]> {
  const pool = getPool();
  const connection = await pool.connect();
  try {
    const result = await connection.queryObject<T>(sql, args);
    return result.rows;
  } finally {
    connection.release();
  }
}

export async function queryOne<T>(
  sql: string,
  args?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, args);
  return rows[0] || null;
}

export async function execute(sql: string, args?: unknown[]): Promise<number> {
  const pool = getPool();
  const connection = await pool.connect();
  try {
    const result = await connection.queryObject(sql, args);
    return result.rowCount || 0;
  } finally {
    connection.release();
  }
}

