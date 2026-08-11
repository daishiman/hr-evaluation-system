import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import { toAnswerRows, type AnswerReadRow } from "@/lib/domain/answer-snapshot";
import { judgeFormDeadline, type DeadlineJudgement } from "@/lib/domain/form-deadline";

/**
 * 「自分が答えたアンケート」を読むための問い合わせ。
 *
 * これまで自分のアンケートは users.grade_id（いまの等級）だけで絞っていたため、
 * 昇格して等級が変わると、過去に自分が答えたアンケートが一覧から消え、
 * URLを直接開くこともできなくなっていた。
 * 「これから答えるもの（いまの等級・公開中）」と「過去に自分が答えたもの（回答の実績）」を
 * それぞれ集め、過去のものは回答した当時の版（そのとき回答した forms 行）を開くようにする。
 *
 * 読み取り専用。集計に使う共通の問い合わせ（src/lib/queries.ts）とは別に置く。
 */

export interface MyFormRow {
  formId: string;
  title: string;
  version: number;
  status: string;
  opensAt: string | null;
  closesAt: string | null;
  gradeId: string;
  gradeName: string | null;
  cycleId: string;
  cycleName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  questionCount: number;
  responseId: string | null;
  responseStatus: string | null;
  submittedAt: Date | null;
  /** いまの等級で「これから答える」対象か（過去に答えただけのものは false） */
  isCurrentGrade: boolean;
  deadline: DeadlineJudgement;
  /** 旧版に入力途中の回答が取り残されている場合の、いま回答すべき版 */
  supersededBy: { formId: string; title: string } | null;
}

/**
 * 自分に関わるアンケートを全部集める。
 * 「これから答えるもの」と「過去に答えたもの」の和集合。
 */
export async function listMyForms(companyId: string, employeeId: string, gradeId: string | null): Promise<MyFormRow[]> {
  const db = await getDb();
  const now = new Date();

  // 自分の回答（過去の等級のものも含む）
  const myResponses = await db
    .select({
      id: s.formResponses.id,
      formId: s.formResponses.formId,
      status: s.formResponses.status,
      submittedAt: s.formResponses.submittedAt,
    })
    .from(s.formResponses)
    .where(and(eq(s.formResponses.companyId, companyId), eq(s.formResponses.employeeId, employeeId)));

  const forms = await db
    .select({
      id: s.forms.id,
      title: s.forms.title,
      version: s.forms.version,
      status: s.forms.status,
      opensAt: s.forms.opensAt,
      closesAt: s.forms.closesAt,
      gradeId: s.forms.gradeId,
      cycleId: s.forms.cycleId,
      gradeName: s.grades.name,
      cycleName: s.evaluationCycles.name,
      periodStart: s.evaluationCycles.periodStart,
      periodEnd: s.evaluationCycles.periodEnd,
    })
    .from(s.forms)
    .leftJoin(s.grades, eq(s.grades.id, s.forms.gradeId))
    .leftJoin(s.evaluationCycles, eq(s.evaluationCycles.id, s.forms.cycleId))
    .where(eq(s.forms.companyId, companyId))
    .orderBy(desc(s.evaluationCycles.periodStart), desc(s.forms.version));

  const answeredFormIds = new Set(myResponses.map((r) => r.formId));
  const target = forms.filter(
    (f) => answeredFormIds.has(f.id) || (gradeId !== null && f.gradeId === gradeId && f.status !== "draft"),
  );
  if (target.length === 0) return [];

  const formIds = target.map((f) => f.id);
  const [questionCounts, extensions] = await Promise.all([
    db
      .select({ formId: s.formQuestions.formId, id: s.formQuestions.id })
      .from(s.formQuestions)
      .where(inArray(s.formQuestions.formId, formIds)),
    db
      .select({ formId: s.formDeadlineExtensions.formId, extendedUntil: s.formDeadlineExtensions.extendedUntil })
      .from(s.formDeadlineExtensions)
      .where(
        and(
          eq(s.formDeadlineExtensions.employeeId, employeeId),
          inArray(s.formDeadlineExtensions.formId, formIds),
          isNull(s.formDeadlineExtensions.revokedAt),
        ),
      ),
  ]);

  const countByForm = new Map<string, number>();
  for (const q of questionCounts) countByForm.set(q.formId, (countByForm.get(q.formId) ?? 0) + 1);

  return target.map((f) => {
    const response = myResponses.find((r) => r.formId === f.id) ?? null;
    // 旧版に入力途中の回答が残っている場合、いま答えるべき版を案内する（黙って消さない）
    const supersede =
      response?.status === "draft" && f.status === "closed"
        ? (target.find(
            (x) => x.cycleId === f.cycleId && x.gradeId === f.gradeId && x.status === "published" && x.id !== f.id,
          ) ?? null)
        : null;

    return {
      formId: f.id,
      title: f.title,
      version: f.version,
      status: f.status,
      opensAt: f.opensAt,
      closesAt: f.closesAt,
      gradeId: f.gradeId,
      gradeName: f.gradeName,
      cycleId: f.cycleId,
      cycleName: f.cycleName,
      periodStart: f.periodStart,
      periodEnd: f.periodEnd,
      questionCount: countByForm.get(f.id) ?? 0,
      responseId: response?.id ?? null,
      responseStatus: response?.status ?? null,
      submittedAt: response?.submittedAt ?? null,
      isCurrentGrade: gradeId !== null && f.gradeId === gradeId,
      deadline: judgeFormDeadline({
        status: f.status,
        opensAt: f.opensAt,
        closesAt: f.closesAt,
        extensions: extensions.filter((e) => e.formId === f.id).map((e) => e.extendedUntil),
        now,
      }),
      supersededBy: supersede ? { formId: supersede.id, title: supersede.title } : null,
    };
  });
}

/** 自分に効いている延長期限（取り消されていないもの）。 */
export async function listActiveExtensions(formId: string, employeeId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ extendedUntil: s.formDeadlineExtensions.extendedUntil })
    .from(s.formDeadlineExtensions)
    .where(
      and(
        eq(s.formDeadlineExtensions.formId, formId),
        eq(s.formDeadlineExtensions.employeeId, employeeId),
        isNull(s.formDeadlineExtensions.revokedAt),
      ),
    );
  return rows.map((r) => r.extendedUntil);
}

/** アンケート1本の延長の履歴（取り消したものも残す）。管理画面で使う。 */
export async function listFormExtensions(companyId: string, formId: string) {
  const db = await getDb();
  return db
    .select({
      id: s.formDeadlineExtensions.id,
      employeeId: s.formDeadlineExtensions.employeeId,
      employeeName: s.users.name,
      extendedUntil: s.formDeadlineExtensions.extendedUntil,
      reason: s.formDeadlineExtensions.reason,
      grantedById: s.formDeadlineExtensions.grantedById,
      revokedAt: s.formDeadlineExtensions.revokedAt,
      createdAt: s.formDeadlineExtensions.createdAt,
    })
    .from(s.formDeadlineExtensions)
    .leftJoin(s.users, eq(s.users.id, s.formDeadlineExtensions.employeeId))
    .where(and(eq(s.formDeadlineExtensions.companyId, companyId), eq(s.formDeadlineExtensions.formId, formId)))
    .orderBy(desc(s.formDeadlineExtensions.createdAt));
}

export interface ResponseDetail {
  response: {
    id: string;
    formId: string;
    employeeId: string;
    employeeName: string | null;
    status: string;
    submittedAt: Date | null;
    respondentNote: string | null;
    importSource: string | null;
    updatedAt: Date;
  };
  form: {
    id: string;
    title: string;
    version: number;
    status: string;
    cycleName: string | null;
    gradeName: string | null;
    opensAt: string | null;
    closesAt: string | null;
  };
  rows: AnswerReadRow[];
}

/**
 * 回答1件を「回答したときの姿」で読む。
 * 描く材料は form_answers に写し取ったスナップショットを正とし、
 * 写しが無い古い行だけ、いまの設問（form_questions）で補う。
 */
export async function getResponseDetail(companyId: string, responseId: string): Promise<ResponseDetail | null> {
  const db = await getDb();
  const head = (
    await db
      .select({
        id: s.formResponses.id,
        formId: s.formResponses.formId,
        employeeId: s.formResponses.employeeId,
        employeeName: s.users.name,
        status: s.formResponses.status,
        submittedAt: s.formResponses.submittedAt,
        respondentNote: s.formResponses.respondentNote,
        importSource: s.formResponses.importSource,
        updatedAt: s.formResponses.updatedAt,
        formTitle: s.forms.title,
        formVersion: s.forms.version,
        formStatus: s.forms.status,
        opensAt: s.forms.opensAt,
        closesAt: s.forms.closesAt,
        cycleName: s.evaluationCycles.name,
        gradeName: s.grades.name,
      })
      .from(s.formResponses)
      .leftJoin(s.users, eq(s.users.id, s.formResponses.employeeId))
      .leftJoin(s.forms, eq(s.forms.id, s.formResponses.formId))
      .leftJoin(s.evaluationCycles, eq(s.evaluationCycles.id, s.formResponses.cycleId))
      .leftJoin(s.grades, eq(s.grades.id, s.formResponses.gradeId))
      .where(and(eq(s.formResponses.companyId, companyId), eq(s.formResponses.id, responseId)))
      .limit(1)
  )[0];
  if (!head) return null;

  const [answers, questions] = await Promise.all([
    db.select().from(s.formAnswers).where(eq(s.formAnswers.responseId, head.id)),
    db
      .select()
      .from(s.formQuestions)
      .where(eq(s.formQuestions.formId, head.formId))
      .orderBy(asc(s.formQuestions.displayOrder)),
  ]);

  return {
    response: {
      id: head.id,
      formId: head.formId,
      employeeId: head.employeeId,
      employeeName: head.employeeName,
      status: head.status,
      submittedAt: head.submittedAt,
      respondentNote: head.respondentNote,
      importSource: head.importSource,
      updatedAt: head.updatedAt,
    },
    form: {
      id: head.formId,
      title: head.formTitle ?? "（削除されたアンケート）",
      version: head.formVersion ?? 1,
      status: head.formStatus ?? "closed",
      cycleName: head.cycleName,
      gradeName: head.gradeName,
      opensAt: head.opensAt,
      closesAt: head.closesAt,
    },
    rows: toAnswerRows(answers, questions),
  };
}
