import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FormActionList, MyDashboard } from "./MyDashboard";

describe("MyDashboard", () => {
  it("回答すべきアンケートを最新結果より先に表示する", () => {
    const html = renderToStaticMarkup(
      createElement(MyDashboard, {
        viewerName: "佐藤",
        cycleName: "2026上期",
        actionableForms: [
          {
            formId: "form-1",
            title: "上期実績アンケート",
            cycleName: "2026上期",
            questionCount: 12,
            responseStatus: "draft",
            deadlineLabel: "2026年9月30日",
            daysUntilDeadline: 2,
          },
        ],
        latestSubmittedForm: null,
        results: [
          {
            id: "evaluation-1",
            cycleName: "2025下期",
            gradeName: "Regular",
            requirementRate: 80,
            requirementAchieved: 4,
            requirementTotal: 5,
            raiseEligible: true,
            promotionEligible: false,
            raiseDecision: null,
            promotionDecision: null,
          },
        ],
        gradeAssigned: true,
      }),
    );

    expect(html).toContain("続きから回答する");
    expect(html).toContain("あと2日");
    expect(html).toContain('aria-label="等級要件の達成率（%） 100中 80"');
    expect(html).toContain("結果と理由を見る");
    expect(html.indexOf("今やること")).toBeLessThan(html.indexOf("自分の結果"));
    expect(html).not.toContain("合計点");
    expect(html).not.toContain("昇格に必要な点数：");
  });

  it("結論のバッジは上司の判断を反映し、変えたときは「上司の判断」の語で示す（DD-024・qa-y10 (21)）", () => {
    const html = renderToStaticMarkup(
      createElement(MyDashboard, {
        viewerName: "佐藤",
        cycleName: "2026上期",
        actionableForms: [],
        latestSubmittedForm: null,
        results: [
          {
            id: "evaluation-1",
            cycleName: "2025下期",
            gradeName: "等級2",
            requirementRate: 80,
            requirementAchieved: 4,
            requirementTotal: 5,
            raiseEligible: true,
            promotionEligible: false,
            raiseDecision: "override",
            promotionDecision: "follow",
          },
        ],
        gradeAssigned: true,
      }),
    );
    expect(html).toContain("昇給：見送り（上司の判断）");
    expect(html).toContain("昇格：見送り");
    expect(html).not.toContain("昇格：見送り（上司の判断）");
  });

  it("最新の評価は、広い画面で「どの評価か」と「達成率・結果への入口」を左右に並べる（S13・A12）", () => {
    const base = {
      id: "evaluation-1",
      cycleName: "2025下期",
      gradeName: "等級2",
      requirementAchieved: 4,
      requirementTotal: 5,
      raiseEligible: false,
      promotionEligible: false,
      raiseDecision: null,
      promotionDecision: null,
    };
    const render = (requirementRate: number | null) =>
      renderToStaticMarkup(
        createElement(MyDashboard, {
          viewerName: "佐藤",
          cycleName: "2026上期",
          actionableForms: [],
          latestSubmittedForm: null,
          results: [{ ...base, requirementRate }],
          gradeAssigned: true,
        }),
      );

    const html = render(80);
    // 右の列を空けたまま縦に積まない（以前は左に全部を積み、右は結果のボタンだけだった）
    expect(html).toContain("md:grid-cols-2");
    expect(html).not.toContain("md:grid-cols-[minmax(0,1fr)_auto]");
    // 読む順は「どの評価か（バッジまで）→ 達成率 → 達成した項目数 → 結果への入口」
    const order = ["2025下期", "昇格：見送り", "等級要件の達成率（%） 100中 80", "項目を達成", "結果と理由を見る"].map((s) =>
      html.indexOf(s),
    );
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);

    // 達成率が判定対象外でも、右の列に理由と結果への入口を置く
    const excluded = render(null);
    expect(excluded).toContain("等級要件の達成率は判定対象外です。");
    expect(excluded).not.toContain("項目を達成");
    expect(excluded.indexOf("判定対象外")).toBeLessThan(excluded.indexOf("結果と理由を見る"));
  });

  it("回答するアンケートが1件だけなら2列の枠に入れず、締切とボタンを本文の右に置く（S13・A12）", () => {
    const form = (formId: string, title: string) => ({
      formId,
      title,
      cycleName: "2026上期",
      questionCount: 12,
      responseStatus: null,
      deadlineLabel: "2026年9月30日",
      daysUntilDeadline: 2,
    });

    // 1件: 左の列にだけ置くと右半分が空いたまま残るので、横幅いっぱいのカードにする
    const one = renderToStaticMarkup(createElement(FormActionList, { forms: [form("form-1", "上期実績アンケート")] }));
    expect(one).not.toContain("card-grid");
    expect(one).not.toContain("card-foot");
    expect(one).toContain("hero-tint");
    // 左に「どのアンケートか」、右に「締切と回答への入口」（カードの幅で縦積みに切り替わる共通の並べ方）
    expect(one).toContain("split-host");
    const aside = one.slice(one.indexOf('class="split-aside"'));
    expect(one.indexOf('class="split-main"')).toBeLessThan(one.indexOf('class="split-aside"'));
    expect(aside).toContain("回答締切");
    expect(aside).toContain("回答を始める");
    expect(aside).not.toContain("上期実績アンケート");
    // 読む順は「題名 → 締切 → ボタン」のまま
    expect(one.indexOf("上期実績アンケート")).toBeLessThan(one.indexOf("回答締切"));
    expect(one.indexOf("回答締切")).toBeLessThan(one.indexOf("回答を始める"));

    // 2件以上: 高さをそろえた2列に並べ、先頭だけを主役にする
    const two = renderToStaticMarkup(
      createElement(FormActionList, { forms: [form("form-1", "上期実績アンケート"), form("form-2", "追加アンケート")] }),
    );
    expect(two).toContain('class="card-grid"');
    expect(two.match(/card-foot/g)).toHaveLength(2);
    expect(two.match(/hero-tint/g)).toHaveLength(1);
    expect(two).not.toContain("split-host");
  });

  it("回答対象がなくても、提出済みの内容への入口を残す", () => {
    const html = renderToStaticMarkup(
      createElement(MyDashboard, {
        viewerName: "佐藤",
        cycleName: "2026上期",
        actionableForms: [],
        latestSubmittedForm: { formId: "form-submitted", title: "提出済みアンケート" },
        results: [],
        gradeAssigned: true,
      }),
    );

    expect(html).toContain("提出済み");
    expect(html).toContain("提出した内容を見る");
    expect(html).toContain("/me/forms/form-submitted");
  });
});
