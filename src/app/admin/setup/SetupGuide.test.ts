import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SetupGuide, type SetupStep } from "./SetupGuide";

const definitions = [
  ["等級要件・等級・昇格要件を決める", "/admin/masters/requirements"],
  ["行動指針を確認する", "/admin/behavior"],
  ["KPI・評価セットを決める", "/admin/scheme"],
  ["評価期間を作る", "/admin/cycles"],
  ["アンケートを作って配る", "/admin/forms"],
  ["評価・結果を確認する", "/manager/cycles"],
] as const;

const steps: SetupStep[] = definitions.map(([title, href], index) => ({
  number: index + 1,
  title,
  summary: `${title}の説明`,
  current: `${index + 1}件`,
  complete: index < 3,
  statusLabel: index < 3 ? "設定あり" : "未作成",
  actions: [{ href, label: `${title}へ進む` }],
  detail: `${title}が先に必要な理由`,
}));

describe("SetupGuide", () => {
  it("制度の入力元から評価結果までを依存順に表示する", () => {
    const html = renderToStaticMarkup(createElement(SetupGuide, { steps }));
    const positions = definitions.map(([title]) => html.indexOf(title));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(html.match(/data-setup-step=/g)).toHaveLength(6);
  });

  it("各ステップに現在値・CTA・段階表示の説明を出す", () => {
    const html = renderToStaticMarkup(createElement(SetupGuide, { steps }));

    for (const [, href] of definitions) expect(html).toContain(`href="${href}"`);
    expect(html.match(/<details/g)).toHaveLength(6);
    expect(html.match(/この順番で進める理由/g)).toHaveLength(6);
    expect(html).toContain("現在：");
    expect(html).toContain("設定あり");
    expect(html).toContain("未作成");
  });
});
