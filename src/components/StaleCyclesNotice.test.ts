import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StaleCyclesNotice, type StaleCycle } from "./StaleCyclesNotice";

const cycle = (patch: Partial<StaleCycle> = {}): StaleCycle => ({
  cycleId: "cycle-2026-h1",
  cycleName: "2026年度上期",
  recomputable: 2,
  finalized: 1,
  ...patch,
});

describe("StaleCyclesNotice", () => {
  it("確認中の評価があれば再集計先を案内する", () => {
    const html = renderToStaticMarkup(createElement(StaleCyclesNotice, { cycles: [cycle()] }));

    expect(html).toContain("確認中 2件が古い基準のままです");
    expect(html).toContain('href="/manager/cycles?cycle=cycle-2026-h1"');
    expect(html).toContain("集計し直す");
  });

  it("確定済みしかなければ再集計できるように見せない", () => {
    const html = renderToStaticMarkup(
      createElement(StaleCyclesNotice, { cycles: [cycle({ recomputable: 0, finalized: 4 })] }),
    );

    expect(html).toContain("基準を変える前に確定した評価があります");
    expect(html).toContain("確定済み 4件は、判定した当時の基準のまま据え置かれます");
    expect(html).not.toContain("集計し直す");
    expect(html).not.toContain("/manager/cycles");
  });

  it("対象がなければ何も表示しない", () => {
    expect(renderToStaticMarkup(createElement(StaleCyclesNotice, { cycles: [] }))).toBe("");
  });
});
