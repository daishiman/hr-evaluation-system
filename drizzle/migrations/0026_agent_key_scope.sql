-- 鍵に「どの会社の」「何をしてよいか」を焼き込み、書き戻しの記録に鍵を残す。
--
-- 1. agent_api_keys.company_id … 鍵を作った時点で会社を固定する。以後、その鍵では
--    他社の要望が1件も読めない。読む側の絞り込みに頼ると、要望IDを当てるだけで
--    他社の生の声が読めてしまう。
--    既存の鍵は NULL のままにする（会社が決まらない鍵＝読み取り専用として動かし続ける）。
--    いきなり全部止めると、いま配ってある鍵が全部使えなくなる。
-- 2. agent_api_keys.scopes … できることを2つに限る。既存の鍵は読み取りだけ。
--    会社が決まらない鍵に書き込みを許すと、どの会社の話として書くかが決まらない。
-- 3. improvement_status_events の key_id / key_label … 状態を変えたのが人ではなく
--    鍵だったときに、「どの鍵が・いつ・何を」変えたかを残す。ここが空だと、
--    あとから人が差し戻すときに、何を取り消すのかが読めない。
-- 4. release_ref … 「対応済み」にしたときの公開先。ここが空のまま対応済みには
--    させない（直っていないものが完了扱いで一覧から消えるのを防ぐ）。
ALTER TABLE `agent_api_keys` ADD `company_id` text REFERENCES companies(id);
--> statement-breakpoint
ALTER TABLE `agent_api_keys` ADD `scopes` text DEFAULT 'improvements:read' NOT NULL;
--> statement-breakpoint
CREATE INDEX `idx_agent_api_keys_company` ON `agent_api_keys` (`company_id`);
--> statement-breakpoint
ALTER TABLE `improvement_status_events` ADD `key_id` text;
--> statement-breakpoint
ALTER TABLE `improvement_status_events` ADD `key_label` text;
--> statement-breakpoint
ALTER TABLE `improvement_status_events` ADD `release_ref` text;
