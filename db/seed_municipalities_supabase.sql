-- 市区町村マスタ 初期データ (PostgreSQL / Supabase 用)
-- 生成日: 2025-12-13
-- データソース: https://github.com/digitaldemocracy2030/polimoney/blob/main/city_code.csv

-- 既存データがある場合は何もしない (ON CONFLICT DO NOTHING)
INSERT INTO municipalities (code, prefecture_name, city_name, prefecture_name_kana, city_name_kana) VALUES
    ('10006', '北海道', NULL, 'ﾎｯｶｲﾄﾞｳ', NULL),
    ('11002', '北海道', '札幌市', 'ﾎｯｶｲﾄﾞｳ', 'ｻｯﾎﾟﾛｼ'),
    ('12025', '北海道', '函館市', 'ﾎｯｶｲﾄﾞｳ', 'ﾊｺﾀﾞﾃｼ'),
    ('12033', '北海道', '小樽市', 'ﾎｯｶｲﾄﾞｳ', 'ｵﾀﾙｼ'),
    ('12041', '北海道', '旭川市', 'ﾎｯｶｲﾄﾞｳ', 'ｱｻﾋｶﾜｼ')
ON CONFLICT (code) DO NOTHING;

-- 注意: このファイルはサンプルです。
-- 完全なデータは seed_municipalities.sql から PostgreSQL 形式に変換してください。
-- 
-- 変換手順:
-- 1. Supabase Dashboard > SQL Editor を開く
-- 2. db/schema-supabase.sql を実行してテーブルを作成
-- 3. CSV ファイルを直接インポートするか、以下のコマンドで変換:
--
-- Deno スクリプトで変換:
-- deno run --allow-read --allow-write db/convert-seed.ts
