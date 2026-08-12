import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (name: string) => readFileSync(join(process.cwd(), "src/components", name), "utf8");

describe("等級要件・昇格要件の版管理UI", () => {
  it("作成・改訂・停止・復元・並べ替えを別APIに分ける", () => {
    const grade = read("GradeRequirementEditor.tsx");
    const promotion = read("PromotionRequirementEditor.tsx");

    for (const kind of [
      "gradeRequirementCreate",
      "gradeRequirementRevise",
      "gradeRequirementActivation",
      "gradeRequirementRestoreContent",
      "gradeRequirementOrder",
    ]) {
      expect(grade).toContain(`kind: "${kind}"`);
    }
    for (const kind of [
      "promotionRequirementCreate",
      "promotionRequirementRevise",
      "promotionRequirementActivation",
      "promotionRequirementRestoreContent",
      "promotionRequirementOrder",
    ]) {
      expect(promotion).toContain(`kind: "${kind}"`);
    }
    expect(grade).not.toContain('kind: "gradeRequirement",');
    expect(promotion).not.toContain('kind: "promotionRequirement",');
    expect(grade).toContain('id: currentId, sourceVersionId: row.id');
    expect(promotion).toContain('id: currentId, sourceVersionId: row.id');
  });

  it("上書きと誤解する語をやめ、停止中と履歴を共通部品に任せる", () => {
    const grade = read("GradeRequirementEditor.tsx");
    const promotion = read("PromotionRequirementEditor.tsx");
    const common = read("VersionedMasterSections.tsx");

    for (const editor of [grade, promotion]) {
      expect(editor).toContain("VersionedMasterSections");
      expect(editor).toContain("内容を直す");
      expect(editor).toContain("新版として保存");
      expect(editor).toContain("今後使わない");
      expect(editor).not.toContain(">直す<");
    }
    expect(common).toContain('summary="以前使っていた項目"');
    expect(common).toContain('summary="変更履歴"');
    expect(common).toContain("もう一度使う");
    expect(common).toContain("この内容をもとに新版を作る");
  });

  it("ID操作では等級や区分を送り直さない", () => {
    const grade = read("GradeRequirementEditor.tsx");
    const promotion = read("PromotionRequirementEditor.tsx");

    expect(grade).toContain('send({ kind: "gradeRequirementOrder", id: r.id, direction: "up" })');
    expect(grade).toContain('send({ kind: "gradeRequirementActivation", id: r.id, isActive: false })');
    expect(promotion).toContain('send({ kind: "promotionRequirementOrder", id: r.id, direction: "up" })');
    expect(promotion).toContain('send({ kind: "promotionRequirementActivation", id: r.id, isActive: false })');
  });
});
