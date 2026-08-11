import { describe, expect, it } from "vitest";
import { formatAnswer, isAnswered, parseMulti, questionSnapshot, toAnswerRows } from "./answer-snapshot";

const q = {
  id: "fq_1",
  title: "受講後の報告書を提出しましたか",
  questionType: "yesno",
  section: "training",
  unit: null,
  optionsJson: null,
  displayOrder: 3,
};

describe("questionSnapshot", () => {
  it("回答行に写し取る内容がそろっている", () => {
    expect(questionSnapshot(q)).toEqual({
      questionTitle: "受講後の報告書を提出しましたか",
      questionType: "yesno",
      questionSection: "training",
      questionUnit: null,
      questionOptionsJson: null,
      questionDisplayOrder: 3,
    });
  });
});

describe("isAnswered 設問形式ごとの必須判定", () => {
  it("数値・はい/いいえ・選択は value_number で見る", () => {
    expect(isAnswered("number", { valueNumber: 0, valueText: null })).toBe(true);
    expect(isAnswered("yesno", { valueNumber: null, valueText: "はい" })).toBe(false);
    expect(isAnswered("single", { valueNumber: 2, valueText: "信頼" })).toBe(true);
  });

  it("自由記述は文字が入っていれば回答済み（これまで提出できなかった形式）", () => {
    expect(isAnswered("text", { valueNumber: null, valueText: "担当を交代しました" })).toBe(true);
    expect(isAnswered("text", { valueNumber: null, valueText: "   " })).toBe(false);
    expect(isAnswered("text", { valueNumber: 1, valueText: null })).toBe(false);
  });

  it("複数選択は選んだものが1つ以上あれば回答済み", () => {
    expect(isAnswered("multi", { valueNumber: null, valueText: null, valueJson: '["a"]' })).toBe(true);
    expect(isAnswered("multi", { valueNumber: null, valueText: null, valueJson: "[]" })).toBe(false);
    expect(isAnswered("multi", { valueNumber: 1, valueText: null })).toBe(false);
  });

  it("値が無ければ未回答", () => {
    expect(isAnswered("number", undefined)).toBe(false);
  });
});

describe("parseMulti", () => {
  it("壊れた値でも落ちずに空になる", () => {
    expect(parseMulti("{壊れ")).toEqual([]);
    expect(parseMulti('"文字列"')).toEqual([]);
    expect(parseMulti('["a",1,"b"]')).toEqual(["a", "b"]);
  });
});

describe("toAnswerRows 過去の回答の読み方", () => {
  const stored = {
    questionId: "fq_1",
    valueNumber: 1,
    valueText: "はい",
    valueJson: null,
    questionTitle: "【当時】報告書を提出しましたか",
    questionType: "yesno",
    questionSection: "training",
    questionUnit: null,
    questionOptionsJson: null,
    questionDisplayOrder: 1,
  };

  it("設問が今と違っていても、当時の文面で読める", () => {
    const rows = toAnswerRows([stored], [{ ...q, title: "【今】報告書と受講記録を出しましたか" }]);
    expect(rows[0].title).toBe("【当時】報告書を提出しましたか");
    expect(rows[0].fromCurrentQuestion).toBe(false);
  });

  it("スナップショットが無い古い行は、いまの設問で補い、その旨を持ち帰る", () => {
    const old = { ...stored, questionTitle: null, questionType: null, questionSection: null, questionDisplayOrder: null };
    const rows = toAnswerRows([old], [q]);
    expect(rows[0].title).toBe(q.title);
    expect(rows[0].fromCurrentQuestion).toBe(true);
  });

  it("設問が消えていても回答は読める（文面だけ欠ける）", () => {
    const old = { ...stored, questionTitle: null, questionType: null, questionSection: null, questionDisplayOrder: null };
    const rows = toAnswerRows([old], []);
    expect(rows[0].title).toContain("残っていません");
  });

  it("当時の並び順で並ぶ", () => {
    const a = { ...stored, questionId: "b", questionDisplayOrder: 5 };
    const b = { ...stored, questionId: "a", questionDisplayOrder: 2 };
    expect(toAnswerRows([a, b], []).map((r) => r.questionId)).toEqual(["a", "b"]);
  });
});

describe("formatAnswer", () => {
  const base = {
    questionId: "x",
    title: "t",
    section: "kpi",
    unit: null as string | null,
    options: [] as { value: string; label: string }[],
    displayOrder: 1,
    valueNumber: null as number | null,
    valueText: null as string | null,
    valueJson: null as string | null,
    fromCurrentQuestion: false,
  };

  it("数値には単位を添える", () => {
    expect(formatAnswer({ ...base, questionType: "number", valueNumber: 82, unit: "%" })).toBe("82%");
  });

  it("選んだ言葉があればそれを出す", () => {
    expect(formatAnswer({ ...base, questionType: "yesno", valueNumber: 1, valueText: "はい" })).toBe("はい");
  });

  it("複数選択は選択肢のラベルを並べる", () => {
    const row = {
      ...base,
      questionType: "multi",
      valueJson: '["a","c"]',
      options: [
        { value: "a", label: "研修A" },
        { value: "c", label: "研修C" },
      ],
    };
    expect(formatAnswer(row)).toBe("研修A、研修C");
  });

  it("未回答は null", () => {
    expect(formatAnswer({ ...base, questionType: "number" })).toBeNull();
    expect(formatAnswer({ ...base, questionType: "text", valueText: "  " })).toBeNull();
  });
});
