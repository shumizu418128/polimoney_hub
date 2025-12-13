import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../../components/Layout.tsx";

interface OrganizationRequest {
  id: string;
  name: string;
  type: string;
  registration_authority: string | null;
  requested_by_politician_id: string | null;
  requested_by_email: string | null;
  evidence_type: string;
  evidence_file_url: string;
  evidence_file_name: string | null;
  notes: string | null;
  status: string;
  rejection_reason: string | null;
  approved_organization_id: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

interface PageData {
  requests: OrganizationRequest[];
  status: string;
  error?: string;
}

const typeLabels: Record<string, string> = {
  political_party: "政党",
  support_group: "後援会",
  fund_management: "資金管理団体",
  other: "その他",
};

const evidenceTypeLabels: Record<string, string> = {
  registration_form: "設立届出書",
  name_list: "政治団体名簿",
  financial_report: "収支報告書",
};

const statusLabels: Record<string, { label: string; class: string }> = {
  pending: { label: "審査中", class: "badge-warning" },
  approved: { label: "承認済", class: "badge-success" },
  rejected: { label: "却下", class: "badge-error" },
  needs_info: { label: "要追加情報", class: "badge-info" },
};

export const handler: Handlers<PageData> = {
  async GET(req, ctx) {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "";

    const apiBase = Deno.env.get("API_BASE_URL") || "http://localhost:8000";
    const adminKey = Deno.env.get("ADMIN_API_KEY") || "dev-admin-key-67890";

    try {
      const queryParams = status ? `?status=${status}` : "";
      const res = await fetch(`${apiBase}/api/admin/organization-requests${queryParams}`, {
        headers: { "X-Admin-Key": adminKey },
      });
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

export default function OrganizationRequests({ data }: PageProps<PageData>) {
  return (
    <Layout active="/organization-requests">
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <h1 class="text-3xl font-bold">🏛️ 政治団体リクエスト</h1>
        </div>

        {/* Filter tabs */}
        <div class="tabs tabs-boxed">
          <a href="/organization-requests" class={`tab ${data.status === "" ? "tab-active" : ""}`}>
            すべて
          </a>
          <a href="/organization-requests?status=pending" class={`tab ${data.status === "pending" ? "tab-active" : ""}`}>
            🟡 審査中
          </a>
          <a href="/organization-requests?status=approved" class={`tab ${data.status === "approved" ? "tab-active" : ""}`}>
            ✅ 承認済
          </a>
          <a href="/organization-requests?status=rejected" class={`tab ${data.status === "rejected" ? "tab-active" : ""}`}>
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
                        {request.name}
                        <span class={`badge ${statusLabels[request.status]?.class || "badge-ghost"}`}>
                          {statusLabels[request.status]?.label || request.status}
                        </span>
                      </h2>
                      <p class="text-sm opacity-70">
                        {typeLabels[request.type] || request.type}
                        {request.registration_authority && ` | 届出先: ${request.registration_authority}`}
                      </p>
                    </div>
                    <div class="text-right text-sm opacity-70">
                      <p>申請日: {new Date(request.created_at).toLocaleDateString("ja-JP")}</p>
                    </div>
                  </div>

                  <p class="text-sm">
                    📎 証明書類: {evidenceTypeLabels[request.evidence_type] || request.evidence_type}
                    {" - "}
                    <a href={request.evidence_file_url} target="_blank" rel="noopener" class="link link-primary">
                      {request.evidence_file_name || "ファイルを確認"}
                    </a>
                  </p>

                  {request.notes && (
                    <p class="text-sm bg-base-200 p-2 rounded">💬 {request.notes}</p>
                  )}

                  {request.status === "approved" && request.approved_organization_id && (
                    <p class="text-sm text-success">
                      ✅ 作成された団体ID: <code>{request.approved_organization_id}</code>
                    </p>
                  )}

                  {request.status === "rejected" && request.rejection_reason && (
                    <p class="text-sm text-error">❌ 却下理由: {request.rejection_reason}</p>
                  )}

                  {request.status === "pending" && (
                    <div class="card-actions justify-end">
                      <a href={`/organization-requests/${request.id}`} class="btn btn-primary btn-sm">
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

