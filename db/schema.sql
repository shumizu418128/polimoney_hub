-- Polimoney Hub - Azure SQL Database Schema
-- 共通識別子マスタ DB

-- ============================================
-- 基本マスタ
-- ============================================

-- 市区町村マスタ（総務省 全国地方公共団体コード）
-- データソース: https://github.com/digitaldemocracy2030/polimoney/blob/main/city_code.csv
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'municipalities')
CREATE TABLE municipalities (
    code VARCHAR(6) PRIMARY KEY,          -- 団体コード（6桁）
    prefecture_name NVARCHAR(10) NOT NULL,-- 都道府県名
    city_name NVARCHAR(50),               -- 市区町村名（NULL = 都道府県）
    prefecture_name_kana NVARCHAR(20),    -- 都道府県名（カナ）
    city_name_kana NVARCHAR(50),          -- 市区町村名（カナ）
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- 選挙区マスタ
-- 衆参: 独自の選挙区定義
-- 地方: municipality_code で市区町村を参照
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'districts')
CREATE TABLE districts (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(100) NOT NULL,          -- '東京都第1区', '鳥取県・島根県', '渋谷区'
    type VARCHAR(10) NOT NULL,            -- HR, HC, PG, CM, GM
    prefecture_codes VARCHAR(50),         -- '13' or '31,32'（衆参の合区の場合）
    municipality_code VARCHAR(6) REFERENCES municipalities(code),  -- 地方選挙用
    description NVARCHAR(MAX),
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- 政治家マスタ
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'politicians')
CREATE TABLE politicians (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    name_kana NVARCHAR(255),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- 政治団体マスタ
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'organizations')
CREATE TABLE organizations (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,            -- 'political_party', 'support_group', 'fund_management', 'other'
    politician_id UNIQUEIDENTIFIER REFERENCES politicians(id),
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- 選挙マスタ
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'elections')
CREATE TABLE elections (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    type VARCHAR(10) NOT NULL,            -- HR, HC, PG, CM, GM
    district_id UNIQUEIDENTIFIER REFERENCES districts(id),
    election_date DATE NOT NULL,
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- マスタ更新日時（Polimoney 表示用）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'master_metadata')
CREATE TABLE master_metadata (
    table_name VARCHAR(50) PRIMARY KEY,
    last_updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- ============================================
-- インデックス（基本マスタ）
-- ============================================

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_municipalities_prefecture')
CREATE INDEX idx_municipalities_prefecture ON municipalities(prefecture_name);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_municipalities_active')
CREATE INDEX idx_municipalities_active ON municipalities(is_active);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_districts_type')
CREATE INDEX idx_districts_type ON districts(type);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_districts_active')
CREATE INDEX idx_districts_active ON districts(is_active);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_districts_municipality')
CREATE INDEX idx_districts_municipality ON districts(municipality_code);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_organizations_politician_id')
CREATE INDEX idx_organizations_politician_id ON organizations(politician_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_organizations_active')
CREATE INDEX idx_organizations_active ON organizations(is_active);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_elections_type')
CREATE INDEX idx_elections_type ON elections(type);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_elections_date')
CREATE INDEX idx_elections_date ON elections(election_date);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_elections_district')
CREATE INDEX idx_elections_district ON elections(district_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_elections_active')
CREATE INDEX idx_elections_active ON elections(is_active);

-- ============================================
-- 公開データ（Ledger から同期）
-- ============================================

-- 公開用台帳（1年分の収支報告）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'public_ledgers')
CREATE TABLE public_ledgers (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    politician_id UNIQUEIDENTIFIER NOT NULL REFERENCES politicians(id),
    organization_id UNIQUEIDENTIFIER REFERENCES organizations(id),
    election_id UNIQUEIDENTIFIER REFERENCES elections(id),
    fiscal_year INT NOT NULL,
    -- 集計データ
    total_income INT DEFAULT 0,
    total_expense INT DEFAULT 0,
    journal_count INT DEFAULT 0,
    -- 同期メタデータ
    ledger_source_id UNIQUEIDENTIFIER NOT NULL,
    last_updated_at DATETIME2 NOT NULL,
    first_synced_at DATETIME2 NOT NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    -- ユニーク制約
    CONSTRAINT uq_ledger_source UNIQUE (ledger_source_id)
);

-- 公開用仕訳
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'public_journals')
CREATE TABLE public_journals (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ledger_id UNIQUEIDENTIFIER NOT NULL REFERENCES public_ledgers(id),
    journal_source_id UNIQUEIDENTIFIER NOT NULL,
    date DATE NOT NULL,
    description NVARCHAR(MAX),
    amount INT NOT NULL,
    -- 匿名化済みデータ
    contact_name NVARCHAR(MAX),
    contact_type VARCHAR(20),
    account_code VARCHAR(50),
    -- 改ざん検知用
    content_hash VARCHAR(64) NOT NULL,
    synced_at DATETIME2 NOT NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    -- ユニーク制約
    CONSTRAINT uq_journal_source UNIQUE (journal_source_id)
);

-- 台帳レベルの変更ログ
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ledger_change_logs')
CREATE TABLE ledger_change_logs (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ledger_id UNIQUEIDENTIFIER NOT NULL REFERENCES public_ledgers(id),
    changed_at DATETIME2 NOT NULL,
    change_summary NVARCHAR(MAX) NOT NULL,
    change_details NVARCHAR(MAX),  -- JSON形式で保存
    created_at DATETIME2 DEFAULT GETUTCDATE()
);

-- ============================================
-- インデックス（公開データ用）
-- ============================================

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_public_ledgers_politician')
CREATE INDEX idx_public_ledgers_politician ON public_ledgers(politician_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_public_ledgers_fiscal_year')
CREATE INDEX idx_public_ledgers_fiscal_year ON public_ledgers(fiscal_year);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_public_ledgers_election')
CREATE INDEX idx_public_ledgers_election ON public_ledgers(election_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_public_journals_ledger')
CREATE INDEX idx_public_journals_ledger ON public_journals(ledger_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_public_journals_date')
CREATE INDEX idx_public_journals_date ON public_journals(date);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_change_logs_ledger')
CREATE INDEX idx_change_logs_ledger ON ledger_change_logs(ledger_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_change_logs_changed_at')
CREATE INDEX idx_change_logs_changed_at ON ledger_change_logs(changed_at DESC);

-- ============================================
-- 登録リクエスト
-- ============================================

-- 選挙登録リクエスト
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'election_requests')
CREATE TABLE election_requests (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    
    -- リクエスト内容
    name NVARCHAR(255) NOT NULL,
    type VARCHAR(10) NOT NULL,
    district_id UNIQUEIDENTIFIER REFERENCES districts(id),
    area_description NVARCHAR(MAX),
    election_date DATE NOT NULL,
    
    -- リクエスト者
    requested_by_politician_id UNIQUEIDENTIFIER REFERENCES politicians(id),
    requested_by_email VARCHAR(255),
    
    -- 証明
    evidence_url NVARCHAR(MAX),
    notes NVARCHAR(MAX),
    
    -- ステータス
    status VARCHAR(20) DEFAULT 'pending',
    rejection_reason NVARCHAR(MAX),
    
    -- 承認後に作成された選挙ID
    approved_election_id UNIQUEIDENTIFIER REFERENCES elections(id),
    
    -- タイムスタンプ
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    reviewed_at DATETIME2,
    reviewed_by NVARCHAR(255)
);

-- 政治団体登録リクエスト
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'organization_requests')
CREATE TABLE organization_requests (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    
    -- リクエスト内容
    name NVARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    registration_authority NVARCHAR(100),
    
    -- リクエスト者
    requested_by_politician_id UNIQUEIDENTIFIER REFERENCES politicians(id),
    requested_by_email VARCHAR(255),
    
    -- 証明書類
    evidence_type VARCHAR(50) NOT NULL,
    evidence_file_url NVARCHAR(MAX) NOT NULL,
    evidence_file_name NVARCHAR(255),
    notes NVARCHAR(MAX),
    
    -- ステータス
    status VARCHAR(20) DEFAULT 'pending',
    rejection_reason NVARCHAR(MAX),
    
    -- 承認後に作成された団体ID
    approved_organization_id UNIQUEIDENTIFIER REFERENCES organizations(id),
    
    -- タイムスタンプ
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    reviewed_at DATETIME2,
    reviewed_by NVARCHAR(255)
);

-- ============================================
-- インデックス（リクエスト用）
-- ============================================

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_election_requests_status')
CREATE INDEX idx_election_requests_status ON election_requests(status);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_election_requests_politician')
CREATE INDEX idx_election_requests_politician ON election_requests(requested_by_politician_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_organization_requests_status')
CREATE INDEX idx_organization_requests_status ON organization_requests(status);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_organization_requests_politician')
CREATE INDEX idx_organization_requests_politician ON organization_requests(requested_by_politician_id);
GO

-- ============================================
-- 初期データ
-- ============================================

-- マスタ更新日時の初期値
IF NOT EXISTS (SELECT * FROM master_metadata WHERE table_name = 'municipalities')
    INSERT INTO master_metadata (table_name, last_updated_at) VALUES ('municipalities', GETUTCDATE());
IF NOT EXISTS (SELECT * FROM master_metadata WHERE table_name = 'districts')
    INSERT INTO master_metadata (table_name, last_updated_at) VALUES ('districts', GETUTCDATE());
IF NOT EXISTS (SELECT * FROM master_metadata WHERE table_name = 'elections')
    INSERT INTO master_metadata (table_name, last_updated_at) VALUES ('elections', GETUTCDATE());
IF NOT EXISTS (SELECT * FROM master_metadata WHERE table_name = 'politicians')
    INSERT INTO master_metadata (table_name, last_updated_at) VALUES ('politicians', GETUTCDATE());
IF NOT EXISTS (SELECT * FROM master_metadata WHERE table_name = 'organizations')
    INSERT INTO master_metadata (table_name, last_updated_at) VALUES ('organizations', GETUTCDATE());
GO
