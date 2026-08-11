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
    expect(editor).toContain("いまは選べません");
  });

  it("基準セットは会社の設定を正本にし、コードに固定しない", () => {
    const page = read("src/app/admin/behavior/page.tsx");
    const domain = read("src/lib/domain/behavior.ts");
    const bodySchema = read("src/app/api/masters/body-schema.ts");
    const apply = read("src/app/api/masters/apply-master-update.ts");

    // 選べる基準は DB（behavior_band_sets）から来る。定数の総当たりに戻さない。
    expect(page).toContain("listBehaviorBandSets(companyId)");
    expect(page).toContain("bandSets.map((set) => set.code)");
    expect(domain).not.toContain("export const BEHAVIOR_BANDS");
    // 等級への割り当ては「自社に実在し、使用中の基準か」をサーバー側で確かめる。
    expect(bodySchema).not.toContain("z.enum(BEHAVIOR_BANDS)");
    expect(apply).toContain("s.behaviorBandSets.code, body.behaviorBand");
    // 空の基準は等級に割り当てさせない（設問0件のアンケートができるため）。
    expect(page).toContain("guidelines.some((g) => g.band === set.code && g.isActive)");
  });

  it("基準セットの操作は必ず自社の中だけで解決する", () => {
    const apply = read("src/app/api/masters/apply-master-update.ts");
    const branch = apply.slice(apply.indexOf('case "behaviorBandSet"'), apply.indexOf('case "rankCriteria"'));

    /* 会社の基準を一度だけ読み、その中から id / code を探す形にしている。
       id で直接 DB を引く形に戻すと、他社の基準を指す id を送られたときに通る。 */
    expect(branch).toContain("eq(s.behaviorBandSets.companyId, companyId)");
    expect(branch).toContain("sets.find((set) => set.id === body.id)");
    expect(branch).toContain("sets.find((set) => set.code === body.copyFromBand)");
    // 複製元の観点・段階も自社スコープで読む
    expect(branch).toContain("eq(s.behaviorGuidelines.companyId, companyId), eq(s.behaviorGuidelines.band, source.code)");
    // 観点の追加先も「自社にあるセットか」を確かめてから作る
    expect(branch).toContain("eq(s.behaviorBandSets.companyId, companyId), eq(s.behaviorBandSets.code, band)");
  });

  it("使用中の基準セットは止められず、消す操作そのものを作らない", () => {
    const apply = read("src/app/api/masters/apply-master-update.ts");
    const setEditor = read("src/components/BehaviorBandSetEditor.tsx");

    expect(apply).toContain("先に「どの等級に出すか」でほかの基準か「適用しない」に変えてから、使用を止めてください。");
    // 物理削除はしない。公開済みアンケート・確定済み評価がぶら下げている観点を巻き込むため。
    expect(apply).not.toContain("db.delete(s.behaviorBandSets)");
    expect(apply).not.toContain("db.delete(s.behaviorGuidelines)");
    expect(setEditor).toContain('from "@/components/ConfirmButton"');
    expect(setEditor).toContain("すでに公開したアンケートと確定済みの評価はそのまま残ります");
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
