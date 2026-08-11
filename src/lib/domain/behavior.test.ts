import { describe, expect, it } from "vitest";
import {
  behaviorBandForGrade,
  behaviorBandLabel,
  behaviorBandPayloadValue,
  BEHAVIOR_LEVEL_TEMPLATE,
  copiedBandSetName,
  DEFAULT_BAND_SETS,
  gradesUsingBand,
  nextDisplayOrder,
  sortBandSets,
} from "./behavior";

const sets = [
  { code: "g1_2", name: "Beginner・Regular向け", displayOrder: 1, isActive: true },
  { code: "g3_4", name: "Chief・AM向け", displayOrder: 2, isActive: true },
];

describe("行動指針の等級適用", () => {
  const grades = [
    { id: "beginner", name: "等級１：Beginner", behaviorBand: "g1_2" },
    { id: "manager", name: "等級５：Manager Ⅰ", behaviorBand: null },
  ];

  it("選んだ等級の現在値を返し、別等級の値を持ち越さない", () => {
    expect(behaviorBandForGrade(grades, "beginner")).toBe("g1_2");
    expect(behaviorBandForGrade(grades, "manager")).toBeNull();
    expect(behaviorBandForGrade(grades, "unknown")).toBeNull();
  });

  it("適用しない選択肢はDB契約の null にそろえる", () => {
    expect(behaviorBandPayloadValue("")).toBeNull();
    expect(behaviorBandPayloadValue("g3_4")).toBe("g3_4");
  });

  it("使用を止める前に、その基準を出している等級が分かる", () => {
    expect(gradesUsingBand(grades, "g1_2")).toEqual([{ id: "beginner", name: "等級１：Beginner" }]);
    expect(gradesUsingBand(grades, "g3_4")).toEqual([]);
  });
});

describe("行動指針の基準セット", () => {
  it("呼び名は会社の設定を正本にし、設定に無いコードは隠さずそのまま出す", () => {
    expect(behaviorBandLabel(sets, "g1_2")).toBe("Beginner・Regular向け");
    expect(behaviorBandLabel(sets, "band_unknown")).toBe("band_unknown");
    expect(behaviorBandLabel(sets, null)).toBe("");
  });

  it("初期値の呼び名は等級名にそろえる（等級1〜2という言い方をしない）", () => {
    expect(DEFAULT_BAND_SETS.map((set) => set.name)).toEqual(["Beginner・Regular向け", "Chief・AM向け"]);
    for (const set of DEFAULT_BAND_SETS) {
      expect(set.name).not.toContain("等級");
    }
  });

  it("並び順は会社が決めた順。同着はコードで安定させる", () => {
    const shuffled = [
      { code: "b", name: "B", displayOrder: 2, isActive: true },
      { code: "c", name: "C", displayOrder: 1, isActive: true },
      { code: "a", name: "A", displayOrder: 1, isActive: true },
    ];
    expect(sortBandSets(shuffled).map((set) => set.code)).toEqual(["a", "c", "b"]);
  });

  it("複製の既定名は必ず既存と重ならない", () => {
    expect(copiedBandSetName(["Chief・AM向け"], "Chief・AM向け")).toBe("Chief・AM向けのコピー");
    expect(copiedBandSetName(["A", "Aのコピー"], "A")).toBe("Aのコピー2");
    expect(copiedBandSetName(["A", "Aのコピー", "Aのコピー2"], "A")).toBe("Aのコピー3");
  });

  it("新しいセットは一番後ろに足す", () => {
    expect(nextDisplayOrder([{ displayOrder: 1 }, { displayOrder: 4 }])).toBe(5);
    expect(nextDisplayOrder([])).toBe(1);
  });

  it("追加した観点にも制度どおりの5段階が付く（点数は会社ごとに動かさない）", () => {
    expect(BEHAVIOR_LEVEL_TEMPLATE.map((level) => level.score)).toEqual([3, 2, 1, 0, -1]);
    expect(BEHAVIOR_LEVEL_TEMPLATE.map((level) => level.label)).toEqual(["模範", "信頼", "安定", "不安定", "悪影響"]);
  });
});
