/* 制度マスタ イベントストア。
   既存の各マスタ表（grades / grade_requirements / … ）は現在状態のスナップショットのまま残す
   （既存の閲覧・編集画面、確定/再開フローの挙動を変えない）。
   ここから先の変更はすべて constitution_events に不変の行として積み、
   現在状態はイベントの再生結果と一致させる。
   このマイグレーションでは、導入時点で既存データにも「初期版が作られた」イベントを
   1件ずつ補って、イベント列を最初から途切れなく繋げる（バックフィル）。 */
CREATE TABLE `constitution_events` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`event_type` text NOT NULL,
	`actor_id` text,
	`before_json` text,
	`after_json` text,
	`seq` integer NOT NULL,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ce_entity` ON `constitution_events` (`company_id`,`entity_type`,`entity_id`,`seq`);
--> statement-breakpoint
CREATE INDEX `idx_ce_company_time` ON `constitution_events` (`company_id`,`occurred_at`);
--> statement-breakpoint

/* 過去版がある「等級要件・昇格要件」は、系譜の起点（previous_version_id が無い行）だけを
   backfill の対象にする。改版そのもの（previous_version_id あり）は次のマイグレーションでは
   バックフィルせず、今回の導入以後の変更としてアプリ側が新しいイベントを積む対象になる。
   ここでは「導入前からあった版」であることを event_type='created' で表す。 */
INSERT INTO constitution_events (id, company_id, entity_type, entity_id, event_type, actor_id, before_json, after_json, seq, occurred_at)
SELECT
  'cevt_' || lower(hex(randomblob(10))),
  company_id,
  'grade',
  id,
  'created',
  NULL,
  NULL,
  json_object('name', name, 'targetCap', target_cap, 'autonomyLevel', autonomy_level, 'responsibilityLevel', responsibility_level, 'deadlineNote', deadline_note, 'behaviorBand', behavior_band, 'isActive', is_active),
  1,
  created_at
FROM grades;
--> statement-breakpoint

INSERT INTO constitution_events (id, company_id, entity_type, entity_id, event_type, actor_id, before_json, after_json, seq, occurred_at)
SELECT
  'cevt_' || lower(hex(randomblob(10))),
  company_id,
  'gradeRequirement',
  id,
  CASE WHEN previous_version_id IS NULL THEN 'created' ELSE 'revised' END,
  NULL,
  NULL,
  json_object('gradeId', grade_id, 'category', category, 'seq', seq, 'text', text, 'isActive', is_active, 'previousVersionId', previous_version_id),
  1,
  created_at
FROM grade_requirements;
--> statement-breakpoint

INSERT INTO constitution_events (id, company_id, entity_type, entity_id, event_type, actor_id, before_json, after_json, seq, occurred_at)
SELECT
  'cevt_' || lower(hex(randomblob(10))),
  company_id,
  'promotionRequirement',
  id,
  CASE WHEN previous_version_id IS NULL THEN 'created' ELSE 'revised' END,
  NULL,
  NULL,
  json_object('gradeId', grade_id, 'kind', kind, 'transitionLabel', transition_label, 'seq', seq, 'text', text, 'isGate', is_gate, 'isActive', is_active, 'previousVersionId', previous_version_id),
  1,
  created_at
FROM promotion_requirements;
--> statement-breakpoint

INSERT INTO constitution_events (id, company_id, entity_type, entity_id, event_type, actor_id, before_json, after_json, seq, occurred_at)
SELECT
  'cevt_' || lower(hex(randomblob(10))),
  company_id,
  'behaviorBandSet',
  id,
  'created',
  NULL,
  NULL,
  json_object('code', code, 'name', name, 'displayOrder', display_order, 'isActive', is_active),
  1,
  created_at
FROM behavior_band_sets;
--> statement-breakpoint

INSERT INTO constitution_events (id, company_id, entity_type, entity_id, event_type, actor_id, before_json, after_json, seq, occurred_at)
SELECT
  'cevt_' || lower(hex(randomblob(10))),
  company_id,
  'behaviorGuideline',
  id,
  'created',
  NULL,
  NULL,
  json_object('band', band, 'aspect', aspect, 'aspectName', aspect_name, 'seq', seq, 'isActive', is_active),
  1,
  created_at
FROM behavior_guidelines;
--> statement-breakpoint

INSERT INTO constitution_events (id, company_id, entity_type, entity_id, event_type, actor_id, before_json, after_json, seq, occurred_at)
SELECT
  'cevt_' || lower(hex(randomblob(10))),
  company_id,
  'behaviorLevel',
  id,
  'created',
  NULL,
  NULL,
  json_object('guidelineId', guideline_id, 'score', score, 'label', label, 'text', text),
  1,
  created_at
FROM behavior_levels;
--> statement-breakpoint

INSERT INTO constitution_events (id, company_id, entity_type, entity_id, event_type, actor_id, before_json, after_json, seq, occurred_at)
SELECT
  'cevt_' || lower(hex(randomblob(10))),
  company_id,
  'promotionThreshold',
  id,
  'created',
  NULL,
  NULL,
  json_object('fromGradeId', from_grade_id, 'toGradeId', to_grade_id, 'label', label, 'requiredBehaviorPoints', required_behavior_points, 'requiredKpiPoints', required_kpi_points, 'isProvisional', is_provisional),
  1,
  created_at
FROM promotion_thresholds;
--> statement-breakpoint

INSERT INTO constitution_events (id, company_id, entity_type, entity_id, event_type, actor_id, before_json, after_json, seq, occurred_at)
SELECT
  'cevt_' || lower(hex(randomblob(10))),
  company_id,
  'raiseSetting',
  id,
  'created',
  NULL,
  NULL,
  json_object('gradeId', grade_id, 'monthlyAmount', monthly_amount, 'months', months, 'annualAmount', annual_amount, 'maxCount', max_count, 'note', note, 'isProvisional', is_provisional),
  1,
  created_at
FROM raise_settings;
--> statement-breakpoint

INSERT INTO constitution_events (id, company_id, entity_type, entity_id, event_type, actor_id, before_json, after_json, seq, occurred_at)
SELECT
  'cevt_' || lower(hex(randomblob(10))),
  company_id,
  'raisePolicy',
  id,
  'created',
  NULL,
  NULL,
  json_object('judgeUnit', judge_unit, 'chancesPerYear', chances_per_year, 'allowDecrease', allow_decrease, 'requiredACount', required_a_count, 'isProvisional', is_provisional),
  1,
  created_at
FROM raise_policies;
--> statement-breakpoint

INSERT INTO constitution_events (id, company_id, entity_type, entity_id, event_type, actor_id, before_json, after_json, seq, occurred_at)
SELECT
  'cevt_' || lower(hex(randomblob(10))),
  company_id,
  'office',
  id,
  'created',
  NULL,
  NULL,
  json_object('code', code, 'name', name, 'raiseAdjustRate', raise_adjust_rate, 'isActive', is_active),
  1,
  created_at
FROM offices;
--> statement-breakpoint

INSERT INTO constitution_events (id, company_id, entity_type, entity_id, event_type, actor_id, before_json, after_json, seq, occurred_at)
SELECT
  'cevt_' || lower(hex(randomblob(10))),
  company_id,
  'kpiRankCriteria',
  id,
  'created',
  NULL,
  NULL,
  json_object('kpiItemId', kpi_item_id, 'rank', rank, 'lowerBound', lower_bound, 'upperBound', upper_bound, 'displayLabel', display_label),
  1,
  created_at
FROM kpi_rank_criteria;
--> statement-breakpoint

INSERT INTO constitution_events (id, company_id, entity_type, entity_id, event_type, actor_id, before_json, after_json, seq, occurred_at)
SELECT
  'cevt_' || lower(hex(randomblob(10))),
  company_id,
  'kgiCoefficient',
  id,
  'created',
  NULL,
  NULL,
  json_object('label', label, 'lowerBound', lower_bound, 'upperBound', upper_bound, 'coefficient', coefficient, 'isProvisional', is_provisional),
  1,
  created_at
FROM kgi_coefficients;
