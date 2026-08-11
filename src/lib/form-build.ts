import { and, asc, eq, inArray } from "drizzle-orm";
import { chunkRowsForD1, getDb, schema as s } from "@/lib/db";
import { newId } from "@/lib/id";
import { HttpError } from "@/lib/session";
import { targetsPointGroup } from "@/lib/domain/grade-points";
import {
  BEHAVIOR_HELP,
  kpiQuestion,
  promotionQuestion,
  requirementQuestion,
} from "@/lib/domain/form-question-text";

/**
 * 制度マスタからアンケートの設問を組み立てる。
 *
 * 等級要件・昇格要件・行動指針・評価セットで選んだ項目に紐づく設問をマスタから引いて並べる。
 * 設問文の作り方（聞き方・説明文・はい／いいえの意味）は
 * src/lib/domain/form-question-text.ts が1箇所で決める。
 *
 * 「制度が正・アンケートは写し」という向きを崩さないため、
 * 作成（buildFormDraft）と作り直し（syncFormQuestions）は同じ組み立てを通す。
 * アンケート側で文言を直す運用にすると、どちらが本当の制度か分からなくなる。
 */

export const SECTION_LABEL: Record<string, string> = {
  support: "支援について",
  operation: "運営について",
  training: "受講後の報告書",
  test: "独学後のテスト",
  behavior: "行動指針",
  kpi: "実績の入力",
  free: "自由記入",
};

type Row = typeof s.formQuestions.$inferInsert;

/** D1の1query上限内に分けた、設問INSERT statementを作る。実行自体は呼び出し側のbatchで原子的に行う。 */
function questionInsertStatements(db: Awaited<ReturnType<typeof getDb>>, rows: Row[]) {
  return chunkRowsForD1(rows).map((chunk) => db.insert(s.formQuestions).values(chunk));
}

/**
 * この会社・この等級のアンケートに載せる設問を、いまの制度マスタから組み立てる。
 * 並び順は回答画面の並び（view.ts の SECTION_ORDER）と同じにする。
 */
export async function buildQuestionRows(opts: {
  companyId: string;
  cycleId: string;
  gradeId: string;
  formId: string;
}): Promise<Row[]> {
  const { companyId, cycleId, gradeId, formId } = opts;
  const db = await getDb();

  const grade = (
    await db
      .select()
      .from(s.grades)
      .where(and(eq(s.grades.id, gradeId), eq(s.grades.companyId, companyId)))
      .limit(1)
  )[0];
  if (!grade) throw new HttpError(404, "等級が見つかりませんでした。");

  const cycle = (
    await db
      .select()
      .from(s.evaluationCycles)
      .where(and(eq(s.evaluationCycles.id, cycleId), eq(s.evaluationCycles.companyId, companyId)))
      .limit(1)
  )[0];
  if (!cycle) throw new HttpError(404, "評価期間が見つかりませんでした。");

  const rows: Row[] = [];
  const push = (r: Omit<Row, "id" | "companyId" | "formId" | "displayOrder">) => {
    rows.push({ id: newId("fq"), companyId, formId, displayOrder: rows.length + 1, ...r });
  };

  const gradeReqs = await db
    .select()
    .from(s.gradeRequirements)
    .where(and(eq(s.gradeRequirements.companyId, companyId), eq(s.gradeRequirements.gradeId, gradeId)))
    .orderBy(asc(s.gradeRequirements.seq));
  for (const cat of ["support", "operation"] as const) {
    for (const r of gradeReqs.filter((x) => x.category === cat && x.isActive)) {
      const q = requirementQuestion(cat, r.text);
      push({
        section: cat,
        questionType: q.questionType,
        title: q.title,
        helpText: q.helpText,
        optionsJson: q.options ? JSON.stringify(q.options) : null,
        required: true,
        gradeRequirementId: r.id,
        isGate: false,
      });
    }
  }
  const requirementCount = rows.length;

  const promoReqs = await db
    .select()
    .from(s.promotionRequirements)
    .where(and(eq(s.promotionRequirements.companyId, companyId), eq(s.promotionRequirements.gradeId, gradeId)))
    .orderBy(asc(s.promotionRequirements.seq));
  for (const kind of ["report", "test"] as const) {
    for (const r of promoReqs.filter((x) => x.kind === kind && x.isActive)) {
      const q = promotionQuestion(kind, r.text);
      push({
        section: kind === "report" ? "training" : "test",
        questionType: q.questionType,
        title: q.title,
        helpText: q.helpText,
        optionsJson: q.options ? JSON.stringify(q.options) : null,
        required: true,
        promotionRequirementId: r.id,
        isGate: r.isGate,
      });
    }
  }

  if (grade.behaviorBand) {
    const guidelines = await db
      .select()
      .from(s.behaviorGuidelines)
      .where(
        and(
          eq(s.behaviorGuidelines.companyId, companyId),
          eq(s.behaviorGuidelines.band, grade.behaviorBand),
          eq(s.behaviorGuidelines.isActive, true),
        ),
      )
      .orderBy(asc(s.behaviorGuidelines.seq));
    const levels = guidelines.length
      ? await db
          .select()
          .from(s.behaviorLevels)
          .where(inArray(s.behaviorLevels.guidelineId, guidelines.map((g) => g.id)))
          .orderBy(asc(s.behaviorLevels.score))
      : [];
    for (const g of guidelines) {
      const lv = levels.filter((l) => l.guidelineId === g.id).sort((a, b) => b.score - a.score);
      push({
        section: "behavior",
        questionType: "single",
        title: g.aspectName,
        helpText: BEHAVIOR_HELP,
        required: true,
        optionsJson: JSON.stringify(
          lv.map((l) => ({ value: String(l.score), label: `【${l.label}】${l.text}`, score: l.score })),
        ),
        behaviorGuidelineId: g.id,
        isGate: false,
      });
    }
  }

  // 評価セットに入っている項目に紐づく設問だけを載せる
  const scheme = (
    await db
      .select()
      .from(s.evaluationSchemes)
      .where(and(eq(s.evaluationSchemes.companyId, companyId), eq(s.evaluationSchemes.id, cycle.schemeId ?? "")))
      .limit(1)
  )[0];
  const activeScheme =
    scheme ??
    (
      await db
        .select()
        .from(s.evaluationSchemes)
        .where(and(eq(s.evaluationSchemes.companyId, companyId), eq(s.evaluationSchemes.status, "active")))
        .limit(1)
    )[0];

  if (activeScheme) {
    /* この等級の等級区分ぶんだけを載せる。
       等級区分で選ぶ項目が違う（Beginner は等級要件達成率のみ、Manager は8項目）ため、
       全等級区分ぶんを載せると、その等級では評価されない項目の実績まで聞くことになる。 */
    const items = await db
      .select()
      .from(s.schemeItems)
      .where(and(eq(s.schemeItems.schemeId, activeScheme.id), eq(s.schemeItems.pointGroup, grade.pointGroup)))
      .orderBy(asc(s.schemeItems.displayOrder));
    const kpiIds = items.map((i) => i.kpiItemId);
    const questions = kpiIds.length
      ? await db
          .select()
          .from(s.kpiQuestions)
          .where(and(eq(s.kpiQuestions.companyId, companyId), inArray(s.kpiQuestions.kpiItemId, kpiIds)))
          .orderBy(asc(s.kpiQuestions.displayOrder))
      : [];
    const kpiNames = kpiIds.length
      ? await db.select().from(s.kpiItems).where(inArray(s.kpiItems.id, kpiIds))
      : [];
    /* 設問を出すかどうかは「管理者がこの等級区分で選んだかどうか」で決める。items がその答え。
       マスタの「対象等級」欄（kpi_questions.target_grades / kpi_rank_criteria.target_grades）は
       元スプレッドシートの推奨であって、会社が選び直したなら会社の意思のほうが正しい。

       2026-08-11 まではランク基準の対象等級に合わない項目を丸ごと落としていたが、
       項目選択を自由化した結果「選べるのにアンケートに出ず、点が付かない」項目が生まれるため、
       この足切りはやめた。基準が未設定であることは評価セットの画面側で警告する。 */
    for (const i of items) {
      /* 固定枠（等級要件達成率）の実績は、支援・運営の「はい／いいえ」から数える（evaluate.ts）。
         達成件数を聞く設問（q1_1）を並べても集計には一切使われないため、
         同じことを2回聞くだけになる。等級要件の設問が1問も無い等級では、
         そこだけが実績を出す手がかりになるので残す。 */
      if (i.isFixedSlot && requirementCount > 0) continue;

      /* 設問は原則この等級区分向けのものだけを出す。
         Beginner のアンケートに Chief 以上限定の設問（q4_1 昇給率など）が出るのを防ぐため。
         ただし1件も残らない場合は、対象等級の指定を無視して全部出す。
         管理者がこの等級区分で選んだ以上、実績を聞かなければ評価そのものが成立しないため、
         「設問が消える」より「想定外の等級に設問が出る」ほうが害が小さい。 */
      const mine = questions.filter((x) => x.kpiItemId === i.kpiItemId);
      const forThisGrade = mine.filter((x) => targetsPointGroup(x.targetGrades, grade.pointGroup));
      for (const q of forThisGrade.length > 0 ? forThisGrade : mine) {
        const built = kpiQuestion(q, kpiNames.find((k) => k.id === i.kpiItemId)?.name ?? "");
        push({
          section: "kpi",
          questionType: built.questionType,
          title: built.title,
          helpText: built.helpText,
          unit: built.unit,
          required: q.required,
          validationMin: built.validationMin,
          validationMax: built.validationMax,
          optionsJson: built.options ? JSON.stringify(built.options) : null,
          kpiItemId: i.kpiItemId,
          kpiQuestionKey: q.questionKey,
          isGate: false,
        });
      }
    }
  }

  return rows;
}

/**
 * 制度マスタからアンケートの下書きを1本作る。
 * 同じサイクル・等級のアンケートは版を上げて作る（過去の回答はそのまま残す）。
 */
export async function buildFormDraft(opts: {
  companyId: string;
  cycleId: string;
  gradeId: string;
  title?: string;
}): Promise<{ formId: string; questionCount: number; version: number }> {
  const { companyId, cycleId, gradeId } = opts;
  const db = await getDb();

  const cycle = (
    await db
      .select()
      .from(s.evaluationCycles)
      .where(and(eq(s.evaluationCycles.id, cycleId), eq(s.evaluationCycles.companyId, companyId)))
      .limit(1)
  )[0];
  if (!cycle) throw new HttpError(404, "評価期間が見つかりませんでした。");
  if (cycle.status === "closed") throw new HttpError(400, "締め切り済みのサイクルにはアンケートを追加できません。");

  const grade = (
    await db
      .select()
      .from(s.grades)
      .where(and(eq(s.grades.id, gradeId), eq(s.grades.companyId, companyId)))
      .limit(1)
  )[0];
  if (!grade) throw new HttpError(404, "等級が見つかりませんでした。");

  const siblings = await db
    .select({ version: s.forms.version })
    .from(s.forms)
    .where(and(eq(s.forms.cycleId, cycleId), eq(s.forms.gradeId, gradeId)));
  const version = siblings.reduce((max, f) => Math.max(max, f.version), 0) + 1;

  const formId = newId("frm");
  const formRow: typeof s.forms.$inferInsert = {
    id: formId,
    companyId,
    gradeId,
    cycleId,
    title: opts.title?.trim() || `${cycle.name} ${grade.name} 実績アンケート`,
    description: "半期の実績を入力してください。点数や評価基準はこの画面には表示されません。",
    version,
    status: "draft",
    publicToken: newId("t").replace("t_", ""),
    opensAt: cycle.periodStart,
    closesAt: cycle.periodEnd,
  };

  const rows = await buildQuestionRows({ companyId, cycleId, gradeId, formId });
  /*
   * フォーム本体と全設問を1つのD1 batchに入れる。
   * 設問の途中で上限・制約エラーが起きても、設問0件のフォームだけを残さない。
   */
  await db.batch(
    [db.insert(s.forms).values(formRow), ...questionInsertStatements(db, rows)] as unknown as Parameters<
      typeof db.batch
    >[0],
  );
  return { formId, questionCount: rows.length, version };
}

/**
 * タイトル・説明・設問など、回答内容の意味を変える編集ができる状態か。
 *
 * 回答0件でも、公開中ならすでに誰かが設問を読んでいる可能性がある。
 * 公開済み・締め切り済みの版はそのまま残し、変更時は新しい下書き版を作る。
 * UI・PUT・同期処理で同じ規則を使えるよう、DBを読まない判定として公開する。
 */
export function assertFormContentEditable(form: { status: string; title: string }): void {
  if (form.status === "draft") return;
  const state =
    form.status === "published"
      ? "公開中"
      : form.status === "closed"
        ? "締め切り済み"
        : `現在の状態（${form.status}）`;
  throw new HttpError(
    400,
    `「${form.title}」は${state}のため、内容を変更できません。いまの評価項目で聞き直すときは、アンケート一覧から新しい版を作ってください。`,
  );
}

/**
 * 既にあるアンケートの設問を、いまの制度マスタ・評価セットで作り直す。
 *
 * 下書きかつ回答0件の場合だけ、その版の設問を制度の側に揃え直せる。
 * 公開後は未回答でも閲覧済みの可能性があり、締め切り後は記録なので、
 * どちらも既存版を保ち、新しい版を作る運用にする。
 */
export async function syncFormQuestions(opts: {
  companyId: string;
  formId: string;
}): Promise<{ questionCount: number; removed: number }> {
  const { companyId, formId } = opts;
  const db = await getDb();

  const form = (
    await db
      .select()
      .from(s.forms)
      .where(and(eq(s.forms.id, formId), eq(s.forms.companyId, companyId)))
      .limit(1)
  )[0];
  if (!form) throw new HttpError(404, "アンケートが見つかりませんでした。");

  assertFormContentEditable(form);

  const answered = await db
    .select({ id: s.formResponses.id })
    .from(s.formResponses)
    .where(eq(s.formResponses.formId, form.id))
    .limit(1);
  if (answered.length > 0) {
    throw new HttpError(
      400,
      "このアンケートにはすでに回答があるため、設問を作り直せません。いまの評価項目に合わせるときは、新しい版を作って公開してください。",
    );
  }

  const rows = await buildQuestionRows({
    companyId,
    cycleId: form.cycleId,
    gradeId: form.gradeId,
    formId: form.id,
  });
  if (rows.length === 0) {
    throw new HttpError(
      400,
      "いまの等級要件・昇格要件・行動指針・評価セットからは設問を1問も作れませんでした。評価セットでこの等級区分の項目が選ばれているか確認してください。",
    );
  }

  const before = await db
    .select({ id: s.formQuestions.id })
    .from(s.formQuestions)
    .where(eq(s.formQuestions.formId, form.id));

  /*
   * DELETEと、D1のbound parameter上限内に分けた全INSERTを1つのbatchにする。
   * D1 batchは途中のstatementが失敗すると全体をrollbackするため、
   * 古い設問だけ消えた状態や、新旧が一部だけ混ざった状態を作らない。
   */
  await db.batch(
    [
      db.delete(s.formQuestions).where(eq(s.formQuestions.formId, form.id)),
      ...questionInsertStatements(db, rows),
    ] as unknown as Parameters<typeof db.batch>[0],
  );

  return { questionCount: rows.length, removed: before.length };
}
