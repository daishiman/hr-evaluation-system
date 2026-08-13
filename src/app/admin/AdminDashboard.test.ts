import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AdminDashboard,
  buildAdminDashboardModel,
  type AdminDashboardSnapshot,
} from "./AdminDashboard";

const ready: AdminDashboardSnapshot = {
  companyName: "テスト福祉会",
  memberCount: 10,
  gradeCount: 7,
  activeGradeRequirementCount: 20,
  activePromotionRequirementCount: 5,
  activeBehaviorGuidelineCount: 10,
  behaviorAppliedGradeCount: 7,
  kpiItemCount: 33,
  hasActiveScheme: true,
  schemeItemCount: 25,
  schemeReady: true,
  cycleCount: 1,
  cycle: {
    id: "cycle-2026-h1",
    name: "2026年度上期",
    periodStart: "2026-04-01",
    periodEnd: "2026-09-30",
    status: "open",
  },
  hasOpenCycle: true,
  formCount: 7,
  draftFormCount: 0,
  publishedFormCount: 7,
  respondentCount: 10,
  submittedCount: 10,
  evaluationCount: 10,
  finalizedEvaluationCount: 10,
  provisionalPromotionCount: 0,
  provisionalRaiseCount: 0,
};

describe("buildAdminDashboardModel", () => {
  it.each([
    ["等級", { gradeCount: 0 }, "/admin/masters"],
    ["等級要件", { activeGradeRequirementCount: 0 }, "/admin/masters/requirements"],
    ["昇格要件", { activePromotionRequirementCount: 0 }, "/admin/masters/promotion"],
    ["行動指針", { activeBehaviorGuidelineCount: 0 }, "/admin/behavior"],
    ["行動指針の等級適用", { behaviorAppliedGradeCount: 0 }, "/admin/behavior"],
    ["KPI", { kpiItemCount: 0 }, "/admin/scheme"],
    ["評価セット", { hasActiveScheme: false, schemeItemCount: 0, schemeReady: false }, "/admin/scheme"],
    ["評価セット未完了", { schemeReady: false }, "/admin/scheme"],
    ["評価期間", { hasOpenCycle: false }, "/admin/cycles"],
    ["アンケート作成", { formCount: 0, publishedFormCount: 0 }, "/admin/forms?cycle=cycle-2026-h1"],
    ["アンケート公開", { draftFormCount: 2, publishedFormCount: 5 }, "/admin/forms?cycle=cycle-2026-h1"],
  ])("依存順を飛ばさず%sを次の一手にする", (_label, patch, href) => {
    expect(buildAdminDashboardModel({ ...ready, ...patch }).nextAction.href).toBe(href);
  });

  it("回答回収後だけ集計へ進み、未確定があれば確認を優先する", () => {
    const collect = buildAdminDashboardModel({ ...ready, submittedCount: 4, evaluationCount: 0, finalizedEvaluationCount: 0 });
    expect(collect.nextAction.label).toBe("回答状況を見る");

    const aggregate = buildAdminDashboardModel({ ...ready, evaluationCount: 0, finalizedEvaluationCount: 0 });
    expect(aggregate.nextAction.label).toBe("評価を集計する");

    const review = buildAdminDashboardModel({ ...ready, finalizedEvaluationCount: 6 });
    expect(review.nextAction.label).toBe("評価を確認する");
    expect(review.reviewState).toBe("in_progress");
  });

  it("全工程が完了したときだけ完了状態にする", () => {
    const model = buildAdminDashboardModel(ready);
    expect(model.preparation.completed).toBe(model.preparation.total);
    expect(model.operationState).toBe("responses_ready");
    expect(model.reviewState).toBe("complete");
    expect(model.nextAction.label).toBe("確定した評価を見る");
  });
});

describe("AdminDashboard", () => {
  it("次の一手を最上部に置き、3段階と設定順をアクセシブルな構造で表示する", () => {
    const html = renderToStaticMarkup(createElement(AdminDashboard, { snapshot: ready }));

    expect(html.indexOf("次の一手")).toBeLessThan(html.indexOf("進め方と現在地"));
    expect(html).toContain("制度準備");
    expect(html).toContain("評価運用");
    expect(html).toContain("確認");
    expect(html).toContain("<details");
    expect(html).toContain("<ol");
    expect(html).toContain('role="img"');
    expect(html).not.toContain("<table");
  });

  it("設定順のリンクは実在する管理画面だけを指す", () => {
    const html = renderToStaticMarkup(createElement(AdminDashboard, { snapshot: ready }));
    for (const href of [
      "/admin/masters/requirements",
      "/admin/masters/promotion",
      "/admin/behavior",
      "/admin/masters",
      "/admin/scheme",
      "/admin/cycles",
      "/admin/forms",
      "/manager/cycles",
    ]) {
      expect(html).toContain(`href="${href}`);
    }
  });

  it.each([
    ["昇格条件", { provisionalPromotionCount: 2, provisionalRaiseCount: 0 }, "/admin/masters/promotion", "の昇格条件", "の昇給額"],
    ["昇給額", { provisionalPromotionCount: 0, provisionalRaiseCount: 3 }, "/admin/raises", "の昇給額", "の昇格条件"],
  ])("%sだけが暫定なら、その設定を解決できる画面だけを案内する", (_label, patch, expectedHref, expectedText, absentText) => {
    const html = renderToStaticMarkup(createElement(AdminDashboard, { snapshot: { ...ready, ...patch } }));

    expect(html).toContain(`href="${expectedHref}"`);
    expect(html).toContain(expectedText);
    expect(html).not.toContain(absentText);
  });

  it("昇格条件と昇給額がどちらも暫定なら、それぞれの解決先を案内する", () => {
    const html = renderToStaticMarkup(
      createElement(AdminDashboard, {
        snapshot: { ...ready, provisionalPromotionCount: 2, provisionalRaiseCount: 3 },
      }),
    );

    expect(html).toContain('href="/admin/masters/promotion"');
    expect(html).toContain('href="/admin/raises"');
    expect(html).toContain("の昇格条件が2件");
    expect(html).toContain("の昇給額が3件");
  });
});
