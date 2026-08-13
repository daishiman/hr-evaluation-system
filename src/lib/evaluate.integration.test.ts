import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany, seedResponse, HIGHER_BOUNDS } from "@/test-support/evaluation-fixture";
import { scopeEvaluationItem, scopeEvaluationRow, buildRadarValues } from "@/lib/domain/evaluation-view";

/**
 * 評価の集計を、本物のデータベースに対して通しで確かめる。
 *
 * 見たいのは3つ。
 *  1. 出した数字が合っているか（計算）
 *  2. その数字が保管場所に入り、読み出しても同じか（保存）
 *  3. 画面に渡る値が、保存されている値と食い違っていないか（表示）
 * 単体テストだけではこの食い違いは見つからないので、ここでまとめて固定する。
 */

let current: TestDatabase;

vi.mock("@/lib/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  return {
    ...actual,
    getDb: async () => (globalThis as { __testDb?: unknown }).__testDb,
  };
});

const { buildEvaluationsForCycle, listPendingRespondents } = await import("@/lib/evaluate");

beforeEach(() => {
  current = createTestDatabase();
  (globalThis as { __testDb?: unknown }).__testDb = current.db;
});

afterEach(() => {
  current.close();
  delete (globalThis as { __testDb?: unknown }).__testDb;
});

/** 等級要件2問（1問○）・稼働率・残業率・行動指針1問 の標準的な回答一式 */
function standardQuestions(over: {
  req1?: number;
  req2?: number;
  q2_1?: number | null;
  q2_2?: number | null;
  q3_1?: number | null;
  behavior?: number | null;
  gate?: number;
} = {}) {
  return [
    {
      id: "fq_req1",
      section: "support",
      questionType: "yesno",
      title: "等級要件1",
      displayOrder: 1,
      gradeRequirementId: "gr_1",
      answer: over.req1 ?? 1,
    },
    {
      id: "fq_req2",
      section: "support",
      questionType: "yesno",
      title: "等級要件2",
      displayOrder: 2,
      gradeRequirementId: "gr_2",
      answer: over.req2 ?? 1,
    },
    {
      id: "fq_gate",
      section: "training",
      questionType: "yesno",
      title: "受講後報告書を提出した",
      displayOrder: 3,
      isGate: true,
      answer: over.gate ?? 1,
    },
    {
      id: "fq_q2_1",
      section: "kpi",
      questionType: "number",
      title: "稼働日数",
      displayOrder: 4,
      kpiQuestionKey: "q2_1",
      answer: over.q2_1 === undefined ? 100 : over.q2_1,
    },
    {
      id: "fq_q2_2",
      section: "kpi",
      questionType: "number",
      title: "所定日数",
      displayOrder: 5,
      kpiQuestionKey: "q2_2",
      answer: over.q2_2 === undefined ? 100 : over.q2_2,
    },
    {
      id: "fq_q3_1",
      section: "kpi",
      questionType: "number",
      title: "残業率",
      displayOrder: 6,
      kpiQuestionKey: "q3_1",
      answer: over.q3_1 === undefined ? 4 : over.q3_1,
    },
    {
      id: "fq_beh",
      section: "behavior",
      questionType: "single",
      title: "創造性について",
      displayOrder: 7,
      behaviorGuidelineId: IDS.guideline,
      answer: over.behavior === undefined ? 3 : over.behavior,
      answerText: "模範",
    },
  ];
}

async function readEvaluation() {
  const ev = (
    await current.db.select().from(s.evaluations).where(eq(s.evaluations.employeeId, IDS.employee))
  )[0];
  const items = await current.db
    .select()
    .from(s.evaluationItems)
    .where(eq(s.evaluationItems.evaluationId, ev.id))
    .orderBy(s.evaluationItems.displayOrder);
  return { ev, items };
}

describe("評価の集計（保管場所まで通して確かめる）", () => {
  it("全項目Aなら 100点満点・昇給あり。保存された値と読み出した値が一致する", async () => {
    await seedCompany(current);
    // 等級要件は2問中2問○＝100%（A）／稼働率 100%（A）／残業率 4%（A）
    await seedResponse(current, standardQuestions());

    const out = await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    expect(out).toHaveLength(1);
    expect(out[0].ok).toBe(true);

    const { ev, items } = await readEvaluation();
    expect(ev.totalScore).toBe(100);
    expect(ev.maxScore).toBe(100);
    expect(ev.raiseEligible).toBe(true);
    expect(ev.promotionEligible).toBe(true);
    expect(ev.requirementRate).toBe(100);
    expect(ev.requirementAchieved).toBe(2);
    expect(ev.requirementTotal).toBe(2);
    expect(ev.behaviorTotal).toBe(3);
    expect(ev.status).toBe("draft");
    expect(ev.scoringModeSnapshot).toBe("ratio");
    expect(ev.computedAt).toBeInstanceOf(Date);

    // 内訳の合計が、評価に保存された合計と1点も食い違わない
    expect(items).toHaveLength(3);
    expect(items.reduce((a, i) => a + i.points, 0)).toBe(ev.totalScore);
    expect(items.reduce((a, i) => a + i.maxPoints, 0)).toBe(ev.maxScore);
    expect(items.map((i) => i.rank)).toEqual(["A", "A", "A"]);
    expect(items.map((i) => i.points)).toEqual([20, 50, 30]);

    // 昇格の必要点数を、判定した時点の値で写し取っている
    expect(ev.requiredKpiPointsSnapshot).toBe(80);
    expect(ev.requiredBehaviorPointsSnapshot).toBe(3);
  });

  it("ランクごとの割合（A100% B80% C60% D40% E0%）が配点に正しく掛かる", async () => {
    await seedCompany(current, { weights: [20, 50, 30] });
    // 等級要件 2問中1問○＝50%（E）／稼働率 85%（C）／残業率 12%（C）
    await seedResponse(current, standardQuestions({ req2: 0, q2_1: 85, q3_1: 12 }));

    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const { ev, items } = await readEvaluation();

    expect(items.map((i) => [i.itemName, i.actualValue, i.rank, i.points])).toEqual([
      ["等級要件達成率", 50, "E", 0],
      ["稼働率", 85, "C", 30],
      ["残業率", 12, "C", 18],
    ]);
    expect(ev.totalScore).toBe(48);
    expect(ev.raiseEligible).toBe(false);
  });

  it("小数の配点も、合計が小数第1位で丸められて保存される", async () => {
    await seedCompany(current, { weights: [20, 50, 30] });
    // 稼働率 95%（B=0.8→40点）／残業率 7%（B=0.8→24点）／等級要件100%（A=20点）
    await seedResponse(current, standardQuestions({ q2_1: 95, q3_1: 7 }));

    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const { ev, items } = await readEvaluation();
    expect(items.map((i) => i.points)).toEqual([20, 40, 24]);
    expect(ev.totalScore).toBe(84);
    // 昇格に必要な80点は超えているので昇格可
    expect(ev.promotionEligible).toBe(true);
  });

  describe("ランクの境界（下限ちょうど・その両側）", () => {
    // 稼働率の A は「100以上」、B は「90以上100未満」、C は「80以上90未満」
    const cases: [number, string][] = [
      [99.9, "B"],
      [100, "A"],
      [100.1, "A"],
      [89.9, "C"],
      [90, "B"],
      [90.1, "B"],
      [79.9, "D"],
      [80, "C"],
      [80.1, "C"],
      [69.9, "E"],
      [70, "D"],
      [70.1, "D"],
      [0, "E"],
    ];
    for (const [value, rank] of cases) {
      it(`稼働率 ${value}% は ${rank}（保存された値も同じ）`, async () => {
        await seedCompany(current);
        await seedResponse(current, standardQuestions({ q2_1: value }));
        await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
        const { items } = await readEvaluation();
        const row = items.find((i) => i.itemName === "稼働率")!;
        expect(row.actualValue).toBe(value);
        expect(row.rank).toBe(rank);
      });
    }
  });

  describe("逆転指標の境界（上限ちょうど・その両側）", () => {
    // 残業率の A は「5以下」、B は「5超10以下」
    const cases: [number, string][] = [
      [4.9, "A"],
      [5, "A"],
      [5.1, "B"],
      [9.9, "B"],
      [10, "B"],
      [10.1, "C"],
      [20, "D"],
      [20.1, "E"],
      [0, "A"],
      [-1, "A"],
    ];
    for (const [value, rank] of cases) {
      it(`残業率 ${value}% は ${rank}`, async () => {
        await seedCompany(current);
        await seedResponse(current, standardQuestions({ q3_1: value }));
        await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
        const { items } = await readEvaluation();
        expect(items.find((i) => i.itemName === "残業率")!.rank).toBe(rank);
      });
    }
  });

  it("分母が0の項目だけが判定外になり、ほかの項目は最後まで計算される", async () => {
    await seedCompany(current);
    await seedResponse(current, standardQuestions({ q2_2: 0 }));

    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const { ev, items } = await readEvaluation();

    const 稼働率 = items.find((i) => i.itemName === "稼働率")!;
    expect(稼働率.rank).toBeNull();
    expect(稼働率.actualValue).toBeNull();
    expect(稼働率.points).toBe(0);
    // 配点は分母に残す（判定できなかっただけで、満点が減るわけではない）
    expect(稼働率.maxPoints).toBe(50);
    expect(稼働率.rationale).toContain("分母が0");

    // ほかの2項目はきちんとAで、合計は 20 + 0 + 30
    expect(ev.totalScore).toBe(50);
    expect(ev.maxScore).toBe(100);
    // 判定外があるうちは「すべてA」とは言えないので昇給は見送り
    expect(ev.raiseEligible).toBe(false);
    expect(ev.raiseReason).toContain("判定外");
  });

  it("回答が空の項目は判定外になり、Eには落とさない", async () => {
    await seedCompany(current);
    await seedResponse(current, standardQuestions({ q3_1: null }));

    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const { items } = await readEvaluation();
    const 残業率 = items.find((i) => i.itemName === "残業率")!;
    expect(残業率.rank).toBeNull();
    expect(残業率.actualValue).toBeNull();
  });

  it("等級要件の設問が1件も無ければ、固定枠は0%ではなく判定外になる", async () => {
    await seedCompany(current);
    const qs = standardQuestions().filter((q) => !q.gradeRequirementId);
    await seedResponse(current, qs);

    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const { ev, items } = await readEvaluation();
    const 固定枠 = items.find((i) => i.itemName === "等級要件達成率")!;
    expect(固定枠.rank).toBeNull();
    expect(固定枠.actualValue).toBeNull();
    expect(ev.requirementRate).toBeNull();
    expect(ev.requirementTotal).toBe(0);
    expect(固定枠.rationale).toContain("等級要件の設問が1件も含まれていません");
  });

  it("確定済みの評価は、集計し直しても1文字も変わらない", async () => {
    await seedCompany(current);
    await seedResponse(current, standardQuestions());
    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);

    const before = await readEvaluation();
    await current.db
      .update(s.evaluations)
      .set({ status: "finalized" })
      .where(eq(s.evaluations.id, before.ev.id));

    // 基準を書き換えてから集計し直す（確定済みなら影響を受けてはいけない）
    await current.db
      .update(s.kpiRankCriteria)
      .set({ lowerBound: 200 })
      .where(eq(s.kpiRankCriteria.id, `krc_${IDS.itemHigher}_A`));

    const out = await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    expect(out[0].ok).toBe(false);
    expect(out[0].message).toContain("確定済み");

    const after = await readEvaluation();
    expect(after.ev.totalScore).toBe(before.ev.totalScore);
    expect(after.items.map((i) => [i.rank, i.points])).toEqual(
      before.items.map((i) => [i.rank, i.points]),
    );
  });

  it("確認中の評価を集計し直すと、評価IDは変わらず、内訳が二重に増えない", async () => {
    await seedCompany(current);
    await seedResponse(current, standardQuestions());
    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const first = await readEvaluation();

    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const second = await readEvaluation();

    expect(second.ev.id).toBe(first.ev.id);
    expect(second.items).toHaveLength(3);

    const counts = current.raw
      .prepare(
        "select (select count(*) from evaluation_items) i, (select count(*) from evaluation_requirements) r, (select count(*) from evaluation_gates) g, (select count(*) from evaluation_behaviors) b",
      )
      .get() as Record<string, number>;
    expect(counts).toMatchObject({ i: 3, r: 2, g: 1, b: 1 });
  });

  it("等級区分の評価セットが無い人は、0点の評価を作らず理由を返す", async () => {
    await seedCompany(current);
    await seedResponse(current, standardQuestions());
    await current.db.delete(s.schemeItems);

    const out = await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    expect(out[0].ok).toBe(false);
    expect(out[0].message).toContain("評価セットが未設定");
    const rows = await current.db.select().from(s.evaluations);
    expect(rows).toHaveLength(0);
  });

  it("提出済みでない回答は集計しない", async () => {
    await seedCompany(current);
    await seedResponse(current, standardQuestions(), { status: "draft" });
    const out = await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    expect(out).toEqual([]);
  });

  it("対象者を絞ると、その人だけが集計される", async () => {
    await seedCompany(current);
    await seedResponse(current, standardQuestions());
    const out = await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator, {
      employeeIds: ["usr_other"],
    });
    expect(out).toEqual([]);
  });

  it("サイクルが無い・評価セットが無いときは何もしない", async () => {
    await seedCompany(current);
    expect(await buildEvaluationsForCycle(IDS.company, "cyc_none", IDS.evaluator)).toEqual([]);

    await current.db.update(s.evaluationCycles).set({ schemeId: null });
    await current.db.delete(s.evaluationSchemes);
    expect(await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator)).toEqual([]);
  });

  it("行動指針の点数（-1点を含む）がそのまま合計され、保存される", async () => {
    await seedCompany(current, { requiredBehaviorPoints: 3 });
    await seedResponse(current, standardQuestions({ behavior: -1 }));

    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const { ev } = await readEvaluation();
    expect(ev.behaviorTotal).toBe(-1);
    expect(ev.promotionEligible).toBe(false);
    expect(ev.promotionBlockedReason).toContain("行動指針");

    const beh = await current.db.select().from(s.evaluationBehaviors);
    expect(beh[0].score).toBe(-1);
    expect(beh[0].levelLabel).toBe("模範");
  });

  it("行動指針の設問が1件も無ければ、行動指針は判定に使わない", async () => {
    await seedCompany(current, { requiredBehaviorPoints: 99 });
    await seedResponse(current, standardQuestions().filter((q) => !q.behaviorGuidelineId));

    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const { ev } = await readEvaluation();
    expect(ev.behaviorTotal).toBeNull();
    expect(ev.requiredBehaviorPointsSnapshot).toBeNull();
    expect(ev.promotionEligible).toBe(true);
  });

  it("必須ゲートが未達なら、点数が足りていても昇格できない", async () => {
    await seedCompany(current);
    await seedResponse(current, standardQuestions({ gate: 0 }));

    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const { ev } = await readEvaluation();
    expect(ev.totalScore).toBe(100);
    expect(ev.promotionEligible).toBe(false);
    expect(ev.promotionBlockedReason).toContain("昇格要件が未達");

    const gates = await current.db.select().from(s.evaluationGates);
    expect(gates).toHaveLength(1);
    expect(gates[0].achieved).toBe(false);
    expect(gates[0].kind).toBe("report");
  });

  describe("昇格に必要な点数の境界", () => {
    // 稼働率を変えて合計点を動かし、必要点数80点ちょうどの前後を見る
    const cases: [number, number, boolean][] = [
      // 稼働率実績, 合計点, 昇格可否
      [100, 100, true],
      [95, 90, true], // 20 + 40 + 30
      [85, 80, true], // 20 + 30 + 30 → 80点ちょうどは「以上」で満たす
      [75, 70, false], // 20 + 20 + 30
    ];
    for (const [rate, total, eligible] of cases) {
      it(`合計${total}点は昇格${eligible ? "可" : "不可"}`, async () => {
        await seedCompany(current, { requiredKpiPoints: 80, requiredBehaviorPoints: 3 });
        await seedResponse(current, standardQuestions({ q2_1: rate }));
        await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
        const { ev } = await readEvaluation();
        expect(ev.totalScore).toBe(total);
        expect(ev.promotionEligible).toBe(eligible);
      });
    }
  });

  describe("賞与（事業所KGI達成係数）", () => {
    it("達成率100%なら係数1.0。個人Ptと賞与額が保存される", async () => {
      await seedCompany(current, { officeKgiRate: 100, yenPerPoint: 3200 });
      await seedResponse(current, standardQuestions());
      await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
      const { ev } = await readEvaluation();
      expect(ev.officeAchievementRate).toBe(100);
      expect(ev.kgiCoefficient).toBe(1);
      expect(ev.personalPoints).toBe(100);
      expect(ev.bonusYen).toBe(320000);
    });

    it("達成率が未登録なら、0円ではなく空のまま残る", async () => {
      await seedCompany(current, { officeKgiRate: null });
      await seedResponse(current, standardQuestions());
      await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
      const { ev } = await readEvaluation();
      expect(ev.officeAchievementRate).toBeNull();
      expect(ev.kgiCoefficient).toBeNull();
      expect(ev.bonusYen).toBeNull();
      expect(ev.bonusRationale).toContain("未入力");
    });

    it("係数の境界（99.9 / 100 / 100.1）で引き当てが切り替わる", async () => {
      for (const [rate, coefficient] of [
        [99.9, 0.6],
        [100, 1],
        [100.1, 1],
      ] as [number, number][]) {
        const t = createTestDatabase();
        (globalThis as { __testDb?: unknown }).__testDb = t.db;
        const prev = current;
        current = t;
        await seedCompany(current, { officeKgiRate: rate });
        await seedResponse(current, standardQuestions());
        await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
        const { ev } = await readEvaluation();
        expect(ev.kgiCoefficient, `達成率 ${rate}%`).toBe(coefficient);
        t.close();
        current = prev;
        (globalThis as { __testDb?: unknown }).__testDb = current.db;
      }
    });

    it("事業所が分からない回答には、どの達成率も当てない", async () => {
      await seedCompany(current);
      await current.db.update(s.users).set({ officeId: null }).where(eq(s.users.id, IDS.employee));
      await seedResponse(current, standardQuestions(), { officeId: null });
      await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
      const { ev } = await readEvaluation();
      expect(ev.officeId).toBeNull();
      expect(ev.officeAchievementRate).toBeNull();
    });

    it("アンケートに office_kgi_rate の設問があれば、そちらの回答を優先する", async () => {
      await seedCompany(current, { officeKgiRate: 100 });
      await seedResponse(current, [
        ...standardQuestions(),
        {
          id: "fq_kgi",
          section: "kpi",
          questionType: "number",
          title: "事業所KGI達成率",
          displayOrder: 8,
          kpiQuestionKey: "office_kgi_rate",
          answer: 125,
        },
      ]);
      await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
      const { ev } = await readEvaluation();
      expect(ev.officeAchievementRate).toBe(125);
      expect(ev.kgiCoefficient).toBe(1.5);
    });
  });

  describe("保存した値と、画面に渡る値が一致すること", () => {
    it("評価者には保存された点数がそのまま渡る", async () => {
      await seedCompany(current);
      await seedResponse(current, standardQuestions({ q2_1: 85 }));
      await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
      const { ev, items } = await readEvaluation();

      const shownRow = scopeEvaluationRow(ev, true);
      expect(shownRow.totalScore).toBe(ev.totalScore);
      expect(shownRow.maxScore).toBe(ev.maxScore);

      for (const i of items) {
        const shown = scopeEvaluationItem(i, true);
        expect(shown.points).toBe(i.points);
        expect(shown.maxPoints).toBe(i.maxPoints);
        expect(shown.actualValue).toBe(i.actualValue);
        expect(shown.rank).toBe(i.rank);
      }

      const radar = buildRadarValues(items, true);
      expect(radar.map((r) => r.value)).toEqual([100, 60, 100]);
    });

    it("本人には点数・配点・閾値を渡さず、実績値とランクだけを渡す", async () => {
      await seedCompany(current);
      await seedResponse(current, standardQuestions({ q2_1: 85 }));
      await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
      const { ev, items } = await readEvaluation();

      const shownRow = scopeEvaluationRow(ev, false);
      expect(shownRow.totalScore).toBeNull();
      expect(shownRow.maxScore).toBeNull();
      expect(shownRow.behaviorTotal).toBeNull();
      expect(shownRow.requiredKpiPointsSnapshot).toBeNull();

      for (const i of items) {
        const shown = scopeEvaluationItem(i, false);
        expect(shown.points).toBeNull();
        expect(shown.maxPoints).toBeNull();
        expect(shown.thresholdLabel).toBeNull();
        expect(shown.calcNote).toBeNull();
        // 実績値とランクは本人にも見せてよい。保存された値と一致すること
        expect(shown.actualValue).toBe(i.actualValue);
        expect(shown.rank).toBe(i.rank);
        // 本人向けの文に点数・閾値が混ざっていない
        expect(shown.rationale).not.toMatch(/点|配点|満点|以上|未満/);
      }
    });

    it("判定外の項目は、レーダーで0点と混ざらない", async () => {
      await seedCompany(current);
      await seedResponse(current, standardQuestions({ q2_2: 0 }));
      await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
      const { items } = await readEvaluation();
      const radar = buildRadarValues(items, true);
      const 稼働率 = radar.find((r) => r.item === "稼働率")!;
      expect(稼働率.value).toBeNull();
      expect(稼働率.unrated).toBe(true);
    });
  });

  it("ランク基準に穴があると、最下位に丸めたうえでその事実を残す", async () => {
    await seedCompany(current);
    await seedResponse(current, standardQuestions({ q2_1: 85 }));
    // 稼働率の C（80以上90未満）を消して、85% がどこにも当たらない状態にする
    await current.db
      .delete(s.kpiRankCriteria)
      .where(eq(s.kpiRankCriteria.id, `krc_${IDS.itemHigher}_C`));

    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const { items } = await readEvaluation();
    const 稼働率 = items.find((i) => i.itemName === "稼働率")!;
    expect(稼働率.rank).toBe("E");
    expect(稼働率.points).toBe(0);
    expect(稼働率.rationale).toContain("基準表の見直しが必要");
  });

  it("ランク基準が1件も無い項目も、集計を止めずに最下位として残す", async () => {
    await seedCompany(current);
    await seedResponse(current, standardQuestions());
    await current.db
      .delete(s.kpiRankCriteria)
      .where(eq(s.kpiRankCriteria.kpiItemId, IDS.itemHigher));

    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const { items } = await readEvaluation();
    const 稼働率 = items.find((i) => i.itemName === "稼働率")!;
    expect(稼働率.rank).toBe("E");
    expect(稼働率.thresholdLabel).toBeNull();
  });

  it("すべてAを求めない設定では、満点に届いたときだけ昇給になる", async () => {
    await seedCompany(current, { raiseRequiresAllA: false });
    await seedResponse(current, standardQuestions({ q2_1: 95 }));
    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const { ev } = await readEvaluation();
    expect(ev.totalScore).toBe(90);
    expect(ev.raiseEligible).toBe(false);
    expect(ev.raiseReason).toContain("90");
    expect(ev.raiseReasonEmployee).not.toMatch(/[0-9]+点/);
  });

  it("未提出の人を、状態つきで一覧できる", async () => {
    await seedCompany(current);
    await seedResponse(current, standardQuestions());
    const pending = await listPendingRespondents(IDS.company, IDS.cycle);
    expect(pending).toEqual([
      { id: IDS.employee, name: "本人", gradeId: IDS.gradeFrom, status: "submitted" },
    ]);

    await current.db.update(s.formResponses).set({ status: "draft" });
    const draft = await listPendingRespondents(IDS.company, IDS.cycle);
    expect(draft[0].status).toBe("draft");

    await current.db.delete(s.formResponses);
    const after = await listPendingRespondents(IDS.company, IDS.cycle);
    expect(after[0].status).toBe("none");
  });

  it("利用停止中の人は、未提出の一覧から外れる（提出済みの回答は残ったまま）", async () => {
    await seedCompany(current);
    await seedResponse(current, standardQuestions());
    await current.db.update(s.users).set({ isActive: false }).where(eq(s.users.id, IDS.employee));

    const pending = await listPendingRespondents(IDS.company, IDS.cycle);
    expect(pending).toEqual([]);

    const response = await current.db
      .select()
      .from(s.formResponses)
      .where(eq(s.formResponses.employeeId, IDS.employee));
    expect(response).toHaveLength(1);
  });

  it("アンケートが1件も無ければ、未提出者の一覧は空になる", async () => {
    await seedCompany(current);
    await current.db.delete(s.forms);
    expect(await listPendingRespondents(IDS.company, IDS.cycle)).toEqual([]);
  });

  it("基準の下限・上限は、判定した時点の値が内訳に写し取られる", async () => {
    await seedCompany(current);
    await seedResponse(current, standardQuestions({ q2_1: 85 }));
    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const { items } = await readEvaluation();
    const 稼働率 = items.find((i) => i.itemName === "稼働率")!;
    const c = HIGHER_BOUNDS.find((b) => b.rank === "C")!;
    expect(稼働率.thresholdLower).toBe(c.lower);
    expect(稼働率.thresholdUpper).toBe(c.upper);
    expect(稼働率.thresholdLabel).toBe("80%以上 90%未満");
  });
});

/**
 * ここから下は、めったに起きないが起きたときに数字が黙って変わる経路。
 * 設定の抜け・所属の取り違え・等級区分ごとの定数を、保管場所まで通して固定する。
 */
describe("設定に抜けがある・条件が変わる場合", () => {
  it("AM等級では「1人あたり必要回数」が3回になる（ほかの等級は2回）", async () => {
    await seedCompany(current);
    // 等級区分を AM にし、その定数を使う計算式に差し替える
    await current.db.update(s.grades).set({ pointGroup: "AM" }).where(eq(s.grades.id, IDS.gradeFrom));
    await current.db.update(s.schemeItems).set({ pointGroup: "AM" });
    await current.db
      .update(s.kpiItems)
      .set({ formula: "q2_1 ÷ 【等級別の1人あたり必要回数】 × 100" })
      .where(eq(s.kpiItems.id, IDS.itemHigher));
    // 3件 ÷ 3回 = 100%（A）。2回だったなら150%になり、同じAでも実績値が変わる
    await seedResponse(current, standardQuestions({ q2_1: 3 }));

    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const { items } = await readEvaluation();
    expect(items.find((i) => i.itemName === "稼働率")!.actualValue).toBe(100);
  });

  it("Regular等級では同じ計算式が2回で割られる", async () => {
    await seedCompany(current);
    await current.db
      .update(s.kpiItems)
      .set({ formula: "q2_1 ÷ 【等級別の1人あたり必要回数】 × 100" })
      .where(eq(s.kpiItems.id, IDS.itemHigher));
    await seedResponse(current, standardQuestions({ q2_1: 3 }));

    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const { items } = await readEvaluation();
    expect(items.find((i) => i.itemName === "稼働率")!.actualValue).toBe(150);
  });

  it("昇格の必要点数が未設定なら、必要点数は空のまま保存し、0点として扱わない", async () => {
    await seedCompany(current);
    await current.db.delete(s.promotionThresholds);
    await seedResponse(current, standardQuestions());

    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const { ev } = await readEvaluation();
    expect(ev.requiredKpiPointsSnapshot).toBeNull();
    expect(ev.requiredBehaviorPointsSnapshot).toBeNull();
    expect(ev.totalScore).toBe(100);
  });

  it("賞与の単価が未設定なら、賞与額は空にする（0円と書かない）", async () => {
    await seedCompany(current);
    await current.db.delete(s.raisePolicies);
    await seedResponse(current, standardQuestions());

    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const { ev } = await readEvaluation();
    expect(ev.kgiCoefficient).toBe(1);
    expect(ev.personalPoints).toBe(100);
    expect(ev.bonusYen).toBeNull();
  });

  it("回答に所属が入っていなければ、その人のいまの所属で達成率を引く", async () => {
    await seedCompany(current);
    await seedResponse(current, standardQuestions(), { officeId: null });

    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const { ev } = await readEvaluation();
    expect(ev.officeAchievementRate).toBe(100);
    expect(ev.kgiCoefficient).toBe(1);
  });

  it("回答にも本人にも所属が無ければ、達成率は空のまま（0%にしない）", async () => {
    await seedCompany(current);
    await current.db.update(s.users).set({ officeId: null }).where(eq(s.users.id, IDS.employee));
    await seedResponse(current, standardQuestions(), { officeId: null });

    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const { ev } = await readEvaluation();
    expect(ev.officeAchievementRate).toBeNull();
    expect(ev.kgiCoefficient).toBeNull();
    expect(ev.bonusYen).toBeNull();
  });

  it("分類が未設定の項目は「等級要件（固定枠）」として保存する（空欄にしない）", async () => {
    await seedCompany(current);
    await current.db.update(s.schemeItems).set({ categoryId: null }).where(eq(s.schemeItems.id, "si_1"));
    await seedResponse(current, standardQuestions());

    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const { items } = await readEvaluation();
    expect(items.find((i) => i.itemName === "等級要件達成率")!.categoryName).toBe("等級要件（固定枠）");
  });

  it("判定外になった項目でも、分類が未設定なら同じ呼び名で保存する", async () => {
    await seedCompany(current);
    await current.db.update(s.schemeItems).set({ categoryId: null }).where(eq(s.schemeItems.id, "si_1"));
    // 等級要件の設問を外すと、達成率が出せず固定枠が判定外になる
    await seedResponse(
      current,
      standardQuestions().filter((q) => !q.gradeRequirementId),
    );

    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const { items } = await readEvaluation();
    const fixed = items.find((i) => i.itemName === "等級要件達成率")!;
    expect(fixed.rank).toBeNull();
    expect(fixed.categoryName).toBe("等級要件（固定枠）");
    expect(fixed.rationale).toContain("等級要件を追加してください");
  });

  it("研修以外の昇格要件は「試験」として扱う", async () => {
    await seedCompany(current);
    const qs = standardQuestions().map((q) =>
      q.id === "fq_gate" ? { ...q, section: "test", title: "昇格試験に合格した", answer: 0 } : q,
    );
    await seedResponse(current, qs);

    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const gates = await current.db.select().from(s.evaluationGates);
    expect(gates).toHaveLength(1);
    expect(gates[0].kind).toBe("test");
    expect(gates[0].achieved).toBe(false);

    const { ev } = await readEvaluation();
    expect(ev.promotionEligible).toBe(false);
  });

  it("行動指針の回答に言葉の控えが無くても、点数は保存する", async () => {
    await seedCompany(current);
    const qs = standardQuestions().map((q) =>
      q.id === "fq_beh" ? { ...q, answerText: undefined } : q,
    );
    await seedResponse(current, qs);

    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const { ev } = await readEvaluation();
    expect(ev.behaviorTotal).toBe(3);
    const beh = await current.db.select().from(s.evaluationBehaviors);
    expect(beh[0].score).toBe(3);
    expect(beh[0].levelLabel).toBe("");
  });

  it("KPIの回答が空の設問は、計算に使う値として持ち込まない", async () => {
    await seedCompany(current);
    await seedResponse(current, standardQuestions({ q2_2: null }));

    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const { items } = await readEvaluation();
    const 稼働率 = items.find((i) => i.itemName === "稼働率")!;
    // 空欄を0として計算すると「分母0」になる。判定外にして、Eに落とさない
    expect(稼働率.rank).toBeNull();
    expect(稼働率.points).toBe(0);
    expect(稼働率.rationale).toContain("入力されていません");
    // ほかの項目はそのまま計算されている
    expect(items.find((i) => i.itemName === "残業率")!.rank).toBe("A");
  });

  it("計算式が未登録の項目は判定外にする（Eに落とさない）", async () => {
    await seedCompany(current);
    await current.db.update(s.kpiItems).set({ formula: null }).where(eq(s.kpiItems.id, IDS.itemHigher));
    await seedResponse(current, standardQuestions());

    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const { ev, items } = await readEvaluation();
    const 稼働率 = items.find((i) => i.itemName === "稼働率")!;
    expect(稼働率.rank).toBeNull();
    expect(稼働率.actualValue).toBeNull();
    expect(稼働率.points).toBe(0);
    expect(稼働率.rationale).toContain("判定外");
    // 満点は50点ぶん残るので、判定外があると自動で満点に届かなくなる
    expect(ev.maxScore).toBe(100);
    expect(ev.totalScore).toBe(50);
    expect(ev.raiseEligible).toBe(false);
  });

  it("行動指針に未回答があれば0点として数える（-1点にはしない）", async () => {
    await seedCompany(current);
    const qs = standardQuestions().map((q) =>
      q.id === "fq_beh" ? { ...q, answer: null, answerText: undefined } : q,
    );
    await seedResponse(current, qs);

    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const { ev } = await readEvaluation();
    expect(ev.behaviorTotal).toBe(0);
    const beh = await current.db.select().from(s.evaluationBehaviors);
    expect(beh[0].score).toBe(0);
    expect(beh[0].levelLabel).toBe("");
    // 行動指針の必要点数（3点）に届かないので昇格しない
    expect(ev.promotionEligible).toBe(false);
  });

  /**
   * 行動指針のマスタ行が消えている場合の逃げ道（`g?.aspect ?? ""`）は、
   * 保管場所の側で参照が守られているため実際には通らない。
   * 行を消して再現しようとすると、集計そのものが保存の時点で止まる。
   * ＝この分岐は「到達不能な保険」であり、テストが書けていないのではない。
   */
  it("行動指針のマスタは、評価が残っている間は消せない（参照が守られている）", async () => {
    await seedCompany(current);
    await seedResponse(current, standardQuestions());
    current.raw.exec("PRAGMA foreign_keys = OFF");
    current.raw.prepare("delete from behavior_guidelines").run();
    current.raw.exec("PRAGMA foreign_keys = ON");

    const out = await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    expect(out[0].ok).toBe(false);
    expect(await current.db.select().from(s.evaluationBehaviors)).toEqual([]);
  });

  it("評価セットに残った、実体の無いKPI項目は黙って飛ばす（ほかの項目は計算する）", async () => {
    await seedCompany(current);
    await seedResponse(current, standardQuestions());
    current.raw.exec("PRAGMA foreign_keys = OFF");
    current.raw.prepare("delete from kpi_items where id = ?").run(IDS.itemLower);
    current.raw.exec("PRAGMA foreign_keys = ON");

    await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    const { ev, items } = await readEvaluation();
    expect(items.map((i) => i.itemName)).toEqual(["等級要件達成率", "稼働率"]);
    // 満点も実体のある項目ぶんだけになる（30点ぶんが幽霊として残らない）
    expect(ev.maxScore).toBe(70);
    expect(ev.totalScore).toBe(70);
  });

  it("等級が見当たらない回答は集計の対象にしない", async () => {
    await seedCompany(current);
    await seedResponse(current, standardQuestions());
    current.raw.exec("PRAGMA foreign_keys = OFF");
    current.raw.prepare("update form_responses set grade_id = ?").run("grd_missing");
    current.raw.exec("PRAGMA foreign_keys = ON");

    const out = await buildEvaluationsForCycle(IDS.company, IDS.cycle, IDS.evaluator);
    expect(out).toEqual([]);
    expect(await current.db.select().from(s.evaluations)).toEqual([]);
  });
});
