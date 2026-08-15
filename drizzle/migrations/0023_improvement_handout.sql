-- 要望の渡し先を、GitHub の記録票から「Claude Code への作業指示文」へ変える。
--
-- これまでは要望1件ごとに社外（GitHub）の Issue を立て、その番号と URL を
-- improvement_issue_links に控えていた。今後は外へ出さず、認証付きの読み取り API
-- から指示文を払い出す。だから控えるのは「いつ・誰が払い出したか」と
-- 「そのとき渡した内容の指紋」だけでよい。番号・URL・リポジトリ名は要らなくなる。
--
-- 指紋（content_fingerprint）の意味は変えない。払い出したあとに内容が変わったかを
-- 更新日時ではなく指紋で見る、という判断はそのまま引き継ぐ。
-- 形は src/lib/domain/improvement-handout.ts が正本。
--
-- 既存行は捨てずに移す。すでに GitHub へ出した要望は「払い出し済み」に相当するので、
-- synced_at を handed_out_at、created_by_id を handed_out_by_id として引き継ぐ。
CREATE TABLE `improvement_handouts` (
	`request_id` text PRIMARY KEY NOT NULL,
	`content_fingerprint` text DEFAULT '' NOT NULL,
	`handed_out_at` integer,
	`handed_out_by_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `improvement_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`handed_out_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `improvement_handouts` (`request_id`, `content_fingerprint`, `handed_out_at`, `handed_out_by_id`, `created_at`)
SELECT `request_id`, `content_fingerprint`, COALESCE(`synced_at`, `created_at`), `created_by_id`, `created_at`
FROM `improvement_issue_links`;
--> statement-breakpoint
DROP TABLE `improvement_issue_links`;
