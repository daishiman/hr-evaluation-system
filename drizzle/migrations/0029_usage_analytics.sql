CREATE TABLE `usage_screen_daily` (
	`key` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`company_id` text NOT NULL,
	`route_pattern` text NOT NULL,
	`role` text NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`dwell_ms` integer DEFAULT 0 NOT NULL,
	`dwell_samples` integer DEFAULT 0 NOT NULL,
	`long_stays` integer DEFAULT 0 NOT NULL,
	`backtracks` integer DEFAULT 0 NOT NULL,
	`rage_clicks` integer DEFAULT 0 NOT NULL,
	`abandons` integer DEFAULT 0 NOT NULL,
	`errors` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_usage_screen_date` ON `usage_screen_daily` (`date`);--> statement-breakpoint
CREATE INDEX `idx_usage_screen_company` ON `usage_screen_daily` (`company_id`,`date`);--> statement-breakpoint
CREATE TABLE `usage_api_daily` (
	`key` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`company_id` text NOT NULL,
	`method` text NOT NULL,
	`route_pattern` text NOT NULL,
	`calls` integer DEFAULT 0 NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`errors` integer DEFAULT 0 NOT NULL,
	`slow_calls` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_usage_api_date` ON `usage_api_daily` (`date`);--> statement-breakpoint
CREATE INDEX `idx_usage_api_company` ON `usage_api_daily` (`company_id`,`date`);
