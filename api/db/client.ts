import sql from "mssql";

// Azure SQL Database 接続設定
const connectionString = Deno.env.get("DATABASE_URL");

let pool: sql.ConnectionPool | null = null;

/**
 * 接続文字列をパースして mssql 用の config に変換
 * 形式: Server=xxx;Database=yyy;User Id=zzz;Password=www;Encrypt=true
 */
function parseConnectionString(connStr: string): sql.config {
  const params: Record<string, string> = {};
  connStr.split(";").forEach((part) => {
    const [key, value] = part.split("=");
    if (key && value) {
      params[key.trim().toLowerCase().replace(/\s/g, "")] = value.trim();
    }
  });

  return {
    server: params["server"] || params["data source"] || "",
    database: params["database"] || params["initial catalog"] || "",
    user: params["userid"] || params["user id"] || params["uid"] || "",
    password: params["password"] || params["pwd"] || "",
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
 * DB接続プールを取得
 */
export async function getPool(): Promise<sql.ConnectionPool> {
  if (!pool || !pool.connected) {
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    const config = parseConnectionString(connectionString);
    pool = await sql.connect(config);
    console.log("✅ Connected to Azure SQL Database");
  }
  return pool;
}

/**
 * SELECTクエリを実行
 */
export async function query<T>(sqlQuery: string, params?: Record<string, unknown>): Promise<T[]> {
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
 * 1件取得
 */
export async function queryOne<T>(sqlQuery: string, params?: Record<string, unknown>): Promise<T | null> {
  const rows = await query<T>(sqlQuery, params);
  return rows[0] || null;
}

/**
 * INSERT/UPDATE/DELETE を実行
 */
export async function execute(sqlQuery: string, params?: Record<string, unknown>): Promise<number> {
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
    console.log("🔌 Disconnected from Azure SQL Database");
  }
}
