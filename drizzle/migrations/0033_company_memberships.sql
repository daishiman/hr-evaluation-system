-- 所属の表を作り、今の利用者の会社を最初の所属として写す（S7・D-004・2026-10-13）
--
-- このファイルは手書きです（理由は 0009 の冒頭を参照）。
-- 1人が複数の会社に所属できるようにする。会社ごとの値（役割・等級・事業所・上司・社員番号・
-- 部署・入社日・人物メモ）はこの表が正本になり、users の同じ列は元の所属の写しとして残す。
--
-- 冪等に書く（IF NOT EXISTS・INSERT OR IGNORE）。2回流しても結果は同じ。ALTER TABLE は使わない。
-- 全体管理者は所属を持たない（role の CHECK で SUPER_ADMIN を置けない）。
-- 戻すときはアプリの版を戻す。users の写しが残っているので、表を残したままでも元の動きになる。
CREATE TABLE IF NOT EXISTS `company_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`company_id` text NOT NULL REFERENCES `companies`(`id`) ON DELETE CASCADE,
	`role` text DEFAULT 'EMPLOYEE' NOT NULL CHECK (`role` IN ('EMPLOYEE', 'MANAGER', 'COMPANY_ADMIN')),
	`grade_id` text,
	`office_id` text,
	`manager_id` text,
	`employee_code` text,
	`department` text,
	`hired_at` text,
	`profile_note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_membership_user_company` ON `company_memberships` (`user_id`, `company_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_membership_company` ON `company_memberships` (`company_id`);
--> statement-breakpoint
-- 今の会社を最初の所属にする。id は利用者の id から作るので、2回目は同じ行に当たって何もしない
INSERT OR IGNORE INTO `company_memberships` (
	`id`, `user_id`, `company_id`, `role`, `grade_id`, `office_id`, `manager_id`,
	`employee_code`, `department`, `hired_at`, `profile_note`, `created_at`, `updated_at`
)
SELECT
	'mem_' || `id`, `id`, `company_id`, `role`, `grade_id`, `office_id`, `manager_id`,
	`employee_code`, `department`, `hired_at`, `profile_note`, `created_at`, `updated_at`
FROM `users`
WHERE `company_id` IS NOT NULL AND `role` IN ('EMPLOYEE', 'MANAGER', 'COMPANY_ADMIN');
