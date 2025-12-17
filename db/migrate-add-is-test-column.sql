-- registration_requests に is_test カラムを追加
-- すでにテーブルが存在する場合に使用

ALTER TABLE registration_requests
ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_registration_requests_is_test ON registration_requests(is_test);

COMMENT ON COLUMN registration_requests.is_test IS 'テスト申請フラグ（Ledger の USE_MOCK_MODE=true からの申請）';
