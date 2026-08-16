import { describe, expect, it } from "vitest";
import {
  addScreenCounters,
  averageDwellMs,
  dateKeyRange,
  EMPTY_SCREEN_COUNTERS,
  fillUnusedScreens,
  formatDateTick,
  formatDuration,
  frictionBreakdown,
  frictionPer100Views,
  frictionSignals,
  rankByDwell,
  pickNextScreenToFix,
  rankByFriction,
  shiftDateKey,
  usageDateKey,
  usageRetentionCutoff,
  USAGE_MIN_VIEWS_FOR_RANKING,
  type UsageScreenCounters,
} from "@/lib/domain/usage";

/** 数だけを差し替えた1画面ぶん。 */
function counters(patch: Partial<UsageScreenCounters>): UsageScreenCounters {
  return { ...EMPTY_SCREEN_COUNTERS, ...patch };
}

describe("日付を日本時間で切る", () => {
  it("日本の朝の操作を前日に入れない", () => {
    // 世界標準時では前日23:00、日本時間では当日8:00
    expect(usageDateKey(new Date("2026-08-16T23:00:00Z"))).toBe("2026-08-17");
  });

  it("日本時間の0時ちょうどから新しい日にする", () => {
    expect(usageDateKey(new Date("2026-08-16T14:59:59Z"))).toBe("2026-08-16");
    expect(usageDateKey(new Date("2026-08-16T15:00:00Z"))).toBe("2026-08-17");
  });

  it("月をまたいでずらせる", () => {
    expect(shiftDateKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDateKey("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("期間は両端を含む日数ぶん、古い順に並ぶ", () => {
    const range = dateKeyRange("2026-08-17", 3);
    expect(range).toEqual(["2026-08-15", "2026-08-16", "2026-08-17"]);
  });

  it("保存期間の境目は、その日ぶんを残す", () => {
    // 30日ぶん残すなら、今日を含めて30日目が境目
    expect(usageRetentionCutoff(new Date("2026-08-17T03:00:00Z"), 30)).toBe("2026-07-19");
    expect(dateKeyRange("2026-08-17", 30)[0]).toBe("2026-07-19");
  });
});

describe("足し込み", () => {
  it("同じ画面の数を足し合わせる", () => {
    const sum = addScreenCounters(
      counters({ views: 3, dwellMs: 1000, dwellSamples: 2, errors: 1 }),
      counters({ views: 2, dwellMs: 500, dwellSamples: 1, rageClicks: 4 }),
    );
    expect(sum).toEqual(counters({ views: 5, dwellMs: 1500, dwellSamples: 3, errors: 1, rageClicks: 4 }));
  });
});

describe("迷いの読み方", () => {
  it("兆候は5種類を合計する", () => {
    expect(frictionSignals(counters({ longStays: 1, backtracks: 2, rageClicks: 3, abandons: 4, errors: 5 }))).toBe(15);
  });

  it("内訳は多い順で、0件の種類は出さない", () => {
    const breakdown = frictionBreakdown(counters({ longStays: 1, rageClicks: 5 }));
    expect(breakdown).toEqual([
      { kind: "rageClicks", count: 5 },
      { kind: "longStays", count: 1 },
    ]);
  });

  it("100回あたりの件数にして、よく通る画面が必ず上に来るのを防ぐ", () => {
    expect(frictionPer100Views(counters({ views: 200, longStays: 4 }))).toBe(2);
    expect(frictionPer100Views(counters({ views: 20, longStays: 4 }))).toBe(20);
  });

  it("一度も開かれていない画面の率は0にする（0で割らない）", () => {
    expect(frictionPer100Views(EMPTY_SCREEN_COUNTERS)).toBe(0);
  });

  it("滞在を測れていない画面は平均を出さない（0秒と区別する）", () => {
    expect(averageDwellMs(counters({ views: 3 }))).toBeNull();
    expect(averageDwellMs(counters({ dwellMs: 3000, dwellSamples: 2 }))).toBe(1500);
  });
});

describe("先に直す画面の並び", () => {
  const rows = [
    { routePattern: "/a", counters: counters({ views: 100, longStays: 5 }) }, // 100回あたり5件
    { routePattern: "/b", counters: counters({ views: 10, longStays: 5 }) }, // 100回あたり50件
    { routePattern: "/c", counters: counters({ views: 200 }) }, // 兆候なし
    { routePattern: "/rare", counters: counters({ views: 2, errors: 2 }) }, // ほとんど使われていない
  ];

  it("件数ではなく率の高い順に並べる", () => {
    expect(rankByFriction(rows).map((r) => r.routePattern)).toEqual(["/b", "/a"]);
  });

  it("兆候が0件の画面は出さない", () => {
    expect(rankByFriction(rows).some((r) => r.routePattern === "/c")).toBe(false);
  });

  it(`${USAGE_MIN_VIEWS_FOR_RANKING}回未満しか開かれていない画面は順位に入れない`, () => {
    // 1回の出来事で率100%になり、最上位に居座ってしまうため
    expect(rankByFriction(rows).some((r) => r.routePattern === "/rare")).toBe(false);
  });

  it("率が同じなら、人が多く通る方を上にする", () => {
    const tie = [
      { routePattern: "/few", counters: counters({ views: 10, longStays: 1 }) },
      { routePattern: "/many", counters: counters({ views: 100, longStays: 10 }) },
    ];
    expect(rankByFriction(tie).map((r) => r.routePattern)).toEqual(["/many", "/few"]);
  });

  it("時間がかかっている画面は、1回あたりの滞在が長い順", () => {
    const dwell = [
      { routePattern: "/short", counters: counters({ views: 10, dwellMs: 10_000, dwellSamples: 10 }) },
      { routePattern: "/long", counters: counters({ views: 10, dwellMs: 100_000, dwellSamples: 10 }) },
      { routePattern: "/unmeasured", counters: counters({ views: 10 }) },
    ];
    expect(rankByDwell(dwell).map((r) => r.routePattern)).toEqual(["/long", "/short"]);
  });
});

describe("次に直す1画面", () => {
  it("率が低くても、実際に詰まった人が多い画面を選ぶ", () => {
    // /b は率50%だが5件、/a は率5%でも5件…ではなく、件数で決まることを見る
    const rows = [
      { routePattern: "/heavy", counters: counters({ views: 400, longStays: 80 }) }, // 率20%・80件
      { routePattern: "/sharp", counters: counters({ views: 6, errors: 5 }) }, // 率83%・5件
    ];
    expect(pickNextScreenToFix(rows)?.routePattern).toBe("/heavy");
  });

  it("件数が同じなら、率の高い方を選ぶ", () => {
    const rows = [
      { routePattern: "/wide", counters: counters({ views: 200, longStays: 10 }) },
      { routePattern: "/narrow", counters: counters({ views: 20, longStays: 10 }) },
    ];
    expect(pickNextScreenToFix(rows)?.routePattern).toBe("/narrow");
  });

  it("順位に入る画面が無ければ、何も勧めない", () => {
    expect(pickNextScreenToFix([{ routePattern: "/quiet", counters: counters({ views: 300 }) }])).toBeNull();
    expect(pickNextScreenToFix([])).toBeNull();
  });

  it("ほとんど使われていない画面は勧めない", () => {
    const rows = [{ routePattern: "/rare", counters: counters({ views: 2, errors: 2 }) }];
    expect(pickNextScreenToFix(rows)).toBeNull();
  });
});

describe("表示用の加工", () => {
  it("ミリ秒を人が読む形にする", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(850)).toBe("850ミリ秒");
    expect(formatDuration(45_000)).toBe("45秒");
    expect(formatDuration(80_000)).toBe("1分20秒");
    expect(formatDuration(120_000)).toBe("2分");
  });

  it("横軸の日付から年を落とす", () => {
    expect(formatDateTick("2026-08-07")).toBe("8/7");
  });

  it("記録の無い画面を0件として必ず残す", () => {
    const measured = [{ routePattern: "/used", label: "使われた画面" }];
    const all = [
      { routePattern: "/used", label: "使われた画面" },
      { routePattern: "/never", label: "誰も開いていない画面" },
    ];
    const filled = fillUnusedScreens(measured, all, (screen) => ({ ...screen }));
    expect(filled.map((r) => r.routePattern)).toEqual(["/used", "/never"]);
  });
});
