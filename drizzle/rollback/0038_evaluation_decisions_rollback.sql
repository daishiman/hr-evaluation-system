-- 移行 0038（昇給と昇格への上司の判断の6列と、評価の索引）を戻す
--
-- 足した列はすべて NULL 可なので、0038 の前のコードは列が残っていても動く。
-- コードだけを戻すときは、このファイルを流さなくてよい（列を残すほうが、記録した判断を失わない）。
-- 列まで消すときだけ流す。消すと、上司が記録した判断と理由は戻らない。流す前に次で件数を確かめる。
--   SELECT COUNT(*) FROM evaluations WHERE raise_decision IS NOT NULL OR promotion_decision IS NOT NULL;
--
-- 本番の DB への書き込みなので、利用者の確認のあとに復旧の手順として流す（docs/deploy-notes.md）。
DROP INDEX IF EXISTS `idx_eval_company_employee_status`;
--> statement-breakpoint
ALTER TABLE `evaluations` DROP COLUMN `decision_recorded_at`;
--> statement-breakpoint
ALTER TABLE `evaluations` DROP COLUMN `decision_recorded_by`;
--> statement-breakpoint
ALTER TABLE `evaluations` DROP COLUMN `promotion_decision_reason`;
--> statement-breakpoint
ALTER TABLE `evaluations` DROP COLUMN `promotion_decision`;
--> statement-breakpoint
ALTER TABLE `evaluations` DROP COLUMN `raise_decision_reason`;
--> statement-breakpoint
ALTER TABLE `evaluations` DROP COLUMN `raise_decision`;
