-- 作業指示文を受け取るための鍵を、画面から発行できるようにする。
--
-- これまで鍵はサーバーの設定値（AGENT_API_KEY）にしか置けず、登録するには
-- ターミナルが要った。使い始めるだけのために開発環境を用意するのは無理があるので、
-- 画面から発行・作り直し・失効ができるようにする。
--
-- 生の鍵は保存しない。保存するのはハッシュ（SHA-256）と、見分けるための先頭数文字だけ。
-- 突き合わせもハッシュどうしで行う（→ src/lib/domain/agent-keys.ts）。
-- 行は消さない。失効させた鍵も残すことで、誰がいつ発行し誰がいつ止めたかが履歴になる。
CREATE TABLE `agent_api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_id` text,
	`last_used_at` integer,
	`revoked_at` integer,
	`revoked_by_id` text,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`revoked_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_agent_api_keys_hash` ON `agent_api_keys` (`key_hash`);
