import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { companySetupIssues, SystemDashboard, type SystemCompanySummary } from "./SystemDashboard";

const ready: SystemCompanySummary = {
  id: "company-ready",
  name: "運用中株式会社",
  businessType: "給付事業",
  isActive: true,
  users: 12,
  activeUsers: 10,
  companyAdmins: 1,
  usersWithoutGrade: 0,
  cycles: 2,
  openCycles: 1,
  finalizedEvaluations: 8,
};

describe("SystemDashboard", () => {
  it("会社の運用を止める未設定だけを抽出する", () => {
    expect(companySetupIssues(ready)).toEqual([]);
    expect(companySetupIssues({ ...ready, companyAdmins: 0, usersWithoutGrade: 2, cycles: 0 })).toEqual([
      "会社の管理者が未設定",
      "等級未設定 2人",
      "評価期間が未設定",
    ]);
  });

  it("利用停止中の会社は先に直す未設定へ混ぜない", () => {
    const html = renderToStaticMarkup(
      createElement(SystemDashboard, {
        companies: [{ ...ready, id: "stopped", name: "停止済み株式会社", isActive: false, companyAdmins: 0 }],
        selectedCompanyId: null,
        scopeControl: null,
      }),
    );

    expect(html).toContain("運用を止めている未設定はありません");
    expect(html).toContain("利用停止中");
  });

  it("操作会社、未設定、全社詳細を短い順序で表示する", () => {
    const needsSetup = { ...ready, id: "company-new", name: "準備中株式会社", companyAdmins: 0, cycles: 0 };
    const scopeControl = createElement(
      "select",
      { "aria-label": "操作する会社" },
      createElement("option", null, ready.name),
    );
    const html = renderToStaticMarkup(
      createElement(SystemDashboard, {
        companies: [ready, needsSetup],
        selectedCompanyId: ready.id,
        scopeControl,
      }),
    );

    expect(html).toContain("操作する会社");
    expect(html).toContain("会社の管理者が未設定");
    expect(html).toContain("評価期間が未設定");
    expect(html).toContain('role="img"');
    expect(html).toContain("全社の運用状況を見る");
    expect(html).toContain("<details");
    expect(html).toContain('href="/system/companies"');
    expect(html).toContain('href="/system/users"');
    expect(html).not.toContain('<div class="kpi-label">確定済みの評価</div>');
    expect(html.indexOf("操作する会社")).toBeLessThan(html.indexOf("先に確認すること"));
  });
});
