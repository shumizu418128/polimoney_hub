-- Polimoney Hub - 登録申請テーブル追加
-- Ledger ユーザーの登録申請を管理

-- ============================================
-- Ledger ユーザー登録リクエスト
-- ============================================

CREATE TABLE IF NOT EXISTS registration_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 申請者情報
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,              -- 'politician', 'accountant', 'both'
    
    -- Ledger 側の情報
    ledger_user_id UUID,                    -- Ledger で作成された auth.users の ID
    ledger_supabase_url VARCHAR(255),       -- どの Ledger プロジェクトからの申請か
    
    -- 本人確認書類
    verification_doc_url TEXT NOT NULL,     -- Ledger Storage に保存されたファイルの URL
    verification_doc_type VARCHAR(50),      -- 'certificate', 'registration_form', 'appointment_form'
    verification_doc_name VARCHAR(255),     -- 元のファイル名
    
    -- 審査
    status VARCHAR(20) DEFAULT 'pending',   -- 'pending', 'approved', 'rejected'
    rejection_reason TEXT,
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID,                       -- Hub admin user ID
    
    -- メタデータ
    notes TEXT,                             -- 申請者からの備考
    admin_notes TEXT,                       -- 管理者メモ
    is_test BOOLEAN DEFAULT FALSE,          -- テスト申請フラグ（開発モードからの申請）
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_registration_requests_status ON registration_requests(status);
CREATE INDEX IF NOT EXISTS idx_registration_requests_email ON registration_requests(email);
CREATE INDEX IF NOT EXISTS idx_registration_requests_created ON registration_requests(created_at DESC);

-- RLS 有効化
ALTER TABLE registration_requests ENABLE ROW LEVEL SECURITY;

-- 読み取りポリシー（管理者のみ）
CREATE POLICY "Admin can read registration_requests" ON registration_requests 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE admin_users.id = auth.uid() 
            AND admin_users.is_active = TRUE
        )
    );

-- 書き込みポリシー（service_role のみ）
CREATE POLICY "Allow service write" ON registration_requests 
    FOR ALL USING (auth.role() = 'service_role');

-- API キーによる挿入を許可（Ledger からの申請受付用）
CREATE POLICY "Allow insert via API" ON registration_requests 
    FOR INSERT WITH CHECK (true);

COMMENT ON TABLE registration_requests IS 'Ledger ユーザーの登録申請を管理';
COMMENT ON COLUMN registration_requests.role IS '申請者の役割: politician(政治家), accountant(会計責任者), both(兼任)';
COMMENT ON COLUMN registration_requests.status IS '審査ステータス: pending(審査待ち), approved(承認), rejected(却下)';
