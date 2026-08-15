import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
  check,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

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
// 更新時刻は保存のたびに自動で進める。
// 「基準を変えたのに、いつ変えたか分からない」状態だと、
// どのサイクルを集計し直すべきかを判定できなくなるため（→ src/lib/impact.ts）。
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date());

/* ───────────────────────── 会社（テナント） ───────────────────────── */

export const companies = sqliteTable("companies", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  businessType: text("business_type").notNull().default("給付事業"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  /** システム標準テンプレート。新しい会社を作るとき、この会社の制度を丸ごと複製する。 */
  isTemplate: integer("is_template", { mode: "boolean" }).notNull().default(false),
  /** 複製元のテンプレート会社 */
  templateSourceId: text("template_source_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** 事業所。稼働・報告書送付率など「事業所実績」の単位であり、昇給の調整率もここに紐づく。 */
export const offices = sqliteTable(
  "offices",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    /** 昇給額に掛ける事業所ごとの調整率（既定 1.0） */
    raiseAdjustRate: real("raise_adjust_rate").notNull().default(1),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("uq_offices_company_code").on(t.companyId, t.code)],
);

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
    /** 所属事業所 */
    officeId: text("office_id"),
    /** 上長（評価者）。自己参照 */
    managerId: text("manager_id"),
    employeeCode: text("employee_code"),
    department: text("department"),
    hiredAt: text("hired_at"),
    profileNote: text("profile_note"),
    /** 発行時の仮パスワードのまま使っている状態。true の間は変更をお願いし続ける */
    mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(false),
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
    /** 半期に立てる目標数の運用目安。等級要件達成率の分母には使わない。 */
    targetCap: integer("target_cap").notNull().default(5),
    autonomyLevel: text("autonomy_level"),
    responsibilityLevel: text("responsibility_level"),
    deadlineNote: text("deadline_note"),
    /** この等級に出す行動指針の基準セット（behavior_band_sets.code）。null なら出さない */
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
    /** 本文を変更した直前の版。null は既存データを含む系譜の起点 */
    previousVersionId: text("previous_version_id").references((): AnySQLiteColumn => gradeRequirements.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("idx_greq_grade").on(t.gradeId),
    index("idx_greq_company").on(t.companyId),
    uniqueIndex("uq_greq_previous_version")
      .on(t.previousVersionId)
      .where(sql`${t.previousVersionId} is not null`),
  ],
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
    /** 本文・遷移名・必須判定を変更した直前の版 */
    previousVersionId: text("previous_version_id").references((): AnySQLiteColumn => promotionRequirements.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("idx_promreq_grade").on(t.gradeId),
    uniqueIndex("uq_promreq_previous_version")
      .on(t.previousVersionId)
      .where(sql`${t.previousVersionId} is not null`),
  ],
);

/* ───────────────────────── 行動指針 ───────────────────────── */

/**
 * 行動指針の基準セット。会社ごとに何セットでも作れる。
 *
 * 初期値は Beginner・Regular 向けと Chief・AM 向けの2つだが、会社の制度に合わせて
 * 追加・複製・改名できる。code は作ったあと変えない（等級の割り当て・アンケートの
 * 組み立てがこの文字列で結ばれているため）。呼び名を変えるのは name のほう。
 *
 * 使い終わったセットは消さずに is_active=false にする。物理削除にすると、
 * すでに公開したアンケートや確定済みの評価がぶら下げている観点まで巻き込む。
 */
export const behaviorBandSets = sqliteTable(
  "behavior_band_sets",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    /** 会社の中で一意。behavior_guidelines.band と grades.behavior_band がこの値を指す */
    code: text("code").notNull(),
    name: text("name").notNull(),
    displayOrder: integer("display_order").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("uq_bbs_company_code").on(t.companyId, t.code)],
);

/** 行動指針の観点（創造性・専門性・個別性・対等性・連帯性）× 基準セット */
export const behaviorGuidelines = sqliteTable(
  "behavior_guidelines",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    /** 基準セットの code（behavior_band_sets.code） */
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
    updatedAt: updatedAt(),
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

/** KPIの分類。評価セットでは同じ分類から複数項目を選んでもよい。 */
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
    /** No.1 等級要件達成率だけが true（どの等級区分でも必ず入る固定枠） */
    isFixedSlot: integer("is_fixed_slot", { mode: "boolean" }).notNull().default(false),
    /** 旧配点表で金銭系だった分類。現在の評価セット選択可否・20点枠の制約には使わない。 */
    isMonetary: integer("is_monetary", { mode: "boolean" }).notNull().default(false),
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

/**
 * 元の配点表（「KPI基準定義_配点」シート）の写し。参考値としてだけ使う。
 *
 * 元の制度は「等級ごとに、項目ごとの点数が決まっている」表を持っていた。
 * いまの仕組みは等級区分ごとに1〜8項目を選び直せるため、選び直すと元の点数が分からなくなる。
 * そこで表をそのまま保管しておき、評価セットの画面で「元はこの点数でした」と出せるようにする。
 * この表は計算には一切使わない（計算に使うのは scheme_items / scheme_rank_ratios）。
 */
export const kpiReferencePoints = sqliteTable(
  "kpi_reference_points",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    kpiItemId: text("kpi_item_id").notNull().references(() => kpiItems.id, { onDelete: "cascade" }),
    /** 配点表の等級区分（grades.point_group と同じ値）。AMⅠ/Ⅱ、MgrⅠ/Ⅱは同じ列 */
    pointGroup: text("point_group").notNull(),
    /** A | B | C | D | E */
    rank: text("rank").notNull(),
    /** そのランクを取ったときの点数。元の表で「-」（対象外）だった組み合わせは行を作らない */
    points: real("points").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("uq_krp_item_group_rank").on(t.kpiItemId, t.pointGroup, t.rank),
    index("idx_krp_company").on(t.companyId),
  ],
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

/* ───────────────────────── 評価セット（等級区分別の項目選択＋配点） ───────────────────────── */

/**
 * 等級区分ごとの「持ち点の型」。評価セットを組むときの制約はすべてここを引く。
 *
 * 制度（2026-08-11 確定）:
 *   - 評価は等級区分を問わず 100点満点。100点で次の等級に昇格する。
 *   - 「等級要件達成率」(No.1) は全等級で必須の固定枠。配点は等級区分ごとに固定。
 *   - Chief 以上は自由選択した項目の1つを 20点枠として選ぶ。
 *   - 残りは1項目 10点。
 *
 *   等級区分  固定枠  20点枠  10点枠  選ぶ項目数
 *   Beginner   100      0       0        1
 *   Regular     80      0       2        3
 *   Chief       40      1       4        6
 *   AM          30      1       5        7
 *   Manager     20      1       6        8
 *
 * kpi_reference_points（元の配点表の写し）から導出せず、明示的なマスタとして持つ。
 * 参考値を計算に使わない、という既存の設計方針を守るため。
 * ただし正本（data/kpi-points.json）と一致することはテストで保証する。
 */
export const gradePointRules = sqliteTable(
  "grade_point_rules",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    /** grades.point_group と同じ値: Beginner | Regular | Chief | AM | Manager */
    pointGroup: text("point_group").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    /** 合計（＝満点）。既定 100 */
    totalPoints: integer("total_points").notNull().default(100),
    /** 固定枠「等級要件達成率」の配点 */
    fixedSlotPoints: integer("fixed_slot_points").notNull(),
    /** 20点枠の配点。20点枠を持たない等級区分では 0 */
    majorSlotPoints: integer("major_slot_points").notNull().default(0),
    /** 20点枠の数（0 または 1） */
    majorSlotCount: integer("major_slot_count").notNull().default(0),
    /** 10点枠の配点 */
    minorSlotPoints: integer("minor_slot_points").notNull().default(10),
    /** 10点枠の数 */
    minorSlotCount: integer("minor_slot_count").notNull().default(0),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("uq_gpr_company_group").on(t.companyId, t.pointGroup)],
);

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
    /**
     * ランク→点数の換算方式。制度の意味が変わる論点なので会社ごとに選べる。
     *  ratio    … 一律割合方式（A=100% / B=80% / C=60% / D=40% / E=0%）
     *  absolute … 項目別絶対点方式（移行前の配点表 kpi_reference_points をそのまま使う）※廃止
     *
     * 2026-08-11 に「等級別配点 × ランク割合」へ一本化したため、
     * 新しく absolute を選ぶことはできない（API側で拒否する）。
     * 列を残しているのは、当時 absolute で確定した評価の表示を当時の方式のまま保つため
     * （evaluations.scoring_mode_snapshot と対になる）。
     */
    scoringMode: text("scoring_mode").notNull().default("ratio"),
    /** 昇給条件: 選んだ項目すべてがAであること */
    raiseRequiresAllA: integer("raise_requires_all_a", { mode: "boolean" }).notNull().default(true),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_scheme_company").on(t.companyId)],
);

/**
 * 評価セットに選ばれた項目と配点。等級区分ごとに1セット持つ。
 *
 * 選ぶ項目数と配点は等級区分で変わる（grade_point_rules を参照）。
 * 合計は等級区分ごとに totalPoints（既定100点）ちょうどになること。
 */
export const schemeItems = sqliteTable(
  "scheme_items",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    schemeId: text("scheme_id").notNull().references(() => evaluationSchemes.id, { onDelete: "cascade" }),
    /** 等級区分（grades.point_group と同じ値）。同じ評価セットの中で等級区分ごとに選び直す */
    pointGroup: text("point_group").notNull(),
    kpiItemId: text("kpi_item_id").notNull().references(() => kpiItems.id),
    categoryId: text("category_id").references(() => kpiCategories.id),
    /** 配点（満点＝Aのときの点数）。grade_point_rules からサーバ側で決める */
    weight: integer("weight").notNull(),
    /** 固定枠（等級要件達成率）は差し替え不可 */
    isFixedSlot: integer("is_fixed_slot", { mode: "boolean" }).notNull().default(false),
    /** 20点枠として選ばれた項目。金銭系かどうかは制約しない。 */
    isMajorSlot: integer("is_major_slot", { mode: "boolean" }).notNull().default(false),
    displayOrder: integer("display_order").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("uq_si_scheme_group_item").on(t.schemeId, t.pointGroup, t.kpiItemId),
    index("idx_si_scheme").on(t.schemeId),
    index("idx_si_scheme_group").on(t.schemeId, t.pointGroup),
  ],
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
    /**
     * 小数を受け付けない設問か（「件」「人」のように数え上げるもの）。
     * 制度マスタ側の「入力チェック」の文言には、もともと「0以上の整数」と書かれていたが、
     * 文章として書かれていただけで入力を止める力を持っていなかった。ここで印として持つ。
     */
    validationInteger: integer("validation_integer", { mode: "boolean" }).notNull().default(false),
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
    /** 回答時点の所属事業所（期中異動があるためスナップショットで持つ） */
    officeId: text("office_id"),
    /** 取り込み元（csv など）。手入力は空。 */
    importSource: text("import_source"),
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

/**
 * 回答の原本。集計側で修正しても、この値は書き換えない。
 *
 * 「何を聞かれたか」を回答行そのものに写し取る（question_* 列）。
 * question_id は form_questions への外部キーで ON DELETE cascade のため、
 * 設問が消えると回答も道連れになる。API側では回答のあるアンケートの設問編集を
 * 拒否しているが、それはガード1枚でしかない。過去に自分が答えた内容を
 * 何年後でも同じ文面で読み返せることを、回答行だけで成り立たせる。
 */
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
    /* ── 回答時点の設問スナップショット（過去の回答を当時の文面で読み返すため）── */
    questionTitle: text("question_title"),
    questionType: text("question_type"),
    questionSection: text("question_section"),
    questionUnit: text("question_unit"),
    questionOptionsJson: text("question_options_json"),
    questionDisplayOrder: integer("question_display_order"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("uq_fa_response_question").on(t.responseId, t.questionId)],
);

/**
 * 回答期限の個別延長。
 *
 * アンケートの回答期間（forms.opens_at / closes_at）は全員一律なので、
 * 産育休・長期出張など個別の事情に対応できない。
 * 締切を実際に効かせる代わりに、管理者が本人ごとに期限を延ばせるようにする。
 * 「誰がいつ何日まで延ばしたか」が後から説明できるよう、上書きせず行で残す。
 */
export const formDeadlineExtensions = sqliteTable(
  "form_deadline_extensions",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    formId: text("form_id").notNull().references(() => forms.id, { onDelete: "cascade" }),
    employeeId: text("employee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** 延長後の期限（YYYY-MM-DD）。この日の終わりまで回答できる */
    extendedUntil: text("extended_until").notNull(),
    reason: text("reason"),
    grantedById: text("granted_by_id").references(() => users.id),
    /** 取り消した場合に日時を入れる（行は消さない） */
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    revokedById: text("revoked_by_id").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("idx_fde_form_employee").on(t.formId, t.employeeId),
    index("idx_fde_company").on(t.companyId),
  ],
);

/**
 * CSV一括取込の復元点。業務行と同じD1 batchへ1行追加し、途中失敗時は一緒にrollbackする。
 * before_json は対象IDと変更前の行/回答本文（新規は null）、source_hash は確認した入力本文のSHA-256。
 */
export const importBatches = sqliteTable(
  "import_batches",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    /** members | responses */
    kind: text("kind").notNull(),
    /** 回答CSVではform ID、社員CSVでは会社ID */
    subjectId: text("subject_id").notNull(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    sourceHash: text("source_hash").notNull(),
    rowCount: integer("row_count").notNull(),
    beforeJson: text("before_json").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("idx_import_batches_company_time").on(t.companyId, t.createdAt)],
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
    /** 期末時点の所属事業所（特例「期中に異動した者」の判定に使う） */
    officeId: text("office_id"),
    /** この結果を集計した日時。制度マスタの更新がこれより新しければ「再集計が必要」と判定する。 */
    computedAt: integer("computed_at", { mode: "timestamp_ms" }),

    /** 等級区分ごとの選択項目（1〜8件）の合計得点（100点満点） */
    totalScore: real("total_score").notNull().default(0),
    maxScore: real("max_score").notNull().default(100),
    /** 等級要件の達成率（%） */
    requirementRate: real("requirement_rate"),
    requirementAchieved: integer("requirement_achieved").default(0),
    requirementTotal: integer("requirement_total").default(0),
    /** 行動指針の合計点 */
    behaviorTotal: real("behavior_total"),

    /* ── 賞与の集計（元シート「配点」の集計欄）──
       個人Pt ＝ KPI評価点合計 × 事業所KGI達成係数 ／ 賞与額 ＝ 個人Pt × 1点あたり金額。
       配点が未確定のため、画面には必ず「仮」バッジを付けて出す。
       確定時の係数と方式もここに残し、あとで係数表や方式を変えても過去の評価が動かないようにする。 */
    /** 判定に使った事業所KGIの達成率（%） */
    officeAchievementRate: real("office_achievement_rate"),
    /** 引き当てた達成係数のスナップショット */
    kgiCoefficient: real("kgi_coefficient"),
    personalPoints: real("personal_points"),
    bonusYen: integer("bonus_yen"),
    /** 「なぜこの係数・この金額か」を日本語で保存 */
    bonusRationale: text("bonus_rationale"),
    /** 判定当時のランク→点数の換算方式（ratio | absolute） */
    scoringModeSnapshot: text("scoring_mode_snapshot"),

    /** 昇給可否＝選択項目がすべてA */
    raiseEligible: integer("raise_eligible", { mode: "boolean" }).notNull().default(false),
    /**
     * 昇給可否の理由（評価者向け・点数を含んでよい）。
     * 生成はしていたのに保存していなかったため、結論だけが出て理由が誰にも見えなかった。
     */
    raiseReason: text("raise_reason"),
    /** 昇給可否の理由（本人向け・配点と必要点数を含まない） */
    raiseReasonEmployee: text("raise_reason_employee"),
    /** 昇格可否 */
    promotionEligible: integer("promotion_eligible", { mode: "boolean" }).notNull().default(false),
    /**
     * 昇格できない理由（評価者向け）。必須ゲート未達・必要点数への不足などを日本語で保存。
     * 必要点数が入るため、一般の方にはこの列を返さない。
     */
    promotionBlockedReason: text("promotion_blocked_reason"),
    /** 昇格できない理由（本人向け・必要点数と獲得点数を含まない言い換え） */
    promotionBlockedReasonEmployee: text("promotion_blocked_reason_employee"),
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
    /**
     * 「なぜこのランクか・何点になったか」を日本語で保存（評価者向け）。
     * 配点と獲得点数が文中に入るため、一般の方にはこの列を返さない。
     */
    rationale: text("rationale"),
    /**
     * 同じ判定を本人向けに言い換えたもの。配点・獲得点数・閾値の数値を含まない。
     * 「なぜこの評価か」は本人にも説明できる必要があるため、根拠文自体は消さずに2種類作る。
     */
    rationaleEmployee: text("rationale_employee"),
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

/** 昇給ルールの本体（会社に1件）。判定単位・反映時期・端数処理などをここで持つ。 */
export const raisePolicies = sqliteTable(
  "raise_policies",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }).unique(),
    /** 判定の単位（例: 半期（4月〜9月／10月〜3月）） */
    judgeUnit: text("judge_unit").notNull().default("半期"),
    judgeTimingNote: text("judge_timing_note"),
    /** 反映時期 */
    reflectUpperNote: text("reflect_upper_note"),
    reflectLowerNote: text("reflect_lower_note"),
    raiseForm: text("raise_form"),
    targetNote: text("target_note"),
    /** 降給を行うか（既定は行わない） */
    allowDecrease: integer("allow_decrease", { mode: "boolean" }).notNull().default(false),
    /** 年間の昇給機会 */
    chancesPerYear: integer("chances_per_year").notNull().default(2),
    /** 選ぶKPI項目数と、昇給に必要なAの数 */
    selectedItemCount: integer("selected_item_count").notNull().default(8),
    requiredACount: integer("required_a_count").notNull().default(8),
    /** 連続達成の加算を使うか */
    streakEnabled: integer("streak_enabled", { mode: "boolean" }).notNull().default(false),
    streak2Multiplier: real("streak2_multiplier").notNull().default(1.5),
    streak3Multiplier: real("streak3_multiplier").notNull().default(2),
    streakMaxMultiplier: real("streak_max_multiplier").notNull().default(2),
    /** 端数処理の単位（円） */
    roundingUnit: integer("rounding_unit").notNull().default(100),
    /** 賞与: 個人Pt 1点あたりの金額と賞与原資 */
    bonusYenPerPoint: integer("bonus_yen_per_point").notNull().default(0),
    bonusPoolYen: integer("bonus_pool_yen").notNull().default(0),
    note: text("note"),
    isProvisional: integer("is_provisional", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
);

/** 判定パターンと処遇（8項目すべてA／7A1B／C以下を含む／Eあり） */
export const raisePatterns = sqliteTable(
  "raise_patterns",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    pattern: text("pattern").notNull(),
    judgment: text("judgment").notNull(),
    treatment: text("treatment").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("idx_rpat_company").on(t.companyId)],
);

/** 昇給の特例・例外（中途入職・産育休・時短・期中異動など）。条件分岐ではなく行で持つ。 */
export const raiseExceptions = sqliteTable(
  "raise_exceptions",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    /** 対象のケース */
    caseText: text("case_text").notNull(),
    /** その扱い */
    handling: text("handling").notNull(),
    /** 判定から除外する特例か（在籍不足など） */
    excludesJudgement: integer("excludes_judgement", { mode: "boolean" }).notNull().default(false),
    isProvisional: integer("is_provisional", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_rexc_company").on(t.companyId)],
);

/** 昇給額の改定履歴。金額を変えたら必ず1行残す。 */
export const raiseRevisions = sqliteTable(
  "raise_revisions",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    gradeId: text("grade_id").notNull().references(() => grades.id, { onDelete: "cascade" }),
    beforeAmount: integer("before_amount"),
    afterAmount: integer("after_amount").notNull(),
    effectiveFrom: text("effective_from"),
    reason: text("reason"),
    revisedById: text("revised_by_id").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("idx_rrev_company").on(t.companyId), index("idx_rrev_grade").on(t.gradeId)],
);

export const raiseSettings = sqliteTable(
  "raise_settings",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    gradeId: text("grade_id").notNull().references(() => grades.id, { onDelete: "cascade" }),
    monthlyAmount: integer("monthly_amount").notNull().default(0),
    months: integer("months").notNull().default(6),
    annualAmount: integer("annual_amount").notNull().default(0),
    /** 同じ等級のまま昇給できる回数の上限 */
    maxCount: integer("max_count").notNull().default(8),
    capNote: text("cap_note"),
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
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_kgi_company").on(t.companyId)],
);

/**
 * 事業所KGIの達成率（事業所 × 評価サイクル）。
 *
 * 賞与の個人Pt（＝KPI評価点合計 × 達成係数）を出すために要る実績値。
 * アンケート73問の中にこれを聞く設問は無く、元スプレッドシートでも
 * 別表から手で持ってきていた値のため、管理画面から人が登録する。
 *
 * 登録されていない事業所・サイクルは「行が無い」状態にする。
 * 0% の行を作って埋めない——0%は「KGIをまったく達成できなかった」という
 * 別の意味を持ってしまい、賞与額が最小係数で算出されてしまうため。
 */
export const officeKgiResults = sqliteTable(
  "office_kgi_results",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    officeId: text("office_id").notNull().references(() => offices.id, { onDelete: "cascade" }),
    cycleId: text("cycle_id").notNull().references(() => evaluationCycles.id, { onDelete: "cascade" }),
    /** 達成率（%）。111.5 のような小数も入る */
    achievementRate: real("achievement_rate").notNull(),
    /** 何を根拠にこの数字にしたか（別表の出典など） */
    note: text("note"),
    recordedById: text("recorded_by_id").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("uq_okr_office_cycle").on(t.officeId, t.cycleId),
    index("idx_okr_company").on(t.companyId),
    index("idx_okr_cycle").on(t.cycleId),
  ],
);

/**
 * 達成率の変更履歴。値を変えたら必ず1行残す（昇給額の raise_revisions と同じ作法）。
 * 賞与額の根拠になる数字なので、「誰がいつ何％から何％に変えたか」を後から説明できるようにする。
 */
export const officeKgiRevisions = sqliteTable(
  "office_kgi_revisions",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    officeId: text("office_id").notNull().references(() => offices.id, { onDelete: "cascade" }),
    cycleId: text("cycle_id").notNull().references(() => evaluationCycles.id, { onDelete: "cascade" }),
    /** 変更前の達成率。初回登録では null */
    beforeRate: real("before_rate"),
    afterRate: real("after_rate").notNull(),
    reason: text("reason"),
    revisedById: text("revised_by_id").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("idx_okrev_company").on(t.companyId), index("idx_okrev_cycle").on(t.cycleId)],
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

/* ───────────────────────── 本人が変更してよい項目 ─────────────────────────
 * 「氏名は本人に直させたい。所属と入社日は会社の管理者が管理したい」——
 * この線引きは会社ごとに違うので、コードに埋め込まず会社ごとの行として持つ。
 *
 * 役割・等級・上長はこのテーブルに入れない。本人に開放すると自分を管理者に
 * 昇格させられるため、設定で切り替えられないこと自体を仕組みにする
 * （→ src/lib/domain/profile-fields.ts）。
 */
export const profileFieldPolicies = sqliteTable(
  "profile_field_policies",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    /** src/lib/domain/profile-fields.ts の SELF_EDITABLE_FIELDS のキー */
    field: text("field").notNull(),
    /** true なら本人が自分で変更できる。false なら会社の管理者だけ */
    selfEditable: integer("self_editable", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("uq_pfp_company_field").on(t.companyId, t.field)],
);

/* ─────────────────────── 制度マスタ 変更監査ジャーナル ───────────────────────
 *
 * 等級・等級要件・昇格要件・行動指針・KPIマスタ・昇給ルール・KGI係数など、
 * 「制度マスタ」に対する変更はすべてここに不変の行として積む。
 *
 * 各テーブル（grades / grade_requirements / kpi_rank_criteria …）が現在状態の正本である。
 * この列は変更履歴の表示と障害調査を補助する append-only の監査記録であり、状態復元の
 * 正本ではない。現状は本体更新と同じD1 batchで書いていないため、完全性を仮定しない。
 *
 * 1件のイベントは「誰が・いつ・どの実体の・どの種別の変更で・どの列がどう変わったか」を持つ。
 * before/after は変更のあった列だけを持つ差分（丸ごとの複製はしない）。
 */
export const constitutionEvents = sqliteTable(
  "constitution_events",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    /** grade | gradeRequirement | promotionRequirement | behaviorBandSet | behaviorGuideline |
     *  behaviorLevel | promotionThreshold | raiseSetting | raisePolicy | office |
     *  kpiRankCriteria | kgiCoefficient など。対象テーブルと1対1で対応する。 */
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    /** created | updated | activated | deactivated | revised | restored | reordered | deleted */
    eventType: text("event_type").notNull(),
    /** 実行した人。バックフィルした初期イベントや自動処理は null。 */
    actorId: text("actor_id").references(() => users.id),
    /** 変更前の値（変わった列だけ）。created では null。 */
    beforeJson: text("before_json"),
    /** 変更後の値（変わった列だけ、または削除時は消えた行の全体）。 */
    afterJson: text("after_json"),
    /** 同じ実体の中での表示順。現状はDB一意制約を持たないため、復元順序の正本にはしない。 */
    seq: integer("seq").notNull(),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    index("idx_ce_entity").on(t.companyId, t.entityType, t.entityId, t.seq),
    index("idx_ce_company_time").on(t.companyId, t.occurredAt),
  ],
);

/* ─────────────────────── 見た目の選択の集計 ───────────────────────
 *
 * 「どの配色 × どの明るさが選ばれたか」を数えるだけのテーブル。
 * 将来どの色合いを標準にするかを、好みの言い合いではなく実際の選択で決めるために置く。
 *
 * 誰が選んだかは持たない（user_id も company_id も無い）。個人の設定は
 * これまでどおりブラウザの中だけにあり、ここへ来るのは回数だけ。
 * 行は組み合わせの数（配色5 × 明るさ3 × 実表示2）だけで、増え続けない。
 */
export const themeChoiceCounts = sqliteTable("theme_choice_counts", {
  /** `${palette}:${mode}:${resolved}`。組み合わせ1つにつき1行にするための自然キー。 */
  key: text("key").primaryKey(),
  /** graphite | azure | sand | moss | midnight（→ src/lib/palette.ts） */
  palette: text("palette").notNull(),
  /** 利用者が選んだ明るさ: auto | light | dark（→ src/lib/theme.ts） */
  mode: text("mode").notNull(),
  /** 「自動」のときに実際どちらで表示されたか: light | dark */
  resolved: text("resolved").notNull(),
  /** 選ばれた回数。1人が何度選び直しても、そのたびに1票入る。 */
  count: integer("count").notNull().default(0),
  updatedAt: updatedAt(),
});

/**
 * 配色の現在設定。利用者1人に1行だけを保持する。
 *
 * theme_choice_counts は過去の「切り替え回数」を壊さないため残すが、
 * 標準配色の判断に使う正本はこちら。利用者IDはセッションから取得し、
 * APIの本文からは受け取らない。
 */
export const themeUserPreferences = sqliteTable(
  "theme_user_preferences",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    palette: text("palette").notNull(),
    mode: text("mode").notNull(),
    resolved: text("resolved").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("ck_theme_user_preferences_palette", sql`${t.palette} IN ('graphite', 'azure', 'sand', 'moss', 'midnight')`),
    check("ck_theme_user_preferences_mode", sql`${t.mode} IN ('auto', 'light', 'dark')`),
    check("ck_theme_user_preferences_resolved", sql`${t.resolved} IN ('light', 'dark')`),
    check("ck_theme_user_preferences_consistent", sql`${t.mode} = 'auto' OR ${t.mode} = ${t.resolved}`),
  ],
);

/* ───────────────────────── 改善要望（各画面からの共有） ─────────────────────────
 *
 * 「この画面のここが使いにくい」を、その画面から直接送ってもらうための箱。
 * どの画面で起きたかは送信側で自動的に入れる（利用者に打たせない）。
 *
 * 消さずに状態で持つ（→ src/lib/domain/improvement.ts）。見送りにしたものも
 * 残しておかないと、同じ要望が何度も届いていることに気づけない。
 */
export const improvementRequests = sqliteTable(
  "improvement_requests",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    /** 送った人。退職しても要望は残すので、行ごと消さない（onDelete を付けない）。 */
    reporterId: text("reporter_id").notNull().references(() => users.id),
    /** 送信者がタブ内の1件ごとに発行する再送識別子。既存行だけは null。 */
    submissionKey: text("submission_key"),
    /** 送信時に開いていた画面のURL（クエリは落とす） */
    path: text("path").notNull(),
    /** 動的IDを正規化した集計用ルート（→ system-spec/route-ledger.json） */
    routePattern: text("route_pattern").notNull(),
    /** その画面の呼び名（→ system-spec/route-ledger.json） */
    screenLabel: text("screen_label").notNull(),
    body: text("body").notNull(),
    /**
     * bug（動かない）| usability（使いにくい）| feature（機能がほしい）。
     * 直す優先順位・記録票の書き出し方・**自動で集めてよい技術情報の量**を
     * 分ける唯一の入力（→ src/lib/domain/improvement-instruction.ts の収集レベル）。
     * 種類を聞いていなかった既存行は 'usability' 扱い（→ 0020 の既定値）。
     */
    kind: text("kind").notNull().default("usability"),
    /** 「どうなってほしいか」。自動では絶対に集められないので、任意で1行だけ受ける。 */
    expected: text("expected"),
    /**
     * 送信時にブラウザ側で自動収集した技術情報（JSON文字列）。
     * 中身の形と上限、伏せ方は src/lib/domain/improvement-instruction.ts が正本。
     */
    diagnostics: text("diagnostics"),
    /** 「1280×720」の形。狭い画面だけで起きる崩れを切り分けるために残す。 */
    viewport: text("viewport"),
    userAgent: text("user_agent"),
    /** open | doing | done | dropped */
    status: text("status").notNull().default("open"),
    /** 状態を最後に変えた人 */
    handledById: text("handled_by_id").references(() => users.id),
    /** 対応のメモ（見送りの理由もここに書く） */
    handledNote: text("handled_note"),
    /**
     * 同じ内容の要望を1つにまとめたときの統合先。
     * 重複を状態の値にすると「どれと同じか」が消えるので、指し先そのものを持つ。
     */
    duplicateOfId: text("duplicate_of_id").references((): AnySQLiteColumn => improvementRequests.id),
    /**
     * 廃棄（誤送信・テスト投稿など）の印。行は消さない。
     *
     * 消してしまうと、取り違えて捨てたときに声そのものが失われ、
     * どれくらい誤送信が起きているかも数えられなくなる。
     * 廃棄の前の対応状況は improvement_status_events に残し、戻せるようにする。
     */
    discardedAt: integer("discarded_at", { mode: "timestamp_ms" }),
    discardedById: text("discarded_by_id").references(() => users.id),
    /** 廃棄の理由（定型の理由＋自由記述を1文にしたもの）。一覧で理由を出すために持つ。 */
    discardReason: text("discard_reason"),
    /**
     * 変更内容の確認依頼（PR）の場所。「レビュー待ち」の唯一の根拠。
     *
     * 状態の値に 'review' を足さないのは、SQLite の CHECK に値を足すには
     * テーブルの作り直し（DROP を含む）が要り、本番データに対して危険が
     * 見合わないため。加えて、重複・廃棄と同じく「取り消したときにどこへ
     * 戻すか」を残せる（→ improvementDisplayState が重ねて判定する）。
     * 取り込まれたあとも消さない。どの確認依頼で直ったかを後から読むため。
     */
    reviewRef: text("review_ref"),
    /** 確認依頼が作られた時刻。レビュー待ちがいつから続いているかを読む。 */
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("idx_ir_company").on(t.companyId, t.createdAt),
    index("idx_ir_status").on(t.companyId, t.status),
    index("idx_ir_route").on(t.companyId, t.routePattern),
    index("idx_ir_discarded").on(t.companyId, t.discardedAt),
    uniqueIndex("uq_ir_reporter_submission").on(t.companyId, t.reporterId, t.submissionKey),
    check("ck_improvement_requests_status", sql`${t.status} IN ('open', 'doing', 'done', 'dropped')`),
  ],
);

/**
 * 要望に添える画面の写し（注釈を焼き込んだあとの1枚）。
 *
 * 一覧では画像を引かないよう、本体とは別の行に分ける。
 * R2 を使っていないので data URL の文字列として持つ。大きさの上限は
 * src/lib/domain/improvement.ts の IMPROVEMENT_SHOT_MAX_BYTES。
 */
export const improvementShots = sqliteTable("improvement_shots", {
  requestId: text("request_id")
    .primaryKey()
    .references(() => improvementRequests.id, { onDelete: "cascade" }),
  /** data:image/jpeg;base64,… の形 */
  dataUrl: text("data_url").notNull(),
  bytes: integer("bytes").notNull(),
  createdAt: createdAt(),
});

/**
 * 要望を作業指示文として払い出した記録。
 *
 * 「まだ払い出していない」を null 列の組み合わせで表すと、途中と済みの
 * 見分けが画面ごとにぶれる。行があれば払い出し済み、無ければ未払い出し、
 * で1つに固定する。二重に作らない境界は request_id の主キーそのもの。
 *
 * 外へ出す通信はもう無いので、席取り（番号0の行）も要らない。
 * 払い出しはアプリの中で完結し、書き込み1文で決まる。
 */
export const improvementHandouts = sqliteTable("improvement_handouts", {
  requestId: text("request_id")
    .primaryKey()
    .references(() => improvementRequests.id, { onDelete: "cascade" }),
  /**
   * 最後に払い出した時点の内容の指紋。
   * これと今の内容を比べて「更新あり」を出す。更新日時で比べると、
   * 中身が同じでも触っただけで差分ありになり、意味のない払い出しが積み上がる。
   * 形は src/lib/domain/improvement-handout.ts が正本。
   */
  contentFingerprint: text("content_fingerprint").notNull().default(""),
  /** 最後に払い出した時刻。まだ一度も払い出していなければ null。 */
  handedOutAt: integer("handed_out_at", { mode: "timestamp" }),
  /** 払い出した人。そのあと退職しても記録は残す。 */
  handedOutById: text("handed_out_by_id").references(() => users.id),
  /**
   * 通算の払い出し回数。履歴の行数ではなく、ここが正本。
   * 履歴は古い分を丸めるので、行を数えると回数が過去へ向かって減っていく。
   */
  handoutCount: integer("handout_count").notNull().default(0),
  createdAt: createdAt(),
});

/**
 * 払い出した1回ぶんの記録（追記だけ・書き換えない）。
 *
 * 「最後の1回」だけを残すと、何度渡し直したのか・誰が渡したのかが
 * 次の払い出しで消える。渡した経緯は要望を読み直すときの手がかりになるので、
 * 1回ごとに積む。無限には増やさず、新しい方から一定件数だけ残す
 * （上限は src/lib/domain/improvement-handout.ts が正本）。
 */
export const improvementHandoutEvents = sqliteTable(
  "improvement_handout_events",
  {
    id: id(),
    requestId: text("request_id")
      .notNull()
      .references(() => improvementRequests.id, { onDelete: "cascade" }),
    /** screen（画面からコピー）| api（Claude Code が取得）。 */
    via: text("via").notNull(),
    /** API で取ったときの鍵。鍵の行が消えても読めるよう、呼び名も写しておく。 */
    keyId: text("key_id"),
    keyLabel: text("key_label"),
    /** 画面から押した人。API 経由では入らない。 */
    actorId: text("actor_id").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("idx_ihe_request").on(t.requestId, t.createdAt)],
);

/**
 * 要望の状態を変えた記録（追記だけ・書き換えない）。
 *
 * 状態の列を上書きするだけだと、「誰がいつ、なぜ落としたか」が次の更新で消える。
 * 廃棄を取り消して元へ戻すときも、戻し先はこの履歴の from_status から決める。
 * だからこの表は追記専用にし、行の書き換えも削除もしない。
 */
export const improvementStatusEvents = sqliteTable(
  "improvement_status_events",
  {
    id: id(),
    requestId: text("request_id")
      .notNull()
      .references(() => improvementRequests.id, { onDelete: "cascade" }),
    /**
     * status（対応状況の変更）| reject | duplicate | discard | restore |
     * unlink | close-issue | refresh。言葉の正本は
     * src/lib/domain/improvement-disposition.ts。
     */
    action: text("action").notNull(),
    /** 変える前後の対応状況。戻すときの行き先になる。 */
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    /** 定型の理由（by-design / mistake など）。対応状況の更新では空。 */
    reasonCode: text("reason_code"),
    /** 定型と自由記述をまとめた1文。画面と記録票のコメントにそのまま出す。 */
    reason: text("reason"),
    actorId: text("actor_id").references(() => users.id),
    /**
     * 人ではなく鍵が変えたときの、その鍵。呼び名も写す（鍵を止めたあとも読めるように）。
     * ここが入っている行は、画面から人が差し戻せる行でもある。
     */
    keyId: text("key_id"),
    keyLabel: text("key_label"),
    /** 「対応済み」にしたときの公開先。ここが空の完了は作らせない。 */
    releaseRef: text("release_ref"),
    createdAt: createdAt(),
  },
  (t) => [index("idx_ise_request").on(t.requestId, t.createdAt)],
);

/**
 * 作業指示文を受け取るための鍵（画面から発行する）。
 *
 * 生の鍵はここに入れない。入れると、データベースを見られた時点で
 * そのまま使える鍵が手に入る。保存するのはハッシュと先頭数文字だけで、
 * 突き合わせもハッシュどうしで行う（→ src/lib/domain/agent-keys.ts）。
 *
 * 行は消さない。失効させた鍵も残しておくことで、「誰がいつ発行し、
 * 誰がいつ止めたか」がそのまま操作の履歴になる。
 */
export const agentApiKeys = sqliteTable(
  "agent_api_keys",
  {
    id: id(),
    /** どこで使う鍵か（例: 自宅の Claude Code）。止める鍵を見分けるために必ず入れる。 */
    label: text("label").notNull().default(""),
    /** 生の鍵の SHA-256（16進）。ここから元の鍵は戻せない。 */
    keyHash: text("key_hash").notNull(),
    /** 画面に出す先頭数文字。どの鍵のことかを見分けるためだけに使う。 */
    keyPrefix: text("key_prefix").notNull(),
    /**
     * この鍵で扱える会社。発行した時点で固定し、あとから変えない。
     * 空なのは、会社を焼き込む前に発行した鍵だけ。その鍵は読み取りしかできない。
     */
    companyId: text("company_id").references(() => companies.id),
    /**
     * できること（コンマ区切り）。improvements:read と improvements:write-own の2つだけ。
     * 言葉の正本は src/lib/domain/agent-scope.ts。
     */
    scopes: text("scopes").notNull().default("improvements:read"),
    createdAt: createdAt(),
    createdById: text("created_by_id").references(() => users.id),
    /** 最後にこの鍵で受け取った時刻。配ったのに使われていない、に気づくため。 */
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    /** 失効させた時刻。入っていれば、それだけでこの鍵は通らない。 */
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    revokedById: text("revoked_by_id").references(() => users.id),
  },
  (t) => [
    index("idx_agent_api_keys_hash").on(t.keyHash),
    index("idx_agent_api_keys_company").on(t.companyId),
  ],
);

/**
 * 鍵まわりの、アプリ全体で1つだけの設定。行は常に1行（id は "default"）。
 *
 * いま持っているのは「サーバーの設定値の鍵を受け付けるか」だけ。
 * 設定値そのものはターミナルからしか消せないので、画面から止められる
 * スイッチをここに置く。止めた状態は取り消せる（消すのは取り消せない）。
 */
export const agentKeySettings = sqliteTable("agent_key_settings", {
  id: text("id").primaryKey(),
  envKeyEnabled: integer("env_key_enabled", { mode: "boolean" }).notNull().default(true),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  updatedById: text("updated_by_id").references(() => users.id),
});
