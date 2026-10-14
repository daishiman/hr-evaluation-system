import { describe, expect, it } from "vitest";
import { bandLine } from "./behavior-band-range";
import {
  DEFAULT_GRADE_NAMES,
  bandSetLabel,
  formDisplayTitle,
  formRowTitle,
  gradeLabel,
  pointGroupLabel,
  promotionStepFrom,
  promotionStepLabel,
  targetGradesLabel,
} from "@/lib/domain/grade-label";

/*
 * 等級の呼び名（S1・A1・A2）。
 *
 * 画面に出す等級の呼び名は、会社の等級名から表示のたびに作る。
 * 英語の区分名（Beginner など）やカタカナの呼び名は、どの関数からも出てこない。
 */

const GRADES = [
  { id: "g1", code: "beginner", name: "等級1", pointGroup: "Beginner", displayOrder: 1, behaviorBand: "g1_2" },
  { id: "g2", code: "regular", name: "等級2", pointGroup: "Regular", displayOrder: 2, behaviorBand: "g1_2" },
  { id: "g3", code: "chief", name: "等級3", pointGroup: "Chief", displayOrder: 3, behaviorBand: "g3_4" },
  { id: "g41", code: "am1", name: "等級4-1", pointGroup: "AM", displayOrder: 4, behaviorBand: "g3_4" },
  { id: "g42", code: "am2", name: "等級4-2", pointGroup: "AM", displayOrder: 5, behaviorBand: null },
  { id: "g51", code: "manager1", name: "等級5-1", pointGroup: "Manager", displayOrder: 6, behaviorBand: null },
  { id: "g52", code: "manager2", name: "等級5-2", pointGroup: "Manager", displayOrder: 7, behaviorBand: null },
];

describe("DEFAULT_GRADE_NAMES", () => {
  it("code ごとの既定は「等級4-1」の形で、英語を含まない", () => {
    expect(DEFAULT_GRADE_NAMES).toEqual({
      beginner: "等級1",
      regular: "等級2",
      chief: "等級3",
      am1: "等級4-1",
      am2: "等級4-2",
      manager1: "等級5-1",
      manager2: "等級5-2",
    });
    for (const name of Object.values(DEFAULT_GRADE_NAMES)) expect(name).not.toMatch(/[A-Za-z]|：/);
  });
});

describe("gradeLabel", () => {
  it("会社の等級名をそのまま返す", () => {
    expect(gradeLabel({ name: "等級4-1" })).toBe("等級4-1");
  });

  it("等級が無いとき・名前が空のときは「等級未設定」に1つにまとめる", () => {
    expect(gradeLabel(null)).toBe("等級未設定");
    expect(gradeLabel(undefined)).toBe("等級未設定");
    expect(gradeLabel({ name: "  " })).toBe("等級未設定");
  });
});

describe("pointGroupLabel", () => {
  it("その区分の等級を表示の順に「・」でつなぐ（区分名そのものは出さない）", () => {
    expect(pointGroupLabel("AM", GRADES)).toBe("等級4-1・等級4-2");
    expect(pointGroupLabel("Manager", [...GRADES].reverse())).toBe("等級5-1・等級5-2");
    expect(pointGroupLabel("Beginner", GRADES)).toBe("等級1");
  });

  it("その区分に等級が無いときは「等級未設定」", () => {
    expect(pointGroupLabel("Unknown", GRADES)).toBe("等級未設定");
  });
});

describe("bandSetLabel", () => {
  it("割り当てた等級があれば「等級1・等級2向け」", () => {
    expect(bandSetLabel({ code: "g1_2", name: "", displayOrder: 1 }, GRADES)).toBe("等級1・等級2向け");
    expect(bandSetLabel({ code: "g3_4", name: "Chief・AM向け", displayOrder: 2 }, GRADES)).toBe("等級3・等級4-1向け");
  });

  it("割り当てが無ければ保存した名前、それも空なら「基準セット{n}」", () => {
    expect(bandSetLabel({ code: "custom", name: "新人向け", displayOrder: 3 }, GRADES)).toBe("新人向け");
    expect(bandSetLabel({ code: "custom", name: "", displayOrder: 3 }, GRADES)).toBe("基準セット3");
  });

  it("表示順が同着なら id の順にし、分け方の並びと呼び名が一致する", () => {
    const tied = [
      { ...GRADES[1], id: "b", displayOrder: 1, isActive: true },
      { ...GRADES[0], id: "a", displayOrder: 1, isActive: true },
    ];
    expect(bandLine(tied).map((grade) => grade.name)).toEqual(["等級1", "等級2"]);
    expect(bandSetLabel({ code: "g1_2", name: "", displayOrder: 1 }, tied)).toBe("等級1・等級2向け");
    expect(bandSetLabel({ code: "g1_2", name: "", displayOrder: 1 }, [...tied].reverse())).toBe("等級1・等級2向け");
    // 名前だけの読取り結果でも使え、同着で id が無いときは元の順を保つ。
    const namesOnly = tied.map(({ id: _id, ...grade }) => grade);
    expect(bandSetLabel({ code: "g1_2", name: "", displayOrder: 1 }, namesOnly)).toBe("等級2・等級1向け");
  });

  it("使用を止めた等級は数えない（使用中かを持たない等級は使用中とみなす）", () => {
    const stopped = GRADES.map((g) => (g.id === "g2" ? { ...g, isActive: false } : { ...g, isActive: true }));
    expect(bandSetLabel({ code: "g1_2", name: "", displayOrder: 1 }, stopped)).toBe("等級1向け");
    const allStopped = GRADES.map((g) => (g.behaviorBand === "g1_2" ? { ...g, isActive: false } : g));
    expect(bandSetLabel({ code: "g1_2", name: "新人向け", displayOrder: 1 }, allStopped)).toBe("新人向け");
  });
});

describe("promotionStepLabel", () => {
  it("「等級1→等級2」の形", () => {
    expect(promotionStepLabel({ name: "等級1" }, { name: "等級2" })).toBe("等級1→等級2");
    expect(promotionStepLabel(null, { name: "等級2" })).toBe("等級未設定→等級2");
  });
});

describe("promotionStepFrom", () => {
  it("点数の線引きがあれば、その行き先までの段階を等級名で作る", () => {
    const thresholds = [{ fromGradeId: "g3", toGradeId: "g41" }];
    expect(promotionStepFrom("g3", GRADES, thresholds)).toBe("等級3→等級4-1");
  });

  it("線引きが無ければ、表示の順で1つ上の等級へ（並びが乱れていても順で選ぶ）", () => {
    expect(promotionStepFrom("g1", [...GRADES].reverse())).toBe("等級1→等級2");
    expect(promotionStepFrom("g42", GRADES, [])).toBe("等級4-2→等級5-1");
  });

  it("線引きの行き先が見つからないときも、表示の順で1つ上へ", () => {
    expect(promotionStepFrom("g2", GRADES, [{ fromGradeId: "g2", toGradeId: "gone" }])).toBe("等級2→等級3");
  });

  it("最上位の等級・知らない等級は null", () => {
    expect(promotionStepFrom("g52", GRADES)).toBeNull();
    expect(promotionStepFrom("nope", GRADES)).toBeNull();
  });

  it("等級名を変えると、段階の呼び名も変わる（保存した段階の文字列は使わない）", () => {
    const renamed = GRADES.map((g) => (g.id === "g1" ? { ...g, name: "新人" } : g));
    expect(promotionStepFrom("g1", renamed, [{ fromGradeId: "g1", toGradeId: "g2" }])).toBe("新人→等級2");
  });
});

describe("targetGradesLabel", () => {
  it("照合は生の値（区分）で行い、表示だけを等級名にする", () => {
    expect(targetGradesLabel("Chief／AM", GRADES)).toBe("等級3・等級4-1・等級4-2");
    expect(targetGradesLabel("Regular/Chief", GRADES)).toBe("等級2・等級3");
  });

  it("空・未指定・「全等級」は「全等級」", () => {
    expect(targetGradesLabel(null, GRADES)).toBe("全等級");
    expect(targetGradesLabel("", GRADES)).toBe("全等級");
    expect(targetGradesLabel("全等級", GRADES)).toBe("全等級");
  });

  it("等級名で書かれていても受け付け、どれにも当たらなければ書かれた文をそのまま出す", () => {
    expect(targetGradesLabel("等級5-2・等級1", GRADES)).toBe("等級1・等級5-2");
    expect(targetGradesLabel("新人", GRADES)).toBe("新人");
  });

  it("名前の無い等級・評価期間でも呼び名を作れる", () => {
    expect(gradeLabel({ name: null })).toBe("等級未設定");
    expect(bandSetLabel({ code: "custom", name: null, displayOrder: 2 }, GRADES)).toBe("基準セット2");
    expect(formDisplayTitle({ title: null }, null, { name: "等級1" })).toBe("等級1 実績アンケート");
  });
});

describe("formDisplayTitle", () => {
  it("題名が空なら「{評価期間} {等級名} 実績アンケート」", () => {
    expect(formDisplayTitle({ title: "" }, { name: "2026年上期" }, { name: "等級3" })).toBe(
      "2026年上期 等級3 実績アンケート",
    );
    expect(formDisplayTitle({ title: "   " }, { name: "2026年上期" }, null)).toBe("2026年上期 等級未設定 実績アンケート");
  });

  it("利用者が付けた題名は書き換えない", () => {
    expect(formDisplayTitle({ title: "春の振り返り" }, { name: "2026年上期" }, { name: "等級3" })).toBe("春の振り返り");
  });

  it("一覧の行からは、結合した評価期間名・等級名で作る（無ければ「等級未設定」）", () => {
    expect(formRowTitle({ title: "", cycleName: "2026年上期", gradeName: "等級3" })).toBe("2026年上期 等級3 実績アンケート");
    expect(formRowTitle({ title: "春の振り返り", cycleName: "2026年上期", gradeName: "等級3" })).toBe("春の振り返り");
    expect(formRowTitle({ title: "" })).toBe("等級未設定 実績アンケート");
  });
});
