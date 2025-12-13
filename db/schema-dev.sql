-- Polimoney Hub - 開発用スキーマ (dev)
-- 本番データに影響を与えずに開発/テストするためのスキーマ
--
-- 使い分け:
--   dbo スキーマ: municipalities, districts（本番データを共用）
--   dev スキーマ: その他のテーブル（ダミーデータ）

-- ============================================
-- dev スキーマ作成
-- ============================================

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'dev')
BEGIN
    EXEC('CREATE SCHEMA dev');
END
GO

-- ============================================
-- dev スキーマのテーブル
-- ============================================

-- 政治家マスタ
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'politicians' AND schema_id = SCHEMA_ID('dev'))
CREATE TABLE dev.politicians (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    name_kana NVARCHAR(255),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- 政治団体マスタ
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'organizations' AND schema_id = SCHEMA_ID('dev'))
CREATE TABLE dev.organizations (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    politician_id UNIQUEIDENTIFIER REFERENCES dev.politicians(id),
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- 選挙マスタ（districts は dbo を参照）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'elections' AND schema_id = SCHEMA_ID('dev'))
CREATE TABLE dev.elections (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    type VARCHAR(10) NOT NULL,
    district_id UNIQUEIDENTIFIER REFERENCES dbo.districts(id),
    election_date DATE NOT NULL,
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- マスタ更新日時
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'master_metadata' AND schema_id = SCHEMA_ID('dev'))
CREATE TABLE dev.master_metadata (
    table_name VARCHAR(50) PRIMARY KEY,
    last_updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- 公開用台帳
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'public_ledgers' AND schema_id = SCHEMA_ID('dev'))
CREATE TABLE dev.public_ledgers (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    politician_id UNIQUEIDENTIFIER NOT NULL REFERENCES dev.politicians(id),
    organization_id UNIQUEIDENTIFIER REFERENCES dev.organizations(id),
    election_id UNIQUEIDENTIFIER REFERENCES dev.elections(id),
    fiscal_year INT NOT NULL,
    total_income INT DEFAULT 0,
    total_expense INT DEFAULT 0,
    journal_count INT DEFAULT 0,
    ledger_source_id UNIQUEIDENTIFIER NOT NULL,
    last_updated_at DATETIME2 NOT NULL,
    first_synced_at DATETIME2 NOT NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    CONSTRAINT dev_uq_ledger_source UNIQUE (ledger_source_id)
);

-- 公開用仕訳
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'public_journals' AND schema_id = SCHEMA_ID('dev'))
CREATE TABLE dev.public_journals (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ledger_id UNIQUEIDENTIFIER NOT NULL REFERENCES dev.public_ledgers(id),
    journal_source_id UNIQUEIDENTIFIER NOT NULL,
    date DATE NOT NULL,
    description NVARCHAR(MAX),
    amount INT NOT NULL,
    contact_name NVARCHAR(MAX),
    contact_type VARCHAR(20),
    account_code VARCHAR(50),
    content_hash VARCHAR(64) NOT NULL,
    synced_at DATETIME2 NOT NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    CONSTRAINT dev_uq_journal_source UNIQUE (journal_source_id)
);

-- 台帳変更ログ
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ledger_change_logs' AND schema_id = SCHEMA_ID('dev'))
CREATE TABLE dev.ledger_change_logs (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ledger_id UNIQUEIDENTIFIER NOT NULL REFERENCES dev.public_ledgers(id),
    changed_at DATETIME2 NOT NULL,
    change_summary NVARCHAR(MAX) NOT NULL,
    change_details NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETUTCDATE()
);

-- 選挙登録リクエスト
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'election_requests' AND schema_id = SCHEMA_ID('dev'))
CREATE TABLE dev.election_requests (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    type VARCHAR(10) NOT NULL,
    district_id UNIQUEIDENTIFIER REFERENCES dbo.districts(id),
    area_description NVARCHAR(MAX),
    election_date DATE NOT NULL,
    requested_by_politician_id UNIQUEIDENTIFIER REFERENCES dev.politicians(id),
    requested_by_email VARCHAR(255),
    evidence_url NVARCHAR(MAX),
    notes NVARCHAR(MAX),
    status VARCHAR(20) DEFAULT 'pending',
    rejection_reason NVARCHAR(MAX),
    approved_election_id UNIQUEIDENTIFIER REFERENCES dev.elections(id),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    reviewed_at DATETIME2,
    reviewed_by NVARCHAR(255)
);

-- 政治団体登録リクエスト
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'organization_requests' AND schema_id = SCHEMA_ID('dev'))
CREATE TABLE dev.organization_requests (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    registration_authority NVARCHAR(100),
    requested_by_politician_id UNIQUEIDENTIFIER REFERENCES dev.politicians(id),
    requested_by_email VARCHAR(255),
    evidence_type VARCHAR(50) NOT NULL,
    evidence_file_url NVARCHAR(MAX) NOT NULL,
    evidence_file_name NVARCHAR(255),
    notes NVARCHAR(MAX),
    status VARCHAR(20) DEFAULT 'pending',
    rejection_reason NVARCHAR(MAX),
    approved_organization_id UNIQUEIDENTIFIER REFERENCES dev.organizations(id),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    reviewed_at DATETIME2,
    reviewed_by NVARCHAR(255)
);
GO

-- ============================================
-- インデックス
-- ============================================

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_dev_organizations_politician_id')
CREATE INDEX idx_dev_organizations_politician_id ON dev.organizations(politician_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_dev_organizations_active')
CREATE INDEX idx_dev_organizations_active ON dev.organizations(is_active);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_dev_elections_type')
CREATE INDEX idx_dev_elections_type ON dev.elections(type);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_dev_elections_date')
CREATE INDEX idx_dev_elections_date ON dev.elections(election_date);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_dev_elections_district')
CREATE INDEX idx_dev_elections_district ON dev.elections(district_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_dev_elections_active')
CREATE INDEX idx_dev_elections_active ON dev.elections(is_active);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_dev_public_ledgers_politician')
CREATE INDEX idx_dev_public_ledgers_politician ON dev.public_ledgers(politician_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_dev_public_ledgers_fiscal_year')
CREATE INDEX idx_dev_public_ledgers_fiscal_year ON dev.public_ledgers(fiscal_year);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_dev_public_ledgers_election')
CREATE INDEX idx_dev_public_ledgers_election ON dev.public_ledgers(election_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_dev_public_journals_ledger')
CREATE INDEX idx_dev_public_journals_ledger ON dev.public_journals(ledger_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_dev_public_journals_date')
CREATE INDEX idx_dev_public_journals_date ON dev.public_journals(date);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_dev_change_logs_ledger')
CREATE INDEX idx_dev_change_logs_ledger ON dev.ledger_change_logs(ledger_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_dev_election_requests_status')
CREATE INDEX idx_dev_election_requests_status ON dev.election_requests(status);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_dev_organization_requests_status')
CREATE INDEX idx_dev_organization_requests_status ON dev.organization_requests(status);
GO

-- ============================================
-- 初期データ
-- ============================================

IF NOT EXISTS (SELECT * FROM dev.master_metadata WHERE table_name = 'municipalities')
    INSERT INTO dev.master_metadata (table_name, last_updated_at) VALUES ('municipalities', GETUTCDATE());
IF NOT EXISTS (SELECT * FROM dev.master_metadata WHERE table_name = 'districts')
    INSERT INTO dev.master_metadata (table_name, last_updated_at) VALUES ('districts', GETUTCDATE());
IF NOT EXISTS (SELECT * FROM dev.master_metadata WHERE table_name = 'elections')
    INSERT INTO dev.master_metadata (table_name, last_updated_at) VALUES ('elections', GETUTCDATE());
IF NOT EXISTS (SELECT * FROM dev.master_metadata WHERE table_name = 'politicians')
    INSERT INTO dev.master_metadata (table_name, last_updated_at) VALUES ('politicians', GETUTCDATE());
IF NOT EXISTS (SELECT * FROM dev.master_metadata WHERE table_name = 'organizations')
    INSERT INTO dev.master_metadata (table_name, last_updated_at) VALUES ('organizations', GETUTCDATE());
GO

