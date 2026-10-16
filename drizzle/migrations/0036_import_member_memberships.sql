-- 社員CSVの取り込みで作った人のうち、所属の行が無い人に所属の行を足す（S7・D-004 の取りこぼし・2026-10-15）
--
-- このファイルは手書きです（理由は 0009 の冒頭を参照）。
-- 0033 で所属の表（company_memberships）が会社ごとの値の正本になったが、社員CSVの取り込み（src/lib/import-members.ts）は
-- users だけを書いていた。0033 のあとに取り込みで作った人は所属の行を持たず、社員の一覧・評価の画面に出なかった。
-- 取り込みは所属の行を書くように直した。この移行は、直す前に作られた人の分を足す。
--
-- 足すのは次の全部に当てはまる人だけ（取り込みの記録で、取り込みが作った人と分かる人）。
--   - import_batches（kind = 'members'）の before_json に userId があり、before が null（その取り込みで新しく作った人）
--   - users の写しの会社（company_id）がその取り込みの会社で、役割が会社の役割（全体管理者でない）
--   - その会社の所属の行がまだ無い
-- 値は users の写しから取る（取り込みが書いた値そのもの）。id は 'mem_imp_' と利用者の id から作る。
--
-- 冪等に書く（INSERT OR IGNORE と「所属の行がまだ無い」の条件）。2回流しても2回目は0行になる。
-- json_each は before_json が JSON として読めるときだけ開く（壊れた1行で移行を止めない）。
--
-- 登録済みの人を取り込みで変えた分（役割・等級などが users の写しにだけ入り、所属の行に入っていない分）は、
-- この移行では直さない。どちらの値を正とするかは会社の確認が要るため。見分け方は docs/deploy-notes.md の
-- 「移行 0036」を参照。
--
-- 戻すときはアプリの版を戻す。足した行は取り込みが本来書くべきだった行なので、残したままでよい。
-- 行ごと消すときは DELETE FROM `company_memberships` WHERE `id` LIKE 'mem_imp_%';
-- （足したあとに画面で変えた値も消えるので、書き出してから）。
INSERT OR IGNORE INTO `company_memberships` (
	`id`, `user_id`, `company_id`, `role`, `grade_id`, `office_id`, `manager_id`,
	`employee_code`, `department`, `hired_at`, `profile_note`, `created_at`, `updated_at`
)
SELECT
	'mem_imp_' || `u`.`id`, `u`.`id`, `u`.`company_id`, `u`.`role`, `u`.`grade_id`, `u`.`office_id`, `u`.`manager_id`,
	`u`.`employee_code`, `u`.`department`, `u`.`hired_at`, `u`.`profile_note`, `u`.`created_at`, `u`.`updated_at`
FROM `users` `u`
WHERE `u`.`company_id` IS NOT NULL
	AND `u`.`role` IN ('EMPLOYEE', 'MANAGER', 'COMPANY_ADMIN')
	AND NOT EXISTS (
		SELECT 1 FROM `company_memberships` `m`
		WHERE `m`.`user_id` = `u`.`id` AND `m`.`company_id` = `u`.`company_id`)
	AND EXISTS (
		SELECT 1
		FROM `import_batches` `b`,
			json_each(CASE WHEN json_valid(`b`.`before_json`) THEN `b`.`before_json` ELSE '[]' END) `j`
		WHERE `b`.`kind` = 'members'
			AND `b`.`company_id` = `u`.`company_id`
			AND json_type(`j`.`value`, '$.before') = 'null'
			AND json_extract(`j`.`value`, '$.userId') = `u`.`id`);
