import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import { resolveSchemeForCycle } from "@/lib/domain/scheme-resolution";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany, seedMemberships, seedResponse } from "@/test-support/evaluation-fixture";
import { stripComments } from "@/test-support/source-code";

/*
 * 評価期間に使う評価セットの選び方（DD-024）を、1か所にそろえたままにする。
 *
 * - 規則: 期間に付いた評価セット → 使用中（active）→ null。先頭の1件へは落とさない
 * - 公開と受付開始の判定（loadSchemeReadiness・loadStaleAsking）も、cycle-scheme.ts で同じ規則を通す
 * - 期間から評価セットを決める処理は resolveSchemeForCycle を使い、自前で選ばない
 * - 評価レポートは計算の結果を読むだけで、評価セットを選び直さない
 * - DD-024 の7の図の矢印は、下の一覧（RESOLVERS・READINESS_CALLERS）と同じ
 * - 期間に別の評価セットを付けたとき、アンケートの作成・点数の計算・ずれの比較・レポートが同じ評価セットの項目になる（O23）
 */

const mocked = vi.hoisted(() => ({ getDb: vi.fn() }));

vi.mock("@/lib/db", async () => ({
  ...(await vi.importActual<typeof import("@/lib/db")>("@/lib/db")),
  getDb: mocked.getDb,
}));

import { schemeIdForCycle, schemeIdsForCycles } from "@/lib/cycle-scheme";
import { buildQuestionRows } from "@/lib/form-build";
import { buildEvaluationsForCycle } from "@/lib/evaluate";
import { loadCycleComparisonGaps } from "@/lib/comparison-gap-loader";
import { loadEvaluationReport } from "@/lib/report-data";

const ROOT = process.cwd();
const code = (rel: string) => stripComments(readFileSync(path.join(ROOT, rel), "utf8"));

describe("resolveSchemeForCycle（規則）", () => {
  const schemes = [
    { id: "sch_old", status: "archived" },
    { id: "sch_now", status: "active" },
  ];

  it("期間に付いた評価セットがあれば、使用中でなくてもそれを使う", () => {
    expect(resolveSchemeForCycle({ schemeId: "sch_old" }, schemes)?.id).toBe("sch_old");
  });

  it("期間に付いていなければ、使用中の評価セットを使う", () => {
    expect(resolveSchemeForCycle({ schemeId: null }, schemes)?.id).toBe("sch_now");
  });

  it("付いている id が会社の評価セットに無ければ、使用中の評価セットを使う", () => {
    expect(resolveSchemeForCycle({ schemeId: "sch_other_company" }, schemes)?.id).toBe("sch_now");
  });

  it("使用中も無ければ null を返し、先頭の1件へは落とさない", () => {
    expect(resolveSchemeForCycle({ schemeId: null }, [{ id: "sch_old", status: "archived" }])).toBeNull();
    expect(resolveSchemeForCycle({ schemeId: null }, [])).toBeNull();
  });
});

describe("schemeIdsForCycles（公開と受付開始の判定に渡す id）", () => {
  let t: TestDatabase;

  beforeEach(async () => {
    t = createTestDatabase();
    mocked.getDb.mockResolvedValue(t.db);
    await seedCompany(t);
  });

  afterEach(() => {
    t.close();
  });

  it("期間に評価セットが付いていなければ、会社の使用中の評価セットを返す（「評価セットがありません」にしない）", async () => {
    await t.db.update(s.evaluationCycles).set({ schemeId: null }).where(eq(s.evaluationCycles.id, IDS.cycle));
    expect(await schemeIdForCycle(IDS.company, { id: IDS.cycle, schemeId: null })).toBe(IDS.scheme);
  });

  it("期間に付いた評価セットは、使用中でなくなってもその期間で使い続ける", async () => {
    await t.db.update(s.evaluationSchemes).set({ status: "archived" }).where(eq(s.evaluationSchemes.id, IDS.scheme));
    expect(await schemeIdForCycle(IDS.company, { id: IDS.cycle, schemeId: IDS.scheme })).toBe(IDS.scheme);
  });

  it("他社の使用中の評価セットは選ばない", async () => {
    await t.db.update(s.evaluationSchemes).set({ status: "archived" }).where(eq(s.evaluationSchemes.id, IDS.scheme));
    await t.db.insert(s.companies).values({ id: "cmp_other", name: "他社", slug: "other" });
    await t.db.insert(s.evaluationSchemes).values({ id: "sch_other", companyId: "cmp_other", name: "他社の評価セット", status: "active" });
    expect(await schemeIdForCycle(IDS.company, { id: IDS.cycle, schemeId: null })).toBeNull();
    expect(await schemeIdForCycle(IDS.company, { id: IDS.cycle, schemeId: "sch_other" })).toBeNull();
  });

  it("複数の期間を1回の読み出しで決める", async () => {
    const ids = await schemeIdsForCycles(IDS.company, [
      { id: IDS.cycle, schemeId: IDS.scheme },
      { id: "cyc_without_scheme", schemeId: null },
    ]);
    expect([...ids]).toEqual([
      [IDS.cycle, IDS.scheme],
      ["cyc_without_scheme", IDS.scheme],
    ]);
    expect(await schemeIdsForCycles(IDS.company, [])).toEqual(new Map());
  });
});

describe("期間から評価セットを決める処理は、1か所の規則を通す", () => {
  /** 期間の評価セットを決めてから使うファイル。ここが自前で選ぶと、画面ごとに別の評価セットの話になる */
  const RESOLVERS = ["src/lib/form-build.ts", "src/lib/evaluate.ts", "src/lib/queries.ts", "src/lib/cycle-scheme.ts"];

  it.each(RESOLVERS)("%s は resolveSchemeForCycle を使う", (rel) => {
    expect(code(rel)).toMatch(/\bresolveSchemeForCycle\(/);
  });

  /** 公開・受付開始・アンケートの作成・比べる警告で、準備の判定を読むファイル */
  const READINESS_CALLERS = [
    "src/actions/cycles.ts",
    "src/actions/forms.ts",
    "src/app/admin/cycles/page.tsx",
    "src/app/admin/forms/page.tsx",
    "src/lib/comparison-gap-loader.ts",
  ];

  it.each(READINESS_CALLERS)("%s は期間の schemeId をそのまま準備の判定へ渡さない", (rel) => {
    const src = code(rel);
    expect(src).toMatch(/\bschemeIds?ForCycles?\(/);
    expect(src).not.toMatch(/loadSchemeReadiness\(\s*companyId\s*,\s*[\w.]*\.schemeId\s*\)/);
    expect(src).not.toMatch(/loadStaleAsking\(\s*companyId\s*,\s*[\w.]*\.schemeId\s*,/);
  });

  it("評価レポートは評価セットを選び直さない（計算の結果を読む）", () => {
    const src = code("src/lib/report-data.ts");
    expect(src).not.toMatch(/evaluationSchemes|resolveSchemeForCycle/);
  });

  it("DD-024 の7の図の矢印は、この2つの一覧と同じ（図を変えたら一覧も変える）", () => {
    const graph = dd024Graph();
    const filesFrom = (id: string) => graph.edges.filter(([from]) => from === id).flatMap(([, to]) => graph.files(to)).sort();

    expect(graph.files("R")).toEqual(["src/lib/domain/scheme-resolution.ts"]);
    expect(filesFrom("R")).toEqual([...RESOLVERS].sort());
    expect(filesFrom("CS")).toEqual([...READINESS_CALLERS].sort());
    // レポートへの矢印は、保存した点数と判定（ファイルでない表）からだけ来る
    expect(graph.files("REP")).toEqual(["src/lib/report-data.ts"]);
    expect(graph.edges.filter(([, to]) => to === "REP").map(([from]) => from)).toEqual(["DB"]);
    expect(graph.files("DB")).toEqual([]);
  });
});

/**
 * DD-024 の7の図（mermaid）を、ノードごとのファイルと矢印に分ける。
 * ノードの名前を <br/> と「・」で区切り、.ts・.tsx で終わる語を src/lib/ か src/ の下のファイルとして探す
 */
function dd024Graph() {
  const doc = readFileSync(path.join(ROOT, "docs/product/design-decisions.md"), "utf8");
  const blocks = [...doc.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((m) => m[1]).filter((b) => b.includes("resolveSchemeForCycle<br/>"));
  expect(blocks).toHaveLength(1);

  const NODE = String.raw`(\w+)(?:\[\(?"([^"]*)"\)?\])?`;
  const LINE = new RegExp(`^${NODE}(?:\\s*-->\\s*${NODE})?$`);
  const labels = new Map<string, string>();
  const edges: [string, string][] = [];
  for (const line of blocks[0].split("\n").map((l) => l.trim())) {
    if (line === "" || line.startsWith("flowchart")) continue;
    const m = LINE.exec(line);
    // 読めない行を黙って飛ばすと、その行の矢印が検査から漏れる
    expect(m, `図の行を読めない: ${line}`).not.toBeNull();
    const [, from, fromLabel, to, toLabel] = m!;
    if (fromLabel !== undefined) labels.set(from, fromLabel);
    if (toLabel !== undefined) labels.set(to, toLabel);
    if (to !== undefined) edges.push([from, to]);
  }

  const files = (id: string) => {
    expect(labels.has(id), `図にノード ${id} が無い`).toBe(true);
    return labels
      .get(id)!
      .split(/<br\/>|・/)
      .map((w) => w.trim())
      .filter((w) => /\.tsx?$/.test(w))
      .map((w) => {
        const found = [`src/lib/${w}`, `src/${w}`].filter((rel) => existsSync(path.join(ROOT, rel)));
        expect(found, `図の ${w} に当たるファイルが1つに決まらない`).toHaveLength(1);
        return found[0];
      });
  };
  return { edges, files };
}

describe("期間に別の評価セットを付けたとき、4つの処理が同じ評価セットの項目を使う（O23）", () => {
  let t: TestDatabase;
  /** 期間に付ける評価セット。使用中ではなく、固定枠と稼働率の2項目だけで、配点も見本と違う */
  const ALT = "sch_alt";
  const ALT_NAMES = ["等級要件達成率", "稼働率"];

  beforeEach(async () => {
    t = createTestDatabase();
    mocked.getDb.mockResolvedValue(t.db);
    // 見本の使用中の評価セット（sch_test）は3項目。規則を外れて使用中を選ぶと、残業率が混ざる
    await seedCompany(t);
    seedMemberships(t);
    await t.db.insert(s.evaluationSchemes).values({ id: ALT, companyId: IDS.company, name: "前年度", status: "archived" });
    await t.db.insert(s.schemeItems).values([
      { id: "si_alt_1", companyId: IDS.company, schemeId: ALT, pointGroup: "Regular", kpiItemId: IDS.itemFixed, categoryId: IDS.category, weight: 40, isFixedSlot: true, displayOrder: 1 },
      { id: "si_alt_2", companyId: IDS.company, schemeId: ALT, pointGroup: "Regular", kpiItemId: IDS.itemHigher, categoryId: IDS.category, weight: 60, displayOrder: 2 },
    ]);
    await t.db.insert(s.schemeRankRatios).values(
      (
        [
          ["A", 1],
          ["B", 0.8],
          ["C", 0.6],
          ["D", 0.4],
          ["E", 0],
        ] as const
      ).map(([rank, ratio]) => ({ id: `srr_alt_${rank}`, companyId: IDS.company, schemeId: ALT, rank, ratio })),
    );
    await t.db.update(s.evaluationCycles).set({ schemeId: ALT }).where(eq(s.evaluationCycles.id, IDS.cycle));
    // 稼働率と残業率の聞き方。どちらも決まっているので、作るアンケートの KPI の設問は評価セットの項目だけで決まる
    await t.db.insert(s.kpiQuestions).values([
      { id: "kq_q2_1", companyId: IDS.company, kpiItemId: IDS.itemHigher, questionKey: "q2_1", text: "稼働日数", role: "numerator" },
      { id: "kq_q2_2", companyId: IDS.company, kpiItemId: IDS.itemHigher, questionKey: "q2_2", text: "所定日数", role: "denominator" },
      { id: "kq_q3_1", companyId: IDS.company, kpiItemId: IDS.itemLower, questionKey: "q3_1", text: "残業率", role: "direct" },
    ]);
  });

  afterEach(() => {
    t.close();
  });

  it("アンケートの作成は、期間に付いた評価セットの項目だけを聞く", async () => {
    const rows = await buildQuestionRows({ companyId: IDS.company, cycleId: IDS.cycle, gradeId: IDS.gradeFrom, formId: IDS.form, db: t.db });
    const kpiItems = [...new Set(rows.filter((r) => r.section === "kpi").map((r) => r.kpiItemId))];
    // 固定枠は聞き方を持たない（等級要件の設問で聞く）ので、KPI の設問は稼働率だけになる
    expect(kpiItems).toEqual([IDS.itemHigher]);
  });

  it("ずれの比較は、期間に付いた評価セットの項目と比べる", async () => {
    const gaps = await loadCycleComparisonGaps(IDS.company, IDS.cycle, { role: "COMPANY_ADMIN", current: null });
    expect(gaps.get(IDS.form)?.rows.filter((r) => r.kind === "kpi").map((r) => r.name)).toEqual(ALT_NAMES);
  });

  it("点数の計算とレポートは、期間に付いた評価セットの項目と配点を使う", async () => {
    await seedResponse(t, [
      { id: "fq_req1", section: "support", questionType: "yesno", title: "等級要件1", displayOrder: 1, gradeRequirementId: "gr_1", answer: 1 },
      { id: "fq_q2_1", section: "kpi", questionType: "number", title: "稼働日数", displayOrder: 2, kpiQuestionKey: "q2_1", answer: 100 },
      { id: "fq_q2_2", section: "kpi", questionType: "number", title: "所定日数", displayOrder: 3, kpiQuestionKey: "q2_2", answer: 100 },
      { id: "fq_q3_1", section: "kpi", questionType: "number", title: "残業率", displayOrder: 4, kpiQuestionKey: "q3_1", answer: 4 },
    ]);

    const out = await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    expect(out.map((o) => o.ok)).toEqual([true]);
    const [ev] = await t.db.select().from(s.evaluations).where(eq(s.evaluations.employeeId, IDS.employee));
    const items = await t.db
      .select()
      .from(s.evaluationItems)
      .where(eq(s.evaluationItems.evaluationId, ev.id))
      .orderBy(s.evaluationItems.displayOrder);
    expect(items.map((i) => [i.kpiItemId, i.maxPoints])).toEqual([
      [IDS.itemFixed, 40],
      [IDS.itemHigher, 60],
    ]);

    // レポートは確定した評価だけを読む。確定の操作そのものは report-visibility.contract.test.ts が見る
    await t.db.update(s.evaluations).set({ status: "finalized" }).where(eq(s.evaluations.id, ev.id));
    const report = await loadEvaluationReport({
      companyId: IDS.company,
      employeeId: IDS.employee,
      view: "reviewer",
      viewerRole: "COMPANY_ADMIN",
      now: new Date("2026-10-20T00:00:00Z"),
    });
    expect(report.kind).toBe("reviewer");
    if (report.kind !== "reviewer") return;
    expect(report.radar.axes.map((a) => a.item)).toEqual(ALT_NAMES);
  });
});
