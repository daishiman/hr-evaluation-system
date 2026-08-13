import { describe, expect, it } from "vitest";
import {
  availableRanges,
  buildGradeBands,
  chartDensity,
  filterByRange,
  gradeChanges,
  RANGE_YEARS,
  type TrendSource,
} from "@/lib/domain/evaluation-trend";

const NOW = new Date("2026-08-13T00:00:00Z").getTime();

function p(cycle: string, periodStart: string | null, gradeName: string | null): TrendSource {
  return { cycle, periodStart, gradeName };
}

describe("等級の区間", () => {
  it("同じ等級が続くあいだは1つの区間として伸ばす", () => {
    const bands = buildGradeBands([
      p("2024上期", "2024-04-01", "等級1"),
      p("2024下期", "2024-10-01", "等級1"),
      p("2025上期", "2025-04-01", "等級2"),
    ]);
    expect(bands).toEqual([
      { from: "2024上期", to: "2024下期", label: "等級1", alt: false, size: 2 },
      { from: "2025上期", to: "2025上期", label: "等級2", alt: true, size: 1 },
    ]);
  });

  it("等級が戻ったら、同じ名前でも別の区間として数える", () => {
    const bands = buildGradeBands([
      p("1期", "2024-04-01", "等級1"),
      p("2期", "2024-10-01", "等級2"),
      p("3期", "2025-04-01", "等級1"),
    ]);
    expect(bands.map((b) => b.label)).toEqual(["等級1", "等級2", "等級1"]);
    // 交互の印は並び順で決まる（同じ名前でも隣り合わなければ同じ濃さでよい）
    expect(bands.map((b) => b.alt)).toEqual([false, true, false]);
  });

  it("等級が入っていない評価も、無言で飛ばさず区間にする", () => {
    expect(buildGradeBands([p("1期", "2024-04-01", null)])).toEqual([
      { from: "1期", to: "1期", label: "等級未設定", alt: false, size: 1 },
    ]);
  });

  it("評価が1件もなければ区間もない", () => {
    expect(buildGradeBands([])).toEqual([]);
  });

  it("最初の区間は「変わった」ではないので印を出さない", () => {
    const bands = buildGradeBands([p("1期", "2024-04-01", "等級1"), p("2期", "2024-10-01", "等級2")]);
    expect(gradeChanges(bands)).toEqual([{ at: "2期", label: "等級2へ" }]);
    expect(gradeChanges(bands.slice(0, 1))).toEqual([]);
  });

  it("狭すぎる区間は等級名を書かない（隣と重なって読めなくなるため）", () => {
    // 20期のうち1期だけ等級が変わった人。線は出すが名前は出さない
    const points = Array.from({ length: 20 }, (_, i) =>
      p(`${i}期`, "2024-04-01", i === 10 ? "等級2" : "等級1"),
    );
    const changes = gradeChanges(buildGradeBands(points));
    // 1期しかない等級2は名前を伏せ、9期続く等級1に戻るところは名前を出す
    expect(changes).toEqual([
      { at: "10期", label: "" },
      { at: "11期", label: "等級1へ" },
    ]);
  });
});

describe("期間の絞り込み", () => {
  const points = [
    p("2016上期", "2016-04-01", "等級1"),
    p("2024上期", "2024-04-01", "等級1"),
    p("2026上期", "2026-04-01", "等級2"),
  ];

  it("全期間を選んだら1件も落とさない", () => {
    expect(filterByRange(points, null, NOW)).toHaveLength(3);
  });

  it("直近1年は、その中に入る期だけを残す", () => {
    expect(filterByRange(points, 1, NOW).map((x) => x.cycle)).toEqual(["2026上期"]);
    expect(filterByRange(points, 3, NOW).map((x) => x.cycle)).toEqual(["2024上期", "2026上期"]);
  });

  it("期間が入っていない評価は、絞り込んでも残す", () => {
    const withUnknown = [...points, p("期間不明", null, "等級2")];
    expect(filterByRange(withUnknown, 1, NOW).map((x) => x.cycle)).toEqual(["2026上期", "期間不明"]);
  });

  it("日付として読めない値も残す（消すと欠損の話になってしまう）", () => {
    expect(filterByRange([p("壊れた期", "not-a-date", "等級1")], 1, NOW)).toHaveLength(1);
  });

  it("データの幅より広い選択肢は出さない", () => {
    // 2016年からの10年ぶんがあるので1年・3年・5年をすべて出せる
    expect(availableRanges(points, NOW)).toEqual([...RANGE_YEARS]);
    // 2年ぶんしかなければ、出せるのは1年だけ
    expect(availableRanges([p("2024下期", "2024-10-01", "等級1")], NOW)).toEqual([1]);
  });

  it("1年に満たなければ絞り込み自体を出さない", () => {
    expect(availableRanges([p("2026上期", "2026-04-01", "等級1")], NOW)).toEqual([]);
    expect(availableRanges([p("期間不明", null, "等級1")], NOW)).toEqual([]);
    expect(availableRanges([], NOW)).toEqual([]);
  });
});

describe("横軸の描き方", () => {
  it("点が少ないうちは全部にラベルと丸を出す", () => {
    expect(chartDensity(0)).toEqual({ tickInterval: 0, showDots: true });
    expect(chartDensity(8)).toEqual({ tickInterval: 0, showDots: true });
  });

  it("点が増えたらラベルを間引く", () => {
    expect(chartDensity(16).tickInterval).toBe(1);
    expect(chartDensity(120).tickInterval).toBe(14);
  });

  it("点が多すぎるときは丸を消して線だけにする", () => {
    expect(chartDensity(24).showDots).toBe(true);
    expect(chartDensity(25).showDots).toBe(false);
  });
});
