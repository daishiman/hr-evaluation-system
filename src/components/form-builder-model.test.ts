import { describe, expect, it } from "vitest";
import { insertBlankQuestionAfter, withClientKeys, type BuilderQuestion } from "./form-builder-model";

const linked: BuilderQuestion = {
  id: "saved-question",
  section: "support",
  questionType: "yesno",
  title: "既存の連携済み設問",
  helpText: null,
  unit: null,
  required: true,
  validationMin: null,
  validationMax: null,
  validationInteger: false,
  options: [],
  isGate: true,
  linkLabel: "等級要件A",
  gradeRequirementId: "greq-a",
  promotionRequirementId: "preq-a",
  behaviorGuidelineId: "behavior-a",
  kpiItemId: "kpi-a",
  kpiQuestionKey: "q1",
};

describe("設問の直後追加", () => {
  it("同じまとまり・答え方の自由設問を直後へ足し、その設問を編集対象として返す", () => {
    const initial = withClientKeys([linked, { ...linked, id: "saved-question-2", title: "次の設問" }]);
    const result = insertBlankQuestionAfter(initial, 0, "new:1");

    expect(result.openKey).toBe("new:1");
    expect(result.rows.map((row) => row.title)).toEqual(["既存の連携済み設問", "", "次の設問"]);
    expect(result.rows[1]).toMatchObject({ section: "support", questionType: "yesno", clientKey: "new:1" });
  });

  it("見た目のまとまりだけを継承し、集計との連携IDと必須ゲートは引き継がない", () => {
    const result = insertBlankQuestionAfter(withClientKeys([linked]), 0, "new:1");
    expect(result.rows[1]).toMatchObject({
      isGate: false,
      linkLabel: null,
      gradeRequirementId: null,
      promotionRequirementId: null,
      behaviorGuidelineId: null,
      kpiItemId: null,
      kpiQuestionKey: null,
    });
  });

  it("前方へ追加しても、既存設問の安定キーは変わらない", () => {
    const initial = withClientKeys([linked, { ...linked, id: "saved-question-2", title: "編集中" }]);
    const editingKey = initial[1].clientKey;
    const result = insertBlankQuestionAfter(initial, 0, "new:1");
    expect(result.rows.find((row) => row.title === "編集中")?.clientKey).toBe(editingKey);
  });
});
