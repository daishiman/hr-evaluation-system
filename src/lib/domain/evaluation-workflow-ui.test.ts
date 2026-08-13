import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("評価確認画面の読む順番", () => {
  const detail = read("components/EvaluationDetail.tsx");
  const page = read("app/manager/evaluations/[id]/page.tsx");

  it("結論と例外を見てから、点数・項目の根拠へ進む", () => {
    const conclusion = detail.indexOf("この期の判定");
    const exception = detail.indexOf("{afterConclusion}");
    const evidence = detail.indexOf("評価の全体像");
    expect(conclusion).toBeGreaterThanOrEqual(0);
    expect(exception).toBeGreaterThan(conclusion);
    expect(evidence).toBeGreaterThan(exception);
  });

  it("集計し直しの要否を例外枠へ置き、全根拠のあとに確定操作を置く", () => {
    expect(page).toContain("afterConclusion={");
    expect(page.indexOf("<EvaluationDetail")).toBeLessThan(page.indexOf("<EvaluatorPanel"));
  });
});
