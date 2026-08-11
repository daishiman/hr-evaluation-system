import { describe, expect, it } from "vitest";
import {
  computeGroupProgress,
  groupPosition,
  nextGroupOf,
  overallProgress,
  schemeStepPath,
  stepNumber,
  stepTitle,
  STEPS,
  type GroupProgress,
} from "./scheme-steps";
import { RULES } from "./grade-points.test";

const ruleOf = (group: string) => RULES.find((r) => r.pointGroup === group)!;
const ORDER = RULES.map((r) => r.pointGroup);

/** その等級区分で「型どおりに選び終わっている」状態を作る */
function fullPick(group: string) {
  const rule = ruleOf(group);
  const saved = [{ kpiItemId: "fixed", isFixedSlot: true, isMajorSlot: false }];
  for (let i = 0; i < rule.majorSlotCount; i++) {
    saved.push({ kpiItemId: `major${i}`, isFixedSlot: false, isMajorSlot: true });
  }
  for (let i = 0; i < rule.minorSlotCount; i++) {
    saved.push({ kpiItemId: `minor${i}`, isFixedSlot: false, isMajorSlot: false });
  }
  return saved;
}

const allIds = (group: string) => fullPick(group).map((x) => x.kpiItemId);

describe("computeGroupProgress — 等級区分1つの進み具合", () => {
  it("型どおりに選び、全項目に基準があれば設定済みになる（5区分すべて）", () => {
    for (const rule of RULES) {
      const p = computeGroupProgress({ rule, saved: fullPick(rule.pointGroup), ratedItemIds: allIds(rule.pointGroup) });
      expect(p.selectionDone, rule.pointGroup).toBe(true);
      expect(p.criteriaDone, rule.pointGroup).toBe(true);
      expect(p.done, rule.pointGroup).toBe(true);
      expect(p.nextStep, rule.pointGroup).toBeNull();
      // 選び終わった状態は必ず満点ちょうどになる（配点の検算）
      expect(p.totalPoints, rule.pointGroup).toBe(rule.totalPoints);
      expect(p.selectedCount, rule.pointGroup).toBe(p.expectedCount);
    }
  });

  it("1件も選んでいなければ、選ぶ件数を数えて知らせる", () => {
    const p = computeGroupProgress({ rule: ruleOf("Manager"), saved: [], ratedItemIds: [] });
    expect(p.selectionDone).toBe(false);
    expect(p.nextStep).toBe("select");
    expect(p.nextAction).toContain("8件");
  });

  it("足りないときは「あと何件」を出す", () => {
    const saved = fullPick("Chief").slice(0, 4); // 6件のうち4件
    const p = computeGroupProgress({ rule: ruleOf("Chief"), saved, ratedItemIds: allIds("Chief") });
    expect(p.selectionDone).toBe(false);
    expect(p.nextAction).toContain("あと2件");
  });

  it("多すぎるときは「外してください」を出す（超過を設定済みと数えない）", () => {
    const saved = [...fullPick("Regular"), { kpiItemId: "extra", isFixedSlot: false, isMajorSlot: false }];
    const p = computeGroupProgress({ rule: ruleOf("Regular"), saved, ratedItemIds: [...allIds("Regular"), "extra"] });
    expect(p.selectionDone).toBe(false);
    expect(p.done).toBe(false);
    expect(p.nextAction).toContain("1件多い");
    // 超過ぶんは点数にも出る（100点を超える）
    expect(p.totalPoints).toBeGreaterThan(p.maxPoints);
  });

  it("選び終わっていても基準が未設定なら、手順2が残る", () => {
    const p = computeGroupProgress({
      rule: ruleOf("Regular"),
      saved: fullPick("Regular"),
      ratedItemIds: ["fixed"], // 10点の2項目に基準が無い
    });
    expect(p.selectionDone).toBe(true);
    expect(p.criteriaDone).toBe(false);
    expect(p.unratedCount).toBe(2);
    expect(p.nextStep).toBe("criteria");
    expect(p.nextAction).toContain("2件");
  });

  it("Beginner は固定枠1件だけで設定済みになる（0点の行を作らない）", () => {
    const p = computeGroupProgress({
      rule: ruleOf("Beginner"),
      saved: [{ kpiItemId: "fixed", isFixedSlot: true, isMajorSlot: false }],
      ratedItemIds: ["fixed"],
    });
    expect(p.done).toBe(true);
    expect(p.expectedCount).toBe(1);
    expect(p.totalPoints).toBe(100);
  });

  it("枠の種類を取り違えると合計が満点にならず、設定済みにならない", () => {
    // Chief の20点枠を10点枠として保存してしまった場合（40 + 10 + 10×4 = 90点）
    const saved = fullPick("Chief").map((x) => (x.isMajorSlot ? { ...x, isMajorSlot: false } : x));
    const p = computeGroupProgress({ rule: ruleOf("Chief"), saved, ratedItemIds: allIds("Chief") });
    expect(p.totalPoints).toBe(90);
    expect(p.selectionDone).toBe(false);
    expect(p.nextAction).toContain("100点");
  });
});

describe("nextGroupOf / groupPosition — 次の等級区分へ送る", () => {
  it("並びの順に次を返し、最後は null（制度設定ガイドへ戻す合図）", () => {
    expect(nextGroupOf(ORDER, "Beginner")).toBe("Regular");
    expect(nextGroupOf(ORDER, "AM")).toBe("Manager");
    expect(nextGroupOf(ORDER, "Manager")).toBeNull();
  });

  it("並びに無い等級区分では次を作らない", () => {
    expect(nextGroupOf(ORDER, "存在しない区分")).toBeNull();
  });

  it("何番目かを1始まりで返す", () => {
    expect(groupPosition(ORDER, "Beginner")).toBe(1);
    expect(groupPosition(ORDER, "Manager")).toBe(5);
    expect(groupPosition(ORDER, "存在しない区分")).toBe(0);
  });
});

describe("overallProgress — 入口に出す全体の進み具合", () => {
  const progressOf = (dones: boolean[]): GroupProgress[] =>
    ORDER.map((g, i) => ({
      pointGroup: g,
      selectedCount: 0,
      expectedCount: 0,
      totalPoints: 0,
      maxPoints: 100,
      selectionDone: dones[i],
      criteriaDone: dones[i],
      done: dones[i],
      unratedCount: 0,
      nextAction: "",
      nextStep: dones[i] ? null : "select",
    }));

  it("未完了のうち「並びが最初のもの」を次に案内する", () => {
    const p = overallProgress(progressOf([true, false, true, false, false]));
    expect(p.done).toBe(2);
    expect(p.total).toBe(5);
    expect(p.nextGroup).toBe("Regular");
    expect(p.summary).toContain("Regular");
  });

  it("すべて終わっていれば次の等級区分を出さない", () => {
    const p = overallProgress(progressOf([true, true, true, true, true]));
    expect(p.nextGroup).toBeNull();
    expect(p.summary).toContain("すべて");
  });
});

describe("手順の名前とURL", () => {
  it("手順は2つで、番号は1始まり", () => {
    expect(STEPS).toEqual(["select", "criteria"]);
    expect(stepNumber("select")).toBe(1);
    expect(stepNumber("criteria")).toBe(2);
  });

  it("手順名は1箇所で決める（画面ごとに言い換えない）", () => {
    expect(stepTitle("select")).toBe("使うKPIを選ぶ");
    expect(stepTitle("criteria")).toBe("選んだ項目の基準を決める");
  });

  it("URLは等級区分名を安全に埋め込む", () => {
    expect(schemeStepPath("Regular", "select")).toBe("/admin/scheme/Regular");
    expect(schemeStepPath("Regular", "criteria")).toBe("/admin/scheme/Regular/criteria");
    expect(schemeStepPath("AM Ⅰ", "select")).toBe(`/admin/scheme/${encodeURIComponent("AM Ⅰ")}`);
  });
});
