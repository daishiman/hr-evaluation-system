-- 行動指針の段階（点数と文言）にも更新時刻を持たせる。
-- 「基準を変えたのに集計し直していない評価」を見つけるのに、
-- 判定に効くマスタは全部そろって更新時刻を持っている必要があるため。
-- 既存行は作成時刻で埋める（まだ一度も直していない、という意味になる）。
ALTER TABLE `behavior_levels` ADD `updated_at` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE `behavior_levels` SET `updated_at` = `created_at` WHERE `updated_at` = 0;
