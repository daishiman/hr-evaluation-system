import { describe, expect, it } from "vitest";
import { stripOptionScores, toContentQuestions, type ContentQuestion } from "@/lib/domain/form-visibility";

const question = (over: Partial<ContentQuestion> = {}): ContentQuestion => ({
  id: "q1",
  section: "behavior",
  questionType: "single",
  title: "今期、行動指針を実践できましたか",
  helpText: null,
  unit: null,
  required: true,
  validationMin: null,
  validationMax: null,
  optionsJson: JSON.stringify([
    { value: "a", label: "できた", score: 4 },
    { value: "b", label: "できなかった", score: 0 },
  ]),
  displayOrder: 1,
  ...over,
});

describe("選択肢から配点を落とす", () => {
  it("文言と値は残し、配点だけ消す", () => {
    const stripped = JSON.parse(stripOptionScores(question().optionsJson) ?? "[]");
    expect(stripped).toEqual([
      { value: "a", label: "できた" },
      { value: "b", label: "できなかった" },
    ]);
  });

  it("選択肢が無いときはそのまま無し", () => {
    expect(stripOptionScores(null)).toBeNull();
  });

  it("読めない形のデータは表示しない（配点が混じったまま出さない）", () => {
    expect(stripOptionScores("{壊れたJSON")).toBeNull();
    expect(stripOptionScores(JSON.stringify({ score: 10 }))).toBeNull();
    expect(stripOptionScores(JSON.stringify([]))).toBeNull();
  });
});

describe("中身の確認画面に渡す設問", () => {
  it("配点を見てよい人には、選択肢をそのまま渡す", () => {
    const [q] = toContentQuestions([question()], true);
    expect(JSON.parse(q.optionsJson ?? "[]")[0].score).toBe(4);
  });

  it("評価される方には配点を渡さない", () => {
    const [q] = toContentQuestions([question()], false);
    expect(q.optionsJson).not.toContain("score");
    // 設問文・必須／任意・単位など、読むために要るものは変えない
    expect(q.title).toBe(question().title);
    expect(q.required).toBe(true);
  });

  it("並び順は画面の指定（displayOrder）どおりにそろえる", () => {
    const rows = [question({ id: "q2", displayOrder: 2 }), question({ id: "q1", displayOrder: 1 })];
    expect(toContentQuestions(rows, false).map((q) => q.id)).toEqual(["q1", "q2"]);
  });
});
