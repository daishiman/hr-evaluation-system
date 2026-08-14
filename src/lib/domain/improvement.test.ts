import { describe, expect, it } from "vitest";
import {
  IMPROVEMENT_BODY_MAX,
  IMPROVEMENT_PERIODS,
  IMPROVEMENT_SHOT_MAX_BYTES,
  IMPROVEMENT_STATUSES,
  canChangeImprovementStatus,
  canHandleImprovements,
  canReadImprovements,
  countImprovementsByStatus,
  filterImprovements,
  groupImprovementsByScreen,
  improvementPeriodStart,
  improvementStatusLabel,
  improvementStatusTone,
  isAcceptableShot,
  isImprovementPeriod,
  isImprovementStatus,
  normalizeImprovementBody,
  shotBytesOf,
  type ImprovementRow,
} from "@/lib/domain/improvement";

const row = (over: Partial<ImprovementRow> & { id: string }): ImprovementRow => ({
  status: "open",
  path: "/admin",
  screenLabel: "ホーム",
  createdAt: new Date("2026-08-01T00:00:00Z"),
  ...over,
});

describe("状態の呼び名と色", () => {
  it("4つの状態それぞれに日本語の呼び名がある", () => {
    expect(IMPROVEMENT_STATUSES.map(improvementStatusLabel)).toEqual(["未対応", "対応中", "対応済み", "見送り"]);
  });

  it("状態ごとに色の意味が決まっている", () => {
    expect(IMPROVEMENT_STATUSES.map(improvementStatusTone)).toEqual(["required", "active", "done", "dropped"]);
  });

  it("知らない値は状態として扱わない", () => {
    expect(isImprovementStatus("open")).toBe(true);
    expect(isImprovementStatus("closed")).toBe(false);
  });
});

describe("状態の付け替え", () => {
  it("閉じたあとでも開き直せる（取り違えて閉じたときに戻せる）", () => {
    expect(canChangeImprovementStatus("done", "open")).toBe(true);
    expect(canChangeImprovementStatus("dropped", "doing")).toBe(true);
  });

  it("同じ状態への付け替えは受け付けない", () => {
    expect(canChangeImprovementStatus("open", "open")).toBe(false);
  });
});

describe("誰が読めるか", () => {
  it("会社の管理者とシステム全体管理者だけが読める", () => {
    expect(canReadImprovements("SUPER_ADMIN")).toBe(true);
    expect(canReadImprovements("COMPANY_ADMIN")).toBe(true);
    expect(canReadImprovements("MANAGER")).toBe(false);
    expect(canReadImprovements("EMPLOYEE")).toBe(false);
  });

  it("状態を変えられる範囲は、読める範囲と同じ", () => {
    expect(canHandleImprovements("COMPANY_ADMIN")).toBe(true);
    expect(canHandleImprovements("MANAGER")).toBe(false);
  });
});

describe("画像の受け取り", () => {
  it("data URL の文字数から元の大きさを見積もる", () => {
    expect(shotBytesOf("data:image/png;base64,AAAA")).toBe(3);
    expect(shotBytesOf("data:image/png;base64,AAA=")).toBe(2);
    expect(shotBytesOf("data:image/png;base64,AA==")).toBe(1);
  });

  it("data URL の形をしていないものは0とみなす", () => {
    expect(shotBytesOf("AAAA")).toBe(0);
  });

  it("画像の形式が違うものは受け取らない", () => {
    expect(isAcceptableShot("data:text/html;base64,AAAA")).toBe(false);
    expect(isAcceptableShot("https://example.com/a.png")).toBe(false);
  });

  it("上限までの画像は受け取り、超えたものは断る", () => {
    const chars = Math.ceil((IMPROVEMENT_SHOT_MAX_BYTES / 3) * 4);
    expect(isAcceptableShot("data:image/jpeg;base64,AAAA")).toBe(true);
    expect(isAcceptableShot(`data:image/jpeg;base64,${"A".repeat(chars + 8)}`)).toBe(false);
  });
});

describe("本文の整え方", () => {
  it("前後の空白と改行コードの違いを吸収する", () => {
    expect(normalizeImprovementBody("  文字が小さい\r\nです  ")).toBe("文字が小さい\nです");
  });

  it("長すぎる本文は上限で切る", () => {
    expect(normalizeImprovementBody("あ".repeat(IMPROVEMENT_BODY_MAX + 50))).toHaveLength(IMPROVEMENT_BODY_MAX);
  });
});

describe("一覧の絞り込み", () => {
  const rows = [
    row({ id: "a", status: "open", path: "/admin", createdAt: new Date("2026-08-10T00:00:00Z") }),
    row({ id: "b", status: "done", path: "/admin/members", createdAt: new Date("2026-08-01T00:00:00Z") }),
    row({ id: "c", status: "open", path: "/admin/members", createdAt: new Date("2026-08-12T00:00:00Z") }),
  ];

  it("条件を指定しなければ、すべてそのまま返す", () => {
    expect(filterImprovements(rows, {}).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("状態で絞り込む", () => {
    expect(filterImprovements(rows, { status: "open" }).map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("画面で絞り込む", () => {
    expect(filterImprovements(rows, { path: "/admin/members" }).map((r) => r.id)).toEqual(["b", "c"]);
  });

  it("届いた日で絞り込む", () => {
    const since = new Date("2026-08-05T00:00:00Z");
    expect(filterImprovements(rows, { since }).map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("条件を重ねると、すべて満たすものだけが残る", () => {
    const since = new Date("2026-08-05T00:00:00Z");
    expect(filterImprovements(rows, { status: "open", path: "/admin/members", since }).map((r) => r.id)).toEqual(["c"]);
  });
});

describe("件数のまとめ", () => {
  it("1件も無い状態も0件として並べる", () => {
    const counts = countImprovementsByStatus([row({ id: "a" }), row({ id: "b", status: "done" })]);
    expect(counts).toEqual({ open: 1, doing: 0, done: 1, dropped: 0 });
  });

  it("画面ごとに数え、多い順に並べる", () => {
    const rows = [
      row({ id: "a", path: "/admin/members", screenLabel: "社員" }),
      row({ id: "b", path: "/admin", screenLabel: "ホーム" }),
      row({ id: "c", path: "/admin/members", screenLabel: "社員" }),
    ];
    expect(groupImprovementsByScreen(rows)).toEqual([
      { path: "/admin/members", screenLabel: "社員", count: 2 },
      { path: "/admin", screenLabel: "ホーム", count: 1 },
    ]);
  });

  it("同じ件数なら画面名の順に並べる（並びが日によって入れ替わらない）", () => {
    const rows = [
      row({ id: "a", path: "/admin/raises", screenLabel: "昇給の設定" }),
      row({ id: "b", path: "/admin/cycles", screenLabel: "評価期間" }),
    ];
    expect(groupImprovementsByScreen(rows).map((g) => g.path)).toEqual(["/admin/raises", "/admin/cycles"]);
  });
});

describe("期間の選択", () => {
  const now = new Date("2026-08-14T00:00:00Z");

  it("直近7日・30日は起点の日時を出す", () => {
    expect(improvementPeriodStart("7d", now)?.toISOString()).toBe("2026-08-07T00:00:00.000Z");
    expect(improvementPeriodStart("30d", now)?.toISOString()).toBe("2026-07-15T00:00:00.000Z");
  });

  it("すべてを選んだときは起点を作らない", () => {
    expect(improvementPeriodStart("all", now)).toBeNull();
  });

  it("知らない値は期間として扱わない", () => {
    expect(IMPROVEMENT_PERIODS.every(isImprovementPeriod)).toBe(true);
    expect(isImprovementPeriod("90d")).toBe(false);
  });
});
