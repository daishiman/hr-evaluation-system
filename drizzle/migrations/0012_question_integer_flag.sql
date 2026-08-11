-- 設問に「整数だけ」の印を持たせる（2026-08-12）
--
-- これまで設問が持っていたのは最小値・最大値・単位だけで、「整数だけを受け付ける」
-- という決まりを表す場所が無かった。「件」「人」のように数え上げる設問でも小数が
-- 保存できてしまい、止める根拠が画面にも受け口にも無かった。
--
-- 決まり自体は前から存在していた。制度マスタ（kpi_questions.validation）に
-- 「0以上の整数」「1以上の整数」と**文章で**書かれており、その文言は設問の説明文
-- （form_questions.help_text）にも写されている。つまり印を新しく決めるのではなく、
-- 文章でしか持てていなかったものを、入力を止められる形に置き換える。
--
-- 既存の設問への当て方:
--   その設問の元になった制度マスタ（kpi_questions.validation）に「整数」と書かれて
--   いるものだけを整数限定にする。**単位では決めない。**単位「%」の設問は
--   「0より大きい数値」（＝小数が要る）であり、単位で機械的に決めると達成率のような
--   設問を巻き込むため。
--   説明文（help_text）では判定しない。本番の設問の説明文は、この文言が入るより前に
--   組み立てられたもので「整数」の語を含んでいなかった（＝取りこぼす）。
--
-- 設問文・説明文・回答・集計結果は一切書き換えない。この印は「これから受け取る値」に
-- だけ効く。（本番の数値の回答1,806件を調べたところ、小数を含むものは0件だった）
ALTER TABLE `form_questions` ADD `validation_integer` integer DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE `form_questions`
SET `validation_integer` = 1
WHERE `question_type` = 'number'
  AND `kpi_question_key` IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM `kpi_questions` q
    WHERE q.`company_id` = `form_questions`.`company_id`
      AND q.`question_key` = `form_questions`.`kpi_question_key`
      AND q.`validation` LIKE '%整数%'
  );
