ALTER TABLE `improvement_requests` ADD `route_pattern` text NOT NULL DEFAULT '';
--> statement-breakpoint
UPDATE `improvement_requests`
SET `route_pattern` = CASE
  WHEN `path` GLOB '/admin/forms/*/responses' THEN '/admin/forms/[id]/responses'
  WHEN `path` GLOB '/admin/scheme/*/criteria' THEN '/admin/scheme/[group]/criteria'
  WHEN `path` = '/admin/members/policy' THEN `path`
  WHEN `path` GLOB '/admin/forms/*' THEN '/admin/forms/[id]'
  WHEN `path` GLOB '/admin/improvements/*' THEN '/admin/improvements/[id]'
  WHEN `path` GLOB '/admin/members/*' THEN '/admin/members/[id]'
  WHEN `path` GLOB '/admin/scheme/*' THEN '/admin/scheme/[group]'
  WHEN `path` GLOB '/manager/evaluations/*' THEN '/manager/evaluations/[id]'
  WHEN `path` GLOB '/manager/members/*' THEN '/manager/members/[id]'
  WHEN `path` GLOB '/me/forms/*' THEN '/me/forms/[id]'
  WHEN `path` GLOB '/me/responses/*' THEN '/me/responses/[id]'
  WHEN `path` GLOB '/me/results/*' THEN '/me/results/[id]'
  WHEN `path` GLOB '/system/users/*' THEN '/system/users/[id]'
  WHEN `path` GLOB '/forms/*' THEN '/forms/[id]'
  WHEN `path` GLOB '/f/*' THEN '/f/[token]'
  ELSE `path`
END;
--> statement-breakpoint
ALTER TABLE `improvement_requests` ADD `submission_key` text;
--> statement-breakpoint
CREATE INDEX `idx_ir_route` ON `improvement_requests` (`company_id`,`route_pattern`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_ir_reporter_submission` ON `improvement_requests` (`company_id`,`reporter_id`,`submission_key`);
