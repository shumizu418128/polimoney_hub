-- Polimoney Hub - Supabase (PostgreSQL) Schema
-- 共通識別子マスタ DB

-- ============================================
-- 基本マスタ
-- ============================================

-- 市区町村マスタ（総務省 全国地方公共団体コード）
CREATE TABLE IF NOT EXISTS municipalities (
    code VARCHAR(6) PRIMARY KEY,
    prefecture_name VARCHAR(10) NOT NULL,
    city_name VARCHAR(50),
    prefecture_name_kana VARCHAR(20),
    city_name_kana VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 選挙区マスタ
CREATE TABLE IF NOT EXISTS districts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(10) NOT NULL,
    prefecture_codes VARCHAR(50),
    municipality_code VARCHAR(6) REFERENCES municipalities(code),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 政治家マスタ
CREATE TABLE IF NOT EXISTS politicians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    name_kana VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 政治団体マスタ
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    politician_id UUID REFERENCES politicians(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 選挙マスタ
CREATE TABLE IF NOT EXISTS elections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(10) NOT NULL,
    district_id UUID REFERENCES districts(id),
    election_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- マスタ更新日時
CREATE TABLE IF NOT EXISTS master_metadata (
    table_name VARCHAR(50) PRIMARY KEY,
    last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- インデックス（基本マスタ）
-- ============================================

CREATE INDEX IF NOT EXISTS idx_municipalities_prefecture ON municipalities(prefecture_name);
CREATE INDEX IF NOT EXISTS idx_municipalities_active ON municipalities(is_active);
CREATE INDEX IF NOT EXISTS idx_districts_type ON districts(type);
CREATE INDEX IF NOT EXISTS idx_districts_active ON districts(is_active);
CREATE INDEX IF NOT EXISTS idx_districts_municipality ON districts(municipality_code);
CREATE INDEX IF NOT EXISTS idx_organizations_politician_id ON organizations(politician_id);
CREATE INDEX IF NOT EXISTS idx_organizations_active ON organizations(is_active);
CREATE INDEX IF NOT EXISTS idx_elections_type ON elections(type);
CREATE INDEX IF NOT EXISTS idx_elections_date ON elections(election_date);
CREATE INDEX IF NOT EXISTS idx_elections_district ON elections(district_id);
CREATE INDEX IF NOT EXISTS idx_elections_active ON elections(is_active);

-- ============================================
-- 公開データ（Ledger から同期）
-- ============================================

-- 公開用台帳
CREATE TABLE IF NOT EXISTS public_ledgers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    politician_id UUID NOT NULL REFERENCES politicians(id),
    organization_id UUID REFERENCES organizations(id),
    election_id UUID REFERENCES elections(id),
    fiscal_year INT NOT NULL,
    total_income INT DEFAULT 0,
    total_expense INT DEFAULT 0,
    journal_count INT DEFAULT 0,
    ledger_source_id UUID NOT NULL UNIQUE,
    last_updated_at TIMESTAMPTZ NOT NULL,
    first_synced_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 公開用仕訳
CREATE TABLE IF NOT EXISTS public_journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ledger_id UUID NOT NULL REFERENCES public_ledgers(id),
    journal_source_id UUID NOT NULL UNIQUE,
    date DATE NOT NULL,
    description TEXT,
    amount INT NOT NULL,
    contact_name TEXT,
    contact_type VARCHAR(20),
    account_code VARCHAR(50),
    classification VARCHAR(20),
    non_monetary_basis TEXT,
    note TEXT,
    public_expense_amount INT,
    content_hash VARCHAR(64) NOT NULL,
    synced_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 変更ログ
CREATE TABLE IF NOT EXISTS ledger_change_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ledger_id UUID NOT NULL REFERENCES public_ledgers(id),
    changed_at TIMESTAMPTZ NOT NULL,
    change_summary TEXT NOT NULL,
    change_details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- インデックス（公開データ用）
-- ============================================

CREATE INDEX IF NOT EXISTS idx_public_ledgers_politician ON public_ledgers(politician_id);
CREATE INDEX IF NOT EXISTS idx_public_ledgers_fiscal_year ON public_ledgers(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_public_ledgers_election ON public_ledgers(election_id);
CREATE INDEX IF NOT EXISTS idx_public_journals_ledger ON public_journals(ledger_id);
CREATE INDEX IF NOT EXISTS idx_public_journals_date ON public_journals(date);
CREATE INDEX IF NOT EXISTS idx_change_logs_ledger ON ledger_change_logs(ledger_id);
CREATE INDEX IF NOT EXISTS idx_change_logs_changed_at ON ledger_change_logs(changed_at DESC);

-- ============================================
-- 登録リクエスト
-- ============================================

-- 選挙登録リクエスト
CREATE TABLE IF NOT EXISTS election_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(10) NOT NULL,
    district_id UUID REFERENCES districts(id),
    area_description TEXT,
    election_date DATE NOT NULL,
    requested_by_politician_id UUID REFERENCES politicians(id),
    requested_by_email VARCHAR(255),
    evidence_url TEXT,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    rejection_reason TEXT,
    approved_election_id UUID REFERENCES elections(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by VARCHAR(255)
);

-- 政治団体登録リクエスト
CREATE TABLE IF NOT EXISTS organization_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- ============================================
-- インデックス（リクエスト用）
-- ============================================

CREATE INDEX IF NOT EXISTS idx_election_requests_status ON election_requests(status);
CREATE INDEX IF NOT EXISTS idx_election_requests_politician ON election_requests(requested_by_politician_id);
CREATE INDEX IF NOT EXISTS idx_organization_requests_status ON organization_requests(status);
CREATE INDEX IF NOT EXISTS idx_organization_requests_politician ON organization_requests(requested_by_politician_id);

-- ============================================
-- 初期データ
-- ============================================

INSERT INTO master_metadata (table_name, last_updated_at)
VALUES 
    ('municipalities', NOW()),
    ('districts', NOW()),
    ('elections', NOW()),
    ('politicians', NOW()),
    ('organizations', NOW())
ON CONFLICT (table_name) DO NOTHING;

-- ============================================
-- 管理者テーブル（Supabase Auth 連携）
-- ============================================

-- 管理者ユーザー（auth.users と連携）
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(20) DEFAULT 'admin',  -- 'admin', 'super_admin'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active);

-- ============================================
-- Row Level Security (RLS) - 基本設定
-- ============================================

-- 全テーブルで RLS を有効化（読み取りは全員許可、書き込みは service_role のみ）
ALTER TABLE municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE politicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- 読み取りポリシー（全員許可）
CREATE POLICY "Allow public read" ON municipalities FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON districts FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON politicians FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON organizations FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON elections FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON master_metadata FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public_ledgers FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public_journals FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON ledger_change_logs FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON election_requests FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON organization_requests FOR SELECT USING (true);

-- 管理者は自分のデータのみ読める
CREATE POLICY "Admin users can read own data" ON admin_users FOR SELECT USING (auth.uid() = id);

-- 書き込みポリシー（service_role のみ）
CREATE POLICY "Allow service write" ON municipalities FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON districts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON politicians FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON organizations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON elections FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON master_metadata FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON public_ledgers FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON public_journals FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON ledger_change_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON election_requests FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON organization_requests FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON admin_users FOR ALL USING (auth.role() = 'service_role');
