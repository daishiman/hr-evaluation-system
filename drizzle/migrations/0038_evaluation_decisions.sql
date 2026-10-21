-- 昇給と昇格への上司の判断を、評価に残す（G24・I25・DD-024・2026-10-20）
--
-- このファイルは手書きです（理由は 0009 の冒頭を参照）。
-- 点数の判定（raise_eligible・promotion_eligible）はそのまま残し、上司の判断を別の列に足す。
-- 最終の可否は列に保存せず、表示のたびに src/lib/domain/final-decision.ts の finalDecision で出す。
--
--   raise_decision / promotion_decision   … 'follow'（判定どおり）か 'override'（変える）。NULL は記録なし
--   raise_decision_reason / promotion_decision_reason … 上司の理由。本人にも同じ文で見せる（DD-023）
--   decision_recorded_by / decision_recorded_at       … 最後に記録した人と時刻（前の判断の履歴は残さない）
--
-- 列はすべて NULL 可で足すだけ。既存の行は「記録なし」になり、確定済みの評価の値は変えない。
-- ALTER TABLE ADD COLUMN は2回流すと「列がもうある」で止まる（SQLite に IF NOT EXISTS が無い）。
-- wrangler d1 migrations apply は適用済みのファイルを流さないので、ふつうは2回流れない。
-- 索引は IF NOT EXISTS で足す。レポートが会社・社員・確定の別で評価を引くため（qa-y15 (11)）。
-- 戻すときは drizzle/rollback/0038_evaluation_decisions_rollback.sql を流す。
ALTER TABLE `evaluations` ADD `raise_decision` text CHECK (`raise_decision` IN ('follow', 'override'));
--> statement-breakpoint
ALTER TABLE `evaluations` ADD `raise_decision_reason` text;
--> statement-breakpoint
ALTER TABLE `evaluations` ADD `promotion_decision` text CHECK (`promotion_decision` IN ('follow', 'override'));
--> statement-breakpoint
ALTER TABLE `evaluations` ADD `promotion_decision_reason` text;
--> statement-breakpoint
ALTER TABLE `evaluations` ADD `decision_recorded_by` text REFERENCES `users`(`id`);
--> statement-breakpoint
ALTER TABLE `evaluations` ADD `decision_recorded_at` integer;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_eval_company_employee_status` ON `evaluations` (`company_id`, `employee_id`, `status`);
