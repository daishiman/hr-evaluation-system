import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { answerBlockLabel, answerLockedReason, canAnswerForm, judgeAnswerBlock, judgeFormEntry, type AnswerBlock } from "./form-entry";
import { judgeFormDeadline, type DeadlineState } from "./form-deadline";

describe("canAnswerForm", () => {
  it("自分の等級のアンケートには回答できる", () => {
    expect(canAnswerForm("grd_b", "grd_b")).toBe(true);
  });

  it("別の等級のアンケートには回答できない", () => {
    expect(canAnswerForm("grd_b", "grd_c")).toBe(false);
  });

  it("等級が割り当てられていない人（管理者など）は回答できない", () => {
    expect(canAnswerForm(null, "grd_b")).toBe(false);
  });

  it("どちらも等級なしでも、一致とはみなさない", () => {
    expect(canAnswerForm(null, null)).toBe(false);
  });
});

describe("judgeFormEntry", () => {
  it("自分の等級のアンケートは回答画面へ", () => {
    expect(judgeFormEntry({ viewerGradeId: "grd_b", formGradeId: "grd_b", hasResponse: false })).toBe("answer");
  });

  it("別の等級のアンケートは、閉ざさずに中身の確認画面へ", () => {
    expect(judgeFormEntry({ viewerGradeId: "grd_b", formGradeId: "grd_c", hasResponse: false })).toBe("content-only");
  });

  it("等級のない管理者も、中身の確認画面までは通す", () => {
    expect(judgeFormEntry({ viewerGradeId: null, formGradeId: "grd_c", hasResponse: false })).toBe("content-only");
  });

  it("昇格して等級が変わっても、自分が答えたアンケートは回答画面で読み返せる", () => {
    expect(judgeFormEntry({ viewerGradeId: "grd_a", formGradeId: "grd_b", hasResponse: true })).toBe("answer");
  });
});

describe("judgeAnswerBlock 理由の選び方", () => {
  const open = { canAnswer: true, state: "open" } as const;
  const past = { canAnswer: false, state: "past_deadline" } as const;
  const notPublished = { canAnswer: false, state: "not_published" } as const;
  const base = { draft: false, viewerGradeId: "grd_b", formGradeId: "grd_b", deadline: open };

  it("自分の等級で回答期間内なら、回答できる", () => {
    expect(judgeAnswerBlock(base)).toEqual({ kind: "can-answer" });
  });

  it("下書きは、等級や締切より先に下書きを理由にする", () => {
    expect(judgeAnswerBlock({ ...base, draft: true, deadline: notPublished })).toEqual({ kind: "draft" });
    expect(judgeAnswerBlock({ ...base, draft: true, viewerGradeId: null, deadline: notPublished })).toEqual({ kind: "draft" });
    expect(judgeAnswerBlock({ ...base, draft: true, viewerGradeId: "grd_c", deadline: notPublished })).toEqual({ kind: "draft" });
  });

  it("等級の無い人には、締切を過ぎていても締切ではなく等級なしを理由にする", () => {
    // 締切の文は「管理者にご連絡ください」で終わる。管理者本人に返しても行き止まりになる
    expect(judgeAnswerBlock({ ...base, viewerGradeId: null, deadline: past })).toEqual({ kind: "no-grade" });
  });

  it("等級の無い人には、回答期間内でも等級なしを理由にする（理由が出ないまま終わらない）", () => {
    expect(judgeAnswerBlock({ ...base, viewerGradeId: null, deadline: open })).toEqual({ kind: "no-grade" });
  });

  it("どちらも等級なしでも、回答できるとはみなさない", () => {
    expect(judgeAnswerBlock({ ...base, viewerGradeId: null, formGradeId: null })).toEqual({ kind: "no-grade" });
  });

  it("等級が違う人には、締切を過ぎていても締切より先に等級違いを理由にする", () => {
    expect(judgeAnswerBlock({ ...base, viewerGradeId: "grd_c", deadline: past })).toEqual({ kind: "other-grade" });
    expect(judgeAnswerBlock({ ...base, viewerGradeId: "grd_c", deadline: open })).toEqual({ kind: "other-grade" });
  });

  it("自分の等級でも締切で回答できなければ、締切の状態を持って返す", () => {
    for (const state of ["closed_by_admin", "past_deadline", "before_open", "cycle_not_open"] as const) {
      expect(judgeAnswerBlock({ ...base, deadline: { canAnswer: false, state } })).toEqual({ kind: "deadline", state });
    }
  });

  it("回答できるのは、下書きでなく canAnswerForm と締切の判定がどちらも真のときだけ", () => {
    // 回答の入口（このアンケートに回答する）を出す条件と食い違わないことを、組み合わせ全部で見る
    for (const draft of [false, true]) {
      for (const viewerGradeId of [null, "grd_b", "grd_c"]) {
        for (const formGradeId of [null, "grd_b"]) {
          for (const deadline of [open, past]) {
            const block = judgeAnswerBlock({ draft, viewerGradeId, formGradeId, deadline });
            const expected = !draft && canAnswerForm(viewerGradeId, formGradeId) && deadline.canAnswer;
            expect(block.kind === "can-answer").toBe(expected);
          }
        }
      }
    }
  });

  it("締切の判定の結果をそのまま渡せる（等級の無い管理者が締切後に開いた場合）", () => {
    const judgement = judgeFormDeadline({
      cycleStatus: "open",
      status: "published",
      opensAt: "2026-04-01",
      closesAt: "2026-09-30",
      now: new Date("2026-10-16T00:00:00Z"),
    });
    expect(judgement.state).toBe("past_deadline");
    expect(judgeAnswerBlock({ draft: false, viewerGradeId: null, formGradeId: "grd_b", deadline: judgement })).toEqual({
      kind: "no-grade",
    });
    expect(judgeAnswerBlock({ draft: false, viewerGradeId: "grd_b", formGradeId: "grd_b", deadline: judgement })).toEqual({
      kind: "deadline",
      state: "past_deadline",
    });
  });
});

describe("answerBlockLabel 見本に添える短い理由", () => {
  it("理由の種類ごとに、短い理由を返す", () => {
    const cases: [AnswerBlock, string][] = [
      [{ kind: "can-answer" }, "回答は「このアンケートに回答する」から"],
      [{ kind: "draft" }, "まだ配っていない下書きのため"],
      [{ kind: "no-grade" }, "等級が設定されていないため"],
      [{ kind: "other-grade" }, "対象の等級が違うため"],
    ];
    for (const [block, label] of cases) expect(answerBlockLabel(block)).toBe(label);
  });

  it("締切は状態ごとに理由を分ける", () => {
    const cases: [DeadlineState, string][] = [
      ["closed_by_admin", "締め切られたため"],
      ["past_deadline", "回答期限を過ぎたため"],
      ["before_open", "受付の開始前のため"],
      ["cycle_not_open", "評価期間が開いていないため"],
    ];
    for (const [state, label] of cases) expect(answerBlockLabel({ kind: "deadline", state })).toBe(label);
  });

  it("回答できない締切の状態でないものが来ても、当てはまらない理由を言い切らない", () => {
    const specific = ["締め切られた", "期限を過ぎた", "開始前", "評価期間"];
    for (const state of ["open", "extended", "not_published"] as const) {
      const label = answerBlockLabel({ kind: "deadline", state });
      expect(label).toBe("いまは回答を受け付けていないため");
      for (const word of specific) expect(label).not.toContain(word);
    }
  });
});

describe("answerLockedReason 回答画面で入力欄を止めるときの文", () => {
  const judge = (opensAt: string) =>
    judgeFormDeadline({ cycleStatus: "open", status: "published", opensAt, closesAt: "2026-12-31", now: new Date("2026-10-16T00:00:00Z") });
  const open = judge("2026-04-01");
  const kept = "入力した内容は消えずに残っています。";

  it("回答できるときは止めない", () => {
    const block = judgeAnswerBlock({ draft: false, viewerGradeId: "grd_b", formGradeId: "grd_b", deadline: open });
    expect(answerLockedReason({ block, deadline: open, hasResponse: true })).toBeNull();
  });

  it("等級が変わった人の下書きは、受付中でも止める（保存APIが等級違いを断るので、開いたままだと保存が毎回断られる）", () => {
    expect(open.canAnswer).toBe(true);
    const block = judgeAnswerBlock({ draft: false, viewerGradeId: "grd_new", formGradeId: "grd_old", deadline: open });
    const reason = answerLockedReason({ block, deadline: open, hasResponse: true });
    expect(reason).toContain("等級");
    expect(reason).toContain(kept);
    // 締切の文（受付中の文）を混ぜない。止めた理由は等級の1つだけ
    expect(reason).not.toContain(open.message);
  });

  it("等級の無い人も止め、等級の設定を頼む先を言う", () => {
    const block = judgeAnswerBlock({ draft: false, viewerGradeId: null, formGradeId: "grd_b", deadline: open });
    const reason = answerLockedReason({ block, deadline: open, hasResponse: false });
    expect(reason).toContain("等級が設定されていない");
    expect(reason).toContain("管理者");
    expect(reason).not.toContain(kept);
  });

  it("締切で止めるときは、締切の文に回答画面だけの案内を続け、下書きがあれば残っていることを言う", () => {
    const before = judge("2026-11-01");
    expect(before.state).toBe("before_open");
    const block = judgeAnswerBlock({ draft: false, viewerGradeId: "grd_b", formGradeId: "grd_b", deadline: before });
    expect(answerLockedReason({ block, deadline: before, hasResponse: true })).toBe(`${before.message}${before.answerHint}${kept}`);
    expect(answerLockedReason({ block, deadline: before, hasResponse: false })).toBe(`${before.message}${before.answerHint}`);
  });

  it("下書きのアンケートで止めるときも、締切の文（message）に回答画面だけの案内を続ける（準備中の文を2か所に持たない）", () => {
    const unpublished = judgeFormDeadline({ cycleStatus: "open", status: "draft", opensAt: "2026-04-01", closesAt: "2026-12-31", now: new Date("2026-10-16T00:00:00Z") });
    expect(unpublished.state).toBe("not_published");
    const block = judgeAnswerBlock({ draft: true, viewerGradeId: "grd_b", formGradeId: "grd_b", deadline: unpublished });
    expect(block.kind).toBe("draft");
    // /f/[token] や保存APIの断りと同じ message を使う。ここで自前の文を持つと、同じ下書きに2通りの文が出る
    expect(answerLockedReason({ block, deadline: unpublished, hasResponse: true })).toBe(`${unpublished.message}${unpublished.answerHint}${kept}`);
    expect(answerLockedReason({ block, deadline: unpublished, hasResponse: false })).toBe(`${unpublished.message}${unpublished.answerHint}`);
  });

  it("回答画面は、止めるかどうかと止める文をこの関数で決める（締切だけで決めない）", () => {
    const page = readFileSync(path.join(process.cwd(), "src/app/me/forms/[id]/page.tsx"), "utf8");
    expect(page).toContain("answerLockedReason(");
    expect(page).not.toMatch(/judgement\.canAnswer \?/);
  });

  it("下書きのアンケートで止める文も、ページに直書きせずこの関数から出す", () => {
    // ページが先に自前の文で返すと、この関数の下書きの分岐に届かず、同じ理由の文が2通りになる
    const page = readFileSync(path.join(process.cwd(), "src/app/me/forms/[id]/page.tsx"), "utf8");
    expect(page).not.toContain("まだ準備中です");
  });
});
