/**
 * 「起きないはず」と思っていた道を、実際に通してみる検査。
 *
 * 集計は、ひとりぶんの計算でつまずいても、ほかの人の集計を続けるようにできている。
 * その受け止め方（何を理由として出すか）は、つまずき方によって変わる。
 * ここでは **本当にその道を通せるのか** を確かめ、通せることを固定する。
 */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany, seedResponse } from "@/test-support/evaluation-fixture";

let current: TestDatabase;

vi.mock("@/lib/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  return {
    ...actual,
    getDb: async () => (globalThis as { __testDb?: unknown }).__testDb,
  };
});

const { buildEvaluationsForCycle, UNRATED_RATIONALE } = await import("@/lib/evaluate");

beforeEach(() => {
  current = createTestDatabase();
  (globalThis as { __testDb?: unknown }).__testDb = current.db;
});

afterEach(() => {
  current.close();
  delete (globalThis as { __testDb?: unknown }).__testDb;
});

function questions() {
  return [
    { id: "fq_req1", section: "support", questionType: "yesno", title: "等級要件1", displayOrder: 1, gradeRequirementId: "gr_1", answer: 1 },
    { id: "fq_req2", section: "support", questionType: "yesno", title: "等級要件2", displayOrder: 2, gradeRequirementId: "gr_2", answer: 1 },
    { id: "fq_q2_1", section: "kpi", questionType: "number", title: "稼働時間", displayOrder: 4, kpiQuestionKey: "q2_1", answer: 90 },
    { id: "fq_q2_2", section: "kpi", questionType: "number", title: "総時間", displayOrder: 5, kpiQuestionKey: "q2_2", answer: 100 },
    { id: "fq_q3_1", section: "kpi", questionType: "number", title: "残業率", displayOrder: 6, kpiQuestionKey: "q3_1", answer: 3 },
  ];
}

describe("計算式そのものが手に負えない場合", () => {
  /**
   * 括弧が極端に深い式は、計算式の書式としては正しいのに、以前は計算の途中で
   * 処理そのものが続けられなくなり、「理由の分からない判定外」になっていた。
   * いまは式の複雑さに上限があるので、**読んで直せる言葉**で止まる。
   * ほかの項目・ほかの人の集計が続くことは、以前と変わらない。
   */
  it("その項目だけを判定外にし、直せる言葉を添える。ほかの項目とほかの人の集計は続く", async () => {
    await seedCompany(current);
    // 括弧を2万重ねた式。書式としては正しいが、複雑すぎるものとして断られる。
    const deep = "(".repeat(20000) + "q2_1" + ")".repeat(20000);
    await current.db.update(s.kpiItems).set({ formula: deep }).where(eq(s.kpiItems.id, IDS.itemHigher));
    await seedResponse(current, questions());

    const out = await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    expect(out[0].ok).toBe(true);

    const items = await current.db
      .select()
      .from(s.evaluationItems)
      .where(eq(s.evaluationItems.kpiItemId, IDS.itemHigher));
    expect(items[0].actualValue).toBeNull();
    expect(items[0].rank).toBeNull();
    expect(items[0].points).toBe(0);
    // 計算機の内部事情ではなく、制度をいじる人が動ける言葉になっていること
    expect(items[0].rationale).toContain("計算式");
    expect(items[0].rationale).toContain("判定外");
    expect(items[0].rationale).not.toBe(UNRATED_RATIONALE);

    // 残業率のほうは、いつもどおり判定できている
    const lower = await current.db
      .select()
      .from(s.evaluationItems)
      .where(eq(s.evaluationItems.kpiItemId, IDS.itemLower));
    expect(lower[0].rank).toBe("A");
  });

  /**
   * 上限を置いたことで「計算式の不備として説明できない止まり方」はほぼ無くなったが、
   * 受け止める側は残してある。**残した以上、その道も通しておく**
   * （通らない保険は、いざというときに効かない）。
   */
  it("計算式の不備として説明できない止まり方なら、既定の理由にする", async () => {
    await seedCompany(current);
    await seedResponse(current, questions());

    const formula = await import("@/lib/domain/formula");
    const spy = vi.spyOn(formula, "computeActualValue").mockImplementation(() => {
      throw new Error("説明のつかない止まり方");
    });
    try {
      const out = await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
      expect(out[0].ok).toBe(true);
      const items = await current.db
        .select()
        .from(s.evaluationItems)
        .where(eq(s.evaluationItems.kpiItemId, IDS.itemHigher));
      // 中身（内部の止まり方）は画面に出さず、読む人が動ける言葉にする
      expect(items[0].rationale).toBe(UNRATED_RATIONALE);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("保存の途中で、理由の分からない止まり方をした場合", () => {
  /**
   * データベース側が「文章になっていないもの」を投げてくることがありうる。
   * そのときも、その人だけを失敗として残し、ほかの人の集計は続ける。
   */
  it("その人だけを失敗として残し、画面に出せる言葉にする", async () => {
    await seedCompany(current);
    await seedResponse(current, questions());

    const real = current.db;
    const broken = new Proxy(real, {
      get(target, prop, receiver) {
        if (prop === "insert") {
          return (table: unknown) => {
            // 評価そのものの保存だけを、文章になっていない形で止める
            if (table === s.evaluations) throw "とつぜん止まりました";
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (Reflect.get(target, prop, receiver) as any).call(target, table);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    (globalThis as { __testDb?: unknown }).__testDb = broken;

    const out = await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    expect(out).toHaveLength(1);
    expect(out[0].ok).toBe(false);
    expect(out[0].message).toBe("集計できませんでした。");
    expect(out[0].employeeId).toBe(IDS.employee);

    // 中途半端な評価が残っていないこと
    (globalThis as { __testDb?: unknown }).__testDb = real;
    const saved = await real.select().from(s.evaluations);
    expect(saved).toHaveLength(0);
  });

  it("文章になっている止まり方なら、その中身を添えて出す", async () => {
    await seedCompany(current);
    await seedResponse(current, questions());

    const real = current.db;
    const broken = new Proxy(real, {
      get(target, prop, receiver) {
        if (prop === "insert") {
          return (table: unknown) => {
            if (table === s.evaluations) throw new Error("保存先が見つかりません");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (Reflect.get(target, prop, receiver) as any).call(target, table);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    (globalThis as { __testDb?: unknown }).__testDb = broken;

    const out = await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    expect(out[0].ok).toBe(false);
    expect(out[0].message).toBe("集計できませんでした：保存先が見つかりません");
  });
});
