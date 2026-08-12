import { describe, expect, it } from "vitest";
import { MAX_ABS_NUMBER, checkNumberMagnitude } from "@/lib/domain/number-input";
import { checkRankBoundaries } from "@/lib/domain/rank-bounds";

/**
 * 「桁が多すぎる」の断り方を、経路をまたいで1つに保つための試験。
 *
 * これまで 1兆の上限が当たっていたのは回答の提出と取り込みだけで、
 * 設問づくりの下限・上限とランク基準の下限・上限は無制限のまま受け付けていた。
 * ここで確かめるのは「同じ物差しが当たること」と「ちょうど 1兆は通ること」の2つ。
 * 上限を1つに保てているかは、`MAX_ABS_NUMBER` を直接使って書くことで守る
 * （試験の中に 1000000000000 と数字を書き写すと、片方だけ直したときに気づけない）。
 */
describe("checkNumberMagnitude（桁の上限を1つに保つ）", () => {
  it("空欄（null・未指定）は何も言わない。「決めていない」は誤りではない", () => {
    expect(checkNumberMagnitude("下限", null)).toEqual({ ok: true });
    expect(checkNumberMagnitude("下限", undefined)).toEqual({ ok: true });
  });

  it("ふつうの値・0・マイナスはそのまま通る", () => {
    expect(checkNumberMagnitude("下限", 0)).toEqual({ ok: true });
    expect(checkNumberMagnitude("下限", 130)).toEqual({ ok: true });
    expect(checkNumberMagnitude("下限", -1)).toEqual({ ok: true });
    expect(checkNumberMagnitude("下限", 0.5)).toEqual({ ok: true });
  });

  it("ちょうど 1兆は通る（境界はその値を含む）", () => {
    expect(checkNumberMagnitude("上限", MAX_ABS_NUMBER)).toEqual({ ok: true });
    expect(checkNumberMagnitude("下限", -MAX_ABS_NUMBER)).toEqual({ ok: true });
  });

  it("1兆より1だけ大きい／小さい値は断る（境界のすぐ外）", () => {
    const over = checkNumberMagnitude("上限", MAX_ABS_NUMBER + 1);
    expect(over.ok).toBe(false);
    const under = checkNumberMagnitude("下限", -MAX_ABS_NUMBER - 1);
    expect(under.ok).toBe(false);
  });

  it("断る文には、どの欄かと、桁を確かめてほしいことが両方入る", () => {
    const r = checkNumberMagnitude("「売上件数」の上限（1e+21）", 1e21);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // 「どの欄か」が先に出る（利用者が直す場所を探せる）
    expect(r.message.startsWith("「売上件数」の上限（1e+21）は")).toBe(true);
    // 「エラー」ではなく、何をすればよいかで終わる
    expect(r.message).toContain("桁を間違えていないか");
    expect(r.message).toContain("1兆");
  });

  it("数として読めない値（無限大・NaN）も同じ言い方で断る", () => {
    expect(checkNumberMagnitude("上限", Number.POSITIVE_INFINITY).ok).toBe(false);
    expect(checkNumberMagnitude("上限", Number.NEGATIVE_INFINITY).ok).toBe(false);
    expect(checkNumberMagnitude("上限", Number.NaN).ok).toBe(false);
  });

  it("極端に小さい値（0に近い小数）は桁の問題ではないので通る", () => {
    expect(checkNumberMagnitude("下限", Number.MIN_VALUE)).toEqual({ ok: true });
  });
});

/**
 * ランク基準の受け口。
 *
 * これまでは「隣のランクと繋がらない」の検査がたまたま防いでいただけで、
 * 下限・上限そのものには上限が無かった。防波堤が1つしかない状態をやめる。
 */
describe("checkRankBoundaries（ランク基準の下限・上限にも同じ上限を当てる）", () => {
  /** 本番と同じ形（A〜E・higher・端は空欄）で、繋がっているひと組 */
  const sound = [
    { rank: "A", lowerBound: 120, upperBound: null },
    { rank: "B", lowerBound: 110, upperBound: 120 },
    { rank: "C", lowerBound: 100, upperBound: 110 },
    { rank: "D", lowerBound: 90, upperBound: 100 },
    { rank: "E", lowerBound: null, upperBound: 90 },
  ];

  it("いまの本番と同じ大きさの値（0〜130）はこれまでどおり通る", () => {
    expect(checkRankBoundaries(sound, "higher")).toEqual({ ok: true });
  });

  it("ちょうど 1兆までは通る（実務で打てる値を拒まない）", () => {
    const rows = [
      { rank: "A", lowerBound: MAX_ABS_NUMBER, upperBound: null },
      { rank: "B", lowerBound: 110, upperBound: MAX_ABS_NUMBER },
      { rank: "C", lowerBound: 100, upperBound: 110 },
      { rank: "D", lowerBound: 90, upperBound: 100 },
      { rank: "E", lowerBound: null, upperBound: 90 },
    ];
    expect(checkRankBoundaries(rows, "higher")).toEqual({ ok: true });
  });

  it("下限の桁が多すぎるときは、その旨を先に言う（「隣と繋がらない」で終わらせない）", () => {
    const rows = sound.map((r) => (r.rank === "B" ? { ...r, lowerBound: 1e15 } : r));
    const r = checkRankBoundaries(rows, "higher");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0].message).toContain("ランクBの下限");
    expect(r.issues[0].message).toContain("桁を間違えていないか");
    // 桁の打ち間違いは、こちらで直しようがないので直し方の提案は付けない
    expect(r.issues[0].fix).toBeNull();
    // 繋がりの話は混ぜない（原因が2つあるように見えると、どちらを直すか分からなくなる）
    expect(r.issues.some((x) => x.message.includes("繋が"))).toBe(false);
  });

  it("上限の桁が多すぎるときも同じように断る（低いほど良い項目でも）", () => {
    const rows = [
      { rank: "A", lowerBound: null, upperBound: 10 },
      { rank: "B", lowerBound: 10, upperBound: 20 },
      { rank: "C", lowerBound: 20, upperBound: 30 },
      { rank: "D", lowerBound: 30, upperBound: 40 },
      { rank: "E", lowerBound: 40, upperBound: -MAX_ABS_NUMBER * 10 },
    ];
    const r = checkRankBoundaries(rows, "lower");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues[0].message).toContain("ランクEの上限");
  });

  it("桁の多すぎる値が複数あれば、まとめて全部知らせる（1つ直すたびに出直しにしない）", () => {
    const rows = sound.map((r) =>
      r.rank === "B" ? { ...r, lowerBound: 1e15, upperBound: 1e16 } : r,
    );
    const r = checkRankBoundaries(rows, "higher");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues).toHaveLength(2);
    expect(r.issues[0].message).toContain("下限");
    expect(r.issues[1].message).toContain("上限");
  });

  it("行が1件も無いときは何も言わない（消し込みの途中で叱らない）", () => {
    expect(checkRankBoundaries([], "higher")).toEqual({ ok: true });
  });
});
