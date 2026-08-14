CREATE TABLE `improvement_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`reporter_id` text NOT NULL,
	`path` text NOT NULL,
	`screen_label` text NOT NULL,
	`body` text NOT NULL,
	`viewport` text,
	`user_agent` text,
	`status` text DEFAULT 'open' NOT NULL,
	`handled_by_id` text,
	`handled_note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`handled_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `ck_improvement_requests_status` CHECK (`status` IN ('open', 'doing', 'done', 'dropped'))
);
--> statement-breakpoint
CREATE INDEX `idx_ir_company` ON `improvement_requests` (`company_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_ir_status` ON `improvement_requests` (`company_id`,`status`);
--> statement-breakpoint
CREATE TABLE `improvement_shots` (
	`request_id` text PRIMARY KEY NOT NULL,
	`data_url` text NOT NULL,
	`bytes` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `improvement_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
