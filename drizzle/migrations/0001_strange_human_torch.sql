CREATE TABLE `offices` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`raise_adjust_rate` real DEFAULT 1 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_offices_company_code` ON `offices` (`company_id`,`code`);--> statement-breakpoint
CREATE TABLE `raise_exceptions` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`seq` integer NOT NULL,
	`case_text` text NOT NULL,
	`handling` text NOT NULL,
	`excludes_judgement` integer DEFAULT false NOT NULL,
	`is_provisional` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_rexc_company` ON `raise_exceptions` (`company_id`);--> statement-breakpoint
CREATE TABLE `raise_patterns` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`seq` integer NOT NULL,
	`pattern` text NOT NULL,
	`judgment` text NOT NULL,
	`treatment` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_rpat_company` ON `raise_patterns` (`company_id`);--> statement-breakpoint
CREATE TABLE `raise_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`judge_unit` text DEFAULT '半期' NOT NULL,
	`judge_timing_note` text,
	`reflect_upper_note` text,
	`reflect_lower_note` text,
	`raise_form` text,
	`target_note` text,
	`allow_decrease` integer DEFAULT false NOT NULL,
	`chances_per_year` integer DEFAULT 2 NOT NULL,
	`selected_item_count` integer DEFAULT 8 NOT NULL,
	`required_a_count` integer DEFAULT 8 NOT NULL,
	`streak_enabled` integer DEFAULT false NOT NULL,
	`streak2_multiplier` real DEFAULT 1.5 NOT NULL,
	`streak3_multiplier` real DEFAULT 2 NOT NULL,
	`streak_max_multiplier` real DEFAULT 2 NOT NULL,
	`rounding_unit` integer DEFAULT 100 NOT NULL,
	`bonus_yen_per_point` integer DEFAULT 0 NOT NULL,
	`bonus_pool_yen` integer DEFAULT 0 NOT NULL,
	`note` text,
	`is_provisional` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `raise_policies_company_id_unique` ON `raise_policies` (`company_id`);--> statement-breakpoint
CREATE TABLE `raise_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`grade_id` text NOT NULL,
	`before_amount` integer,
	`after_amount` integer NOT NULL,
	`effective_from` text,
	`reason` text,
	`revised_by_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`grade_id`) REFERENCES `grades`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`revised_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_rrev_company` ON `raise_revisions` (`company_id`);--> statement-breakpoint
CREATE INDEX `idx_rrev_grade` ON `raise_revisions` (`grade_id`);--> statement-breakpoint
ALTER TABLE `companies` ADD `is_template` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `template_source_id` text;--> statement-breakpoint
ALTER TABLE `evaluations` ADD `office_id` text;--> statement-breakpoint
ALTER TABLE `evaluations` ADD `computed_at` integer;--> statement-breakpoint
ALTER TABLE `form_responses` ADD `office_id` text;--> statement-breakpoint
ALTER TABLE `form_responses` ADD `import_source` text;--> statement-breakpoint
ALTER TABLE `raise_settings` ADD `max_count` integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE `raise_settings` ADD `cap_note` text;--> statement-breakpoint
ALTER TABLE `users` ADD `office_id` text;