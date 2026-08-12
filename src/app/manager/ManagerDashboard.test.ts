import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ManagerDashboard, managerNextAction } from "./ManagerDashboard";

describe("ManagerDashboard", () => {
  it("未確定評価を、評価作成や未提出案内より先にする", () => {
    expect(managerNextAction({ draftEvaluations: 2, readyToBuild: 3, teamNotSubmitted: 4 }).title).toBe(
      "未確定の評価が2件あります",
    );
    expect(managerNextAction({ draftEvaluations: 0, readyToBuild: 3, teamNotSubmitted: 4 }).title).toBe(
      "3人分の評価を作成できます",
    );
  });

  it("次の作業、締切、未確定評価、チーム進捗を表示する", () => {
    const html = renderToStaticMarkup(
      createElement(ManagerDashboard, {
        viewerName: "山田",
        cycle: {
          id: "cycle-1",
          name: "2026上期",
          periodStart: "2026-04-01",
          periodEnd: "2026-09-30",
          deadlineLabel: "2026年9月30日",
          daysUntilDeadline: 4,
        },
        draftEvaluations: [{ id: "evaluation-1", employeeName: "佐藤", gradeName: "Regular" }],
        readyToBuild: 2,
        team: [
          { id: "user-1", name: "佐藤", gradeName: "Regular", department: "営業", responseStatus: "submitted" },
          { id: "user-2", name: "鈴木", gradeName: "Chief", department: "営業", responseStatus: "draft" },
        ],
      }),
    );

    expect(html).toContain("未確定の評価が1件あります");
    expect(html).toContain("2026年9月30日");
    expect(html).toContain("あと4日");
    expect(html).toContain('aria-label="チームの提出 2中 1"');
    expect(html).toContain("メンバー別の状況を見る");
    expect(html.indexOf("次にやること")).toBeLessThan(html.indexOf("チームの状況"));
    // 自分の未提出アンケートが無いときは、余計な見出しを出さない
    expect(html).not.toContain("自分の未提出アンケート");
  });

  it("担当チームの表示を壊さずに、自分自身の未提出アンケートをチームの状況より先に出す", () => {
    const html = renderToStaticMarkup(
      createElement(ManagerDashboard, {
        viewerName: "山田",
        cycle: {
          id: "cycle-1",
          name: "2026上期",
          periodStart: "2026-04-01",
          periodEnd: "2026-09-30",
          deadlineLabel: "2026年9月30日",
          daysUntilDeadline: 4,
        },
        ownPendingForms: [
          {
            formId: "form-1",
            title: "上期の実績報告",
            cycleName: "2026上期",
            questionCount: 5,
            responseStatus: null,
            deadlineLabel: "2026年9月30日",
            daysUntilDeadline: 4,
          },
        ],
        draftEvaluations: [],
        readyToBuild: 0,
        team: [{ id: "user-1", name: "佐藤", gradeName: "Regular", department: "営業", responseStatus: "submitted" }],
      }),
    );

    expect(html).toContain("自分の未提出アンケート");
    expect(html).toContain("上期の実績報告");
    expect(html).toContain("未着手");
    expect(html.indexOf("自分の未提出アンケート")).toBeLessThan(html.indexOf("チームの状況"));
    // 担当チームの表示は従来どおり残る
    expect(html).toContain("チームの状況");
    expect(html).toContain("佐藤");
  });
});
