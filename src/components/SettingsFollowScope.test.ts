import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SettingsFollowScope } from "./SettingsFollowScope";

describe("設定の反映範囲", () => {
  it("行動指針は既存下書き・回答済みの次版・履歴保全を説明し、評価の再集計を約束しない", () => {
    const html = renderToStaticMarkup(createElement(SettingsFollowScope, { kinds: ["behaviorGuideline"] }));
    expect(html).toContain("回答の無い下書き");
    expect(html).toContain("回答のある公開中のアンケート");
    expect(html).toContain("次の版の下書き");
    expect(html).toContain("締め切った期");
    expect(html).toContain("公開済みの設問と確定済みの評価は、そのまま残ります。");
    expect(html).not.toContain("集計し直します");
  });

  it("ランク基準は評価だけ、KPI項目はアンケートと評価の両方を説明する", () => {
    const criteria = renderToStaticMarkup(createElement(SettingsFollowScope, { kinds: ["rankCriteriaSet"] }));
    expect(criteria).toContain("確定前の評価を集計し直します");
    expect(criteria).not.toContain("次の版の下書き");
    const item = renderToStaticMarkup(createElement(SettingsFollowScope, { kinds: ["kpiItemUpdate"] }));
    expect(item).toContain("次の版の下書き");
    expect(item).toContain("確定前の評価を集計し直します");
  });

  it("設問にも判定にも関わらない保存には追従の説明を出さない", () => {
    expect(renderToStaticMarkup(createElement(SettingsFollowScope, { kinds: ["office"] }))).toBe("");
  });
});
