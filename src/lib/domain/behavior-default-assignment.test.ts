import { describe, expect, it } from "vitest";
import { DEFAULT_BAND_SETS } from "@/lib/domain/behavior";
import {
  bandAssignmentName,
  DEFAULT_BEHAVIOR_BAND,
  describeBandAssignment,
  type BandAssignmentGrade,
  type BandAssignmentSet,
} from "@/lib/domain/behavior-default-assignment";
import { DEFAULT_GRADE_NAMES } from "@/lib/domain/grade-label";

/** 既定の7つの等級（data/grades.json・seed と同じ並びと割り当て） */
const CODES = ["beginner", "regular", "chief", "am1", "am2", "manager1", "manager2"] as const;
type Code = (typeof CODES)[number];

const grades = (
  overrides: Partial<Record<Code, Partial<BandAssignmentGrade>>> = {},
): BandAssignmentGrade[] =>
  CODES.map((code, i) => ({
    id: `grd_${code}`,
    code,
    name: DEFAULT_GRADE_NAMES[code],
    displayOrder: i + 1,
    isActive: true,
    behaviorBand: DEFAULT_BEHAVIOR_BAND[code],
    ...overrides[code],
  }));

/** 会社を作ったときのまとまり（名前は空。画面の並び順） */
const SETS: BandAssignmentSet[] = DEFAULT_BAND_SETS.map((set) => ({ code: set.code, name: set.name, isActive: true }));

const DEFAULT_SENTENCE = "等級1・等級2に1つ目、等級3・等級4-1・等級4-2に2つ目を出し、等級5-1・等級5-2には出しません。";

describe("既定の割り当て（DEFAULT_BEHAVIOR_BAND）", () => {
  it("7つの識別子に、等級1・等級2は1つ目、等級3〜等級4-2は2つ目、等級5-1・等級5-2は出さない", () => {
    expect(DEFAULT_BEHAVIOR_BAND).toEqual({
      beginner: "g1_2",
      regular: "g1_2",
      chief: "g3_4",
      am1: "g3_4",
      am2: "g3_4",
      manager1: null,
      manager2: null,
    });
  });

  it("識別子は既定の等級名と同じ7つで、割り当て先は会社を作ったときのまとまりのどれか", () => {
    expect(Object.keys(DEFAULT_BEHAVIOR_BAND).sort()).toEqual(Object.keys(DEFAULT_GRADE_NAMES).sort());
    const codes = DEFAULT_BAND_SETS.map((set) => set.code as string);
    for (const band of Object.values(DEFAULT_BEHAVIOR_BAND)) {
      if (band !== null) expect(codes).toContain(band);
    }
  });
});

describe("いまの割り当ての説明（describeBandAssignment）", () => {
  it("既定どおりの会社は、既定の分け方を1文で示し、違う等級は無い", () => {
    expect(describeBandAssignment(grades(), SETS)).toEqual({
      sentence: DEFAULT_SENTENCE,
      matchesDefault: true,
      differences: [],
    });
  });

  it("等級名は会社のいまの名前を使い、呼び名を変えても識別子で既定と比べる", () => {
    const renamed = grades({ beginner: { name: "新人" }, regular: { name: "一般" }, manager2: { name: "部長" } });

    const summary = describeBandAssignment(renamed, SETS);

    expect(summary.sentence).toBe("新人・一般に1つ目、等級3・等級4-1・等級4-2に2つ目を出し、等級5-1・部長には出しません。");
    expect(summary.matchesDefault).toBe(true);
  });

  it("等級1だけが2つ目へ移った会社は、いまの分け方を示し、等級1を違う等級に挙げる", () => {
    const drifted = grades({ beginner: { behaviorBand: "g3_4" } });

    expect(describeBandAssignment(drifted, SETS)).toEqual({
      sentence: "等級1に2つ目、等級2に1つ目、等級3・等級4-1・等級4-2に2つ目を出し、等級5-1・等級5-2には出しません。",
      matchesDefault: false,
      differences: [{ code: "beginner", name: "等級1", expected: "g1_2", actual: "g3_4" }],
    });
  });

  it("違う等級は、渡した順ではなく等級の並びの順（同着は id の順）に並べる", () => {
    const changed = grades({
      manager2: { behaviorBand: "g3_4" },
      beginner: { behaviorBand: null },
      // 並びの番号が同着の2つは id の順（am2 が先）
      am1: { displayOrder: 4, id: "grd_b", behaviorBand: null },
      am2: { displayOrder: 4, id: "grd_a", behaviorBand: "g1_2" },
    }).reverse();

    const { differences } = describeBandAssignment(changed, SETS);

    expect(differences).toEqual([
      { code: "beginner", name: "等級1", expected: "g1_2", actual: null },
      { code: "am2", name: "等級4-2", expected: "g3_4", actual: "g1_2" },
      { code: "am1", name: "等級4-1", expected: "g3_4", actual: null },
      { code: "manager2", name: "等級5-2", expected: null, actual: "g3_4" },
    ]);
  });

  it("名前を付けたまとまりは名前で、名前が空なら並びの位置で呼ぶ", () => {
    const sets: BandAssignmentSet[] = [
      { code: "g1_2", name: " 基礎 ", isActive: true },
      { code: "g3_4", name: "", isActive: true },
    ];

    expect(describeBandAssignment(grades(), sets).sentence).toBe(
      "等級1・等級2に「基礎」、等級3・等級4-1・等級4-2に2つ目を出し、等級5-1・等級5-2には出しません。",
    );
  });

  it("会社の設定に無いまとまりは、識別子をそのまま出す（消えたように見せない）", () => {
    const summary = describeBandAssignment(grades({ manager1: { behaviorBand: "old" }, manager2: { behaviorBand: "old" } }), SETS);

    expect(summary.sentence).toBe("等級1・等級2に1つ目、等級3・等級4-1・等級4-2に2つ目、等級5-1・等級5-2に「old」を出します。");
    expect(summary.matchesDefault).toBe(false);
  });

  it("使用を止めたまとまりは、呼び名に「使用しない」を添える", () => {
    const sets: BandAssignmentSet[] = [SETS[0], { ...SETS[1], isActive: false }];

    expect(describeBandAssignment(grades(), sets).sentence).toBe(
      "等級1・等級2に1つ目、等級3・等級4-1・等級4-2に2つ目（使用しない）を出し、等級5-1・等級5-2には出しません。",
    );
  });

  it("使用を止めた等級は、文にも違う等級にも入れない", () => {
    const stopped = grades({ regular: { isActive: false, behaviorBand: "g3_4" }, manager1: { isActive: false } });

    expect(describeBandAssignment(stopped, SETS)).toEqual({
      sentence: "等級1に1つ目、等級3・等級4-1・等級4-2に2つ目を出し、等級5-2には出しません。",
      matchesDefault: true,
      differences: [],
    });
  });

  it("会社が足した等級は文に入れ、既定とは比べない（識別子が Object の名前でも）", () => {
    const added: BandAssignmentGrade[] = [
      ...grades(),
      { id: "grd_x", code: "toString", name: "特別職", displayOrder: 8, isActive: true, behaviorBand: "g3_4" },
    ];

    expect(describeBandAssignment(added, SETS)).toEqual({
      sentence: "等級1・等級2に1つ目、等級3・等級4-1・等級4-2に2つ目、特別職に2つ目を出し、等級5-1・等級5-2には出しません。",
      matchesDefault: true,
      differences: [],
    });
  });

  it("名前が空の等級は「等級未設定」と呼ぶ", () => {
    const summary = describeBandAssignment(grades({ beginner: { name: " " } }), SETS);

    expect(summary.sentence).toBe("等級未設定・等級2に1つ目、等級3・等級4-1・等級4-2に2つ目を出し、等級5-1・等級5-2には出しません。");
  });

  it("出さない等級が無ければ「出します」で終える", () => {
    const all = grades({ manager1: { behaviorBand: "g3_4" }, manager2: { behaviorBand: "g3_4" } });

    expect(describeBandAssignment(all, SETS).sentence).toBe("等級1・等級2に1つ目、等級3・等級4-1・等級4-2・等級5-1・等級5-2に2つ目を出します。");
  });

  it("どの等級にも出さない会社は、その旨の1文にする", () => {
    const none = grades(Object.fromEntries(CODES.map((code) => [code, { behaviorBand: null }])));

    const summary = describeBandAssignment(none, SETS);

    expect(summary.sentence).toBe("どの等級にも行動指針を出しません。");
    expect(summary.differences.map((d) => d.code)).toEqual(["beginner", "regular", "chief", "am1", "am2"]);
  });

  it("使用中の等級が無い会社は、その旨の1文にする", () => {
    expect(describeBandAssignment(grades(Object.fromEntries(CODES.map((code) => [code, { isActive: false }]))), SETS)).toEqual({
      sentence: "使用中の等級がありません。",
      matchesDefault: true,
      differences: [],
    });
    expect(describeBandAssignment([], []).sentence).toBe("使用中の等級がありません。");
  });

  it("出すまとまりが4つ以上に分かれたら、分けた数で要約する（文は分けない）", () => {
    const split = grades({ regular: { behaviorBand: "g3_4" }, chief: { behaviorBand: "g1_2" } });

    expect(describeBandAssignment(split, SETS).sentence).toBe(
      "行動指針は4つのまとまりに分けて出し、等級5-1・等級5-2には出しません。",
    );
    const noHidden = grades({
      regular: { behaviorBand: "g3_4" },
      chief: { behaviorBand: "g1_2" },
      manager1: { behaviorBand: "g3_4" },
      manager2: { behaviorBand: "g3_4" },
    });
    expect(describeBandAssignment(noHidden, SETS).sentence).toBe("行動指針は4つのまとまりに分けて出します。");
  });

  it("出さない等級が並びの途中にあっても、出さない等級は文の終わりにまとめる", () => {
    const gap = grades({ regular: { behaviorBand: null } });

    expect(describeBandAssignment(gap, SETS).sentence).toBe(
      "等級1に1つ目、等級3・等級4-1・等級4-2に2つ目を出し、等級2・等級5-1・等級5-2には出しません。",
    );
  });
});

describe("まとまりの呼び名（bandAssignmentName）", () => {
  it("出さない（null）は「出さない」、ほかは説明の1文と同じ呼び名", () => {
    expect(bandAssignmentName(SETS, null)).toBe("出さない");
    expect(bandAssignmentName(SETS, "g1_2")).toBe("1つ目");
    expect(bandAssignmentName([{ code: "g1_2", name: "基礎", isActive: false }], "g1_2")).toBe("「基礎」（使用しない）");
    expect(bandAssignmentName(SETS, "old")).toBe("「old」");
  });
});
