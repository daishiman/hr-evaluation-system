-- 要望を「対応しない・重複・廃棄」で落とせるようにし、取り消せるようにする追加。
--
-- 廃棄は行を消さない。消すと取り違えた1件を戻せず、送ってくれた声が失われる。
-- 印（discarded_at）を立てて隠すだけにし、戻し先の状態は履歴から引く。
--
-- duplicate_of_id … 同じ内容の要望をまとめたときの統合先。自分自身は指せない。
-- discarded_at / discarded_by_id / discard_reason … 廃棄の印と、誰がなぜ捨てたか。
-- improvement_issue_links.issue_state … GitHub 側の開閉を取り込んだ時点の写し。
-- improvement_status_events … 状態を変えた記録。追記だけで、書き換えも削除もしない。
ALTER TABLE `improvement_requests` ADD `duplicate_of_id` text REFERENCES improvement_requests(id);
--> statement-breakpoint
ALTER TABLE `improvement_requests` ADD `discarded_at` integer;
--> statement-breakpoint
ALTER TABLE `improvement_requests` ADD `discarded_by_id` text REFERENCES users(id);
--> statement-breakpoint
ALTER TABLE `improvement_requests` ADD `discard_reason` text;
--> statement-breakpoint
ALTER TABLE `improvement_issue_links` ADD `issue_state` text DEFAULT 'open' NOT NULL;
--> statement-breakpoint
CREATE TABLE `improvement_status_events` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`action` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`reason_code` text,
	`reason` text,
	`actor_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `improvement_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ise_request` ON `improvement_status_events` (`request_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_ir_discarded` ON `improvement_requests` (`company_id`,`discarded_at`);
