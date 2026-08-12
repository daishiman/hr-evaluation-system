import { describe, expect, it } from "vitest";
import {
  buildStalledRows,
  cycleCloseConfirmText,
  CYCLE_CLOSE_CONFIRM_BASE,
  daysSincePeriodEnd,
  groupStalledByCompany,
  LONG_DAYS,
  OVERDUE_DAYS,
  STALLED_KIND_LABEL,
  STALLED_LEVEL_LABEL,
  stalledHeadline,
  stalledHref,
  stalledLevel,
  summarizeStalled,
  unfinalizedNamePreview,
  type StalledRow,
  type StalledSource,
} from "@/lib/domain/stalled-evaluations";

/** 日本時間の指定日時をつくる（Workers は UTC で動くので、境界はここで作り分ける）。 */
function jst(iso: string): Date {
  return new Date(`${iso}+09:00`);
}

function source(over: Partial<StalledSource> = {}): StalledSource {
  return {
    kind: "finalize",
    cycleId: "c1",
    cycleName: "2025年度 下期",
    periodEnd: "2026-03-31",
    evaluationId: "e1",
    employeeId: "u1",
    employeeName: "山田 太郎",
    gradeName: "S2",
    ...over,
  };
}

describe("daysSincePeriodEnd", () => {
  it("終了日の当日は0日", () => {
    expect(daysSincePeriodEnd("2026-03-31", jst("2026-03-31T10:00:00"))).toBe(0);
  });

  it("翌日は1日", () => {
    expect(daysSincePeriodEnd("2026-03-31", jst("2026-04-01T00:30:00"))).toBe(1);
  });

  it("日本時間の朝9時前でも、その日の日付で数える（UTCのままだと1日ずれる）", () => {
    // 2026-04-01 08:00 JST = 2026-03-31 23:00 UTC。UTCで数えると0日になってしまう。
    expect(daysSincePeriodEnd("2026-03-31", jst("2026-04-01T08:00:00"))).toBe(1);
  });

  it("終了日がまだ来ていなければ負の数", () => {
    expect(daysSincePeriodEnd("2026-09-30", jst("2026-08-12T12:00:00"))).toBe(-49);
  });

  it("月をまたいでも日数で数える", () => {
    expect(daysSincePeriodEnd("2026-03-31", jst("2026-05-01T12:00:00"))).toBe(31);
  });

  it("前後の空白は無視する", () => {
    expect(daysSincePeriodEnd("  2026-03-31 ", jst("2026-04-10T12:00:00"))).toBe(10);
  });

  it("日付として読めない値は null", () => {
    expect(daysSincePeriodEnd("2026/03/31", jst("2026-04-01T12:00:00"))).toBeNull();
    expect(daysSincePeriodEnd("", jst("2026-04-01T12:00:00"))).toBeNull();
    expect(daysSincePeriodEnd("令和8年3月31日", jst("2026-04-01T12:00:00"))).toBeNull();
  });

  it("形は合っていても存在しない日付は null", () => {
    expect(daysSincePeriodEnd("2026-13-45", jst("2026-04-01T12:00:00"))).toBeNull();
  });
});

describe("stalledLevel", () => {
  it("14日未満は片付け中", () => {
    expect(stalledLevel(0)).toBe("fresh");
    expect(stalledLevel(OVERDUE_DAYS - 1)).toBe("fresh");
  });

  it("ちょうど14日から対応が必要", () => {
    expect(stalledLevel(OVERDUE_DAYS)).toBe("overdue");
    expect(stalledLevel(LONG_DAYS - 1)).toBe("overdue");
  });

  it("ちょうど30日から長期間そのまま", () => {
    expect(stalledLevel(LONG_DAYS)).toBe("long");
    expect(stalledLevel(400)).toBe("long");
  });

  it("呼び名はすべての度合いに用意されている", () => {
    expect(STALLED_LEVEL_LABEL.fresh).toBe("片付け中");
    expect(STALLED_LEVEL_LABEL.overdue).toBe("対応が必要");
    expect(STALLED_LEVEL_LABEL.long).toBe("長期間そのまま");
    expect(STALLED_KIND_LABEL.finalize).toBe("確定待ち");
    expect(STALLED_KIND_LABEL.build).toBe("集計待ち");
  });
});

describe("buildStalledRows", () => {
  const now = jst("2026-08-12T12:00:00");

  it("経過日数と度合いを付ける", () => {
    const rows = buildStalledRows([source({ periodEnd: "2026-03-31" })], now);
    expect(rows).toHaveLength(1);
    expect(rows[0].days).toBe(134);
    expect(rows[0].level).toBe("long");
    expect(rows[0].employeeName).toBe("山田 太郎");
  });

  it("締め切り日がまだ来ていない期間は落とす（締切前に締め切り操作をした期間があるため）", () => {
    const rows = buildStalledRows([source({ periodEnd: "2026-09-30" })], now);
    expect(rows).toEqual([]);
  });

  it("読めない終了日は落とす", () => {
    const rows = buildStalledRows([source({ periodEnd: "不明" })], now);
    expect(rows).toEqual([]);
  });

  it("放置の長い順に並べる", () => {
    const rows = buildStalledRows(
      [
        source({ employeeId: "u1", periodEnd: "2026-03-31" }),
        source({ employeeId: "u2", cycleId: "c0", periodEnd: "2025-09-30" }),
        source({ employeeId: "u3", cycleId: "c2", periodEnd: "2026-07-31" }),
      ],
      now,
    );
    expect(rows.map((r) => r.employeeId)).toEqual(["u2", "u1", "u3"]);
  });

  it("同じ日数なら確定待ちを先に出す（あと一歩で終わるため）", () => {
    const rows = buildStalledRows(
      [
        source({ kind: "build", employeeId: "u2", evaluationId: null, employeeName: "あべ" }),
        source({ kind: "finalize", employeeId: "u1", employeeName: "わたなべ" }),
      ],
      now,
    );
    expect(rows.map((r) => r.kind)).toEqual(["finalize", "build"]);
  });

  it("日数も種類も同じなら氏名順で、見るたびに並びが変わらない", () => {
    const rows = buildStalledRows(
      [
        source({ employeeId: "u2", employeeName: "わたなべ" }),
        source({ employeeId: "u1", employeeName: "あべ" }),
      ],
      now,
    );
    expect(rows.map((r) => r.employeeId)).toEqual(["u1", "u2"]);
  });

  it("氏名が未設定でも落ちない", () => {
    const rows = buildStalledRows(
      [
        source({ employeeId: "u2", employeeName: null }),
        source({ employeeId: "u1", employeeName: null }),
      ],
      now,
    );
    expect(rows).toHaveLength(2);
  });

  it("1件も無ければ空", () => {
    expect(buildStalledRows([], now)).toEqual([]);
  });

  it("同じ人・同じ期は1行にまとめる（アンケートの版が上がると回答が2件見つかるため）", () => {
    const rows = buildStalledRows(
      [
        source({ kind: "build", evaluationId: null, employeeId: "u1", cycleId: "c1" }),
        source({ kind: "build", evaluationId: null, employeeId: "u1", cycleId: "c1" }),
      ],
      now,
    );
    expect(rows).toHaveLength(1);
  });

  it("同じ人でも、期が違えば別の行として出す", () => {
    const rows = buildStalledRows(
      [
        source({ employeeId: "u1", cycleId: "c1", periodEnd: "2026-03-31" }),
        source({ employeeId: "u1", cycleId: "c2", periodEnd: "2025-09-30" }),
      ],
      now,
    );
    expect(rows).toHaveLength(2);
  });

  it("同じ人・同じ期でも、確定待ちと集計待ちは別の行（起きている事情が違う）", () => {
    const rows = buildStalledRows(
      [
        source({ kind: "finalize", employeeId: "u1", cycleId: "c1" }),
        source({ kind: "build", evaluationId: null, employeeId: "u1", cycleId: "c1" }),
      ],
      now,
    );
    expect(rows).toHaveLength(2);
  });
});

describe("summarizeStalled", () => {
  const now = jst("2026-08-12T12:00:00");

  it("0件のまとめ", () => {
    const s = summarizeStalled([]);
    expect(s).toEqual({ total: 0, finalize: 0, build: 0, overdue: 0, long: 0, worstDays: null, cycles: 0 });
  });

  it("種類・度合い・期間の数を数える", () => {
    const rows = buildStalledRows(
      [
        source({ employeeId: "u1", periodEnd: "2026-03-31" }), // 134日 long / finalize
        source({ employeeId: "u2", kind: "build", evaluationId: null, periodEnd: "2026-03-31" }), // long / build
        source({ employeeId: "u3", cycleId: "c2", periodEnd: "2026-07-25" }), // 18日 overdue
        source({ employeeId: "u4", cycleId: "c3", periodEnd: "2026-08-10" }), // 2日 fresh
      ],
      now,
    );
    const s = summarizeStalled(rows);
    expect(s.total).toBe(4);
    expect(s.finalize).toBe(3);
    expect(s.build).toBe(1);
    expect(s.overdue).toBe(3); // long も含む
    expect(s.long).toBe(2);
    expect(s.worstDays).toBe(134);
    expect(s.cycles).toBe(3);
  });

  it("いちばん長い日数は、並び順に関係なく最大値を返す", () => {
    const rows: StalledRow[] = [
      { ...source({ employeeId: "u1" }), days: 3, level: "fresh" },
      { ...source({ employeeId: "u2" }), days: 90, level: "long" },
    ];
    expect(summarizeStalled(rows).worstDays).toBe(90);
  });
});

describe("stalledHeadline", () => {
  it("0件なら、無いことをそのまま伝える", () => {
    expect(stalledHeadline(summarizeStalled([]))).toBe("締め切った期間に、確定されていない評価はありません");
  });

  it("件数だけでなく、いちばん長い日数も必ず出す", () => {
    const rows = buildStalledRows(
      [source({ employeeId: "u1", periodEnd: "2026-03-31" })],
      jst("2026-08-12T12:00:00"),
    );
    expect(stalledHeadline(summarizeStalled(rows))).toBe(
      "締め切った期間に、確定されていない評価が1件あります（いちばん長いもので134日）",
    );
  });

  it("日数が取れないまとめでも文が壊れない", () => {
    expect(stalledHeadline({ total: 1, finalize: 1, build: 0, overdue: 0, long: 0, worstDays: null, cycles: 1 })).toBe(
      "締め切った期間に、確定されていない評価が1件あります（いちばん長いもので0日）",
    );
  });
});

describe("stalledHref", () => {
  const now = jst("2026-08-12T12:00:00");

  it("確定待ちは、その評価そのものへ飛ぶ", () => {
    const [row] = buildStalledRows([source({ evaluationId: "ev-9" })], now);
    expect(stalledHref(row)).toBe("/manager/evaluations/ev-9");
  });

  it("集計待ちは、まだ評価が無いのでその期間の一覧へ飛ぶ", () => {
    const [row] = buildStalledRows([source({ kind: "build", evaluationId: null, cycleId: "cy-3" })], now);
    expect(stalledHref(row)).toBe("/manager/cycles?cycle=cy-3");
  });

  it("確定待ちなのに評価IDが無ければ、期間の一覧へ逃がす（行き先の無いリンクを作らない）", () => {
    const [row] = buildStalledRows([source({ kind: "finalize", evaluationId: null, cycleId: "cy-4" })], now);
    expect(stalledHref(row)).toBe("/manager/cycles?cycle=cy-4");
  });
});

describe("groupStalledByCompany", () => {
  const now = jst("2026-08-12T12:00:00");

  function withCompany(src: StalledSource, companyId: string, companyName: string) {
    const [row] = buildStalledRows([src], now);
    return { ...row, companyId, companyName };
  }

  it("会社ごとにまとめ、放置がいちばん長い会社を先に出す", () => {
    const rows = [
      // co-a は「あとから読んだ行のほうが長い」並び。会社の最長日数がそれで更新されること
      withCompany(source({ employeeId: "u1", periodEnd: "2026-08-01" }), "co-a", "さくら福祉会"), // 11日
      withCompany(source({ employeeId: "u4", periodEnd: "2026-06-30" }), "co-a", "さくら福祉会"), // 43日
      // co-b は「先に読んだ行のほうが長い」並び
      withCompany(source({ employeeId: "u2", periodEnd: "2026-03-31" }), "co-b", "みらい支援ネット"), // 134日
      withCompany(source({ employeeId: "u3", periodEnd: "2026-07-01" }), "co-b", "みらい支援ネット"), // 42日
    ];
    const grouped = groupStalledByCompany(rows);
    expect(grouped.map((g) => g.companyId)).toEqual(["co-b", "co-a"]);
    expect(grouped[0].summary.total).toBe(2);
    expect(grouped[0].summary.worstDays).toBe(134);
    expect(grouped[1].companyName).toBe("さくら福祉会");
    expect(grouped[1].summary.total).toBe(2);
    expect(grouped[1].summary.worstDays).toBe(43);
  });

  it("1件も無ければ空（放置0件の会社は並べない）", () => {
    expect(groupStalledByCompany([])).toEqual([]);
  });
});

describe("unfinalizedNamePreview", () => {
  it("3人までは全員の名前を並べる", () => {
    expect(unfinalizedNamePreview(["佐藤 花子", "鈴木 一郎"])).toBe("佐藤 花子、鈴木 一郎");
  });

  it("4人以上は3人まで出して、残りは人数で言う", () => {
    expect(unfinalizedNamePreview(["あ", "い", "う", "え", "お"])).toBe("あ、い、う ほか2名");
  });

  it("名前が未登録でも空欄にせず、そう書く", () => {
    expect(unfinalizedNamePreview([null, "  ", "鈴木 一郎"])).toBe("名前未設定、名前未設定、鈴木 一郎");
  });

  it("前後の空白は落とす", () => {
    expect(unfinalizedNamePreview([" 佐藤 花子 "])).toBe("佐藤 花子");
  });

  it("1人も居なければ空文字", () => {
    expect(unfinalizedNamePreview([])).toBe("");
  });
});

describe("cycleCloseConfirmText", () => {
  it("0件のときは、これまでどおりの確認文だけ（余計な手間を増やさない）", () => {
    expect(cycleCloseConfirmText([])).toBe(CYCLE_CLOSE_CONFIRM_BASE);
  });

  it("残っているときは、件数と誰かを出したうえで、これまでの確認文につなげる", () => {
    const text = cycleCloseConfirmText(["佐藤 花子", "鈴木 一郎"]);
    expect(text).toContain("まだ確定していない評価が2件あります");
    expect(text).toContain("佐藤 花子、鈴木 一郎");
    expect(text).toContain(CYCLE_CLOSE_CONFIRM_BASE);
  });

  it("締め切れないとは書かない（締め切り自体は止めない）", () => {
    const text = cycleCloseConfirmText(["佐藤 花子"]);
    expect(text).toContain("締め切っても消えません");
    expect(text).not.toContain("締め切れません");
  });
});
