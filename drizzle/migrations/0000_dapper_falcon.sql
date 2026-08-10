CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_accounts_user` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `behavior_guidelines` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`band` text NOT NULL,
	`aspect` text NOT NULL,
	`aspect_name` text NOT NULL,
	`seq` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_bg_company_band_aspect` ON `behavior_guidelines` (`company_id`,`band`,`aspect`);--> statement-breakpoint
CREATE TABLE `behavior_levels` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`guideline_id` text NOT NULL,
	`score` integer NOT NULL,
	`label` text NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`guideline_id`) REFERENCES `behavior_guidelines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_blv_guideline` ON `behavior_levels` (`guideline_id`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`business_type` text DEFAULT '給付事業' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companies_slug_unique` ON `companies` (`slug`);--> statement-breakpoint
CREATE TABLE `employee_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`author_id` text NOT NULL,
	`cycle_id` text,
	`body` text NOT NULL,
	`visibility` text DEFAULT 'manager' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cycle_id`) REFERENCES `evaluation_cycles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_en_employee` ON `employee_notes` (`employee_id`);--> statement-breakpoint
CREATE TABLE `evaluation_behaviors` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`evaluation_id` text NOT NULL,
	`guideline_id` text,
	`aspect` text NOT NULL,
	`aspect_name` text NOT NULL,
	`score` real NOT NULL,
	`level_label` text,
	`comment` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`evaluation_id`) REFERENCES `evaluations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`guideline_id`) REFERENCES `behavior_guidelines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_eb_eval` ON `evaluation_behaviors` (`evaluation_id`);--> statement-breakpoint
CREATE TABLE `evaluation_cycles` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`scheme_id` text,
	`status` text DEFAULT 'planning' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scheme_id`) REFERENCES `evaluation_schemes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_cycle_company` ON `evaluation_cycles` (`company_id`);--> statement-breakpoint
CREATE TABLE `evaluation_gates` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`evaluation_id` text NOT NULL,
	`promotion_requirement_id` text,
	`kind` text NOT NULL,
	`text` text NOT NULL,
	`achieved` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`evaluation_id`) REFERENCES `evaluations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`promotion_requirement_id`) REFERENCES `promotion_requirements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_eg_eval` ON `evaluation_gates` (`evaluation_id`);--> statement-breakpoint
CREATE TABLE `evaluation_items` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`evaluation_id` text NOT NULL,
	`kpi_item_id` text NOT NULL,
	`category_id` text,
	`item_name` text NOT NULL,
	`category_name` text,
	`unit` text,
	`direction` text,
	`numerator` real,
	`denominator` real,
	`actual_value` real,
	`override_value` real,
	`override_reason` text,
	`rank` text,
	`points` real DEFAULT 0 NOT NULL,
	`max_points` real DEFAULT 0 NOT NULL,
	`threshold_label` text,
	`threshold_lower` real,
	`threshold_upper` real,
	`rationale` text,
	`calc_note` text,
	`is_provisional` integer DEFAULT false NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`evaluation_id`) REFERENCES `evaluations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`kpi_item_id`) REFERENCES `kpi_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `kpi_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ei_eval` ON `evaluation_items` (`evaluation_id`);--> statement-breakpoint
CREATE TABLE `evaluation_requirements` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`evaluation_id` text NOT NULL,
	`grade_requirement_id` text,
	`category` text NOT NULL,
	`text` text NOT NULL,
	`achieved` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`evaluation_id`) REFERENCES `evaluations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`grade_requirement_id`) REFERENCES `grade_requirements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_er_eval` ON `evaluation_requirements` (`evaluation_id`);--> statement-breakpoint
CREATE TABLE `evaluation_schemes` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`effective_from` text,
	`effective_to` text,
	`total_points` integer DEFAULT 100 NOT NULL,
	`raise_requires_all_a` integer DEFAULT true NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_scheme_company` ON `evaluation_schemes` (`company_id`);--> statement-breakpoint
CREATE TABLE `evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`cycle_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`grade_id` text NOT NULL,
	`response_id` text,
	`scheme_id` text NOT NULL,
	`total_score` real DEFAULT 0 NOT NULL,
	`max_score` real DEFAULT 100 NOT NULL,
	`requirement_rate` real,
	`requirement_achieved` integer DEFAULT 0,
	`requirement_total` integer DEFAULT 0,
	`behavior_total` real,
	`raise_eligible` integer DEFAULT false NOT NULL,
	`promotion_eligible` integer DEFAULT false NOT NULL,
	`promotion_blocked_reason` text,
	`required_kpi_points_snapshot` real,
	`required_behavior_points_snapshot` real,
	`evaluator_id` text,
	`evaluator_comment` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`finalized_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cycle_id`) REFERENCES `evaluation_cycles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`grade_id`) REFERENCES `grades`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`response_id`) REFERENCES `form_responses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scheme_id`) REFERENCES `evaluation_schemes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`evaluator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_eval_cycle_employee` ON `evaluations` (`cycle_id`,`employee_id`);--> statement-breakpoint
CREATE INDEX `idx_eval_company` ON `evaluations` (`company_id`);--> statement-breakpoint
CREATE INDEX `idx_eval_employee` ON `evaluations` (`employee_id`);--> statement-breakpoint
CREATE TABLE `form_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`response_id` text NOT NULL,
	`question_id` text NOT NULL,
	`value_number` real,
	`value_text` text,
	`value_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`response_id`) REFERENCES `form_responses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `form_questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_fa_response_question` ON `form_answers` (`response_id`,`question_id`);--> statement-breakpoint
CREATE TABLE `form_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`form_id` text NOT NULL,
	`section` text NOT NULL,
	`question_type` text NOT NULL,
	`title` text NOT NULL,
	`help_text` text,
	`unit` text,
	`required` integer DEFAULT true NOT NULL,
	`validation_min` real,
	`validation_max` real,
	`options_json` text,
	`display_order` integer NOT NULL,
	`grade_requirement_id` text,
	`promotion_requirement_id` text,
	`behavior_guideline_id` text,
	`kpi_item_id` text,
	`kpi_question_key` text,
	`is_gate` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`form_id`) REFERENCES `forms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`grade_requirement_id`) REFERENCES `grade_requirements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`promotion_requirement_id`) REFERENCES `promotion_requirements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`behavior_guideline_id`) REFERENCES `behavior_guidelines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`kpi_item_id`) REFERENCES `kpi_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_fq_form` ON `form_questions` (`form_id`);--> statement-breakpoint
CREATE TABLE `form_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`form_id` text NOT NULL,
	`cycle_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`grade_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`submitted_at` integer,
	`respondent_note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`form_id`) REFERENCES `forms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cycle_id`) REFERENCES `evaluation_cycles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`grade_id`) REFERENCES `grades`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_fr_form_employee` ON `form_responses` (`form_id`,`employee_id`);--> statement-breakpoint
CREATE INDEX `idx_fr_company` ON `form_responses` (`company_id`);--> statement-breakpoint
CREATE INDEX `idx_fr_employee` ON `form_responses` (`employee_id`);--> statement-breakpoint
CREATE TABLE `forms` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`grade_id` text NOT NULL,
	`cycle_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`public_token` text NOT NULL,
	`opens_at` text,
	`closes_at` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`grade_id`) REFERENCES `grades`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cycle_id`) REFERENCES `evaluation_cycles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `forms_public_token_unique` ON `forms` (`public_token`);--> statement-breakpoint
CREATE INDEX `idx_forms_company` ON `forms` (`company_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_forms_cycle_grade_ver` ON `forms` (`cycle_id`,`grade_id`,`version`);--> statement-breakpoint
CREATE TABLE `grade_requirements` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`grade_id` text NOT NULL,
	`category` text NOT NULL,
	`seq` integer NOT NULL,
	`text` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`grade_id`) REFERENCES `grades`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_greq_grade` ON `grade_requirements` (`grade_id`);--> statement-breakpoint
CREATE INDEX `idx_greq_company` ON `grade_requirements` (`company_id`);--> statement-breakpoint
CREATE TABLE `grades` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`point_group` text NOT NULL,
	`display_order` integer NOT NULL,
	`target_cap` integer DEFAULT 5 NOT NULL,
	`autonomy_level` text,
	`responsibility_level` text,
	`deadline_note` text,
	`behavior_band` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_grades_company_code` ON `grades` (`company_id`,`code`);--> statement-breakpoint
CREATE TABLE `kgi_coefficients` (
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
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_kgi_company` ON `kgi_coefficients` (`company_id`);--> statement-breakpoint
CREATE TABLE `kpi_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`display_order` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_kpicat_company_code` ON `kpi_categories` (`company_id`,`code`);--> statement-breakpoint
CREATE TABLE `kpi_items` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`no` integer NOT NULL,
	`name` text NOT NULL,
	`category_id` text,
	`measure_type` text NOT NULL,
	`unit` text NOT NULL,
	`direction` text DEFAULT 'higher' NOT NULL,
	`formula` text,
	`formula_note` text,
	`intent` text,
	`data_source` text,
	`judge_timing` text,
	`a_type` text,
	`a_standard` text,
	`controllability` text,
	`a_rationale` text,
	`remarks` text,
	`is_fixed_slot` integer DEFAULT false NOT NULL,
	`is_provisional` integer DEFAULT false NOT NULL,
	`provisional_note` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `kpi_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_kpiitem_company_no` ON `kpi_items` (`company_id`,`no`);--> statement-breakpoint
CREATE INDEX `idx_kpiitem_cat` ON `kpi_items` (`category_id`);--> statement-breakpoint
CREATE TABLE `kpi_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`kpi_item_id` text,
	`question_key` text NOT NULL,
	`text` text NOT NULL,
	`input_type` text DEFAULT 'number' NOT NULL,
	`unit` text,
	`required` integer DEFAULT true NOT NULL,
	`validation` text,
	`role` text NOT NULL,
	`target_grades` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`kpi_item_id`) REFERENCES `kpi_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_kpiq_company_key` ON `kpi_questions` (`company_id`,`question_key`);--> statement-breakpoint
CREATE TABLE `kpi_rank_criteria` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`kpi_item_id` text NOT NULL,
	`rank` text NOT NULL,
	`display_label` text NOT NULL,
	`lower_bound` real,
	`upper_bound` real,
	`boundary_expr` text,
	`meaning` text,
	`target_grades` text,
	`is_provisional` integer DEFAULT false NOT NULL,
	`provisional_note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`kpi_item_id`) REFERENCES `kpi_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_krc_item_rank` ON `kpi_rank_criteria` (`kpi_item_id`,`rank`);--> statement-breakpoint
CREATE TABLE `promotion_requirements` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`grade_id` text NOT NULL,
	`kind` text NOT NULL,
	`transition_label` text,
	`seq` integer NOT NULL,
	`text` text NOT NULL,
	`is_gate` integer DEFAULT true NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`grade_id`) REFERENCES `grades`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_promreq_grade` ON `promotion_requirements` (`grade_id`);--> statement-breakpoint
CREATE TABLE `promotion_thresholds` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`from_grade_id` text NOT NULL,
	`to_grade_id` text NOT NULL,
	`label` text NOT NULL,
	`required_behavior_points` integer NOT NULL,
	`required_kpi_points` integer DEFAULT 100 NOT NULL,
	`is_provisional` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_grade_id`) REFERENCES `grades`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_grade_id`) REFERENCES `grades`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_pth_company` ON `promotion_thresholds` (`company_id`);--> statement-breakpoint
CREATE TABLE `raise_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`grade_id` text NOT NULL,
	`monthly_amount` integer DEFAULT 0 NOT NULL,
	`months` integer DEFAULT 6 NOT NULL,
	`annual_amount` integer DEFAULT 0 NOT NULL,
	`note` text,
	`is_provisional` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`grade_id`) REFERENCES `grades`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_raise_company_grade` ON `raise_settings` (`company_id`,`grade_id`);--> statement-breakpoint
CREATE TABLE `scheme_items` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`scheme_id` text NOT NULL,
	`kpi_item_id` text NOT NULL,
	`category_id` text,
	`weight` integer NOT NULL,
	`is_fixed_slot` integer DEFAULT false NOT NULL,
	`display_order` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scheme_id`) REFERENCES `evaluation_schemes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`kpi_item_id`) REFERENCES `kpi_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `kpi_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_si_scheme_item` ON `scheme_items` (`scheme_id`,`kpi_item_id`);--> statement-breakpoint
CREATE INDEX `idx_si_scheme` ON `scheme_items` (`scheme_id`);--> statement-breakpoint
CREATE TABLE `scheme_rank_ratios` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`scheme_id` text NOT NULL,
	`rank` text NOT NULL,
	`ratio` real NOT NULL,
	`is_provisional` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scheme_id`) REFERENCES `evaluation_schemes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_srr_scheme_rank` ON `scheme_rank_ratios` (`scheme_id`,`rank`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`company_id` text,
	`role` text DEFAULT 'EMPLOYEE' NOT NULL,
	`grade_id` text,
	`manager_id` text,
	`employee_code` text,
	`department` text,
	`hired_at` text,
	`profile_note` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_company` ON `users` (`company_id`);--> statement-breakpoint
CREATE INDEX `idx_users_manager` ON `users` (`manager_id`);--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
