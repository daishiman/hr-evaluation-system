import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany, seedResponse } from "@/test-support/evaluation-fixture";
import { saveResponseWithAnswers } from "@/lib/response-write";

let current: TestDatabase;

beforeEach(() => {
  current = createTestDatabase();
});

afterEach(() => current.close());

describe("回答本文の原子的な置き換え", () => {
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
