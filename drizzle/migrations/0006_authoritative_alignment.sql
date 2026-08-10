-- 正本（data/_authoritative-kpi-criteria.tsv）との突合で見つかった食い違いを直す。
-- 既存の行を更新するだけで、削除は行わない。確定済みの評価（evaluation_items）には触れない。

-- ────────────────────────────────────────────────────────────
-- 1) 昇給設定の「年間の上昇額」
--    正本【10】: 昇給額 × 年間の昇給機会（2回）
--      Beginner 3,000 → 6,000 ／ Regular 4,000 → 8,000 ／ Chief 5,000 → 10,000
--      AM Ⅰ 6,000 → 12,000 ／ AM Ⅱ 7,000 → 14,000
--      Manager Ⅰ 8,000 → 16,000 ／ Manager Ⅱ 10,000 → 20,000
--    これまでは 昇給額 × 6ヶ月 で入っており（18,000 など）、
--    「月額基本給が1年でいくら上がるか」ではなく「半期の支給総額」になっていた。
-- ────────────────────────────────────────────────────────────
UPDATE raise_settings
SET annual_amount = monthly_amount * (
      SELECT COALESCE(p.chances_per_year, 2)
      FROM raise_policies p
      WHERE p.company_id = raise_settings.company_id
    ),
    updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
WHERE EXISTS (SELECT 1 FROM raise_policies p WHERE p.company_id = raise_settings.company_id);

-- 昇給ルールが未登録の会社は既定の年2回で埋める
UPDATE raise_settings
SET annual_amount = monthly_amount * 2,
    updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
WHERE NOT EXISTS (SELECT 1 FROM raise_policies p WHERE p.company_id = raise_settings.company_id);

-- ────────────────────────────────────────────────────────────
-- 2) 設問の「計算での役割」
--    正本【7】では q19_4 は「分母から控除」、c_3（等級の選択）は「配点・分母の自動決定」。
--    どちらも denominator（分母）として入っており、
--    画面で役割別に設問を並べると「分母」に混ざって出てしまう。
--    実績値の計算そのものは計算式（q19_3 ÷ (q19_1 + q19_2 − q19_4) × 100）が正なので
--    数値は変わらない。表示と説明のための修正。
-- ────────────────────────────────────────────────────────────
UPDATE kpi_questions SET role = 'denominator_subtract' WHERE question_key = 'q19_4';
UPDATE kpi_questions SET role = 'identify'             WHERE question_key = 'c_3';

-- ────────────────────────────────────────────────────────────
-- 3) 計算式に混ざっていた注釈を formula_note へ移す
--    正本【6】の計算式欄は式だけ。「※利用率90%達成で100%」などの注釈が
--    式の文字列に入っていると、式を読む人と計算エンジンで見え方がずれる。
--    （計算エンジンは ※ 以降を落とすので、これまでも計算結果は正しかった）
-- ────────────────────────────────────────────────────────────
UPDATE kpi_items SET formula = 'q10_1 ÷ ( q10_2 × q10_3 × 0.9 ) × 100',
                     formula_note = '目標利用率90%は固定値。変更する場合は係数0.9を変える'
WHERE no = 10;
UPDATE kpi_items SET formula = 'q22_1 ÷ ( q22_2 × 18 ) × 100',
                     formula_note = '1人あたり半期18件が基準（固定値）'
WHERE no = 22;
UPDATE kpi_items SET formula = '( q24_1 ÷ q24_2 × 100 ) ÷ q24_3 × 100',
                     formula_note = '予算利益率に対する達成度'
WHERE no = 24;
UPDATE kpi_items SET formula_note = '前向きな終了 q19_4 を分母から控除'
WHERE no = 19 AND (formula_note IS NULL OR formula_note = '');

-- ────────────────────────────────────────────────────────────
-- 4) ランク→点数の換算方式を会社ごとに選べるようにする
--    ratio    = 一律割合方式（A=100% / B=80% / C=60% / D=40% / E=0%）※既定・仮
--    absolute = 項目別絶対点方式（元の配点表 kpi_reference_points から引く）
-- ────────────────────────────────────────────────────────────
ALTER TABLE evaluation_schemes ADD COLUMN scoring_mode TEXT NOT NULL DEFAULT 'ratio';

-- ────────────────────────────────────────────────────────────
-- 5) 賞与の集計結果を評価に保存する列
--    個人Pt ＝ KPI評価点合計 × 事業所KGI達成係数 ／ 賞与額 ＝ 個人Pt × 1点あたり金額。
--    確定時の係数もスナップショットして、あとで係数表を変えても過去の評価が動かないようにする。
-- ────────────────────────────────────────────────────────────
ALTER TABLE evaluations ADD COLUMN office_achievement_rate REAL;
ALTER TABLE evaluations ADD COLUMN kgi_coefficient REAL;
ALTER TABLE evaluations ADD COLUMN personal_points REAL;
ALTER TABLE evaluations ADD COLUMN bonus_yen INTEGER;
ALTER TABLE evaluations ADD COLUMN bonus_rationale TEXT;
ALTER TABLE evaluations ADD COLUMN scoring_mode_snapshot TEXT;
