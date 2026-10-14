import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { schema as s } from "@/lib/db";
import { buildReasonText } from "@/lib/domain/evaluation-view";
import { formRowTitle } from "@/lib/domain/grade-label";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";

/**
 * 移行の予行（P08）で見つかった直し（0035）と、その戻し方を、実際の SQL ファイルのまま流して確かめる。
 *
 * 本番は 0034 を当てたあとの DB に 0035 を流す。ここでも移行前と同じ形のデータを作り、0034 → 0035 の順に流して、
 * 書き換える行・書き換えない行・2回目に流したとき・戻したときを固定する。
 * 表は本番と同じ移行（drizzle/migrations/*.sql）で作る。0034・0035 は空の表の上で1回流れているので、
 * ここで入れたデータに対してもう一度流すことが「本番での1回目」に当たる。
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const statements = (sql: string) => sql.split("--> statement-breakpoint").filter((st) => st.trim() !== "");
const GRADE_NAMES = statements(read("drizzle/migrations/0034_grade_display_names.sql"));
const GRADE_NAMES_ROLLBACK = statements(read("drizzle/rollback/0034_grade_names_rollback.sql"));
const CORRECTIONS = statements(read("drizzle/migrations/0035_migration_corrections.sql"));
const CORRECTIONS_ROLLBACK = statements(read("drizzle/rollback/0035_migration_corrections_rollback.sql"));

/** 0034・0035 が触る表。差分を見るときはこの表を丸ごと比べる */
const TOUCHED = [
  "grades",
  "forms",
  "kpi_items",
  "behavior_band_sets",
  "promotion_thresholds",
  "promotion_requirements",
  "grade_point_rules",
  "form_questions",
  "form_answers",
  "evaluation_gates",
  "evaluations",
] as const;

/** 昇格要件の本文の写し（設問名・回答の設問名・必須ゲートの文・昇格できない理由）が持つ、seed の旧い本文 */
const SKILL_TRAINING = { seed: "スキルアップ研修（チーフ以上）", renamed: "スキルアップ研修（等級3以上）" } as const;

/** KPI 項目の列と、data/kpi-master.json の見出しの対応（scripts/seed-data.mjs と同じ） */
const MASTER_COLUMN = { formula_note: "自動決定・固定値の扱い", intent: "＊評価の意図", remarks: "備考" } as const;
type KpiColumn = keyof typeof MASTER_COLUMN;
const KPI_MASTER = JSON.parse(read("data/kpi-master.json")) as Record<string, string | number | null>[];
/** No は文字列で入っている（"1" など）。見つからないときは取り違えに気づけるよう例外にする */
const masterText = (no: number, column: KpiColumn) => {
  const item = KPI_MASTER.find((m) => Number(m.No) === no);
  if (!item) throw new Error(`data/kpi-master.json に No.${no} がありません`);
  return item[MASTER_COLUMN[column]];
};

/** seed が入れていた KPI 項目の文（本番の DB に残っている、移行前の値） */
const SEED_KPI_TEXT = {
  denominator:
    "分母は等級から自動決定：Beginner=5／Regular=5／Chief=5／AM Ⅰ=3／AM Ⅱ=2／Manager Ⅰ=2／Manager Ⅱ=2（等級要件シートより）",
  reportCount: "Regular/Chief＝本人が報告した件数、AM/Manager＝事業所全体で報告された件数。フォームの説明文を等級で切り替える",
  reportIntent: "Reg/Chiefは個人で何件報告したか。AM/Managerは事業所全体で何件報告させられたか",
  interviews: "1人あたり必要回数は等級から自動決定：AM=3回（対象=Reg・Beg・Pt）／Manager=2回（対象=AM・Chief）",
  managerPoints: "元シートは基準のみで配点が空欄。Managerに10点を置くと全等級の満点が100点で揃う（素案）",
  managementOnly: "新規（素案）。経営責任のあるAM/Managerのみ、配点20点",
  raiseIntent: "Reg以下の人をどのくらい昇給させられたか AND 自身も昇給したか",
} as const;

let t: TestDatabase;

function run(sql: string[]) {
  for (const st of sql) t.raw.exec(st);
}

function snapshot(tables: readonly string[] = TOUCHED) {
  return Object.fromEntries(tables.map((name) => [name, t.raw.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()]));
}

function value(table: string, column: string, id: string) {
  const row = t.raw.prepare(`SELECT ${column} AS v FROM ${table} WHERE id = ?`).get(id) as { v: string | null };
  return row.v;
}

/** 等級名を変えた記録（アプリが constitution_events に残す形。before_json は変わった列だけ） */
let eventSeq = 0;
function gradeRenamed(companyId: string, gradeId: string, before: string, after: string) {
  eventSeq += 1;
  return {
    id: `ce_${eventSeq}`,
    companyId,
    entityType: "grade",
    entityId: gradeId,
    eventType: "updated",
    beforeJson: JSON.stringify({ name: before }),
    afterJson: JSON.stringify({ name: after }),
    seq: eventSeq,
  };
}

const SEED_GRADES = [
  ["beginner", "等級１：Beginner", "Beginner"],
  ["regular", "等級２：Regular", "Regular"],
  ["chief", "等級３：Chief", "Chief"],
  ["am1", "等級４：AM Ⅰ", "AM"],
  ["am2", "等級４：AM Ⅱ", "AM"],
  ["manager1", "等級５：Manager Ⅰ", "Manager"],
  ["manager2", "等級５：Manager Ⅱ", "Manager"],
] as const;

/**
 * 0034 を当てる前の形のデータ。
 * A社は seed のまま使い、アンケートを作ったあとで「等級１：Beginner」を「新人」に変えた。
 * B社は等級名を2回変え、自分で作った等級の名前も変え、KPI 項目の文の一部を自分で直した。
 */
async function seedBeforeMigration() {
  const db = t.db;
  eventSeq = 0;
  await db.insert(s.companies).values([
    { id: "cmp_a", name: "A社", slug: "a" },
    { id: "cmp_b", name: "B社", slug: "b" },
  ]);
  await db.insert(s.grades).values([
    ...SEED_GRADES.map(([code, name, pointGroup], i) => ({
      id: `g_a_${code}`,
      companyId: "cmp_a",
      code,
      name: code === "beginner" ? "新人" : name,
      pointGroup,
      displayOrder: i + 1,
      targetCap: 5,
    })),
    { id: "g_b_beginner", companyId: "cmp_b", code: "beginner", name: "総合職", pointGroup: "Beginner", displayOrder: 1, targetCap: 5 },
    { id: "g_b_chief", companyId: "cmp_b", code: "chief", name: "主任", pointGroup: "Chief", displayOrder: 3, targetCap: 5 },
    { id: "g_b_special", companyId: "cmp_b", code: "special", name: "専門職", pointGroup: "Chief", displayOrder: 9, targetCap: 5 },
  ]);
  await db.insert(s.constitutionEvents).values([
    gradeRenamed("cmp_a", "g_a_beginner", "等級１：Beginner", "新人"),
    gradeRenamed("cmp_b", "g_b_beginner", "一般職", "総合職"),
    gradeRenamed("cmp_b", "g_b_chief", "等級3", "主任"),
    gradeRenamed("cmp_b", "g_b_special", "特別職", "専門職"),
    // 名前以外を変えた記録と、読めない記録。どちらも題名の候補にはならず、移行も止めない
    { ...gradeRenamed("cmp_b", "g_b_special", "", ""), beforeJson: JSON.stringify({ targetCap: 3 }), afterJson: JSON.stringify({ targetCap: 5 }) },
    { ...gradeRenamed("cmp_b", "g_b_special", "", ""), beforeJson: "{壊れた記録", afterJson: null },
  ]);
  await db.insert(s.evaluationCycles).values([
    { id: "cy_a", companyId: "cmp_a", name: "2026年度 上期", periodStart: "2026-04-01", periodEnd: "2026-09-30" },
    { id: "cy_b", companyId: "cmp_b", name: "2026年度 上期", periodStart: "2026-04-01", periodEnd: "2026-09-30" },
  ]);
  const form = (id: string, companyId: string, cycleId: string, gradeId: string, title: string, status = "closed", version = 1) => ({
    id,
    companyId,
    cycleId,
    gradeId,
    title,
    status,
    version,
    publicToken: `tok_${id}`,
  });
  await db.insert(s.forms).values([
    // 等級名を変える前に作った既定の題名（0034 は今の等級名でしか見分けないので残る）
    form("f_a_seed_name", "cmp_a", "cy_a", "g_a_beginner", "2026年度 上期 等級１：Beginner 実績アンケート"),
    // 今の等級名で作った既定の題名（0034 が空にする）
    form("f_a_current", "cmp_a", "cy_a", "g_a_regular", "2026年度 上期 等級２：Regular 実績アンケート", "published"),
    // 利用者が自分で付けた題名
    form("f_a_custom", "cmp_a", "cy_a", "g_a_chief", "Chief研修のふりかえり"),
    // 2回前の名前・seed の名前・自分で作った等級の前の名前で保存された既定の題名
    form("f_b_first_name", "cmp_b", "cy_b", "g_b_beginner", "2026年度 上期 一般職 実績アンケート"),
    form("f_b_seed_name", "cmp_b", "cy_b", "g_b_beginner", "2026年度 上期 等級１：Beginner 実績アンケート", "closed", 2),
    form("f_b_special", "cmp_b", "cy_b", "g_b_special", "2026年度 上期 特別職 実績アンケート", "published"),
    // 既定の名前を含む題名（0034 のあとに会社が書いたもの）と、評価期間の名前が違う題名は変えない
    form("f_b_default_name", "cmp_b", "cy_b", "g_b_chief", "2026年度 上期 等級3 実績アンケート"),
    form("f_b_other_cycle", "cmp_b", "cy_b", "g_b_special", "2025年度 下期 特別職 実績アンケート", "closed", 2),
  ]);
  const kpi = (id: string, companyId: string, no: number, texts: Partial<Record<"formulaNote" | "intent" | "remarks", string>>) => ({
    id,
    companyId,
    no,
    name: `項目${no}`,
    measureType: "個人実績",
    unit: "件",
    ...texts,
  });
  await db.insert(s.kpiItems).values([
    kpi("k_a_1", "cmp_a", 1, { formulaNote: SEED_KPI_TEXT.denominator, intent: "等級要件の達成状況を見る" }),
    kpi("k_a_2", "cmp_a", 2, { formulaNote: SEED_KPI_TEXT.reportCount, intent: SEED_KPI_TEXT.reportIntent }),
    kpi("k_a_4", "cmp_a", 4, { intent: SEED_KPI_TEXT.raiseIntent }),
    kpi("k_a_7", "cmp_a", 7, { formulaNote: SEED_KPI_TEXT.interviews }),
    kpi("k_a_8", "cmp_a", 8, { remarks: SEED_KPI_TEXT.managerPoints }),
    kpi("k_a_24", "cmp_a", 24, { remarks: SEED_KPI_TEXT.managementOnly }),
    // 会社が自分で直した文は、英語の区分名を含んでいても変えない
    kpi("k_b_1", "cmp_b", 1, { formulaNote: "分母は等級から自動決定：Beginner=4（自社の決め）" }),
    kpi("k_b_2", "cmp_b", 2, { intent: SEED_KPI_TEXT.reportIntent, remarks: "AM/Managerは本部が確認する" }),
  ]);

  // 昇格要件の本文の写し。公開済みのアンケートの設問・提出した回答・確定した評価に、seed の旧い本文が残っている
  await db.insert(s.users).values({ id: "u_a_1", name: "社員A", email: "a1@example.test", companyId: "cmp_a" });
  await db.insert(s.evaluationSchemes).values({ id: "sch_a", companyId: "cmp_a", name: "評価セット" });
  await db.insert(s.promotionRequirements).values({
    id: "preq_a_skill",
    companyId: "cmp_a",
    gradeId: "g_a_regular",
    kind: "report",
    seq: 1,
    text: SKILL_TRAINING.seed,
  });
  const question = (id: string, title: string, promotionRequirementId: string | null) => ({
    id,
    companyId: "cmp_a",
    formId: "f_a_current",
    section: "training",
    questionType: "yesno",
    title,
    displayOrder: 1,
    promotionRequirementId,
  });
  await db.insert(s.formQuestions).values([
    question("q_a_skill", SKILL_TRAINING.seed, "preq_a_skill"),
    // 会社が自分で足した設問は、同じ文でも変えない
    question("q_a_free", SKILL_TRAINING.seed, null),
  ]);
  await db.insert(s.formResponses).values({
    id: "r_a_1",
    companyId: "cmp_a",
    formId: "f_a_current",
    cycleId: "cy_a",
    employeeId: "u_a_1",
    gradeId: "g_a_regular",
    status: "submitted",
  });
  await db.insert(s.formAnswers).values([
    { id: "a_a_skill", companyId: "cmp_a", responseId: "r_a_1", questionId: "q_a_skill", valueText: "no", questionTitle: SKILL_TRAINING.seed },
    { id: "a_a_free", companyId: "cmp_a", responseId: "r_a_1", questionId: "q_a_free", valueText: "no", questionTitle: SKILL_TRAINING.seed },
  ]);
  await db.insert(s.evaluations).values({
    id: "ev_a_1",
    companyId: "cmp_a",
    cycleId: "cy_a",
    employeeId: "u_a_1",
    gradeId: "g_a_regular",
    responseId: "r_a_1",
    schemeId: "sch_a",
    status: "finalized",
    // src/lib/domain/scoring.ts が未達の要件名を並べて作る文
    promotionBlockedReason: buildReasonText([{ headline: "次の昇格要件が未達です。", items: [SKILL_TRAINING.seed, "評価面談の実施"] }]),
    promotionBlockedReasonEmployee: buildReasonText([{ headline: "未達の昇格要件があります。", items: [SKILL_TRAINING.seed, "評価面談の実施"] }]),
  });
  await db.insert(s.evaluationGates).values([
    { id: "eg_a_skill", companyId: "cmp_a", evaluationId: "ev_a_1", promotionRequirementId: "preq_a_skill", kind: "report", text: SKILL_TRAINING.seed },
    { id: "eg_a_interview", companyId: "cmp_a", evaluationId: "ev_a_1", promotionRequirementId: null, kind: "report", text: "評価面談の実施" },
    // 昇格要件に結び付かない必須ゲートは、同じ文でも変えない（達成済みなので理由の文には入らない）
    { id: "eg_a_free", companyId: "cmp_a", evaluationId: "ev_a_1", promotionRequirementId: null, kind: "report", text: SKILL_TRAINING.seed, achieved: true },
  ]);
}

beforeEach(async () => {
  t = createTestDatabase();
  await seedBeforeMigration();
});

afterEach(() => t.close());

describe("予行で見つかった直し（0035）", () => {
  it("等級名を変える前の名前で保存した既定の題名を空にし、画面では今の等級名の題名になる", () => {
    run(GRADE_NAMES);
    // 0034 だけでは、変える前の名前で保存した題名が残る
    expect(value("forms", "title", "f_a_seed_name")).toBe("2026年度 上期 等級１：Beginner 実績アンケート");

    run(CORRECTIONS);

    expect(value("forms", "title", "f_a_seed_name")).toBe("");
    expect(value("forms", "title", "f_a_current")).toBe("");
    expect(value("forms", "title", "f_b_first_name")).toBe("");
    expect(value("forms", "title", "f_b_seed_name")).toBe("");
    expect(value("forms", "title", "f_b_special")).toBe("");

    const row = t.raw
      .prepare(
        `SELECT f.title AS title, c.name AS cycleName, g.name AS gradeName
         FROM forms f JOIN evaluation_cycles c ON c.id = f.cycle_id JOIN grades g ON g.id = f.grade_id
         WHERE f.id = ?`,
      );
    expect(formRowTitle(row.get("f_a_seed_name") as { title: string; cycleName: string; gradeName: string })).toBe(
      "2026年度 上期 等級1 実績アンケート",
    );
    expect(formRowTitle(row.get("f_b_special") as { title: string; cycleName: string; gradeName: string })).toBe(
      "2026年度 上期 専門職 実績アンケート",
    );
  });

  it("利用者が書いた題名・既定の名前を含む題名・評価期間の違う題名は変えない（読めない履歴があっても止まらない）", () => {
    run(GRADE_NAMES);
    expect(() => run(CORRECTIONS)).not.toThrow();

    expect(value("forms", "title", "f_a_custom")).toBe("Chief研修のふりかえり");
    expect(value("forms", "title", "f_b_default_name")).toBe("2026年度 上期 等級3 実績アンケート");
    expect(value("forms", "title", "f_b_other_cycle")).toBe("2025年度 下期 特別職 実績アンケート");
  });

  it("seed のままの KPI 項目の文を data/kpi-master.json と同じ文にし、会社が直した文と更新日時は変えない", () => {
    run(GRADE_NAMES);
    const updatedAt = snapshot(["kpi_items"]).kpi_items.map((r) => (r as { updated_at: number }).updated_at);

    run(CORRECTIONS);

    expect(value("kpi_items", "formula_note", "k_a_1")).toBe(masterText(1, "formula_note"));
    expect(value("kpi_items", "formula_note", "k_a_2")).toBe(masterText(2, "formula_note"));
    expect(value("kpi_items", "intent", "k_a_2")).toBe(masterText(2, "intent"));
    expect(value("kpi_items", "intent", "k_a_4")).toBe(masterText(4, "intent"));
    expect(value("kpi_items", "formula_note", "k_a_7")).toBe(masterText(7, "formula_note"));
    expect(value("kpi_items", "remarks", "k_a_8")).toBe(masterText(8, "remarks"));
    expect(value("kpi_items", "remarks", "k_a_24")).toBe(masterText(24, "remarks"));
    expect(value("kpi_items", "intent", "k_b_2")).toBe(masterText(2, "intent"));
    // 書き換えた文に、英語の区分名は残らない
    for (const [id, column] of [["k_a_1", "formula_note"], ["k_a_2", "intent"], ["k_a_4", "intent"], ["k_a_7", "formula_note"], ["k_a_24", "remarks"]]) {
      expect(value("kpi_items", column, id)).not.toMatch(/Beginner|Regular|Chief|Manager|AM|Reg|Beg/);
    }

    expect(value("kpi_items", "intent", "k_a_1")).toBe("等級要件の達成状況を見る");
    expect(value("kpi_items", "formula_note", "k_b_1")).toBe("分母は等級から自動決定：Beginner=4（自社の決め）");
    expect(value("kpi_items", "remarks", "k_b_2")).toBe("AM/Managerは本部が確認する");
    expect(snapshot(["kpi_items"]).kpi_items.map((r) => (r as { updated_at: number }).updated_at)).toEqual(updatedAt);
  });

  it("昇格要件に結び付いた写し（設問名・回答の設問名・必須ゲートの文）と昇格できない理由の、旧い本文だけを等級名の文にする", () => {
    run(GRADE_NAMES);
    // 0034 は昇格要件の本文だけを直し、写しは残す
    expect(value("promotion_requirements", "text", "preq_a_skill")).toBe(SKILL_TRAINING.renamed);
    expect(value("form_questions", "title", "q_a_skill")).toBe(SKILL_TRAINING.seed);
    const copies = ["form_questions", "form_answers", "evaluation_gates", "evaluations"] as const;
    const before = snapshot(copies);

    run(CORRECTIONS);

    expect(value("form_questions", "title", "q_a_skill")).toBe(SKILL_TRAINING.renamed);
    expect(value("form_answers", "question_title", "a_a_skill")).toBe(SKILL_TRAINING.renamed);
    expect(value("evaluation_gates", "text", "eg_a_skill")).toBe(SKILL_TRAINING.renamed);
    expect(value("evaluations", "promotion_blocked_reason", "ev_a_1")).toBe(
      buildReasonText([{ headline: "次の昇格要件が未達です。", items: [SKILL_TRAINING.renamed, "評価面談の実施"] }]),
    );
    expect(value("evaluations", "promotion_blocked_reason_employee", "ev_a_1")).toBe(
      buildReasonText([{ headline: "未達の昇格要件があります。", items: [SKILL_TRAINING.renamed, "評価面談の実施"] }]),
    );

    // 変わるのは上のセルだけ。結び付かない行・ほかの列・更新日時は前のまま
    const changed: Record<string, Record<string, string[]>> = {
      form_questions: { q_a_skill: ["title"] },
      form_answers: { a_a_skill: ["question_title"] },
      evaluation_gates: { eg_a_skill: ["text"] },
      evaluations: { ev_a_1: ["promotion_blocked_reason", "promotion_blocked_reason_employee"] },
    };
    const expected = Object.fromEntries(
      Object.entries(before).map(([table, rows]) => [
        table,
        (rows as Record<string, unknown>[]).map((row) => {
          const columns = changed[table][String(row.id)] ?? [];
          return { ...row, ...Object.fromEntries(columns.map((c) => [c, String(row[c]).replaceAll(SKILL_TRAINING.seed, SKILL_TRAINING.renamed)])) };
        }),
      ]),
    );
    expect(snapshot(copies)).toEqual(expected);
    expect(value("form_questions", "title", "q_a_free")).toBe(SKILL_TRAINING.seed);
    expect(value("form_answers", "question_title", "a_a_free")).toBe(SKILL_TRAINING.seed);
    expect(value("evaluation_gates", "text", "eg_a_free")).toBe(SKILL_TRAINING.seed);
  });

  it("移行が書き換える KPI 項目の旧い文は、data/kpi-master.json にもう残っていない", () => {
    const master = JSON.stringify(KPI_MASTER);
    for (const text of Object.values(SEED_KPI_TEXT)) expect(master).not.toContain(text);
  });

  it("書き換える前の値を、会社と移行の名前つきで残す（0034 の記録とは別に）", () => {
    run(GRADE_NAMES);
    run(CORRECTIONS);

    const recorded = t.raw
      .prepare(
        `SELECT old_value AS oldValue, new_value AS newValue, company_id AS companyId, migration
         FROM display_name_rewrites WHERE table_name = 'forms' AND row_id = 'f_b_first_name'`,
      )
      .get();
    expect(recorded).toEqual({
      oldValue: "2026年度 上期 一般職 実績アンケート",
      newValue: "",
      companyId: "cmp_b",
      migration: "0035_migration_corrections",
    });

    const counts = t.raw
      .prepare(
        `SELECT table_name AS tableName, column_name AS columnName, COUNT(*) AS n FROM display_name_rewrites
         WHERE migration = '0035_migration_corrections' GROUP BY 1, 2 ORDER BY 1, 2`,
      )
      .all();
    expect(counts).toEqual([
      { tableName: "evaluation_gates", columnName: "text", n: 1 },
      { tableName: "evaluations", columnName: "promotion_blocked_reason", n: 1 },
      { tableName: "evaluations", columnName: "promotion_blocked_reason_employee", n: 1 },
      { tableName: "form_answers", columnName: "question_title", n: 1 },
      { tableName: "form_questions", columnName: "title", n: 1 },
      { tableName: "forms", columnName: "title", n: 4 },
      { tableName: "kpi_items", columnName: "formula_note", n: 3 },
      { tableName: "kpi_items", columnName: "intent", n: 3 },
      { tableName: "kpi_items", columnName: "remarks", n: 2 },
    ]);
    // 0034 が空にした題名は 0034 の記録のまま（0035 は記録し直さない）
    const current = t.raw.prepare("SELECT migration FROM display_name_rewrites WHERE row_id = 'f_a_current'").get() as {
      migration: string;
    };
    expect(current.migration).toBe("0034_grade_display_names");
  });

  it("2回流しても、2回目は何も変えない（記録の表も含めて差分0）", () => {
    run(GRADE_NAMES);
    run(CORRECTIONS);
    const first = snapshot([...TOUCHED, "display_name_rewrites"]);

    run(GRADE_NAMES);
    run(CORRECTIONS);

    expect(snapshot([...TOUCHED, "display_name_rewrites"])).toEqual(first);
  });

  it("移行のあとに会社が直した題名・文は、もう一度流しても上書きしない", () => {
    run(GRADE_NAMES);
    run(CORRECTIONS);
    t.raw.exec("UPDATE forms SET title = '上期のふりかえり' WHERE id = 'f_a_seed_name'");
    t.raw.exec("UPDATE kpi_items SET remarks = '配点は来期に見直す' WHERE id = 'k_a_8'");

    run(CORRECTIONS);

    expect(value("forms", "title", "f_a_seed_name")).toBe("上期のふりかえり");
    expect(value("kpi_items", "remarks", "k_a_8")).toBe("配点は来期に見直す");
    const old = t.raw
      .prepare("SELECT old_value AS v FROM display_name_rewrites WHERE table_name = 'kpi_items' AND row_id = 'k_a_8'")
      .get() as { v: string };
    expect(old.v).toBe(SEED_KPI_TEXT.managerPoints);
  });
});

describe("0035 の戻し方（drizzle/rollback/0035_migration_corrections_rollback.sql）", () => {
  it("書き換えた行をすべて 0035 の前の値に戻す", () => {
    run(GRADE_NAMES);
    const before = snapshot();

    run(CORRECTIONS);
    run(CORRECTIONS_ROLLBACK);

    expect(snapshot()).toEqual(before);
  });

  it("0035 を先に、0034 をあとに戻すと、移行前のデータに戻る", () => {
    const before = snapshot();

    run(GRADE_NAMES);
    run(CORRECTIONS);
    run(CORRECTIONS_ROLLBACK);
    run(GRADE_NAMES_ROLLBACK);

    expect(snapshot()).toEqual(before);
  });

  it("移行のあとに会社が直した行は戻さず、ほかの行だけを戻す", () => {
    run(GRADE_NAMES);
    run(CORRECTIONS);
    t.raw.exec("UPDATE forms SET title = '上期のふりかえり' WHERE id = 'f_b_special'");
    t.raw.exec("UPDATE kpi_items SET formula_note = '分母は等級ごとに決める' WHERE id = 'k_a_1'");
    t.raw.exec("UPDATE form_questions SET title = 'スキルアップ研修の受講' WHERE id = 'q_a_skill'");

    run(CORRECTIONS_ROLLBACK);

    expect(value("forms", "title", "f_b_special")).toBe("上期のふりかえり");
    expect(value("kpi_items", "formula_note", "k_a_1")).toBe("分母は等級ごとに決める");
    expect(value("form_questions", "title", "q_a_skill")).toBe("スキルアップ研修の受講");
    expect(value("evaluation_gates", "text", "eg_a_skill")).toBe(SKILL_TRAINING.seed);
    expect(value("forms", "title", "f_a_seed_name")).toBe("2026年度 上期 等級１：Beginner 実績アンケート");
    expect(value("kpi_items", "intent", "k_a_2")).toBe(SEED_KPI_TEXT.reportIntent);
    // 0034 が書き換えた行は、0035 の戻し方では戻さない
    expect(value("forms", "title", "f_a_current")).toBe("");
    expect(value("grades", "name", "g_a_beginner")).toBe("等級1");
  });

  it("戻したあとに 0035 をもう一度流しても、同じ結果になる", () => {
    run(GRADE_NAMES);
    run(CORRECTIONS);
    const migrated = snapshot();

    run(CORRECTIONS_ROLLBACK);
    run(CORRECTIONS);

    expect(snapshot()).toEqual(migrated);
  });
});
