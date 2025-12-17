import { Handlers, PageProps } from "$fresh/server.ts";
import { createClient } from "@supabase/supabase-js";
import Layout from "../components/Layout.tsx";
import { AuthState } from "./_middleware.ts";

interface PageData {
  user: {
    id: string;
    email: string;
    name: string | null;
    dev_mode: boolean;
  } | null;
  success?: string;
  error?: string;
}

export const handler: Handlers<PageData, AuthState> = {
  async GET(_req, ctx) {
    const apiBase = Deno.env.get("API_BASE_URL") || "http://localhost:3722";

    // 現在のユーザー情報を API から取得
    let devMode = false;
    try {
      const res = await fetch(`${apiBase}/api/admin/users/${ctx.state.user?.id}`, {
        headers: { Authorization: `Bearer ${ctx.state.accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        devMode = data.data?.dev_mode ?? false;
      }
    } catch {
      // エラー時はデフォルト値を使用
    }

    return ctx.render({
      user: ctx.state.user
        ? {
            id: ctx.state.user.id,
            email: ctx.state.user.email || "",
            name: ctx.state.user.name || null,
            dev_mode: devMode,
          }
        : null,
    });
  },

  async POST(req, ctx) {
    const form = await req.formData();
    const action = form.get("action")?.toString();

    const apiBase = Deno.env.get("API_BASE_URL") || "http://localhost:3722";

    // dev_mode の切り替え
    if (action === "toggle_dev_mode") {
      const devMode = form.get("dev_mode")?.toString() === "true";

      try {
        const res = await fetch(`${apiBase}/api/admin/users/${ctx.state.user?.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ctx.state.accessToken}`,
          },
          body: JSON.stringify({ dev_mode: devMode }),
        });

        if (!res.ok) {
          const data = await res.json();
          return ctx.render({
            user: ctx.state.user
              ? {
                  id: ctx.state.user.id,
                  email: ctx.state.user.email || "",
                  name: ctx.state.user.name || null,
                  dev_mode: !devMode,
                }
              : null,
            error: data.error || "更新に失敗しました",
          });
        }

        return ctx.render({
          user: ctx.state.user
            ? {
                id: ctx.state.user.id,
                email: ctx.state.user.email || "",
                name: ctx.state.user.name || null,
                dev_mode: devMode,
              }
            : null,
          success: devMode ? "開発モードを有効にしました" : "開発モードを無効にしました",
        });
      } catch (error) {
        return ctx.render({
          user: ctx.state.user
            ? {
                id: ctx.state.user.id,
                email: ctx.state.user.email || "",
                name: ctx.state.user.name || null,
                dev_mode: !devMode,
              }
            : null,
          error: error instanceof Error ? error.message : "エラーが発生しました",
        });
      }
    }

    // メールアドレス変更（OTP 確認付き）
    if (action === "change_email") {
      const newEmail = form.get("new_email")?.toString() || "";

      if (!newEmail) {
        return renderWithDevMode(ctx, apiBase, { error: "新しいメールアドレスを入力してください" });
      }

      if (newEmail === ctx.state.user?.email) {
        return renderWithDevMode(ctx, apiBase, { error: "現在と同じメールアドレスです" });
      }

      try {
        // ユーザーのセッションを使って Supabase クライアントを作成
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const supabaseKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";

        const supabase = createClient(supabaseUrl, supabaseKey, {
          global: {
            headers: {
              Authorization: `Bearer ${ctx.state.accessToken}`,
            },
          },
        });

        // メールアドレス変更リクエスト（確認メールが送信される）
        const { error: updateError } = await supabase.auth.updateUser({
          email: newEmail,
        });

        if (updateError) {
          return renderWithDevMode(ctx, apiBase, {
            error: `メールアドレスの変更に失敗しました: ${updateError.message}`,
          });
        }

        return renderWithDevMode(ctx, apiBase, {
          success: `${newEmail} に確認メールを送信しました。メール内のリンクをクリックして変更を完了してください。`,
        });
      } catch (error) {
        return renderWithDevMode(ctx, apiBase, {
          error: error instanceof Error ? error.message : "エラーが発生しました",
        });
      }
    }

    // プロフィール更新（名前のみ）
    const name = form.get("name")?.toString() || "";

    try {
      const res = await fetch(`${apiBase}/api/admin/users/${ctx.state.user?.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ctx.state.accessToken}`,
        },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const data = await res.json();
        return renderWithDevMode(ctx, apiBase, {
          error: data.error || "更新に失敗しました",
        });
      }

      return renderWithDevMode(ctx, apiBase, {
        success: "表示名を更新しました",
        updatedName: name,
      });
    } catch (error) {
      return renderWithDevMode(ctx, apiBase, {
        error: error instanceof Error ? error.message : "エラーが発生しました",
      });
    }
  },
};

// dev_mode を取得してレンダリングするヘルパー関数
async function renderWithDevMode(
  ctx: Parameters<Handlers<PageData, AuthState>["POST"]>[1],
  apiBase: string,
  options: { success?: string; error?: string; updatedName?: string }
) {
  let devMode = false;
  try {
    const userRes = await fetch(`${apiBase}/api/admin/users/${ctx.state.user?.id}`, {
      headers: { Authorization: `Bearer ${ctx.state.accessToken}` },
    });
    if (userRes.ok) {
      const userData = await userRes.json();
      devMode = userData.data?.dev_mode ?? false;
    }
  } catch {
    // エラー時はデフォルト値
  }

  return ctx.render({
    user: ctx.state.user
      ? {
          id: ctx.state.user.id,
          email: ctx.state.user.email || "",
          name: options.updatedName ?? ctx.state.user.name ?? null,
          dev_mode: devMode,
        }
      : null,
    success: options.success,
    error: options.error,
  });
}

export default function SettingsPage({ data }: PageProps<PageData>) {
  return (
    <Layout active="/settings" devMode={data.user?.dev_mode}>
      <div class="space-y-6">
        <h1 class="text-3xl font-bold">⚙️ 設定</h1>

        {data.success && (
          <div class="alert alert-success">
            <span>✅ {data.success}</span>
          </div>
        )}

        {data.error && (
          <div class="alert alert-error">
            <span>⚠️ {data.error}</span>
          </div>
        )}

        {/* プロフィール（表示名） */}
        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <h2 class="card-title">👤 プロフィール</h2>
            <form method="POST" class="space-y-4">
              <div class="form-control">
                <label class="label">
                  <span class="label-text">表示名</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={data.user?.name || ""}
                  placeholder="山田 太郎"
                  class="input input-bordered w-full max-w-md"
                />
              </div>

              <div class="form-control">
                <label class="label">
                  <span class="label-text">ユーザー ID</span>
                </label>
                <input
                  type="text"
                  value={data.user?.id || ""}
                  class="input input-bordered w-full max-w-md font-mono text-sm"
                  disabled
                />
              </div>

              <div class="card-actions">
                <button type="submit" class="btn btn-primary">
                  表示名を保存
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* メールアドレス変更 */}
        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <h2 class="card-title">📧 メールアドレス</h2>
            <p class="text-sm text-base-content/70 mb-2">
              現在のメールアドレス: <strong>{data.user?.email}</strong>
            </p>
            <form method="POST" class="space-y-4">
              <input type="hidden" name="action" value="change_email" />
              <div class="form-control">
                <label class="label">
                  <span class="label-text">新しいメールアドレス</span>
                </label>
                <input
                  type="email"
                  name="new_email"
                  placeholder="new-email@example.com"
                  class="input input-bordered w-full max-w-md"
                  required
                />
                <label class="label">
                  <span class="label-text-alt text-base-content/50">
                    入力後、確認メールが送信されます。メール内のリンクをクリックして変更を完了してください。
                  </span>
                </label>
              </div>

              <div class="card-actions">
                <button type="submit" class="btn btn-outline">
                  確認メールを送信
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* パスワード変更 */}
        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <h2 class="card-title">🔐 パスワード</h2>
            <p class="text-sm text-base-content/70">
              パスワードを変更するには、一度ログアウトしてからログイン画面で「パスワードを忘れた方」からリセットしてください。
            </p>
            <div class="card-actions">
              <a href="/logout" class="btn btn-outline btn-sm">
                ログアウト
              </a>
            </div>
          </div>
        </div>

        {/* 開発モード */}
        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <h2 class="card-title">🔧 開発モード</h2>
            <p class="text-sm text-base-content/70 mb-4">
              有効にすると、テスト申請（<code class="font-mono text-xs">is_test=true</code>）が
              Ledger 登録申請一覧に表示されます。
            </p>
            <form method="POST" id="dev-mode-form">
              <input type="hidden" name="action" value="toggle_dev_mode" />
              <input
                type="hidden"
                name="dev_mode"
                value={data.user?.dev_mode ? "false" : "true"}
              />
              <div class="flex items-center gap-4">
                <span class={data.user?.dev_mode ? "opacity-50" : "font-bold"}>
                  オフ
                </span>
                <label class="swap">
                  <input
                    type="checkbox"
                    checked={data.user?.dev_mode}
                    class={`toggle toggle-lg ${data.user?.dev_mode ? "toggle-warning" : ""}`}
                    onChange="this.form.submit()"
                  />
                </label>
                <span class={data.user?.dev_mode ? "font-bold" : "opacity-50"}>
                  オン
                </span>
                {data.user?.dev_mode && (
                  <span class="badge badge-warning gap-1">
                    🧪 開発モード有効
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* アカウント情報 */}
        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <h2 class="card-title">📊 アカウント情報</h2>
            <div class="stats stats-vertical lg:stats-horizontal shadow">
              <div class="stat">
                <div class="stat-title">ロール</div>
                <div class="stat-value text-lg">管理者</div>
              </div>
              <div class="stat">
                <div class="stat-title">ステータス</div>
                <div class="stat-value text-lg text-success">有効</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
