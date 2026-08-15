-- 鍵を複数本にし、払い出しを履歴として積む。
--
-- 1. 鍵に用途の名前を付ける（label）。名前が無いと、先頭数文字だけが並ぶ一覧になり、
--    どれを止めてよいか分からず、結局どれも止められなくなる。
-- 2. 払い出しを1回ごとに積む（improvement_handout_events）。これまでは
--    「最後の1回」しか残らず、何度渡し直したか・誰が渡したかが次で消えていた。
-- 3. サーバーの設定値の鍵を、画面から止められるようにする（agent_key_settings）。
--    画面の鍵を全部止めても設定値の鍵は残るため、「止めたのに受け取れる」が起きていた。
ALTER TABLE `agent_api_keys` ADD `label` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `improvement_handouts` ADD `handout_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- すでに払い出し済みのものは、少なくとも1回渡っている。0回のまま残すと
-- 「渡していないのに日時がある」行になるので、ここで1回として数え直す。
UPDATE `improvement_handouts` SET `handout_count` = 1 WHERE `handed_out_at` IS NOT NULL;
--> statement-breakpoint
CREATE TABLE `improvement_handout_events` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`via` text NOT NULL,
	`key_id` text,
	`key_label` text,
	`actor_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `improvement_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ihe_request` ON `improvement_handout_events` (`request_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `agent_key_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`env_key_enabled` integer DEFAULT true NOT NULL,
	`updated_at` integer,
	`updated_by_id` text,
	FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
