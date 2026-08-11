import { describe, expect, it } from "vitest";
import { validateScheme, type SchemeSelection, type ValidateSchemeOptions } from "./scheme";
import { pointsForSlot, type GradePointRule } from "./grade-points";

/**
 * 等級区分ごとの評価セットの検証。
 *
 * 「その等級区分で選べる項目」は kpi_reference_points に行があるかどうかが正で、
 * 実測値は Beginner=1 / Regular=10 / Chief=26 / AM=32 / Manager=33 項目。
 * ここではその関係だけを再現した最小のダミーで固定する（項目Noは実データに合わせている）。
 */

const RULES: Record<string, GradePointRule> = {
  Beginner: { pointGroup: "Beginner", totalPoints: 100, fixedSlotPoints: 100, majorSlotPoints: 0, majorSlotCount: 0, minorSlotPoints: 10, minorSlotCount: 0 },
  Regular: { pointGroup: "Regular", totalPoints: 100, fixedSlotPoints: 80, majorSlotPoints: 0, majorSlotCount: 0, minorSlotPoints: 10, minorSlotCount: 2 },
  Chief: { pointGroup: "Chief", totalPoints: 100, fixedSlotPoints: 40, majorSlotPoints: 20, majorSlotCount: 1, minorSlotPoints: 10, minorSlotCount: 4 },
  AM: { pointGroup: "AM", totalPoints: 100, fixedSlotPoints: 30, majorSlotPoints: 20, majorSlotCount: 1, minorSlotPoints: 10, minorSlotCount: 5 },
  Manager: { pointGroup: "Manager", totalPoints: 100, fixedSlotPoints: 20, majorSlotPoints: 20, majorSlotCount: 1, minorSlotPoints: 10, minorSlotCount: 6 },
};

/** 固定枠は No.1、金銭系は No.6 単価率 / No.9 売上達成率 / No.24 利益率 */
const FIXED = ["k1"];
const MONETARY = ["k6", "k9", "k24"];

/** その等級区分で選べる項目（実データの件数に合わせた一覧。No.24 は Chief では対象外） */
const SELECTABLE: Record<string, string[]> = {
  Beginner: ["k1"],
  Regular: ["k1", "k2", "k3", "k5", "k7", "k10", "k11", "k13", "k16", "k27"],
  Chief: ["k1", "k2", "k3", "k5", "k6", "k7", "k9", "k10", "k11", "k13", "k16", "k27"],
  AM: ["k1", "k2", "k3", "k5", "k6", "k7", "k9", "k10", "k11", "k13", "k16", "k24", "k27"],
  Manager: ["k1", "k2", "k3", "k5", "k6", "k7", "k9", "k10", "k11", "k13", "k16", "k24", "k27"],
};

function opts(group: string, over?: Partial<ValidateSchemeOptions>): ValidateSchemeOptions {
  return {
    rule: RULES[group],
    selectableItemIds: SELECTABLE[group],
    fixedSlotItemIds: FIXED,
    monetaryItemIds: MONETARY,
    ...over,
  };
}

/** 正しい選び方を組み立てる。配点は等級区分の型から入れる（画面と同じ考え方）。 */
function build(group: string, majorId: string | null, minorIds: string[]): SchemeSelection[] {
  const rule = RULES[group];
  const rows: SchemeSelection[] = [
    { kpiItemId: "k1", categoryId: null, weight: pointsForSlot(rule, "fixed"), isFixedSlot: true, isMajorSlot: false },
  ];
  if (majorId) {
    rows.push({ kpiItemId: majorId, categoryId: "sales", weight: pointsForSlot(rule, "major"), isFixedSlot: false, isMajorSlot: true });
  }
  for (const id of minorIds) {
    rows.push({ kpiItemId: id, categoryId: "other", weight: pointsForSlot(rule, "minor"), isFixedSlot: false, isMajorSlot: false });
  }
  return rows;
}

const VALID: Record<string, SchemeSelection[]> = {
  Beginner: build("Beginner", null, []),
  Regular: build("Regular", null, ["k2", "k3"]),
  Chief: build("Chief", "k9", ["k2", "k3", "k5", "k7"]),
  AM: build("AM", "k24", ["k2", "k3", "k5", "k7", "k10"]),
  Manager: build("Manager", "k6", ["k2", "k3", "k5", "k7", "k10", "k11"]),
};

describe("validateScheme — 等級区分ごとの正しい組み合わせ", () => {
  for (const [group, rows] of Object.entries(VALID)) {
    it(`${group} は合計100点ちょうどで通る`, () => {
      const r = validateScheme(rows, opts(group));
      expect(r.errors).toEqual([]);
      expect(r.ok).toBe(true);
      expect(r.total).toBe(100);
    });
  }

  it("項目数は Beginner=1 / Regular=3 / Chief=6 / AM=7 / Manager=8", () => {
    expect(Object.entries(VALID).map(([g, rows]) => [g, rows.length])).toEqual([
      ["Beginner", 1],
      ["Regular", 3],
      ["Chief", 6],
      ["AM", 7],
      ["Manager", 8],
    ]);
  });
});

describe("validateScheme — 項目数", () => {
  it("足りないときは「あと何件」を日本語で伝える", () => {
    const rows = VALID.Manager.slice(0, 6);
    const r = validateScheme(rows, opts("Manager"));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("8件です") && e.includes("あと2件選んで"))).toBe(true);
  });

  it("多すぎるときは「何件外すか」を伝える", () => {
    const rows = [...VALID.Regular, { kpiItemId: "k5", categoryId: null, weight: 10, isFixedSlot: false, isMajorSlot: false }];
    const r = validateScheme(rows, opts("Regular"));
    expect(r.errors.some((e) => e.includes("1件外して"))).toBe(true);
  });
});

describe("validateScheme — 固定枠", () => {
  it("固定枠がないと弾く", () => {
    const rows = VALID.Chief.map((x, i) => (i === 0 ? { ...x, isFixedSlot: false } : x));
    const r = validateScheme(rows, opts("Chief"));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("固定枠") && e.includes("1件"))).toBe(true);
  });

  it("等級要件達成率でない項目を固定枠にできない（APIを直接叩かれても通さない）", () => {
    const rows = VALID.Chief.map((x, i) => (i === 0 ? { ...x, kpiItemId: "k13" } : x));
    const r = validateScheme(rows, opts("Chief", { itemNameOf: (id) => (id === "k13" ? "支援計画期限遵守率" : id) }));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("支援計画期限遵守率") && e.includes("固定枠にできません"))).toBe(true);
  });
});

describe("validateScheme — 20点枠（金銭系）", () => {
  it("Chief以上は金銭系をちょうど1件選ぶ", () => {
    const rows = VALID.Chief.map((x) => ({ ...x, isMajorSlot: false, weight: x.isFixedSlot ? x.weight : 10 }));
    const r = validateScheme(rows, opts("Chief"));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("20点枠（金銭系）はちょうど1件"))).toBe(true);
  });

  it("金銭系でない項目を20点枠にできない", () => {
    const rows = VALID.Manager.map((x, i) => (i === 1 ? { ...x, kpiItemId: "k13" } : x));
    const r = validateScheme(rows, opts("Manager", { itemNameOf: () => "支援計画期限遵守率" }));
    expect(r.errors.some((e) => e.includes("20点枠に置けるのは金銭系"))).toBe(true);
  });

  it("Beginner・Regular に20点枠は無い", () => {
    for (const group of ["Beginner", "Regular"]) {
      // 20点枠を1件ねじ込む（Beginner は固定枠しか無いので足す形になる）
      const rows = [
        ...VALID[group],
        { kpiItemId: "k9", categoryId: "sales", weight: 20, isFixedSlot: false, isMajorSlot: true },
      ];
      const r = validateScheme(rows, opts(group));
      expect(r.ok, group).toBe(false);
      expect(r.errors.some((e) => e.includes("点枠はありません")), group).toBe(true);
    }
  });

  it("No.24 利益率は Chief では選べない（AM・Manager では選べる）", () => {
    const chief = validateScheme(build("Chief", "k24", ["k2", "k3", "k5", "k7"]), opts("Chief", { itemNameOf: () => "利益率" }));
    expect(chief.ok).toBe(false);
    expect(chief.errors.some((e) => e.includes("利益率") && e.includes("Chief") && e.includes("評価対象ではない"))).toBe(true);
    expect(validateScheme(VALID.AM, opts("AM")).ok).toBe(true);
  });
});

describe("validateScheme — 選択可否と配点", () => {
  it("その等級区分で評価対象でない項目は選べない", () => {
    const rows = build("Regular", null, ["k2", "k9"]);
    const r = validateScheme(rows, opts("Regular", { itemNameOf: () => "売上達成率" }));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("Regular の評価対象ではない"))).toBe(true);
  });

  it("配点が等級区分の型と違えば弾く（ユーザー入力は信用しない）", () => {
    const rows = VALID.Manager.map((x, i) => (i === 0 ? { ...x, weight: 40 } : x));
    const r = validateScheme(rows, opts("Manager", { itemNameOf: () => "等級要件達成率" }));
    expect(r.errors.some((e) => e.includes("配点は20点です") && e.includes("いまは40点"))).toBe(true);
    expect(r.errors.some((e) => e.includes("合計が120点"))).toBe(true);
  });

  it("配点0の項目は弾く（評価しない項目は0点の行ではなく行を作らない方針）", () => {
    const rows = VALID.Regular.map((x, i) => (i === 2 ? { ...x, weight: 0 } : x));
    const r = validateScheme(rows, opts("Regular"));
    expect(r.errors.some((e) => e.includes("1点以上"))).toBe(true);
  });

  it("同じ項目を2回選ぶと弾く", () => {
    const rows = build("Regular", null, ["k2", "k2"]);
    const r = validateScheme(rows, opts("Regular"));
    expect(r.errors.some((e) => e.includes("重複"))).toBe(true);
  });
});
