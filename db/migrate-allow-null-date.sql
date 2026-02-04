-- マイグレーション: public_journals.date カラムを NULL 許可に変更
-- 選挙運動収支報告書では、公費負担の印刷費等で日付が不明な場合がある

ALTER TABLE public_journals ALTER COLUMN date DROP NOT NULL;
