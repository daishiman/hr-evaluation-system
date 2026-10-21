-- 事業所KGIの表と、評価に残していたKGIの2列を消す（G17・DD-024・2026-10-20）
--
-- このファイルは手書きです（理由は 0009 の冒頭を参照）。
-- 0038 と同じデプロイに入れない。deploy.yml は移行をコードの公開より先に流すので、
-- KGI を読む前のコードが動いている間に表が消え、画面が落ちる。
-- KGI を読まないコード（0038 と同じデプロイ）が本番で動いていることを確かめてから、次のデプロイで流す（docs/deploy-notes.md）。
--
-- 手で流さない。main へのマージで Deploy workflow が、本番の D1 を書き出して Artifact（d1-backup-<実行 id>。保管14日）に
-- 残してから流す（DD-020 の7）。消した表の行と2列の値は、この書き出しからしか戻せない。
-- 賞与の個人Ptと賞与額（personal_points・bonus_yen・bonus_rationale）は残す。確定済みの評価の値は変えない。
-- constitution_events に残る entity_type='kgiCoefficient' の行は、制度の変更の履歴なので消さない。
-- 戻すときは DB だけを戻す（drizzle/rollback/0039_drop_office_kgi_rollback.sql。表と列の形だけが戻り、値は戻らない）。
-- このファイルが入った後は、0038 の PR を revert せず、wrangler rollback でもその前の版へ戻さない（DD-020 の9）。
DROP TABLE IF EXISTS `office_kgi_revisions`;
--> statement-breakpoint
DROP TABLE IF EXISTS `office_kgi_results`;
--> statement-breakpoint
DROP TABLE IF EXISTS `kgi_coefficients`;
--> statement-breakpoint
ALTER TABLE `evaluations` DROP COLUMN `kgi_coefficient`;
--> statement-breakpoint
ALTER TABLE `evaluations` DROP COLUMN `office_achievement_rate`;
