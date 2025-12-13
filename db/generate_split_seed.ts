/**
 * 市区町村シードデータを Azure SQL 対応版（1000行制限対応）に変換
 * 使用方法: deno run --allow-read --allow-write db/generate_split_seed.ts
 */

const inputFile = "./db/seed_municipalities.sql";
const outputFile = "./db/seed_municipalities_azure.sql";

const content = await Deno.readTextFile(inputFile);

// VALUES の行を抽出（('xxxxx', ...）の形式）
const valueLines: string[] = [];
const lines = content.split("\n");

for (const line of lines) {
  const trimmed = line.trim();
  if (
    trimmed.startsWith("('") &&
    (trimmed.endsWith("),") || trimmed.endsWith(");"))
  ) {
    valueLines.push(trimmed);
  }
}

console.log(`抽出した VALUES 行数: ${valueLines.length}`);

// 900件ずつに分割（安全マージンを取る）
const BATCH_SIZE = 900;
const batches: string[][] = [];

for (let i = 0; i < valueLines.length; i += BATCH_SIZE) {
  batches.push(valueLines.slice(i, i + BATCH_SIZE));
}

console.log(`バッチ数: ${batches.length}`);

// 出力 SQL を生成
let output = `-- 市区町村マスタ 初期データ（Azure SQL 対応版）
-- 生成日: ${new Date().toISOString().split("T")[0]}
-- Azure SQL の 1000 行制限に対応するため、${batches.length}つの INSERT に分割
-- データソース: https://github.com/digitaldemocracy2030/polimoney/blob/main/city_code.csv

`;

for (let i = 0; i < batches.length; i++) {
  const batch = batches[i];
  const isLast = i === batches.length - 1;

  output += `-- Part ${i + 1}/${batches.length} (${batch.length} 件)\n`;
  output += `IF NOT EXISTS (SELECT 1 FROM municipalities WHERE code = '${
    batch[0].match(/'(\d+)'/)?.[1]
  }')\n`;
  output += `BEGIN\n`;
  output += `    INSERT INTO municipalities (code, prefecture_name, city_name, prefecture_name_kana, city_name_kana) VALUES\n`;

  for (let j = 0; j < batch.length; j++) {
    let line = batch[j];
    // 最後の行はセミコロンに、それ以外はカンマに
    if (j === batch.length - 1) {
      line = line.replace(/\),?$/, ");");
    } else {
      line = line.replace(/\);?$/, "),");
    }
    output += `        ${line}\n`;
  }

  output += `END\n`;
  output += `GO\n\n`;
}

await Deno.writeTextFile(outputFile, output);
console.log(`出力ファイル: ${outputFile}`);
console.log("完了！");
