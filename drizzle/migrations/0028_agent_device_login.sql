-- ブラウザで承認して、端末ごとに短命の通行証を受け取る仕組み。
--
-- 既存の agent_api_keys（長命の鍵）は残す。いきなり止めると手元が動かなくなる人が出るため、
-- 新しい方式へ移り終わってから画面で止める。ここでは表を足すだけで、既存の行は触らない。
--
-- 保存するのはハッシュだけ。合言葉（user_code）は短いので、期限を10分に切って使い捨てる。
CREATE TABLE `agent_device_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`user_code` text NOT NULL,
	`device_code_hash` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`approved_at` integer,
	`approved_by_id` text REFERENCES users(id),
	`company_id` text REFERENCES companies(id),
	`denied_at` integer,
	`session_id` text
);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_agent_device_grants_code` ON `agent_device_grants` (`user_code`);--> statement-breakpoint
CREATE INDEX `idx_agent_device_grants_hash` ON `agent_device_grants` (`device_code_hash`);--> statement-breakpoint
CREATE TABLE `agent_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`company_id` text REFERENCES companies(id),
	`scopes` text DEFAULT 'improvements:read' NOT NULL,
	`refresh_hash` text NOT NULL,
	`refresh_expires_at` integer NOT NULL,
	`access_hash` text,
	`access_expires_at` integer,
	`created_at` integer NOT NULL,
	`created_by_id` text REFERENCES users(id),
	`last_used_at` integer,
	`revoked_at` integer,
	`revoked_by_id` text REFERENCES users(id)
);--> statement-breakpoint
CREATE INDEX `idx_agent_sessions_access` ON `agent_sessions` (`access_hash`);--> statement-breakpoint
CREATE INDEX `idx_agent_sessions_refresh` ON `agent_sessions` (`refresh_hash`);
