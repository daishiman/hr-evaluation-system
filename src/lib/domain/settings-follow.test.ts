import { describe, expect, it } from "vitest";
import { FOLLOW_KINDS, FOLLOW_TARGETS, followFormName, followMessage, followTargetsOf, type FollowOutcome } from "./settings-follow";

const empty: FollowOutcome = { rebuilt: [], nextVersions: [], evaluations: [], formFailures: [], evaluationFailures: [] };

describe("followTargetsOf", () => {
  it("すべての種類に追従先がある", () => {
    expect(Object.keys(FOLLOW_TARGETS).sort()).toEqual([...FOLLOW_KINDS].sort());
  });

  it("設問の元になる設定はアンケートだけを追従させる", () => {
    expect(followTargetsOf(["behaviorGuideline"])).toEqual({ forms: true, evaluations: false });
    expect(followTargetsOf(["gradeRequirementRevise"])).toEqual({ forms: true, evaluations: false });
    expect(followTargetsOf(["grade"])).toEqual({ forms: true, evaluations: false });
  });

  it("判定に効く設定は評価だけを集計し直す", () => {
    expect(followTargetsOf(["rankCriteriaSet"])).toEqual({ forms: false, evaluations: true });
    expect(followTargetsOf(["threshold"])).toEqual({ forms: false, evaluations: true });
  });

  it("評価セットと KPI 項目の更新は両方を追従させる", () => {
    expect(followTargetsOf(["scheme"])).toEqual({ forms: true, evaluations: true });
    expect(followTargetsOf(["kpiItemUpdate"])).toEqual({ forms: true, evaluations: true });
  });

  it("設問にも計算にも使わない設定は何も追従させない", () => {
    expect(followTargetsOf(["raise", "raisePolicy", "office", "kpiCategoryCreate", "kpiItemCreate"])).toEqual({
      forms: false,
      evaluations: false,
    });
    expect(followTargetsOf([])).toEqual({ forms: false, evaluations: false });
  });

  it("触った種類の追従先を合わせる", () => {
    expect(followTargetsOf(["behaviorGuideline", "rankCriteria"])).toEqual({ forms: true, evaluations: true });
  });
});

describe("followFormName", () => {
  it("2版目から版を添える", () => {
    expect(followFormName("2026年度上期 Regular", 1)).toBe("2026年度上期 Regular");
    expect(followFormName("2026年度上期 Regular", 2)).toBe("2026年度上期 Regular 第2版");
  });
});

describe("followMessage", () => {
  it("何も追従しなかったときは空", () => {
    expect(followMessage(empty)).toBe("");
  });

  it("作り直した下書き・次の版・集計し直した評価を、件数と名前を省かずに出す", () => {
    expect(
      followMessage({
        ...empty,
        rebuilt: ["下期 Regular", "下期 Senior"],
        nextVersions: ["上期 Regular 第2版"],
        evaluations: ["本人"],
      }),
    ).toBe(
      "回答の無い下書きのアンケートを作り直しました（2件: 下期 Regular、下期 Senior）。" +
        "回答のあるアンケートに次の版の下書きを作りました（1件: 上期 Regular 第2版）。公開は内容を確かめてから行ってください。" +
        "確定前の評価を集計し直しました（1件: 本人）。上司のコメントと判断はそのまま残しています。",
    );
  });

  it("追従できなかったものは理由と直し方を添えて出す。名前の無い失敗は理由だけ", () => {
    expect(
      followMessage({
        ...empty,
        formFailures: [{ name: "下期 Regular", reason: "設問を1問も作れませんでした" }],
        evaluationFailures: [
          { name: "本人", reason: "回答が見つかりません" },
          { name: null, reason: "評価を読めませんでした" },
        ],
      }),
    ).toBe(
      "アンケートをいまの設定に合わせられませんでした（1件: 下期 Regular（設問を1問も作れませんでした））。アンケートの画面で設問を作り直すか、新しい版を作ってください。" +
        "評価を集計し直せませんでした（2件: 本人（回答が見つかりません）、評価を読めませんでした）。評価期間の画面の「いまの基準で集計し直す」から集計し直してください。",
    );
  });
});
