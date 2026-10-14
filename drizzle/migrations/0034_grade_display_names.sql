-- 等級名と、等級名を含む表示名を一律に書き換える（S2・DD-008・2026-10-13）
--
-- このファイルは手書きです（理由は 0009 の冒頭を参照）。
-- 呼び名は保存せず、表示のたびに会社の等級名から作る（src/lib/domain/grade-label.ts）。
-- そのため、これまで保存していた「等級１：Beginner」のような等級名と、等級名や英語の区分名を
-- 写し取って保存していた表示名（既定の題名・基準セットの名前・昇格の段階など）を、ここで1回だけ直す。
--
-- 進め方
--   1. 書き換える行の今の値と新しい値を display_name_rewrites に残す（INSERT OR IGNORE。2回目は最初の値を上書きしない）
--   2〜5. 記録どおりに書き換える。対象は「今の値が記録の old_value のままの行」だけなので、2回流しても2回目は0行になる。
--         移行のあとに会社が自分で直した名前は、もう一度流しても上書きしない。
-- ALTER TABLE は使わない。pointGroup・code・id は変えない（配点の表・URL・下書きの鍵なので）。
-- 昇格要件の遷移名と本文を直すあいだだけ、0013 のトリガー trg_promreq_semantic_immutable を外して同じ定義で作り直す（手順 4 の注釈）。
-- updated_at は進めない。表示名だけの変更で、基準を変えたことにはしない（src/lib/impact.ts が updated_at で判定する）。
-- 戻すときは drizzle/rollback/0034_grade_names_rollback.sql を流す。
CREATE TABLE IF NOT EXISTS `display_name_rewrites` (
	`table_name` text NOT NULL,
	`row_id` text NOT NULL,
	`column_name` text NOT NULL,
	`old_value` text NOT NULL,
	`new_value` text NOT NULL,
	`company_id` text,
	`migration` text NOT NULL,
	`recorded_at` integer NOT NULL,
	PRIMARY KEY (`table_name`, `row_id`, `column_name`)
);
--> statement-breakpoint

/* ── 1. 書き換える前の値を残す ─────────────────────────────── */

-- 1-a. アンケートの既定の題名（seed とアンケートの自動作成が付けた「{評価期間} {等級名} 実績アンケート」）は ''（既定の題名）にする。
--      等級名がもう既定の名前になっている等級は対象にしない（書き換えたあとの名前と同じ題名を、2回目に拾わないため）。
WITH `d`(`code`, `name`) AS (VALUES
	('beginner', '等級1'), ('regular', '等級2'), ('chief', '等級3'),
	('am1', '等級4-1'), ('am2', '等級4-2'), ('manager1', '等級5-1'), ('manager2', '等級5-2'))
INSERT OR IGNORE INTO `display_name_rewrites`
	(`table_name`, `row_id`, `column_name`, `old_value`, `new_value`, `company_id`, `migration`, `recorded_at`)
SELECT 'forms', `f`.`id`, 'title', `f`.`title`, '', `f`.`company_id`, '0034_grade_display_names',
	CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `forms` `f`
JOIN `evaluation_cycles` `c` ON `c`.`id` = `f`.`cycle_id`
JOIN `grades` `g` ON `g`.`id` = `f`.`grade_id`
LEFT JOIN `d` ON `d`.`code` = `g`.`code`
WHERE `f`.`title` = `c`.`name` || ' ' || `g`.`name` || ' 実績アンケート'
	AND `g`.`name` IS NOT `d`.`name`;
--> statement-breakpoint

-- 1-b. 行動指針の基準セットの名前のうち、英語の区分名を含むものは ''（割り当てた等級から「等級1・等級2向け」を作る）にする。
--      GLOB は大文字・小文字を区別する。AM は前後が英字でないときだけ区分名とみなす（TEAM などを拾わない）。
INSERT OR IGNORE INTO `display_name_rewrites`
	(`table_name`, `row_id`, `column_name`, `old_value`, `new_value`, `company_id`, `migration`, `recorded_at`)
SELECT 'behavior_band_sets', `id`, 'name', `name`, '', `company_id`, '0034_grade_display_names',
	CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `behavior_band_sets`
WHERE `name` GLOB '*Beginner*' OR `name` GLOB '*Regular*' OR `name` GLOB '*Chief*' OR `name` GLOB '*Manager*'
	OR `name` = 'AM' OR `name` GLOB 'AM[^A-Za-z]*' OR `name` GLOB '*[^A-Za-z]AM' OR `name` GLOB '*[^A-Za-z]AM[^A-Za-z]*';
--> statement-breakpoint

-- 1-c. 昇格の段階の名前（seed の値）を既定の等級名にする。
WITH `m`(`old_value`, `new_value`) AS (VALUES
	('B→R', '等級1→等級2'), ('R→C', '等級2→等級3'), ('C→AM', '等級3→等級4-1'),
	('AMⅠ→AMⅡ', '等級4-1→等級4-2'), ('AM→M', '等級4-2→等級5-1'), ('MⅠ→MⅡ', '等級5-1→等級5-2'))
INSERT OR IGNORE INTO `display_name_rewrites`
	(`table_name`, `row_id`, `column_name`, `old_value`, `new_value`, `company_id`, `migration`, `recorded_at`)
SELECT 'promotion_thresholds', `t`.`id`, 'label', `t`.`label`, `m`.`new_value`, `t`.`company_id`, '0034_grade_display_names',
	CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `promotion_thresholds` `t`
JOIN `m` ON `m`.`old_value` = `t`.`label`;
--> statement-breakpoint

-- 1-d. 昇格要件の遷移名（seed の値）を既定の等級名にする。
--      後続の版がある過去の版は履歴なので変えない（0013 の trg_promreq_past_version_immutable が更新を止める）。
WITH `m`(`old_value`, `new_value`) AS (VALUES
	('等級１→等級２', '等級1→等級2'), ('等級２→等級３', '等級2→等級3'), ('等級３→等級４', '等級3→等級4-1'),
	('AMⅠ→ AMⅡ', '等級4-1→等級4-2'), ('等級４→等級５', '等級4-2→等級5-1'), ('ManagerⅠ→ ManagerⅡ', '等級5-1→等級5-2'))
INSERT OR IGNORE INTO `display_name_rewrites`
	(`table_name`, `row_id`, `column_name`, `old_value`, `new_value`, `company_id`, `migration`, `recorded_at`)
SELECT 'promotion_requirements', `r`.`id`, 'transition_label', `r`.`transition_label`, `m`.`new_value`, `r`.`company_id`,
	'0034_grade_display_names', CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `promotion_requirements` `r`
JOIN `m` ON `m`.`old_value` = `r`.`transition_label`
WHERE NOT EXISTS (SELECT 1 FROM `promotion_requirements` `next` WHERE `next`.`previous_version_id` = `r`.`id`);
--> statement-breakpoint

-- 1-e. seed が入れた昇格要件の本文のうち、区分の呼び名を含むもの。利用者が自分で書いた本文は対象にしない。
--      1-d と同じく過去の版は変えない。
WITH `m`(`old_value`, `new_value`) AS (VALUES
	('スキルアップ研修（チーフ以上）', 'スキルアップ研修（等級3以上）'))
INSERT OR IGNORE INTO `display_name_rewrites`
	(`table_name`, `row_id`, `column_name`, `old_value`, `new_value`, `company_id`, `migration`, `recorded_at`)
SELECT 'promotion_requirements', `r`.`id`, 'text', `r`.`text`, `m`.`new_value`, `r`.`company_id`,
	'0034_grade_display_names', CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `promotion_requirements` `r`
JOIN `m` ON `m`.`old_value` = `r`.`text`
WHERE NOT EXISTS (SELECT 1 FROM `promotion_requirements` `next` WHERE `next`.`previous_version_id` = `r`.`id`);
--> statement-breakpoint

-- 1-f. 配点の型の注記（0009 と scripts/seed-grade-schemes.mjs が入れた値）。
WITH `m`(`old_value`, `new_value`) AS (VALUES
	('固定枠（等級要件達成率）＋10点枠で100点。20点枠はChief以上のみ。',
	 '固定枠（等級要件達成率）＋10点枠で100点。20点枠は等級3以上のみ。'),
	('等級要件達成率80点＋10点の項目を2つ。20点枠（金銭系）はChief以上から。',
	 '等級要件達成率80点＋10点の項目を2つ。20点枠（金銭系）は等級3以上から。'),
	('等級要件達成率40点＋20点の金銭系を1つ＋10点の項目を4つ。利益率はChiefでは選べない。',
	 '等級要件達成率40点＋20点の金銭系を1つ＋10点の項目を4つ。利益率は等級3では選べない。'),
	('等級要件達成率30点＋20点の金銭系を1つ＋10点の項目を5つ。AMⅠとAMⅡは配点が同じ。',
	 '等級要件達成率30点＋20点の金銭系を1つ＋10点の項目を5つ。等級4-1と等級4-2は配点が同じ。'),
	('等級要件達成率20点＋20点の金銭系を1つ＋10点の項目を6つ。ManagerⅠとManagerⅡは配点が同じ。',
	 '等級要件達成率20点＋20点の金銭系を1つ＋10点の項目を6つ。等級5-1と等級5-2は配点が同じ。'))
INSERT OR IGNORE INTO `display_name_rewrites`
	(`table_name`, `row_id`, `column_name`, `old_value`, `new_value`, `company_id`, `migration`, `recorded_at`)
SELECT 'grade_point_rules', `p`.`id`, 'note', `p`.`note`, `m`.`new_value`, `p`.`company_id`, '0034_grade_display_names',
	CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `grade_point_rules` `p`
JOIN `m` ON `m`.`old_value` = `p`.`note`;
--> statement-breakpoint

-- 1-g. 等級名を code ごとの既定にする（src/lib/domain/grade-label.ts の DEFAULT_GRADE_NAMES と同じ値）。
--      code が既定の7つ以外の等級は会社が自分で作ったものなので変えない。
WITH `d`(`code`, `name`) AS (VALUES
	('beginner', '等級1'), ('regular', '等級2'), ('chief', '等級3'),
	('am1', '等級4-1'), ('am2', '等級4-2'), ('manager1', '等級5-1'), ('manager2', '等級5-2'))
INSERT OR IGNORE INTO `display_name_rewrites`
	(`table_name`, `row_id`, `column_name`, `old_value`, `new_value`, `company_id`, `migration`, `recorded_at`)
SELECT 'grades', `g`.`id`, 'name', `g`.`name`, `d`.`name`, `g`.`company_id`, '0034_grade_display_names',
	CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `grades` `g`
JOIN `d` ON `d`.`code` = `g`.`code`
WHERE `g`.`name` <> `d`.`name`;
--> statement-breakpoint

/* ── 2〜5. 記録どおりに書き換える（今の値が old_value のままの行だけ） ───────── */

-- 2. アンケートの既定の題名
UPDATE `forms` SET `title` = (
	SELECT `w`.`new_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'forms' AND `w`.`column_name` = 'title' AND `w`.`row_id` = `forms`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'forms' AND `w`.`column_name` = 'title' AND `w`.`row_id` = `forms`.`id`
		AND `w`.`migration` = '0034_grade_display_names'
		AND `w`.`old_value` = `forms`.`title` AND `w`.`new_value` <> `forms`.`title`);
--> statement-breakpoint

-- 3. 行動指針の基準セットの名前
UPDATE `behavior_band_sets` SET `name` = (
	SELECT `w`.`new_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'behavior_band_sets' AND `w`.`column_name` = 'name' AND `w`.`row_id` = `behavior_band_sets`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'behavior_band_sets' AND `w`.`column_name` = 'name' AND `w`.`row_id` = `behavior_band_sets`.`id`
		AND `w`.`migration` = '0034_grade_display_names'
		AND `w`.`old_value` = `behavior_band_sets`.`name` AND `w`.`new_value` <> `behavior_band_sets`.`name`);
--> statement-breakpoint

-- 4. 昇格の段階・昇格要件の遷移名と本文・配点の型の注記
UPDATE `promotion_thresholds` SET `label` = (
	SELECT `w`.`new_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'promotion_thresholds' AND `w`.`column_name` = 'label' AND `w`.`row_id` = `promotion_thresholds`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'promotion_thresholds' AND `w`.`column_name` = 'label' AND `w`.`row_id` = `promotion_thresholds`.`id`
		AND `w`.`migration` = '0034_grade_display_names'
		AND `w`.`old_value` = `promotion_thresholds`.`label` AND `w`.`new_value` <> `promotion_thresholds`.`label`);
--> statement-breakpoint
-- 昇格要件の遷移名と本文は、0013 のトリガーが同じ id のままの変更を止めている（意味を変えるときは新しい版を作る決まり）。
-- ここで直すのは区分の呼び名を等級名へ置き換えるだけで意味は変わらないので、版を作らずにその場で書き換える。
-- 書き換えるあいだだけトリガーを外し、すぐに 0013 と同じ定義で作り直す（D1 は移行の1ファイルを1つの batch で流すので、
-- 途中で失敗してもトリガーを外した状態は残らない）。後続の版がある過去の版は対象にしない（過去の版の更新は
-- trg_promreq_past_version_immutable が止める。記録の時点でも外しているが、戻したあとに版が増えた場合に備えてここでも外す）。
DROP TRIGGER IF EXISTS `trg_promreq_semantic_immutable`;
--> statement-breakpoint
UPDATE `promotion_requirements` SET `transition_label` = (
	SELECT `w`.`new_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'promotion_requirements' AND `w`.`column_name` = 'transition_label'
		AND `w`.`row_id` = `promotion_requirements`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'promotion_requirements' AND `w`.`column_name` = 'transition_label'
		AND `w`.`row_id` = `promotion_requirements`.`id` AND `w`.`migration` = '0034_grade_display_names'
		AND `w`.`old_value` = `promotion_requirements`.`transition_label`
		AND `w`.`new_value` <> `promotion_requirements`.`transition_label`)
	AND NOT EXISTS (
		SELECT 1 FROM `promotion_requirements` `next` WHERE `next`.`previous_version_id` = `promotion_requirements`.`id`);
--> statement-breakpoint
UPDATE `promotion_requirements` SET `text` = (
	SELECT `w`.`new_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'promotion_requirements' AND `w`.`column_name` = 'text' AND `w`.`row_id` = `promotion_requirements`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'promotion_requirements' AND `w`.`column_name` = 'text' AND `w`.`row_id` = `promotion_requirements`.`id`
		AND `w`.`migration` = '0034_grade_display_names'
		AND `w`.`old_value` = `promotion_requirements`.`text` AND `w`.`new_value` <> `promotion_requirements`.`text`)
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
	SELECT `w`.`new_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'grade_point_rules' AND `w`.`column_name` = 'note' AND `w`.`row_id` = `grade_point_rules`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'grade_point_rules' AND `w`.`column_name` = 'note' AND `w`.`row_id` = `grade_point_rules`.`id`
		AND `w`.`migration` = '0034_grade_display_names'
		AND `w`.`old_value` = `grade_point_rules`.`note` AND `w`.`new_value` <> `grade_point_rules`.`note`);
--> statement-breakpoint

-- 5. 等級名（最後に書き換える。1-a は書き換える前の等級名で既定の題名を見分けるため）
UPDATE `grades` SET `name` = (
	SELECT `w`.`new_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'grades' AND `w`.`column_name` = 'name' AND `w`.`row_id` = `grades`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'grades' AND `w`.`column_name` = 'name' AND `w`.`row_id` = `grades`.`id`
		AND `w`.`migration` = '0034_grade_display_names'
		AND `w`.`old_value` = `grades`.`name` AND `w`.`new_value` <> `grades`.`name`);
