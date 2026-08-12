ALTER TABLE `grade_requirements` ADD `previous_version_id` text REFERENCES grade_requirements(id);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_greq_previous_version` ON `grade_requirements` (`previous_version_id`) WHERE `previous_version_id` IS NOT NULL;
--> statement-breakpoint
ALTER TABLE `promotion_requirements` ADD `previous_version_id` text REFERENCES promotion_requirements(id);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_promreq_previous_version` ON `promotion_requirements` (`previous_version_id`) WHERE `previous_version_id` IS NOT NULL;
--> statement-breakpoint

/* 本文の意味を同じIDのまま変えない。利用状態と順番だけは現在版を更新してよい。 */
CREATE TRIGGER `trg_greq_semantic_immutable`
BEFORE UPDATE OF `company_id`, `grade_id`, `category`, `text`, `previous_version_id` ON `grade_requirements`
WHEN NEW.`company_id` IS NOT OLD.`company_id`
  OR NEW.`grade_id` IS NOT OLD.`grade_id`
  OR NEW.`category` IS NOT OLD.`category`
  OR NEW.`text` IS NOT OLD.`text`
  OR NEW.`previous_version_id` IS NOT OLD.`previous_version_id`
BEGIN
  SELECT RAISE(ABORT, 'grade_requirement_semantic_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_promreq_semantic_immutable`
BEFORE UPDATE OF `company_id`, `grade_id`, `kind`, `text`, `transition_label`, `is_gate`, `previous_version_id` ON `promotion_requirements`
WHEN NEW.`company_id` IS NOT OLD.`company_id`
  OR NEW.`grade_id` IS NOT OLD.`grade_id`
  OR NEW.`kind` IS NOT OLD.`kind`
  OR NEW.`text` IS NOT OLD.`text`
  OR NEW.`transition_label` IS NOT OLD.`transition_label`
  OR NEW.`is_gate` IS NOT OLD.`is_gate`
  OR NEW.`previous_version_id` IS NOT OLD.`previous_version_id`
BEGIN
  SELECT RAISE(ABORT, 'promotion_requirement_semantic_immutable');
END;
--> statement-breakpoint

/* 後続版ができた瞬間から旧行は全カラム不変。当時の利用状態・順番も履歴に含む。 */
CREATE TRIGGER `trg_greq_past_version_immutable`
BEFORE UPDATE ON `grade_requirements`
WHEN EXISTS (SELECT 1 FROM `grade_requirements` AS next WHERE next.`previous_version_id` = OLD.`id`)
BEGIN
  SELECT RAISE(ABORT, 'grade_requirement_past_version_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_promreq_past_version_immutable`
BEFORE UPDATE ON `promotion_requirements`
WHEN EXISTS (SELECT 1 FROM `promotion_requirements` AS next WHERE next.`previous_version_id` = OLD.`id`)
BEGIN
  SELECT RAISE(ABORT, 'promotion_requirement_past_version_immutable');
END;
--> statement-breakpoint

/* 新版は同じ会社・等級・区分・順番の、使用中の現在版だけを置き換える。 */
CREATE TRIGGER `trg_greq_version_scope`
BEFORE INSERT ON `grade_requirements`
WHEN NEW.`previous_version_id` IS NOT NULL AND (
  NEW.`is_active` <> 1 OR NOT EXISTS (
    SELECT 1 FROM `grade_requirements` AS previous
    WHERE previous.`id` = NEW.`previous_version_id`
      AND previous.`company_id` = NEW.`company_id`
      AND previous.`grade_id` = NEW.`grade_id`
      AND previous.`category` = NEW.`category`
      AND previous.`seq` = NEW.`seq`
      AND previous.`is_active` = 1
  )
)
BEGIN
  SELECT RAISE(ABORT, 'grade_requirement_version_scope');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_promreq_version_scope`
BEFORE INSERT ON `promotion_requirements`
WHEN NEW.`previous_version_id` IS NOT NULL AND (
  NEW.`is_active` <> 1 OR NOT EXISTS (
    SELECT 1 FROM `promotion_requirements` AS previous
    WHERE previous.`id` = NEW.`previous_version_id`
      AND previous.`company_id` = NEW.`company_id`
      AND previous.`grade_id` = NEW.`grade_id`
      AND previous.`kind` = NEW.`kind`
      AND previous.`seq` = NEW.`seq`
      AND previous.`is_active` = 1
  )
)
BEGIN
  SELECT RAISE(ABORT, 'promotion_requirement_version_scope');
END;
--> statement-breakpoint

/* 後続版がある過去版は復活させない。過去文面への復帰も新しい版を作る。 */
CREATE TRIGGER `trg_greq_past_version_active`
BEFORE UPDATE OF `is_active` ON `grade_requirements`
WHEN NEW.`is_active` = 1 AND OLD.`is_active` <> 1
  AND EXISTS (SELECT 1 FROM `grade_requirements` AS next WHERE next.`previous_version_id` = OLD.`id`)
BEGIN
  SELECT RAISE(ABORT, 'grade_requirement_past_version_active');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_promreq_past_version_active`
BEFORE UPDATE OF `is_active` ON `promotion_requirements`
WHEN NEW.`is_active` = 1 AND OLD.`is_active` <> 1
  AND EXISTS (SELECT 1 FROM `promotion_requirements` AS next WHERE next.`previous_version_id` = OLD.`id`)
BEGIN
  SELECT RAISE(ABORT, 'promotion_requirement_past_version_active');
END;
--> statement-breakpoint

/* 支援・運営は各10件まで。改版INSERTは置換元を数えず、10件時にも成功させる。 */
CREATE TRIGGER `trg_greq_active_limit_insert`
BEFORE INSERT ON `grade_requirements`
WHEN NEW.`is_active` = 1 AND (
  SELECT COUNT(*) FROM `grade_requirements` AS current
  WHERE current.`company_id` = NEW.`company_id`
    AND current.`grade_id` = NEW.`grade_id`
    AND current.`category` = NEW.`category`
    AND current.`is_active` = 1
    AND current.`id` <> COALESCE(NEW.`previous_version_id`, '')
    AND NOT EXISTS (
      SELECT 1 FROM `grade_requirements` AS next
      WHERE next.`previous_version_id` = current.`id`
    )
) >= 10
BEGIN
  SELECT RAISE(ABORT, 'grade_requirement_active_limit');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_greq_active_limit_update`
BEFORE UPDATE OF `is_active` ON `grade_requirements`
WHEN NEW.`is_active` = 1 AND OLD.`is_active` <> 1 AND (
  SELECT COUNT(*) FROM `grade_requirements` AS current
  WHERE current.`company_id` = NEW.`company_id`
    AND current.`grade_id` = NEW.`grade_id`
    AND current.`category` = NEW.`category`
    AND current.`is_active` = 1
    AND current.`id` <> OLD.`id`
    AND NOT EXISTS (
      SELECT 1 FROM `grade_requirements` AS next
      WHERE next.`previous_version_id` = current.`id`
    )
) >= 10
BEGIN
  SELECT RAISE(ABORT, 'grade_requirement_active_limit');
END;
