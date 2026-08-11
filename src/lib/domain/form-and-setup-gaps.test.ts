import { describe, expect, it } from "vitest";
import {
  inputRuleNote,
  kpiQuestion,
  minimumFromValidation,
  parseChoiceValidation,
} from "./form-question-text";
import { stripOptionScores } from "./form-visibility";
import { judgeFormDeadline } from "./form-deadline";
import { stepLede, stepTitle } from "./scheme-steps";
import { findProfileField } from "./profile-fields";

/**
 * 評価そのものではないが、評価に入る値の入口（アンケートの設問文・入力の決まり）と
 * 設定画面の言葉づかいを固定する。
 * 入力の下限が変わると実績値が変わるため、ここも数値の一部として扱う。
 */

describe("入力の決まりを、答える人向けの一言にする", () => {
  it("下限は文言から読み取る", () => {
    expect(minimumFromValidation("1以上の整数")).toBe(1);
    expect(minimumFromValidation("0以上の整数")).toBe(0);
    expect(minimumFromValidation("整数")).toBeNull();
    expect(minimumFromValidation(null)).toBeNull();
  });

  it("決まりごとに、そのまま画面に出せる文を返す", () => {
    expect(inputRuleNote("1以上の整数")).toBe("1以上の整数で入力してください。");
    expect(inputRuleNote("0以上の整数")).toContain("0でもかまいません");
    expect(inputRuleNote("0より大きい数")).toBe("0より大きい数を入力してください。");
    expect(inputRuleNote("整数（マイナス可）")).toContain("マイナスの数も入力できます");
    expect(inputRuleNote("整数")).toBe("整数で入力してください。");
    expect(inputRuleNote("")).toBe("");
    expect(inputRuleNote(null)).toBe("");
  });

  it("選択肢の指定は、2つ以上そろっているときだけ選択式にする", () => {
    expect(parseChoiceValidation("1,2,3から選択")).toEqual([1, 2, 3]);
    expect(parseChoiceValidation("0、1より選択")).toEqual([0, 1]);
    expect(parseChoiceValidation("-1,0,1から選択")).toEqual([-1, 0, 1]);
    expect(parseChoiceValidation("1から選択")).toBeNull();
    expect(parseChoiceValidation("整数")).toBeNull();
    expect(parseChoiceValidation(null)).toBeNull();
  });

  it("単位が「-」の設問には、単位を付けない", () => {
    const withUnit = kpiQuestion(
      { text: "稼働日数", inputType: "number", unit: "日", validation: "0以上の整数" },
      "稼働率",
    );
    expect(withUnit.unit).toBe("日");
    expect(withUnit.helpText).toContain("稼働率の集計に使います");
    expect(withUnit.helpText).toContain("単位は「日」です");
    expect(withUnit.validationMin).toBe(0);

    const noUnit = kpiQuestion(
      { text: "稼働日数", inputType: "number", unit: "-", validation: "0以上の整数" },
      "稼働率",
    );
    expect(noUnit.unit).toBeNull();
    expect(noUnit.helpText).not.toContain("単位は");
  });

  it("自由記述の実績設問は、文章で答える設問として組み立てる", () => {
    const q = kpiQuestion({ text: "所感", inputType: "text", unit: null, validation: null }, "所感");
    expect(q.questionType).toBe("text");
    expect(q.unit).toBeNull();
  });

  it("選択式に指定された実績設問は、選択肢のある設問として組み立てる", () => {
    const q = kpiQuestion(
      { text: "達成状況", inputType: "number", unit: null, validation: "0,1,2から選択" },
      "達成率",
    );
    expect(q.questionType).toBe("single");
  });

  it("どのKPIの集計に使うか分からない場合でも、設問は作れる", () => {
    const q = kpiQuestion(
      { text: "件数", inputType: "number", unit: "件", validation: null },
      "",
    );
    expect(q.title).toBe("件数");
  });
});

describe("本人に見せる選択肢から、点数を落とす", () => {
  it("値も表示名も欠けている選択肢を、空文字で埋めて落とさない", () => {
    expect(stripOptionScores('[{"score":3},{"value":"b","label":"い","score":2}]')).toBe(
      JSON.stringify([
        { value: "", label: "" },
        { value: "b", label: "い" },
      ]),
    );
  });

  it("読めない・空・配列でない記録は、選択肢なしとして扱う", () => {
    expect(stripOptionScores("これはJSONではない")).toBeNull();
    expect(stripOptionScores('{"value":"a"}')).toBeNull();
    expect(stripOptionScores("[]")).toBeNull();
    expect(stripOptionScores(null)).toBeNull();
  });
});

describe("アンケートの締切", () => {
  it("延長が複数あれば、いちばん遅い日付を締切にする（順番に関係なく）", () => {
    const late = judgeFormDeadline({
      opensAt: null,
      closesAt: "2026-09-30",
      extensions: ["2026-10-31", "2026-10-05"],
      now: new Date("2026-10-10T00:00:00+09:00"),
      status: "published",
    });
    const same = judgeFormDeadline({
      opensAt: null,
      closesAt: "2026-09-30",
      extensions: ["2026-10-05", "2026-10-31"],
      now: new Date("2026-10-10T00:00:00+09:00"),
      status: "published",
    });
    expect(late.effectiveUntil).toBe("2026-10-31");
    expect(same.effectiveUntil).toBe("2026-10-31");
    expect(late.canAnswer).toBe(true);
  });
});

describe("評価セットの手順の言葉", () => {
  it("手順ごとに、見出しと1行の説明が対になっている", () => {
    expect(stepTitle("select")).toBe("使うKPIを選ぶ");
    expect(stepLede("select", "Chief")).toContain("Chief の評価に使うKPIを選びます");
    expect(stepTitle("criteria")).toContain("基準を決める");
    expect(stepLede("criteria", "Chief")).toContain("A〜Eのどれになるか");
  });
});

describe("プロフィール項目の引き当て", () => {
  it("登録されている項目は引ける。無い項目は null（画面を落とさない）", () => {
    expect(findProfileField("name")?.key).toBe("name");
    expect(findProfileField("そんな項目はない")).toBeNull();
  });
});
