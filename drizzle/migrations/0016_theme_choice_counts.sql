CREATE TABLE `theme_choice_counts` (
	`key` text PRIMARY KEY NOT NULL,
	`palette` text NOT NULL,
	`mode` text NOT NULL,
	`resolved` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
