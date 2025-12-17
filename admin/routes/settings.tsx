import { Handlers, PageProps } from "$fresh/server.ts";
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

    // プロフィール更新
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

      // 現在の dev_mode を取得
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

      if (!res.ok) {
        const data = await res.json();
        return ctx.render({
          user: ctx.state.user
            ? {
                id: ctx.state.user.id,
                email: ctx.state.user.email || "",
                name: ctx.state.user.name || null,
                dev_mode: devMode,
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
              name: name,
              dev_mode: devMode,
            }
          : null,
        success: "プロフィールを更新しました",
      });
    } catch (error) {
      return ctx.render({
        user: ctx.state.user
          ? {
              id: ctx.state.user.id,
              email: ctx.state.user.email || "",
              name: ctx.state.user.name || null,
              dev_mode: false,
            }
          : null,
        error: error instanceof Error ? error.message : "エラーが発生しました",
      });
    }
  },
};

export default function SettingsPage({ data }: PageProps<PageData>) {
  return (
    <Layout active="/settings">
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

        {/* プロフィール */}
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
                  <span class="label-text">メールアドレス</span>
                </label>
                <input
                  type="email"
                  value={data.user?.email || ""}
                  class="input input-bordered w-full max-w-md"
                  disabled
                />
                <label class="label">
                  <span class="label-text-alt text-base-content/50">
                    メールアドレスの変更は現在サポートされていません
                  </span>
                </label>
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
                  保存
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
            <form method="POST">
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
                <button
                  type="submit"
                  class={`toggle toggle-lg ${data.user?.dev_mode ? "toggle-warning" : ""}`}
                  aria-label="開発モード切り替え"
                >
                  <input
                    type="checkbox"
                    checked={data.user?.dev_mode}
                    class="sr-only"
                  />
                </button>
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
