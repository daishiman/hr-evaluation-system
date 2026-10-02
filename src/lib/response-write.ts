import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { chunkRowsForD1, type DB, schema as s } from "@/lib/db";
import { HttpError } from "@/lib/session";

/** 回答の状態行と全回答本文を、削除をまたいでも原子的に置き換える。 */
export async function saveResponseWithAnswers(
  db: DB,
  response: typeof s.formResponses.$inferInsert,
  answerRows: (typeof s.formAnswers.$inferInsert)[],
  exists: boolean,
): Promise<void> {
  if (!exists) {
    await db.batch(responseWithAnswersStatements(db, response, answerRows, false));
    return;
  }

  const editable = and(
    eq(s.formResponses.id, response.id),
    eq(s.formResponses.companyId, response.companyId),
    eq(s.formResponses.employeeId, response.employeeId),
    eq(s.formResponses.status, "draft"),
  );
  const canWrite = sql`exists (${db.select({ id: s.formResponses.id }).from(s.formResponses).where(editable).getSQL()})`;
  // 子行を先に置き換え、最後に状態を変える。全SQLが同じbatch内でdraftを
  // 確認するため、提出に先を越された保存は親も子も変更しない。
  const columns = Object.entries(getTableColumns(s.formAnswers));
  const normalizedRows = answerRows.map((row) => Object.fromEntries(columns.map(([key, column]) => {
    const value = row[key as keyof typeof row];
    return [key, value === undefined ? (column.defaultFn?.() ?? column.default ?? null) : value];
  })));
  // 全列（defaultを含む）を数えて分割する。chunkRowsForD1の4個の余裕は
  // 外側の会社・本人・id・status確認のbindにも使う（確認はchunkごとに1回）。
  const inserts = chunkRowsForD1(normalizedRows).map((rows) => {
    const selects = rows.map((row) => sql`select ${sql.join(
      columns.map(([key, column]) => sql`${sql.param(row[key], column)}`), sql`, `,
    )}`);
    return db.insert(s.formAnswers).select(sql`select * from (${sql.join(selects, sql` union all `)}) where ${canWrite}`);
  });
  const result = await db.batch([
    db.delete(s.formAnswers).where(and(eq(s.formAnswers.responseId, response.id), canWrite)),
    ...inserts,
    db.update(s.formResponses).set({
      status: response.status,
      respondentNote: response.respondentNote ?? null,
      submittedAt: response.submittedAt ?? null,
      importSource: response.importSource ?? null,
      officeId: response.officeId ?? null,
    }).where(editable).returning({ id: s.formResponses.id }),
  ]);
  if ((result[result.length - 1] as { id: string }[]).length === 0) {
    throw new HttpError(409, "回答はすでに提出済みか変更されています。画面を更新して確認してください。");
  }
}

/** CSV取込の意図的な上書き用。提出済みも置換し、複数人ぶんを同じD1 batchへ束ねる。 */
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
