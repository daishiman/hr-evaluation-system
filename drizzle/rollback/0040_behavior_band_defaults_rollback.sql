-- 移行 0040（行動指針の割り当てを既定へ戻す）を戻す
--
-- behavior_band_default_rewrites に残した old_value を元の等級の行へ書き戻す。
-- 戻すのは「今の値が移行の書いた値（new_value）のままの行」だけ。移行のあとに会社が変えた割り当ては上書きしない。
-- 割り当ては NULL（出さない）を取るので、比べるのは IS / IS NOT（= は NULL で偽になる）。
-- 戻した行の updated_at は戻した時刻にする（設定を変えたことになるので。0040 と同じ理由）。
-- 戻したあとの一覧が要るときは、流す前に次の問い合わせで「戻らない行」（今の値が new_value と違う行）を確かめる。
--   SELECT * FROM behavior_band_default_rewrites WHERE migration = '0040_behavior_band_defaults';
-- 記録の表（behavior_band_default_rewrites）は消さない。戻したあとに 0040 をもう一度流しても、最初の値の記録は上書きされない。
-- 既定のまとまりを持たず書き換えなかった会社の行（table_name = 'companies'）は数えるための記録なので、戻す対象にない。
--
-- 本番の DB への書き込みなので、利用者の確認のあとに復旧の手順として流す（docs/deploy-notes.md の 15）。
UPDATE `grades` SET
	`behavior_band` = (
		SELECT `w`.`old_value` FROM `behavior_band_default_rewrites` `w`
		WHERE `w`.`table_name` = 'grades' AND `w`.`column_name` = 'behavior_band' AND `w`.`row_id` = `grades`.`id`),
	`updated_at` = CAST(strftime('%s', 'now') AS INTEGER) * 1000
WHERE EXISTS (
	SELECT 1 FROM `behavior_band_default_rewrites` `w`
	WHERE `w`.`table_name` = 'grades' AND `w`.`column_name` = 'behavior_band' AND `w`.`row_id` = `grades`.`id`
		AND `w`.`migration` = '0040_behavior_band_defaults'
		AND `w`.`new_value` IS `grades`.`behavior_band` AND `w`.`old_value` IS NOT `grades`.`behavior_band`);
