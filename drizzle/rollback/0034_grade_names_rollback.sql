-- 移行 0034（等級名と表示名の一律の書き換え）を戻す
--
-- display_name_rewrites に残した old_value を元の行へ書き戻す。
-- 戻すのは「今の値が移行の書いた値（new_value）のままの行」だけ。移行のあとに会社が自分で直した名前は上書きしない。
-- 戻したあとの一覧が要るときは、流す前に次の問い合わせで「戻らない行」（今の値が new_value と違う行）を確かめる。
--   SELECT * FROM display_name_rewrites WHERE migration = '0034_grade_display_names';
-- 記録の表（display_name_rewrites）は消さない。戻したあとに 0034 をもう一度流しても、最初の値の記録は上書きされない。
--
-- 本番の DB への書き込みなので、利用者の確認のあとに復旧の手順として流す（tasks/feature-improvement-requests-2026-10/sys-ir-p05.md）。
UPDATE `forms` SET `title` = (
	SELECT `w`.`old_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'forms' AND `w`.`column_name` = 'title' AND `w`.`row_id` = `forms`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'forms' AND `w`.`column_name` = 'title' AND `w`.`row_id` = `forms`.`id`
		AND `w`.`migration` = '0034_grade_display_names'
		AND `w`.`new_value` = `forms`.`title` AND `w`.`old_value` <> `forms`.`title`);
--> statement-breakpoint
UPDATE `behavior_band_sets` SET `name` = (
	SELECT `w`.`old_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'behavior_band_sets' AND `w`.`column_name` = 'name' AND `w`.`row_id` = `behavior_band_sets`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'behavior_band_sets' AND `w`.`column_name` = 'name' AND `w`.`row_id` = `behavior_band_sets`.`id`
		AND `w`.`migration` = '0034_grade_display_names'
		AND `w`.`new_value` = `behavior_band_sets`.`name` AND `w`.`old_value` <> `behavior_band_sets`.`name`);
--> statement-breakpoint
UPDATE `promotion_thresholds` SET `label` = (
	SELECT `w`.`old_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'promotion_thresholds' AND `w`.`column_name` = 'label' AND `w`.`row_id` = `promotion_thresholds`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'promotion_thresholds' AND `w`.`column_name` = 'label' AND `w`.`row_id` = `promotion_thresholds`.`id`
		AND `w`.`migration` = '0034_grade_display_names'
		AND `w`.`new_value` = `promotion_thresholds`.`label` AND `w`.`old_value` <> `promotion_thresholds`.`label`);
--> statement-breakpoint
-- 昇格要件は 0034 と同じく、書き戻すあいだだけ 0013 のトリガーを外して同じ定義で作り直す。
-- 移行のあとに会社が改版した要件（後続の版がある過去の版）は履歴なので戻さない。
DROP TRIGGER IF EXISTS `trg_promreq_semantic_immutable`;
--> statement-breakpoint
UPDATE `promotion_requirements` SET `transition_label` = (
	SELECT `w`.`old_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'promotion_requirements' AND `w`.`column_name` = 'transition_label'
		AND `w`.`row_id` = `promotion_requirements`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'promotion_requirements' AND `w`.`column_name` = 'transition_label'
		AND `w`.`row_id` = `promotion_requirements`.`id` AND `w`.`migration` = '0034_grade_display_names'
		AND `w`.`new_value` = `promotion_requirements`.`transition_label`
		AND `w`.`old_value` <> `promotion_requirements`.`transition_label`)
	AND NOT EXISTS (
		SELECT 1 FROM `promotion_requirements` `next` WHERE `next`.`previous_version_id` = `promotion_requirements`.`id`);
--> statement-breakpoint
UPDATE `promotion_requirements` SET `text` = (
	SELECT `w`.`old_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'promotion_requirements' AND `w`.`column_name` = 'text' AND `w`.`row_id` = `promotion_requirements`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'promotion_requirements' AND `w`.`column_name` = 'text' AND `w`.`row_id` = `promotion_requirements`.`id`
		AND `w`.`migration` = '0034_grade_display_names'
		AND `w`.`new_value` = `promotion_requirements`.`text` AND `w`.`old_value` <> `promotion_requirements`.`text`)
	AND NOT EXISTS (
		SELECT 1 FROM `promotion_requirements` `next` WHERE `next`.`previous_version_id` = `promotion_requirements`.`id`);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_promreq_semantic_immutable`
BEFORE UPDATE OF `company_id`, `grade_id`, `kind`, `text`, `transition_label`, `is_gate`, `previous_version_id` ON `promotion_requirements`
WHEN NEW.`company_id` IS NOT OLD.`company_id`
  OR NEW.`grade_id` IS NOT OLD.`grade_id`
  OR NEW.`kind` IS NOT OLD.`kind`
  OR NEW.`text` IS NOT OLD.`text`
  OR NEW.`transition_label` IS NOT OLD.`transition_label`
  OR NEW.`is_gate` IS NOT OLD.`is_gate`
  OR NEW.`previous_version_id` IS NOT OLD.`previous_version_id`
BEGIN
  SELECT RAISE(ABORT, 'promotion_requirement_semantic_immutable');
END;
--> statement-breakpoint
UPDATE `grade_point_rules` SET `note` = (
	SELECT `w`.`old_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'grade_point_rules' AND `w`.`column_name` = 'note' AND `w`.`row_id` = `grade_point_rules`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'grade_point_rules' AND `w`.`column_name` = 'note' AND `w`.`row_id` = `grade_point_rules`.`id`
		AND `w`.`migration` = '0034_grade_display_names'
		AND `w`.`new_value` = `grade_point_rules`.`note` AND `w`.`old_value` <> `grade_point_rules`.`note`);
--> statement-breakpoint
UPDATE `grades` SET `name` = (
	SELECT `w`.`old_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'grades' AND `w`.`column_name` = 'name' AND `w`.`row_id` = `grades`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'grades' AND `w`.`column_name` = 'name' AND `w`.`row_id` = `grades`.`id`
		AND `w`.`migration` = '0034_grade_display_names'
		AND `w`.`new_value` = `grades`.`name` AND `w`.`old_value` <> `grades`.`name`);
