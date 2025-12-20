import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../../../components/Layout.tsx";
import { AuthState } from "../../_middleware.ts";

interface OrganizationManagerVerification {
  id: string;
  ledger_user_id: string;
  ledger_user_email: string;
  organization_id: string | null;
  organization_name: string;
  organization_type: string | null;
  official_email: string;
  official_domain: string;
  status: string;
  request_type: string;
  previous_domain: string | null;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

interface PageData {
  verification: OrganizationManagerVerification | null;
  error?: string;
}

const statusLabels: Record<string, { label: string; class: string }> = {
  pending: { label: "保留中", class: "badge-warning" },
  email_sent: { label: "メール送信済", class: "badge-info" },
  email_verified: { label: "承認待ち", class: "badge-accent" },
  approved: { label: "承認済", class: "badge-success" },
  rejected: { label: "却下", class: "badge-error" },
};

const requestTypeLabels: Record<string, { label: string; class: string }> = {
  new: { label: "新規認証", class: "badge-outline" },
  domain_change: { label: "ドメイン変更", class: "badge-warning" },
};

const organizationTypeLabels: Record<string, string> = {
  political_party: "政党",
  support_group: "後援会",
  fund_management: "資金管理団体",
  other: "その他",
};

export const handler: Handlers<PageData, AuthState> = {
  async GET(_req, ctx) {
    const { id } = ctx.params;
    const apiBase = Deno.env.get("API_BASE_URL") || "http://localhost:3722";

    try {
      const res = await fetch(`${apiBase}/api/admin/organization-manager-verifications/${id}`, {
        headers: { Authorization: `Bearer ${ctx.state.accessToken}` },
      });
      const data = await res.json();

      if (!res.ok) {
        return ctx.render({ verification: null, error: data.error });
      }

      return ctx.render({ verification: data.data });
    } catch (error) {
      return ctx.render({
        verification: null,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  async POST(req, ctx) {
    const { id } = ctx.params;
    const form = await req.formData();
    const action = form.get("action");

    const apiBase = Deno.env.get("API_BASE_URL") || "http://localhost:3722";

    try {
      if (action === "approve") {
        const res = await fetch(
          `${apiBase}/api/admin/organization-manager-verifications/${id}/approve`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${ctx.state.accessToken}`,
            },
            body: JSON.stringify({
              reviewed_by: ctx.state.user?.id,
            }),
          }
        );

        if (!res.ok) {
          const data = await res.json();
          const reqRes = await fetch(
            `${apiBase}/api/admin/organization-manager-verifications/${id}`,
            { headers: { Authorization: `Bearer ${ctx.state.accessToken}` } }
          );
          const reqData = await reqRes.json();
          return ctx.render({ verification: reqData.data, error: data.error });
        }

        return new Response(null, {
          status: 303,
          headers: { Location: "/verifications?tab=organization&status=email_verified" },
        });
      }

      if (action === "reject") {
        const reason = form.get("rejection_reason");
        if (!reason) {
          const res = await fetch(
            `${apiBase}/api/admin/organization-manager-verifications/${id}`,
            { headers: { Authorization: `Bearer ${ctx.state.accessToken}` } }
          );
          const data = await res.json();
          return ctx.render({ verification: data.data, error: "却下理由を入力してください" });
        }

        const res = await fetch(
          `${apiBase}/api/admin/organization-manager-verifications/${id}/reject`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${ctx.state.accessToken}`,
            },
            body: JSON.stringify({
              rejection_reason: reason,
              reviewed_by: ctx.state.user?.id,
            }),
          }
        );

        if (!res.ok) {
          const data = await res.json();
          const reqRes = await fetch(
            `${apiBase}/api/admin/organization-manager-verifications/${id}`,
            { headers: { Authorization: `Bearer ${ctx.state.accessToken}` } }
          );
          const reqData = await reqRes.json();
          return ctx.render({ verification: reqData.data, error: data.error });
        }

        return new Response(null, {
          status: 303,
          headers: { Location: "/verifications?tab=organization&status=email_verified" },
        });
      }

      return ctx.render({ verification: null, error: "Unknown action" });
    } catch (error) {
      return ctx.render({
        verification: null,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
};

export default function OrganizationManagerVerificationDetail({ data }: PageProps<PageData>) {
  const { verification, error } = data;

  if (!verification) {
    return (
      <Layout active="/verifications">
        <div class="alert alert-error">
          <span>⚠️ {error || "申請が見つかりません"}</span>
        </div>
        <a href="/verifications?tab=organization" class="btn btn-ghost mt-4">
          ← 戻る
        </a>
      </Layout>
    );
  }

  return (
    <Layout active="/verifications">
      <div class="space-y-6">
        <div class="flex items-center gap-4">
          <a href="/verifications?tab=organization" class="btn btn-ghost btn-sm">
            ← 戻る
          </a>
          <h1 class="text-3xl font-bold">政治団体管理者認証申請詳細</h1>
        </div>

        {error && (
          <div class="alert alert-error">
            <span>⚠️ {error}</span>
          </div>
        )}

        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <div class="flex items-start justify-between">
              <h2 class="card-title text-2xl">{verification.organization_name}</h2>
              <div class="flex gap-2">
                <span class={`badge ${statusLabels[verification.status]?.class || "badge-ghost"}`}>
                  {statusLabels[verification.status]?.label || verification.status}
                </span>
                <span class={`badge ${requestTypeLabels[verification.request_type]?.class || "badge-outline"}`}>
                  {requestTypeLabels[verification.request_type]?.label || verification.request_type}
                </span>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <p class="text-sm opacity-70">公式メールアドレス</p>
                <p class="font-medium">{verification.official_email}</p>
              </div>
              <div>
                <p class="text-sm opacity-70">ドメイン</p>
                <p class="font-mono">{verification.official_domain}</p>
              </div>
              {verification.organization_type && (
                <div>
                  <p class="text-sm opacity-70">団体種別</p>
                  <p class="font-medium">
                    {organizationTypeLabels[verification.organization_type] || verification.organization_type}
                  </p>
                </div>
              )}
              <div>
                <p class="text-sm opacity-70">申請日</p>
                <p class="font-medium">
                  {new Date(verification.created_at).toLocaleDateString("ja-JP")}
                </p>
              </div>
            </div>

            {/* ドメイン変更の場合は変更情報を表示 */}
            {verification.request_type === "domain_change" && verification.previous_domain && (
              <div class="alert alert-warning mt-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="stroke-current shrink-0 h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div>
                  <h3 class="font-bold">ドメイン変更申請</h3>
                  <p class="text-sm">
                    変更前: <code class="bg-base-200 px-1 rounded">{verification.previous_domain}</code>
                    {" → "}
                    変更後: <code class="bg-base-200 px-1 rounded">{verification.official_domain}</code>
                  </p>
                </div>
              </div>
            )}

            <div class="mt-4">
              <p class="text-sm opacity-70">Ledger ユーザー ID</p>
              <code class="text-sm bg-base-200 px-2 py-1 rounded">
                {verification.ledger_user_id}
              </code>
            </div>

            {verification.organization_id && (
              <div class="mt-4">
                <p class="text-sm opacity-70">既存の政治団体 ID</p>
                <code class="text-sm bg-base-200 px-2 py-1 rounded">
                  {verification.organization_id}
                </code>
              </div>
            )}
          </div>
        </div>

        {verification.status === "email_verified" && (
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Approve Form */}
            <div class="card bg-success/10 border-2 border-success">
              <div class="card-body">
                <h3 class="card-title text-success">✅ 承認</h3>
                <p class="text-sm opacity-70">
                  {verification.request_type === "domain_change"
                    ? "ドメイン変更を承認すると、認証ドメインが更新されます。"
                    : verification.organization_id
                    ? "この申請を承認すると、ユーザーが既存の政治団体の管理者として登録されます。"
                    : "この申請を承認すると、新しい政治団体が作成され、ユーザーがその管理者として登録されます。"}
                </p>
                <form method="POST">
                  <input type="hidden" name="action" value="approve" />
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
                      placeholder="却下の理由を入力してください"
                      class="textarea textarea-bordered"
                      rows={3}
                      required
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

        {verification.status === "approved" && (
          <div class="alert alert-success">
            <span>
              ✅ この申請は承認済みです。
              {verification.reviewed_at && (
                <>
                  {" "}
                  （{new Date(verification.reviewed_at).toLocaleDateString("ja-JP")}）
                </>
              )}
            </span>
          </div>
        )}

        {verification.status === "rejected" && (
          <div class="alert alert-error">
            <div>
              <p>❌ この申請は却下されました。</p>
              <p class="text-sm">理由: {verification.rejection_reason}</p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
