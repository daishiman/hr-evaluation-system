-- 移行の予行（P08）で見つかった直しをまとめる（S2・DD-008・2026-10-13）
--
-- このファイルは手書きです（理由は 0009 の冒頭を参照）。
-- 0033・0034 は本番に当て済みとして扱い、書き換えない。予行で見つかった直しはこのファイル1本にまとめる
-- （予行の記録は eval-log/feature-improvement-requests-2026-10-migration-rehearsal.json、対応表は docs/migration-mapping.md）。
--
-- 直すもの
--   1. 等級名を変えたあとに残った、アンケートの既定の題名。
--      0034 は「今の等級名」で作った題名だけを既定の題名と見分けた。等級名を変える前に作ったアンケートは、
--      変える前の名前（seed の「等級１：Beginner」や、会社が前に付けた名前）で題名が保存されているので 0034 では拾えない。
--      seed の名前と、制度の変更履歴（constitution_events の before_json.name）に残る前の名前でも見分けて ''（既定の題名）にする。
--   2. KPI 項目の「自動で決まる値・固定値の扱い」「評価の意図」「備考」のうち、seed が入れた英語の区分名を含む文。
--      評価の基準（/criteria）と評価セットの選択画面に出るのに、0034 の対象から漏れていた。
--      seed のままの文だけを data/kpi-master.json と同じ文に書き換え、会社が自分で直した文は変えない。
--   3. 昇格要件の本文の写しに残った「スキルアップ研修（チーフ以上）」。
--      0034 は昇格要件の本文を「（等級3以上）」に直したが、アンケートを作ったときに写した設問名・回答に残した設問名・
--      評価の必須ゲートの文・昇格できない理由の文は元のままだった。受付中のアンケートの設問と、評価の画面の
--      「昇格できない理由」（警告文）にカタカナの区分名が出るので、同じ置き換えをする。
--      写しは「当時の文面で読み返す」ためのものだが、ここで変えるのは等級の呼び名だけで、聞いた中身は変わらない
--      （0034 が既定の題名や昇格要件の本文を直したのと同じ扱い）。昇格要件に結び付いた写しだけを対象にし、
--      会社が自由に書いた設問は変えない。
--
-- 進め方は 0034 と同じ。display_name_rewrites に今の値と新しい値を残し（INSERT OR IGNORE。2回目は最初の値を上書きしない）、
-- 今の値が記録の old_value のままの行だけを書き換える。2回流しても2回目は0行になる。
-- updated_at は進めない（表示の文だけの変更で、基準を変えたことにはしない。src/lib/impact.ts が updated_at で判定する）。
-- 戻すときは drizzle/rollback/0035_migration_corrections_rollback.sql を流す（0034 も戻すときは、0035 を先に戻す）。

/* ── 1. 書き換える前の値を残す ─────────────────────────────── */

-- 1-a. 等級名を変える前の名前で保存された既定の題名（「{評価期間} {前の等級名} 実績アンケート」）は ''（既定の題名）にする。
--      前の名前の候補は、code ごとの seed の名前と、変更履歴に残る前の名前。
--      既定の名前（等級1 など）は、どの等級でも候補にしない。0034 のあとに作る既定の題名は ''（題名を保存しない）なので、
--      既定の名前を含む題名は会社が自分で書いたもの（0034 の 1-a と同じく、書き換えたあとの名前と同じ題名を拾わない）。
--      json_extract は CASE の中で呼ぶ（壊れた before_json が1行あっても移行を止めないため。AND は評価の順が決まっていない）。
WITH `d`(`code`, `seed_name`, `name`) AS (VALUES
	('beginner', '等級１：Beginner', '等級1'), ('regular', '等級２：Regular', '等級2'), ('chief', '等級３：Chief', '等級3'),
	('am1', '等級４：AM Ⅰ', '等級4-1'), ('am2', '等級４：AM Ⅱ', '等級4-2'),
	('manager1', '等級５：Manager Ⅰ', '等級5-1'), ('manager2', '等級５：Manager Ⅱ', '等級5-2')),
`n`(`grade_id`, `name`) AS (
	SELECT `g`.`id`, `d`.`seed_name` FROM `grades` `g` JOIN `d` ON `d`.`code` = `g`.`code`
	UNION
	SELECT `entity_id`, `name` FROM (
		SELECT `e`.`entity_id`,
			CASE WHEN json_valid(`e`.`before_json`) THEN json_extract(`e`.`before_json`, '$.name') END AS `name`
		FROM `constitution_events` `e`
		WHERE `e`.`entity_type` = 'grade')
	WHERE typeof(`name`) = 'text')
INSERT OR IGNORE INTO `display_name_rewrites`
	(`table_name`, `row_id`, `column_name`, `old_value`, `new_value`, `company_id`, `migration`, `recorded_at`)
SELECT DISTINCT 'forms', `f`.`id`, 'title', `f`.`title`, '', `f`.`company_id`, '0035_migration_corrections',
	CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `forms` `f`
JOIN `evaluation_cycles` `c` ON `c`.`id` = `f`.`cycle_id`
JOIN `grades` `g` ON `g`.`id` = `f`.`grade_id`
JOIN `n` ON `n`.`grade_id` = `g`.`id`
WHERE `f`.`title` = `c`.`name` || ' ' || `n`.`name` || ' 実績アンケート'
	AND `n`.`name` NOT IN (SELECT `name` FROM `d`);
--> statement-breakpoint

-- 1-b. KPI 項目の文（seed の値。data/kpi-master.json の旧い文と新しい文）。
WITH `m`(`column_name`, `old_value`, `new_value`) AS (VALUES
	('formula_note',
	 '分母は等級から自動決定：Beginner=5／Regular=5／Chief=5／AM Ⅰ=3／AM Ⅱ=2／Manager Ⅰ=2／Manager Ⅱ=2（等級要件シートより）',
	 '分母は等級から自動決定：等級1=5／等級2=5／等級3=5／等級4-1=3／等級4-2=2／等級5-1=2／等級5-2=2（等級要件シートより）'),
	('formula_note',
	 'Regular/Chief＝本人が報告した件数、AM/Manager＝事業所全体で報告された件数。フォームの説明文を等級で切り替える',
	 '等級2・等級3＝本人が報告した件数、等級4-1〜等級5-2＝事業所全体で報告された件数。フォームの説明文を等級で切り替える'),
	('formula_note',
	 '1人あたり必要回数は等級から自動決定：AM=3回（対象=Reg・Beg・Pt）／Manager=2回（対象=AM・Chief）',
	 '1人あたり必要回数は等級から自動決定：等級4-1・等級4-2=3回（対象=等級2・等級1・Pt）／等級5-1・等級5-2=2回（対象=等級4-1・等級4-2・等級3）'),
	('intent',
	 'Reg/Chiefは個人で何件報告したか。AM/Managerは事業所全体で何件報告させられたか',
	 '等級2・等級3は個人で何件報告したか。等級4-1〜等級5-2は事業所全体で何件報告させられたか'),
	('intent',
	 'Reg以下の人をどのくらい昇給させられたか AND 自身も昇給したか',
	 '等級2以下の人をどのくらい昇給させられたか AND 自身も昇給したか'),
	('remarks',
	 '元シートは基準のみで配点が空欄。Managerに10点を置くと全等級の満点が100点で揃う（素案）',
	 '元シートは基準のみで配点が空欄。等級5-1・等級5-2に10点を置くと全等級の満点が100点で揃う（素案）'),
	('remarks',
	 '新規（素案）。経営責任のあるAM/Managerのみ、配点20点',
	 '新規（素案）。経営責任のある等級4-1〜等級5-2のみ、配点20点'))
INSERT OR IGNORE INTO `display_name_rewrites`
	(`table_name`, `row_id`, `column_name`, `old_value`, `new_value`, `company_id`, `migration`, `recorded_at`)
SELECT 'kpi_items', `k`.`id`, `m`.`column_name`, `m`.`old_value`, `m`.`new_value`, `k`.`company_id`, '0035_migration_corrections',
	CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `kpi_items` `k`
JOIN `m` ON (`m`.`column_name` = 'formula_note' AND `k`.`formula_note` = `m`.`old_value`)
	OR (`m`.`column_name` = 'intent' AND `k`.`intent` = `m`.`old_value`)
	OR (`m`.`column_name` = 'remarks' AND `k`.`remarks` = `m`.`old_value`);
--> statement-breakpoint

-- 1-c. 昇格要件の本文の写し（0034 の 1-e と同じ組）。
--      設問名・回答の設問名・必須ゲートの文は、値がまるごと旧い本文と同じで、昇格要件に結び付いた行だけ。
WITH `p`(`old_value`, `new_value`) AS (VALUES
	('スキルアップ研修（チーフ以上）', 'スキルアップ研修（等級3以上）'))
INSERT OR IGNORE INTO `display_name_rewrites`
	(`table_name`, `row_id`, `column_name`, `old_value`, `new_value`, `company_id`, `migration`, `recorded_at`)
SELECT 'form_questions', `q`.`id`, 'title', `q`.`title`, `p`.`new_value`, `q`.`company_id`, '0035_migration_corrections',
	CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `form_questions` `q`
JOIN `p` ON `p`.`old_value` = `q`.`title`
WHERE `q`.`promotion_requirement_id` IS NOT NULL;
--> statement-breakpoint
WITH `p`(`old_value`, `new_value`) AS (VALUES
	('スキルアップ研修（チーフ以上）', 'スキルアップ研修（等級3以上）'))
INSERT OR IGNORE INTO `display_name_rewrites`
	(`table_name`, `row_id`, `column_name`, `old_value`, `new_value`, `company_id`, `migration`, `recorded_at`)
SELECT 'form_answers', `a`.`id`, 'question_title', `a`.`question_title`, `p`.`new_value`, `a`.`company_id`, '0035_migration_corrections',
	CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `form_answers` `a`
JOIN `p` ON `p`.`old_value` = `a`.`question_title`
JOIN `form_questions` `q` ON `q`.`id` = `a`.`question_id`
WHERE `q`.`promotion_requirement_id` IS NOT NULL;
--> statement-breakpoint
WITH `p`(`old_value`, `new_value`) AS (VALUES
	('スキルアップ研修（チーフ以上）', 'スキルアップ研修（等級3以上）'))
INSERT OR IGNORE INTO `display_name_rewrites`
	(`table_name`, `row_id`, `column_name`, `old_value`, `new_value`, `company_id`, `migration`, `recorded_at`)
SELECT 'evaluation_gates', `g`.`id`, 'text', `g`.`text`, `p`.`new_value`, `g`.`company_id`, '0035_migration_corrections',
	CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `evaluation_gates` `g`
JOIN `p` ON `p`.`old_value` = `g`.`text`
WHERE `g`.`promotion_requirement_id` IS NOT NULL;
--> statement-breakpoint
-- 昇格できない理由は、未達の要件名を並べた文（src/lib/domain/scoring.ts）。旧い本文を含む文だけ、その部分を置き換える。
-- 記録には文の全体を残す（戻すときは全体を書き戻す）。
WITH `p`(`old_value`, `new_value`) AS (VALUES
	('スキルアップ研修（チーフ以上）', 'スキルアップ研修（等級3以上）'))
INSERT OR IGNORE INTO `display_name_rewrites`
	(`table_name`, `row_id`, `column_name`, `old_value`, `new_value`, `company_id`, `migration`, `recorded_at`)
SELECT 'evaluations', `e`.`id`, 'promotion_blocked_reason', `e`.`promotion_blocked_reason`,
	replace(`e`.`promotion_blocked_reason`, `p`.`old_value`, `p`.`new_value`), `e`.`company_id`, '0035_migration_corrections',
	CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `evaluations` `e`
JOIN `p` ON instr(`e`.`promotion_blocked_reason`, `p`.`old_value`) > 0;
--> statement-breakpoint
WITH `p`(`old_value`, `new_value`) AS (VALUES
	('スキルアップ研修（チーフ以上）', 'スキルアップ研修（等級3以上）'))
INSERT OR IGNORE INTO `display_name_rewrites`
	(`table_name`, `row_id`, `column_name`, `old_value`, `new_value`, `company_id`, `migration`, `recorded_at`)
SELECT 'evaluations', `e`.`id`, 'promotion_blocked_reason_employee', `e`.`promotion_blocked_reason_employee`,
	replace(`e`.`promotion_blocked_reason_employee`, `p`.`old_value`, `p`.`new_value`), `e`.`company_id`, '0035_migration_corrections',
	CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `evaluations` `e`
JOIN `p` ON instr(`e`.`promotion_blocked_reason_employee`, `p`.`old_value`) > 0;
--> statement-breakpoint

/* ── 2〜4. 記録どおりに書き換える（今の値が old_value のままの行だけ） ───────── */

-- 2. アンケートの既定の題名
UPDATE `forms` SET `title` = (
	SELECT `w`.`new_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'forms' AND `w`.`column_name` = 'title' AND `w`.`row_id` = `forms`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'forms' AND `w`.`column_name` = 'title' AND `w`.`row_id` = `forms`.`id`
		AND `w`.`migration` = '0035_migration_corrections'
		AND `w`.`old_value` = `forms`.`title` AND `w`.`new_value` <> `forms`.`title`);
--> statement-breakpoint

-- 3. KPI 項目の文
UPDATE `kpi_items` SET `formula_note` = (
	SELECT `w`.`new_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'kpi_items' AND `w`.`column_name` = 'formula_note' AND `w`.`row_id` = `kpi_items`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'kpi_items' AND `w`.`column_name` = 'formula_note' AND `w`.`row_id` = `kpi_items`.`id`
		AND `w`.`migration` = '0035_migration_corrections'
		AND `w`.`old_value` = `kpi_items`.`formula_note` AND `w`.`new_value` <> `kpi_items`.`formula_note`);
--> statement-breakpoint
UPDATE `kpi_items` SET `intent` = (
	SELECT `w`.`new_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'kpi_items' AND `w`.`column_name` = 'intent' AND `w`.`row_id` = `kpi_items`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'kpi_items' AND `w`.`column_name` = 'intent' AND `w`.`row_id` = `kpi_items`.`id`
		AND `w`.`migration` = '0035_migration_corrections'
		AND `w`.`old_value` = `kpi_items`.`intent` AND `w`.`new_value` <> `kpi_items`.`intent`);
--> statement-breakpoint
UPDATE `kpi_items` SET `remarks` = (
	SELECT `w`.`new_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'kpi_items' AND `w`.`column_name` = 'remarks' AND `w`.`row_id` = `kpi_items`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'kpi_items' AND `w`.`column_name` = 'remarks' AND `w`.`row_id` = `kpi_items`.`id`
		AND `w`.`migration` = '0035_migration_corrections'
		AND `w`.`old_value` = `kpi_items`.`remarks` AND `w`.`new_value` <> `kpi_items`.`remarks`);
--> statement-breakpoint

-- 4. 昇格要件の本文の写し
UPDATE `form_questions` SET `title` = (
	SELECT `w`.`new_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'form_questions' AND `w`.`column_name` = 'title' AND `w`.`row_id` = `form_questions`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'form_questions' AND `w`.`column_name` = 'title' AND `w`.`row_id` = `form_questions`.`id`
		AND `w`.`migration` = '0035_migration_corrections'
		AND `w`.`old_value` = `form_questions`.`title` AND `w`.`new_value` <> `form_questions`.`title`);
--> statement-breakpoint
UPDATE `form_answers` SET `question_title` = (
	SELECT `w`.`new_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'form_answers' AND `w`.`column_name` = 'question_title' AND `w`.`row_id` = `form_answers`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'form_answers' AND `w`.`column_name` = 'question_title' AND `w`.`row_id` = `form_answers`.`id`
		AND `w`.`migration` = '0035_migration_corrections'
		AND `w`.`old_value` = `form_answers`.`question_title` AND `w`.`new_value` <> `form_answers`.`question_title`);
--> statement-breakpoint
UPDATE `evaluation_gates` SET `text` = (
	SELECT `w`.`new_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'evaluation_gates' AND `w`.`column_name` = 'text' AND `w`.`row_id` = `evaluation_gates`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'evaluation_gates' AND `w`.`column_name` = 'text' AND `w`.`row_id` = `evaluation_gates`.`id`
		AND `w`.`migration` = '0035_migration_corrections'
		AND `w`.`old_value` = `evaluation_gates`.`text` AND `w`.`new_value` <> `evaluation_gates`.`text`);
--> statement-breakpoint
UPDATE `evaluations` SET `promotion_blocked_reason` = (
	SELECT `w`.`new_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'evaluations' AND `w`.`column_name` = 'promotion_blocked_reason' AND `w`.`row_id` = `evaluations`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'evaluations' AND `w`.`column_name` = 'promotion_blocked_reason' AND `w`.`row_id` = `evaluations`.`id`
		AND `w`.`migration` = '0035_migration_corrections'
		AND `w`.`old_value` = `evaluations`.`promotion_blocked_reason` AND `w`.`new_value` <> `evaluations`.`promotion_blocked_reason`);
--> statement-breakpoint
UPDATE `evaluations` SET `promotion_blocked_reason_employee` = (
	SELECT `w`.`new_value` FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'evaluations' AND `w`.`column_name` = 'promotion_blocked_reason_employee' AND `w`.`row_id` = `evaluations`.`id`)
WHERE EXISTS (
	SELECT 1 FROM `display_name_rewrites` `w`
	WHERE `w`.`table_name` = 'evaluations' AND `w`.`column_name` = 'promotion_blocked_reason_employee' AND `w`.`row_id` = `evaluations`.`id`
		AND `w`.`migration` = '0035_migration_corrections'
		AND `w`.`old_value` = `evaluations`.`promotion_blocked_reason_employee` AND `w`.`new_value` <> `evaluations`.`promotion_blocked_reason_employee`);
