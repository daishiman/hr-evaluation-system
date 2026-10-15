-- アカウントの権限にかかわる操作の監査記録の表を作る（E7・DD-013・2026-10-15）
--
-- このファイルは手書きです（理由は 0009 の冒頭を参照）。
-- 全体管理者にする・外す、会社の役割を変える、所属の会社を移す、利用を止める・再開する、
-- パスワードを再発行する、アカウントを作る、を「誰が・誰に・いつ・どの入口から」で残す。追記だけの表。
-- パスワードの本文・hash・セッションの token は持たない。
--
-- 新しい表を足すだけで、既存の行は書き換えない（この表は移行の前の操作を持たない）。
-- 冪等に書く（IF NOT EXISTS）。2回流しても結果は同じ。
-- 戻すときはアプリの版を戻す。古いコードはこの表を読まないので、表を残したままでよい。
-- 表ごと消すときは DROP TABLE `account_security_events`;（記録も消えるので、書き出してから）。
CREATE TABLE IF NOT EXISTS `account_security_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`actor_id` text REFERENCES `users`(`id`) ON DELETE SET NULL,
	`company_id` text,
	`event_type` text NOT NULL CHECK (`event_type` IN (
		'account_created', 'super_admin_granted', 'super_admin_revoked', 'role_changed',
		'company_moved', 'deactivated', 'reactivated', 'password_reissued')),
	`source` text NOT NULL CHECK (`source` IN ('system_users', 'members', 'company_create', 'member_import')),
	`operation_id` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`occurred_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_ase_user_time` ON `account_security_events` (`user_id`, `occurred_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_ase_company_time` ON `account_security_events` (`company_id`, `occurred_at`);
--> statement-breakpoint
-- 書いた記録は書き換えさせない。actor_id だけは外す（操作した人を消したときに DB が SET NULL で書き換えるため）
CREATE TRIGGER IF NOT EXISTS `trg_ase_append_only`
BEFORE UPDATE OF `user_id`, `company_id`, `event_type`, `source`, `operation_id`, `before_json`, `after_json`, `occurred_at`
ON `account_security_events`
BEGIN
  SELECT RAISE(ABORT, 'account_security_events_append_only');
END;
