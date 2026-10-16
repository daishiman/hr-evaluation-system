import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { daysUntilDeadline, formatJpDate, judgeFormDeadline } from "./form-deadline";

/**
 * 締切の判定は「1日ずれる」種類の不具合が起きやすく、しかも
 * 起きたときには回答者が締め出されている（＝取り返しがつかない）。
 * 境界（開始日当日・締切日当日・翌日）と時間帯（UTCで動くWorkers）を固定しておく。
 */

const jst = (iso: string) => new Date(iso); // 例: "2026-09-30T14:59:00Z" は日本時間 9/30 23:59

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

  it("締め切り済みの文は、効かない延長を約束しない（連絡先は残す）", () => {
    // 上のとおり延長しても開かないのに「期限を延ばすことができます」と書くと、頼んだ人が行き止まりになる
    const r = judgeFormDeadline({ ...base, status: "closed", now: jst("2026-11-01T00:00:00Z") });
    expect(r.state).toBe("closed_by_admin");
    expect(r.message).not.toContain("延ば");
    expect(r.message).toContain("ご連絡");
  });

  it("延長を案内するのは期限切れの文だけで、1回だけ書く", () => {
    const now = jst("2026-11-01T00:00:00Z");
    const past = judgeFormDeadline({ ...base, now });
    expect(past.state).toBe("past_deadline");
    expect(past.message.match(/期限を延ばすことができます/g)).toHaveLength(1);

    // 延長が効かない状態（締め切り済み・評価期間が開いていない・開始前・下書き）は延長に触れない
    const others = [
      judgeFormDeadline({ ...base, status: "closed", now }),
      judgeFormDeadline({ ...base, cycleStatus: "closed", now }),
      judgeFormDeadline({ ...base, cycleStatus: "planning", now }),
      judgeFormDeadline({ ...base, now: jst("2026-01-01T00:00:00Z") }),
      judgeFormDeadline({ ...base, status: "draft", now }),
    ];
    expect(others.map((r) => r.state)).toEqual([
      "closed_by_admin",
      "cycle_not_open",
      "cycle_not_open",
      "before_open",
      "not_published",
    ]);
    for (const r of others) expect(r.message).not.toContain("延ば");
  });
});

describe("judgeFormDeadline どの画面に出しても正しい文", () => {
  /* message は回答画面（/me/forms/[id]）だけでなく、読むだけの見本（/forms/[id]）・
     管理画面の回答一覧（「いまの状態：」）・配るURL（/f/[token]）にもそのまま出る。
     message に「この画面から入力してください」と書くと、回答できない画面で「ここから回答できる」と言うことになる。
     画面の操作の案内は answerHint に分け、回答画面だけが添える。 */
  const base = { cycleStatus: "open", status: "published", opensAt: "2026-04-01", closesAt: "2026-09-30" };
  const may = jst("2026-05-01T00:00:00Z");
  const draft = judgeFormDeadline({ ...base, status: "draft", now: may });
  const closedByAdmin = judgeFormDeadline({ ...base, status: "closed", now: may });
  const cyclePlanning = judgeFormDeadline({ ...base, cycleStatus: "planning", now: may });
  const cycleEnded = judgeFormDeadline({ ...base, cycleStatus: "closed", now: may });
  const beforeOpen = judgeFormDeadline({ ...base, now: jst("2026-03-01T00:00:00Z") });
  const open = judgeFormDeadline({ ...base, now: may });
  // 締切の当日（日本時間 9/30 23:59）。締切間近の文
  const lastDay = judgeFormDeadline({ ...base, now: jst("2026-09-30T14:59:00Z") });
  const noDeadline = judgeFormDeadline({ ...base, opensAt: null, closesAt: null, now: may });
  const extended = judgeFormDeadline({ ...base, extensions: ["2026-10-15"], now: jst("2026-10-05T00:00:00Z") });
  const past = judgeFormDeadline({ ...base, now: jst("2026-11-01T00:00:00Z") });
  const all = [draft, closedByAdmin, cyclePlanning, cycleEnded, beforeOpen, open, lastDay, noDeadline, extended, past];

  it("すべての状態を通っている（状態を足したら、ここにも足す）", () => {
    expect(new Set(all.map((r) => r.state))).toEqual(
      new Set(["not_published", "closed_by_admin", "cycle_not_open", "before_open", "open", "extended", "past_deadline"]),
    );
  });

  it("message は、どの状態でも画面の操作（この画面から・入力してください）を言わない", () => {
    for (const r of all) expect(r.message, r.state).not.toMatch(/この画面|入力してください/);
  });

  it("回答画面の操作の案内は answerHint に分け、これから受付が始まる状態にだけ持たせる", () => {
    expect(beforeOpen.answerHint).toBe("その日になったら、この画面から入力してください。");
    expect(cyclePlanning.answerHint).toBe("受付が始まると、この画面から回答できます。");
    expect(draft.answerHint).toBe("公開されると、この画面から回答できます。");
    for (const r of [closedByAdmin, cycleEnded, open, lastDay, noDeadline, extended, past]) {
      expect(r.answerHint, r.state).toBeNull();
    }
  });

  it("回答画面で message と answerHint を続けて出すと、分ける前と同じ案内になる（回答画面の文を落とさない）", () => {
    expect(`${beforeOpen.message}${beforeOpen.answerHint}`).toBe(
      "このアンケートは2026年4月1日から回答できます。その日になったら、この画面から入力してください。",
    );
    expect(`${cyclePlanning.message}${cyclePlanning.answerHint}`).toBe(
      "この評価期間はまだ準備中です。受付が始まると、この画面から回答できます。",
    );
  });

  it("回答画面の案内（answerHint）は、読むだけの画面・管理画面の回答一覧・配るURLでは添えない", () => {
    for (const rel of ["src/app/forms/[id]/page.tsx", "src/app/admin/forms/[id]/responses/page.tsx", "src/app/f/[token]/page.tsx"]) {
      expect(readFileSync(join(process.cwd(), rel), "utf8"), rel).not.toContain("answerHint");
    }
  });

  describe("配るURL（/f/[token]）の案内で、同じ事実を2回言わない", () => {
    const page = readFileSync(join(process.cwd(), "src/app/f/[token]/page.tsx"), "utf8");
    const LIST_NOTE = "受付が始まると「実績を報告する」の一覧にも並びます。";

    it("ページは message に一覧の1文だけを添え、開始日や準備中であることを言い直さない", () => {
      expect(page).toContain(LIST_NOTE);
      // 開始日は message が1回だけ言う。ページで日付を組み立てて重ねない
      expect(page).not.toMatch(/formatJpDate\(/);
      // 準備中であることも message が言う
      expect(page).not.toContain("公開の準備をしています");
    });

    it("これから受付が始まる状態の message は、添える1文と言い回しが重ならない（事実は落とさない）", () => {
      for (const r of [draft, cyclePlanning, beforeOpen]) {
        const shown = `${r.message}${LIST_NOTE}`;
        expect(shown.match(/受付が始まると/g), r.state).toHaveLength(1);
      }
      expect(`${beforeOpen.message}${LIST_NOTE}`.match(/2026年4月1日/g)).toHaveLength(1);
      expect(draft.message).toContain("準備中");
      expect(cyclePlanning.message).toContain("準備中");
    });
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
