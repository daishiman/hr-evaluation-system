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
