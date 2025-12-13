import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../components/Layout.tsx";

interface DashboardData {
  pendingElectionRequests: number;
  pendingOrganizationRequests: number;
  totalElections: number;
  totalOrganizations: number;
  error?: string;
}

export const handler: Handlers<DashboardData> = {
  async GET(_req, ctx) {
    const apiBase = Deno.env.get("API_BASE_URL") || "http://localhost:8000";
    const adminKey = Deno.env.get("ADMIN_API_KEY") || "dev-admin-key-67890";

    try {
      const [electionReqRes, orgReqRes, electionsRes, orgsRes] = await Promise.all([
        fetch(`${apiBase}/api/admin/election-requests?status=pending`, {
          headers: { "X-Admin-Key": adminKey },
        }),
        fetch(`${apiBase}/api/admin/organization-requests?status=pending`, {
          headers: { "X-Admin-Key": adminKey },
        }),
        fetch(`${apiBase}/api/v1/elections`, {
          headers: { "X-API-Key": Deno.env.get("API_KEY") || "dev-api-key-12345" },
        }),
        fetch(`${apiBase}/api/v1/organizations`, {
          headers: { "X-API-Key": Deno.env.get("API_KEY") || "dev-api-key-12345" },
        }),
      ]);

      const [electionReqData, orgReqData, electionsData, orgsData] = await Promise.all([
        electionReqRes.json(),
        orgReqRes.json(),
        electionsRes.json(),
        orgsRes.json(),
      ]);

      return ctx.render({
        pendingElectionRequests: electionReqData.data?.length || 0,
        pendingOrganizationRequests: orgReqData.data?.length || 0,
        totalElections: electionsData.data?.length || 0,
        totalOrganizations: orgsData.data?.length || 0,
      });
    } catch (error) {
      return ctx.render({
        pendingElectionRequests: 0,
        pendingOrganizationRequests: 0,
        totalElections: 0,
        totalOrganizations: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
};

export default function Dashboard({ data }: PageProps<DashboardData>) {
  const stats = [
    {
      title: "保留中の選挙リクエスト",
      value: data.pendingElectionRequests,
      icon: "🗳️",
      href: "/election-requests?status=pending",
      color: data.pendingElectionRequests > 0 ? "bg-warning text-warning-content" : "bg-base-100",
    },
    {
      title: "保留中の団体リクエスト",
      value: data.pendingOrganizationRequests,
      icon: "🏛️",
      href: "/organization-requests?status=pending",
      color: data.pendingOrganizationRequests > 0 ? "bg-warning text-warning-content" : "bg-base-100",
    },
    {
      title: "登録済み選挙",
      value: data.totalElections,
      icon: "📅",
      href: "/elections",
      color: "bg-base-100",
    },
    {
      title: "登録済み政治団体",
      value: data.totalOrganizations,
      icon: "🏢",
      href: "/organizations",
      color: "bg-base-100",
    },
  ];

  return (
    <Layout active="/">
      <div class="space-y-6">
        <h1 class="text-3xl font-bold">ダッシュボード</h1>

        {data.error && (
          <div class="alert alert-error">
            <span>⚠️ API 接続エラー: {data.error}</span>
          </div>
        )}

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <a
              key={stat.title}
              href={stat.href}
              class={`card ${stat.color} shadow-lg hover:shadow-xl transition-shadow`}
            >
              <div class="card-body">
                <div class="flex items-center gap-4">
                  <span class="text-4xl">{stat.icon}</span>
                  <div>
                    <p class="text-sm opacity-70">{stat.title}</p>
                    <p class="text-3xl font-bold">{stat.value}</p>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>

        <div class="divider"></div>

        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <h2 class="card-title">クイックアクション</h2>
            <div class="flex flex-wrap gap-2">
              <a href="/election-requests" class="btn btn-primary">
                🗳️ 選挙リクエストを確認
              </a>
              <a href="/organization-requests" class="btn btn-primary">
                🏛️ 団体リクエストを確認
              </a>
              <a href="/elections/new" class="btn btn-secondary">
                ➕ 選挙を登録
              </a>
              <a href="/organizations/new" class="btn btn-secondary">
                ➕ 政治団体を登録
              </a>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
