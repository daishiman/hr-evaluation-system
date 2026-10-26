import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  findChosenOption,
  formatAnswer,
  isAnswered,
  isOptionSelected,
  optionAnswer,
  optionScore,
  parseMulti,
  parseOptions,
  questionSnapshot,
  scaleSteps,
  toAnswerRows,
} from "./answer-snapshot";

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

  it("複数選択は回答画面の手元の valueChoices を先に見る（押しても回答数が増えなかった不具合）", () => {
    expect(isAnswered("multi", { valueNumber: null, valueText: "研修A", valueChoices: ["a"] })).toBe(true);
    expect(isAnswered("multi", { valueNumber: null, valueText: null, valueChoices: [] })).toBe(false);
    // 手元に無いとき（保存済みの行）は value_json を読む
    expect(isAnswered("multi", { valueNumber: null, valueText: null, valueChoices: null, valueJson: '["b"]' })).toBe(true);
  });

  it("1つ選ぶ設問は、点数を持たない選択肢（言葉だけ）を選んでも回答済み", () => {
    expect(isAnswered("single", { valueNumber: null, valueText: "自分から行った" })).toBe(true);
    expect(isAnswered("single", { valueNumber: 0, valueText: null })).toBe(true);
    expect(isAnswered("single", { valueNumber: null, valueText: "  " })).toBe(false);
    expect(isAnswered("single", { valueNumber: null, valueText: null })).toBe(false);
  });

  it("値が無ければ未回答", () => {
    expect(isAnswered("number", undefined)).toBe(false);
  });
});

describe("parseOptions", () => {
  it("壊れた値・配列でない値・形の合わない要素を落とす", () => {
    expect(parseOptions(null)).toEqual([]);
    expect(parseOptions("{壊れ")).toEqual([]);
    expect(parseOptions('{"value":"a","label":"あ"}')).toEqual([]);
    expect(parseOptions('[{"value":"a","label":"あ","score":1},null,"x",{"value":"b"}]')).toEqual([
      { value: "a", label: "あ", score: 1 },
    ]);
  });

  it("管理者のアンケートの画面も、選択肢を parseOptions で読む（壊れた値で 500 にしない。DD-032 の17）", () => {
    const page = readFileSync(path.join(process.cwd(), "src/app/admin/forms/[id]/page.tsx"), "utf8");
    expect(page).toContain("options: parseOptions(q.optionsJson)");
    expect(page).not.toContain("JSON.parse(q.optionsJson)");
  });
});

describe("optionScore 選択肢の点数", () => {
  it("score があればそれを使う", () => {
    expect(optionScore({ value: "a", label: "自分から行った", score: 3 })).toBe(3);
    expect(optionScore({ value: "9", label: "x", score: 0 })).toBe(0);
  });

  it("score が無い・数でないときは、数字の value を点数として読む", () => {
    expect(optionScore({ value: "2", label: "x" })).toBe(2);
    expect(optionScore({ value: " 1.5 ", label: "x" })).toBe(1.5);
    expect(optionScore({ value: "4", label: "x", score: Number.NaN })).toBe(4);
    expect(optionScore({ value: "4", label: "x", score: Number.POSITIVE_INFINITY })).toBe(4);
  });

  it("古いデータで value が数のまま入っていても読める", () => {
    expect(optionScore({ value: 5 as unknown as string, label: "x" })).toBe(5);
  });

  it("value が数字でない・空なら点数は無い（NaN を返さない）", () => {
    expect(optionScore({ value: "a", label: "x" })).toBeNull();
    expect(optionScore({ value: "  ", label: "x" })).toBeNull();
    expect(optionScore({ value: "", label: "x" })).toBeNull();
  });
});

describe("optionAnswer 選択肢を押したときの答え", () => {
  it("公開値と選んだ言葉と明示した選択値を入れる", () => {
    expect(optionAnswer({ value: "2", label: "助言を受けて行った" })).toEqual({
      valueNumber: 2,
      valueText: "助言を受けて行った",
      valueChoices: ["2"],
    });
  });

  it("数値でない選択肢も言葉と選択値を入れる", () => {
    expect(optionAnswer({ value: "a", label: "自分から行った" })).toEqual({
      valueNumber: null,
      valueText: "自分から行った",
      valueChoices: ["a"],
    });
  });
});

describe("isOptionSelected 選択中の判定", () => {
  it("答えが無ければどれも選ばれていない", () => {
    const o = { value: "1", label: "はい" };
    expect(isOptionSelected(o, null)).toBe(false);
    expect(isOptionSelected(o, undefined)).toBe(false);
  });

  it("言葉が無い答え（取込や古い行）は点数で見る", () => {
    const options = [
      { value: "1", label: "はい" },
      { value: "0", label: "いいえ" },
    ];
    const v = { valueNumber: 1, valueText: null };
    expect(isOptionSelected(options[0], v, options)).toBe(true);
    expect(isOptionSelected(options[1], v, options)).toBe(false);
    // 言葉が空白だけでも点数で見る
    expect(isOptionSelected(options[1], { valueNumber: 0, valueText: " " }, options)).toBe(true);
  });

  it("点数を持たない選択肢は、言葉が合わなければ選ばれていない", () => {
    const o = { value: "a", label: "自分から行った" };
    expect(isOptionSelected(o, { valueNumber: null, valueText: null })).toBe(false);
  });

  it("値が重なった古いデータでも、選んだ言葉の1つだけが選択中になる", () => {
    const options = [
      { value: "1", label: "選択肢1" },
      { value: "3", label: "選択肢3" },
      { value: "3", label: "選択肢4" },
    ];
    const v = optionAnswer(options[2]);
    expect(options.map((o) => isOptionSelected(o, v, options))).toEqual([false, false, true]);
  });

  it("値が数字でない選択肢も、言葉で選択中になる", () => {
    const options = [
      { value: "a", label: "自分から行った" },
      { value: "b", label: "助言を受けて行った" },
    ];
    const v = optionAnswer(options[1]);
    expect(options.map((o) => isOptionSelected(o, v, options))).toEqual([false, true]);
  });

  it("同じ言葉が複数あるときは点数で絞る", () => {
    const options = [
      { value: "1", label: "同じ" },
      { value: "2", label: "同じ" },
    ];
    expect(options.map((o) => isOptionSelected(o, { valueNumber: 2, valueText: "同じ" }, options))).toEqual([
      false,
      true,
    ]);
  });

  it("同じ言葉が複数あり点数で絞れないときは、その言葉の選択肢を選択中とする", () => {
    const options = [
      { value: "a", label: "同じ" },
      { value: "b", label: "同じ" },
      { value: "c", label: "別" },
    ];
    expect(options.map((o) => isOptionSelected(o, { valueNumber: null, valueText: "同じ" }, options))).toEqual([
      true,
      true,
      false,
    ]);
  });

  it("言葉がどの選択肢にも合わない答え（取込の「○」など）は点数に戻る", () => {
    const options = [
      { value: "1", label: "はい" },
      { value: "0", label: "いいえ" },
    ];
    const v = { valueNumber: 1, valueText: "○" };
    expect(options.map((o) => isOptionSelected(o, v, options))).toEqual([true, false]);
  });
});

describe("findChosenOption 選ばれた選択肢をサーバーの選択肢から探す（DD-032 の8）", () => {
  it("言葉が1つに決まれば、送られた数が違ってもその選択肢にする", () => {
    const options = [
      { value: "a", label: "はい", score: 5 },
      { value: "b", label: "いいえ", score: 0 },
    ];
    expect(findChosenOption(options, { valueNumber: 99, valueText: " いいえ " })).toBe(options[1]);
  });

  it("言葉が無ければ配点で探し、どれとも合わなければ答えなしにする", () => {
    const options = [
      { value: "a", label: "はい", score: 5 },
      { value: "b", label: "いいえ", score: 0 },
    ];
    expect(findChosenOption(options, { valueNumber: 0, valueText: null })).toBe(options[1]);
    expect(findChosenOption(options, { valueNumber: 3, valueText: "○" })).toBeNull();
    expect(findChosenOption(options, { valueNumber: null, valueText: null })).toBeNull();
  });

  it("同じ言葉が並ぶときは、配点と同じ数を先に、無ければ値を数として読んだものと照らす", () => {
    const options = [
      { value: "1", label: "同じ", score: 10 },
      { value: "2", label: "同じ", score: 20 },
    ];
    expect(findChosenOption(options, { valueNumber: 20, valueText: "同じ" })).toBe(options[1]);
    // 配点を持たない回答画面は、値から読んだ数を送ってくる
    expect(findChosenOption(options, { valueNumber: 2, valueText: "同じ" })).toBe(options[1]);
  });

  it("同じ言葉が並び、数でも絞れなければ先頭にする", () => {
    const options = [
      { value: "a", label: "同じ" },
      { value: "b", label: "同じ" },
    ];
    expect(findChosenOption(options, { valueNumber: 7, valueText: "同じ" })).toBe(options[0]);
    expect(findChosenOption(options, { valueNumber: null, valueText: "同じ" })).toBe(options[0]);
  });
});

describe("parseMulti", () => {
  it("壊れた値でも落ちずに空になる", () => {
    expect(parseMulti("{壊れ")).toEqual([]);
    expect(parseMulti('"文字列"')).toEqual([]);
    expect(parseMulti('["a",1,"b"]')).toEqual(["a", "b"]);
  });
});

describe("scaleSteps", () => {
  it("設定された整数範囲を回答画面とプレビューで共有できる形にする", () => {
    expect(scaleSteps({ validationMin: 2, validationMax: 4 })).toEqual([2, 3, 4]);
  });

  it("未設定・逆転・広すぎる範囲は安全な1〜5に戻す", () => {
    expect(scaleSteps({ validationMin: null, validationMax: null })).toEqual([1, 2, 3, 4, 5]);
    expect(scaleSteps({ validationMin: 5, validationMax: 2 })).toEqual([1, 2, 3, 4, 5]);
    expect(scaleSteps({ validationMin: 1, validationMax: 20 })).toEqual([1, 2, 3, 4, 5]);
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

  it("複数選択で選択肢が消えた値はそのまま出し、選んだ値が無ければ取込の文字を出す", () => {
    const row = { ...base, questionType: "multi", options: [{ value: "a", label: "研修A" }] };
    expect(formatAnswer({ ...row, valueJson: '["a","z"]' })).toBe("研修A、z");
    expect(formatAnswer({ ...row, valueText: " 研修A、研修B " })).toBe("研修A、研修B");
    expect(formatAnswer({ ...row })).toBeNull();
  });

  it("自由記述は前後の空白を落とす", () => {
    expect(formatAnswer({ ...base, questionType: "text", valueText: " 交代しました " })).toBe("交代しました");
  });

  it("数値の設問で数が無ければ、取込で残った文字を出す", () => {
    expect(formatAnswer({ ...base, questionType: "number", valueText: " 不明 " })).toBe("不明");
    expect(formatAnswer({ ...base, questionType: "number", valueNumber: 3 })).toBe("3");
  });

  it("未回答は null", () => {
    expect(formatAnswer({ ...base, questionType: "number" })).toBeNull();
    expect(formatAnswer({ ...base, questionType: "text", valueText: "  " })).toBeNull();
  });
});
