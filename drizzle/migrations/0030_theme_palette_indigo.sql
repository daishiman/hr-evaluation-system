-- 配色の保存先に、系統「インディゴ」（既定）を足す（2026-09-29）
--
-- このファイルは手書きです（理由は 0009 の冒頭を参照）。
-- SQLite は CHECK 制約を ALTER で書き換えられないため、表を作り直す。
-- 列・主キー・外部キー・他の CHECK は 0017 と同じで、palette の許可値だけが増える。
-- この表を参照する外部キーは無いので、作り直しで他の表の行は消えない。
-- 既存の行（graphite ほか5系統）は1行も消さずに写す。
CREATE TABLE `__new_theme_user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`palette` text NOT NULL,
	`mode` text NOT NULL,
	`resolved` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `ck_theme_user_preferences_palette` CHECK (`palette` IN ('indigo', 'graphite', 'azure', 'sand', 'moss', 'midnight')),
	CONSTRAINT `ck_theme_user_preferences_mode` CHECK (`mode` IN ('auto', 'light', 'dark')),
	CONSTRAINT `ck_theme_user_preferences_resolved` CHECK (`resolved` IN ('light', 'dark')),
	CONSTRAINT `ck_theme_user_preferences_consistent` CHECK (`mode` = 'auto' OR `mode` = `resolved`)
);
--> statement-breakpoint
INSERT INTO `__new_theme_user_preferences` (`user_id`, `palette`, `mode`, `resolved`, `updated_at`)
SELECT `user_id`, `palette`, `mode`, `resolved`, `updated_at` FROM `theme_user_preferences`;
--> statement-breakpoint
DROP TABLE `theme_user_preferences`;
--> statement-breakpoint
ALTER TABLE `__new_theme_user_preferences` RENAME TO `theme_user_preferences`;
