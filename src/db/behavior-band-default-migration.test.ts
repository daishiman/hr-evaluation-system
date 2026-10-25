import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { schema as s } from "@/lib/db";
import { DEFAULT_BEHAVIOR_BAND } from "@/lib/domain/behavior-default-assignment";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";

/**
 * 行動指針の割り当てを既定へ戻す移行（0040・DD-026）と、その戻し方を、実際の SQL ファイルのまま流して確かめる。
 *
 * 本番では全社の等級の割り当て（grades.behavior_band）を1回で既定へ戻す。照合は等級の識別子（code）で行うので、
 * 呼び名を変えた会社も戻る。書き換える行を取り違えると、会社が足した等級や観点の文まで変わってしまう。
 * 移行前と同じ形のデータを作り、本物の SQL を流して、書き換える行・書き換えない行・2回目に流したとき・
 * 戻したときをここで固定する。
 *
 * 割り当ては null（出さない）を取るので、記録の old_value・new_value も null を取る。比べるのは IS / IS NOT。
 *
 * 表は本番と同じ移行（drizzle/migrations/*.sql）で作る。0040 は空の表の上で1回流れているので、
 * ここで入れたデータに対してもう一度流すことが「本番での1回目」に当たる。
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const statements = (sql: string) => sql.split("--> statement-breakpoint").filter((st) => st.trim() !== "");
const MIGRATION = statements(read("drizzle/migrations/0040_behavior_band_defaults.sql"));
const ROLLBACK = statements(read("drizzle/rollback/0040_behavior_band_defaults_rollback.sql"));

/** 移行の前に付いていた更新の時刻。書き換えない行はこのまま残る */
const BEFORE = new Date("2026-01-01T00:00:00Z").getTime();

/** 0040 が触りうる表と、変わってはいけない観点の表。差分を見るときはこの表を丸ごと比べる */
const TOUCHED = ["grades", "behavior_band_default_rewrites"] as const;
const UNTOUCHED = ["companies", "behavior_band_sets", "behavior_guidelines", "behavior_levels"] as const;

let t: TestDatabase;

function run(sql: string[]) {
  for (const st of sql) t.raw.exec(st);
}

function snapshot(tables: readonly string[]) {
  return Object.fromEntries(tables.map((name) => [name, t.raw.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()]));
}

/** 会社の等級の割り当て（code → まとまり） */
function bands(companyId: string) {
  const rows = t.raw
    .prepare("SELECT code, behavior_band AS band FROM grades WHERE company_id = ? ORDER BY display_order, id")
    .all(companyId) as { code: string; band: string | null }[];
  return Object.fromEntries(rows.map((r) => [r.code, r.band]));
}

function setBand(gradeId: string, band: string | null) {
  t.raw.prepare("UPDATE grades SET behavior_band = ? WHERE id = ?").run(band, gradeId);
}

function rewrites(where = "1 = 1") {
  return t.raw
    .prepare(
      `SELECT table_name AS tableName, row_id AS rowId, column_name AS columnName, old_value AS oldValue,
        new_value AS newValue, company_id AS companyId, migration
       FROM behavior_band_default_rewrites WHERE ${where} ORDER BY table_name, row_id`,
    )
    .all();
}

const CODES = ["beginner", "regular", "chief", "am1", "am2", "manager1", "manager2"] as const;
type Code = (typeof CODES)[number];
const DEFAULT_NAMES: Record<Code, string> = {
  beginner: "等級1",
  regular: "等級2",
  chief: "等級3",
  am1: "等級4-1",
  am2: "等級4-2",
  manager1: "等級5-1",
  manager2: "等級5-2",
};
const POINT_GROUP: Record<Code, string> = {
  beginner: "Beginner",
  regular: "Regular",
  chief: "Chief",
  am1: "AM",
  am2: "AM",
  manager1: "Manager",
  manager2: "Manager",
};

/** 既定どおりの割り当て（移行が書く値） */
const DEFAULTS = Object.fromEntries(CODES.map((code) => [code, DEFAULT_BEHAVIOR_BAND[code]]));

function grade(
  company: string,
  code: string,
  band: string | null,
  opts: { name?: string; order?: number; isActive?: boolean } = {},
) {
  const i = CODES.indexOf(code as Code);
  return {
    id: `g_${company}_${code}`,
    companyId: `cmp_${company}`,
    code,
    name: opts.name ?? DEFAULT_NAMES[code as Code] ?? code,
    pointGroup: POINT_GROUP[code as Code] ?? "Chief",
    displayOrder: opts.order ?? i + 1,
    targetCap: 5,
    behaviorBand: band,
    isActive: opts.isActive ?? true,
    createdAt: new Date(BEFORE),
    updatedAt: new Date(BEFORE),
  };
}

/** 7つの等級。上書きした code だけ既定と違う割り当てにする */
function grades7(company: string, overrides: Partial<Record<Code, string | null>> = {}, names?: Record<Code, string>) {
  return CODES.map((code) =>
    grade(company, code, code in overrides ? (overrides[code] ?? null) : DEFAULT_BEHAVIOR_BAND[code], {
      name: names?.[code],
    }),
  );
}

function bandSet(company: string, code: string, opts: { name?: string; order?: number; isActive?: boolean } = {}) {
  return {
    id: `bbs_${company}_${code}`,
    companyId: `cmp_${company}`,
    code,
    name: opts.name ?? "",
    displayOrder: opts.order ?? 1,
    isActive: opts.isActive ?? true,
  };
}

/**
 * 移行前の形のデータ。
 * - A社: 等級1だけが2つ目へ移った（I26 の形）。会社が足した等級と、使用を止めた等級を持つ
 * - B社: 等級の呼び名を変え、割り当ても既定と違う。雛形の会社
 * - C社: 既定のまとまりの2つ目（g3_4）を持たない
 * - D社: 既定のまとまりの2つ目を使用停止にし、自分で作ったまとまりを割り当てている
 * - E社: 既定どおり
 * - F社: 既定のまとまりも7つの等級も持たない（会社が作った等級だけ）
 */
async function seedBeforeMigration() {
  const db = t.db;
  await db.insert(s.companies).values([
    { id: "cmp_a", name: "A社", slug: "a" },
    { id: "cmp_b", name: "B社", slug: "b", isTemplate: true },
    { id: "cmp_c", name: "C社", slug: "c" },
    { id: "cmp_d", name: "D社", slug: "d" },
    { id: "cmp_e", name: "E社", slug: "e" },
    { id: "cmp_f", name: "F社", slug: "f" },
  ]);
  await db.insert(s.grades).values([
    ...grades7("a", { beginner: "g3_4" }).map((g) => (g.code === "am2" ? { ...g, isActive: false, behaviorBand: null } : g)),
    // 会社が足した等級。7つの識別子に無いので、既定と違って見えても触らない
    grade("a", "trainee", "g3_4", { name: "研修生", order: 0 }),
    ...grades7(
      "b",
      { beginner: null, regular: null, chief: "g1_2", manager1: "g3_4" },
      { beginner: "新人", regular: "一般", chief: "主任", am1: "係長", am2: "課長代理", manager1: "課長", manager2: "部長" },
    ),
    ...grades7("c", { chief: "g1_2", am1: "g1_2", am2: "g1_2" }),
    ...grades7("d", { chief: "mid", am1: "mid", am2: "mid" }),
    ...grades7("e"),
    grade("f", "staff", null, { name: "職員", order: 1 }),
  ]);
  await db.insert(s.behaviorBandSets).values([
    bandSet("a", "g1_2", { order: 1 }),
    bandSet("a", "g3_4", { order: 2 }),
    bandSet("b", "g1_2", { order: 1, name: "基礎" }),
    bandSet("b", "g3_4", { order: 2, name: "中堅" }),
    bandSet("c", "g1_2", { order: 1 }),
    bandSet("d", "g1_2", { order: 1 }),
    bandSet("d", "g3_4", { order: 2, isActive: false }),
    bandSet("d", "mid", { order: 3, name: "中間層" }),
    bandSet("e", "g1_2", { order: 1 }),
    bandSet("e", "g3_4", { order: 2 }),
  ]);
  const guideline = (company: string, band: string) => ({
    id: `bg_${company}_${band}`,
    companyId: `cmp_${company}`,
    band,
    aspect: "creativity",
    aspectName: "創造性",
    seq: 1,
  });
  await db.insert(s.behaviorGuidelines).values([
    guideline("a", "g1_2"),
    guideline("a", "g3_4"),
    guideline("b", "g1_2"),
    guideline("e", "g1_2"),
    guideline("e", "g3_4"),
  ]);
  await db.insert(s.behaviorLevels).values(
    ["a_g1_2", "a_g3_4", "b_g1_2", "e_g1_2", "e_g3_4"].map((key) => ({
      id: `blv_${key}`,
      companyId: `cmp_${key.slice(0, 1)}`,
      guidelineId: `bg_${key}`,
      score: 3,
      label: "模範",
      text: "会社が書いた文",
    })),
  );
}

beforeEach(async () => {
  t = createTestDatabase();
  await seedBeforeMigration();
});

afterEach(() => t.close());

describe("行動指針の割り当てを既定へ戻す（0040）", () => {
  it("等級1だけが2つ目へ移った会社は、等級1が1つ目へ戻り、ほかの等級は変わらない", () => {
    run(MIGRATION);

    expect(bands("cmp_a")).toEqual({
      // 会社が足した等級は既定と違って見えても触らない
      trainee: "g3_4",
      ...DEFAULTS,
    });
    expect(rewrites("company_id = 'cmp_a'").map((r) => (r as { rowId: string }).rowId)).toEqual([
      "g_a_am2",
      "g_a_beginner",
    ]);
  });

  it("等級の呼び名を変えた会社も、識別子で既定へ戻る（雛形の会社も対象）", () => {
    run(MIGRATION);

    expect(bands("cmp_b")).toEqual(DEFAULTS);
    // 呼び名は変えない
    const names = t.raw.prepare("SELECT name FROM grades WHERE company_id = 'cmp_b' ORDER BY display_order").all();
    expect(names.map((r) => (r as { name: string }).name)).toEqual(["新人", "一般", "主任", "係長", "課長代理", "課長", "部長"]);
  });

  it("使用を止めた等級も、識別子が7つのどれかなら既定へ戻す", () => {
    run(MIGRATION);

    expect(bands("cmp_a").am2).toBe("g3_4");
  });

  it("既定どおりの会社は、等級も記録も変わらない", () => {
    const before = snapshot(["grades"]);

    run(MIGRATION);

    expect(bands("cmp_e")).toEqual(DEFAULTS);
    expect(rewrites("company_id = 'cmp_e'")).toEqual([]);
    const pick = (snap: Record<string, unknown[]>) =>
      snap.grades.filter((r) => (r as { company_id: string }).company_id === "cmp_e");
    expect(pick(snapshot(["grades"]))).toEqual(pick(before));
  });

  it("観点・段階・まとまり・会社の中身は、どの会社でも変わらない", () => {
    const before = snapshot(UNTOUCHED);

    run(MIGRATION);

    expect(snapshot(UNTOUCHED)).toEqual(before);
  });

  it("書き換えるのは割り当てと更新の時刻だけで、等級のほかの列は変えない", () => {
    const strip = (rows: unknown[]) =>
      rows.map((r) =>
        Object.fromEntries(
          Object.entries(r as Record<string, unknown>).filter(([key]) => key !== "behavior_band" && key !== "updated_at"),
        ),
      );
    const before = strip(snapshot(["grades"]).grades);

    run(MIGRATION);

    expect(strip(snapshot(["grades"]).grades)).toEqual(before);
  });

  it("既定のまとまりを持たない会社は書き換えず、記録の表で数えられる", () => {
    run(MIGRATION);

    // C社は g3_4 が無い。D社は g3_4 の使用を止めている（使用を止めたまとまりへは割り当てられない）
    expect(bands("cmp_c")).toEqual({ ...DEFAULTS, chief: "g1_2", am1: "g1_2", am2: "g1_2" });
    expect(bands("cmp_d")).toEqual({ ...DEFAULTS, chief: "mid", am1: "mid", am2: "mid" });
    expect(rewrites("table_name = 'companies'")).toEqual(
      ["cmp_c", "cmp_d"].map((id) => ({
        tableName: "companies",
        rowId: id,
        columnName: "behavior_band_default",
        oldValue: "missing_default_sets",
        newValue: "missing_default_sets",
        companyId: id,
        migration: "0040_behavior_band_defaults",
      })),
    );
    // 等級の行は記録しない。既定と同じで戻す要が無い会社（F社）は数えない
    expect(rewrites("company_id IN ('cmp_c', 'cmp_d', 'cmp_f') AND table_name = 'grades'")).toEqual([]);
    const count = t.raw.prepare("SELECT COUNT(*) AS n FROM behavior_band_default_rewrites WHERE table_name = 'companies'").get();
    expect(count).toEqual({ n: 2 });
  });

  it("書き換えた行の updated_at は移行の時刻で、書き換えない行は元のまま", () => {
    const start = Math.floor(Date.now() / 1000) * 1000;
    run(MIGRATION);
    const end = Date.now();

    const rows = t.raw.prepare("SELECT id, updated_at AS at FROM grades ORDER BY id").all() as { id: string; at: number }[];
    const touched = new Set(rewrites("table_name = 'grades'").map((r) => (r as { rowId: string }).rowId));
    expect(touched.size).toBeGreaterThan(0);
    for (const row of rows) {
      if (touched.has(row.id)) {
        expect(row.at, row.id).toBeGreaterThanOrEqual(start);
        expect(row.at, row.id).toBeLessThanOrEqual(end);
      } else {
        expect(row.at, row.id).toBe(BEFORE);
      }
    }
  });

  it("書き換える前の値が記録の表に残る（出さない＝null も残る）", () => {
    run(MIGRATION);

    const grade = (rowId: string, oldValue: string | null, newValue: string | null, companyId: string) => ({
      tableName: "grades",
      rowId,
      columnName: "behavior_band",
      oldValue,
      newValue,
      companyId,
      migration: "0040_behavior_band_defaults",
    });
    expect(rewrites("table_name = 'grades'")).toEqual([
      grade("g_a_am2", null, "g3_4", "cmp_a"),
      grade("g_a_beginner", "g3_4", "g1_2", "cmp_a"),
      grade("g_b_beginner", null, "g1_2", "cmp_b"),
      grade("g_b_chief", "g1_2", "g3_4", "cmp_b"),
      grade("g_b_manager1", "g3_4", null, "cmp_b"),
      grade("g_b_regular", null, "g1_2", "cmp_b"),
    ]);
  });

  it("2回流しても、2回目は何も変えない（記録の表も含めて差分0）", () => {
    run(MIGRATION);
    const first = snapshot([...TOUCHED, ...UNTOUCHED]);

    run(MIGRATION);

    expect(snapshot([...TOUCHED, ...UNTOUCHED])).toEqual(first);
  });

  it("移行のあとに会社が変えた割り当ては、もう一度流しても上書きしない", () => {
    run(MIGRATION);
    // 移行が g1_2 にした等級を出さないへ、null を g1_2 にした等級を2つ目へ、g3_4 を null にした等級を1つ目へ
    setBand("g_a_beginner", null);
    setBand("g_b_regular", "g3_4");
    setBand("g_b_manager1", "g1_2");
    const changed = snapshot([...TOUCHED]);

    run(MIGRATION);

    expect(snapshot([...TOUCHED])).toEqual(changed);
  });

  it("移行のあとに会社が移行の前と同じ値へ戻した行だけは、もう一度流すと既定へ書き換わる（記録の old_value のままの行と区別できない）", () => {
    run(MIGRATION);
    // 移行が g3_4 → g1_2 にした等級を、会社が移行の前の値へ戻した
    setBand("g_a_beginner", "g3_4");
    // 移行の前の値ではない値へ変えた等級は、上の it のとおり上書きしない
    setBand("g_b_regular", "g3_4");

    run(MIGRATION);

    expect(bands("cmp_a").beginner).toBe("g1_2");
    expect(bands("cmp_b").regular).toBe("g3_4");
  });
});

describe("0040 の戻し方（drizzle/rollback/0040_behavior_band_defaults_rollback.sql）", () => {
  it("書き換えた行をすべて移行前の値に戻し、記録の表は消さない", () => {
    const before = bands("cmp_a");
    const beforeB = bands("cmp_b");
    run(MIGRATION);
    const records = rewrites();

    run(ROLLBACK);

    expect(bands("cmp_a")).toEqual(before);
    expect(bands("cmp_b")).toEqual(beforeB);
    expect(rewrites()).toEqual(records);
  });

  it("移行のあとに会社が変えた割り当ては戻さない", () => {
    run(MIGRATION);
    setBand("g_a_beginner", null);
    setBand("g_b_regular", "g3_4");
    setBand("g_b_manager1", "g1_2");

    run(ROLLBACK);

    expect(bands("cmp_a").beginner).toBeNull();
    expect(bands("cmp_b")).toMatchObject({ regular: "g3_4", manager1: "g1_2" });
    // 変えていない行は前の値へ戻る
    expect(bands("cmp_b")).toMatchObject({ beginner: null, chief: "g1_2" });
    expect(bands("cmp_a").am2).toBeNull();
  });

  it("戻したあとに 0040 をもう一度流しても、同じ結果になる", () => {
    run(MIGRATION);
    const first = snapshot(["behavior_band_default_rewrites"]);
    const firstBands = ["cmp_a", "cmp_b", "cmp_c", "cmp_d", "cmp_e", "cmp_f"].map(bands);

    run(ROLLBACK);
    run(MIGRATION);

    expect(["cmp_a", "cmp_b", "cmp_c", "cmp_d", "cmp_e", "cmp_f"].map(bands)).toEqual(firstBands);
    expect(snapshot(["behavior_band_default_rewrites"])).toEqual(first);
  });
});

/** docs/deploy-notes.md の 15 に載せた読み取りの SQL。文書を直したらここも直す */
const CHECKS = {
  skippedCompanies: "SELECT COUNT(*) AS n FROM behavior_band_default_rewrites WHERE table_name = 'companies';",
  rewrittenByCompany:
    "SELECT company_id, COUNT(*) AS n FROM behavior_band_default_rewrites WHERE table_name = 'grades' GROUP BY company_id ORDER BY company_id;",
  leftOffDefault:
    "SELECT COUNT(*) AS n FROM grades WHERE code IN ('beginner', 'regular', 'chief', 'am1', 'am2', 'manager1', 'manager2') AND behavior_band IS NOT CASE code WHEN 'beginner' THEN 'g1_2' WHEN 'regular' THEN 'g1_2' WHEN 'chief' THEN 'g3_4' WHEN 'am1' THEN 'g3_4' WHEN 'am2' THEN 'g3_4' END AND company_id NOT IN (SELECT row_id FROM behavior_band_default_rewrites WHERE table_name = 'companies');",
  notRolledBack:
    "SELECT COUNT(*) AS n FROM behavior_band_default_rewrites w JOIN grades g ON g.id = w.row_id WHERE w.table_name = 'grades' AND w.migration = '0040_behavior_band_defaults' AND w.new_value IS NOT g.behavior_band;",
};

describe("配布の後に読み取りで確かめる SQL（docs/deploy-notes.md の 15）", () => {
  const get = (sql: string) => t.raw.prepare(sql).get();

  it("書き換えなかった会社・書き換えた等級・既定と違うまま残った等級を数えられる", () => {
    run(MIGRATION);

    expect(get(CHECKS.skippedCompanies)).toEqual({ n: 2 });
    expect(t.raw.prepare(CHECKS.rewrittenByCompany).all()).toEqual([
      { company_id: "cmp_a", n: 2 },
      { company_id: "cmp_b", n: 4 },
    ]);
    // 書き換えなかった会社（C社・D社）を除けば、7つの識別子の等級は全て既定
    expect(get(CHECKS.leftOffDefault)).toEqual({ n: 0 });
  });

  it("戻す前に、戻らない行（移行のあとに会社が変えた行）を数えられる", () => {
    run(MIGRATION);
    expect(get(CHECKS.notRolledBack)).toEqual({ n: 0 });

    setBand("g_a_beginner", null);
    setBand("g_b_manager1", "g1_2");

    expect(get(CHECKS.notRolledBack)).toEqual({ n: 2 });
  });
});
