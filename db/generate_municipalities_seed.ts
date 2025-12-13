/**
 * 市区町村マスタの初期データ SQL を生成するスクリプト
 * データソース: https://github.com/digitaldemocracy2030/polimoney/blob/main/city_code.csv
 *
 * 使い方:
 *   deno run --allow-net --allow-write db/generate_municipalities_seed.ts
 */

const CSV_URL =
  "https://raw.githubusercontent.com/digitaldemocracy2030/polimoney/main/city_code.csv";

async function main() {
  console.log("📥 CSV をダウンロード中...");
  const response = await fetch(CSV_URL);
  const csvText = await response.text();

  const lines = csvText.trim().split("\n");
  const header = lines[0]; // スキップ
  console.log(`📄 ヘッダー: ${header}`);

  const dataLines = lines.slice(1);
  console.log(`📊 データ件数: ${dataLines.length}`);

  // SQL 生成
  let sql = `-- 市区町村マスタ 初期データ
-- 生成日: ${new Date().toISOString().split("T")[0]}
-- データソース: https://github.com/digitaldemocracy2030/polimoney/blob/main/city_code.csv

-- 既存データがない場合のみ INSERT
IF NOT EXISTS (SELECT * FROM municipalities WHERE code = '10006')
BEGIN
    INSERT INTO municipalities (code, prefecture_name, city_name, prefecture_name_kana, city_name_kana) VALUES
`;

  const values: string[] = [];

  for (const line of dataLines) {
    // CSV パース（カンマ区切り、ダブルクォート対応）
    const parts = parseCSVLine(line);
    if (parts.length < 5) continue;

    const [code, prefName, cityName, prefKana, cityKana] = parts;

    // 特殊コード（999998, 999999）はスキップ
    if (code === "999998" || code === "999999") continue;

    // SQL Server の NVARCHAR に対応（N プレフィックス）
    const cityNameSql = cityName ? `N'${escapeSQL(cityName)}'` : "NULL";
    const cityKanaSql = cityKana ? `N'${escapeSQL(cityKana)}'` : "NULL";

    values.push(
      `        ('${code}', N'${escapeSQL(prefName)}', ${cityNameSql}, N'${escapeSQL(prefKana)}', ${cityKanaSql})`
    );
  }

  sql += values.join(",\n");
  sql += ";\nEND\nGO\n";

  // ファイル出力
  const outputPath = "db/seed_municipalities.sql";
  await Deno.writeTextFile(outputPath, sql);
  console.log(`✅ 生成完了: ${outputPath}`);
  console.log(`📊 INSERT 件数: ${values.length}`);
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

main();

