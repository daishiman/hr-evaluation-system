-- 行動指針の割り当てを、等級の識別子から既定へ戻す（I26・DD-026・2026-10-22）
--
-- このファイルは手書きです（理由は 0009 の冒頭を参照）。
-- 既定は beginner・regular → g1_2、chief・am1・am2 → g3_4、manager1・manager2 → 出さない（NULL）。
-- 照合は grades.code で行うので、等級名を変えた会社も戻る。7つの識別子に無い、会社が足した等級には触らない。
-- 書き換えるのは grades.behavior_band だけ。観点の文・まとまりの呼び名は変えない。雛形の会社（is_template）も対象にする。
-- 既定と同じ値は src/lib/domain/behavior-default-assignment.ts の DEFAULT_BEHAVIOR_BAND（試験で一致を確かめる）。
--
-- 進め方
--   1. 既定のまとまり（g1_2・g3_4）のどちらかが無いか使用を止めている会社は書き換えず、記録の表に1行残して数える
--      （割り当てた先が無い・使えないと、行動指針の設問が空になるため。人が判断する）
--   2. 書き換える行の今の値と新しい値を behavior_band_default_rewrites に残す（INSERT OR IGNORE。2回目は最初の値を上書きしない）
--   3. 記録どおりに書き換える。対象は「今の値が記録の old_value のままの行」だけなので、2回流しても2回目は0行になる。
--      移行のあとに会社が変えた割り当ては、もう一度流しても上書きしない。
--      ただし、会社が移行の前と同じ値へ戻した行は「記録の old_value のままの行」と区別できないので、もう一度流すと既定へ書き換わる。
--      （wrangler は適用済みの移行を流し直さない。手で流し直すときだけ起きる）
-- 割り当ては NULL（出さない）を取るので、記録の old_value・new_value も NULL を取る。比べるのは IS / IS NOT（= は NULL で偽になる）。
-- updated_at は移行の時刻にする。生の SQL では $onUpdate が効かないので明示する（DD-026 の5。アンケートをそろえる操作が設定の側を新しいと見るため）。
-- ALTER TABLE は使わない。code・id・名前は変えない。
-- 戻すときは drizzle/rollback/0040_behavior_band_defaults_rollback.sql を流す。
CREATE TABLE IF NOT EXISTS `behavior_band_default_rewrites` (
	`table_name` text NOT NULL,
	`row_id` text NOT NULL,
	`column_name` text NOT NULL,
	`old_value` text,
	`new_value` text,
	`company_id` text,
	`migration` text NOT NULL,
	`recorded_at` integer NOT NULL,
	PRIMARY KEY (`table_name`, `row_id`, `column_name`)
);
--> statement-breakpoint

/* ── 1. 既定のまとまりを持たない会社を数える ─────────────────────── */

-- 既定と違う等級がある会社のうち、使用中の g1_2 と g3_4 の両方はそろっていない会社。
-- 既定と同じ会社（戻す要が無い）は数えない。数えた会社は、2回目以降も手順 2 で除く（移行のあとに作ったまとまりで書き換えない）。
WITH `d`(`code`, `band`) AS (VALUES
	('beginner', 'g1_2'), ('regular', 'g1_2'), ('chief', 'g3_4'), ('am1', 'g3_4'), ('am2', 'g3_4'),
	('manager1', NULL), ('manager2', NULL))
INSERT OR IGNORE INTO `behavior_band_default_rewrites`
	(`table_name`, `row_id`, `column_name`, `old_value`, `new_value`, `company_id`, `migration`, `recorded_at`)
SELECT 'companies', `c`.`id`, 'behavior_band_default', 'missing_default_sets', 'missing_default_sets', `c`.`id`,
	'0040_behavior_band_defaults', CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `companies` `c`
WHERE (
		SELECT COUNT(DISTINCT `b`.`code`) FROM `behavior_band_sets` `b`
		WHERE `b`.`company_id` = `c`.`id` AND `b`.`code` IN ('g1_2', 'g3_4') AND `b`.`is_active` = 1
	) < 2
	AND EXISTS (
		SELECT 1 FROM `grades` `g` JOIN `d` ON `d`.`code` = `g`.`code`
		WHERE `g`.`company_id` = `c`.`id` AND `g`.`behavior_band` IS NOT `d`.`band`);
--> statement-breakpoint

/* ── 2. 書き換える前の値を残す ─────────────────────────────── */

-- 7つの識別子の等級のうち、今の値が既定と違う行。使用を止めた等級も戻す（もう一度使うと出るので）。
WITH `d`(`code`, `band`) AS (VALUES
	('beginner', 'g1_2'), ('regular', 'g1_2'), ('chief', 'g3_4'), ('am1', 'g3_4'), ('am2', 'g3_4'),
	('manager1', NULL), ('manager2', NULL))
INSERT OR IGNORE INTO `behavior_band_default_rewrites`
	(`table_name`, `row_id`, `column_name`, `old_value`, `new_value`, `company_id`, `migration`, `recorded_at`)
SELECT 'grades', `g`.`id`, 'behavior_band', `g`.`behavior_band`, `d`.`band`, `g`.`company_id`,
	'0040_behavior_band_defaults', CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `grades` `g`
JOIN `d` ON `d`.`code` = `g`.`code`
WHERE `g`.`behavior_band` IS NOT `d`.`band`
	AND NOT EXISTS (
		SELECT 1 FROM `behavior_band_default_rewrites` `w`
		WHERE `w`.`table_name` = 'companies' AND `w`.`column_name` = 'behavior_band_default'
			AND `w`.`row_id` = `g`.`company_id` AND `w`.`migration` = '0040_behavior_band_defaults');
--> statement-breakpoint

/* ── 3. 記録どおりに書き換える ─────────────────────────────── */

UPDATE `grades` SET
	`behavior_band` = (
		SELECT `w`.`new_value` FROM `behavior_band_default_rewrites` `w`
		WHERE `w`.`table_name` = 'grades' AND `w`.`column_name` = 'behavior_band' AND `w`.`row_id` = `grades`.`id`),
	`updated_at` = CAST(strftime('%s', 'now') AS INTEGER) * 1000
WHERE EXISTS (
	SELECT 1 FROM `behavior_band_default_rewrites` `w`
	WHERE `w`.`table_name` = 'grades' AND `w`.`column_name` = 'behavior_band' AND `w`.`row_id` = `grades`.`id`
		AND `w`.`migration` = '0040_behavior_band_defaults'
		AND `w`.`old_value` IS `grades`.`behavior_band` AND `w`.`new_value` IS NOT `grades`.`behavior_band`);
