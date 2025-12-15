import { Handlers, PageProps } from "$fresh/server.ts";

/**
 * Supabase Auth のコールバックページ
 *
 * Magic Link からリダイレクトされた後、
 * クライアントサイドでトークンを取得し、
 * サーバーに送信してセッションを作成する。
 */

interface CallbackData {
  error?: string;
}

export const handler: Handlers<CallbackData> = {
  GET(_req, ctx) {
    // クライアントサイドでハッシュフラグメントを処理するためにページをレンダリング
    return ctx.render({});
  },
};

export default function AuthCallbackPage({ data }: PageProps<CallbackData>) {
  return (
    <div class="min-h-screen flex items-center justify-center bg-base-200">
      <div class="card w-full max-w-md bg-base-100 shadow-xl">
        <div class="card-body text-center">
          <h1 class="text-2xl font-bold mb-4">🔐 認証処理中...</h1>

          {data.error ? (
            <div class="alert alert-error">
              <span>{data.error}</span>
            </div>
          ) : (
            <>
              <p class="text-sm opacity-70 mb-4">
                しばらくお待ちください。
              </p>
              <span class="loading loading-spinner loading-lg"></span>
            </>
          )}
        </div>
      </div>

      {/* クライアントサイドスクリプト */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (async () => {
              // URL フラグメントからトークンを取得
              const hash = window.location.hash.substring(1);
              const params = new URLSearchParams(hash);
              
              const accessToken = params.get('access_token');
              const refreshToken = params.get('refresh_token');
              const type = params.get('type');
              
              if (!accessToken || !refreshToken) {
                // トークンがない場合はエラー
                document.body.innerHTML = '<div class="min-h-screen flex items-center justify-center bg-base-200"><div class="alert alert-error max-w-md"><span>認証に失敗しました。リンクが無効か期限切れです。</span></div></div>';
                setTimeout(() => window.location.href = '/login', 3000);
                return;
              }
              
              // パスワード設定が必要な場合（招待の場合）
              if (type === 'invite' || type === 'recovery') {
                // パスワード設定ページへ（トークンをクエリパラメータで渡す）
                window.location.href = '/auth/set-password?access_token=' + encodeURIComponent(accessToken) + '&refresh_token=' + encodeURIComponent(refreshToken);
                return;
              }
              
              // 通常のログイン成功時はセッションを設定
              try {
                const res = await fetch('/auth/session', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
                });
                
                if (res.ok) {
                  window.location.href = '/';
                } else {
                  throw new Error('Session creation failed');
                }
              } catch (e) {
                document.body.innerHTML = '<div class="min-h-screen flex items-center justify-center bg-base-200"><div class="alert alert-error max-w-md"><span>セッションの作成に失敗しました。</span></div></div>';
                setTimeout(() => window.location.href = '/login', 3000);
              }
            })();
          `,
        }}
      />
    </div>
  );
}
