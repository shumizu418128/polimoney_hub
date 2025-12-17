import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../components/Layout.tsx";
import { AuthState } from "./_middleware.ts";

interface PageData {
  user: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  success?: string;
  error?: string;
}

export const handler: Handlers<PageData, AuthState> = {
  async GET(_req, ctx) {
    return ctx.render({
      user: ctx.state.user
        ? {
            id: ctx.state.user.id,
            email: ctx.state.user.email || "",
            name: ctx.state.user.name || null,
          }
        : null,
    });
  },

  async POST(req, ctx) {
    const form = await req.formData();
    const name = form.get("name")?.toString() || "";

    const apiBase = Deno.env.get("API_BASE_URL") || "http://localhost:3722";

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
        return ctx.render({
          user: ctx.state.user
            ? {
                id: ctx.state.user.id,
                email: ctx.state.user.email || "",
                name: ctx.state.user.name || null,
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
