import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("制度設定から評価への影響通知", () => {
  it("再集計が必要なKPI・KGIの編集画面は共通通知を表示する", () => {
    expect(read("src/app/admin/scheme/page.tsx")).toContain("<StaleCyclesNotice cycles={staleCycles} />");
    expect(read("src/app/admin/kgi/page.tsx")).toContain("<StaleCyclesNotice cycles={staleCycles} />");
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

  it("KGI係数の表示名は数値境界から導き、自由入力に戻さない", () => {
    const page = read("src/app/admin/kgi/page.tsx");

    expect(page).toContain("{kgiRangeLabel(c)}");
    expect(page).toContain("title={kgiRangeLabel(k)}");
    expect(page).not.toContain('{ name: "label", label: "区分の名前"');
  });
});
