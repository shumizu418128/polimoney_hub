-- admin_users に dev_mode カラムを追加
-- ユーザーごとに開発モードの設定を保存

ALTER TABLE admin_users
ADD COLUMN IF NOT EXISTS dev_mode BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN admin_users.dev_mode IS '開発モード（テスト申請を表示するか）';
