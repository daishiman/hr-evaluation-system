import { and, asc, eq, inArray } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import { HttpError } from "@/lib/session";
import { buildQuestionRows, syncFormQuestions, type Db } from "@/lib/form-build";
import { linkedQuestionsMatch } from "@/lib/domain/form-sync";
import { resolveSchemeForCycle } from "@/lib/domain/scheme-resolution";
import { followFormName } from "@/lib/domain/settings-follow";
import {
  ALIGN_CONFLICT,
  alignDirection,
  alignPlanKey,
  alignPreviewMessage,
  alignResultMessage,
  matchToSettings,
  unmatchedQuestionReason,
  type AlignDirection,
} from "@/lib/domain/form-align";
import { answeredFormIds, compareFormCandidates, displayName, formCandidates, reasonOf, type FormCandidate, type FormRow } from "@/lib/form-sync-read";
import { planFormToSettings, writeFormToSettings, type FormSettingsPlan } from "@/lib/masters/form-to-settings";

/**
 * 設定とずれた回答の無い下書きのアンケートを、まとめてそろえる（DD-028 の6・I30）。
 *
 * 下書きの設問を保存した時刻（設問の行の更新時刻の最大）と、その下書きの設問のもとになる設定の行の更新時刻を比べ、
 * 新しい方を正とする。下書きの締切・題・状態の直しは設問の行を書かないので、比べる時刻に入れない。
 * - 設定が新しい: 下書きを設定から作り直す（設定の保存の後の追従 I29 と同じ syncFormQuestions）
 * - 下書きが新しい: 紐づいた設問の文の直しと外しを設定へ写す（アンケートの保存 I28 と同じ writeFormToSettings）
 *
 * dryRun は何も書かずに一覧と印（planKey）を返す。本流しは、印が内容を見たときと同じときだけ書く。
 * 対象は回答の無い下書きで、期もアンケートも締め切っていないものだけ。会社の境界は companyId で閉じる。
 * 1つずつ別の batch で書くので、1つの失敗で残りを止めない（失敗は「そろえられなかった」に数える）。
 */
export interface AlignItem {
  formId: string;
  direction: AlignDirection;
  title: string;
}

export interface AlignFailedItem {
  formId: string;
  title: string;
  /** 直す画面の場所。設定の決まりで断ったときはその設定の画面、それ以外はアンケートの画面 */
  fixHref: string;
  reason: string;
}

export interface AlignOutcome {
  items: AlignItem[];
  failed: AlignFailedItem[];
  planKey: string;
  message: string;
}

type Target = FormCandidate;
type QuestionRow = typeof s.formQuestions.$inferInsert;

type Analysis = { questionsAt: number | null; settingsAt: number | null } & (
  | { outcome: "aligned" | "toForm" }
  | { outcome: "toSettings"; plan: FormSettingsPlan; rows: QuestionRow[] }
  | { outcome: "failed"; fixHref: string; reason: string }
);

export async function alignDraftForms(
  db: Db,
  args: { companyId: string; dryRun: boolean; actorId: string; expectedPlanKey?: string },
): Promise<AlignOutcome> {
  const { companyId, actorId } = args;
  const targets = await draftTargets(db, companyId);
  const analyzed: { target: Target; analysis: Analysis }[] = [];
  for (const target of targets) analyzed.push({ target, analysis: await analyze(db, { companyId, actorId }, target) });

  const listed = analyzed.filter(({ analysis }) => analysis.outcome !== "aligned");
  const planKey = alignPlanKey(
    listed.map(({ target, analysis }) => ({
      formId: target.form.id,
      outcome: analysis.outcome as AlignDirection | "failed",
      questionsAt: analysis.questionsAt,
      settingsAt: analysis.settingsAt,
    })),
  );
  const failedOf = (target: Target, a: { fixHref: string; reason: string }): AlignFailedItem => ({
    formId: target.form.id,
    title: titleOf(target),
    fixHref: a.fixHref,
    reason: a.reason,
  });
  const failed = listed.flatMap(({ target, analysis }) => (analysis.outcome === "failed" ? [failedOf(target, analysis)] : []));

  if (args.dryRun) {
    const items = listed.flatMap(({ target, analysis }) =>
      analysis.outcome === "toForm" || analysis.outcome === "toSettings"
        ? [{ formId: target.form.id, direction: analysis.outcome, title: titleOf(target) }]
        : [],
    );
    return { items, failed, planKey, message: alignPreviewMessage(items.length, failed.length) };
  }
  if (args.expectedPlanKey !== undefined && args.expectedPlanKey !== planKey) throw new HttpError(409, ALIGN_CONFLICT);

  /*
   * 設定へ写す下書きを先に、新しい順に書く。前の下書きを写すと設定の時刻が進むので、
   * 同じ設定の行を使う古い下書きは、直前に見直すと作り直しの側に回る（最新の下書きが正）。
   * 写した後の追従では、まだ書いていない下書きと、そろえられなかった下書きを作り直さない。
   */
  const queue = [
    ...listed
      .filter(({ analysis }) => analysis.outcome === "toSettings")
      .sort((a, b) => (b.analysis.questionsAt ?? 0) - (a.analysis.questionsAt ?? 0)),
    ...listed.filter(({ analysis }) => analysis.outcome === "toForm"),
  ].map(({ target }) => target);
  const failedIds = new Set(failed.map((f) => f.formId));
  const recordFailure = (target: Target, failure: { fixHref: string; reason: string }) => {
    failed.push(failedOf(target, failure));
    failedIds.add(target.form.id);
  };
  const items: AlignItem[] = [];
  const follows: string[] = [];
  for (const [n, target] of queue.entries()) {
    const { form } = target;
    const title = titleOf(target);
    const analysis = await analyze(db, { companyId, actorId }, target);
    try {
      if (analysis.outcome === "toSettings") {
        const skipFormIds = [...queue.slice(n + 1).map((t) => t.form.id), ...failedIds];
        follows.push(
          await writeFormToSettings({ db, companyId, actorId, formId: form.id, plan: analysis.plan, rows: analysis.rows, skipFormIds }),
        );
        items.push({ formId: form.id, direction: "toSettings", title });
      } else if (analysis.outcome === "toForm") {
        await syncFormQuestions({ companyId, formId: form.id, db });
        items.push({ formId: form.id, direction: "toForm", title });
      } else if (analysis.outcome === "failed") {
        recordFailure(target, analysis);
      }
    } catch (error) {
      recordFailure(target, { fixHref: fixHrefOf(error, form.id), reason: reasonOf(error) });
    }
  }
  const namesOf = (direction: AlignDirection) => items.filter((i) => i.direction === direction).map((i) => i.title);
  const message = alignResultMessage({
    toSettings: namesOf("toSettings"),
    toForm: namesOf("toForm"),
    failures: failed.map((f) => ({ name: f.title, reason: f.reason })),
    follow: follows.join(""),
  });
  return { items, failed, planKey, message };
}

/** 回答の無い下書きで、期が締め切っていないもの。並びは追従（followForms）と同じ */
async function draftTargets(db: Db, companyId: string): Promise<Target[]> {
  const [rows, answered] = await Promise.all([formCandidates(db, companyId), answeredFormIds(db, companyId)]);
  return rows.filter((row) => row.form.status === "draft" && !answered.has(row.form.id)).sort(compareFormCandidates);
}

const titleOf = (target: Target) => followFormName(displayName(target), target.form.version);
const formPathOf = (formId: string) => `/admin/forms/${formId}`;
const fixHrefOf = (error: unknown, formId: string) =>
  (error instanceof HttpError && error.fixHref) || formPathOf(formId);

/** 1つの下書きを、いまの設定と比べてどうそろえるかを決める。書き込みはしない */
async function analyze(db: Db, args: { companyId: string; actorId: string }, target: Target): Promise<Analysis> {
  const { companyId, actorId } = args;
  const { form, cycle } = target;
  let questionsAt: number | null = null;
  let settingsAt: number | null = null;
  try {
    const [current, rebuilt] = await Promise.all([
      db
        .select()
        .from(s.formQuestions)
        .where(and(eq(s.formQuestions.companyId, companyId), eq(s.formQuestions.formId, form.id)))
        .orderBy(asc(s.formQuestions.displayOrder)),
      buildQuestionRows({ companyId, cycleId: form.cycleId, gradeId: form.gradeId, formId: form.id, db }),
    ]);
    // 設問の保存は全ての行を入れ直すので、行の更新時刻の最大が最後に設問を保存した時刻になる
    questionsAt = current.reduce((max, q) => Math.max(max, q.updatedAt.getTime()), 0);
    settingsAt = await settingsUpdatedAt(db, companyId, form, cycle);
    if (linkedQuestionsMatch(current, rebuilt)) return { outcome: "aligned", questionsAt, settingsAt };
    if (alignDirection({ settingsAt, questionsAt, questionCount: current.length }) === "toForm") {
      return { outcome: "toForm", questionsAt, settingsAt };
    }
    const match = matchToSettings(current, rebuilt);
    if (!match.ok) {
      return { outcome: "failed", questionsAt, settingsAt, fixHref: formPathOf(form.id), reason: unmatchedQuestionReason(match.title) };
    }
    const plan = await planFormToSettings({ db, companyId, actorId, form, ...match });
    // 写す文が無い（紐づけだけが違うなど）ときは、設定を変えずにそろっている扱いにする
    if (plan.statements.length === 0) return { outcome: "aligned", questionsAt, settingsAt };
    const rows = current.map(({ createdAt: _createdAt, updatedAt: _updatedAt, ...q }, i) => ({ ...q, ...(plan.relinked.get(i) ?? {}) }));
    return { outcome: "toSettings", questionsAt, settingsAt, plan, rows };
  } catch (error) {
    return { outcome: "failed", questionsAt, settingsAt, fixHref: fixHrefOf(error, form.id), reason: reasonOf(error) };
  }
}

/**
 * 下書きの設問のもとになる設定の行の、更新時刻の最大（ms）。読む範囲は buildQuestionRows と同じで、
 * 使わなくした行（外した要件・指針）も数える。評価セットから外した項目は行が消えるが、評価セットの時刻が進む。
 * 行動指針の段階も、設問の選択肢を作る入力なので時刻に含める。
 */
async function settingsUpdatedAt(db: Db, companyId: string, form: FormRow, cycle: { schemeId: string | null }): Promise<number> {
  const [grade] = await db
    .select()
    .from(s.grades)
    .where(and(eq(s.grades.id, form.gradeId), eq(s.grades.companyId, companyId)))
    .limit(1);
  if (!grade) throw new HttpError(404, "等級が見つかりませんでした。");
  const [gradeReqs, promoReqs, guidelines, schemes] = await Promise.all([
    db
      .select({ updatedAt: s.gradeRequirements.updatedAt })
      .from(s.gradeRequirements)
      .where(and(eq(s.gradeRequirements.companyId, companyId), eq(s.gradeRequirements.gradeId, grade.id))),
    db
      .select({ updatedAt: s.promotionRequirements.updatedAt })
      .from(s.promotionRequirements)
      .where(and(eq(s.promotionRequirements.companyId, companyId), eq(s.promotionRequirements.gradeId, grade.id))),
    grade.behaviorBand
      ? db
          .select({ id: s.behaviorGuidelines.id, isActive: s.behaviorGuidelines.isActive, updatedAt: s.behaviorGuidelines.updatedAt })
          .from(s.behaviorGuidelines)
          .where(and(eq(s.behaviorGuidelines.companyId, companyId), eq(s.behaviorGuidelines.band, grade.behaviorBand)))
      : Promise.resolve([]),
    db
      .select({ id: s.evaluationSchemes.id, status: s.evaluationSchemes.status, updatedAt: s.evaluationSchemes.updatedAt })
      .from(s.evaluationSchemes)
      .where(eq(s.evaluationSchemes.companyId, companyId)),
  ]);
  const guidelineIds = guidelines.filter((g) => g.isActive).map((g) => g.id);
  const levels = guidelineIds.length
    ? await db
        .select({ updatedAt: s.behaviorLevels.updatedAt })
        .from(s.behaviorLevels)
        .where(and(eq(s.behaviorLevels.companyId, companyId), inArray(s.behaviorLevels.guidelineId, guidelineIds)))
    : [];
  const scheme = resolveSchemeForCycle(cycle, schemes);
  const items = scheme
    ? await db
        .select({ kpiItemId: s.schemeItems.kpiItemId, updatedAt: s.schemeItems.updatedAt })
        .from(s.schemeItems)
        .where(and(eq(s.schemeItems.schemeId, scheme.id), eq(s.schemeItems.pointGroup, grade.pointGroup)))
    : [];
  const kpiIds = [...new Set(items.map((i) => i.kpiItemId))];
  const [kpiItems, kpiQuestions] = kpiIds.length
    ? await Promise.all([
        db
          .select({ updatedAt: s.kpiItems.updatedAt })
          .from(s.kpiItems)
          .where(and(eq(s.kpiItems.companyId, companyId), inArray(s.kpiItems.id, kpiIds))),
        db
          .select({ updatedAt: s.kpiQuestions.updatedAt })
          .from(s.kpiQuestions)
          .where(and(eq(s.kpiQuestions.companyId, companyId), inArray(s.kpiQuestions.kpiItemId, kpiIds))),
      ])
    : [[], []];
  const rows = [grade, ...gradeReqs, ...promoReqs, ...guidelines, ...levels, ...(scheme ? [scheme] : []), ...items, ...kpiItems, ...kpiQuestions];
  return rows.reduce((max, r) => Math.max(max, r.updatedAt.getTime()), 0);
}
