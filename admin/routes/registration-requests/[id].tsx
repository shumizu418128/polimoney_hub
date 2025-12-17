import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../../components/Layout.tsx";
import { AuthState } from "../_middleware.ts";

interface RegistrationRequest {
  id: string;
  email: string;
  full_name: string;
  role: string;
  ledger_user_id: string | null;
  ledger_supabase_url: string | null;
  verification_doc_url: string;
  verification_doc_type: string | null;
  verification_doc_name: string | null;
  status: string;
  rejection_reason: string | null;
  notes: string | null;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

interface PageData {
  request: RegistrationRequest | null;
  error?: string;
}

const roleLabels: Record<string, string> = {
  politician: "政治家",
  accountant: "会計責任者",
  both: "政治家 兼 会計責任者",
};

const docTypeLabels: Record<string, string> = {
  certificate: "議員証",
  registration_form: "政治団体設立届出書（控え）",
  appointment_form: "会計責任者選任届出書（控え）",
  other: "その他",
};

export const handler: Handlers<PageData, AuthState> = {
  async GET(_req, ctx) {
    const { id } = ctx.params;
    const apiBase = Deno.env.get("API_BASE_URL") || "http://localhost:3722";
    const apiKey =
      Deno.env.get("API_KEY_DEV") || Deno.env.get("API_KEY_PROD") || "dev-api-key";

    try {
      const res = await fetch(`${apiBase}/api/v1/registration-requests/${id}`, {
        headers: { "X-API-Key": apiKey },
      });
      const data = await res.json();

      if (!res.ok) {
        return ctx.render({ request: null, error: data.error });
      }

      return ctx.render({ request: data });
    } catch (error) {
      return ctx.render({
        request: null,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  async POST(req, ctx) {
    const { id } = ctx.params;
    const form = await req.formData();
    const action = form.get("action");

    const apiBase = Deno.env.get("API_BASE_URL") || "http://localhost:3722";
    const apiKey =
      Deno.env.get("API_KEY_DEV") || Deno.env.get("API_KEY_PROD") || "dev-api-key";

    try {
      if (action === "approve") {
        const res = await fetch(
          `${apiBase}/api/v1/registration-requests/${id}/approve`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": apiKey,
            },
            body: JSON.stringify({
              reviewed_by: ctx.state.user?.id,
              admin_notes: form.get("admin_notes") || null,
            }),
          }
        );

        if (!res.ok) {
          const data = await res.json();
          const reqRes = await fetch(
            `${apiBase}/api/v1/registration-requests/${id}`,
            { headers: { "X-API-Key": apiKey } }
          );
          const reqData = await reqRes.json();
          return ctx.render({ request: reqData, error: data.error });
        }

        return new Response(null, {
          status: 303,
          headers: { Location: "/registration-requests?status=pending" },
        });
      }

      if (action === "reject") {
        const reason = form.get("rejection_reason");
        if (!reason) {
          const res = await fetch(
            `${apiBase}/api/v1/registration-requests/${id}`,
            { headers: { "X-API-Key": apiKey } }
          );
          const data = await res.json();
          return ctx.render({ request: data, error: "却下理由を入力してください" });
        }

        const res = await fetch(
          `${apiBase}/api/v1/registration-requests/${id}/reject`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": apiKey,
            },
            body: JSON.stringify({
              rejection_reason: reason,
              reviewed_by: ctx.state.user?.id,
              admin_notes: form.get("admin_notes") || null,
            }),
          }
        );

        if (!res.ok) {
          const data = await res.json();
          const reqRes = await fetch(
            `${apiBase}/api/v1/registration-requests/${id}`,
            { headers: { "X-API-Key": apiKey } }
          );
          const reqData = await reqRes.json();
          return ctx.render({ request: reqData, error: data.error });
        }

        return new Response(null, {
          status: 303,
          headers: { Location: "/registration-requests?status=pending" },
        });
      }

      return ctx.render({ request: null, error: "Unknown action" });
    } catch (error) {
      return ctx.render({
        request: null,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
};

export default function RegistrationRequestDetail({ data }: PageProps<PageData>) {
  const { request, error } = data;

  if (!request) {
    return (
      <Layout active="/registration-requests">
        <div class="alert alert-error">
          <span>⚠️ {error || "リクエストが見つかりません"}</span>
        </div>
        <a href="/registration-requests" class="btn btn-ghost mt-4">
          ← 戻る
        </a>
      </Layout>
    );
  }

  return (
    <Layout active="/registration-requests">
      <div class="space-y-6">
        <div class="flex items-center gap-4">
          <a href="/registration-requests" class="btn btn-ghost btn-sm">
            ← 戻る
          </a>
          <h1 class="text-3xl font-bold">Ledger 登録申請詳細</h1>
        </div>

        {error && (
          <div class="alert alert-error">
            <span>⚠️ {error}</span>
          </div>
        )}

        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <h2 class="card-title text-2xl">{request.full_name}</h2>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <p class="text-sm opacity-70">メールアドレス</p>
                <p class="font-medium">{request.email}</p>
              </div>
              <div>
                <p class="text-sm opacity-70">役割</p>
                <p class="font-medium">
                  {roleLabels[request.role] || request.role}
                </p>
              </div>
              <div>
                <p class="text-sm opacity-70">申請日</p>
                <p class="font-medium">
                  {new Date(request.created_at).toLocaleDateString("ja-JP")}
                </p>
              </div>
              <div>
                <p class="text-sm opacity-70">書類タイプ</p>
                <p class="font-medium">
                  {docTypeLabels[request.verification_doc_type || ""] ||
                    request.verification_doc_type ||
                    "不明"}
                </p>
              </div>
            </div>

            {request.ledger_user_id && (
              <div class="mt-4">
                <p class="text-sm opacity-70">Ledger ユーザー ID</p>
                <code class="text-sm bg-base-200 px-2 py-1 rounded">
                  {request.ledger_user_id}
                </code>
              </div>
            )}

            <div class="mt-4">
              <p class="text-sm opacity-70">本人確認書類</p>
              <div class="mt-2 p-4 border-2 border-dashed border-base-300 rounded-lg">
                {request.verification_doc_url.startsWith("pending:") ? (
                  <p class="text-warning">
                    ⚠️ ファイルアップロードに失敗した可能性があります
                  </p>
                ) : (
                  <>
                    <a
                      href={request.verification_doc_url}
                      target="_blank"
                      rel="noopener"
                      class="btn btn-outline btn-primary"
                    >
                      📎 {request.verification_doc_name || "ファイルを確認"}
                    </a>
                    <p class="text-sm mt-2 opacity-70">
                      クリックして本人確認書類を確認してください
                    </p>
                  </>
                )}
              </div>
            </div>

            {request.notes && (
              <div class="mt-4">
                <p class="text-sm opacity-70">申請者からの補足</p>
                <p class="bg-base-200 p-3 rounded">{request.notes}</p>
              </div>
            )}
          </div>
        </div>

        {request.status === "pending" && (
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Approve Form */}
            <div class="card bg-success/10 border-2 border-success">
              <div class="card-body">
                <h3 class="card-title text-success">✅ 承認</h3>
                <p class="text-sm opacity-70">
                  本人確認書類を確認し、問題なければ承認してください。
                  承認後、ユーザーは Ledger にログインできるようになります。
                </p>
                <form method="POST">
                  <input type="hidden" name="action" value="approve" />
                  <div class="form-control">
                    <label class="label">
                      <span class="label-text">管理者メモ（任意）</span>
                    </label>
                    <textarea
                      name="admin_notes"
                      placeholder="内部メモ（申請者には表示されません）"
                      class="textarea textarea-bordered"
                      rows={2}
                    ></textarea>
                  </div>
                  <div class="card-actions justify-end mt-4">
                    <button type="submit" class="btn btn-success">
                      承認する
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Reject Form */}
            <div class="card bg-error/10 border-2 border-error">
              <div class="card-body">
                <h3 class="card-title text-error">❌ 却下</h3>
                <form method="POST">
                  <input type="hidden" name="action" value="reject" />
                  <div class="form-control">
                    <label class="label">
                      <span class="label-text">却下理由（必須）</span>
                    </label>
                    <textarea
                      name="rejection_reason"
                      placeholder="却下の理由を入力してください（申請者に通知されます）"
                      class="textarea textarea-bordered"
                      rows={3}
                      required
                    ></textarea>
                  </div>
                  <div class="form-control mt-2">
                    <label class="label">
                      <span class="label-text">管理者メモ（任意）</span>
                    </label>
                    <textarea
                      name="admin_notes"
                      placeholder="内部メモ（申請者には表示されません）"
                      class="textarea textarea-bordered"
                      rows={2}
                    ></textarea>
                  </div>
                  <div class="card-actions justify-end mt-4">
                    <button type="submit" class="btn btn-error">
                      却下する
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {request.status === "approved" && (
          <div class="alert alert-success">
            <span>
              ✅ このリクエストは承認済みです。
              {request.reviewed_at && (
                <>
                  {" "}
                  （{new Date(request.reviewed_at).toLocaleDateString("ja-JP")}）
                </>
              )}
            </span>
          </div>
        )}

        {request.status === "rejected" && (
          <div class="alert alert-error">
            <div>
              <p>❌ このリクエストは却下されました。</p>
              <p class="text-sm">理由: {request.rejection_reason}</p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
