/**
 * あとから入った機能（数値入力の整備・ランク境界の検査・制度設定の削除）のうち、
 * まだ試験が当たっていなかった枝を埋める。
 *
 * ここは「新しく入った仕組みを直す」場所ではない。判定の中身には触れず、
 * 通っていなかった道だけを通して、あとから静かに壊れないようにする。
 */
import { describe, it, expect } from "vitest";
import { checkRankBoundaries, sortByRank } from "./rank-bounds";
import { numberInputHint, checkAnswerNumbers, parseNumberInput } from "./number-input";
import { deleteConfirmText } from "./master-delete";
import { parseChoiceValidation } from "./form-question-text";

describe("ランクの下限と上限が同じとき", () => {
  it("当てはまる実績値が無いことを、そのランク名を出して伝える", () => {
    const res = checkRankBoundaries(
      [
        { rank: "A", lowerBound: 100, upperBound: null },
        { rank: "B", lowerBound: 90, upperBound: 100 },
        { rank: "C", lowerBound: 90, upperBound: 90 }, // 幅が無い
        { rank: "D", lowerBound: 70, upperBound: 90 },
        { rank: "E", lowerBound: null, upperBound: 70 },
      ],
      "higher",
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.issues.some((i) => i.message.includes("ランクCの下限と上限が同じ（90）"))).toBe(true);
    // 「どう直すか」は人が決める箇所なので、自動の直し方は付けない
    const same = res.issues.find((i) => i.message.includes("同じ（90）"));
    expect(same?.fix).toBeNull();
  });
});

describe("ランクの並べ直しと、行が1つも無い場合", () => {
  it("A〜E 以外のランク名は末尾へ回す（並びが壊れて検査が素通りしないように）", () => {
    const sorted = sortByRank([
      { rank: "C" },
      { rank: "S" }, // 制度に無い名前
      { rank: "A" },
      { rank: "E" },
    ]);
    expect(sorted.map((r) => r.rank)).toEqual(["A", "C", "E", "S"]);
  });

  it("行が1つも無いときは、指摘なしとする（まだ設定していないだけ）", () => {
    expect(checkRankBoundaries([], "higher")).toEqual({ ok: true });
    expect(checkRankBoundaries([], "lower")).toEqual({ ok: true });
  });
});

describe("数値の設問の下に出す一言", () => {
  it("上限だけが決まっているときは「〜以下」だけを言う", () => {
    expect(numberInputHint({ validationMin: null, validationMax: 100, validationInteger: false })).toBe(
      "100以下の数字を入力してください",
    );
    expect(numberInputHint({ validationMin: null, validationMax: 5, validationInteger: true })).toBe(
      "5以下の整数を入力してください",
    );
  });

  it("下限だけ・両方・どちらも無い場合と食い違わない", () => {
    expect(numberInputHint({ validationMin: 0, validationMax: null, validationInteger: false })).toBe(
      "0以上の数字を入力してください",
    );
    expect(numberInputHint({ validationMin: 0, validationMax: 100, validationInteger: false })).toBe(
      "0以上100以下の数字を入力してください",
    );
    expect(numberInputHint({ validationMin: null, validationMax: null, validationInteger: true })).toBe(
      "整数を入力してください",
    );
    expect(numberInputHint({ validationMin: null, validationMax: null, validationInteger: false })).toBe("");
  });
});

describe("提出された数値の検査", () => {
  it("数字として扱えない値は、その設問名を出して差し戻す", () => {
    const res = checkAnswerNumbers([
      { title: "残業時間", validationMin: 0, validationMax: null, value: Number.NaN },
    ]);
    expect(res).toEqual({ ok: false, message: "「残業時間」は数字で入力してください。" });
  });

  it("無限大も数字として扱わない（割り算の結果がそのまま来た場合）", () => {
    const res = checkAnswerNumbers([
      { title: "達成率", validationMin: null, validationMax: null, value: Number.POSITIVE_INFINITY },
    ]);
    expect(res.ok).toBe(false);
  });

  it("整数だけの設問に小数が来たら、単位を添えて差し戻す（単位が無ければ添えない）", () => {
    expect(
      checkAnswerNumbers([
        { title: "面談回数", validationMin: null, validationMax: null, validationInteger: true, unit: "回", value: 2.5 },
      ]),
    ).toEqual({ ok: false, message: "「面談回数」は小数のない数字（整数）で入力してください（単位は「回」）。" });

    expect(
      checkAnswerNumbers([
        { title: "件数", validationMin: null, validationMax: null, validationInteger: true, unit: null, value: 2.5 },
      ]),
    ).toEqual({ ok: false, message: "「件数」は小数のない数字（整数）で入力してください。" });
  });

  it("未入力（空欄）はここでは差し戻さない", () => {
    expect(checkAnswerNumbers([{ title: "残業時間", validationMin: 0, validationMax: null, value: null }])).toEqual({
      ok: true,
    });
  });
});

describe("入力欄に打たれた文字の読み取り", () => {
  it("桁が多すぎて数として持てない値は、黙って受けずに差し戻す", () => {
    // 数字だけで書かれていても、桁が多いと内部では「無限大」になる。
    // ここを通してしまうと、無限大が実績値として保存される。
    const res = parseNumberInput("9".repeat(400));
    expect(res.kind).toBe("invalid");
  });
});

describe("消す前の確認文", () => {
  it("一緒に消えるものがあるときは、それも書く", () => {
    const t = deleteConfirmText("Beginner用の基準", "この基準に紐づく設問も消えます。");
    expect(t).toContain("「Beginner用の基準」を完全に消します。元に戻せません。");
    expect(t).toContain("この基準に紐づく設問も消えます。");
    expect(t).toContain("確定済みの評価は変わりません");
  });

  it("一緒に消えるものが無いときは、その一文を出さない", () => {
    const t = deleteConfirmText("使っていない項目");
    /* 2026-08-12、1文40文字の決まりに合わせて後半を2文に割った（spec §22-1）。
       取り返しのつかない操作の警告なので、畳まずそのまま出し続ける（§22-2）。 */
    expect(t).toBe(
      "「使っていない項目」を完全に消します。元に戻せません。" +
        "一度もアンケートに出していない項目です。公開したアンケートと確定済みの評価は変わりません。",
    );
    for (const s of t.split("。").filter(Boolean)) expect(s.length).toBeLessThanOrEqual(40);
  });

  it("空文字を渡したときも、余計な文が挟まらない", () => {
    expect(deleteConfirmText("項目", "")).toBe(deleteConfirmText("項目"));
  });
});

describe("選択肢の入力チェック文の読み取り", () => {
  it("値が2つ以上あるときだけ選択肢として扱う", () => {
    expect(parseChoiceValidation("3,2,1,0,-1 から選択")).toEqual([3, 2, 1, 0, -1]);
    expect(parseChoiceValidation("1、0 より選択")).toEqual([1, 0]);
  });

  it("値が1つしか書かれていなければ、選択肢にはしない（数値の自由入力に倒す）", () => {
    // 「,」が続かない形は、そもそも選択肢の書き方として認めない
    expect(parseChoiceValidation("1 から選択")).toBeNull();
    expect(parseChoiceValidation("0以上の整数")).toBeNull();
    expect(parseChoiceValidation(null)).toBeNull();
    expect(parseChoiceValidation(undefined)).toBeNull();
    expect(parseChoiceValidation("")).toBeNull();
  });
});
