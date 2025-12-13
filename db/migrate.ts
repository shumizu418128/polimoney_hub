/**
 * マイグレーションスクリプト
 * 使用方法: deno run --allow-net --allow-env --allow-read db/migrate.ts
 */

import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const connectionString = Deno.env.get("DATABASE_URL");

if (!connectionString) {
  console.error("❌ DATABASE_URL is not set");
  Deno.exit(1);
}

const pool = new Pool(connectionString, 1, true);
const conn = await pool.connect();

console.log("🔄 Running migrations...\n");

const sql = `
-- 選挙登録リクエスト
CREATE TABLE IF NOT EXISTS election_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(10) NOT NULL,
    area_description TEXT NOT NULL,
    election_date DATE NOT NULL,
    requested_by_politician_id UUID REFERENCES politicians(id),
    requested_by_email VARCHAR(255),
    evidence_url TEXT,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    rejection_reason TEXT,
    approved_election_id VARCHAR(50) REFERENCES elections(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by VARCHAR(255)
);

-- 政治団体登録リクエスト
CREATE TABLE IF NOT EXISTS organization_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    registration_authority VARCHAR(100),
    requested_by_politician_id UUID REFERENCES politicians(id),
    requested_by_email VARCHAR(255),
    evidence_type VARCHAR(50) NOT NULL,
    evidence_file_url TEXT NOT NULL,
    evidence_file_name VARCHAR(255),
    notes TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    rejection_reason TEXT,
    approved_organization_id UUID REFERENCES organizations(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by VARCHAR(255)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_election_requests_status ON election_requests(status);
CREATE INDEX IF NOT EXISTS idx_election_requests_politician ON election_requests(requested_by_politician_id);
CREATE INDEX IF NOT EXISTS idx_organization_requests_status ON organization_requests(status);
CREATE INDEX IF NOT EXISTS idx_organization_requests_politician ON organization_requests(requested_by_politician_id);
`;

try {
  await conn.queryObject(sql);
  console.log("✅ election_requests table created");
  console.log("✅ organization_requests table created");
  console.log("✅ Indexes created");
  console.log("\n✨ Migration completed successfully!");
} catch (error) {
  console.error("❌ Migration failed:", error);
  Deno.exit(1);
} finally {
  conn.release();
  await pool.end();
}

