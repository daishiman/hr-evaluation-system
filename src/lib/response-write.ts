import { eq } from "drizzle-orm";
import { chunkRowsForD1, type DB, schema as s } from "@/lib/db";

/** 回答の状態行と全回答本文を、削除をまたいでも原子的に置き換える。 */
export async function saveResponseWithAnswers(
  db: DB,
  response: typeof s.formResponses.$inferInsert,
  answerRows: (typeof s.formAnswers.$inferInsert)[],
  exists: boolean,
): Promise<void> {
  await db.batch(responseWithAnswersStatements(db, response, answerRows, exists));
}

/** 複数人ぶんを同じD1 batchへ束ねるため、1回答ぶんのstatement列だけを返す。 */
export function responseWithAnswersStatements(
  db: DB,
  response: typeof s.formResponses.$inferInsert,
  answerRows: (typeof s.formAnswers.$inferInsert)[],
  exists: boolean,
): Parameters<DB["batch"]>[0] {
  const responseMutation = exists
    ? db
        .update(s.formResponses)
        .set({
          status: response.status,
          respondentNote: response.respondentNote ?? null,
          submittedAt: response.submittedAt ?? null,
          importSource: response.importSource ?? null,
          officeId: response.officeId ?? null,
        })
        .where(eq(s.formResponses.id, response.id))
    : db.insert(s.formResponses).values(response);

  return [
      responseMutation,
      db.delete(s.formAnswers).where(eq(s.formAnswers.responseId, response.id)),
      ...chunkRowsForD1(answerRows).map((rows) => db.insert(s.formAnswers).values(rows)),
    ] as unknown as Parameters<DB["batch"]>[0];
}
