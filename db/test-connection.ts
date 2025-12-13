/**
 * Azure SQL Database 接続テスト
 * 使用方法: deno task test:db
 */

import "std/dotenv/load.ts";
import { getPool, query, closePool } from "../api/db/client.ts";

async function testConnection() {
  console.log("🔄 Azure SQL Database 接続テスト開始...\n");

  try {
    // 接続テスト
    await getPool();
    console.log("✅ 接続成功!\n");

    // テーブル一覧取得
    console.log("📋 テーブル一覧:");
    const tables = await query<{ TABLE_NAME: string }>(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
    );
    tables.forEach((t) => console.log(`   - ${t.TABLE_NAME}`));

    // 市区町村データ件数
    console.log("\n📊 データ件数:");
    const municipalityCount = await query<{ count: number }>(
      "SELECT COUNT(*) as count FROM municipalities"
    );
    console.log(`   - municipalities: ${municipalityCount[0]?.count ?? 0} 件`);

    // サンプルデータ表示
    console.log("\n🗾 サンプルデータ（東京都の市区町村 5件）:");
    const samples = await query<{
      code: string;
      prefecture_name: string;
      city_name: string;
    }>(
      "SELECT TOP 5 code, prefecture_name, city_name FROM municipalities WHERE prefecture_name = N'東京都'"
    );
    samples.forEach((s) =>
      console.log(`   ${s.code}: ${s.prefecture_name} ${s.city_name || ""}`)
    );

    console.log("\n✅ すべてのテスト完了!");
  } catch (error) {
    console.error("❌ エラー:", error);
    Deno.exit(1);
  } finally {
    await closePool();
  }
}

testConnection();


