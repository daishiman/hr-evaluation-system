import { describe, expect, it } from "vitest";
import { cycleOpenReadiness, formPublicationReadiness, setupReadiness } from "./setup-readiness";

const GRADES = [
  { name: "等級2", pointGroup: "Regular", displayOrder: 2 },
  { name: "等級3", pointGroup: "Chief", displayOrder: 3 },
];
const completeGroup = { pointGroup: "Regular", selectionDone: true, criteriaDone: true, nextAction: "完了" };
const incompleteGroup = {
  pointGroup: "Chief",
  selectionDone: false,
  criteriaDone: false,
  nextAction: "KPIをあと1件選んでください。",
};

describe("設定・評価期間・アンケートのreadiness正本", () => {
  it("評価セットは全等級区分のcomputeGroupProgressが完了したときだけ準備済み", () => {
    const ready = setupReadiness({ hasScheme: true, groups: [completeGroup] }, GRADES);
    expect(ready.schemeReady).toBe(true);
    expect(ready.schemeGaps).toEqual([]);
    const result = setupReadiness({ hasScheme: true, groups: [completeGroup, incompleteGroup] }, GRADES);
    expect(result.schemeReady).toBe(false);
    // 区分の英語名ではなく等級名で言い、直し方とリンクを添える
    expect(result.schemeMessage).toContain("等級3");
    expect(result.schemeMessage).not.toContain("Chief");
    expect(result.schemeGaps.map((gap) => gap.href)).toEqual(["/admin/scheme/Chief"]);
  });

  it("評価セット未作成と配点ルール未作成を区別して次の操作を案内する", () => {
    expect(setupReadiness({ hasScheme: false, groups: [] }, GRADES).schemeMessage).toContain("評価セット");
    expect(setupReadiness({ hasScheme: true, groups: [] }, GRADES).schemeMessage).toContain("配点ルール");
  });

  it("評価期間は評価セット完了かつ公開中アンケートありでだけopenにできる", () => {
    const schemeMissing = setupReadiness({ hasScheme: false, groups: [] }, GRADES).schemeGaps;
    expect(cycleOpenReadiness({ schemeGaps: [], publishedFormCount: 1 })).toEqual({ ready: true, gaps: [], message: "" });
    expect(cycleOpenReadiness({ schemeGaps: schemeMissing, publishedFormCount: 1 }).ready).toBe(false);
    expect(cycleOpenReadiness({ schemeGaps: [], publishedFormCount: 0 }).message).toContain("公開");
  });

  it("アンケートは準備中/受付中の期間・完了した評価セット・1問以上でだけ公開できる", () => {
    const schemeMissing = setupReadiness({ hasScheme: false, groups: [] }, GRADES).schemeGaps;
    const form = { formId: "f1" };
    expect(formPublicationReadiness({ ...form, schemeGaps: [], cycleStatus: "planning", questionCount: 1 }).ready).toBe(true);
    expect(formPublicationReadiness({ ...form, schemeGaps: [], cycleStatus: "closed", questionCount: 1 }).ready).toBe(false);
    expect(formPublicationReadiness({ ...form, schemeGaps: schemeMissing, cycleStatus: "open", questionCount: 1 }).ready).toBe(false);
    const noQuestion = formPublicationReadiness({ ...form, schemeGaps: [], cycleStatus: "open", questionCount: 0 });
    expect(noQuestion.ready).toBe(false);
    expect(noQuestion.gaps.map((gap) => gap.href)).toEqual(["/admin/forms/f1"]);
  });
});
