import { describe, expect, it } from "vitest";
import {
  bandChangeBlockers,
  bandChoiceNote,
  bandLine,
  bandRuns,
  bandSplitMessage,
  bandSplits,
  type BandGrade,
} from "@/lib/domain/behavior-band-range";

/** 初期の分け方（data/grades.json・seed と同じ） */
const initial = (): BandGrade[] =>
  (
    [
      ["g1", "等級1", "g1_2"],
      ["g2", "等級2", "g1_2"],
      ["g3", "等級3", "g3_4"],
      ["g41", "等級4-1", "g3_4"],
      ["g42", "等級4-2", "g3_4"],
      ["g51", "等級5-1", null],
      ["g52", "等級5-2", null],
    ] as const
  ).map(([id, name, behaviorBand], i) => ({ id, name, displayOrder: i + 1, isActive: true, behaviorBand }));

/** 本番で見つかった形: 等級1 だけが上の層のセットへ移っている */
const drifted = () => initial().map((g) => (g.id === "g1" ? { ...g, name: "等級1----", behaviorBand: "g3_4" } : g));

/** 割り当てだけを並べた会社（g1・g2… の順、名前は 等級1・等級2…） */
const line = (bands: readonly (string | null)[]): BandGrade[] =>
  bands.map((behaviorBand, i) => ({ id: `g${i + 1}`, name: `等級${i + 1}`, displayOrder: i + 1, isActive: true, behaviorBand }));

describe("行動指針の基準セットは続いた等級にだけ出す", () => {
  it("初期の分け方は飛び飛びが無い", () => {
    expect(bandSplits(initial())).toEqual([]);
    expect(bandRuns(initial()).map((r) => [r.band, r.grades.map((g) => g.name)])).toEqual([
      ["g1_2", ["等級1", "等級2"]],
      ["g3_4", ["等級3", "等級4-1", "等級4-2"]],
      [null, ["等級5-1", "等級5-2"]],
    ]);
  });

  it("等級2 を挟んで 等級1 と 等級3 に同じセットを出すと、飛び飛びとして見つける", () => {
    const [split] = bandSplits(drifted());
    expect(split.band).toBe("g3_4");
    expect(split.members.map((g) => g.name)).toEqual(["等級1----", "等級3", "等級4-1", "等級4-2"]);
    expect(split.gaps.map((g) => g.name)).toEqual(["等級2"]);
    expect(bandSplitMessage(split)).toBe(
      "等級1----・等級3・等級4-1・等級4-2に同じ行動指針を出すと、あいだの等級2だけが別になります。同じ行動指針は、等級の並びで続いた等級にだけ出せます。",
    );
  });

  it("境目を1つずらすのは通す（等級2 を上の層へ、等級3 を下の層へ）", () => {
    expect(bandChangeBlockers(initial(), { gradeId: "g2", behaviorBand: "g3_4" })).toEqual([]);
    expect(bandChangeBlockers(initial(), { gradeId: "g3", behaviorBand: "g1_2" })).toEqual([]);
    expect(bandChangeBlockers(initial(), { gradeId: "g42", behaviorBand: null })).toEqual([]);
  });

  it("飛び飛びになる割り当ては止め、挟まる等級を理由に出す", () => {
    const blockers = bandChangeBlockers(initial(), { gradeId: "g1", behaviorBand: "g3_4" });
    expect(blockers.map((s) => s.band)).toEqual(["g3_4"]);
    expect(bandChoiceNote(blockers, "g1")).toBe("等級2を挟むので選べません");
    // 層の途中を「出さない」にすると、残りが割れる
    expect(bandChangeBlockers(initial(), { gradeId: "g41", behaviorBand: null }).map((s) => s.band)).toEqual(["g3_4"]);
    expect(bandChangeBlockers(initial(), { gradeId: "g51", behaviorBand: "g1_2" }).map((s) => s.band)).toEqual(["g1_2"]);
  });

  it("すでに飛び飛びの会社でも、直す向きの1手は通し、悪くする手は止める", () => {
    expect(bandChangeBlockers(drifted(), { gradeId: "g1", behaviorBand: "g1_2" })).toEqual([]);
    expect(bandChangeBlockers(drifted(), { gradeId: "g2", behaviorBand: "g3_4" })).toEqual([]);
    // 飛び飛びのセットへさらに足すのは止める
    expect(bandChangeBlockers(drifted(), { gradeId: "g51", behaviorBand: "g3_4" }).map((s) => s.band)).toEqual(["g3_4"]);
    // 別の等級の変更は、前からある飛び飛びを理由に止めない
    expect(bandChangeBlockers(drifted(), { gradeId: "g52", behaviorBand: null })).toEqual([]);
    expect(bandChangeBlockers(drifted(), { gradeId: "g42", behaviorBand: null })).toEqual([]);
  });

  it("変えない保存は断らない（飛び飛びのセットに属する等級へ、今と同じ値を渡す）", () => {
    expect(bandChangeBlockers(drifted(), { gradeId: "g1", behaviorBand: "g3_4" })).toEqual([]);
    expect(bandChangeBlockers(drifted(), { gradeId: "g3", behaviorBand: "g3_4", isActive: true })).toEqual([]);
    expect(bandChangeBlockers(drifted(), { gradeId: "g2" })).toEqual([]);
    // 見つからない等級も断らない（自社の等級かどうかは呼び出し側が先に確かめる）
    expect(bandChangeBlockers(drifted(), { gradeId: "nope", behaviorBand: "g1_2" })).toEqual([]);
  });

  it("挟まる等級が2つ以上でも、穴を1つ埋める手は通す（X Y X Y X の2番目を X に）", () => {
    expect(bandSplits(line(["x", "y", "x", "y", "x"])).map((s) => [s.band, s.gaps.length])).toEqual([
      ["x", 2],
      ["y", 1],
    ]);
    expect(bandChangeBlockers(line(["x", "y", "x", "y", "x"]), { gradeId: "g2", behaviorBand: "x" })).toEqual([]);
  });

  it("すでに飛び飛びの会社で、真ん中の等級を「出さない」にする手は止める", () => {
    const blockers = bandChangeBlockers(drifted(), { gradeId: "g41", behaviorBand: null });
    expect(blockers.map((s) => [s.band, s.gaps.map((g) => g.name)])).toEqual([["g3_4", ["等級2", "等級4-1"]]]);
    // 原因は前からある 等級2 ではなく、選ぶ 等級4-1 が抜けること
    expect(bandChoiceNote(blockers, "g41")).toBe("等級1----・等級3・等級4-2の行動指針が途切れるので選べません");
  });

  it("すでに飛び飛びのセットの切れ目を広げる手は止める（A B A A の3番目を C に）", () => {
    const blockers = bandChangeBlockers(line(["a", "b", "a", "a"]), { gradeId: "g3", behaviorBand: "c" });
    expect(blockers.map((s) => [s.band, s.gaps.map((g) => g.id)])).toEqual([["a", ["g2", "g3"]]]);
    expect(bandChoiceNote(blockers, "g3")).toBe("等級1・等級4の行動指針が途切れるので選べません");
  });

  it("選ぶ等級自身が挟まる側になるなら、途切れるセットの等級を理由に出す", () => {
    const blockers = bandChangeBlockers(initial(), { gradeId: "g41", behaviorBand: null });
    expect(bandChoiceNote(blockers, "g41")).toBe("等級3・等級4-2の行動指針が途切れるので選べません");
  });

  it("並び順が同着の等級は id の順に並べる（読み出しの順が画面とサーバーで違っても、同じ判定になる）", () => {
    const tied: BandGrade[] = [
      { id: "gb", name: "等級B", displayOrder: 1, isActive: true, behaviorBand: "x" },
      { id: "ga", name: "等級A", displayOrder: 1, isActive: true, behaviorBand: "y" },
      { id: "gc", name: "等級C", displayOrder: 2, isActive: true, behaviorBand: "x" },
    ];
    expect(bandLine(tied).map((g) => g.id)).toEqual(["ga", "gb", "gc"]);
    expect(bandLine([...tied].reverse()).map((g) => g.id)).toEqual(["ga", "gb", "gc"]);
    expect(bandSplits(tied)).toEqual([]);
  });

  it("理由の文の等級名は gradeLabel を通す（名前が空の等級は「等級未設定」。画面とサーバーで同じ文）", () => {
    const unnamed = drifted().map((g) => (g.id === "g2" ? { ...g, name: " " } : g));
    const blockers = bandChangeBlockers(unnamed, { gradeId: "g51", behaviorBand: "g3_4" });
    expect(bandSplitMessage(blockers[0])).toBe(
      "等級1----・等級3・等級4-1・等級4-2・等級5-1に同じ行動指針を出すと、あいだの等級未設定だけが別になります。同じ行動指針は、等級の並びで続いた等級にだけ出せます。",
    );
    expect(bandChoiceNote(blockers, "g51")).toBe("等級未設定を挟むので選べません");
  });

  it("使用を止めた等級は並びから外す。戻すと割れるなら止める", () => {
    const withStopped = initial().map((g) => (g.id === "g41" ? { ...g, isActive: false, behaviorBand: null } : g));
    expect(bandSplits(withStopped)).toEqual([]);
    expect(bandChangeBlockers(withStopped, { gradeId: "g41", isActive: true }).map((s) => s.band)).toEqual(["g3_4"]);
    expect(bandChangeBlockers(withStopped, { gradeId: "g41", isActive: true, behaviorBand: "g3_4" })).toEqual([]);
  });

  it("使用を止める手は止めない（並びから外すと、割れは減ることしかない）", () => {
    expect(bandChangeBlockers(initial(), { gradeId: "g3", isActive: false })).toEqual([]);
    // 飛び飛びの間に挟まった等級を止めると、割れが直る
    expect(bandChangeBlockers(drifted(), { gradeId: "g2", isActive: false })).toEqual([]);
    expect(bandChoiceNote([], "g2")).toBeNull();
  });
});
