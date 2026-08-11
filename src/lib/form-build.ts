import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import { newId } from "@/lib/id";
import { HttpError } from "@/lib/session";
import { targetsPointGroup } from "@/lib/domain/grade-points";

/**
 * 制度マスタからアンケートの下書きを組み立てる。
 *
 * 設問を手で並べ直す前の「たたき台」をここで作る。
 * 等級要件・昇格要件・行動指針・評価セットの8項目に紐づく設問を
 * マスタから引いて並べるので、制度を変えれば次に作るアンケートも変わる。
 * 作ったあとは管理画面（アンケートの編集）で自由に足し引きできる。
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
  if (!cycle) throw new HttpError(404, "評価サイクルが見つかりませんでした。");
  if (cycle.status === "closed") throw new HttpError(400, "締め切り済みのサイクルにはアンケートを追加できません。");

  const grade = (
    await db
      .select()
      .from(s.grades)
      .where(and(eq(s.grades.id, gradeId), eq(s.grades.companyId, companyId)))
      .limit(1)
  )[0];
  if (!grade) throw new HttpError(404, "等級が見つかりませんでした。");

  // 同じサイクル・等級のアンケートは版を上げて作る（過去の回答はそのまま残す）
  const siblings = await db
    .select({ version: s.forms.version })
    .from(s.forms)
    .where(and(eq(s.forms.cycleId, cycleId), eq(s.forms.gradeId, gradeId)));
  const version = siblings.reduce((max, f) => Math.max(max, f.version), 0) + 1;

  const formId = newId("frm");
  await db.insert(s.forms).values({
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
  });

  type Row = typeof s.formQuestions.$inferInsert;
  const rows: Row[] = [];
  const push = (r: Omit<Row, "id" | "companyId" | "formId" | "displayOrder">) => {
    rows.push({ id: newId("fq"), companyId, formId, displayOrder: rows.length + 1, ...r });
  };

  const gradeReqs = await db
    .select()
    .from(s.gradeRequirements)
    .where(and(eq(s.gradeRequirements.companyId, companyId), eq(s.gradeRequirements.gradeId, gradeId)))
    .orderBy(asc(s.gradeRequirements.seq));
  for (const cat of ["support", "operation"]) {
    for (const r of gradeReqs.filter((x) => x.category === cat && x.isActive)) {
      push({
        section: cat,
        questionType: "yesno",
        title: r.text,
        required: true,
        gradeRequirementId: r.id,
        isGate: false,
      });
    }
  }

  const promoReqs = await db
    .select()
    .from(s.promotionRequirements)
    .where(and(eq(s.promotionRequirements.companyId, companyId), eq(s.promotionRequirements.gradeId, gradeId)))
    .orderBy(asc(s.promotionRequirements.seq));
  for (const kind of ["report", "test"]) {
    for (const r of promoReqs.filter((x) => x.kind === kind && x.isActive)) {
      push({
        section: kind === "report" ? "training" : "test",
        questionType: "yesno",
        title: r.text,
        helpText:
          kind === "report"
            ? "受講後の報告書を提出済みの場合は「はい」を選んでください。"
            : "テストに合格している場合は「はい」を選んでください。",
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
      .where(and(eq(s.behaviorGuidelines.companyId, companyId), eq(s.behaviorGuidelines.band, grade.behaviorBand)))
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
        helpText: "もっとも近いものを1つ選んでください。",
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
    /* 「その等級ではランク基準が定義されていない項目」を落とすための一覧。
       kpi_rank_criteria.target_grades は元シートの「対象等級」欄そのままで、
       ここまで一度も参照されていなかった（デッド列）。
       基準が無い項目を出題しても、集計時にランクを付けられず判定外になるだけなので、
       設問の時点で外す。 */
    const rankTargets = kpiIds.length
      ? await db
          .select({ kpiItemId: s.kpiRankCriteria.kpiItemId, targetGrades: s.kpiRankCriteria.targetGrades })
          .from(s.kpiRankCriteria)
          .where(and(eq(s.kpiRankCriteria.companyId, companyId), inArray(s.kpiRankCriteria.kpiItemId, kpiIds)))
      : [];
    const ratedHere = (kpiItemId: string) => {
      const rows = rankTargets.filter((r) => r.kpiItemId === kpiItemId);
      // 基準行そのものが無い項目は判断材料が無いので落とさない（設定漏れを設問の消失にしない）
      if (rows.length === 0) return true;
      return rows.some((r) => targetsPointGroup(r.targetGrades, grade.pointGroup));
    };

    for (const i of items) {
      if (!ratedHere(i.kpiItemId)) continue;
      for (const q of questions.filter(
        // kpi_questions.target_grades もデッド列だった。この列を見ないと、
        // Beginner のアンケートに Chief 以上限定の設問（q4_1 昇給率・q6_1 単価率など）が出てしまう。
        (x) => x.kpiItemId === i.kpiItemId && targetsPointGroup(x.targetGrades, grade.pointGroup),
      )) {
        push({
          section: "kpi",
          questionType: q.inputType === "select" ? "single" : "number",
          title: q.text,
          helpText: `${kpiNames.find((k) => k.id === i.kpiItemId)?.name ?? ""}の集計に使います。`,
          unit: q.unit && q.unit !== "-" ? q.unit : null,
          required: q.required,
          validationMin: (q.validation ?? "").includes("1以上") ? 1 : (q.validation ?? "").includes("0以上") ? 0 : null,
          kpiItemId: i.kpiItemId,
          kpiQuestionKey: q.questionKey,
          isGate: false,
        });
      }
    }
  }

  if (rows.length > 0) await db.insert(s.formQuestions).values(rows);
  return { formId, questionCount: rows.length, version };
}
