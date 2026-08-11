-- 行動指針の「基準セット」を会社ごとに作れるようにする（2026-08-11）
--
-- これまで基準セットは g1_2 / g3_4 の2つでコードに固定されており、呼び名も
-- 「等級1〜2の基準」「等級3〜4の基準」とコードに直書きだった。等級の呼び名
-- （等級１：Beginner …）や評価セットの等級区分（Beginner / Regular / Chief /
-- AM / Manager）と語が違うため、どの等級のことか毎回読み替えが要っていた。
--
-- 1) セットそのものを行として持ち、会社が追加・複製・改名できるようにする
-- 2) すでにある g1_2 / g3_4 は等級名にそろえた呼び名で移行する
--
-- code は移行後も変えない。等級の割り当て（grades.behavior_band）と観点
-- （behavior_guidelines.band）がこの文字列で結ばれているため、ここを書き換えると
-- 公開済みのアンケートを組み立て直したときに中身が変わってしまう。
-- 会社が変えるのは name のほうにする。
CREATE TABLE `behavior_band_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`display_order` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_bbs_company_code` ON `behavior_band_sets` (`company_id`,`code`);
--> statement-breakpoint
-- いま実際に使われているセットを、会社ごとにそのまま行にする。
-- 観点が1つも無いセット（等級にだけ割り当てが残っている場合）も拾わないと、
-- 画面から選べないセットが等級に残ったままになる。
INSERT INTO `behavior_band_sets` (`id`, `company_id`, `code`, `name`, `display_order`, `is_active`, `created_at`, `updated_at`)
SELECT
	'bbs_' || lower(hex(randomblob(10))),
	b.company_id,
	b.band,
	CASE b.band
		WHEN 'g1_2' THEN 'Beginner・Regular向け'
		WHEN 'g3_4' THEN 'Chief・AM向け'
		ELSE b.band
	END,
	CASE b.band WHEN 'g1_2' THEN 1 WHEN 'g3_4' THEN 2 ELSE 3 END,
	1,
	CAST(strftime('%s', 'now') AS INTEGER) * 1000,
	CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM (
	SELECT DISTINCT `company_id`, `band` FROM `behavior_guidelines`
	UNION
	SELECT DISTINCT `company_id`, `behavior_band` FROM `grades` WHERE `behavior_band` IS NOT NULL
) AS b;
