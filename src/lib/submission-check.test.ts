import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isAnswered } from "@/lib/domain/answer-snapshot";
import {
  checkSubmission,
  missingAnswersMessage,
  missingRequired,
  normalizeAnswers,
  type SubmissionQuestion,
} from "@/lib/submission-check";
import { stripComments } from "@/test-support/source-code";
import { stripOptionScores } from "@/lib/domain/form-visibility";

const q = (patch: Partial<SubmissionQuestion> & { id: string }): SubmissionQuestion => ({
  section: "free", displayOrder: 0, questionType: "text", title: patch.id, required: false,
  validationMin: null, validationMax: null, validationInteger: false, unit: null, ...patch,
});

// 画面では 実績（kpi）の節が 自由記入（free）より上に来る
const count = q({ id: "count", section: "kpi", displayOrder: 1, questionType: "number", title: "件数の設問",
  required: true, validationMin: 0, validationInteger: true, unit: "件" });
const rate = q({ id: "rate", section: "kpi", displayOrder: 2, questionType: "number", title: "割合の設問",
  required: true, validationMin: 0, validationMax: 100 });
const pick = q({ id: "pick", section: "free", displayOrder: 0, questionType: "multi", title: "選ぶ設問", required: true });
const memo = q({ id: "memo", section: "free", displayOrder: 1, questionType: "text", title: "任意の設問" });
// 保存した順は 自由記入 → 実績（画面の順とは逆）
const questions = [pick, memo, rate, count];

const check = (answers: Parameters<typeof normalizeAnswers>[1]) => checkSubmission(questions, normalizeAnswers(questions, answers));

describe("normalizeAnswers（送られた答えを保存する形にそろえる）", () => {
  it("そのアンケートの設問でない答えを落とす", () => {
    const rows = normalizeAnswers(questions, [{ questionId: "other-form-q", valueNumber: 1 }, { questionId: "count", valueNumber: 2 }]);
    expect(rows.map((r) => r.question.id)).toEqual(["count"]);
  });

  it("文章と複数選択は数値の列を使わず、複数選択だけ選んだ value を value_json に入れる", () => {
    const [text, multi, num] = normalizeAnswers(questions, [
      { questionId: "memo", valueNumber: 5, valueText: "書いた文" },
      { questionId: "pick", valueNumber: 5, valueChoices: ["甲", "乙"] },
      { questionId: "count", valueNumber: 3, valueChoices: ["甲"] },
    ]);
    expect(text).toMatchObject({ valueNumber: null, valueText: "書いた文", valueJson: null });
    expect(multi).toMatchObject({ valueNumber: null, valueJson: JSON.stringify(["甲", "乙"]) });
    expect(num).toMatchObject({ valueNumber: 3, valueJson: null });
  });
});

describe("normalizeAnswers の採点（1つ選ぶ設問は、サーバーの選択肢から点数を決める。DD-032 の8）", () => {
  const options = JSON.stringify([
    { value: "a", label: "できた", score: 3 },
    { value: "b", label: "一部", score: 1 },
  ]);
  const single = q({ id: "single", questionType: "single", optionsJson: options });

  it.each([["a"], ["b"]])("明示した選択値%sを優先し、送られた偽の点数や文言を保存しない", (value) => {
    const [row] = normalizeAnswers([single], [{ questionId: "single", valueNumber: 999, valueText: "偽装", valueChoices: [value] }]);
    expect(row).toMatchObject(value === "a"
      ? { valueNumber: 3, valueText: "できた", valueJson: '["a"]' }
      : { valueNumber: 1, valueText: "一部", valueJson: '["b"]' });
  });

  it.each([["unknown"], ["a", "b"], ["a", "a"], []])("不正な単一選択%sを旧配点と言葉で正当化しない", (...values) => {
    const sent = [{ questionId: "single", valueNumber: 3, valueText: "できた", valueChoices: values }];
    const required = { ...single, required: true };
    const normalized = normalizeAnswers([required], sent);
    expect(normalized[0]).toMatchObject({ valueNumber: null, valueText: null });
    expect(checkSubmission([required], normalized).ok).toBe(false);
  });

  it("値が重複した旧設問は明示値と言葉で識別し、言葉でも区別できないものは断る", () => {
    const twins = { ...single, optionsJson: JSON.stringify([
      { value: "same", label: "甲", score: 1 }, { value: "same", label: "乙", score: 2 },
    ]) };
    const [row] = normalizeAnswers([twins], [{ questionId: "single", valueChoices: ["same"], valueText: "乙", valueNumber: 999 }]);
    expect(row).toMatchObject({ valueNumber: 2, valueText: "乙", valueJson: '["same"]' });
    const invalid = normalizeAnswers([twins], [{ questionId: "single", valueChoices: ["same"], valueText: "不明", valueNumber: 1 }]);
    expect(invalid[0].valueNumber).toBeNull();
    expect(checkSubmission([twins], invalid).ok).toBe(false);
  });

  it("送られた数ではなく、選んだ言葉に合う選択肢の配点を入れる", () => {
    const [row] = normalizeAnswers([single], [{ questionId: "single", valueNumber: 999, valueText: "一部" }]);
    expect(row).toMatchObject({ valueNumber: 1, valueText: "一部", valueJson: '["b"]' });
  });

  it("配点を持たない回答画面が値から読んだ数（null）を送っても、配点どおりに入る", () => {
    const [row] = normalizeAnswers([single], [{ questionId: "single", valueNumber: null, valueText: " できた " }]);
    expect(row).toMatchObject({ valueNumber: 3, valueText: "できた" });
  });

  it("言葉が無い・合わないときだけ、送られた数を配点と照らす（言葉は選択肢のものに直す）", () => {
    const [noText, otherText] = normalizeAnswers([single], [
      { questionId: "single", valueNumber: 3 },
      { questionId: "single", valueNumber: 1, valueText: "勝手な言葉" },
    ]);
    expect(noText).toMatchObject({ valueNumber: 3, valueText: "できた" });
    expect(otherText).toMatchObject({ valueNumber: 1, valueText: "一部" });
  });

  it("言葉も配点も合わない答えは、点数も言葉も入れない（選択肢に無い点数は保存しない。必須なら未入力で断る）", () => {
    const sent = [{ questionId: "single", valueNumber: 999, valueText: "勝手な言葉" }];
    const [row] = normalizeAnswers([single], sent);
    expect(row).toMatchObject({ valueNumber: null, valueText: null });
    const required = { ...single, required: true };
    expect(checkSubmission([required], normalizeAnswers([required], sent)).ok).toBe(false);
  });

  it("同じ言葉の選択肢が並ぶときは、値を数として読んだものと送られた数で絞る", () => {
    const twins = q({ id: "twins", questionType: "scale", optionsJson: JSON.stringify([
      { value: "1", label: "ふつう", score: 10 },
      { value: "2", label: "ふつう", score: 20 },
    ]) });
    const [row] = normalizeAnswers([twins], [{ questionId: "twins", valueNumber: 2, valueText: "ふつう" }]);
    expect(row.valueNumber).toBe(20);
  });

  it("文言の無い「はい／いいえ」は、回答画面と同じ素の選択肢（はい=1・いいえ=0）で決める", () => {
    const yesno = q({ id: "yn", questionType: "yesno", optionsJson: null });
    const [yes, no] = normalizeAnswers([yesno], [
      { questionId: "yn", valueNumber: 5, valueText: "はい" },
      { questionId: "yn", valueNumber: 5, valueText: "いいえ" },
    ]);
    expect([yes.valueNumber, no.valueNumber]).toEqual([1, 0]);
  });

  it("選択肢の無い段階の設問（scale）は、送られた段階の数のまま（範囲は checkSubmission が見る）", () => {
    const steps = q({ id: "steps", questionType: "scale", validationMin: 1, validationMax: 5 });
    const [row] = normalizeAnswers([steps], [{ questionId: "steps", valueNumber: 4, valueText: "4" }]);
    expect(row).toMatchObject({ valueNumber: 4, valueText: "4" });
  });

  it("選択肢が無いsingleへ送った数を点数として保存しない", () => {
    const empty = { ...single, optionsJson: null };
    expect(normalizeAnswers([empty], [{ questionId: "single", valueNumber: 999, valueText: "偽装" }])[0])
      .toMatchObject({ valueNumber: null, valueText: null, valueJson: null });
  });
});

describe("配点なしの試しの提出と、本物の提出の判定", () => {
  const choices = JSON.stringify([{ value: "1", label: "同じ", score: 10 }, { value: "2", label: "同じ", score: 20 }]);
  const full = q({ id: "scaled", questionType: "scale", required: true, optionsJson: choices, validationMin: 10, validationMax: 20 });
  const publicQuestion = { ...full, optionsJson: stripOptionScores(choices) };

  it.each([[], [{ questionId: "scaled", valueChoices: ["1"] }], [{ questionId: "scaled", valueChoices: ["不明"] }],
    [{ questionId: "scaled", valueChoices: ["1", "2"] }]])("公開入力%sに対して同じ可否・知らせになる", (...answers) => {
    expect(checkSubmission([publicQuestion], normalizeAnswers([publicQuestion], answers)))
      .toEqual(checkSubmission([full], normalizeAnswers([full], answers)));
  });

  it("選択肢付きscaleは配点範囲を見ず、選択肢への所属で通す", () => {
    const input = [{ questionId: "scaled", valueNumber: 999, valueChoices: ["1"] }];
    expect(checkSubmission([publicQuestion], normalizeAnswers([publicQuestion], input))).toEqual({ ok: true });
    expect(checkSubmission([full], normalizeAnswers([full], input))).toEqual({ ok: true });
  });

  it.each(["number", "scale"])("%sの数値入力の範囲・整数検査は残す", (questionType) => {
    const number = { ...full, questionType, optionsJson: null, validationMin: 1, validationMax: 5, validationInteger: true };
    for (const valueNumber of [0, 6, 1.5]) {
      expect(checkSubmission([number], normalizeAnswers([number], [{ questionId: "scaled", valueNumber }])).ok).toBe(false);
    }
    expect(checkSubmission([number], normalizeAnswers([number], [{ questionId: "scaled", valueNumber: 3 }]))).toEqual({ ok: true });
  });

  it("任意の選択肢でも未知のvalueは断り、複数選択も所属を確認する", () => {
    for (const questionType of ["single", "multi"]) {
      const question = { ...full, questionType, required: false };
      expect(checkSubmission([question], normalizeAnswers([question], [{ questionId: "scaled", valueChoices: ["unknown"] }])).ok).toBe(false);
    }
  });
});

describe("missingRequired（答えていない必須の設問）", () => {
  it("必須の設問だけを、画面の上から下の順に返す（保存した順ではない。任意の設問は入れない）", () => {
    expect(missingRequired(questions, () => false).map((x) => x.id)).toEqual(["count", "rate", "pick"]);
  });

  it("答えたかどうかは渡された見方で決め、元の配列は並べ替えない", () => {
    const before = questions.map((x) => x.id);
    expect(missingRequired(questions, (x) => x.id === "count").map((x) => x.id)).toEqual(["rate", "pick"]);
    expect(missingRequired(questions, () => true)).toEqual([]);
    expect(questions.map((x) => x.id)).toEqual(before);
  });

  it("提出の検査の未入力の断りは、missingRequired が拾った設問から作る（件数も「例：」も同じ）", () => {
    const sent = normalizeAnswers(questions, [{ questionId: "rate", valueNumber: 40 }, { questionId: "pick", valueChoices: [] }]);
    const answered = new Set(sent.filter((a) => isAnswered(a.question.questionType, a)).map((a) => a.question.id));
    const result = checkSubmission(questions, sent);
    expect(result).toEqual({ ok: false, message: missingAnswersMessage(missingRequired(questions, (x) => answered.has(x.id))) });
    expect(result.ok ? "" : result.message).toBe("未入力の項目が2件あります（例：件数の設問）。入力してから提出してください。");
  });
});

describe("checkSubmission（提出してよいか）", () => {
  const all = [
    { questionId: "count", valueNumber: 3 },
    { questionId: "rate", valueNumber: 40 },
    { questionId: "pick", valueChoices: ["甲"] },
  ];

  it("必須がすべて埋まり、数が範囲に入っていれば通す（任意の設問は空でよい）", () => {
    expect(check(all)).toEqual({ ok: true });
  });

  it("必須の漏れは、画面の上から最初の欄を例に挙げる（保存した順ではない）", () => {
    const result = check([{ questionId: "rate", valueNumber: 40 }]);
    expect(result).toEqual({ ok: false, message: missingAnswersMessage([count, pick]) });
    expect(result.ok ? "" : result.message).toBe("未入力の項目が2件あります（例：件数の設問）。入力してから提出してください。");
  });

  it("複数選択は、選んだ選択肢が無ければ答えていない扱いにする", () => {
    const result = check([...all.slice(0, 2), { questionId: "pick", valueChoices: [] }]);
    expect(result.ok ? "" : result.message).toContain("（例：選ぶ設問）");
  });

  it("数の範囲は必須より先に見る（範囲を外れた数があれば、未入力より先にそれを言う）", () => {
    const result = check([{ questionId: "count", valueNumber: 1.5 }]);
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.message).toContain("「件数の設問」は小数のない数字（整数）で入力してください（単位は「件」）");
  });

  it("範囲を外れた数が2つあるときは、送られた順ではなく画面の上の欄を挙げる", () => {
    const result = check([
      { questionId: "rate", valueNumber: 120 },
      { questionId: "count", valueNumber: -1 },
      { questionId: "pick", valueChoices: ["甲"] },
    ]);
    expect(result.ok ? "" : result.message).toContain("「件数の設問」");
    expect(result.ok ? "" : result.message).not.toContain("「割合の設問」");
  });
});

describe("提出の検査を1か所で持つ", () => {
  const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

  it("保存の受け口と、管理者の試しの回答が、同じ checkSubmission を使う", () => {
    // 片方が自前の検査を持つと、試しで「通った」答えが本物の提出で断られる
    const action = read("src/actions/responses.ts");
    expect(action).toContain("checkSubmission(");
    expect(action).not.toContain("checkAnswerNumbers(");
    const answer = read("src/components/FormAnswer.tsx");
    expect(answer).toMatch(/checkSubmission\(questions, normalizeAnswers\(questions, answersToSend\(/);
    // 未入力の知らせの文も同じ1つから作る（画面と受け口で文が食い違わない）
    expect(answer).toContain("missingAnswersMessage(missing)");
    expect(answer).not.toContain("未入力の項目が${");
  });

  it("必須の未入力は、回答画面と提出の検査が同じ missingRequired で拾う", () => {
    // 別々に拾うと、確認の欄の知らせと受け口の断りで件数や「例：」が食い違う。
    // 回答画面は2つの文が同じになることを当てにして、同じ文を2つ出さないようにしている（submitError !== missingNote）
    const answer = stripComments(read("src/components/FormAnswer.tsx"));
    expect(answer).toContain("const missing = missingRequired(questions, ");
    expect(answer).not.toContain("q.required && !isAnswered(");
    // 画面の順に並べるのも missingRequired の中だけ（回答画面で自前に並べ直さない）
    expect(answer).not.toContain("inScreenOrder(");
    const lib = stripComments(read("src/lib/submission-check.ts"));
    const check = lib.slice(lib.indexOf("export function checkSubmission"));
    expect(check).toContain("const missing = missingRequired(questions, ");
    // 必須かどうかを見る式は missingRequired の1か所だけ。受け口は checkSubmission に任せて自分では見ない
    expect(lib.match(/\.required\b/g)).toHaveLength(1);
    expect(stripComments(read("src/actions/responses.ts"))).not.toMatch(/\.required\b/);
  });
});
