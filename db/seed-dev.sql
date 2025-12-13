-- Polimoney Hub - 開発用ダミーデータ
-- dev スキーマに投入するテストデータ

-- ============================================
-- 政治家マスタ（ダミー）
-- ============================================

-- 既存データがない場合のみ INSERT
IF NOT EXISTS (SELECT * FROM dev.politicians)
BEGIN
    INSERT INTO dev.politicians (id, name, name_kana) VALUES
        ('11111111-1111-1111-1111-111111111111', N'山田 太郎', N'ヤマダ タロウ'),
        ('22222222-2222-2222-2222-222222222222', N'佐藤 花子', N'サトウ ハナコ'),
        ('33333333-3333-3333-3333-333333333333', N'鈴木 一郎', N'スズキ イチロウ'),
        ('44444444-4444-4444-4444-444444444444', N'田中 美咲', N'タナカ ミサキ'),
        ('55555555-5555-5555-5555-555555555555', N'高橋 健太', N'タカハシ ケンタ');
END
GO

-- ============================================
-- 政治団体マスタ（ダミー）
-- ============================================

IF NOT EXISTS (SELECT * FROM dev.organizations)
BEGIN
    INSERT INTO dev.organizations (id, name, type, politician_id, is_active) VALUES
        -- 山田太郎の団体
        ('aaaa1111-1111-1111-1111-111111111111', N'山田太郎後援会', 'support_group', '11111111-1111-1111-1111-111111111111', 1),
        ('aaaa1111-2222-2222-2222-222222222222', N'山田太郎を応援する会', 'fund_management', '11111111-1111-1111-1111-111111111111', 1),
        -- 佐藤花子の団体
        ('bbbb2222-1111-1111-1111-111111111111', N'佐藤花子後援会', 'support_group', '22222222-2222-2222-2222-222222222222', 1),
        -- 鈴木一郎の団体
        ('cccc3333-1111-1111-1111-111111111111', N'鈴木一郎後援会', 'support_group', '33333333-3333-3333-3333-333333333333', 1),
        -- 政党（架空）
        ('dddd0000-0000-0000-0000-000000000001', N'民主未来党', 'political_party', NULL, 1),
        ('dddd0000-0000-0000-0000-000000000002', N'国民改革党', 'political_party', NULL, 1);
END
GO

-- ============================================
-- 選挙マスタ（ダミー）
-- ※ district_id は dbo.districts を参照するため、
--   districts が先に登録されている必要があります
-- ============================================

-- 選挙区がない場合はスキップ（districts は本番データを使用）
IF EXISTS (SELECT * FROM dbo.districts)
BEGIN
    IF NOT EXISTS (SELECT * FROM dev.elections)
    BEGIN
        DECLARE @district_id UNIQUEIDENTIFIER;
        SELECT TOP 1 @district_id = id FROM dbo.districts WHERE type = 'HR';
        
        IF @district_id IS NOT NULL
        BEGIN
            INSERT INTO dev.elections (id, name, type, district_id, election_date, is_active) VALUES
                ('eeee1111-1111-1111-1111-111111111111', N'第50回衆議院議員総選挙（テスト）', 'HR', @district_id, '2024-10-27', 1);
        END
    END
END
GO

-- 選挙区がまだない場合の仮データ（district_id = NULL）
IF NOT EXISTS (SELECT * FROM dev.elections)
BEGIN
    INSERT INTO dev.elections (id, name, type, district_id, election_date, is_active) VALUES
        ('eeee1111-1111-1111-1111-111111111111', N'第50回衆議院議員総選挙（テスト）', 'HR', NULL, '2024-10-27', 1),
        ('eeee2222-2222-2222-2222-222222222222', N'令和7年東京都知事選挙（テスト）', 'PG', NULL, '2025-07-06', 1),
        ('eeee3333-3333-3333-3333-333333333333', N'渋谷区長選挙（テスト）', 'CM', NULL, '2025-04-20', 1);
END
GO

-- ============================================
-- 公開台帳（ダミー）
-- ============================================

IF NOT EXISTS (SELECT * FROM dev.public_ledgers)
BEGIN
    INSERT INTO dev.public_ledgers (
        id, politician_id, organization_id, election_id, fiscal_year,
        total_income, total_expense, journal_count,
        ledger_source_id, last_updated_at, first_synced_at
    ) VALUES
        (
            'ffff1111-1111-1111-1111-111111111111',
            '11111111-1111-1111-1111-111111111111',  -- 山田太郎
            'aaaa1111-1111-1111-1111-111111111111',  -- 山田太郎後援会
            'eeee1111-1111-1111-1111-111111111111',  -- 第50回衆院選
            2024,
            5000000,   -- 収入500万円
            4500000,   -- 支出450万円
            25,        -- 仕訳25件
            'aaaa0000-0000-0000-0000-000000000001',
            GETUTCDATE(),
            GETUTCDATE()
        ),
        (
            'ffff2222-2222-2222-2222-222222222222',
            '22222222-2222-2222-2222-222222222222',  -- 佐藤花子
            'bbbb2222-1111-1111-1111-111111111111',  -- 佐藤花子後援会
            'eeee1111-1111-1111-1111-111111111111',  -- 第50回衆院選
            2024,
            3000000,   -- 収入300万円
            2800000,   -- 支出280万円
            18,        -- 仕訳18件
            'aaaa0000-0000-0000-0000-000000000002',
            GETUTCDATE(),
            GETUTCDATE()
        );
END
GO

-- ============================================
-- 公開仕訳（ダミー）
-- ============================================

IF NOT EXISTS (SELECT * FROM dev.public_journals)
BEGIN
    INSERT INTO dev.public_journals (
        ledger_id, journal_source_id, date, description, amount,
        contact_name, contact_type, account_code, content_hash, synced_at
    ) VALUES
        -- 山田太郎の仕訳
        ('ffff1111-1111-1111-1111-111111111111', NEWID(), '2024-01-15', N'個人献金', 100000, N'非公開', 'person', 'income_donation', 'hash001', GETUTCDATE()),
        ('ffff1111-1111-1111-1111-111111111111', NEWID(), '2024-02-01', N'事務所賃料', 80000, N'○○不動産', 'corporation', 'expense_office', 'hash002', GETUTCDATE()),
        ('ffff1111-1111-1111-1111-111111111111', NEWID(), '2024-02-15', N'ポスター印刷', 150000, N'△△印刷', 'corporation', 'expense_campaign', 'hash003', GETUTCDATE()),
        ('ffff1111-1111-1111-1111-111111111111', NEWID(), '2024-03-01', N'事務所賃料', 80000, N'○○不動産', 'corporation', 'expense_office', 'hash004', GETUTCDATE()),
        ('ffff1111-1111-1111-1111-111111111111', NEWID(), '2024-03-10', N'企業献金', 500000, N'株式会社テスト', 'corporation', 'income_donation', 'hash005', GETUTCDATE()),
        -- 佐藤花子の仕訳
        ('ffff2222-2222-2222-2222-222222222222', NEWID(), '2024-01-20', N'個人献金', 50000, N'非公開', 'person', 'income_donation', 'hash101', GETUTCDATE()),
        ('ffff2222-2222-2222-2222-222222222222', NEWID(), '2024-02-01', N'事務所賃料', 60000, N'□□ビル管理', 'corporation', 'expense_office', 'hash102', GETUTCDATE()),
        ('ffff2222-2222-2222-2222-222222222222', NEWID(), '2024-02-20', N'チラシ印刷', 80000, N'◇◇プリント', 'corporation', 'expense_campaign', 'hash103', GETUTCDATE());
END
GO

-- ============================================
-- 選挙登録リクエスト（ダミー）
-- ============================================

IF NOT EXISTS (SELECT * FROM dev.election_requests)
BEGIN
    INSERT INTO dev.election_requests (
        name, type, district_id, area_description, election_date,
        requested_by_politician_id, requested_by_email, evidence_url, notes, status
    ) VALUES
        (
            N'令和7年参議院議員通常選挙（テスト）',
            'HC',
            NULL,
            N'東京都選挙区',
            '2025-07-27',
            '33333333-3333-3333-3333-333333333333',  -- 鈴木一郎
            'test@example.com',
            'https://example.com/evidence',
            N'テスト用リクエストです',
            'pending'
        ),
        (
            N'○○市長選挙（テスト）',
            'CM',
            NULL,
            N'○○県○○市',
            '2025-05-15',
            '44444444-4444-4444-4444-444444444444',  -- 田中美咲
            'test2@example.com',
            'https://example.com/evidence2',
            N'テスト用リクエスト2です',
            'pending'
        );
END
GO

-- ============================================
-- 政治団体登録リクエスト（ダミー）
-- ============================================

IF NOT EXISTS (SELECT * FROM dev.organization_requests)
BEGIN
    INSERT INTO dev.organization_requests (
        name, type, registration_authority,
        requested_by_politician_id, requested_by_email,
        evidence_type, evidence_file_url, evidence_file_name, notes, status
    ) VALUES
        (
            N'高橋健太後援会（テスト）',
            'support_group',
            N'東京都選挙管理委員会',
            '55555555-5555-5555-5555-555555555555',  -- 高橋健太
            'test3@example.com',
            'registration_form',
            'https://example.com/files/registration.pdf',
            N'設立届出書.pdf',
            N'テスト用リクエストです',
            'pending'
        );
END
GO

PRINT N'開発用ダミーデータの投入が完了しました';
GO

