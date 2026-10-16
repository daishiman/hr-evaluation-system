import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  KpiAskingFields,
  KpiAskingSummary,
  askingDraftFromView,
  askingPayload,
  askingProblem,
  askingToSend,
  sameAsking,
  type AskingDraft,
} from "@/components/KpiAskingFields";
import type { AskingView } from "@/lib/domain/kpi-asking";

/* KPI項目の「実績の聞き方」の欄（DD-016）。送る形・送るかどうか・画面に出す文を確かめる */

const saved: AskingView = {
  questions: [
    { key: "q40_1", text: "今期に契約した件数", unit: "件", validation: "0以上の整数", role: "numerator" },
    { key: "q40_2", text: "今期に商談した件数", unit: "件", validation: "1以上の整数", role: "denominator" },
  ],
  formula: "A ÷ B × 100",
  readonlyReason: null,
};
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/<!-- -->/g, "");
const fields = (draft: AskingDraft, extra: { keySetLockedBy?: string | null; problem?: string | null } = {}) =>
  html(
    createElement(KpiAskingFields, {
      draft,
      onChange: () => {},
      keySetLockedBy: extra.keySetLockedBy ?? null,
      busy: false,
      problem: extra.problem ?? null,
      problemId: "asking-problem",
    }),
  );

describe("送る形", () => {
  it("すでにある設問はIDを付けて送り、新しく足した行はIDを付けない。文言と式は前後の空白を落とす", () => {
    const draft = askingDraftFromView(saved);
    draft.questions.push({ id: "new-1", text: "  今期に失注した件数 ", unit: " 件 ", validation: "0以上の整数" });
    draft.formula = " A ÷ ( B + C ) × 100 ";
    expect(askingPayload(draft)).toEqual({
      questions: [
        { key: "q40_1", text: "今期に契約した件数", unit: "件", validation: "0以上の整数" },
        { key: "q40_2", text: "今期に商談した件数", unit: "件", validation: "1以上の整数" },
        { text: "今期に失注した件数", unit: "件", validation: "0以上の整数" },
      ],
      formula: "A ÷ ( B + C ) × 100",
    });
  });

  it("前後の空白だけの違いは変更に数えず、並び・単位の違いは数える", () => {
    const base = askingDraftFromView(saved);
    expect(sameAsking(base, { ...base, formula: "A ÷ B × 100 " })).toBe(true);
    expect(sameAsking(base, { ...base, questions: [...base.questions].reverse() })).toBe(false);
    expect(sameAsking(base, { ...base, questions: [{ ...base.questions[0], unit: "回" }, base.questions[1]] })).toBe(false);
  });
});

describe("保存できない理由", () => {
  it("文言が空の行を、左の文字で指して知らせる", () => {
    const draft = askingDraftFromView(saved);
    draft.questions[1] = { ...draft.questions[1], text: "  " };
    expect(askingProblem(draft)).toBe("Bの聞くことの文言を入れてください。");
  });

  it("文言がそろっていれば、式の検査（サーバーと同じ）の結果を返す", () => {
    expect(askingProblem(askingDraftFromView(saved))).toBeNull();
    expect(askingProblem({ ...askingDraftFromView(saved), formula: "A ÷ ？" })).toContain("消した設問のあった場所");
    expect(askingProblem({ questions: [], formula: "" })).toBe("聞くことを1つ以上足してください。");
  });
});

describe("送るかどうか", () => {
  it("作るときは、聞くことを足したときだけ送る", () => {
    expect(askingToSend({ questions: [], formula: "" }, null)).toEqual({ send: false, problem: null });
    const one: AskingDraft = { questions: [{ id: "new-1", text: "件数", unit: "", validation: "0以上の整数" }], formula: "" };
    expect(askingToSend(one, null)).toEqual({ send: true, problem: "計算式を入れてください。" });
    expect(askingToSend({ ...one, formula: "A" }, null)).toEqual({ send: true, problem: null });
  });

  it("直すときは、聞き方を変えたときだけ送る。変えていなければ古い式を検査し直さない", () => {
    const legacy: AskingView = { questions: [], formula: "契約件数 ÷ 商談件数", readonlyReason: null };
    expect(askingToSend(askingDraftFromView(legacy), legacy)).toEqual({ send: false, problem: null });
    expect(askingToSend(askingDraftFromView(saved), saved)).toEqual({ send: false, problem: null });
    const changed = askingDraftFromView(saved);
    changed.questions[0] = { ...changed.questions[0], text: "今期に受注した件数" };
    expect(askingToSend(changed, saved)).toEqual({ send: true, problem: null });
  });

  it("画面から変えられない項目では、何を組んでも送らない", () => {
    const readonly: AskingView = { ...saved, readonlyReason: "固定枠の項目のため、聞き方は画面から変えられません。" };
    expect(askingToSend({ questions: [], formula: "" }, readonly)).toEqual({ send: false, problem: null });
  });
});

describe("欄の描き方", () => {
  it("聞くことを A・B の文字で並べ、式から決まる役割を添える", () => {
    const out = fields(askingDraftFromView(saved));
    expect(out).toContain('aria-label="Aの聞くこと（アンケートの設問の文言）"');
    expect(out).toContain("計算式での役割：分子");
    expect(out).toContain("計算式での役割：分母");
    expect(out).toContain('class="reorder-list reorder-in-card"');
    expect(out).toContain("聞くこと「今期に契約した件数」を削除");
    expect(out).toMatch(/<button[^>]*>＋ 聞くことを追加<\/button>/);
  });

  it("0を受け付ける分母には、1以上にするよう一言添える", () => {
    const draft = askingDraftFromView(saved);
    draft.questions[1] = { ...draft.questions[1], validation: "0以上の整数" };
    expect(fields(draft)).toMatch(/計算式での役割：分母。[^<]*1以上の整数/);
  });

  it("回答を集めている項目では、削除を出さず、足すボタンを押せなくし、理由を足すボタンの横に書く", () => {
    const out = fields(askingDraftFromView(saved), { keySetLockedBy: "「2026年度上期 営業」のアンケート" });
    expect(out).not.toContain("を削除");
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*>＋ 聞くことを追加<\/button>/);
    expect(out).toContain("「2026年度上期 営業」のアンケートがこの項目の設問で回答を集めているため");
    expect(out).toContain("新しいKPI項目として作ってください");
  });

  it("空のときは、足すボタンの横に、このままでは点が付かないことを書く。式の欄は出さない", () => {
    const out = fields({ questions: [], formula: "" });
    expect(out).toContain("聞くことはまだありません。このままでは、アンケートに出ず、点も付きません。");
    expect(out).not.toContain("計算式（例：A ÷ B × 100）");
    expect(out).not.toContain("reorder-list");
  });

  it("保存できない理由は欄の末尾に書き、式の入力欄から同じ id で指す", () => {
    const out = fields({ ...askingDraftFromView(saved), formula: "A ÷" }, { problem: "計算式が途中で終わっています。" });
    expect(out).toContain('<p id="asking-problem" class="footnote m-0 mt-2">保存の前に：計算式が途中で終わっています。</p>');
    expect(out).toMatch(/<input[^>]*aria-describedby="asking-problem"[^>]*value="A ÷"/);
  });

  it("変えられない聞き方は、読むだけの形で理由と一緒に見せる", () => {
    const out = html(
      createElement(KpiAskingSummary, {
        view: { ...saved, readonlyReason: "決まった値から選ぶ設問のため、聞き方は画面から変えられません。" },
      }),
    );
    expect(out).toContain("A 今期に契約した件数");
    expect(out).toContain("件・0以上の整数・分子");
    expect(out).toContain("<code");
    expect(out).toContain("決まった値から選ぶ設問のため");
    expect(out).not.toContain("<input");
  });
});
