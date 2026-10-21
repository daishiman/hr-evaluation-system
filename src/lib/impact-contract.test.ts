import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("制度設定から評価への影響通知", () => {
  it("再集計が必要なKPI・昇格に必要な点数の編集画面は共通通知を表示する", () => {
    expect(read("src/app/admin/scheme/page.tsx")).toContain("<StaleCyclesNotice cycles={staleCycles} />");
    expect(read("src/app/admin/masters/promotion/page.tsx")).toContain("<StaleCyclesNotice cycles={staleCycles} />");
  });

  it("公開時スナップショットの要件・行動指針をstale判定や通知へ混ぜない", () => {
    const impact = read("src/lib/impact.ts");
    const behaviorPage = read("src/app/admin/behavior/page.tsx");

    expect(impact).not.toContain("{ table: s.behaviorLevels");
    expect(impact).not.toContain("{ table: s.behaviorGuidelines");
    expect(impact).not.toContain("{ table: s.gradeRequirements");
    expect(impact).not.toContain("{ table: s.promotionRequirements");
    expect(behaviorPage).not.toContain("StaleCyclesNotice");
  });
});
