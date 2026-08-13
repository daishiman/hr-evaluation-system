import { describe, expect, it } from "vitest";
import { daysUntilDeadline, formatJpDate, judgeFormDeadline, jstDateString } from "./form-deadline";

/**
 * 締切の判定は「1日ずれる」種類の不具合が起きやすく、しかも
 * 起きたときには回答者が締め出されている（＝取り返しがつかない）。
 * 境界（開始日当日・締切日当日・翌日）と時間帯（UTCで動くWorkers）を固定しておく。
 */

const jst = (iso: string) => new Date(iso); // 例: "2026-09-30T14:59:00Z" は日本時間 9/30 23:59

describe("jstDateString", () => {
  it("UTCの夜は日本時間では翌日になる", () => {
    // Workers は UTC で動くため、ここを取り違えると締切日が1日ずれる
    expect(jstDateString(jst("2026-09-30T15:00:00Z"))).toBe("2026-10-01");
    expect(jstDateString(jst("2026-09-30T14:59:59Z"))).toBe("2026-09-30");
  });

  it("UTCの午前0時直後は日本時間では同じ日の午前9時", () => {
    expect(jstDateString(jst("2026-04-01T00:00:00Z"))).toBe("2026-04-01");
  });
});

describe("judgeFormDeadline 回答期間の境界", () => {
  const base = { cycleStatus: "open", status: "published", opensAt: "2026-04-01", closesAt: "2026-09-30" };

  it("開始日の当日から回答できる（日本時間の0時）", () => {
    // 日本時間 4/1 00:00 = UTC 3/31 15:00
    const r = judgeFormDeadline({ ...base, now: jst("2026-03-31T15:00:00Z") });
    expect(r.canAnswer).toBe(true);
    expect(r.state).toBe("open");
  });

  it("開始日の前日は回答できず、いつから回答できるかを伝える", () => {
    const r = judgeFormDeadline({ ...base, now: jst("2026-03-31T14:59:00Z") });
    expect(r.canAnswer).toBe(false);
    expect(r.state).toBe("before_open");
    expect(r.message).toContain("2026年4月1日");
  });

  it("締切日の当日はまだ回答できる（その日いっぱい有効）", () => {
    // 日本時間 9/30 23:59 = UTC 9/30 14:59
    const r = judgeFormDeadline({ ...base, now: jst("2026-09-30T14:59:00Z") });
    expect(r.canAnswer).toBe(true);
    expect(r.state).toBe("open");
  });

  it("締切日の翌日になったら回答できない", () => {
    // 日本時間 10/1 00:00 = UTC 9/30 15:00
    const r = judgeFormDeadline({ ...base, now: jst("2026-09-30T15:00:00Z") });
    expect(r.canAnswer).toBe(false);
    expect(r.state).toBe("past_deadline");
    expect(r.message).toContain("2026年9月30日");
    expect(r.message).toContain("ご連絡");
  });

  it("期限が決まっていなければ、いつでも回答できる", () => {
    const r = judgeFormDeadline({ cycleStatus: "open", status: "published", opensAt: null, closesAt: null, now: jst("2030-01-01T00:00:00Z") });
    expect(r.canAnswer).toBe(true);
    expect(r.effectiveUntil).toBeNull();
  });
});

describe("judgeFormDeadline アンケートの状態", () => {
  it("評価期間が準備中なら、公開済みアンケートでも回答できない", () => {
    const r = judgeFormDeadline({
      cycleStatus: "planning",
      status: "published",
      opensAt: null,
      closesAt: null,
      now: jst("2026-05-01T00:00:00Z"),
    });
    expect(r.canAnswer).toBe(false);
    expect(r.state).toBe("cycle_not_open");
    expect(r.message).toContain("評価期間");
    expect(r.message).toContain("準備中");
  });

  it("評価期間が終了済みなら、個別延長があっても回答できない", () => {
    const r = judgeFormDeadline({
      cycleStatus: "closed",
      status: "published",
      opensAt: null,
      closesAt: "2026-09-30",
      extensions: ["2026-12-31"],
      now: jst("2026-10-01T00:00:00Z"),
    });
    expect(r.canAnswer).toBe(false);
    expect(r.state).toBe("cycle_not_open");
    expect(r.message).toContain("終了");
  });

  it("下書きのアンケートは回答できない", () => {
    const r = judgeFormDeadline({ cycleStatus: "open", status: "draft", opensAt: null, closesAt: null, now: jst("2026-05-01T00:00:00Z") });
    expect(r.canAnswer).toBe(false);
    expect(r.state).toBe("not_published");
  });

  it("締め切り済みのアンケートは、期間内でも回答できない", () => {
    const r = judgeFormDeadline({
      cycleStatus: "open",
      status: "closed",
      opensAt: "2026-04-01",
      closesAt: "2026-09-30",
      now: jst("2026-05-01T00:00:00Z"),
    });
    expect(r.canAnswer).toBe(false);
    expect(r.state).toBe("closed_by_admin");
    expect(r.message).toContain("提出済みの回答はそのまま残っています");
  });
});

describe("judgeFormDeadline 個別の延長", () => {
  const base = { cycleStatus: "open", status: "published", opensAt: "2026-04-01", closesAt: "2026-09-30" };

  it("延長されていれば締切後も回答できる", () => {
    const r = judgeFormDeadline({ ...base, extensions: ["2026-10-15"], now: jst("2026-10-05T00:00:00Z") });
    expect(r.canAnswer).toBe(true);
    expect(r.state).toBe("extended");
    expect(r.effectiveUntil).toBe("2026-10-15");
    expect(r.message).toContain("2026年10月15日");
  });

  it("延長の当日はまだ回答でき、翌日には締まる", () => {
    const ext = { ...base, extensions: ["2026-10-15"] };
    // 日本時間 10/15 23:59
    expect(judgeFormDeadline({ ...ext, now: jst("2026-10-15T14:59:00Z") }).canAnswer).toBe(true);
    // 日本時間 10/16 00:00
    expect(judgeFormDeadline({ ...ext, now: jst("2026-10-15T15:00:00Z") }).canAnswer).toBe(false);
  });

  it("延長が複数あれば一番遅い日が効く", () => {
    const r = judgeFormDeadline({ ...base, extensions: ["2026-10-05", "2026-10-20", null], now: jst("2026-10-10T00:00:00Z") });
    expect(r.effectiveUntil).toBe("2026-10-20");
    expect(r.canAnswer).toBe(true);
  });

  it("全体の期限より前の延長日を渡されても、期限は縮まない", () => {
    const r = judgeFormDeadline({ ...base, extensions: ["2026-08-01"], now: jst("2026-09-10T00:00:00Z") });
    expect(r.effectiveUntil).toBe("2026-09-30");
    expect(r.canAnswer).toBe(true);
    expect(r.extended).toBe(false);
  });

  it("延長は開始前のアンケートを前倒ししない", () => {
    const r = judgeFormDeadline({ ...base, extensions: ["2026-12-31"], now: jst("2026-01-01T00:00:00Z") });
    expect(r.canAnswer).toBe(false);
    expect(r.state).toBe("before_open");
  });

  it("締め切り済み（管理者が締めた）アンケートは延長があっても開かない", () => {
    // 延長は「回答期間」を延ばすもので、締め切りの取り消しではない。
    // 締め直しは管理画面の操作なので、ここで自動的に開けてはいけない。
    const r = judgeFormDeadline({ ...base, status: "closed", extensions: ["2026-12-31"], now: jst("2026-11-01T00:00:00Z") });
    expect(r.canAnswer).toBe(false);
    expect(r.state).toBe("closed_by_admin");
  });
});

describe("daysUntilDeadline", () => {
  it("締切当日は0日", () => {
    expect(daysUntilDeadline("2026-09-30", jst("2026-09-30T00:00:00Z"))).toBe(0);
  });
  it("残り日数を日本時間で数える", () => {
    expect(daysUntilDeadline("2026-10-03", jst("2026-09-30T00:00:00Z"))).toBe(3);
  });
  it("期限切れ・期限なしは null", () => {
    expect(daysUntilDeadline("2026-09-30", jst("2026-10-01T00:00:00Z"))).toBeNull();
    expect(daysUntilDeadline(null, jst("2026-10-01T00:00:00Z"))).toBeNull();
  });
});

describe("formatJpDate", () => {
  it("日付を日本語にする", () => {
    expect(formatJpDate("2026-09-05")).toBe("2026年9月5日");
  });
  it("空や読めない値でも落ちない", () => {
    expect(formatJpDate(null)).toBe("");
    expect(formatJpDate("いつか")).toBe("いつか");
  });
});
