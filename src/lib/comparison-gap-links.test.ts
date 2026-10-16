import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { schema as s } from "@/lib/db";
import type { Role } from "@/lib/session";
import { IDS, seedCompany } from "@/test-support/evaluation-fixture";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { FORM_LEDGER_PATH, SELECTION_LEDGER_PATH, type ComparisonGap, type ComparisonPageKey } from "@/lib/domain/comparison-gap";

/*
 * 比べる警告の読み出し（DD-012 の3・受入 AC4・AC5）。
 *
 * 純粋な関数の見本では、読み出しが会社の範囲で絞っているかを確かめられない（設計レビューの11番）。
 * D1 の見本に2社を入れ、他社の行が自社の評価期間 id・等級 id・より大きい版の番号を持っていても、
 * 自社の警告に他社の名前・id が1つも出ないことを確かめる。
 * あわせて、出したリンクがすべて台帳（route-ledger.json）にある画面で、役割で開けない人には出ないことを見る。
 */

const mocked = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/lib/db", async () => ({ ...(await vi.importActual<typeof import("@/lib/db")>("@/lib/db")), getDb: mocked.getDb }));
import { loadCycleComparisonGaps, loadFormComparisonGap, loadGroupComparisonGaps } from "@/lib/comparison-gap-loader";

const COMPANY_B = "cmp_b";
const GRADE_B = "grd_b_regular";
const CYCLE_B = "cyc_b";
const ITEM_B = "kpi_b_secret";
/** 他社の行に置いた名前と id。自社の警告にこのどれかが出たら、会社で絞り忘れている */
const LEAKS = [COMPANY_B, GRADE_B, CYCLE_B, ITEM_B, "frm_b", "B社", "秘密"];

const ledger = JSON.parse(readFileSync(path.join(process.cwd(), "system-spec/route-ledger.json"), "utf8")) as {
  routes: { path: string }[];
};
const ROUTE_PATTERNS = ledger.routes.map((r) => new RegExp(`^${r.path.replace(/\[[^\]]+\]/g, "[^/?#]+")}$`));
const inLedger = (href: string) => ROUTE_PATTERNS.some((re) => re.test(decodeURIComponent(href.split(/[?#]/)[0])));

const opts = (role: Role = "COMPANY_ADMIN", current: ComparisonPageKey | null = null) => ({ role, current });

let t: TestDatabase;

beforeEach(async () => {
  t = createTestDatabase();
  t.raw.exec("PRAGMA foreign_keys = ON");
  mocked.getDb.mockResolvedValue(t.db);
  await seedCompany(t);

  // B社：同じ区分（Regular）の等級・評価セット・評価期間と、自社と同じ名前の題名を持たない秘密のアンケート
  await t.db.insert(s.companies).values({ id: COMPANY_B, name: "B社", slug: "b" });
  await t.db.insert(s.grades).values({
    id: GRADE_B, companyId: COMPANY_B, code: "regular", name: "B社の等級", pointGroup: "Regular", displayOrder: 2, targetCap: 5,
  });
  await t.db.insert(s.kpiCategories).values({ id: "cat_b", companyId: COMPANY_B, code: "ops", name: "B社の運営", displayOrder: 1 });
  await t.db.insert(s.kpiItems).values({
    id: ITEM_B, companyId: COMPANY_B, no: 1, name: "B社の秘密項目", categoryId: "cat_b",
    measureType: "個人実績", unit: "%", direction: "higher", formula: null,
  });
  await t.db.insert(s.evaluationSchemes).values({ id: "sch_b", companyId: COMPANY_B, name: "B社の評価セット", status: "active" });
  await t.db.insert(s.schemeItems).values({
    id: "si_b", companyId: COMPANY_B, schemeId: "sch_b", pointGroup: "Regular", kpiItemId: ITEM_B, categoryId: "cat_b", weight: 100, displayOrder: 1,
  });
  await t.db.insert(s.evaluationCycles).values({
    id: CYCLE_B, companyId: COMPANY_B, name: "B社の秘密の期間", periodStart: "2026-04-01", periodEnd: "2026-09-30", schemeId: "sch_b", status: "open",
  });
  await t.db.insert(s.forms).values([
    { id: "frm_b", companyId: COMPANY_B, gradeId: GRADE_B, cycleId: CYCLE_B, title: "B社の秘密アンケート", status: "published", publicToken: "tok_b" },
    // 自社の評価期間 id・等級 id と、自社より大きい版の番号を持つ他社の行（会社で絞り忘れると「新しい版」に見える）
    {
      id: "frm_b_cross", companyId: COMPANY_B, gradeId: IDS.gradeFrom, cycleId: IDS.cycle,
      title: "B社の秘密アンケート（同じ期間）", status: "draft", version: 9, publicToken: "tok_b_cross",
    },
  ]);
  await t.db.insert(s.formQuestions).values({
    id: "q_b", companyId: COMPANY_B, formId: "frm_b_cross", section: "kpi", questionType: "number",
    title: "B社の秘密項目の実績", displayOrder: 1, kpiItemId: ITEM_B,
  });
});

afterEach(() => t.close());

function expectNoLeak(value: unknown) {
  const json = JSON.stringify(value);
  for (const leak of LEAKS) expect(json, `他社の「${leak}」が出ている`).not.toContain(leak);
}

function hrefsOf(gap: ComparisonGap): string[] {
  const fixHref = gap.fix && "href" in gap.fix ? [gap.fix.href] : [];
  return [...gap.pages.flatMap((p) => (p.href ? [p.href] : [])), ...fixHref];
}

describe("台帳（AC4）", () => {
  it("2つのページの道筋は台帳にある", () => {
    const paths = ledger.routes.map((r) => r.path);
    expect(paths).toContain(SELECTION_LEDGER_PATH);
    expect(paths).toContain(FORM_LEDGER_PATH);
  });

  it("読み出した警告のリンク（2つのページと直す操作）は、すべて台帳にある画面", async () => {
    const gaps = [...(await loadCycleComparisonGaps(IDS.company, IDS.cycle, opts())).values()];
    expect(gaps.length).toBeGreaterThan(0);
    for (const gap of gaps) {
      expect(hrefsOf(gap).length).toBeGreaterThanOrEqual(2);
      for (const href of hrefsOf(gap)) expect(inLedger(href), `${href} は台帳に無い画面です`).toBe(true);
    }
  });
});

describe("一覧（評価期間ごと）の読み出し", () => {
  it("自社のアンケートだけを返し、足りない3件を名前で出す", async () => {
    const gaps = await loadCycleComparisonGaps(IDS.company, IDS.cycle, opts());
    expect([...gaps.keys()]).toEqual([IDS.form]);
    const gap = gaps.get(IDS.form)!;
    expect(gap.missingCount).toBe(3);
    expect(gap.extraCount).toBe(0);
    expect(gap.rows.map((r) => r.name)).toEqual(["等級要件達成率", "稼働率", "残業率"]);
    expect(gap.pages.map((p) => p.href)).toEqual(["/admin/scheme/Regular", `/admin/forms/${IDS.form}`]);
    expect(gap.pages.map((p) => p.label)).toEqual([
      "KPI・評価セット › 等級２：Regular：使うKPIを選ぶ",
      "アンケート › 2026年度上期 Regular（第1版）",
    ]);
  });

  it("他社の行が自社の評価期間 id・等級 id・大きい版を持っていても、他社の名前も id も出ない", async () => {
    const gaps = await loadCycleComparisonGaps(IDS.company, IDS.cycle, opts());
    expectNoLeak([...gaps.values()]);
    // 他社の版9を「より新しい版」と取り違えていない
    expect(gaps.get(IDS.form)!.fix?.kind).not.toBe("openNewer");
  });

  it("評価セットの準備が整っていなければ、残っている手順へのリンクを直す操作にする", async () => {
    // 見本には配点ルールが無いので、loadSchemeReadiness は「配点ルールがありません」を返す
    const fix = (await loadCycleComparisonGaps(IDS.company, IDS.cycle, opts())).get(IDS.form)!.fix;
    expect(fix).toEqual({ kind: "finishScheme", href: "/admin/scheme", linkLabel: "KPI・評価セットを開く" });
  });

  it("同じ評価期間・等級に自社の新しい版があれば、古い版の直す操作はその版を開くリンク", async () => {
    await t.db.insert(s.forms).values({
      id: "frm_test_v2", companyId: IDS.company, gradeId: IDS.gradeFrom, cycleId: IDS.cycle,
      title: "", status: "draft", version: 2, publicToken: "tok_test_v2",
    });
    const gaps = await loadCycleComparisonGaps(IDS.company, IDS.cycle, opts());
    expect(gaps.get(IDS.form)!.fix).toEqual({
      kind: "openNewer", formId: "frm_test_v2", href: "/admin/forms/frm_test_v2", version: 2, draft: true,
    });
    // 新しい版は下書きで回答0件なので、作り直しになる
    expect(gaps.get("frm_test_v2")!.fix).toEqual({ kind: "rebuild", formId: "frm_test_v2" });
    expect(gaps.get("frm_test_v2")!.pages[1].label).toBe("アンケート › 2026年度上期 等級２：Regular 実績アンケート（第2版）");
    expectNoLeak([...gaps.values()]);
  });

  describe("新しい版が選んだ項目と一致したら、古い版の警告を消す（DD-012 の5）", () => {
    /** 第2版。稼働率・残業率を聞き、withRequirement なら等級要件の設問も持つ（固定枠は等級要件の答えから出す） */
    async function insertV2(status: string, withRequirement: boolean) {
      await t.db.insert(s.forms).values({
        id: "frm_test_v2", companyId: IDS.company, gradeId: IDS.gradeFrom, cycleId: IDS.cycle,
        title: "", status, version: 2, publicToken: "tok_test_v2",
      });
      await t.db.insert(s.formQuestions).values([
        { id: "q_v2_higher", companyId: IDS.company, formId: "frm_test_v2", section: "kpi", questionType: "number", title: "稼働率の実績", displayOrder: 1, kpiItemId: IDS.itemHigher },
        { id: "q_v2_lower", companyId: IDS.company, formId: "frm_test_v2", section: "kpi", questionType: "number", title: "残業率の実績", displayOrder: 2, kpiItemId: IDS.itemLower },
      ]);
      if (!withRequirement) return;
      await t.db.insert(s.gradeRequirements).values({
        id: "gr_v2", companyId: IDS.company, gradeId: IDS.gradeFrom, category: "support", seq: 1, text: "等級要件1",
      });
      await t.db.insert(s.formQuestions).values({
        id: "q_v2_req", companyId: IDS.company, formId: "frm_test_v2", section: "support", questionType: "yes_no",
        title: "等級要件1", displayOrder: 3, gradeRequirementId: "gr_v2",
      });
    }

    it.each(["draft", "published", "closed"])("第2版が一致していれば（%s）、第1版にも第2版にも出さない", async (status) => {
      await insertV2(status, true);
      // 固定枠（等級要件達成率）は KPI 設問が無くても、第2版の等級要件の設問で聞けている
      expect([...(await loadCycleComparisonGaps(IDS.company, IDS.cycle, opts())).keys()]).toEqual([]);
      expect(await loadFormComparisonGap(IDS.company, { id: IDS.form, cycleId: IDS.cycle }, opts("COMPANY_ADMIN", "form"))).toBeNull();
      expect(await loadGroupComparisonGaps(IDS.company, "Regular", opts("COMPANY_ADMIN", "selection"))).toEqual([]);
    });

    it("第2版がまだ一致していなければ（等級要件の設問が無く、固定枠が足りない）、第1版は第2版を開かせる", async () => {
      await insertV2("draft", false);
      const gaps = await loadCycleComparisonGaps(IDS.company, IDS.cycle, opts());
      expect(gaps.get(IDS.form)!.fix).toEqual({
        kind: "openNewer", formId: "frm_test_v2", href: "/admin/forms/frm_test_v2", version: 2, draft: true,
      });
      expect(gaps.get("frm_test_v2")!.rows.map((r) => r.name)).toEqual(["等級要件達成率"]);
    });
  });

  it("他社の評価期間 id を渡しても、何も返さない", async () => {
    expect((await loadCycleComparisonGaps(IDS.company, CYCLE_B, opts())).size).toBe(0);
  });
});

describe("アンケート1本の読み出し", () => {
  it("自社のアンケートは、このページの印つきで返す", async () => {
    const gap = await loadFormComparisonGap(IDS.company, { id: IDS.form, cycleId: IDS.cycle }, opts("COMPANY_ADMIN", "form"));
    expect(gap?.formId).toBe(IDS.form);
    expect(gap?.current).toBe("form");
    expect(gap?.pages.map((p) => p.current)).toEqual([false, true]);
    expectNoLeak(gap);
  });

  it.each([
    { id: "frm_b", cycleId: CYCLE_B },
    { id: "frm_b_cross", cycleId: IDS.cycle },
  ])("他社のアンケート（$id）は null", async (form) => {
    expect(await loadFormComparisonGap(IDS.company, form, opts("COMPANY_ADMIN", "form"))).toBeNull();
  });
});

describe("設問のひな形の無い項目（kpi_questions で判定）", () => {
  const noTemplateOf = (gap: ComparisonGap | undefined) => gap?.rows.map((r) => [r.name, r.noTemplate]);

  it("見本にはひな形が無いので、稼働率・残業率に印を付ける。固定枠（等級要件達成率）には付けない", async () => {
    const gap = (await loadCycleComparisonGaps(IDS.company, IDS.cycle, opts())).get(IDS.form);
    expect(noTemplateOf(gap)).toEqual([["等級要件達成率", false], ["稼働率", true], ["残業率", true]]);
    // ひな形のある固定枠も足りないので、直す操作は従来どおり
    expect(gap?.fix?.kind).toBe("finishScheme");
  });

  it("自社のひな形があれば印を外す。他社が同じ項目 id にひな形を置いても数えない", async () => {
    await t.db.insert(s.kpiQuestions).values([
      { id: "kq_higher", companyId: IDS.company, kpiItemId: IDS.itemHigher, questionKey: "q_h", text: "稼働時間", role: "direct" },
      { id: "kq_b_lower", companyId: COMPANY_B, kpiItemId: IDS.itemLower, questionKey: "q_b", text: "B社の秘密", role: "direct" },
    ]);
    const gap = (await loadCycleComparisonGaps(IDS.company, IDS.cycle, opts())).get(IDS.form);
    expect(noTemplateOf(gap)).toEqual([["等級要件達成率", false], ["稼働率", false], ["残業率", true]]);
    expectNoLeak(gap);
  });

  it("足りないのがひな形の無い項目だけの版は、作り直しではなく使うKPIを選ぶへ戻す", async () => {
    // 第2版は等級要件だけを聞く（固定枠は足りている）下書き。稼働率・残業率はひな形が無いので作り直しても入らない
    await t.db.insert(s.forms).values({
      id: "frm_test_v2", companyId: IDS.company, gradeId: IDS.gradeFrom, cycleId: IDS.cycle,
      title: "", status: "draft", version: 2, publicToken: "tok_test_v2",
    });
    await t.db.insert(s.gradeRequirements).values({
      id: "gr_v2", companyId: IDS.company, gradeId: IDS.gradeFrom, category: "support", seq: 1, text: "等級要件1",
    });
    await t.db.insert(s.formQuestions).values({
      id: "q_v2_req", companyId: IDS.company, formId: "frm_test_v2", section: "support", questionType: "yes_no",
      title: "等級要件1", displayOrder: 1, gradeRequirementId: "gr_v2",
    });
    const gaps = await loadCycleComparisonGaps(IDS.company, IDS.cycle, opts());
    expect(gaps.get("frm_test_v2")!.fix).toEqual({ kind: "reselect", href: "/admin/scheme/Regular" });
    expect(gaps.get("frm_test_v2")!.note).toContain("「稼働率」・「残業率」には設問のひな形がありません。");
    // 第1版は、まず新しい版を開かせる（直す場所は新しい版の警告が案内する）
    expect(gaps.get(IDS.form)!.fix?.kind).toBe("openNewer");
    // アンケート1本の画面でも同じ。使うKPIを選ぶの画面（今いるページ）では出さない
    expect((await loadFormComparisonGap(IDS.company, { id: "frm_test_v2", cycleId: IDS.cycle }, opts("COMPANY_ADMIN", "form")))?.fix)
      .toEqual({ kind: "reselect", href: "/admin/scheme/Regular" });
    const onSelection = await loadGroupComparisonGaps(IDS.company, "Regular", opts("COMPANY_ADMIN", "selection"));
    expect(onSelection.find((g) => g.formId === "frm_test_v2")?.fix).toBeNull();
  });
});

describe("使うKPIを選ぶの読み出し（区分ごと）", () => {
  it("その区分の、受付前か受付中の評価期間の下書きか公開中のアンケートだけを返す", async () => {
    await t.db.insert(s.evaluationCycles).values({
      id: "cyc_closed", companyId: IDS.company, name: "2025年度下期", periodStart: "2025-10-01", periodEnd: "2026-03-31",
      schemeId: IDS.scheme, status: "closed",
    });
    await t.db.insert(s.forms).values([
      // 締め切った評価期間のアンケートは、もう直せないので出さない
      { id: "frm_old_cycle", companyId: IDS.company, gradeId: IDS.gradeFrom, cycleId: "cyc_closed", title: "前の期間", status: "published", publicToken: "tok_old_cycle" },
      // 締め切ったアンケートも出さない
      { id: "frm_closed", companyId: IDS.company, gradeId: IDS.gradeFrom, cycleId: IDS.cycle, title: "締め切った版", status: "closed", version: 2, publicToken: "tok_closed" },
    ]);
    const gaps = await loadGroupComparisonGaps(IDS.company, "Regular", opts("COMPANY_ADMIN", "selection"));
    expect(gaps.map((g) => g.formId)).toEqual([IDS.form]);
    expect(gaps[0].current).toBe("selection");
    expect(gaps[0].pages.map((p) => p.current)).toEqual([true, false]);
    expectNoLeak(gaps);
  });

  it("使うKPIをまだ選んでいない区分は、比べる相手が無いので空", async () => {
    expect(await loadGroupComparisonGaps(IDS.company, "Chief", opts("COMPANY_ADMIN", "selection"))).toEqual([]);
  });
});

describe("役割（AC4）", () => {
  it.each(["MANAGER", "EMPLOYEE"] as const)("%s には、リンクも直す操作も出さず、名前と行は出す", async (role) => {
    const gap = (await loadCycleComparisonGaps(IDS.company, IDS.cycle, opts(role))).get(IDS.form)!;
    expect(gap.pages.map((p) => p.href)).toEqual([null, null]);
    expect(gap.fix).toBeNull();
    expect(gap.pages.every((p) => p.label.includes(" › "))).toBe(true);
    expect(gap.rows).toHaveLength(3);
  });

  it.each(["COMPANY_ADMIN", "SUPER_ADMIN"] as const)("%s には、2つのページのリンクを出す", async (role) => {
    const gap = (await loadCycleComparisonGaps(IDS.company, IDS.cycle, opts(role))).get(IDS.form)!;
    expect(gap.pages.every((p) => p.href !== null)).toBe(true);
    expect(gap.fix).not.toBeNull();
  });
});
