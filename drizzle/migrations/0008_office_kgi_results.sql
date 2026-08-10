-- 事業所KGIの達成率を登録できるようにする（残課題 C1）。
--
-- 個人Pt（＝KPI評価点合計 × 事業所KGI達成係数）と賞与額を出す計算は
-- src/lib/domain/kgi.ts に入っていたが、達成率そのものを登録する場所が無く、
-- 個人Pt・賞与額がいつまでも null のままだった。
--
-- 達成率はアンケート73問の中に聞く設問が無く、元スプレッドシートでも別表から
-- 手で持ってきていた値のため、事業所 × 評価サイクルの実績値として人が登録する。
--
-- 登録していない事業所・サイクルは「行を作らない」。0% の行で埋めない——
-- 0% は「KGIをまったく達成できなかった」という別の意味になり、
-- 最小係数で賞与額が算出されてしまうため。未登録は null のまま
-- 「未登録のため算出できません」と理由を出す。
CREATE TABLE `office_kgi_results` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`office_id` text NOT NULL,
	`cycle_id` text NOT NULL,
	`achievement_rate` real NOT NULL,
	`note` text,
	`recorded_by_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`office_id`) REFERENCES `offices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cycle_id`) REFERENCES `evaluation_cycles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recorded_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_okr_office_cycle` ON `office_kgi_results` (`office_id`,`cycle_id`);--> statement-breakpoint
CREATE INDEX `idx_okr_company` ON `office_kgi_results` (`company_id`);--> statement-breakpoint
CREATE INDEX `idx_okr_cycle` ON `office_kgi_results` (`cycle_id`);--> statement-breakpoint

-- 達成率の変更履歴。賞与額の根拠になる数字なので、昇給額（raise_revisions）と
-- 同じ作法で「誰がいつ何％から何％に、なぜ変えたか」を1行ずつ残す。
CREATE TABLE `office_kgi_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`office_id` text NOT NULL,
	`cycle_id` text NOT NULL,
	`before_rate` real,
	`after_rate` real NOT NULL,
	`reason` text,
	`revised_by_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`office_id`) REFERENCES `offices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cycle_id`) REFERENCES `evaluation_cycles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`revised_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_okrev_company` ON `office_kgi_revisions` (`company_id`);--> statement-breakpoint
CREATE INDEX `idx_okrev_cycle` ON `office_kgi_revisions` (`cycle_id`);--> statement-breakpoint

-- 既存の評価に「どの事業所の評価か」を埋める。
-- 列（evaluations.office_id）は 0001 で足していたが、集計時に値を入れていなかった。
-- 達成率は事業所ごとに登録するため、これが空だとどの達成率を当てるか決められない。
--
-- 回答時点の所属（form_responses.office_id）を優先し、無ければ現在の所属（users.office_id）で埋める。
-- すでに値が入っている行（office_id IS NOT NULL）は触らない。
UPDATE `evaluations`
SET `office_id` = COALESCE(
	(SELECT r.`office_id` FROM `form_responses` r WHERE r.`id` = `evaluations`.`response_id`),
	(SELECT u.`office_id` FROM `users` u WHERE u.`id` = `evaluations`.`employee_id`)
)
WHERE `office_id` IS NULL;
