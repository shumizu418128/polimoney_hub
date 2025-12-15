import { Handlers, PageProps } from "$fresh/server.ts";
import { login, setSessionCookies } from "../lib/auth.ts";

interface LoginData {
  error?: string;
  redirect?: string;
}

export const handler: Handlers<LoginData> = {
  GET(req, ctx) {
    const url = new URL(req.url);
    const redirect = url.searchParams.get("redirect") || "/";
    return ctx.render({ redirect });
  },

  async POST(req, ctx) {
    const form = await req.formData();
    const email = form.get("email")?.toString() || "";
    const password = form.get("password")?.toString() || "";
    const redirect = form.get("redirect")?.toString() || "/";

    if (!email || !password) {
      return ctx.render({ error: "メールアドレスとパスワードを入力してください", redirect });
    }

    const result = await login(email, password);

    if (!result.success) {
      return ctx.render({ error: result.error, redirect });
    }

    // Cookie にセッション情報を保存
    const headers = new Headers();
    setSessionCookies(headers, result.data.accessToken, result.data.refreshToken);
    headers.set("Location", redirect);

    return new Response(null, {
      status: 302,
      headers,
    });
  },
};

export default function LoginPage({ data }: PageProps<LoginData>) {
  return (
    <div class="min-h-screen flex items-center justify-center bg-base-200">
      <div class="card w-full max-w-md bg-base-100 shadow-xl">
        <div class="card-body">
          <div class="text-center mb-6">
            <h1 class="text-3xl font-bold">🍋 Polimoney Hub</h1>
            <p class="text-sm opacity-70 mt-2">管理画面ログイン</p>
          </div>

          {data.error && (
            <div class="alert alert-error mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="stroke-current shrink-0 h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{data.error}</span>
            </div>
          )}

          <form method="POST">
            <input type="hidden" name="redirect" value={data.redirect || "/"} />

            <div class="form-control">
              <label class="label">
                <span class="label-text">メールアドレス</span>
              </label>
              <input
                type="email"
                name="email"
                placeholder="admin@example.com"
                class="input input-bordered"
                required
                autocomplete="email"
              />
            </div>

            <div class="form-control mt-4">
              <label class="label">
                <span class="label-text">パスワード</span>
              </label>
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                class="input input-bordered"
                required
                autocomplete="current-password"
              />
            </div>

            <div class="form-control mt-6">
              <button type="submit" class="btn btn-primary">
                ログイン
              </button>
            </div>
          </form>

          <div class="divider text-sm opacity-50">または</div>

          <p class="text-center text-sm opacity-70">
            アカウントをお持ちでない場合は、<br />
            管理者に招待を依頼してください。
          </p>
        </div>
      </div>
    </div>
  );
}
