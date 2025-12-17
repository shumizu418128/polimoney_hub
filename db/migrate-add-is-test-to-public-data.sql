-- public_ledgers と public_journals に is_test カラムを追加
-- テストユーザーからの同期データをダミーデータとして区別

-- public_ledgers に is_test を追加
ALTER TABLE public_ledgers
ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_public_ledgers_is_test ON public_ledgers(is_test);

COMMENT ON COLUMN public_ledgers.is_test IS 'テストデータフラグ（テストユーザーからの同期データ）';

-- public_journals に is_test を追加
ALTER TABLE public_journals
ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_public_journals_is_test ON public_journals(is_test);

COMMENT ON COLUMN public_journals.is_test IS 'テストデータフラグ（テストユーザーからの同期データ）';
