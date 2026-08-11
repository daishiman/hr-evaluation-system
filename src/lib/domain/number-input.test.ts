import { describe, expect, it } from "vitest";
import {
  checkAnswerNumbers,
  checkBounds,
  formatOnBlur,
  normalizeNumericText,
  normalizeWhileTyping,
  parseNumberInput,
  questionNumberPolicy,
} from "@/lib/domain/number-input";

describe("全角で打たれても黙って半角にする", () => {
  it("全角数字を半角にする", () => {
    expect(normalizeNumericText("１２３")).toBe("123");
    expect(parseNumberInput("１２３")).toEqual({ kind: "ok", value: 123, text: "123" });
  });

  it("全角の小数点・マイナスも半角にする", () => {
    expect(parseNumberInput("９５．５")).toEqual({ kind: "ok", value: 95.5, text: "95.5" });
    expect(parseNumberInput("－１", { allowNegative: true })).toEqual({ kind: "ok", value: -1, text: "-1" });
  });

  it("長音符・ダッシュ・数学記号もマイナスとして読む（打ち間違えやすいため）", () => {
    for (const minus of ["ー1", "−1", "―1", "‐1"]) {
      expect(parseNumberInput(minus, { allowNegative: true })).toEqual({ kind: "ok", value: -1, text: "-1" });
    }
  });

  it("全角の句読点を小数点として読む（テンキーの打ち間違い）", () => {
    expect(parseNumberInput("95。5")).toEqual({ kind: "ok", value: 95.5, text: "95.5" });
  });
});

describe("貼り付けで混ざるものを黙って落とす", () => {
  it("桁区切りのカンマを落とす", () => {
    expect(parseNumberInput("1,234,567")).toEqual({ kind: "ok", value: 1234567, text: "1234567" });
    expect(parseNumberInput("１，２３４")).toEqual({ kind: "ok", value: 1234, text: "1234" });
  });

  it("前後の空白・全角空白を落とす", () => {
    expect(parseNumberInput("  100  ")).toEqual({ kind: "ok", value: 100, text: "100" });
    expect(parseNumberInput("　100　")).toEqual({ kind: "ok", value: 100, text: "100" });
  });

  it("単位の % が一緒に貼られても数値として読む", () => {
    expect(parseNumberInput("95%")).toEqual({ kind: "ok", value: 95, text: "95" });
    expect(parseNumberInput("９５％")).toEqual({ kind: "ok", value: 95, text: "95" });
  });

  it("先頭の + は符号として受ける", () => {
    expect(parseNumberInput("+5")).toEqual({ kind: "ok", value: 5, text: "5" });
  });
});

describe("空欄は 0 にしない（空欄と 0 は意味が違う）", () => {
  it("空欄は empty として返る", () => {
    expect(parseNumberInput("")).toEqual({ kind: "empty" });
    expect(parseNumberInput("   ")).toEqual({ kind: "empty" });
    expect(parseNumberInput("　")).toEqual({ kind: "empty" });
  });

  it("欄から離れても空欄のまま（0 が入らない）", () => {
    expect(formatOnBlur("")).toBe("");
    expect(formatOnBlur("　 ")).toBe("");
  });

  it("0 は 0 として読む（空欄扱いにしない）", () => {
    expect(parseNumberInput("0")).toEqual({ kind: "ok", value: 0, text: "0" });
  });
});

describe("マイナスと小数は欄ごとに決める", () => {
  it("既定ではマイナスを受け付けない", () => {
    const r = parseNumberInput("-1");
    expect(r.kind).toBe("invalid");
    expect(r.kind === "invalid" && r.reason).toContain("0以上");
  });

  it("許した欄ではマイナスを受け付ける（行動指針の -1 点）", () => {
    expect(parseNumberInput("-1", { allowNegative: true })).toEqual({ kind: "ok", value: -1, text: "-1" });
  });

  it("整数だけの欄では小数を受け付けない", () => {
    const r = parseNumberInput("1.5", { allowDecimal: false });
    expect(r.kind).toBe("invalid");
    expect(r.kind === "invalid" && r.reason).toContain("整数");
  });

  it("既定では小数を受け付ける（割合・達成率のため）", () => {
    expect(parseNumberInput("99.9")).toEqual({ kind: "ok", value: 99.9, text: "99.9" });
  });

  it("上限・下限の外は理由つきで断る", () => {
    expect(parseNumberInput("101", { max: 100 }).kind).toBe("invalid");
    expect(parseNumberInput("1", { min: 10 }).kind).toBe("invalid");
    expect(parseNumberInput("100", { max: 100 })).toEqual({ kind: "ok", value: 100, text: "100" });
  });
});

describe("打っている途中で壊れない", () => {
  it("打っている間は形を見ない（「-」だけ・「1.」まででも消さない）", () => {
    expect(normalizeWhileTyping("-")).toBe("-");
    expect(normalizeWhileTyping("1.")).toBe("1.");
    expect(normalizeWhileTyping("")).toBe("");
  });

  it("打っている間の変換は文字数を変えない（カーソルが飛ばない）", () => {
    for (const raw of ["１", "１２３", "９５．５", "－１", "1,2", "10%"]) {
      expect(normalizeWhileTyping(raw)).toHaveLength(raw.length);
    }
  });

  it("打っている間はカンマ・空白を落とさない（消すとカーソルがずれるため）", () => {
    expect(normalizeWhileTyping("1,2")).toBe("1,2");
    expect(normalizeWhileTyping("1 2")).toBe("1 2");
  });

  it("欄から離れたときに形が整う", () => {
    expect(formatOnBlur("１２３")).toBe("123");
    expect(formatOnBlur("1.")).toBe("1");
    expect(formatOnBlur("01")).toBe("1");
    expect(formatOnBlur(".5")).toBe("0.5");
    expect(formatOnBlur("1,000")).toBe("1000");
  });

  it("数字として読めないときは打った内容を消さない", () => {
    expect(formatOnBlur("あ")).toBe("あ");
    expect(formatOnBlur("-")).toBe("-");
    expect(parseNumberInput("あ").kind).toBe("invalid");
  });
});

describe("下限・上限の矛盾に気づける", () => {
  it("下限が上限より大きいときは断る", () => {
    const r = checkBounds(100, 80);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toContain("下限");
  });

  it("下限と上限が同じときは断る（上限はその値を含まないため空の範囲になる）", () => {
    const r = checkBounds(80, 80);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toContain("当てはまる値がありません");
  });

  it("片側だけ空欄（制限なし）は矛盾ではない", () => {
    expect(checkBounds(null, 100)).toEqual({ ok: true });
    expect(checkBounds(80, null)).toEqual({ ok: true });
    expect(checkBounds(null, null)).toEqual({ ok: true });
  });

  it("正しい範囲は通る", () => {
    expect(checkBounds(80, 100)).toEqual({ ok: true });
  });
});

describe("アンケートの設問ごとの決まりを画面と受け口で共有する", () => {
  it("「0以上」の設問ではマイナスを受け付けない", () => {
    const policy = questionNumberPolicy({ validationMin: 0, validationMax: null });
    expect(parseNumberInput("-1", policy).kind).toBe("invalid");
    expect(parseNumberInput("0", policy)).toEqual({ kind: "ok", value: 0, text: "0" });
  });

  it("「1以上」の設問では 0 を受け付けない", () => {
    const policy = questionNumberPolicy({ validationMin: 1, validationMax: null });
    expect(parseNumberInput("0", policy).kind).toBe("invalid");
    expect(parseNumberInput("1", policy)).toEqual({ kind: "ok", value: 1, text: "1" });
  });

  it("下限が決まっていない設問ではマイナスも受け付ける", () => {
    const policy = questionNumberPolicy({ validationMin: null, validationMax: null });
    expect(parseNumberInput("-3", policy)).toEqual({ kind: "ok", value: -3, text: "-3" });
  });

  it("全角で打たれた回答も、設問の決まりに照らして正しく読む", () => {
    const policy = questionNumberPolicy({ validationMin: 0, validationMax: 100 });
    expect(parseNumberInput("９５", policy)).toEqual({ kind: "ok", value: 95, text: "95" });
  });
});

describe("受け口の側でも数値の回答を検査する（画面を通さずに送られても素通りさせない）", () => {
  const q = (validationMin: number | null, validationMax: number | null, value: number | null) => ({
    title: "受注件数",
    validationMin,
    validationMax,
    value,
  });

  it("設問の下限を下回る値は理由つきで断る", () => {
    const r = checkAnswerNumbers([q(1, null, 0)]);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toContain("受注件数");
  });

  it("設問の上限を超える値は断る", () => {
    expect(checkAnswerNumbers([q(0, 100, 101)]).ok).toBe(false);
  });

  it("マイナスは下限のある設問でだけ断る（下限が無い設問では通す）", () => {
    expect(checkAnswerNumbers([q(0, null, -1)]).ok).toBe(false);
    expect(checkAnswerNumbers([q(null, null, -1)])).toEqual({ ok: true });
  });

  it("未入力（null）は数値の検査では断らない（必須かどうかの判定とは別）", () => {
    expect(checkAnswerNumbers([q(1, null, null)])).toEqual({ ok: true });
  });

  it("0 を未入力と混同しない（0 は下限を満たすなら通る）", () => {
    expect(checkAnswerNumbers([q(0, null, 0)])).toEqual({ ok: true });
  });

  it("決まりの中に収まる値は通る", () => {
    expect(checkAnswerNumbers([q(0, 100, 50), q(1, null, 3)])).toEqual({ ok: true });
  });
});
