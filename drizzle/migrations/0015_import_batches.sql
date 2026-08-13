CREATE TABLE `import_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`kind` text NOT NULL,
	`subject_id` text NOT NULL,
	`actor_id` text,
	`source_hash` text NOT NULL,
	`row_count` integer NOT NULL,
	`before_json` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_import_batches_company_time` ON `import_batches` (`company_id`,`created_at`);
