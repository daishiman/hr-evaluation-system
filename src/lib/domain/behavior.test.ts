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
  { code: "g1_2", name: "", displayOrder: 1, isActive: true },
  { code: "g3_4", name: "管理職の手前向け", displayOrder: 2, isActive: true },
];

describe("行動指針の等級適用", () => {
  const grades = [
    { id: "beginner", name: "等級1", behaviorBand: "g1_2" },
    { id: "manager", name: "等級5-1", behaviorBand: null },
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
    expect(gradesUsingBand(grades, "g1_2")).toEqual([{ id: "beginner", name: "等級1" }]);
    expect(gradesUsingBand(grades, "g3_4")).toEqual([]);
  });
});

describe("行動指針の基準セット", () => {
  it("呼び名は割り当てた等級から作り、設定に無いコードは隠さずそのまま出す", () => {
    const grades = [
      { name: "等級1", pointGroup: "Beginner", displayOrder: 1, behaviorBand: "g1_2" },
      { name: "等級2", pointGroup: "Regular", displayOrder: 2, behaviorBand: "g1_2" },
    ];
    expect(behaviorBandLabel(sets, "g1_2", grades)).toBe("等級1・等級2向け");
    // 割り当てが無ければ保存した名前、それも空なら並び順の番号で呼ぶ
    expect(behaviorBandLabel(sets, "g3_4", grades)).toBe("管理職の手前向け");
    expect(behaviorBandLabel(sets, "g1_2")).toBe("基準セット1");
    expect(behaviorBandLabel(sets, "band_unknown")).toBe("band_unknown");
    expect(behaviorBandLabel(sets, null)).toBe("");
  });

  it("初期値の名前は空にし、等級名を書き込まない（等級名を変えても呼び名が古くならない）", () => {
    expect(DEFAULT_BAND_SETS.map((set) => set.name)).toEqual(["", ""]);
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
    expect(copiedBandSetName(["等級3・等級4-1向け"], "等級3・等級4-1向け")).toBe("等級3・等級4-1向けのコピー");
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
