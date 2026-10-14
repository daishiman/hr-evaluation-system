-- 移行 0035（予行で見つかった直し：アンケートの既定の題名・KPI 項目の文・昇格要件の本文の写し）を戻す
--
-- display_name_rewrites に残した old_value を元の行へ書き戻す。
-- 戻すのは「今の値が移行の書いた値（new_value）のままの行」だけ。移行のあとに会社が自分で直した題名や文は上書きしない。
-- 戻したあとの一覧が要るときは、流す前に次の問い合わせで「戻らない行」（今の値が new_value と違う行）を確かめる。
--   SELECT * FROM display_name_rewrites WHERE migration = '0035_migration_corrections';
-- 記録の表（display_name_rewrites）は消さない。戻したあとに 0035 をもう一度流しても、最初の値の記録は上書きされない。
-- 0034 も戻すときは、このファイルを先に流す（0035 は 0034 のあとの値を前提に記録している）。
--
-- 本番の DB への書き込みなので、利用者の確認のあとに復旧の手順として流す（tasks/feature-improvement-requests-2026-10/sys-ir-p08.md）。
UPDATE `forms` SET `title` = (
	SELECT `w`.`old_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'forms' AND `w`.`column_name` = 'title' AND `w`.`row_id` = `forms`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'forms' AND `w`.`column_name` = 'title' AND `w`.`row_id` = `forms`.`id`
		AND `w`.`migration` = '0035_migration_corrections'
		AND `w`.`new_value` = `forms`.`title` AND `w`.`old_value` <> `forms`.`title`);
--> statement-breakpoint
UPDATE `kpi_items` SET `formula_note` = (
	SELECT `w`.`old_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'kpi_items' AND `w`.`column_name` = 'formula_note' AND `w`.`row_id` = `kpi_items`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'kpi_items' AND `w`.`column_name` = 'formula_note' AND `w`.`row_id` = `kpi_items`.`id`
		AND `w`.`migration` = '0035_migration_corrections'
		AND `w`.`new_value` = `kpi_items`.`formula_note` AND `w`.`old_value` <> `kpi_items`.`formula_note`);
--> statement-breakpoint
UPDATE `kpi_items` SET `intent` = (
	SELECT `w`.`old_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'kpi_items' AND `w`.`column_name` = 'intent' AND `w`.`row_id` = `kpi_items`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'kpi_items' AND `w`.`column_name` = 'intent' AND `w`.`row_id` = `kpi_items`.`id`
		AND `w`.`migration` = '0035_migration_corrections'
		AND `w`.`new_value` = `kpi_items`.`intent` AND `w`.`old_value` <> `kpi_items`.`intent`);
--> statement-breakpoint
UPDATE `kpi_items` SET `remarks` = (
	SELECT `w`.`old_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'kpi_items' AND `w`.`column_name` = 'remarks' AND `w`.`row_id` = `kpi_items`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'kpi_items' AND `w`.`column_name` = 'remarks' AND `w`.`row_id` = `kpi_items`.`id`
		AND `w`.`migration` = '0035_migration_corrections'
		AND `w`.`new_value` = `kpi_items`.`remarks` AND `w`.`old_value` <> `kpi_items`.`remarks`);
--> statement-breakpoint
UPDATE `form_questions` SET `title` = (
	SELECT `w`.`old_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'form_questions' AND `w`.`column_name` = 'title' AND `w`.`row_id` = `form_questions`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'form_questions' AND `w`.`column_name` = 'title' AND `w`.`row_id` = `form_questions`.`id`
		AND `w`.`migration` = '0035_migration_corrections'
		AND `w`.`new_value` = `form_questions`.`title` AND `w`.`old_value` <> `form_questions`.`title`);
--> statement-breakpoint
UPDATE `form_answers` SET `question_title` = (
	SELECT `w`.`old_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'form_answers' AND `w`.`column_name` = 'question_title' AND `w`.`row_id` = `form_answers`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'form_answers' AND `w`.`column_name` = 'question_title' AND `w`.`row_id` = `form_answers`.`id`
		AND `w`.`migration` = '0035_migration_corrections'
		AND `w`.`new_value` = `form_answers`.`question_title` AND `w`.`old_value` <> `form_answers`.`question_title`);
--> statement-breakpoint
UPDATE `evaluation_gates` SET `text` = (
	SELECT `w`.`old_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'evaluation_gates' AND `w`.`column_name` = 'text' AND `w`.`row_id` = `evaluation_gates`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'evaluation_gates' AND `w`.`column_name` = 'text' AND `w`.`row_id` = `evaluation_gates`.`id`
		AND `w`.`migration` = '0035_migration_corrections'
		AND `w`.`new_value` = `evaluation_gates`.`text` AND `w`.`old_value` <> `evaluation_gates`.`text`);
--> statement-breakpoint
UPDATE `evaluations` SET `promotion_blocked_reason` = (
	SELECT `w`.`old_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'evaluations' AND `w`.`column_name` = 'promotion_blocked_reason' AND `w`.`row_id` = `evaluations`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'evaluations' AND `w`.`column_name` = 'promotion_blocked_reason' AND `w`.`row_id` = `evaluations`.`id`
		AND `w`.`migration` = '0035_migration_corrections'
		AND `w`.`new_value` = `evaluations`.`promotion_blocked_reason` AND `w`.`old_value` <> `evaluations`.`promotion_blocked_reason`);
--> statement-breakpoint
UPDATE `evaluations` SET `promotion_blocked_reason_employee` = (
	SELECT `w`.`old_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'evaluations' AND `w`.`column_name` = 'promotion_blocked_reason_employee' AND `w`.`row_id` = `evaluations`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'evaluations' AND `w`.`column_name` = 'promotion_blocked_reason_employee' AND `w`.`row_id` = `evaluations`.`id`
		AND `w`.`migration` = '0035_migration_corrections'
		AND `w`.`new_value` = `evaluations`.`promotion_blocked_reason_employee` AND `w`.`old_value` <> `evaluations`.`promotion_blocked_reason_employee`);
