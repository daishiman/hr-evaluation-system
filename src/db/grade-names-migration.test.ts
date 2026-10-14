import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { schema as s } from "@/lib/db";
import { formRowTitle } from "@/lib/domain/grade-label";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";

/**
 * 等級名と表示名の一律の書き換え（0034）と、その戻し方を、実際の SQL ファイルのまま流して確かめる。
 *
 * 本番では全社の等級名を1回で書き換える。書き換える行を取り違えると、利用者が自分で書いた題名や
 * 名前まで消えてしまう。移行前と同じ形のデータを作り、本物の SQL を流して、
 * 書き換える行・書き換えない行・2回目に流したとき・戻したときをここで固定する。
 *
 * 表は本番と同じ移行（drizzle/migrations/*.sql）で作る。0034 は空の表の上で1回流れているので、
 * ここで入れたデータに対してもう一度流すことが「本番での1回目」に当たる。
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const statements = (sql: string) => sql.split("--> statement-breakpoint").filter((st) => st.trim() !== "");
const MIGRATION = statements(read("drizzle/migrations/0034_grade_display_names.sql"));
const ROLLBACK = statements(read("drizzle/rollback/0034_grade_names_rollback.sql"));

/** 0013 が作った「同じ id のまま昇格要件の意味を変えさせない」トリガー。0034 は書き換えのあいだだけ外して作り直す */
const SEMANTIC_TRIGGER = "trg_promreq_semantic_immutable";
const squash = (sql: string) => sql.replace(/\s+/g, " ").trim();
const TRIGGER_IN_0013 = (() => {
  const sql = read("drizzle/migrations/0013_grade_requirement_revisions.sql");
  const start = sql.indexOf(`CREATE TRIGGER \`${SEMANTIC_TRIGGER}\``);
  return squash(sql.slice(start, sql.indexOf("END;", start) + "END".length));
})();

/** 0034 が触る表。差分を見るときはこの表を丸ごと比べる */
const TOUCHED = [
  "grades",
  "forms",
  "behavior_band_sets",
  "promotion_thresholds",
  "promotion_requirements",
  "grade_point_rules",
] as const;

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

const GRADES = [
  ["beginner", "等級１：Beginner", "Beginner", 1],
  ["regular", "等級２：Regular", "Regular", 2],
  ["chief", "等級３：Chief", "Chief", 3],
  ["am1", "等級４：AM Ⅰ", "AM", 4],
  ["am2", "等級４：AM Ⅱ", "AM", 5],
  ["manager1", "等級５：Manager Ⅰ", "Manager", 6],
  ["manager2", "等級５：Manager Ⅱ", "Manager", 7],
] as const;

/** 移行前の形のデータ。A社は seed のまま、B社は等級名を自分で変え、自分で作った等級も持つ */
async function seedBeforeMigration() {
  const db = t.db;
  await db.insert(s.companies).values([
    { id: "cmp_a", name: "A社", slug: "a" },
    { id: "cmp_b", name: "B社", slug: "b" },
  ]);
  await db.insert(s.grades).values([
    ...GRADES.map(([code, name, pointGroup, displayOrder]) => ({
      id: `g_a_${code}`,
      companyId: "cmp_a",
      code,
      name,
      pointGroup,
      displayOrder,
      targetCap: 5,
    })),
    { id: "g_b_beginner", companyId: "cmp_b", code: "beginner", name: "一般職", pointGroup: "Beginner", displayOrder: 1, targetCap: 5 },
    { id: "g_b_special", companyId: "cmp_b", code: "special", name: "特別職", pointGroup: "Chief", displayOrder: 9, targetCap: 5 },
  ]);
  await db.insert(s.evaluationCycles).values([
    { id: "cy_a", companyId: "cmp_a", name: "2026年度 上期", periodStart: "2026-04-01", periodEnd: "2026-09-30" },
    { id: "cy_b", companyId: "cmp_b", name: "2026年度 上期", periodStart: "2026-04-01", periodEnd: "2026-09-30" },
  ]);
  const form = (id: string, companyId: string, cycleId: string, gradeId: string, title: string) => ({
    id,
    companyId,
    cycleId,
    gradeId,
    title,
    publicToken: `tok_${id}`,
  });
  await db.insert(s.forms).values([
    form("f_a_default", "cmp_a", "cy_a", "g_a_beginner", "2026年度 上期 等級１：Beginner 実績アンケート"),
    form("f_a_manager", "cmp_a", "cy_a", "g_a_manager2", "2026年度 上期 等級５：Manager Ⅱ 実績アンケート"),
    // 利用者が自分で付けた題名。英語の区分名を含んでいても書き換えない
    form("f_a_custom", "cmp_a", "cy_a", "g_a_chief", "Chief向け 振り返りアンケート"),
    form("f_b_renamed", "cmp_b", "cy_b", "g_b_beginner", "2026年度 上期 一般職 実績アンケート"),
    form("f_b_special", "cmp_b", "cy_b", "g_b_special", "2026年度 上期 特別職 実績アンケート"),
  ]);
  await db.insert(s.behaviorBandSets).values([
    { id: "bbs_a1", companyId: "cmp_a", code: "g1_2", name: "Beginner・Regular向け", displayOrder: 1 },
    { id: "bbs_a2", companyId: "cmp_a", code: "g3_4", name: "Chief・AM向け", displayOrder: 2 },
    // 区分名ではない英字（TEAM の AM）と、利用者が付けた日本語の名前は書き換えない
    { id: "bbs_a3", companyId: "cmp_a", code: "team", name: "TEAM向け", displayOrder: 3 },
    { id: "bbs_b1", companyId: "cmp_b", code: "g1_2", name: "新人向け", displayOrder: 1 },
  ]);
  await db.insert(s.promotionThresholds).values([
    { id: "pt_a1", companyId: "cmp_a", fromGradeId: "g_a_beginner", toGradeId: "g_a_regular", label: "B→R", requiredBehaviorPoints: 10 },
    { id: "pt_a3", companyId: "cmp_a", fromGradeId: "g_a_chief", toGradeId: "g_a_am1", label: "C→AM", requiredBehaviorPoints: 12 },
    { id: "pt_a6", companyId: "cmp_a", fromGradeId: "g_a_manager1", toGradeId: "g_a_manager2", label: "MⅠ→MⅡ", requiredBehaviorPoints: 12 },
    { id: "pt_b1", companyId: "cmp_b", fromGradeId: "g_b_beginner", toGradeId: "g_b_special", label: "一般→特別", requiredBehaviorPoints: 10 },
  ]);
  await db.insert(s.promotionRequirements).values([
    { id: "pr_a1", companyId: "cmp_a", gradeId: "g_a_beginner", kind: "report", seq: 1, transitionLabel: "等級１→等級２", text: "スキルアップ研修（チーフ以上）" },
    { id: "pr_a2", companyId: "cmp_a", gradeId: "g_a_am1", kind: "report", seq: 1, transitionLabel: "AMⅠ→ AMⅡ", text: "IT機器基礎研修（本部）" },
    { id: "pr_a3", companyId: "cmp_a", gradeId: "g_a_manager1", kind: "test", seq: 1, transitionLabel: "ManagerⅠ→ ManagerⅡ", text: "経営数値の読み方" },
    // 利用者が自分で書いた本文。区分の呼び名を含んでいても書き換えない
    { id: "pr_b1", companyId: "cmp_b", gradeId: "g_b_beginner", kind: "report", seq: 1, transitionLabel: null, text: "チーフ以上の先輩と同行する" },
  ]);
  // 改版済みの要件。過去の版（pr_a4）は履歴なので変えず、今の版（pr_a4_v2）だけを書き換える
  const revised = { companyId: "cmp_a", gradeId: "g_a_regular", kind: "report", seq: 1, transitionLabel: "等級２→等級３" } as const;
  await db.insert(s.promotionRequirements).values({ ...revised, id: "pr_a4", text: "スキルアップ研修（チーフ以上）" });
  await db
    .insert(s.promotionRequirements)
    .values({ ...revised, id: "pr_a4_v2", text: "スキルアップ研修（チーフ以上）", previousVersionId: "pr_a4" });
  await db.insert(s.gradePointRules).values([
    {
      id: "gpr_a_regular",
      companyId: "cmp_a",
      pointGroup: "Regular",
      fixedSlotPoints: 80,
      note: "固定枠（等級要件達成率）＋10点枠で100点。20点枠はChief以上のみ。",
    },
    {
      id: "gpr_a_am",
      companyId: "cmp_a",
      pointGroup: "AM",
      fixedSlotPoints: 30,
      note: "等級要件達成率30点＋20点の金銭系を1つ＋10点の項目を5つ。AMⅠとAMⅡは配点が同じ。",
    },
    { id: "gpr_b_chief", companyId: "cmp_b", pointGroup: "Chief", fixedSlotPoints: 40, note: "Chiefは自社で決めた配点" },
  ]);
}

beforeEach(async () => {
  t = createTestDatabase();
  await seedBeforeMigration();
});

afterEach(() => t.close());

describe("等級名と表示名の一律の書き換え（0034）", () => {
  it("等級名を code ごとの既定にし、区分・code・id は変えない", () => {
    run(MIGRATION);

    const grades = t.raw.prepare("SELECT id, code, name, point_group AS pointGroup FROM grades ORDER BY rowid").all();
    expect(grades).toEqual([
      ...GRADES.map(([code, , pointGroup], i) => ({
        id: `g_a_${code}`,
        code,
        name: ["等級1", "等級2", "等級3", "等級4-1", "等級4-2", "等級5-1", "等級5-2"][i],
        pointGroup,
      })),
      // 会社が自分で付けた名前も、既定の7つの等級なら一律に書き換える
      { id: "g_b_beginner", code: "beginner", name: "等級1", pointGroup: "Beginner" },
      // 会社が自分で作った等級は変えない
      { id: "g_b_special", code: "special", name: "特別職", pointGroup: "Chief" },
    ]);
  });

  it("既定の題名は空（既定の題名）にし、画面では新しい等級名で同じ形の題名になる", () => {
    run(MIGRATION);

    expect(value("forms", "title", "f_a_default")).toBe("");
    expect(value("forms", "title", "f_a_manager")).toBe("");
    expect(value("forms", "title", "f_b_renamed")).toBe("");
    // 名前を変えない等級の既定の題名も空にする（表示は変わらず、あとで等級名を変えると追従する）
    expect(value("forms", "title", "f_b_special")).toBe("");
    // 利用者が付けた題名は残す
    expect(value("forms", "title", "f_a_custom")).toBe("Chief向け 振り返りアンケート");

    const row = t.raw
      .prepare(
        `SELECT f.title AS title, c.name AS cycleName, g.name AS gradeName
         FROM forms f JOIN evaluation_cycles c ON c.id = f.cycle_id JOIN grades g ON g.id = f.grade_id
         WHERE f.id = 'f_a_default'`,
      )
      .get() as { title: string; cycleName: string; gradeName: string };
    expect(formRowTitle(row)).toBe("2026年度 上期 等級1 実績アンケート");
  });

  it("英語の区分名を含む基準セットの名前だけを空にする", () => {
    run(MIGRATION);

    expect(value("behavior_band_sets", "name", "bbs_a1")).toBe("");
    expect(value("behavior_band_sets", "name", "bbs_a2")).toBe("");
    expect(value("behavior_band_sets", "name", "bbs_a3")).toBe("TEAM向け");
    expect(value("behavior_band_sets", "name", "bbs_b1")).toBe("新人向け");
  });

  it("昇格の段階・遷移名・seed の本文・配点の注記を既定の等級名にし、利用者が書いた文は変えない", () => {
    run(MIGRATION);

    expect(value("promotion_thresholds", "label", "pt_a1")).toBe("等級1→等級2");
    expect(value("promotion_thresholds", "label", "pt_a3")).toBe("等級3→等級4-1");
    expect(value("promotion_thresholds", "label", "pt_a6")).toBe("等級5-1→等級5-2");
    expect(value("promotion_thresholds", "label", "pt_b1")).toBe("一般→特別");

    expect(value("promotion_requirements", "transition_label", "pr_a1")).toBe("等級1→等級2");
    expect(value("promotion_requirements", "transition_label", "pr_a2")).toBe("等級4-1→等級4-2");
    expect(value("promotion_requirements", "transition_label", "pr_a3")).toBe("等級5-1→等級5-2");
    expect(value("promotion_requirements", "transition_label", "pr_b1")).toBeNull();
    expect(value("promotion_requirements", "text", "pr_a1")).toBe("スキルアップ研修（等級3以上）");
    expect(value("promotion_requirements", "text", "pr_a2")).toBe("IT機器基礎研修（本部）");
    expect(value("promotion_requirements", "text", "pr_b1")).toBe("チーフ以上の先輩と同行する");
    expect(value("promotion_requirements", "transition_label", "pr_a4_v2")).toBe("等級2→等級3");
    expect(value("promotion_requirements", "text", "pr_a4_v2")).toBe("スキルアップ研修（等級3以上）");
    // 後続の版がある過去の版は変えない
    expect(value("promotion_requirements", "transition_label", "pr_a4")).toBe("等級２→等級３");
    expect(value("promotion_requirements", "text", "pr_a4")).toBe("スキルアップ研修（チーフ以上）");

    expect(value("grade_point_rules", "note", "gpr_a_regular")).toBe(
      "固定枠（等級要件達成率）＋10点枠で100点。20点枠は等級3以上のみ。",
    );
    expect(value("grade_point_rules", "note", "gpr_a_am")).toBe(
      "等級要件達成率30点＋20点の金銭系を1つ＋10点の項目を5つ。等級4-1と等級4-2は配点が同じ。",
    );
    expect(value("grade_point_rules", "note", "gpr_b_chief")).toBe("Chiefは自社で決めた配点");
  });

  it("書き換える前の値を、会社と移行の名前つきで残す", () => {
    run(MIGRATION);

    const recorded = t.raw
      .prepare(
        `SELECT old_value AS oldValue, new_value AS newValue, company_id AS companyId, migration
         FROM display_name_rewrites WHERE table_name = 'grades' AND row_id = 'g_b_beginner' AND column_name = 'name'`,
      )
      .get();
    expect(recorded).toEqual({ oldValue: "一般職", newValue: "等級1", companyId: "cmp_b", migration: "0034_grade_display_names" });

    const counts = t.raw
      .prepare("SELECT table_name AS tableName, column_name AS columnName, COUNT(*) AS n FROM display_name_rewrites GROUP BY 1, 2 ORDER BY 1, 2")
      .all();
    expect(counts).toEqual([
      { tableName: "behavior_band_sets", columnName: "name", n: 2 },
      { tableName: "forms", columnName: "title", n: 4 },
      { tableName: "grade_point_rules", columnName: "note", n: 2 },
      { tableName: "grades", columnName: "name", n: 8 },
      { tableName: "promotion_requirements", columnName: "text", n: 2 },
      { tableName: "promotion_requirements", columnName: "transition_label", n: 4 },
      { tableName: "promotion_thresholds", columnName: "label", n: 3 },
    ]);
  });

  it("2回流しても、2回目は何も変えない（記録の表も含めて差分0）", () => {
    run(MIGRATION);
    const first = snapshot([...TOUCHED, "display_name_rewrites"]);

    run(MIGRATION);

    expect(snapshot([...TOUCHED, "display_name_rewrites"])).toEqual(first);
  });

  it("昇格要件の意味を守るトリガーを、0013 と同じ定義で作り直す", () => {
    run(MIGRATION);

    const trigger = t.raw.prepare("SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = ?").get(SEMANTIC_TRIGGER) as
      | { sql: string }
      | undefined;
    expect(squash(trigger?.sql ?? "")).toBe(TRIGGER_IN_0013);
    // 移行のあとも、アプリが同じ id のまま本文を変えることはできない
    expect(() => t.raw.exec("UPDATE promotion_requirements SET text = '別の本文' WHERE id = 'pr_a1'")).toThrow(
      "promotion_requirement_semantic_immutable",
    );
  });

  it("移行のあとに会社が直した名前は、もう一度流しても上書きしない", () => {
    run(MIGRATION);
    t.raw.exec("UPDATE grades SET name = '新人' WHERE id = 'g_a_beginner'");

    run(MIGRATION);

    expect(value("grades", "name", "g_a_beginner")).toBe("新人");
    // 最初に残した値（移行前の名前）は上書きされない
    const old = t.raw
      .prepare("SELECT old_value AS v FROM display_name_rewrites WHERE table_name = 'grades' AND row_id = 'g_a_beginner'")
      .get() as { v: string };
    expect(old.v).toBe("等級１：Beginner");
  });
});

describe("0034 の戻し方（drizzle/rollback/0034_grade_names_rollback.sql）", () => {
  it("書き換えた行をすべて移行前の値に戻す", () => {
    const before = snapshot();

    run(MIGRATION);
    run(ROLLBACK);

    expect(snapshot()).toEqual(before);
  });

  it("移行のあとに会社が直した行は戻さず、ほかの行だけを戻す", () => {
    run(MIGRATION);
    t.raw.exec("UPDATE grades SET name = '新人' WHERE id = 'g_a_beginner'");
    t.raw.exec("UPDATE forms SET title = '上期のふりかえり' WHERE id = 'f_a_manager'");

    run(ROLLBACK);

    expect(value("grades", "name", "g_a_beginner")).toBe("新人");
    expect(value("forms", "title", "f_a_manager")).toBe("上期のふりかえり");
    expect(value("grades", "name", "g_a_regular")).toBe("等級２：Regular");
    expect(value("forms", "title", "f_a_default")).toBe("2026年度 上期 等級１：Beginner 実績アンケート");
  });

  it("移行のあとに改版した要件は、過去の版を戻さずに残り（トリガーも元どおり）を戻す", async () => {
    run(MIGRATION);
    // 移行のあとに会社が pr_a1 を改版した（pr_a1 は過去の版になり、どの列も変えられなくなる）
    await t.db.insert(s.promotionRequirements).values({
      id: "pr_a1_v2",
      companyId: "cmp_a",
      gradeId: "g_a_beginner",
      kind: "report",
      seq: 1,
      transitionLabel: "等級1→等級2",
      text: "スキルアップ研修（等級3以上・半年以内）",
      previousVersionId: "pr_a1",
    });

    run(ROLLBACK);

    expect(value("promotion_requirements", "text", "pr_a1")).toBe("スキルアップ研修（等級3以上）");
    expect(value("promotion_requirements", "transition_label", "pr_a1_v2")).toBe("等級1→等級2");
    expect(value("promotion_requirements", "transition_label", "pr_a2")).toBe("AMⅠ→ AMⅡ");
    expect(value("promotion_requirements", "text", "pr_a4_v2")).toBe("スキルアップ研修（チーフ以上）");
    const trigger = t.raw.prepare("SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = ?").get(SEMANTIC_TRIGGER) as
      | { sql: string }
      | undefined;
    expect(squash(trigger?.sql ?? "")).toBe(TRIGGER_IN_0013);
  });

  it("戻したあとに 0034 をもう一度流しても、同じ結果になる", () => {
    run(MIGRATION);
    const migrated = snapshot();

    run(ROLLBACK);
    run(MIGRATION);

    expect(snapshot()).toEqual(migrated);
  });
});
