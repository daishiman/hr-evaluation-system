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
  });
});
