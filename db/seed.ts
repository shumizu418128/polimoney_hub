/**
 * テストデータ投入スクリプト
 * 使用方法: deno run --allow-net db/seed.ts
 */

const API_BASE = "http://localhost:8000/api/v1";
const API_KEY = "dev-api-key-12345";

const headers = {
  "Content-Type": "application/json",
  "X-API-Key": API_KEY,
};

async function post<T>(endpoint: string, data: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`POST ${endpoint} failed: ${JSON.stringify(json)}`);
  }
  return json.data as T;
}

interface Politician {
  id: string;
  name: string;
  name_kana: string | null;
}

interface Organization {
  id: string;
  name: string;
  type: string;
  politician_id: string | null;
}

interface Election {
  id: string;
  name: string;
  type: string;
  area_code: string;
  election_date: string;
}

async function seed() {
  console.log("🌱 テストデータを投入します...\n");

  // ========================================
  // 政治家データ
  // ========================================
  console.log("👤 政治家を登録中...");

  const politicians: Politician[] = [];

  const politicianData = [
    { name: "山田太郎", name_kana: "やまだたろう" },
    { name: "佐藤花子", name_kana: "さとうはなこ" },
    { name: "鈴木一郎", name_kana: "すずきいちろう" },
    { name: "田中美咲", name_kana: "たなかみさき" },
    { name: "高橋健太", name_kana: "たかはしけんた" },
  ];

  for (const data of politicianData) {
    const politician = await post<Politician>("/politicians", data);
    politicians.push(politician);
    console.log(`  ✅ ${politician.name} (${politician.id})`);
  }

  // ========================================
  // 政治団体データ
  // ========================================
  console.log("\n🏛️ 政治団体を登録中...");

  const organizations: Organization[] = [];

  // 政党
  const partyData = [
    { name: "未来創造党", type: "political_party" },
    { name: "国民改革党", type: "political_party" },
  ];

  for (const data of partyData) {
    const org = await post<Organization>("/organizations", data);
    organizations.push(org);
    console.log(`  ✅ ${org.name} [政党] (${org.id})`);
  }

  // 後援会（政治家に紐づく）
  const supportGroupData = [
    { name: "山田太郎後援会", type: "support_group", politician_id: politicians[0].id },
    { name: "佐藤花子を応援する会", type: "support_group", politician_id: politicians[1].id },
    { name: "鈴木一郎サポーターズ", type: "support_group", politician_id: politicians[2].id },
  ];

  for (const data of supportGroupData) {
    const org = await post<Organization>("/organizations", data);
    organizations.push(org);
    console.log(`  ✅ ${org.name} [後援会] (${org.id})`);
  }

  // ========================================
  // 選挙データ
  // ========================================
  console.log("\n🗳️ 選挙を登録中...");

  const electionData = [
    // 衆議院選挙
    {
      name: "第50回衆議院議員総選挙 東京1区",
      type: "HR",
      area_code: "13-01",
      election_date: "2024-10-27",
    },
    {
      name: "第50回衆議院議員総選挙 東京2区",
      type: "HR",
      area_code: "13-02",
      election_date: "2024-10-27",
    },
    {
      name: "第50回衆議院議員総選挙 大阪1区",
      type: "HR",
      area_code: "27-01",
      election_date: "2024-10-27",
    },
    // 参議院選挙
    {
      name: "第27回参議院議員通常選挙 東京都選挙区",
      type: "HC",
      area_code: "13-00",
      election_date: "2025-07-20",
    },
    // 知事選挙
    {
      name: "東京都知事選挙",
      type: "PG",
      area_code: "13-00",
      election_date: "2024-07-07",
    },
    // 市長選挙
    {
      name: "横浜市長選挙",
      type: "CM",
      area_code: "14-01",
      election_date: "2025-08-22",
    },
  ];

  for (const data of electionData) {
    try {
      const election = await post<Election>("/elections", data);
      console.log(`  ✅ ${election.name} (${election.id})`);
    } catch (e) {
      // 既に存在する場合はスキップ
      console.log(`  ⚠️ ${data.name} - スキップ (既存)`);
    }
  }

  console.log("\n✨ テストデータの投入が完了しました！");

  // 確認用に件数を表示
  console.log("\n📊 登録件数:");
  console.log(`  - 政治家: ${politicians.length}件`);
  console.log(`  - 政治団体: ${organizations.length}件`);
  console.log(`  - 選挙: ${electionData.length}件`);
}

// 実行
seed().catch((err) => {
  console.error("❌ エラー:", err.message);
  Deno.exit(1);
});

