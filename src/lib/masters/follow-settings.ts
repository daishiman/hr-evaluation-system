import { and, eq, ne } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import { batchAll } from "@/lib/db-batch";
import { newId } from "@/lib/id";
import { buildEvaluationsForCycle } from "@/lib/evaluate";
import { buildQuestionRows, prepareFormDraft, questionInsertStatements, syncFormQuestions, type Db } from "@/lib/form-build";
import { FINALIZED_SKIP_MESSAGE } from "@/lib/domain/build-summary";
import { linkedQuestionsMatch, questionsKeptOnRebuild } from "@/lib/domain/form-sync";
import { answeredFormIds, compareFormCandidates, displayName, formCandidates, reasonOf, type FormRow } from "@/lib/form-sync-read";
import {
  followFormName,
  followMessage,
  followTargetsOf,
  type FollowFailure,
  type FollowKind,
} from "@/lib/domain/settings-follow";

/**
 * 設定を保存したあと、締め切っていないアンケートと確定前の評価を、いまの設定に追従させる（DD-028 の4）。
 *
 * 呼ぶのは設定の batch を書き終えた後。追従が途中で失敗しても設定の保存は戻さず、
 * 失敗したものを結果の文に出す（漏れは、下書きをそろえる操作とずれの警告で拾える）。
 * どのアンケートも1つずつ別の batch で書くので、1つの失敗で残りを止めない。
 *
 * - 回答の無い下書き: 設定から作る設問がいまの設定と違うときだけ作り直す。手で足した設問は残す
 * - 回答のある公開中: 同じ期・等級にもっと新しい版が無ければ、次の版の下書きを作る。手で足した設問も写す。
 *   新しい版がすでにあれば何もしない（その版が回答の無い下書きなら、それを作り直す）
 * - 回答のある下書き・回答の無い公開中・締め切ったアンケート・締め切った期: 変えない
 * - 確定前の評価: 判定に効く設定のときだけ、期ごとに集計し直す。上司のコメントと判断、集計した上司は残す
 *
 * kinds は制度マスタの kind（MasterUpdateBody["kind"]）か "scheme"。制度マスタに kind を足したら、
 * FOLLOW_TARGETS に追従先を足すまで呼び出し側の型が通らない。
 */
export async function followSettings(
  db: Db,
  args: {
    companyId: string;
    actorId: string;
    kinds: readonly FollowKind[];
    /** アンケートからの反映で保存したそのアンケート。設定に無い欄（必須・単位など）の編集を作り直しで消さない */
    skipFormIds?: readonly string[];
  },
): Promise<string> {
  const targets = followTargetsOf(args.kinds);
  const forms = targets.forms ? await followForms(db, args) : { rebuilt: [], nextVersions: [], failures: [] };
  const evaluations = targets.evaluations ? await followEvaluations(db, args) : { names: [], failures: [] };
  return followMessage({
    rebuilt: forms.rebuilt,
    nextVersions: forms.nextVersions,
    evaluations: evaluations.names,
    formFailures: forms.failures,
    evaluationFailures: evaluations.failures,
  });
}

async function followForms(
  db: Db,
  args: { companyId: string; skipFormIds?: readonly string[] },
): Promise<{ rebuilt: string[]; nextVersions: string[]; failures: FollowFailure[] }> {
  const { companyId } = args;
  const rebuilt: string[] = [];
  const nextVersions: string[] = [];
  const failures: FollowFailure[] = [];

  let rows, answered, siblings;
  try {
    // 候補・回答・兄弟版のどの読取が失敗しても、設定保存済みの結果と評価追従は残す。
    [rows, answered, siblings] = await Promise.all([
      formCandidates(db, companyId),
      answeredFormIds(db, companyId),
      // 同じ期・等級の版は、締め切ったものも含めて見る。
      db.select({ cycleId: s.forms.cycleId, gradeId: s.forms.gradeId, version: s.forms.version })
        .from(s.forms).where(eq(s.forms.companyId, companyId)),
    ]);
  } catch (error) {
    return { rebuilt, nextVersions, failures: [{ name: null, reason: reasonOf(error) }] };
  }
  const skip = new Set(args.skipFormIds ?? []);
  const ordered = rows.sort(compareFormCandidates);

  for (const row of ordered) {
    const { form } = row;
    if (skip.has(form.id)) continue;
    const name = followFormName(displayName(row), form.version);
    const hasResponses = answered.has(form.id);
    try {
      if (form.status === "draft" && !hasResponses) {
        if (await linkedMatches(db, companyId, form)) continue;
        await syncFormQuestions({ companyId, formId: form.id, db });
        rebuilt.push(name);
      } else if (form.status === "published" && hasResponses) {
        const newer = siblings.some((f) => f.cycleId === form.cycleId && f.gradeId === form.gradeId && f.version > form.version);
        if (newer || (await linkedMatches(db, companyId, form))) continue;
        const version = await draftNextVersion(db, companyId, form);
        nextVersions.push(followFormName(displayName(row), version));
      }
    } catch (error) {
      failures.push({ name, reason: reasonOf(error) });
    }
  }
  return { rebuilt, nextVersions, failures };
}

/** 設定から作る設問が、いまの設定から作り直したものと同じか */
async function linkedMatches(db: Db, companyId: string, form: FormRow): Promise<boolean> {
  const [current, rebuiltRows] = await Promise.all([
    db.select().from(s.formQuestions).where(eq(s.formQuestions.formId, form.id)),
    buildQuestionRows({ companyId, cycleId: form.cycleId, gradeId: form.gradeId, formId: form.id, db }),
  ]);
  return linkedQuestionsMatch(current, rebuiltRows);
}

/** 公開中の版から次の版の下書きを作り、手で足した設問を写す。版の番号を返す */
async function draftNextVersion(db: Db, companyId: string, form: FormRow): Promise<number> {
  const prepared = await prepareFormDraft(db, {
    companyId,
    cycleId: form.cycleId,
    gradeId: form.gradeId,
    title: form.title ?? undefined,
  });
  const before = await db.select().from(s.formQuestions).where(eq(s.formQuestions.formId, form.id));
  const kept = questionsKeptOnRebuild(before, prepared.result.questionCount + 1).map(
    ({ createdAt: _createdAt, updatedAt: _updatedAt, ...q }) => ({ ...q, id: newId("fq"), formId: prepared.result.formId }),
  );
  await batchAll(db, [...prepared.statements, ...questionInsertStatements(db, kept)]);
  return prepared.result.version;
}

async function followEvaluations(
  db: Db,
  args: { companyId: string; actorId: string },
): Promise<{ names: string[]; failures: FollowFailure[] }> {
  const { companyId, actorId } = args;
  const names: string[] = [];
  const failures: FollowFailure[] = [];

  let open;
  try {
    open = await db
      .select({ cycleId: s.evaluations.cycleId, employeeId: s.evaluations.employeeId, periodStart: s.evaluationCycles.periodStart })
      .from(s.evaluations)
      .innerJoin(s.evaluationCycles, eq(s.evaluationCycles.id, s.evaluations.cycleId))
      .where(and(eq(s.evaluations.companyId, companyId), ne(s.evaluations.status, "finalized")));
  } catch (error) {
    return { names, failures: [{ name: null, reason: reasonOf(error) }] };
  }

  const byCycle = new Map<string, { periodStart: string; employeeIds: string[] }>();
  for (const row of open) {
    const cycle = byCycle.get(row.cycleId) ?? { periodStart: row.periodStart, employeeIds: [] };
    cycle.employeeIds.push(row.employeeId);
    byCycle.set(row.cycleId, cycle);
  }

  const cycles = [...byCycle.entries()].sort((a, b) => a[1].periodStart.localeCompare(b[1].periodStart));
  for (const [cycleId, { employeeIds }] of cycles) {
    try {
      const results = await buildEvaluationsForCycle(companyId, cycleId, actorId, { employeeIds, keepEvaluator: true });
      for (const r of results) {
        if (r.ok) names.push(r.employeeName);
        else if (r.message !== FINALIZED_SKIP_MESSAGE) failures.push({ name: r.employeeName, reason: r.message.replace(/。$/, "") });
      }
    } catch (error) {
      failures.push({ name: null, reason: reasonOf(error) });
    }
  }
  return { names, failures };
}
