import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MyDashboard } from "./MyDashboard";

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
