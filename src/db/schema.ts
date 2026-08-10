import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * 人事評価管理システム スキーマ（Cloudflare D1 / SQLite）
 *
 * 設計の柱:
 *  1. マルチテナント — 業務テーブルはすべて company_id を持ち、行レベルで会社を分離する。
 *  2. ハードコード禁止 — 等級・評価基準・ランク閾値・配点・昇給額はすべてこの中のテーブルで持つ。
 *  3. 確定結果の据え置き — 確定した評価は判定当時の閾値・配点を evaluation_items にスナップショットする。
 */

const id = () => text("id").primaryKey();
const createdAt = () => integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date());
const updatedAt = () => integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date());

/* ───────────────────────── 会社（テナント） ───────────────────────── */

export const companies = sqliteTable("companies", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  businessType: text("business_type").notNull().default("給付事業"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ───────────────────────── 認証（Better Auth） ─────────────────────────
 * users は Better Auth の必須列に、業務用の列（会社・ロール・等級・上長など）を足したもの。
 */

export const users = sqliteTable(
  "users",
  {
    id: id(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
    image: text("image"),

    // 業務用の拡張列
    companyId: text("company_id").references(() => companies.id),
    /** SUPER_ADMIN | COMPANY_ADMIN | MANAGER | EMPLOYEE */
    role: text("role").notNull().default("EMPLOYEE"),
    gradeId: text("grade_id"),
    /** 上長（評価者）。自己参照 */
    managerId: text("manager_id"),
    employeeCode: text("employee_code"),
    department: text("department"),
    hiredAt: text("hired_at"),
    profileNote: text("profile_note"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_users_company").on(t.companyId), index("idx_users_manager").on(t.managerId)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: id(),
    token: text("token").notNull().unique(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_sessions_user").on(t.userId)],
);

export const accounts = sqliteTable(
  "accounts",
  {
    id: id(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_accounts_user").on(t.userId)],
);

export const verifications = sqliteTable("verifications", {
  id: id(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ───────────────────────── 等級と等級要件 ───────────────────────── */

export const grades = sqliteTable(
  "grades",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    /** beginner | regular | chief | am1 | am2 | manager1 | manager2 */
    code: text("code").notNull(),
    name: text("name").notNull(),
    /** 配点表の等級区分: Beginner | Regular | Chief | AM | Manager（AMⅠ/Ⅱ、MgrⅠ/Ⅱは同じ配点基準） */
    pointGroup: text("point_group").notNull(),
    displayOrder: integer("display_order").notNull(),
    /** 半期の目標設定上限数（等級要件達成率の分母） */
    targetCap: integer("target_cap").notNull().default(5),
    autonomyLevel: text("autonomy_level"),
    responsibilityLevel: text("responsibility_level"),
    deadlineNote: text("deadline_note"),
    /** 行動指針の等級帯: g1_2 | g3_4 |（なし） */
    behaviorBand: text("behavior_band"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("uq_grades_company_code").on(t.companyId, t.code)],
);

/** 等級要件（支援について／運営について）の○×設問 */
export const gradeRequirements = sqliteTable(
  "grade_requirements",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    gradeId: text("grade_id").notNull().references(() => grades.id, { onDelete: "cascade" }),
    /** support（支援について） | operation（運営について） */
    category: text("category").notNull(),
    seq: integer("seq").notNull(),
    text: text("text").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_greq_grade").on(t.gradeId), index("idx_greq_company").on(t.companyId)],
);

/** 昇格要件（受講後報告書提出＝必須ゲート／独学後テスト） */
export const promotionRequirements = sqliteTable(
  "promotion_requirements",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    gradeId: text("grade_id").notNull().references(() => grades.id, { onDelete: "cascade" }),
    /** report（受講後、報告書提出）| test（独学後、テスト） */
    kind: text("kind").notNull(),
    transitionLabel: text("transition_label"),
    seq: integer("seq").notNull(),
    text: text("text").notNull(),
    /** true なら「満たさないと次の等級に上がれない」必須ゲート */
    isGate: integer("is_gate", { mode: "boolean" }).notNull().default(true),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_promreq_grade").on(t.gradeId)],
);

/* ───────────────────────── 行動指針 ───────────────────────── */

/** 行動指針の観点（創造性・専門性・個別性・対等性・連帯性）× 等級帯 */
export const behaviorGuidelines = sqliteTable(
  "behavior_guidelines",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    /** g1_2（等級1〜2）| g3_4（等級3〜4） */
    band: text("band").notNull(),
    /** creativity | expertise | individuality | equality | solidarity */
    aspect: text("aspect").notNull(),
    aspectName: text("aspect_name").notNull(),
    seq: integer("seq").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("uq_bg_company_band_aspect").on(t.companyId, t.band, t.aspect)],
);

/** 行動指針の5段階（模範3／信頼2／安定1／不安定0／悪影響-1） */
export const behaviorLevels = sqliteTable(
  "behavior_levels",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    guidelineId: text("guideline_id").notNull().references(() => behaviorGuidelines.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    label: text("label").notNull(),
    text: text("text").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("idx_blv_guideline").on(t.guidelineId)],
);

/** 昇格に必要な点数（B→R 10点 など）。アンケート画面には絶対に出さない値。 */
export const promotionThresholds = sqliteTable(
  "promotion_thresholds",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    fromGradeId: text("from_grade_id").notNull().references(() => grades.id, { onDelete: "cascade" }),
    toGradeId: text("to_grade_id").notNull().references(() => grades.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    /** 行動指針評価で必要な点数 */
    requiredBehaviorPoints: integer("required_behavior_points").notNull(),
    /** KPI評価点（100点満点）で必要な点数 */
    requiredKpiPoints: integer("required_kpi_points").notNull().default(100),
    isProvisional: integer("is_provisional", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_pth_company").on(t.companyId)],
);

/* ───────────────────────── KPI 制度マスタ ───────────────────────── */

/** 7カテゴリ（等級要件達成率を除く32項目の分類）。各社はここから1つずつ選ぶ。 */
export const kpiCategories = sqliteTable(
  "kpi_categories",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    displayOrder: integer("display_order").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("uq_kpicat_company_code").on(t.companyId, t.code)],
);

/** KPI項目マスタ（33項目） */
export const kpiItems = sqliteTable(
  "kpi_items",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    no: integer("no").notNull(),
    name: text("name").notNull(),
    categoryId: text("category_id").references(() => kpiCategories.id),
    /** 個人実績 | 事業所実績 | 個人・事業所実績 | 管理者実績 */
    measureType: text("measure_type").notNull(),
    /** % | 件 | 日 | 点 */
    unit: text("unit").notNull(),
    /** higher（高いほど良い）| lower（低いほど良い＝逆転指標） */
    direction: text("direction").notNull().default("higher"),
    formula: text("formula"),
    formulaNote: text("formula_note"),
    intent: text("intent"),
    dataSource: text("data_source"),
    judgeTiming: text("judge_timing"),
    aType: text("a_type"),
    aStandard: text("a_standard"),
    controllability: text("controllability"),
    aRationale: text("a_rationale"),
    remarks: text("remarks"),
    /** No.1 等級要件達成率だけが true（8項目のうち固定枠1） */
    isFixedSlot: integer("is_fixed_slot", { mode: "boolean" }).notNull().default(false),
    /** 制度として未確定の項目に立てる「仮」フラグ */
    isProvisional: integer("is_provisional", { mode: "boolean" }).notNull().default(false),
    provisionalNote: text("provisional_note"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("uq_kpiitem_company_no").on(t.companyId, t.no), index("idx_kpiitem_cat").on(t.categoryId)],
);

/** ランク基準（項目×A〜E の下限・上限）。判定式はコードに書かず必ずここを引く。 */
export const kpiRankCriteria = sqliteTable(
  "kpi_rank_criteria",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    kpiItemId: text("kpi_item_id").notNull().references(() => kpiItems.id, { onDelete: "cascade" }),
    /** A | B | C | D | E */
    rank: text("rank").notNull(),
    displayLabel: text("display_label").notNull(),
    lowerBound: real("lower_bound"),
    upperBound: real("upper_bound"),
    boundaryExpr: text("boundary_expr"),
    meaning: text("meaning"),
    /** 対象等級（「Beginner／Regular／…」の文字列。空なら全等級） */
    targetGrades: text("target_grades"),
    isProvisional: integer("is_provisional", { mode: "boolean" }).notNull().default(false),
    provisionalNote: text("provisional_note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("uq_krc_item_rank").on(t.kpiItemId, t.rank)],
);

/** KPI設問（分子・分母などの実数を聞く設問。q1_1 など） */
export const kpiQuestions = sqliteTable(
  "kpi_questions",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    kpiItemId: text("kpi_item_id").references(() => kpiItems.id, { onDelete: "cascade" }),
    /** q1_1 / c_1 などの設問ID */
    questionKey: text("question_key").notNull(),
    text: text("text").notNull(),
    inputType: text("input_type").notNull().default("number"),
    unit: text("unit"),
    required: integer("required", { mode: "boolean" }).notNull().default(true),
    validation: text("validation"),
    /** numerator（分子）| denominator（分母）| direct（そのまま実績値）| identify（識別） */
    role: text("role").notNull(),
    targetGrades: text("target_grades"),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("uq_kpiq_company_key").on(t.companyId, t.questionKey)],
);

/* ───────────────────────── 評価セット（8項目選択＋配点） ───────────────────────── */

export const evaluationSchemes = sqliteTable(
  "evaluation_schemes",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** draft | active | archived */
    status: text("status").notNull().default("draft"),
    effectiveFrom: text("effective_from"),
    effectiveTo: text("effective_to"),
    totalPoints: integer("total_points").notNull().default(100),
    /** 昇給条件: 選んだ項目すべてがAであること */
    raiseRequiresAllA: integer("raise_requires_all_a", { mode: "boolean" }).notNull().default(true),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_scheme_company").on(t.companyId)],
);

/** 評価セットに選ばれた8項目と配点（合計が totalPoints になること） */
export const schemeItems = sqliteTable(
  "scheme_items",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    schemeId: text("scheme_id").notNull().references(() => evaluationSchemes.id, { onDelete: "cascade" }),
    kpiItemId: text("kpi_item_id").notNull().references(() => kpiItems.id),
    categoryId: text("category_id").references(() => kpiCategories.id),
    /** 配点（満点＝Aのときの点数） */
    weight: integer("weight").notNull(),
    /** 固定枠（等級要件達成率）は差し替え不可 */
    isFixedSlot: integer("is_fixed_slot", { mode: "boolean" }).notNull().default(false),
    displayOrder: integer("display_order").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("uq_si_scheme_item").on(t.schemeId, t.kpiItemId), index("idx_si_scheme").on(t.schemeId)],
);

/** ランク→点数の按分率（A=100%, B=…）。会社ごとに変更可能。 */
export const schemeRankRatios = sqliteTable(
  "scheme_rank_ratios",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    schemeId: text("scheme_id").notNull().references(() => evaluationSchemes.id, { onDelete: "cascade" }),
    rank: text("rank").notNull(),
    /** 配点に掛ける割合（0〜1） */
    ratio: real("ratio").notNull(),
    isProvisional: integer("is_provisional", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("uq_srr_scheme_rank").on(t.schemeId, t.rank)],
);

/* ───────────────────────── 評価サイクル（半期） ───────────────────────── */

export const evaluationCycles = sqliteTable(
  "evaluation_cycles",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    schemeId: text("scheme_id").references(() => evaluationSchemes.id),
    /** planning | open | closed */
    status: text("status").notNull().default("planning"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_cycle_company").on(t.companyId)],
);

/* ───────────────────────── フォーム（Googleフォーム風・版管理） ───────────────────────── */

export const forms = sqliteTable(
  "forms",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    gradeId: text("grade_id").notNull().references(() => grades.id, { onDelete: "cascade" }),
    cycleId: text("cycle_id").notNull().references(() => evaluationCycles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    version: integer("version").notNull().default(1),
    /** draft | published | closed */
    status: text("status").notNull().default("draft"),
    /** 公開URL /f/[token] で使うトークン */
    publicToken: text("public_token").notNull().unique(),
    opensAt: text("opens_at"),
    closesAt: text("closes_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("idx_forms_company").on(t.companyId),
    uniqueIndex("uq_forms_cycle_grade_ver").on(t.cycleId, t.gradeId, t.version),
  ],
);

export const formQuestions = sqliteTable(
  "form_questions",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    formId: text("form_id").notNull().references(() => forms.id, { onDelete: "cascade" }),
    /** support | operation | training | test | behavior | kpi | free */
    section: text("section").notNull(),
    /** yesno | single | multi | number | text | scale */
    questionType: text("question_type").notNull(),
    title: text("title").notNull(),
    helpText: text("help_text"),
    unit: text("unit"),
    required: integer("required", { mode: "boolean" }).notNull().default(true),
    validationMin: real("validation_min"),
    validationMax: real("validation_max"),
    /** 単一選択・複数選択の選択肢 [{value,label,score}] */
    optionsJson: text("options_json"),
    displayOrder: integer("display_order").notNull(),

    // マスタとの紐づけ（集計に使う）
    gradeRequirementId: text("grade_requirement_id").references(() => gradeRequirements.id),
    promotionRequirementId: text("promotion_requirement_id").references(() => promotionRequirements.id),
    behaviorGuidelineId: text("behavior_guideline_id").references(() => behaviorGuidelines.id),
    kpiItemId: text("kpi_item_id").references(() => kpiItems.id),
    kpiQuestionKey: text("kpi_question_key"),
    /** 昇格の必須ゲート設問（受講後報告書提出など） */
    isGate: integer("is_gate", { mode: "boolean" }).notNull().default(false),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_fq_form").on(t.formId)],
);

export const formResponses = sqliteTable(
  "form_responses",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    formId: text("form_id").notNull().references(() => forms.id, { onDelete: "cascade" }),
    cycleId: text("cycle_id").notNull().references(() => evaluationCycles.id, { onDelete: "cascade" }),
    employeeId: text("employee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    gradeId: text("grade_id").notNull().references(() => grades.id),
    /** draft | submitted */
    status: text("status").notNull().default("draft"),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
    respondentNote: text("respondent_note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("uq_fr_form_employee").on(t.formId, t.employeeId),
    index("idx_fr_company").on(t.companyId),
    index("idx_fr_employee").on(t.employeeId),
  ],
);

/** 回答の原本。集計側で修正しても、この値は書き換えない。 */
export const formAnswers = sqliteTable(
  "form_answers",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    responseId: text("response_id").notNull().references(() => formResponses.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull().references(() => formQuestions.id, { onDelete: "cascade" }),
    valueNumber: real("value_number"),
    valueText: text("value_text"),
    valueJson: text("value_json"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("uq_fa_response_question").on(t.responseId, t.questionId)],
);

/* ───────────────────────── 評価結果 ───────────────────────── */

export const evaluations = sqliteTable(
  "evaluations",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    cycleId: text("cycle_id").notNull().references(() => evaluationCycles.id, { onDelete: "cascade" }),
    employeeId: text("employee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    gradeId: text("grade_id").notNull().references(() => grades.id),
    responseId: text("response_id").references(() => formResponses.id),
    schemeId: text("scheme_id").notNull().references(() => evaluationSchemes.id),

    /** 8項目の合計得点（100点満点） */
    totalScore: real("total_score").notNull().default(0),
    maxScore: real("max_score").notNull().default(100),
    /** 等級要件の達成率（%） */
    requirementRate: real("requirement_rate"),
    requirementAchieved: integer("requirement_achieved").default(0),
    requirementTotal: integer("requirement_total").default(0),
    /** 行動指針の合計点 */
    behaviorTotal: real("behavior_total"),

    /** 昇給可否＝選択項目がすべてA */
    raiseEligible: integer("raise_eligible", { mode: "boolean" }).notNull().default(false),
    /** 昇格可否 */
    promotionEligible: integer("promotion_eligible", { mode: "boolean" }).notNull().default(false),
    /** 昇格できない理由（必須ゲート未達など）を日本語で保存 */
    promotionBlockedReason: text("promotion_blocked_reason"),
    /** 判定に使った昇格閾値のスナップショット */
    requiredKpiPointsSnapshot: real("required_kpi_points_snapshot"),
    requiredBehaviorPointsSnapshot: real("required_behavior_points_snapshot"),

    evaluatorId: text("evaluator_id").references(() => users.id),
    evaluatorComment: text("evaluator_comment"),
    /** draft | finalized */
    status: text("status").notNull().default("draft"),
    finalizedAt: integer("finalized_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("uq_eval_cycle_employee").on(t.cycleId, t.employeeId),
    index("idx_eval_company").on(t.companyId),
    index("idx_eval_employee").on(t.employeeId),
  ],
);

/** 項目別の内訳。確定時点の閾値・配点をスナップショットする。 */
export const evaluationItems = sqliteTable(
  "evaluation_items",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    evaluationId: text("evaluation_id").notNull().references(() => evaluations.id, { onDelete: "cascade" }),
    kpiItemId: text("kpi_item_id").notNull().references(() => kpiItems.id),
    categoryId: text("category_id").references(() => kpiCategories.id),

    /** 表示用（レーダーチャートの軸ラベル） */
    itemName: text("item_name").notNull(),
    categoryName: text("category_name"),
    unit: text("unit"),
    direction: text("direction"),

    numerator: real("numerator"),
    denominator: real("denominator"),
    /** 計算後の実績値（%等） */
    actualValue: real("actual_value"),
    /** 評価者が原本を上書きした場合の別枠 */
    overrideValue: real("override_value"),
    overrideReason: text("override_reason"),

    rank: text("rank"),
    points: real("points").notNull().default(0),
    maxPoints: real("max_points").notNull().default(0),

    /** 判定当時の閾値スナップショット（後からマスタを変えても結果が動かない） */
    thresholdLabel: text("threshold_label"),
    thresholdLower: real("threshold_lower"),
    thresholdUpper: real("threshold_upper"),
    /** 「なぜこのランクか」を日本語で保存 */
    rationale: text("rationale"),
    calcNote: text("calc_note"),
    isProvisional: integer("is_provisional", { mode: "boolean" }).notNull().default(false),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("idx_ei_eval").on(t.evaluationId)],
);

/** 行動指針の評価（5観点） */
export const evaluationBehaviors = sqliteTable(
  "evaluation_behaviors",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    evaluationId: text("evaluation_id").notNull().references(() => evaluations.id, { onDelete: "cascade" }),
    guidelineId: text("guideline_id").references(() => behaviorGuidelines.id),
    aspect: text("aspect").notNull(),
    aspectName: text("aspect_name").notNull(),
    score: real("score").notNull(),
    levelLabel: text("level_label"),
    comment: text("comment"),
    createdAt: createdAt(),
  },
  (t) => [index("idx_eb_eval").on(t.evaluationId)],
);

/** 等級要件の○×結果 */
export const evaluationRequirements = sqliteTable(
  "evaluation_requirements",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    evaluationId: text("evaluation_id").notNull().references(() => evaluations.id, { onDelete: "cascade" }),
    gradeRequirementId: text("grade_requirement_id").references(() => gradeRequirements.id),
    category: text("category").notNull(),
    text: text("text").notNull(),
    achieved: integer("achieved", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("idx_er_eval").on(t.evaluationId)],
);

/** 昇格の必須ゲート（受講後報告書提出など）の充足状況 */
export const evaluationGates = sqliteTable(
  "evaluation_gates",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    evaluationId: text("evaluation_id").notNull().references(() => evaluations.id, { onDelete: "cascade" }),
    promotionRequirementId: text("promotion_requirement_id").references(() => promotionRequirements.id),
    kind: text("kind").notNull(),
    text: text("text").notNull(),
    achieved: integer("achieved", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("idx_eg_eval").on(t.evaluationId)],
);

/* ───────────────────────── 昇給・KGI設定 ───────────────────────── */

export const raiseSettings = sqliteTable(
  "raise_settings",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    gradeId: text("grade_id").notNull().references(() => grades.id, { onDelete: "cascade" }),
    monthlyAmount: integer("monthly_amount").notNull().default(0),
    months: integer("months").notNull().default(6),
    annualAmount: integer("annual_amount").notNull().default(0),
    note: text("note"),
    /** 未確定のため仮置き */
    isProvisional: integer("is_provisional", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("uq_raise_company_grade").on(t.companyId, t.gradeId)],
);

/** 事業所KGI達成係数（賞与の個人Pt算出に使う） */
export const kgiCoefficients = sqliteTable(
  "kgi_coefficients",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    scope: text("scope").notNull().default("事業所"),
    label: text("label").notNull(),
    lowerBound: real("lower_bound"),
    upperBound: real("upper_bound"),
    coefficient: real("coefficient").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    isProvisional: integer("is_provisional", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("idx_kgi_company").on(t.companyId)],
);

/* ───────────────────────── 人物メモ ───────────────────────── */

/** 上長・マネージャー・管理者が残す人物ごとの評価メモ（本人には見せない） */
export const employeeNotes = sqliteTable(
  "employee_notes",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    employeeId: text("employee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull().references(() => users.id),
    cycleId: text("cycle_id").references(() => evaluationCycles.id),
    body: text("body").notNull(),
    /** manager（マネージャー以上が閲覧）| admin（管理者のみ） */
    visibility: text("visibility").notNull().default("manager"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_en_employee").on(t.employeeId)],
);
