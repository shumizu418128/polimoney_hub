import sql from "mssql";

// Azure SQL Database 接続設定
const connectionString = Deno.env.get("DATABASE_URL");

let pool: sql.ConnectionPool | null = null;

/**
 * 接続文字列をパースして mssql 用の config オブジェクトに変換
 * 形式: Server=xxx.database.windows.net;Database=xxx;User Id=xxx;Password=xxx;Encrypt=true
 */
function parseConnectionString(connStr: string): sql.config {
  const params: Record<string, string> = {};

  connStr.split(";").forEach((part) => {
    const [key, ...valueParts] = part.split("=");
    if (key && valueParts.length > 0) {
      params[key.trim().toLowerCase().replace(/\s/g, "")] =
        valueParts.join("=");
    }
  });

  return {
    server: params["server"] || "",
    database: params["database"] || "",
    user: params["userid"] || params["user"] || "",
    password: params["password"] || "",
    options: {
      encrypt: params["encrypt"]?.toLowerCase() === "true",
      trustServerCertificate: false,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

/**
 * 接続プールを取得（シングルトン）
 */
export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const config = parseConnectionString(connectionString);
  pool = await new sql.ConnectionPool(config).connect();

  console.log("[DB] Connected to Azure SQL Database");
  return pool;
}

/**
 * SELECT クエリを実行して結果を返す
 */
export async function query<T>(
  sqlQuery: string,
  params?: Record<string, unknown>
): Promise<T[]> {
  const pool = await getPool();
  const request = pool.request();

  // パラメータをバインド
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value);
    }
  }

  const result = await request.query(sqlQuery);
  return result.recordset as T[];
}

/**
 * SELECT クエリを実行して最初の1件を返す
 */
export async function queryOne<T>(
  sqlQuery: string,
  params?: Record<string, unknown>
): Promise<T | null> {
  const rows = await query<T>(sqlQuery, params);
  return rows[0] || null;
}

/**
 * INSERT/UPDATE/DELETE を実行して影響行数を返す
 */
export async function execute(
  sqlQuery: string,
  params?: Record<string, unknown>
): Promise<number> {
  const pool = await getPool();
  const request = pool.request();

  // パラメータをバインド
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value);
    }
  }

  const result = await request.query(sqlQuery);
  return result.rowsAffected[0] || 0;
}

/**
 * 接続を閉じる
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
    console.log("[DB] Connection closed");
  }
}
