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
-- 勘定科目マスタ（政治資金規正法準拠）
-- ============================================

-- 勘定科目マスタ
CREATE TABLE IF NOT EXISTS account_codes (
    code VARCHAR(50) PRIMARY KEY,                      -- 'EXP_PERSONNEL', 'REV_DONATION_INDIVIDUAL'
    name VARCHAR(100) NOT NULL,                        -- '人件費', '個人からの寄附'
    name_kana VARCHAR(100),                            -- 読み仮名
    type VARCHAR(20) NOT NULL,                         -- 'asset', 'liability', 'equity', 'revenue', 'expense', 'subsidy'
    report_category VARCHAR(50) NOT NULL,              -- '経常経費', '政治活動費', '選挙運動費用'
    ledger_type VARCHAR(20) NOT NULL DEFAULT 'both',   -- 'both', 'organization', 'election'
    is_public_subsidy_eligible BOOLEAN DEFAULT FALSE,  -- 公費負担対象か
    display_order INT NOT NULL,                        -- 表示順
    polimoney_category VARCHAR(50),                    -- Polimoney での表示カテゴリ
    parent_code VARCHAR(50) REFERENCES account_codes(code),  -- 親科目（階層構造用）
    description TEXT,                                  -- 説明
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_codes_type ON account_codes(type);
CREATE INDEX IF NOT EXISTS idx_account_codes_ledger ON account_codes(ledger_type);
CREATE INDEX IF NOT EXISTS idx_account_codes_order ON account_codes(display_order);
CREATE INDEX IF NOT EXISTS idx_account_codes_active ON account_codes(is_active);

-- ============================================
-- 選挙公営費目マスタ（選挙の種類ごとの公費負担上限）
-- ============================================

-- 選挙タイプマスタ
CREATE TABLE IF NOT EXISTS election_types (
    code VARCHAR(10) PRIMARY KEY,          -- 'HR', 'HC', 'PG', 'CM', 'GM'
    name VARCHAR(50) NOT NULL,             -- '衆議院選挙', '参議院選挙'
    description TEXT,
    display_order INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 選挙公営費目マスタ（公費負担の費目と上限額）
CREATE TABLE IF NOT EXISTS public_subsidy_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_type_code VARCHAR(10) NOT NULL REFERENCES election_types(code),
    account_code VARCHAR(50) NOT NULL REFERENCES account_codes(code),
    item_name VARCHAR(100) NOT NULL,       -- '選挙運動用ポスター', '選挙運動用ビラ'
    unit VARCHAR(20),                      -- '枚', '台', '日'
    unit_price_limit INT,                  -- 単価上限（円）
    quantity_formula TEXT,                 -- 数量計算式（例: '有権者数 / 1000'）
    max_quantity INT,                      -- 最大数量
    total_limit INT,                       -- 総額上限（円）
    notes TEXT,                            -- 備考（法令根拠等）
    effective_from DATE,                   -- 適用開始日
    effective_until DATE,                  -- 適用終了日（NULL = 現在有効）
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subsidy_items_election ON public_subsidy_items(election_type_code);
CREATE INDEX IF NOT EXISTS idx_subsidy_items_account ON public_subsidy_items(account_code);
CREATE INDEX IF NOT EXISTS idx_subsidy_items_active ON public_subsidy_items(is_active);

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
    ('organizations', NOW()),
    ('account_codes', NOW()),
    ('election_types', NOW()),
    ('public_subsidy_items', NOW())
ON CONFLICT (table_name) DO NOTHING;

-- ============================================
-- ロック解除リクエスト（Ledger から受信）
-- ============================================

-- Ledger の年度締め済み台帳のロック解除リクエスト
CREATE TABLE IF NOT EXISTS unlock_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ledger_id UUID NOT NULL,                    -- Ledger 側の ledger ID
    ledger_type VARCHAR(20) NOT NULL,           -- 'election' | 'organization'
    fiscal_year INT,                            -- 政治団体台帳の場合のみ
    requested_by_user_id UUID NOT NULL,         -- Ledger 側の user ID
    requested_by_email VARCHAR(255) NOT NULL,
    reason TEXT NOT NULL,                       -- 修正理由
    status VARCHAR(20) DEFAULT 'pending',       -- 'pending' | 'approved' | 'rejected'
    approved_at TIMESTAMPTZ,
    approved_by UUID,                           -- Hub admin user ID
    unlock_expires_at TIMESTAMPTZ,              -- 解除期限（承認から7日後）
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unlock_requests_status ON unlock_requests(status);
CREATE INDEX IF NOT EXISTS idx_unlock_requests_ledger ON unlock_requests(ledger_id);
CREATE INDEX IF NOT EXISTS idx_unlock_requests_expires ON unlock_requests(unlock_expires_at);

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
ALTER TABLE account_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_subsidy_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE unlock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- 読み取りポリシー（全員許可）
CREATE POLICY "Allow public read" ON municipalities FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON districts FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON politicians FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON organizations FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON elections FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON master_metadata FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON account_codes FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON election_types FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public_subsidy_items FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public_ledgers FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public_journals FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON ledger_change_logs FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON election_requests FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON organization_requests FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON unlock_requests FOR SELECT USING (true);

-- 管理者は自分のデータのみ読める
CREATE POLICY "Admin users can read own data" ON admin_users FOR SELECT USING (auth.uid() = id);

-- 書き込みポリシー（service_role のみ）
CREATE POLICY "Allow service write" ON municipalities FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON districts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON politicians FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON organizations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON elections FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON master_metadata FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON account_codes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON election_types FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON public_subsidy_items FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON public_ledgers FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON public_journals FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON ledger_change_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON election_requests FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON organization_requests FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON unlock_requests FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON admin_users FOR ALL USING (auth.role() = 'service_role');
