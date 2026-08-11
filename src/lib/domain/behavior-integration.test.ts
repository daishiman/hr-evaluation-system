import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("行動指針の画面・フォーム・評価の境界", () => {
  it("Server Component は Client Component から等級帯の定数を読まない", () => {
    const clientEditor = read("src/components/BehaviorGuidelineEditor.tsx");
    const behaviorPage = read("src/app/admin/behavior/page.tsx");
    const mastersPage = read("src/app/admin/masters/page.tsx");

    expect(clientEditor).not.toContain("export const BAND_LABEL");
    expect(behaviorPage).toContain('from "@/lib/domain/behavior"');
    expect(mastersPage).toContain('from "@/lib/domain/behavior"');
    expect(behaviorPage).not.toContain('BAND_LABEL, BehaviorGuidelineEditor } from "@/components/BehaviorGuidelineEditor"');
  });

  it("等級適用は現在値に追随する専用の controlled editor を使う", () => {
    const page = read("src/app/admin/behavior/page.tsx");
    const editor = read("src/components/BehaviorBandAssignmentEditor.tsx");

    expect(page).toContain("<BehaviorBandAssignmentEditor");
    expect(editor).toContain("value={gradeId}");
    expect(editor).toContain("selectGrade(event.target.value)");
    expect(editor).toContain("behaviorBandForGrade(grades, nextGradeId)");
    expect(editor).toContain("availableBands.includes(band)");
    expect(editor).toContain("行動指針が未登録");
  });

  it("等級切替時は昇格フォームと下書き状態を作り直す", () => {
    const page = read("src/app/admin/masters/promotion/page.tsx");
    expect(page).toMatch(/<RecordForm\s+key=\{grade\.id\}/);
    expect(page).toMatch(/<PromotionRequirementEditor\s+key=\{grade\.id\}/);
  });

  it("無効な行動指針を次のアンケートに入れない", () => {
    const formBuild = read("src/lib/form-build.ts");
    const editor = read("src/components/BehaviorGuidelineEditor.tsx");
    const queries = read("src/lib/queries.ts");
    const adminListQuery = queries.slice(
      queries.indexOf("export async function listBehaviorGuidelines"),
      queries.indexOf("/* ───────────────── KPI・評価セット", queries.indexOf("export async function listBehaviorGuidelines")),
    );
    expect(formBuild).toContain("eq(s.behaviorGuidelines.isActive, true)");
    expect(adminListQuery).not.toContain("behaviorGuidelines.isActive");
    expect(editor).toContain('from "@/components/ConfirmButton"');
    expect(editor).toContain('isActive: false');
    expect(editor).toContain('isActive: true');
    expect(editor).toContain("すでに公開したアンケートと確定済みの評価はそのまま残ります");
  });

  it("評価の観点名は現在のマスタではなく公開済み設問の写しを使う", () => {
    const evaluate = read("src/lib/evaluate.ts");
    expect(evaluate).toContain("aspectName: q.title");
    expect(evaluate).not.toContain("aspectName: g?.aspectName ?? q.title");
  });
});
