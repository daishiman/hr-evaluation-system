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
    const row = read("RevisableRequirementRow.tsx");
    const common = read("VersionedMasterSections.tsx");

    for (const editor of [grade, promotion]) {
      expect(editor).toContain("VersionedMasterSections");
      // 並びの1行（本文・入力欄・行の操作）は2画面とも同じ部品で描く。文言はその部品が持つ
      expect(editor).toContain("<RevisableRequirementBody");
      expect(editor).toContain("revisableRequirementActions({");
      expect(editor).not.toContain(">直す<");
    }
    expect(row).toContain("内容を直す");
    expect(row).toContain("新版として保存");
    expect(row).toContain("今後使わない");
    expect(row).not.toContain(">直す<");
    expect(common).toContain('summary="以前使っていた項目"');
    expect(common).toContain('summary="変更履歴"');
    expect(common).toContain("もう一度使う");
    expect(common).toContain("この内容をもとに新版を作る");
  });

  it("ID操作では等級や区分を送り直さない", () => {
    const grade = read("GradeRequirementEditor.tsx");
    const promotion = read("PromotionRequirementEditor.tsx");

    expect(grade).toContain('send({ kind: "gradeRequirementActivation", id: r.id, isActive: false })');
    expect(promotion).toContain('send({ kind: "promotionRequirementActivation", id: r.id, isActive: false })');
  });

  it("並べ替えは共通の ReorderList に任せ、並び全体（ids）を1回で送る（S11・DD-005）", () => {
    const grade = read("GradeRequirementEditor.tsx");
    const promotion = read("PromotionRequirementEditor.tsx");

    expect(grade).toContain('sendOrder({ kind: "gradeRequirementOrder", ids })');
    expect(promotion).toContain('sendOrder({ kind: "promotionRequirementOrder", ids })');
    for (const editor of [grade, promotion]) {
      expect(editor).toContain("<ReorderList");
      expect(editor).toContain("onCommit={(ids) => sendOrder({");
      // 1段ずつの移動（up/down/top/bottom）は送らない
      expect(editor).not.toContain("direction:");
      // 並びの保存中は fieldset を止めない（止めると、つまみのフォーカスが外れる）
      expect(editor).toContain("disabled={saving && !reordering}");
    }
  });
});
