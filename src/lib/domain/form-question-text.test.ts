import { describe, expect, it } from "vitest";
import {
  inputRuleNote,
  kpiQuestion,
  minimumFromValidation,
  parseChoiceValidation,
  promotionQuestion,
  quoteSetting,
  requirementQuestion,
  yesNoChoices,
} from "./form-question-text";

/**
 * 設問文の作り方。
 *
 * ここが崩れると、答える人が「はい」がどちらの意味か分からないまま回答する。
 * 回答は等級要件達成率や昇格の判定にそのまま使われるので、
 * 読み違いは制度の判断を静かに間違わせる。
 */

describe("quoteSetting", () => {
  it("制度の文言をそのまま引用する（句点・二重かぎかっこを重ねない）", () => {
    expect(quoteSetting("インテークやアセスメント")).toBe("「インテークやアセスメント」");
    expect(quoteSetting("支援に必要な記録及び準備。")).toBe("「支援に必要な記録及び準備」");
    expect(quoteSetting("「ダイアローグ基礎研修」")).toBe("「ダイアローグ基礎研修」");
  });
});

describe("requirementQuestion", () => {
  it("状態の言い切りを「〜しましたか？」の質問文にする", () => {
    const q = requirementQuestion("support", "インテークやアセスメント");
    expect(q.questionType).toBe("yesno");
    expect(q.title).toBe("「インテークやアセスメント」を、この半期に自分の担当として行いましたか？");
  });

  it("はい・いいえがどちらの意味かを選択肢に書く", () => {
    const q = requirementQuestion("operation", "職員の勤怠管理");
    expect(q.options?.map((o) => o.label)).toEqual(["はい（行った）", "いいえ（まだ行っていない）"]);
    // 達成側が 1。集計は「1 なら達成」で読む（evaluate.ts）
    expect(q.options?.[0].score).toBe(1);
    expect(q.options?.[1].score).toBe(0);
  });

  it("制度の文言を書き換えない（引用だけする）", () => {
    const text = "プログラム（授産）に関する社外調整";
    expect(requirementQuestion("support", text).title).toContain(text);
  });
});

describe("promotionQuestion", () => {
  it("報告書は「提出したか」を聞く", () => {
    const q = promotionQuestion("report", "ダイアローグ基礎研修");
    expect(q.title).toBe("「ダイアローグ基礎研修」を受講し、報告書を提出しましたか？");
    expect(q.options?.map((o) => o.label)).toEqual(["はい（提出した）", "いいえ（まだ提出していない）"]);
  });

  it("テストは「合格したか」を聞く", () => {
    const q = promotionQuestion("test", "実施事業について");
    expect(q.title).toBe("「実施事業について」のテストに合格しましたか？");
    expect(q.options?.map((o) => o.label)).toEqual(["はい（合格した）", "いいえ（まだ合格していない）"]);
  });
});

describe("yesNoChoices", () => {
  it("達成側を先頭に置く", () => {
    expect(yesNoChoices("できた", "まだ")).toEqual([
      { value: "1", label: "はい（できた）", score: 1 },
      { value: "0", label: "いいえ（まだ）", score: 0 },
    ]);
  });
});

describe("parseChoiceValidation", () => {
  it("選べる値が決まっていれば選択肢にする", () => {
    expect(parseChoiceValidation("3,2,1,0,-1 から選択")).toEqual([3, 2, 1, 0, -1]);
    expect(parseChoiceValidation("3、2、1 から選択")).toEqual([3, 2, 1]);
  });

  it("数値の自由入力は選択肢にしない", () => {
    expect(parseChoiceValidation("0以上の整数")).toBeNull();
    expect(parseChoiceValidation("-")).toBeNull();
    expect(parseChoiceValidation(null)).toBeNull();
  });
});

describe("minimumFromValidation / inputRuleNote", () => {
  it("入力チェックの文言から下限を決める", () => {
    expect(minimumFromValidation("1以上の整数")).toBe(1);
    expect(minimumFromValidation("0以上の整数")).toBe(0);
    expect(minimumFromValidation("整数（マイナス可）")).toBeNull();
  });

  it("入力チェックを答える人向けの一言にする", () => {
    expect(inputRuleNote("0以上の整数")).toContain("0以上の整数");
    expect(inputRuleNote("整数（マイナス可）")).toContain("マイナス");
    expect(inputRuleNote("-")).toBe("");
  });
});

describe("kpiQuestion", () => {
  const base = { text: "半期のヒヤリハット報告件数を入力してください（件）", inputType: "number", unit: "件", validation: "0以上の整数" };

  it("設問文はマスタのまま。単位と入力できる値は説明文で補う", () => {
    const q = kpiQuestion(base, "ヒヤリ報告件数");
    expect(q.questionType).toBe("number");
    expect(q.title).toBe(base.text);
    expect(q.unit).toBe("件");
    expect(q.validationMin).toBe(0);
    expect(q.helpText).toContain("ヒヤリ報告件数の集計に使います");
    expect(q.helpText).toContain("単位は「件」です");
    expect(q.helpText).toContain("半角の数字だけ");
  });

  it("単位が「-」のときは単位を出さない", () => {
    const q = kpiQuestion({ ...base, unit: "-" }, "利用率");
    expect(q.unit).toBeNull();
    expect(q.helpText).not.toContain("単位");
  });

  it("選べる値が決まっている設問は、数値入力ではなく選択肢にする", () => {
    const q = kpiQuestion(
      { text: "行動指針「連帯性について」の評価点を選択してください（3／2／1／0／-1）", inputType: "select", unit: "点", validation: "3,2,1,0,-1 から選択" },
      "チームワーク",
    );
    expect(q.questionType).toBe("single");
    expect(q.options?.map((o) => o.score)).toEqual([3, 2, 1, 0, -1]);
    expect(q.helpText).toContain("1つだけ選んで");
  });

  it("記述式は文章で答えられるようにする（数値欄にしない）", () => {
    const q = kpiQuestion({ text: "氏名を入力してください", inputType: "text", unit: "-", validation: "-" }, "共通設問");
    expect(q.questionType).toBe("text");
  });
});
