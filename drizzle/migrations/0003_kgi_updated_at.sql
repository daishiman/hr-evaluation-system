-- 事業所KGI達成係数（賞与の計算に使う係数）にも更新時刻を持たせる。
-- 判定に効くマスタがそろって更新時刻を持っていないと、
-- 「基準を変えたのに集計し直していない評価」を取りこぼすため。
-- 既存行は作成時刻で埋める（まだ一度も直していない、という意味になる）。
ALTER TABLE `kgi_coefficients` ADD `updated_at` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE `kgi_coefficients` SET `updated_at` = `created_at` WHERE `updated_at` = 0;
