import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany, seedResponse } from "@/test-support/evaluation-fixture";
import { responseWithAnswersStatements, saveResponseWithAnswers } from "@/lib/response-write";
import { chunkRowsForD1 } from "@/lib/db";

let current: TestDatabase;

beforeEach(() => {
  current = createTestDatabase();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  current.close();
});

describe("回答本文の原子的な置き換え", () => {
  async function prepareDraft() {
    await seedCompany(current);
    const id = await seedResponse(current, [{
      id: "fq_race", section: "kpi", questionType: "number",
      title: "競合の確認", displayOrder: 1, answer: 10,
    }], { status: "draft" });
    const [response] = await current.db.select().from(s.formResponses).where(eq(s.formResponses.id, id));
    return response;
  }

  const answersFor = (responseId: string, valueNumber: number) => [{
    id: `fa_race_${valueNumber}`, companyId: IDS.company, responseId,
    questionId: "fq_race", valueNumber, questionTitle: "保存時の設問文",
  }];

  async function snapshot(responseId: string) {
    return {
      responses: await current.db.select().from(s.formResponses).where(eq(s.formResponses.id, responseId)),
      answers: await current.db.select().from(s.formAnswers).where(eq(s.formAnswers.responseId, responseId)),
    };
  }

  it("同じdraftを読んだ提出と遅延下書きが競合しても、提出後の親も子も変更しない", async () => {
    const draft = await prepareDraft();
    const submitted = { ...draft, status: "submitted", respondentNote: "提出した本文", submittedAt: new Date("2026-10-01T00:00:00Z") };
    const outcomes = await Promise.allSettled([
      saveResponseWithAnswers(current.db, submitted, answersFor(draft.id, 20), true),
      saveResponseWithAnswers(current.db, { ...draft, respondentNote: "遅延した本文" }, answersFor(draft.id, 30), true),
    ]);
    expect(outcomes[0].status).toBe("fulfilled");
    expect(outcomes[1]).toMatchObject({ status: "rejected", reason: { status: 409 } });
    const before = await snapshot(draft.id);
    expect(before.responses[0]).toMatchObject({ status: "submitted", respondentNote: "提出した本文", submittedAt: submitted.submittedAt });
    expect(before.answers).toHaveLength(1);
    expect(before.answers[0]).toMatchObject({ id: "fa_race_20", valueNumber: 20, questionTitle: "保存時の設問文" });

    // 無効な子行でも、提出後はINSERTを試みず競合として断る。
    await expect(saveResponseWithAnswers(current.db, draft, [{
      ...answersFor(draft.id, 40)[0], questionId: "fq_missing",
    }], true)).rejects.toMatchObject({ status: 409 });
    expect(await snapshot(draft.id)).toEqual(before);
  });

  it("下書きが先に保存されても、後続の提出を受け付け提出内容を残す", async () => {
    const draft = await prepareDraft();
    await saveResponseWithAnswers(current.db, draft, answersFor(draft.id, 20), true);
    await saveResponseWithAnswers(current.db, { ...draft, status: "submitted" }, answersFor(draft.id, 30), true);
    const saved = await snapshot(draft.id);
    expect(saved.responses[0].status).toBe("submitted");
    expect(saved.answers).toHaveLength(1);
    expect(saved.answers[0].valueNumber).toBe(30);
  });

  it("CSV取込用のstatementは提出済みを意図的に上書きできる", async () => {
    const draft = await prepareDraft();
    const submitted = { ...draft, status: "submitted" };
    await saveResponseWithAnswers(current.db, submitted, answersFor(draft.id, 20), true);
    await current.db.batch(responseWithAnswersStatements(current.db, {
      ...submitted, importSource: "csv", respondentNote: "取込で修正",
    }, answersFor(draft.id, 30), true));
    const saved = await snapshot(draft.id);
    expect(saved.responses[0]).toMatchObject({ status: "submitted", importSource: "csv", respondentNote: "取込で修正" });
    expect(saved.answers).toHaveLength(1);
    expect(saved.answers[0].valueNumber).toBe(30);
  });

  it("500設問をchunkにまとめ、各SQLのbindが99個以内で全件保存する", async () => {
    const draft = await prepareDraft();
    const questions = Array.from({ length: 500 }, (_, i) => ({
      id: `fq_many_${i}`, companyId: IDS.company, formId: IDS.form,
      section: "kpi", questionType: "number", title: `設問${i}`, displayOrder: i,
    }));
    for (const rows of chunkRowsForD1(questions)) await current.db.insert(s.formQuestions).values(rows);
    const answers = questions.map((q, i) => ({
      id: `fa_many_${i}`, companyId: IDS.company, responseId: draft.id,
      questionId: q.id, valueNumber: i,
    }));
    const batch = vi.spyOn(current.db, "batch");
    await saveResponseWithAnswers(current.db, draft, answers, true);
    const statements = batch.mock.calls[0][0];
    expect(statements).toHaveLength(102); // 5行×100 INSERT + DELETE + UPDATE
    for (const statement of statements) {
      const query = (statement as unknown as { toSQL(): { params: unknown[] } }).toSQL();
      expect(query.params.length).toBeLessThanOrEqual(99);
    }
    const saved = await snapshot(draft.id);
    expect(saved.answers).toHaveLength(500);
    expect(saved.answers.map((a) => a.valueNumber).sort((a, b) => a! - b!)).toEqual(answers.map((a) => a.valueNumber));
    const invalid = answers.map((answer, i) => ({
      ...answer, valueNumber: -i, questionId: i === 499 ? "fq_missing" : answer.questionId,
    }));
    await expect(saveResponseWithAnswers(current.db, { ...draft, status: "submitted" }, invalid, true)).rejects.toThrow();
    expect(await snapshot(draft.id)).toEqual(saved);
  });

  it("INSERT SELECTは通常のvalues保存と同じ数値・NULL・JSON・日付・defaultを保存する", async () => {
    const draft = await prepareDraft();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T12:34:56.789Z"));
    const row = {
      ...answersFor(draft.id, 12.5)[0], valueText: "日本語と'引用'", valueJson: JSON.stringify(["選択肢", "😀"]),
      questionType: "multi", questionSection: "kpi", questionUnit: null,
      questionOptionsJson: JSON.stringify([{ value: "選択肢", label: "表示" }]),
      questionDisplayOrder: 0, createdAt: new Date("2026-09-01T00:00:00.123Z"),
    };
    for (const answer of [row, { ...answersFor(draft.id, 0)[0], valueNumber: null, valueText: null }]) {
      await current.db.batch(responseWithAnswersStatements(current.db, draft, [answer], true));
      const expected = await snapshot(draft.id);
      await saveResponseWithAnswers(current.db, draft, [answer], true);
      expect(await snapshot(draft.id)).toEqual(expected);
      expect(expected.answers[0].updatedAt).toEqual(new Date());
    }
  });

  it("初回同時作成の一意衝突は後続batch全体をrollbackし、先の親と子を保持する", async () => {
    const draft = await prepareDraft();
    await current.db.delete(s.formResponses).where(eq(s.formResponses.id, draft.id));
    const first = { ...draft, id: "res_first", status: "submitted", respondentNote: "先の提出" };
    const second = { ...draft, id: "res_second", respondentNote: "遅延下書き" };
    const results = await Promise.allSettled([
      saveResponseWithAnswers(current.db, first, answersFor(first.id, 20), false),
      saveResponseWithAnswers(current.db, second, answersFor(second.id, 30), false),
    ]);
    expect(results[0].status).toBe("fulfilled");
    expect(results[1].status).toBe("rejected");
    const saved = await snapshot(first.id);
    expect(saved.responses[0]).toMatchObject({ status: "submitted", respondentNote: "先の提出" });
    expect(saved.answers).toHaveLength(1);
    expect(saved.answers[0].valueNumber).toBe(20);
    expect(await snapshot(second.id)).toEqual({ responses: [], answers: [] });
  });

  it("新しい回答行が1件でも失敗したら、状態と古い本文をどちらも保持する", async () => {
    await seedCompany(current);
    const responseId = await seedResponse(current, [
      {
        id: "fq_atomic",
        section: "kpi",
        questionType: "number",
        title: "原子性の確認",
        displayOrder: 1,
        answer: 10,
      },
    ], { status: "draft" });
    const [before] = await current.db.select().from(s.formResponses).where(eq(s.formResponses.id, responseId));

    await expect(
      saveResponseWithAnswers(
        current.db,
        {
          id: responseId,
          companyId: IDS.company,
          formId: IDS.form,
          cycleId: IDS.cycle,
          employeeId: IDS.employee,
          gradeId: IDS.gradeFrom,
          status: "submitted",
          submittedAt: new Date("2026-10-01T00:00:00Z"),
        },
        [
          {
            id: "fa_invalid",
            companyId: IDS.company,
            responseId,
            questionId: "fq_missing",
            valueNumber: 99,
          },
        ],
        true,
      ),
    ).rejects.toThrow();

    const [response] = await current.db.select().from(s.formResponses).where(eq(s.formResponses.id, responseId));
    const answers = await current.db.select().from(s.formAnswers).where(eq(s.formAnswers.responseId, responseId));
    expect(response.status).toBe("draft");
    expect(response.submittedAt?.getTime()).toBe(before.submittedAt?.getTime());
    expect(answers).toHaveLength(1);
    expect(answers[0].questionId).toBe("fq_atomic");
    expect(answers[0].valueNumber).toBe(10);
  });
});
