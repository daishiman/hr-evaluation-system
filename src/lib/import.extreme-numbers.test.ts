import { describe, expect, it } from "vitest";
import { readNumberCell } from "./import";
import { MAX_ABS_NUMBER, checkAnswerNumbers, questionNumberPolicy } from "@/lib/domain/number-input";

/**
 * 貼り付け取り込みの数値を、画面から提出したときと同じ決まりで見ているか。
 *
 * 以前は取り込みだけが別の読み取りを持っていて、-5 も 3.7 も 400桁の数も素通りしていた。
 * 素通りした値は「回答としては保存されたのに、集計で理由なく落ちる」形で表に出るため、
 * どこが原因なのか誰にも追えなかった。
 * ここでは**2つの経路が同じ答えを出すこと**を固定する（片方だけ直しても気づけるように）。
 */

type Question = { validationMin: number | null; validationMax: number | null; validationInteger: boolean };

/** 「件数」のような 0以上・整数だけ の設問 */
const COUNT: Question = { validationMin: 0, validationMax: null, validationInteger: true };
/** 「達成率(%)」のような 0〜1000・小数あり の設問 */
const RATE: Question = { validationMin: 0, validationMax: 1000, validationInteger: false };

const read = (raw: string, q: Question = COUNT) => readNumberCell(raw, questionNumberPolicy(q));

/** 同じ値を「提出」の側の検査にかけたときの結果 */
const submit = (value: number, q: Question = COUNT) =>
  checkAnswerNumbers([{ title: "件数", unit: "件", value, ...q }]);

describe("取り込みと提出が同じ判断をする", () => {
  it("普通の値はどちらでも通る", () => {
    expect(read("42")).toEqual({ value: 42 });
    expect(submit(42).ok).toBe(true);
  });

  it("マイナスはどちらでも断る（以前は取り込みだけ通っていた）", () => {
    expect(read("-5")).toEqual({ reason: "0以上の数字を入力してください" });
    expect(submit(-5).ok).toBe(false);
  });

  it("整数だけの設問の小数はどちらでも断る（以前は取り込みだけ通っていた）", () => {
    expect(read("3.7")).toEqual({ reason: "小数のない数字（整数）を入力してください" });
    expect(submit(3.7).ok).toBe(false);
  });

  it("上限のある設問の超過はどちらでも断る", () => {
    expect(read("1000.1", RATE)).toEqual({ reason: "1000 以下の数字を入力してください" });
    expect(submit(1000.1, RATE).ok).toBe(false);
  });
});

describe("桁が多すぎる数（ちょうど・その両側）", () => {
  it("上限ちょうど（1兆）は通る", () => {
    expect(read(String(MAX_ABS_NUMBER))).toEqual({ value: MAX_ABS_NUMBER });
    expect(submit(MAX_ABS_NUMBER).ok).toBe(true);
  });

  it("上限のすぐ下は通る", () => {
    expect(read(String(MAX_ABS_NUMBER - 1))).toEqual({ value: MAX_ABS_NUMBER - 1 });
    expect(submit(MAX_ABS_NUMBER - 1).ok).toBe(true);
  });

  it("上限のすぐ上は断る", () => {
    expect(read(String(MAX_ABS_NUMBER + 1))).toEqual({
      reason: `1兆（${MAX_ABS_NUMBER}）より大きい数字は受け付けられません。桁を間違えていないかご確認ください`,
    });
    expect(submit(MAX_ABS_NUMBER + 1).ok).toBe(false);
  });

  it("400桁の数は「桁が多すぎる」と分かる言葉で断る", () => {
    const r = read("9".repeat(400));
    expect(r).toHaveProperty("reason");
    expect((r as { reason: string }).reason).toContain("桁を間違えていないか");
  });

  it("計算機の扱える範囲を超える値（1e308・無限大）は提出でも断る", () => {
    expect(submit(1e308).ok).toBe(false);
    expect(submit(Number.POSITIVE_INFINITY).ok).toBe(false);
    expect(submit(Number.NEGATIVE_INFINITY).ok).toBe(false);
  });

  it("マイナス側の桁も同じように見る", () => {
    const q: Question = { validationMin: null, validationMax: null, validationInteger: false };
    expect(read(String(-MAX_ABS_NUMBER), q)).toEqual({ value: -MAX_ABS_NUMBER });
    expect(submit(-MAX_ABS_NUMBER - 1, q).ok).toBe(false);
  });
});

describe("表計算から貼り付けたときに混ざる書き方", () => {
  it("全角数字・桁区切り・単位・前後の空白は黙って読む", () => {
    expect(read("１２３４")).toEqual({ value: 1234 });
    expect(read("1,200")).toEqual({ value: 1200 });
    expect(read("12円")).toEqual({ value: 12 });
    expect(read("  42  ")).toEqual({ value: 42 });
    expect(read("+7")).toEqual({ value: 7 });
    expect(read("87.5", RATE)).toEqual({ value: 87.5 });
  });

  it("空欄は数字として読まない（0にはしない）", () => {
    expect(read("")).toEqual({ reason: "数字が読み取れませんでした" });
    expect(read("   ")).toEqual({ reason: "数字が読み取れませんでした" });
  });

  it("最小の値（0）は通る", () => {
    expect(read("0")).toEqual({ value: 0 });
    expect(submit(0).ok).toBe(true);
  });

  it("数字に見えて数字でないものは断る（16進・2進・指数表記・無限大）", () => {
    // Number() はこれらを黙って数に変えてしまう。0x10 が 16 として保存されると、
    // 打った人の意図と保存された値が食い違ったまま集計まで進む。
    for (const bad of ["0x10", "0b101", "1e308", "1E5", "1e400", "1e-400", "Infinity", "NaN", "1_000"]) {
      expect(read(bad), bad).toHaveProperty("reason");
    }
  });
});
