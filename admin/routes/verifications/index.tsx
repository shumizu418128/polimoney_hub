import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../../components/Layout.tsx";
import { AuthState } from "../_middleware.ts";

interface PoliticianVerification {
  id: string;
  ledger_user_id: string;
  ledger_user_email: string;
  politician_name: string;
  official_email: string;
  official_domain: string;
  party: string | null;
  status: string;
  request_type: string;
  previous_domain: string | null;
  created_at: string;
}

interface OrganizationManagerVerification {
  id: string;
  ledger_user_id: string;
  ledger_user_email: string;
  organization_name: string;
  official_email: string;
  official_domain: string;
  status: string;
  request_type: string;
  previous_domain: string | null;
  created_at: string;
}

interface PageData {
  politicianVerifications: PoliticianVerification[];
  organizationManagerVerifications: OrganizationManagerVerification[];
  tab: "politician" | "organization";
  status: string;
  devMode: boolean;
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
  new: { label: "新規", class: "badge-outline" },
  domain_change: { label: "ドメイン変更", class: "badge-warning" },
};

export const handler: Handlers<PageData, AuthState> = {
  async GET(req, ctx) {
    const url = new URL(req.url);
    const tab = (url.searchParams.get("tab") || "politician") as "politician" | "organization";
    const status = url.searchParams.get("status") || "";

    const apiBase = Deno.env.get("API_BASE_URL") || "http://localhost:3722";

    // ユーザーの dev_mode を取得
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

    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const queryString = params.toString();
      const queryParams = queryString ? `?${queryString}` : "";

      // 両方のデータを取得
      const [politicianRes, orgRes] = await Promise.all([
        fetch(`${apiBase}/api/admin/politician-verifications${queryParams}`, {
          headers: { Authorization: `Bearer ${ctx.state.accessToken}` },
        }),
        fetch(`${apiBase}/api/admin/organization-manager-verifications${queryParams}`, {
          headers: { Authorization: `Bearer ${ctx.state.accessToken}` },
        }),
      ]);

      const politicianData = await politicianRes.json();
      const orgData = await orgRes.json();

      return ctx.render({
        politicianVerifications: politicianData.data || [],
        organizationManagerVerifications: orgData.data || [],
        tab,
        status,
        devMode,
      });
    } catch (error) {
      return ctx.render({
        politicianVerifications: [],
        organizationManagerVerifications: [],
        tab,
        status,
        devMode,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
};

export default function VerificationsPage({ data }: PageProps<PageData>) {
  const { politicianVerifications, organizationManagerVerifications, tab, status, devMode, error } = data;

  const pendingPoliticianCount = politicianVerifications.filter((v) => v.status === "email_verified").length;
  const pendingOrgCount = organizationManagerVerifications.filter((v) => v.status === "email_verified").length;

  return (
    <Layout active="/verifications" devMode={devMode}>
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <h1 class="text-3xl font-bold">✅ 認証申請管理</h1>
          {devMode && (
            <div class="badge badge-warning gap-1">
              🧪 開発モード
            </div>
          )}
        </div>

        {error && (
          <div class="alert alert-error">
            <span>⚠️ {error}</span>
          </div>
        )}

        {/* タブ切り替え */}
        <div role="tablist" class="tabs tabs-boxed">
          <a
            href={`/verifications?tab=politician${status ? `&status=${status}` : ""}`}
            role="tab"
            class={`tab ${tab === "politician" ? "tab-active" : ""}`}
          >
            👤 政治家認証
            {pendingPoliticianCount > 0 && (
              <span class="badge badge-sm badge-accent ml-2">{pendingPoliticianCount}</span>
            )}
          </a>
          <a
            href={`/verifications?tab=organization${status ? `&status=${status}` : ""}`}
            role="tab"
            class={`tab ${tab === "organization" ? "tab-active" : ""}`}
          >
            🏛️ 団体管理者認証
            {pendingOrgCount > 0 && (
              <span class="badge badge-sm badge-accent ml-2">{pendingOrgCount}</span>
            )}
          </a>
        </div>

        {/* ステータスフィルタ */}
        <div class="tabs tabs-boxed">
          <a
            href={`/verifications?tab=${tab}`}
            class={`tab ${status === "" ? "tab-active" : ""}`}
          >
            すべて
          </a>
          <a
            href={`/verifications?tab=${tab}&status=email_verified`}
            class={`tab ${status === "email_verified" ? "tab-active" : ""}`}
          >
            🟡 承認待ち
          </a>
          <a
            href={`/verifications?tab=${tab}&status=approved`}
            class={`tab ${status === "approved" ? "tab-active" : ""}`}
          >
            ✅ 承認済
          </a>
          <a
            href={`/verifications?tab=${tab}&status=rejected`}
            class={`tab ${status === "rejected" ? "tab-active" : ""}`}
          >
            ❌ 却下
          </a>
        </div>

        {/* 政治家認証タブ */}
        {tab === "politician" && (
          <>
            {politicianVerifications.length === 0 ? (
              <div class="alert">
                <span>申請はありません</span>
              </div>
            ) : (
              <div class="space-y-4">
                {politicianVerifications.map((v) => (
                  <div key={v.id} class="card bg-base-100 shadow">
                    <div class="card-body">
                      <div class="flex items-start justify-between">
                        <div>
                          <h2 class="card-title">
                            {v.politician_name}
                            <span class={`badge ${statusLabels[v.status]?.class || "badge-ghost"}`}>
                              {statusLabels[v.status]?.label || v.status}
                            </span>
                            <span class={`badge ${requestTypeLabels[v.request_type]?.class || "badge-outline"}`}>
                              {requestTypeLabels[v.request_type]?.label || v.request_type}
                            </span>
                          </h2>
                          <p class="text-sm opacity-70">
                            {v.official_email} ({v.official_domain})
                          </p>
                          {v.request_type === "domain_change" && v.previous_domain && (
                            <p class="text-sm text-warning">
                              🔄 変更前: {v.previous_domain} → 変更後: {v.official_domain}
                            </p>
                          )}
                          {v.party && (
                            <p class="text-sm opacity-70">所属: {v.party}</p>
                          )}
                        </div>
                        <div class="text-right text-sm opacity-70">
                          <p>
                            申請日:{" "}
                            {new Date(v.created_at).toLocaleDateString("ja-JP")}
                          </p>
                        </div>
                      </div>

                      {v.status === "email_verified" && (
                        <div class="card-actions justify-end">
                          <a
                            href={`/verifications/politician/${v.id}`}
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
          </>
        )}

        {/* 政治団体管理者認証タブ */}
        {tab === "organization" && (
          <>
            {organizationManagerVerifications.length === 0 ? (
              <div class="alert">
                <span>申請はありません</span>
              </div>
            ) : (
              <div class="space-y-4">
                {organizationManagerVerifications.map((v) => (
                  <div key={v.id} class="card bg-base-100 shadow">
                    <div class="card-body">
                      <div class="flex items-start justify-between">
                        <div>
                          <h2 class="card-title">
                            {v.organization_name}
                            <span class={`badge ${statusLabels[v.status]?.class || "badge-ghost"}`}>
                              {statusLabels[v.status]?.label || v.status}
                            </span>
                            <span class={`badge ${requestTypeLabels[v.request_type]?.class || "badge-outline"}`}>
                              {requestTypeLabels[v.request_type]?.label || v.request_type}
                            </span>
                          </h2>
                          <p class="text-sm opacity-70">
                            {v.official_email} ({v.official_domain})
                          </p>
                          {v.request_type === "domain_change" && v.previous_domain && (
                            <p class="text-sm text-warning">
                              🔄 変更前: {v.previous_domain} → 変更後: {v.official_domain}
                            </p>
                          )}
                        </div>
                        <div class="text-right text-sm opacity-70">
                          <p>
                            申請日:{" "}
                            {new Date(v.created_at).toLocaleDateString("ja-JP")}
                          </p>
                        </div>
                      </div>

                      {v.status === "email_verified" && (
                        <div class="card-actions justify-end">
                          <a
                            href={`/verifications/organization/${v.id}`}
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
          </>
        )}
      </div>
    </Layout>
  );
}
