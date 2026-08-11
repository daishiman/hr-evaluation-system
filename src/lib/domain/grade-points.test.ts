import { describe, expect, it } from "vitest";
import {
  checkGradePointRule,
  describeRule,
  expectedItemCount,
  indexRules,
  pointsForSlot,
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

describe("indexRules / describeRule", () => {
  it("等級区分の名前で行を引ける", () => {
    expect(indexRules(RULES).get("AM")?.fixedSlotPoints).toBe(30);
    expect(indexRules(RULES).get("存在しない区分")).toBeUndefined();
  });

  it("配点が決まっている理由を1行の日本語で出せる", () => {
    const text = describeRule(ruleOf("Chief"));
    expect(text).toContain("固定枠）40点");
    expect(text).toContain("20点枠を1項目");
    expect(text).toContain("10点ずつ4項目");
    expect(text).toContain("変更できません");
  });

  it("20点枠を持たない等級区分では20点枠の説明を出さない", () => {
    expect(describeRule(ruleOf("Regular"))).not.toContain("金銭系");
    expect(describeRule(ruleOf("Beginner"))).toContain("100点");
  });
});
