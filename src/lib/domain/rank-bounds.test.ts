import { describe, expect, it } from "vitest";
import { applyFixes, checkRankBoundaries, type RankBoundRow } from "@/lib/domain/rank-bounds";
import { matchesCriterion, type Rank } from "@/lib/domain/scoring";

/** 高いほど良い指標の、繋がった基準（A が青天井、E が下限なし） */
const higherOk: RankBoundRow[] = [
  { rank: "A", lowerBound: 100, upperBound: null },
  { rank: "B", lowerBound: 90, upperBound: 100 },
  { rank: "C", lowerBound: 70, upperBound: 90 },
  { rank: "D", lowerBound: 40, upperBound: 70 },
  { rank: "E", lowerBound: null, upperBound: 40 },
];

/** 低いほど良い指標の、繋がった基準（A が下限なし、E が上限なし） */
const lowerOk: RankBoundRow[] = [
  { rank: "A", lowerBound: null, upperBound: 1 },
  { rank: "B", lowerBound: 1, upperBound: 3 },
  { rank: "C", lowerBound: 3, upperBound: 5 },
  { rank: "D", lowerBound: 5, upperBound: 10 },
  { rank: "E", lowerBound: 10, upperBound: null },
];

describe("ランク同士の境界を全体で見る", () => {
  it("繋がっていれば通る（高いほど良い）", () => {
    expect(checkRankBoundaries(higherOk, "higher")).toEqual({ ok: true });
  });

  it("繋がっていれば通る（低いほど良い）", () => {
    expect(checkRankBoundaries(lowerOk, "lower")).toEqual({ ok: true });
  });

  it("重なりを見つけ、どう直せば繋がるかまで言う", () => {
    const rows = higherOk.map((r) => (r.rank === "B" ? { ...r, upperBound: 105 } : r));
    const r = checkRankBoundaries(rows, "higher");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues[0].message).toContain("両方に当てはまります");
    expect(r.issues[0].message).toContain("100にすると重なりが無くなります");
    expect(r.issues[0].fix).toEqual({ rank: "B", field: "upperBound", value: 100 });
  });

  it("隙間を見つけ、どう直せば繋がるかまで言う", () => {
    const rows = higherOk.map((r) => (r.rank === "B" ? { ...r, upperBound: 95 } : r));
    const r = checkRankBoundaries(rows, "higher");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues[0].message).toContain("どのランクにも当てはまりません");
    expect(r.issues[0].fix).toEqual({ rank: "B", field: "upperBound", value: 100 });
  });

  it("向きが逆の指標でも、繋ぎ目に来る欄が入れ替わったうえで見つかる", () => {
    // 低いほど良い指標では「上のランクの上限」と「下のランクの下限」が繋ぎ目
    const rows = lowerOk.map((r) => (r.rank === "B" ? { ...r, lowerBound: 2 } : r));
    const r = checkRankBoundaries(rows, "lower");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues[0].fix).toEqual({ rank: "B", field: "lowerBound", value: 1 });
  });

  it("同じ値でも向きを取り違えると見逃す、ということが起きない（両向きで検査される）", () => {
    // 高いほど良い指標の並びを、そのまま低いほど良いとして見ると繋がっていない
    expect(checkRankBoundaries(higherOk, "lower").ok).toBe(false);
    expect(checkRankBoundaries(lowerOk, "higher").ok).toBe(false);
  });

  it("いちばん上のランクの外側が閉じていると断る（高いほど良い）", () => {
    const rows = higherOk.map((r) => (r.rank === "A" ? { ...r, upperBound: 200 } : r));
    const r = checkRankBoundaries(rows, "higher");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues.some((x) => x.message.includes("いちばん上のランクA"))).toBe(true);
    expect(r.issues.some((x) => x.fix?.value === null && x.fix?.field === "upperBound")).toBe(true);
  });

  it("いちばん下のランクの外側が閉じていると断る（高いほど良い）", () => {
    const rows = higherOk.map((r) => (r.rank === "E" ? { ...r, lowerBound: 0 } : r));
    const r = checkRankBoundaries(rows, "higher");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues.some((x) => x.message.includes("いちばん下のランクE"))).toBe(true);
  });

  it("いちばん上のランクの外側は、向きが逆なら下限の側になる", () => {
    const rows = lowerOk.map((r) => (r.rank === "A" ? { ...r, lowerBound: 0 } : r));
    const r = checkRankBoundaries(rows, "lower");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues.some((x) => x.message.includes("いちばん上のランクA") && x.message.includes("下限"))).toBe(true);
  });

  it("1つのランクの中で下限と上限が逆でも見つかる", () => {
    const rows = higherOk.map((r) => (r.rank === "C" ? { lowerBound: 90, upperBound: 70, rank: "C" } : r));
    const r = checkRankBoundaries(rows, "higher");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues.some((x) => x.message.includes("ランクCの下限（90）が上限（70）より大きく"))).toBe(true);
  });

  it("繋ぎ目のどちらかが空欄なら断る（片側だけ消しても繋がらない）", () => {
    const rows = higherOk.map((r) => (r.rank === "C" ? { ...r, upperBound: null } : r));
    const r = checkRankBoundaries(rows, "higher");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues[0].message).toContain("繋がっていません");
  });

  it("提案どおりに直すと通るようになる", () => {
    const broken = higherOk.map((r) => (r.rank === "B" ? { ...r, upperBound: 105 } : r));
    const first = checkRankBoundaries(broken, "higher");
    expect(first.ok).toBe(false);
    if (first.ok) return;
    const fixed = applyFixes(
      broken,
      first.issues.map((x) => x.fix).filter((x): x is NonNullable<typeof x> => x !== null),
    );
    expect(checkRankBoundaries(fixed, "higher")).toEqual({ ok: true });
  });
});

describe("繋がった基準は、実際の判定でも過不足なく1つに決まる", () => {
  const judgeAll = (value: number, rows: RankBoundRow[], direction: "higher" | "lower") =>
    rows
      .filter((c) => matchesCriterion(value, { ...c, rank: c.rank as Rank, displayLabel: "" }, direction))
      .map((c) => c.rank);

  it("境界のちょうどの値も、必ず1つのランクにだけ当たる（高いほど良い）", () => {
    for (const v of [0, 39, 40, 41, 69, 70, 89, 90, 99, 100, 101, 1000]) {
      expect(judgeAll(v, higherOk, "higher"), `実績値 ${v}`).toHaveLength(1);
    }
  });

  it("境界のちょうどの値も、必ず1つのランクにだけ当たる（低いほど良い）", () => {
    for (const v of [0, 1, 2, 3, 4, 5, 9, 10, 11, 100]) {
      expect(judgeAll(v, lowerOk, "lower"), `実績値 ${v}`).toHaveLength(1);
    }
  });

  it("検査を通らない基準では、実際に重なりや隙間が起きる（検査が机上の空論でないこと）", () => {
    const overlapping = higherOk.map((r) => (r.rank === "B" ? { ...r, upperBound: 105 } : r));
    expect(checkRankBoundaries(overlapping, "higher").ok).toBe(false);
    expect(judgeAll(102, overlapping, "higher")).toEqual(["A", "B"]);

    const gapped = higherOk.map((r) => (r.rank === "B" ? { ...r, upperBound: 95 } : r));
    expect(checkRankBoundaries(gapped, "higher").ok).toBe(false);
    expect(judgeAll(97, gapped, "higher")).toEqual([]);
  });
});
