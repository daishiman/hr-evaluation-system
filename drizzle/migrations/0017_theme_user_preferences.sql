CREATE TABLE `theme_user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`palette` text NOT NULL,
	`mode` text NOT NULL,
	`resolved` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `ck_theme_user_preferences_palette` CHECK (`palette` IN ('graphite', 'azure', 'sand', 'moss', 'midnight')),
	CONSTRAINT `ck_theme_user_preferences_mode` CHECK (`mode` IN ('auto', 'light', 'dark')),
	CONSTRAINT `ck_theme_user_preferences_resolved` CHECK (`resolved` IN ('light', 'dark')),
	CONSTRAINT `ck_theme_user_preferences_consistent` CHECK (`mode` = 'auto' OR `mode` = `resolved`)
);
