-- 移行 0039（事業所KGIの表と、評価のKGIの2列を消す）を戻す
--
-- 2回目の公開（0039）を戻すときは、DB だけを戻す（DD-020 の9）。コードは戻さない。0039 を入れた PR はコードを
-- 変えておらず、KGI を読むコードは 0038 と同じ公開で消えている。0038 の PR を revert せず、wrangler rollback でも
-- その前の版へ戻さない（schema に KGI の定義が戻り、消えた列を名前で指定する）。
--
-- 戻るのは表と列の形だけで、値は戻らない。値は、0039 を流した Deploy workflow が残した書き出し
-- （Artifact d1-backup-<実行 id>。保管14日）から、3つの表と評価の2列だけを取り出して入れ直す。
-- 書き出しの全体は流し込まない（0039 の後に書かれた評価やメモまで書き出しの時点に戻るため）。
--
-- 本番の DB への書き込みなので、利用者の確認のあとに復旧の手順として流す（docs/deploy-notes.md）。
ALTER TABLE `evaluations` ADD `office_achievement_rate` real;
--> statement-breakpoint
ALTER TABLE `evaluations` ADD `kgi_coefficient` real;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `kgi_coefficients` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`scope` text DEFAULT '事業所' NOT NULL,
	`label` text NOT NULL,
	`lower_bound` real,
	`upper_bound` real,
	`coefficient` real NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_provisional` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL DEFAULT 0,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_kgi_company` ON `kgi_coefficients` (`company_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `office_kgi_results` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`office_id` text NOT NULL,
	`cycle_id` text NOT NULL,
	`achievement_rate` real NOT NULL,
	`note` text,
	`recorded_by_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`office_id`) REFERENCES `offices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cycle_id`) REFERENCES `evaluation_cycles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recorded_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_okr_office_cycle` ON `office_kgi_results` (`office_id`,`cycle_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_okr_company` ON `office_kgi_results` (`company_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_okr_cycle` ON `office_kgi_results` (`cycle_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `office_kgi_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`office_id` text NOT NULL,
	`cycle_id` text NOT NULL,
	`before_rate` real,
	`after_rate` real NOT NULL,
	`reason` text,
	`revised_by_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`office_id`) REFERENCES `offices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cycle_id`) REFERENCES `evaluation_cycles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`revised_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_okrev_company` ON `office_kgi_revisions` (`company_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_okrev_cycle` ON `office_kgi_revisions` (`cycle_id`);
