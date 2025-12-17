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
  requests: RegistrationRequest[];
  status: string;
  error?: string;
}

const roleLabels: Record<string, string> = {
  politician: "政治家",
  accountant: "会計責任者",
  both: "政治家 兼 会計責任者",
};

const docTypeLabels: Record<string, string> = {
  certificate: "議員証",
  registration_form: "設立届出書",
  appointment_form: "選任届出書",
  other: "その他",
};

const statusLabels: Record<string, { label: string; class: string }> = {
  pending: { label: "審査中", class: "badge-warning" },
  approved: { label: "承認済", class: "badge-success" },
  rejected: { label: "却下", class: "badge-error" },
};

export const handler: Handlers<PageData, AuthState> = {
  async GET(req, ctx) {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "";

    const apiBase = Deno.env.get("API_BASE_URL") || "http://localhost:3722";

    try {
      const queryParams = status ? `?status=${status}` : "";
      const res = await fetch(
        `${apiBase}/api/admin/registration-requests${queryParams}`,
        {
          headers: { Authorization: `Bearer ${ctx.state.accessToken}` },
        }
      );
      const data = await res.json();

      return ctx.render({
        requests: data.data || [],
        status,
      });
    } catch (error) {
      return ctx.render({
        requests: [],
        status,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
};

export default function RegistrationRequests({ data }: PageProps<PageData>) {
  return (
    <Layout active="/registration-requests">
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <h1 class="text-3xl font-bold">👤 Ledger 登録申請</h1>
        </div>

        {/* Filter tabs */}
        <div class="tabs tabs-boxed">
          <a
            href="/registration-requests"
            class={`tab ${data.status === "" ? "tab-active" : ""}`}
          >
            すべて
          </a>
          <a
            href="/registration-requests?status=pending"
            class={`tab ${data.status === "pending" ? "tab-active" : ""}`}
          >
            🟡 審査中
          </a>
          <a
            href="/registration-requests?status=approved"
            class={`tab ${data.status === "approved" ? "tab-active" : ""}`}
          >
            ✅ 承認済
          </a>
          <a
            href="/registration-requests?status=rejected"
            class={`tab ${data.status === "rejected" ? "tab-active" : ""}`}
          >
            ❌ 却下
          </a>
        </div>

        {data.error && (
          <div class="alert alert-error">
            <span>⚠️ {data.error}</span>
          </div>
        )}

        {data.requests.length === 0 ? (
          <div class="alert">
            <span>リクエストはありません</span>
          </div>
        ) : (
          <div class="space-y-4">
            {data.requests.map((request) => (
              <div key={request.id} class="card bg-base-100 shadow">
                <div class="card-body">
                  <div class="flex items-start justify-between">
                    <div>
                      <h2 class="card-title">
                        {request.full_name}
                        <span
                          class={`badge ${statusLabels[request.status]?.class || "badge-ghost"}`}
                        >
                          {statusLabels[request.status]?.label || request.status}
                        </span>
                      </h2>
                      <p class="text-sm opacity-70">
                        {request.email}
                        {" | "}
                        {roleLabels[request.role] || request.role}
                      </p>
                    </div>
                    <div class="text-right text-sm opacity-70">
                      <p>
                        申請日:{" "}
                        {new Date(request.created_at).toLocaleDateString(
                          "ja-JP"
                        )}
                      </p>
                    </div>
                  </div>

                  <p class="text-sm">
                    📎 本人確認書類:{" "}
                    {docTypeLabels[request.verification_doc_type || ""] ||
                      request.verification_doc_type ||
                      "不明"}
                    {" - "}
                    <a
                      href={request.verification_doc_url}
                      target="_blank"
                      rel="noopener"
                      class="link link-primary"
                    >
                      {request.verification_doc_name || "ファイルを確認"}
                    </a>
                  </p>

                  {request.notes && (
                    <p class="text-sm bg-base-200 p-2 rounded">
                      💬 {request.notes}
                    </p>
                  )}

                  {request.status === "rejected" && request.rejection_reason && (
                    <p class="text-sm text-error">
                      ❌ 却下理由: {request.rejection_reason}
                    </p>
                  )}

                  {request.status === "pending" && (
                    <div class="card-actions justify-end">
                      <a
                        href={`/registration-requests/${request.id}`}
                        class="btn btn-primary btn-sm"
                      >
                        詳細・承認
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
