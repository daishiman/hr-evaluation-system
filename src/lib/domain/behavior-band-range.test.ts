import { describe, expect, it } from "vitest";
import {
  bandChangeBlockers,
  bandChoiceNote,
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
    expect(bandChoiceNote(blockers)).toBe("等級2を挟むので選べません");
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
    expect(bandChoiceNote([])).toBeNull();
  });
});
