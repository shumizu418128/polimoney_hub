-- organizations テーブルに logo_url カラムを追加
-- 政治団体のロゴ画像 URL を保存

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN organizations.logo_url IS '政治団体のロゴ画像 URL';
