-- 記録票（GitHub Issue）を作ったあとも、アプリ側の変化を同じ記録票へ反映するための追加。
--
-- content_fingerprint … 最後に GitHub へ渡した時点の内容の指紋。
--   既存行は指紋を持たないので空文字にする。空は「比べられない」の意味で、
--   「変更あり」とは扱わない。当時の内容が残っていないのに変更ありとすると、
--   何も変わっていない記録票にコメントが積まれるため。
-- synced_at … 最後に反映できた時刻。既存行は作成時刻を入れる（そのとき渡している）。
-- link_state … ok | missing。missing は「番号は控えているが GitHub 側に無い」。
ALTER TABLE `improvement_issue_links` ADD `content_fingerprint` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `improvement_issue_links` ADD `synced_at` integer;
--> statement-breakpoint
ALTER TABLE `improvement_issue_links` ADD `link_state` text DEFAULT 'ok' NOT NULL;
--> statement-breakpoint
UPDATE `improvement_issue_links` SET `synced_at` = `created_at` WHERE `synced_at` IS NULL;
