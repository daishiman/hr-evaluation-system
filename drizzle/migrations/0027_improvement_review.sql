-- 「レビュー待ち」を表すための2列。
--
-- 対応状況（status）の値は増やさない。SQLite の CHECK に値を足すには
-- テーブルの作り直し（DROP TABLE を含む）が要り、本番データを持つ表に対して
-- 得るものと釣り合わない。廃棄・重複と同じく、状態の外の印として重ねる。
--
-- review_ref が入っていて対応中なら「レビュー待ち」。取り込まれて対応済みに
-- なったあとも review_ref は消さない（どの確認依頼で直ったかを後から読む）。
-- 既存の行はどちらも NULL で、これまでどおりの見え方のまま動く。
ALTER TABLE `improvement_requests` ADD `review_ref` text;--> statement-breakpoint
ALTER TABLE `improvement_requests` ADD `reviewed_at` integer;
