import { getServiceClient } from "../lib/supabase.ts";

/**
 * Supabase クライアントを使用したデータベースアクセス
 * RLS をバイパスするため service_role キーを使用
 */

/**
 * SELECT クエリを実行して結果を返す
 */
export async function query<T>(
  table: string,
  options?: {
    select?: string;
    filter?: Record<string, unknown>;
    order?: { column: string; ascending?: boolean };
    limit?: number;
  }
): Promise<T[]> {
  const supabase = getServiceClient();
  let q = supabase.from(table).select(options?.select || "*");

  // フィルター適用
  if (options?.filter) {
    for (const [key, value] of Object.entries(options.filter)) {
      q = q.eq(key, value);
    }
  }

  // ソート
  if (options?.order) {
    q = q.order(options.order.column, { ascending: options.order.ascending ?? true });
  }

  // リミット
  if (options?.limit) {
    q = q.limit(options.limit);
  }

  const { data, error } = await q;

  if (error) {
    throw new Error(`Query error: ${error.message}`);
  }

  return (data || []) as T[];
}

/**
 * SELECT クエリを実行して最初の1件を返す
 */
export async function queryOne<T>(
  table: string,
  filter: Record<string, unknown>,
  select?: string
): Promise<T | null> {
  const supabase = getServiceClient();
  let q = supabase.from(table).select(select || "*");

  for (const [key, value] of Object.entries(filter)) {
    q = q.eq(key, value);
  }

  const { data, error } = await q.single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    throw new Error(`Query error: ${error.message}`);
  }

  return data as T;
}

/**
 * INSERT を実行して結果を返す
 */
export async function insert<T>(
  table: string,
  data: Record<string, unknown> | Record<string, unknown>[]
): Promise<T[]> {
  const supabase = getServiceClient();
  const { data: result, error } = await supabase
    .from(table)
    .insert(data)
    .select();

  if (error) {
    throw new Error(`Insert error: ${error.message}`);
  }

  return (result || []) as T[];
}

/**
 * UPDATE を実行して結果を返す
 */
export async function update<T>(
  table: string,
  filter: Record<string, unknown>,
  data: Record<string, unknown>
): Promise<T[]> {
  const supabase = getServiceClient();
  let q = supabase.from(table).update(data);

  for (const [key, value] of Object.entries(filter)) {
    q = q.eq(key, value);
  }

  const { data: result, error } = await q.select();

  if (error) {
    throw new Error(`Update error: ${error.message}`);
  }

  return (result || []) as T[];
}

/**
 * DELETE を実行
 */
export async function remove(
  table: string,
  filter: Record<string, unknown>
): Promise<number> {
  const supabase = getServiceClient();
  let q = supabase.from(table).delete();

  for (const [key, value] of Object.entries(filter)) {
    q = q.eq(key, value);
  }

  const { error, count } = await q;

  if (error) {
    throw new Error(`Delete error: ${error.message}`);
  }

  return count || 0;
}

/**
 * 生の SQL を実行（複雑なクエリ用）
 */
export async function rawQuery<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("exec_sql", {
    query: sql,
    params: params || [],
  });

  if (error) {
    throw new Error(`Raw query error: ${error.message}`);
  }

  return (data || []) as T[];
}
