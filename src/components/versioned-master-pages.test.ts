import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("版を持つ要件の画面境界", () => {
  it("通常の件数と参照一覧は、現在版に絞ってから使用中を数える", () => {
    const expectations = [
      ["src/app/admin/page.tsx", "currentVersionRows(gradeRequirements)"],
      ["src/app/admin/page.tsx", "currentVersionRows(promotionRequirements)"],
      ["src/app/admin/masters/page.tsx", "currentVersionRows(gradeReqs)"],
      ["src/app/admin/masters/requirements/page.tsx", "const currentReqs = currentVersionRows(reqs)"],
      ["src/app/admin/setup/page.tsx", "currentVersionRows(gradeRequirements)"],
      ["src/app/admin/setup/page.tsx", "currentVersionRows(promotionRequirements)"],
      ["src/app/criteria/page.tsx", "currentVersionRows(gradeReqs)"],
      ["src/app/criteria/page.tsx", "currentVersionRows(promoReqs)"],
    ] as const;

    for (const [path, expression] of expectations) expect(read(path)).toContain(expression);
  });

  it("編集画面には履歴表示のため、選択した等級の全版を渡す", () => {
    const gradePage = read("src/app/admin/masters/requirements/page.tsx");
    const promotionPage = read("src/app/admin/masters/promotion/page.tsx");

    expect(gradePage).toContain("rows={reqs.filter((r) => r.gradeId === grade.id)}");
    expect(promotionPage).toContain("const myPromoReqs = promoReqs.filter((r) => r.gradeId === grade.id)");
    expect(promotionPage).toContain("rows={myPromoReqs}");
  });
});
