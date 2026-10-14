import { describe, expect, it } from "vitest";
import {
  insertBlankQuestionAfter,
  optionKeys,
  reorderByKeys,
  withClientKeys,
  type BuilderQuestion,
} from "./form-builder-model";

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

describe("設問・選択肢の並べ替え（S11）", () => {
  const rows = [{ k: "a" }, { k: "b" }, { k: "c" }];
  const keyOf = (row: { k: string }) => row.k;

  it("渡された並びのとおりに並べ直す", () => {
    expect(reorderByKeys(rows, ["c", "a", "b"], keyOf).map(keyOf)).toEqual(["c", "a", "b"]);
  });

  it("キーの集まりが食い違えば（不足・知らないキー・重複）、元の並びのまま", () => {
    for (const keys of [["a", "b"], ["a", "b", "x"], ["a", "a", "b"]]) {
      expect(reorderByKeys(rows, keys, keyOf).map(keyOf)).toEqual(["a", "b", "c"]);
    }
    // 行のキーそのものが重なっているときも並べ替えない（どちらの行か決められない）
    expect(reorderByKeys([{ k: "a" }, { k: "a" }], ["a", "a"], keyOf)).toHaveLength(2);
  });

  it("選択肢のキーは値。重なる値は2つ目から何番目かを付ける", () => {
    expect(optionKeys([{ value: "1" }, { value: "2" }, { value: "1" }, { value: "1" }])).toEqual(["1", "2", "1#2", "1#3"]);
    expect(optionKeys([])).toEqual([]);
  });

  it("重複値の代替キーが別の選択肢の実値と衝突しても、各行を個別に編集できる", () => {
    const keys = optionKeys([{ value: "1" }, { value: "1" }, { value: "1#2" }, { value: "1#2" }]);
    expect(new Set(keys).size).toBe(4);
    expect(keys[0]).toBe("1");
    expect(keys[2]).toBe("1#2");
  });
});
