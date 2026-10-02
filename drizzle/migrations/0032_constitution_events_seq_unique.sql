-- 制度マスタの監査記録で、同じ実体の seq を重ねない（2026-10-01）
--
-- このファイルは手書きです（理由は 0009 の冒頭を参照）。
-- seq は「その実体の最新値 + 1」で採番する。同じ実体を2人が同時に保存すると、
-- 2件とも同じ番号を取りうる。本体と記録は同じ D1 batch で書いているので、
-- 一意索引にすれば後から書いたほうの batch が本体の変更ごと失敗する
-- （番号の重なりも、本体だけ変わって記録が欠けることも残らない）。
--
-- 索引を張る前に、既にある重なりを解く。同じ実体の中で (seq, occurred_at, id) の順に
-- 1 から振り直す。並び順は変えない。振り直しが要らない行は書き換えない。
UPDATE `constitution_events`
SET `seq` = `renumbered`.`rn`
FROM (
	SELECT `id`, ROW_NUMBER() OVER (
		PARTITION BY `company_id`, `entity_type`, `entity_id`
		ORDER BY `seq`, `occurred_at`, `id`
	) AS `rn`
	FROM `constitution_events`
) AS `renumbered`
WHERE `renumbered`.`id` = `constitution_events`.`id`
	AND `constitution_events`.`seq` <> `renumbered`.`rn`;
--> statement-breakpoint
DROP INDEX `idx_ce_entity`;
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_ce_entity_seq` ON `constitution_events` (`company_id`,`entity_type`,`entity_id`,`seq`);
