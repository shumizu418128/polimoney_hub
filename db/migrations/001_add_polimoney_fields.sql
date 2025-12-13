-- Migration: 001_add_polimoney_fields
-- Description: public_journals テーブルに Polimoney 連携用フィールドを追加
-- Date: 2025-12-14

-- ============================================
-- public_journals テーブルへのカラム追加
-- ============================================

-- classification: 活動区分（選挙台帳のみ使用）
-- 'campaign' = 選挙運動, 'pre-campaign' = 立候補準備のための支出
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('public_journals') AND name = 'classification'
)
ALTER TABLE public_journals ADD classification VARCHAR(20);
GO

-- non_monetary_basis: 金銭以外の寄附の見積根拠
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('public_journals') AND name = 'non_monetary_basis'
)
ALTER TABLE public_journals ADD non_monetary_basis NVARCHAR(MAX);
GO

-- note: 備考
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('public_journals') AND name = 'note'
)
ALTER TABLE public_journals ADD note NVARCHAR(MAX);
GO

-- public_expense_amount: 公費負担額（0の場合はNULL）
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('public_journals') AND name = 'public_expense_amount'
)
ALTER TABLE public_journals ADD public_expense_amount INT;
GO

-- ============================================
-- 確認用クエリ
-- ============================================

-- 追加されたカラムを確認
SELECT 
    c.name AS column_name,
    t.name AS data_type,
    c.max_length,
    c.is_nullable
FROM sys.columns c
JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('public_journals')
AND c.name IN ('classification', 'non_monetary_basis', 'note', 'public_expense_amount');
GO
