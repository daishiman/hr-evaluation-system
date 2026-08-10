-- 元の配点表（「KPI基準定義_配点」シート）の写しを置く場所。
-- 評価セットの項目を差し替えたときに「元はこの点数でした」と参考値を出すためだけに使う。
-- 評価の計算には使わない（計算に使うのは scheme_items / scheme_rank_ratios）。
CREATE TABLE `kpi_reference_points` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`kpi_item_id` text NOT NULL,
	`point_group` text NOT NULL,
	`rank` text NOT NULL,
	`points` real NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`kpi_item_id`) REFERENCES `kpi_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_krp_item_group_rank` ON `kpi_reference_points` (`kpi_item_id`,`point_group`,`rank`);--> statement-breakpoint
CREATE INDEX `idx_krp_company` ON `kpi_reference_points` (`company_id`);
