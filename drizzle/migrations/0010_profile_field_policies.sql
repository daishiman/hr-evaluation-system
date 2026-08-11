-- 本人が変更してよいプロフィール項目を、会社ごとに決められるようにする（2026-08-11）
--
-- これまで利用者が自分で変えられるのはパスワードだけだった。
-- 氏名や所属を本人に直させたい会社と、会社の管理者が管理したい会社があるため、
-- 「項目ごとに本人編集を許すかどうか」を会社の設定として持つ。
--
-- 役割・等級・上長はこのテーブルに入れない（本人に開放すると自分を管理者に
-- 昇格できてしまうため、設定で切り替えられないこと自体を仕組みにする）。
CREATE TABLE `profile_field_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`field` text NOT NULL,
	`self_editable` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_pfp_company_field` ON `profile_field_policies` (`company_id`,`field`);
