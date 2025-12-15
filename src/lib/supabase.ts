import { createClient } from "@supabase/supabase-js";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseSecretKey = Deno.env.get("SUPABASE_SECRET_KEY");
const supabasePublishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

if (!supabaseUrl) {
  console.warn("Warning: SUPABASE_URL is not set");
}

/**
 * Service Role クライアント（サーバーサイド用、全権限）
 * RLS をバイパスするので注意して使用
 */
export function getServiceClient() {
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("SUPABASE_URL or SUPABASE_SECRET_KEY is not set");
  }
  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Anon クライアント（クライアントサイド用、RLS 適用）
 */
export function getPublicClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is not set");
  }
  return createClient(supabaseUrl, supabasePublishableKey);
}

/**
 * JWT からユーザー情報を取得
 */
export async function getUserFromToken(accessToken: string) {
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("SUPABASE_URL or SUPABASE_SECRET_KEY is not set");
  }

  const client = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await client.auth.getUser(accessToken);

  if (error) {
    return null;
  }

  return data.user;
}
