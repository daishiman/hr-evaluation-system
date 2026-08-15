-- 改善要望を「そのまま実装に取りかかれる記録票」にするための追加。
--
-- 既存行は kind を 'usability'（使いにくい・直したい）として扱う。届いた当時に
-- 種類を聞いていないため、後から不具合へ言い換えると事実を書き換えることになる。
-- expected（どうなってほしいか）と diagnostics（自動で集めた技術情報）は
-- 当時取っていないので null のままにする。
ALTER TABLE `improvement_requests` ADD `kind` text DEFAULT 'usability' NOT NULL;
--> statement-breakpoint
ALTER TABLE `improvement_requests` ADD `expected` text;
--> statement-breakpoint
ALTER TABLE `improvement_requests` ADD `diagnostics` text;
--> statement-breakpoint
-- 記録票（GitHub Issue）を作った事実。要望1件につき最大1つ。
-- 本体と分けるのは、一覧で毎回引かないため、と「作っていない状態」を
-- null 列の組み合わせではなく行の有無で表すため。
CREATE TABLE `improvement_issue_links` (
	`request_id` text PRIMARY KEY NOT NULL,
	`repo` text NOT NULL,
	`issue_number` integer NOT NULL,
	`issue_url` text NOT NULL,
	`created_by_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `improvement_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
