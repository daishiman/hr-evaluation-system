import { describe, expect, it } from "vitest";
import {
  RULE_NOTES,
  checkGradePointRule,
  expectedItemCount,
  indexRules,
  pointsForSlot,
  ruleBreakdown,
  slotKindOf,
  targetsPointGroup,
  type GradePointRule,
} from "./grade-points";

/**
 * 確定した5つの等級区分の型をここで固定する。
 *
 * 値は data/kpi-points.json のランクA行から読み取った実測値（→ authoritative-criteria.test.ts）。
 * このテストが落ちたときは「制度を変えた」か「マスタが壊れた」かのどちらかで、
 * どちらにしてもユーザーへの確認が要る合図になる。
 */
export const RULES: GradePointRule[] = [
  { pointGroup: "Beginner", totalPoints: 100, fixedSlotPoints: 100, majorSlotPoints: 0, majorSlotCount: 0, minorSlotPoints: 10, minorSlotCount: 0 },
  { pointGroup: "Regular", totalPoints: 100, fixedSlotPoints: 80, majorSlotPoints: 0, majorSlotCount: 0, minorSlotPoints: 10, minorSlotCount: 2 },
  { pointGroup: "Chief", totalPoints: 100, fixedSlotPoints: 40, majorSlotPoints: 20, majorSlotCount: 1, minorSlotPoints: 10, minorSlotCount: 4 },
  { pointGroup: "AM", totalPoints: 100, fixedSlotPoints: 30, majorSlotPoints: 20, majorSlotCount: 1, minorSlotPoints: 10, minorSlotCount: 5 },
  { pointGroup: "Manager", totalPoints: 100, fixedSlotPoints: 20, majorSlotPoints: 20, majorSlotCount: 1, minorSlotPoints: 10, minorSlotCount: 6 },
];

const ruleOf = (group: string) => RULES.find((r) => r.pointGroup === group)!;

describe("expectedItemCount — 等級区分ごとに選ぶ項目数", () => {
  it("Beginner=1 / Regular=3 / Chief=6 / AM=7 / Manager=8", () => {
    expect(expectedItemCount(ruleOf("Beginner"))).toBe(1);
    expect(expectedItemCount(ruleOf("Regular"))).toBe(3);
    expect(expectedItemCount(ruleOf("Chief"))).toBe(6);
    expect(expectedItemCount(ruleOf("AM"))).toBe(7);
    expect(expectedItemCount(ruleOf("Manager"))).toBe(8);
  });
});

describe("checkGradePointRule — 配点の型の検算", () => {
  it("5つの等級区分すべてで合計が100点ちょうどになる", () => {
    for (const r of RULES) expect(checkGradePointRule(r), r.pointGroup).toEqual([]);
  });

  it("合計が満点にならない行は日本語で指摘する", () => {
    const broken = { ...ruleOf("Manager"), minorSlotCount: 5 };
    const errors = checkGradePointRule(broken);
    expect(errors.some((e) => e.includes("90点") && e.includes("100点"))).toBe(true);
  });

  it("固定枠が0点の行は弾く（等級要件達成率は全等級で必須のため）", () => {
    const broken = { ...ruleOf("Manager"), fixedSlotPoints: 0, minorSlotCount: 8 };
    expect(checkGradePointRule(broken).some((e) => e.includes("固定枠"))).toBe(true);
  });

  it("20点枠を持つのに配点が0点なら弾く", () => {
    const broken = { ...ruleOf("Chief"), majorSlotPoints: 0 };
    expect(checkGradePointRule(broken).some((e) => e.includes("20点枠"))).toBe(true);
  });
});

describe("pointsForSlot — 項目1つの配点", () => {
  it("固定枠は等級区分ごとの固定枠配点（100/80/40/30/20）になる", () => {
    expect(RULES.map((r) => pointsForSlot(r, "fixed"))).toEqual([100, 80, 40, 30, 20]);
  });

  it("Chief以上の20点枠は20点、それ以外の項目は10点", () => {
    for (const g of ["Chief", "AM", "Manager"]) {
      expect(pointsForSlot(ruleOf(g), "major"), g).toBe(20);
      expect(pointsForSlot(ruleOf(g), "minor"), g).toBe(10);
    }
  });

  it("等級区分の項目をすべて足すとちょうど満点になる", () => {
    for (const r of RULES) {
      const total =
        pointsForSlot(r, "fixed") +
        pointsForSlot(r, "major") * r.majorSlotCount +
        pointsForSlot(r, "minor") * r.minorSlotCount;
      expect(total, r.pointGroup).toBe(r.totalPoints);
    }
  });
});

describe("slotKindOf — 枠の種類", () => {
  it("固定枠は20点枠の指定より優先する（等級要件達成率は金銭系ではないため）", () => {
    expect(slotKindOf({ isFixedSlot: true, isMajorSlot: true })).toBe("fixed");
    expect(slotKindOf({ isFixedSlot: false, isMajorSlot: true })).toBe("major");
    expect(slotKindOf({ isFixedSlot: false, isMajorSlot: false })).toBe("minor");
    expect(slotKindOf({ isFixedSlot: false })).toBe("minor");
  });
});

describe("targetsPointGroup — 「対象等級」欄の解釈", () => {
  it("全角スラッシュ区切りの一覧から等級区分を拾う（元シートの表記そのまま）", () => {
    const t = "Chief／AM／Manager";
    expect(targetsPointGroup(t, "Chief")).toBe(true);
    expect(targetsPointGroup(t, "Manager")).toBe(true);
    expect(targetsPointGroup(t, "Regular")).toBe(false);
    expect(targetsPointGroup(t, "Beginner")).toBe(false);
  });

  it("空欄と「全等級」はすべての等級区分が対象", () => {
    for (const g of ["Beginner", "Regular", "Chief", "AM", "Manager"]) {
      expect(targetsPointGroup("", g), g).toBe(true);
      expect(targetsPointGroup(null, g), g).toBe(true);
      expect(targetsPointGroup("全等級", g), g).toBe(true);
    }
  });

  it("1つだけ書かれている場合も拾う（Manager 限定の設問）", () => {
    expect(targetsPointGroup("Manager", "Manager")).toBe(true);
    expect(targetsPointGroup("Manager", "AM")).toBe(false);
  });

  it("AM は Manager の一部ではない（前方一致で拾わない）", () => {
    expect(targetsPointGroup("AM／Manager", "AM")).toBe(true);
    expect(targetsPointGroup("Manager", "AM")).toBe(false);
    expect(targetsPointGroup("Beginner", "Begin")).toBe(false);
  });
});

describe("indexRules / ruleBreakdown", () => {
  it("等級区分の名前で行を引ける", () => {
    expect(indexRules(RULES).get("AM")?.fixedSlotPoints).toBe(30);
    expect(indexRules(RULES).get("存在しない区分")).toBeUndefined();
  });

  it("満点の内訳を、枠ごとの1件に分けて返す（1本の文にしない）", () => {
    const parts = ruleBreakdown(ruleOf("Chief"));
    expect(parts.map((p) => p.kind)).toEqual(["fixed", "major", "minor"]);
    expect(parts[0]).toMatchObject({ label: "等級要件達成率（固定枠）", detail: null, points: 40 });
    expect(parts[1]).toMatchObject({ label: "20点枠", detail: "20点 × 1項目", points: 20 });
    expect(parts[2]).toMatchObject({ label: "ほかの項目", detail: "10点 × 4項目", points: 40 });
  });

  it("内訳の小計を足すと満点になる（全等級区分）", () => {
    for (const rule of RULES) {
      expect(ruleBreakdown(rule).reduce((sum, p) => sum + p.points, 0)).toBe(rule.totalPoints);
    }
  });

  it("持っていない枠は内訳に出さない", () => {
    // Regular は20点枠を持たない
    expect(ruleBreakdown(ruleOf("Regular")).map((p) => p.kind)).toEqual(["fixed", "minor"]);
    // Beginner は固定枠だけで満点になる
    expect(ruleBreakdown(ruleOf("Beginner"))).toEqual([
      { kind: "fixed", label: "等級要件達成率（固定枠）", detail: null, points: 100 },
    ]);
  });

  it("配点が動かせない理由は、1文＝1つのことで並べてある", () => {
    expect(RULE_NOTES.some((n) => n.includes("変更できません"))).toBe(true);
    for (const note of RULE_NOTES) expect(note.length).toBeLessThanOrEqual(40);
  });
});
