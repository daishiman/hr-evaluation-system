-- 等級区分別の配点への移行ほか（2026-08-11）
--
-- このファイルは手書きです。drizzle-kit の生成物は使っていません。
-- meta/_journal.json のスナップショットが 0002 で止まっており、
-- 0003 以降の手書きマイグレーションを drizzle が知らないため、
-- 生成すると「すでに本番へ適用済みのテーブル・列」を作り直す SQL が出てしまいます。
--
-- 含まれるもの:
--   1. 等級区分ごとの持ち点マスタ（grade_point_rules）
--   2. scheme_items に等級区分の軸を足す
--   3. 金銭系フラグ（kpi_items.is_monetary）
--   4. 判定根拠を「評価者向け」「本人向け」の2本立てにする列
--   5. 回答時点の設問スナップショット（form_answers.question_*）
--   6. 回答期限の個別延長（form_deadline_extensions）
--
-- 既存データは1行も消しません。列の追加と値の埋め戻しだけです。

/* ── 1. 等級区分ごとの持ち点マスタ ────────────────────────────────
   評価は等級区分を問わず100点満点。100点で次の等級に昇格する。
   「等級要件達成率」は全等級で必須の固定枠で、配点だけが等級区分ごとに変わる。
   Chief 以上は金銭系の項目を1つだけ20点枠として選び、残りは1項目10点。       */
CREATE TABLE `grade_point_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`point_group` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`total_points` integer DEFAULT 100 NOT NULL,
	`fixed_slot_points` integer NOT NULL,
	`major_slot_points` integer DEFAULT 0 NOT NULL,
	`major_slot_count` integer DEFAULT 0 NOT NULL,
	`minor_slot_points` integer DEFAULT 10 NOT NULL,
	`minor_slot_count` integer DEFAULT 0 NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_gpr_company_group` ON `grade_point_rules` (`company_id`,`point_group`);--> statement-breakpoint

-- 既存の全社に、正本（data/kpi-points.json のランクA行）と同じ配点の型を入れる。
INSERT INTO `grade_point_rules`
	(`id`, `company_id`, `point_group`, `display_order`, `total_points`,
	 `fixed_slot_points`, `major_slot_points`, `major_slot_count`,
	 `minor_slot_points`, `minor_slot_count`, `note`, `created_at`, `updated_at`)
SELECT 'gpr_' || c.`id` || '_Beginner', c.`id`, 'Beginner', 1, 100, 100, 0, 0, 10, 0,
	'等級要件達成率だけで100点。ほかの項目は評価対象外（0点ではなく行を作らない）。',
	1786500002000, 1786500002000 FROM `companies` c;--> statement-breakpoint
INSERT INTO `grade_point_rules`
	(`id`, `company_id`, `point_group`, `display_order`, `total_points`,
	 `fixed_slot_points`, `major_slot_points`, `major_slot_count`,
	 `minor_slot_points`, `minor_slot_count`, `note`, `created_at`, `updated_at`)
SELECT 'gpr_' || c.`id` || '_Regular', c.`id`, 'Regular', 2, 100, 80, 0, 0, 10, 2,
	'等級要件達成率80点＋10点の項目を2つ。20点枠（金銭系）はChief以上から。',
	1786500002000, 1786500002000 FROM `companies` c;--> statement-breakpoint
INSERT INTO `grade_point_rules`
	(`id`, `company_id`, `point_group`, `display_order`, `total_points`,
	 `fixed_slot_points`, `major_slot_points`, `major_slot_count`,
	 `minor_slot_points`, `minor_slot_count`, `note`, `created_at`, `updated_at`)
SELECT 'gpr_' || c.`id` || '_Chief', c.`id`, 'Chief', 3, 100, 40, 20, 1, 10, 4,
	'等級要件達成率40点＋20点の金銭系を1つ＋10点の項目を4つ。利益率はChiefでは選べない。',
	1786500002000, 1786500002000 FROM `companies` c;--> statement-breakpoint
INSERT INTO `grade_point_rules`
	(`id`, `company_id`, `point_group`, `display_order`, `total_points`,
	 `fixed_slot_points`, `major_slot_points`, `major_slot_count`,
	 `minor_slot_points`, `minor_slot_count`, `note`, `created_at`, `updated_at`)
SELECT 'gpr_' || c.`id` || '_AM', c.`id`, 'AM', 4, 100, 30, 20, 1, 10, 5,
	'等級要件達成率30点＋20点の金銭系を1つ＋10点の項目を5つ。AMⅠとAMⅡは配点が同じ。',
	1786500002000, 1786500002000 FROM `companies` c;--> statement-breakpoint
INSERT INTO `grade_point_rules`
	(`id`, `company_id`, `point_group`, `display_order`, `total_points`,
	 `fixed_slot_points`, `major_slot_points`, `major_slot_count`,
	 `minor_slot_points`, `minor_slot_count`, `note`, `created_at`, `updated_at`)
SELECT 'gpr_' || c.`id` || '_Manager', c.`id`, 'Manager', 5, 100, 20, 20, 1, 10, 6,
	'等級要件達成率20点＋20点の金銭系を1つ＋10点の項目を6つ。ManagerⅠとManagerⅡは配点が同じ。',
	1786500002000, 1786500002000 FROM `companies` c;--> statement-breakpoint

/* ── 2. scheme_items に等級区分の軸を足す ──────────────────────────
   これまで会社ごとに配点表を1つしか持てず、等級が違っても同じ8項目・同じ配点だった。
   既存の行は「8項目を選ぶ」形なので Manager 区分として引き継ぐ。
   引き継いだだけでは配点が新しい型（20/20/10×6）と合わないため、
   移行直後に scripts/seed-grade-schemes.mjs で全等級区分ぶんを作り直す。 */
ALTER TABLE `scheme_items` ADD `point_group` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `scheme_items` ADD `is_major_slot` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `scheme_items` SET `point_group` = 'Manager' WHERE `point_group` = '';--> statement-breakpoint
DROP INDEX `uq_si_scheme_item`;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_si_scheme_group_item` ON `scheme_items` (`scheme_id`,`point_group`,`kpi_item_id`);--> statement-breakpoint
CREATE INDEX `idx_si_scheme_group` ON `scheme_items` (`scheme_id`,`point_group`);--> statement-breakpoint

/* ── 3. 金銭系フラグ ──────────────────────────────────────────
   カテゴリでは判別できない。同じ sales でも No.12 加算取得率は10点枠、
   逆に No.4 昇給率は hr カテゴリだが金額を扱う。
   20点枠になりうるのは No.6 単価率 / No.9 売上達成率 / No.24 利益率 の3つだけ。 */
ALTER TABLE `kpi_items` ADD `is_monetary` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `kpi_items` SET `is_monetary` = 1 WHERE `no` IN (6, 9, 24);--> statement-breakpoint

/* ── 4. 判定根拠を「評価者向け」「本人向け」の2本立てにする ──────────────
   これまでの根拠文には配点・獲得点数・必要点数・閾値が日本語で埋め込まれており、
   列単位で伏せていた数値が文章から読めてしまっていた。
   根拠文そのものを消すと「なぜこの評価か」が本人に説明できなくなるため、
   最初から数値を含まない本人向けの文を別に作って保存する。
   既存行は NULL のままにする（当時の文面を評価者向けとしてそのまま残す）。 */
ALTER TABLE `evaluations` ADD `raise_reason` text;--> statement-breakpoint
ALTER TABLE `evaluations` ADD `raise_reason_employee` text;--> statement-breakpoint
ALTER TABLE `evaluations` ADD `promotion_blocked_reason_employee` text;--> statement-breakpoint
ALTER TABLE `evaluation_items` ADD `rationale_employee` text;--> statement-breakpoint

/* ── 5. 回答時点の設問スナップショット ──────────────────────────────
   form_answers.question_id は form_questions への外部キーで ON DELETE cascade。
   D1 では外部キーが実際に強制される（PRAGMA foreign_keys = 1 を実測で確認）ため、
   設問が消えると過去の回答も道連れになる。
   いまは「回答が1件でもあるアンケートの設問は編集できない」というAPI側のガード1枚だけで
   守られている状態なので、回答行そのものに当時の文面を写し取る。 */
ALTER TABLE `form_answers` ADD `question_title` text;--> statement-breakpoint
ALTER TABLE `form_answers` ADD `question_type` text;--> statement-breakpoint
ALTER TABLE `form_answers` ADD `question_section` text;--> statement-breakpoint
ALTER TABLE `form_answers` ADD `question_unit` text;--> statement-breakpoint
ALTER TABLE `form_answers` ADD `question_options_json` text;--> statement-breakpoint
ALTER TABLE `form_answers` ADD `question_display_order` integer;--> statement-breakpoint

-- 既存の回答にも、いま紐づいている設問の文面を写しておく。
-- 設問はまだ一度も編集されていない（回答があると編集できないため）ので、
-- ここで写した文面は回答時点のものと一致する。
UPDATE `form_answers` SET
	`question_title` = (SELECT q.`title` FROM `form_questions` q WHERE q.`id` = `form_answers`.`question_id`),
	`question_type` = (SELECT q.`question_type` FROM `form_questions` q WHERE q.`id` = `form_answers`.`question_id`),
	`question_section` = (SELECT q.`section` FROM `form_questions` q WHERE q.`id` = `form_answers`.`question_id`),
	`question_unit` = (SELECT q.`unit` FROM `form_questions` q WHERE q.`id` = `form_answers`.`question_id`),
	`question_options_json` = (SELECT q.`options_json` FROM `form_questions` q WHERE q.`id` = `form_answers`.`question_id`),
	`question_display_order` = (SELECT q.`display_order` FROM `form_questions` q WHERE q.`id` = `form_answers`.`question_id`)
WHERE `question_title` IS NULL;--> statement-breakpoint

/* ── 6. 回答期限の個別延長 ─────────────────────────────────────
   回答期間（forms.opens_at / closes_at）を実際に効かせる代わりに、
   産育休・長期出張などの事情に管理者が個別に対応できるようにする。
   上書きではなく行で残し、誰がいつ何日まで延ばしたかを後から説明できるようにする。 */
CREATE TABLE `form_deadline_extensions` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`form_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`extended_until` text NOT NULL,
	`reason` text,
	`granted_by_id` text,
	`revoked_at` integer,
	`revoked_by_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`form_id`) REFERENCES `forms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`revoked_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE INDEX `idx_fde_form_employee` ON `form_deadline_extensions` (`form_id`,`employee_id`);--> statement-breakpoint
CREATE INDEX `idx_fde_company` ON `form_deadline_extensions` (`company_id`);
