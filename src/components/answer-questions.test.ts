import { describe, expect, it } from "vitest";
import { toAnswerQuestions, toAnswerValues } from "./answer-questions";
import { isAnswered, isOptionSelected, optionAnswer, parseOptions } from "@/lib/domain/answer-snapshot";
import { stripOptionScores } from "@/lib/domain/form-visibility";
import { checkSubmission, normalizeAnswers } from "@/lib/submission-check";

/**
 * 回答画面へ渡す選択肢から配点を外す（DD-032 の8）。
 * 配点は回答者に見せない決まりなので、行に入っていても回答画面の props に載せない。
 * props はページの HTML に埋め込まれるため、画面に出さなくても読めてしまう。
 */

const row = (optionsJson: string | null) => ({
  id: "q1", section: "behavior", questionType: "single_choice", title: "報告", helpText: null, unit: null,
  required: true, validationMin: null, validationMax: null, validationInteger: false, optionsJson,
  displayOrder: 1,
});

describe("toAnswerQuestions の選択肢", () => {
  it.each([null, "", "[]", "{壊れたJSON", '{"score":12}', '[null,4,{"value":2,"label":"同じ","score":44,"internal":"秘密"}]'])(
    "中身の確認画面と同じ公開境界を使う: %s", (json) => {
      expect(toAnswerQuestions([row(json)])[0].optionsJson).toBe(stripOptionScores(json));
    },
  );
  it("配点を外し、値と文言と並びはそのまま渡す", () => {
    const [passed] = toAnswerQuestions([
      row(JSON.stringify([
        { value: "a", label: "できた", score: 3 },
        { value: "b", label: "一部", score: 1 },
      ])),
    ]);
    const options = JSON.parse(passed.optionsJson ?? "[]");
    expect(options).toEqual([
      { value: "a", label: "できた" },
      { value: "b", label: "一部" },
    ]);
    expect(passed.optionsJson).not.toContain("score");
  });

  it("選択肢の無い設問は null のまま", () => {
    const [passed] = toAnswerQuestions([row(null)]);
    expect(passed.optionsJson).toBeNull();
  });
});

describe("回答の保存→読込→再保存", () => {
  const question = (questionType = "single") => ({ ...row(JSON.stringify([
    { value: "1", label: "同じ", score: 2 },
    { value: "2", label: "同じ", score: 73 },
  ])), questionType });

  it.each(["single", "scale", "yesno"])("%sの同じ文言で値と配点が衝突しても、配点なしで元の選択を維持する", (type) => {
    const full = [question(type)];
    const publicQuestions = toAnswerQuestions(full);
    const options = parseOptions(publicQuestions[0].optionsJson);
    const input = { questionId: "q1", ...optionAnswer(options[1]) };
    const stored = normalizeAnswers(full, [input]);
    expect(stored[0]).toMatchObject({ valueNumber: 73, valueText: "同じ", valueJson: '["2"]' });
    const initial = toAnswerValues(full, stored.map((a) => ({ questionId: a.question.id, ...a })));
    expect(initial).toEqual([{ questionId: "q1", valueNumber: 2, valueText: "同じ", valueChoices: ["2"] }]);
    expect(JSON.stringify({ questions: publicQuestions, initial })).not.toContain("73");
    expect(options.map((o) => isOptionSelected(o, initial[0], options))).toEqual([false, true]);
    expect(normalizeAnswers(full, initial)).toEqual(stored);
    expect(checkSubmission(publicQuestions, normalizeAnswers(publicQuestions, initial))).toEqual({ ok: true });
    expect(checkSubmission(full, normalizeAnswers(full, initial))).toEqual({ ok: true });
  });

  it("明示値のない旧回答はサーバーの配点と言葉で同定してから公開値へ戻す", () => {
    expect(toAnswerValues([question()], [{ questionId: "q1", valueNumber: 73, valueText: "同じ", valueJson: null }]))
      .toEqual([{ questionId: "q1", valueNumber: 2, valueText: "同じ", valueChoices: ["2"] }]);
  });

  it.each(["single", "scale", "yesno"])("%sの非数値valueも明示選択で回答済みになり、配点を戻さず再保存できる", (questionType) => {
    const full = [{ ...question(questionType), optionsJson: JSON.stringify([
      { value: "a", label: "甲", score: 41 }, { value: "b", label: "乙", score: 0 },
    ]) }];
    const input = [{ questionId: "q1", ...optionAnswer(parseOptions(toAnswerQuestions(full)[0].optionsJson)[1]) }];
    const stored = normalizeAnswers(full, input);
    expect(stored[0].valueNumber).toBe(0);
    const initial = toAnswerValues(full, stored.map((a) => ({ questionId: a.question.id, ...a })));
    expect(initial).toEqual(input);
    expect(isAnswered(questionType, initial[0])).toBe(true);
    expect(normalizeAnswers(full, initial)).toEqual(stored);
  });

  it("旧設問のvalue重複はlabelと合わせて公開初期値・再保存を維持する", () => {
    const full = [{ ...question(), optionsJson: JSON.stringify([
      { value: "same", label: "甲", score: 15 }, { value: "same", label: "乙", score: 35 },
    ]) }];
    const initial = toAnswerValues(full, [{ questionId: "q1", valueNumber: 35, valueText: "乙", valueJson: null }]);
    expect(initial).toEqual([{ questionId: "q1", valueNumber: null, valueText: "乙", valueChoices: ["same"] }]);
    const stored = normalizeAnswers(full, initial);
    expect(stored[0]).toMatchObject({ valueNumber: 35, valueText: "乙", valueJson: '["same"]' });
    expect(toAnswerValues(full, stored.map((a) => ({ questionId: a.question.id, ...a })))).toEqual(initial);
  });

  it("旧回答を同定できない場合も、保存行の点数やスナップショットは初期値に流さない", () => {
    const full = [question()];
    expect(toAnswerValues(full, [{ questionId: "q1", valueNumber: 999, valueText: "不明", valueJson: null }]))
      .toEqual([{ questionId: "q1", valueNumber: null, valueText: null, valueChoices: null }]);
  });

  it("yes/noの文字列値と0点も、配点なしで回答済み・選択中になる", () => {
    const full = [{ ...question("yesno"), optionsJson: JSON.stringify([
      { value: "yes", label: "できた", score: 100 }, { value: "no", label: "できない", score: 0 },
    ]) }];
    const publicQuestions = toAnswerQuestions(full);
    for (const o of parseOptions(publicQuestions[0].optionsJson)) {
      const input = { questionId: "q1", ...optionAnswer(o) };
      expect(isAnswered("yesno", input)).toBe(true);
      expect(isOptionSelected(o, input)).toBe(true);
      const stored = normalizeAnswers(full, [input]);
      const initial = toAnswerValues(full, stored.map((a) => ({ questionId: a.question.id, ...a })));
      expect(initial).toEqual([input]);
      expect(normalizeAnswers(full, initial)).toEqual(stored);
      expect(checkSubmission(publicQuestions, normalizeAnswers(publicQuestions, initial)))
        .toEqual(checkSubmission(full, stored));
    }
  });

  it("数値欄・段階だけのscale・文章・複数選択は形式に合う初期値を残し、未知設問は落とす", () => {
    const types = ["number", "scale", "text", "multi"];
    const questions = types.map((questionType) => ({ ...question(questionType), id: questionType, optionsJson: null }));
    const answers = [...types, "unknown"].map((questionId) => ({ questionId, valueNumber: 8, valueText: "文", valueJson: '["a"]' }));
    expect(toAnswerValues(questions, answers)).toEqual([
      { questionId: "number", valueNumber: 8, valueText: "文", valueChoices: null },
      { questionId: "scale", valueNumber: 8, valueText: "文", valueChoices: null },
      { questionId: "text", valueNumber: null, valueText: "文", valueChoices: null },
      { questionId: "multi", valueNumber: null, valueText: "文", valueChoices: ["a"] },
    ]);
  });
});
