import { describe, expect, it } from "vitest";
import { cycleOpenReadiness, formPublicationReadiness, setupReadiness } from "./setup-readiness";

const completeGroup = { pointGroup: "Regular", done: true, nextAction: "完了" };
const incompleteGroup = { pointGroup: "Chief", done: false, nextAction: "KPIをあと1件選んでください。" };

describe("設定・評価期間・アンケートのreadiness正本", () => {
  it("評価セットは全等級区分のcomputeGroupProgressが完了したときだけ準備済み", () => {
    expect(setupReadiness({ hasScheme: true, groups: [completeGroup] }).schemeReady).toBe(true);
    const result = setupReadiness({ hasScheme: true, groups: [completeGroup, incompleteGroup] });
    expect(result.schemeReady).toBe(false);
    expect(result.schemeMessage).toContain("Chief");
  });

  it("評価期間は評価セット完了かつ公開中アンケートありでだけopenにできる", () => {
    expect(cycleOpenReadiness({ schemeReady: true, publishedFormCount: 1 }).ready).toBe(true);
    expect(cycleOpenReadiness({ schemeReady: false, publishedFormCount: 1 }).ready).toBe(false);
    expect(cycleOpenReadiness({ schemeReady: true, publishedFormCount: 0 }).message).toContain("公開");
  });

  it("アンケートは準備中/受付中の期間・完了した評価セット・1問以上でだけ公開できる", () => {
    expect(formPublicationReadiness({ schemeReady: true, cycleStatus: "planning", questionCount: 1 }).ready).toBe(true);
    expect(formPublicationReadiness({ schemeReady: true, cycleStatus: "closed", questionCount: 1 }).ready).toBe(false);
    expect(formPublicationReadiness({ schemeReady: false, cycleStatus: "open", questionCount: 1 }).ready).toBe(false);
    expect(formPublicationReadiness({ schemeReady: true, cycleStatus: "open", questionCount: 0 }).ready).toBe(false);
  });
});
