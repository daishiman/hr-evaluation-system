import { and, eq, inArray } from "drizzle-orm";
import { getDb, insertMany, schema as s } from "@/lib/db";
import { computeActualValue } from "@/lib/domain/formula";
import {
  gradeRequirementRate,
  judgeOverall,
  judgeRank,
  scoreFromRank,
  type Direction,
  type Rank,
  type RankCriterion,
  type RankRatio,
  type ScoredItem,
} from "@/lib/domain/scoring";
import { newId } from "@/lib/id";

/**
 * 提出されたアンケート回答から評価結果を組み立てる。
 *
 * 判定に使う数値（ランク基準・配点・按分率・昇格に必要な点数）は
 * すべてDBのマスタから読む。ここには一切書かない。
 * 判定に使った値は evaluations / evaluation_items に写し取って保存するので、
 * あとでマスタを直しても確定済みの評価は動かない。
 */

export interface BuildResult {
  evaluationId: string;
  employeeId: string;
  employeeName: string;
  ok: boolean;
  message: string;
}

/** 1サイクル分の評価をまとめて作り直す。提出済みの回答があるひとだけが対象。 */
export async function buildEvaluationsForCycle(
  companyId: string,
  cycleId: string,
  evaluatorId: string,
  opts?: { employeeIds?: string[] },
): Promise<BuildResult[]> {
  const db = await getDb();

  const cycle = (
    await db
      .select()
      .from(s.evaluationCycles)
      .where(and(eq(s.evaluationCycles.companyId, companyId), eq(s.evaluationCycles.id, cycleId)))
      .limit(1)
  )[0];
  if (!cycle) return [];

  // 使う評価セット（8項目と配点）。サイクルに紐づくものを優先し、なければ有効なもの。
  const schemes = await db.select().from(s.evaluationSchemes).where(eq(s.evaluationSchemes.companyId, companyId));
  const scheme =
    schemes.find((x) => x.id === cycle.schemeId) ?? schemes.find((x) => x.status === "active") ?? schemes[0];
  if (!scheme) return [];

  const [items, ratios, kpiItems, criteria, grades, thresholds, responses] = await Promise.all([
    db.select().from(s.schemeItems).where(eq(s.schemeItems.schemeId, scheme.id)).orderBy(s.schemeItems.displayOrder),
    db.select().from(s.schemeRankRatios).where(eq(s.schemeRankRatios.schemeId, scheme.id)),
    db.select().from(s.kpiItems).where(eq(s.kpiItems.companyId, companyId)),
    db.select().from(s.kpiRankCriteria).where(eq(s.kpiRankCriteria.companyId, companyId)),
    db.select().from(s.grades).where(eq(s.grades.companyId, companyId)),
    db.select().from(s.promotionThresholds).where(eq(s.promotionThresholds.companyId, companyId)),
    db
      .select()
      .from(s.formResponses)
      .where(
        and(
          eq(s.formResponses.companyId, companyId),
          eq(s.formResponses.cycleId, cycleId),
          eq(s.formResponses.status, "submitted"),
        ),
      ),
  ]);

  const targets = opts?.employeeIds?.length
    ? responses.filter((r) => opts.employeeIds!.includes(r.employeeId))
    : responses;
  if (targets.length === 0) return [];

  const [users, categories, behaviorGuidelines] = await Promise.all([
    db.select().from(s.users).where(eq(s.users.companyId, companyId)),
    db.select().from(s.kpiCategories).where(eq(s.kpiCategories.companyId, companyId)),
    db.select().from(s.behaviorGuidelines).where(eq(s.behaviorGuidelines.companyId, companyId)),
  ]);

  const rankRatios: RankRatio[] = ratios.map((r) => ({ rank: r.rank as Rank, ratio: r.ratio }));

  const out: BuildResult[] = [];
  for (const res of targets) {
    const user = users.find((u) => u.id === res.employeeId);
    const grade = grades.find((g) => g.id === res.gradeId);
    if (!user || !grade) continue;

    try {
      /* ── 先にこの人の既存評価を見る ──
         確定済みなら計算そのものを行わない（据え置き）。
         作り直すときは同じ評価IDを使い回す。IDが変わると、
         配布済みの評価票リンクが開けなくなるため。 */
      const existing = (
        await db
          .select()
          .from(s.evaluations)
          .where(
            and(
              eq(s.evaluations.companyId, companyId),
              eq(s.evaluations.cycleId, cycleId),
              eq(s.evaluations.employeeId, res.employeeId),
            ),
          )
          .limit(1)
      )[0];
      if (existing?.status === "finalized") {
        out.push({
          evaluationId: existing.id,
          employeeId: res.employeeId,
          employeeName: user.name,
          ok: false,
          message: "確定済みのため作り直しませんでした。",
        });
        continue;
      }

      const questions = await db
        .select()
        .from(s.formQuestions)
        .where(eq(s.formQuestions.formId, res.formId))
        .orderBy(s.formQuestions.displayOrder);
      const answers = await db.select().from(s.formAnswers).where(eq(s.formAnswers.responseId, res.id));
      const answerOf = (qid: string) => answers.find((a) => a.questionId === qid) ?? null;

      /* ── 等級要件・昇格要件・行動指針を回答から拾う ── */
      const vars: Record<string, number> = {
        等級別の半期目標設定上限数: grade.targetCap,
        等級別の1人あたり必要回数: grade.pointGroup === "AM" ? 3 : 2,
      };
      let reqAchieved = 0;
      let reqTotal = 0;
      let behaviorTotal = 0;
      let hasBehavior = false;
      const reqRows: { grId: string | null; category: string; text: string; achieved: boolean }[] = [];
      const gateRows: { prId: string | null; kind: string; text: string; achieved: boolean }[] = [];
      const behRows: { gId: string; aspect: string; aspectName: string; score: number; label: string }[] = [];

      for (const q of questions) {
        const a = answerOf(q.id);
        const num = a?.valueNumber ?? null;

        if (q.questionType === "yesno") {
          const ok = num === 1;
          if (q.gradeRequirementId) {
            reqTotal++;
            if (ok) reqAchieved++;
            reqRows.push({ grId: q.gradeRequirementId, category: q.section, text: q.title, achieved: ok });
          }
          if (q.isGate) {
            gateRows.push({
              prId: q.promotionRequirementId,
              kind: q.section === "training" ? "report" : "test",
              text: q.title,
              achieved: ok,
            });
          }
        } else if (q.behaviorGuidelineId) {
          hasBehavior = true;
          const g = behaviorGuidelines.find((b) => b.id === q.behaviorGuidelineId);
          const score = num ?? 0;
          behaviorTotal += score;
          behRows.push({
            gId: q.behaviorGuidelineId,
            aspect: g?.aspect ?? "",
            aspectName: g?.aspectName ?? q.title,
            score,
            label: a?.valueText ?? "",
          });
        }

        if (q.kpiQuestionKey && num !== null) vars[q.kpiQuestionKey] = num;
      }

      /* ── 8項目のランク判定と得点化 ── */
      const itemRows: typeof s.evaluationItems.$inferInsert[] = [];
      const scored: ScoredItem[] = [];
      const evalId = existing?.id ?? newId("ev");

      /* 等級要件達成率。分母は「半期の目標設定上限数」であってアンケートの設問数ではない
         （元スプレッドシートの計算式どおり）。上限を超えて達成した場合は100%で頭打ちにする。 */
      const requirementRate = gradeRequirementRate(reqAchieved, grade.targetCap);

      items.forEach((si, idx) => {
        const m = kpiItems.find((k) => k.id === si.kpiItemId);
        if (!m) return;
        const crits: RankCriterion[] = criteria
          .filter((c) => c.kpiItemId === m.id)
          .map((c) => ({
            rank: c.rank as Rank,
            displayLabel: c.displayLabel,
            lowerBound: c.lowerBound,
            upperBound: c.upperBound,
            meaning: c.meaning,
          }));

        // 等級要件達成率（固定枠）は上で出した達成率をそのまま実績値にする
        const actual = si.isFixedSlot ? requirementRate : computeActualValue(m.formula ?? "", vars);

        const direction = (m.direction === "lower" ? "lower" : "higher") as Direction;
        if (actual === null) {
          itemRows.push({
            id: newId("ei"),
            companyId,
            evaluationId: evalId,
            kpiItemId: m.id,
            categoryId: si.categoryId,
            itemName: m.name,
            categoryName: categories.find((c) => c.id === si.categoryId)?.name ?? "等級要件（固定枠）",
            unit: m.unit,
            direction,
            actualValue: null,
            rank: null,
            points: 0,
            maxPoints: si.weight,
            rationale: "計算に必要な回答が不足しているため、実績値を出せませんでした（判定外）。回答を確認してください。",
            calcNote: m.formula,
            isProvisional: m.isProvisional,
            displayOrder: idx + 1,
          });
          // ランクは付けない（現行GASも「判定外」として扱っている）。配点は分母に残す。
          scored.push({ kpiItemId: m.id, itemName: m.name, rank: null, points: 0, maxPoints: si.weight });
          return;
        }

        const j = judgeRank(actual, crits, direction);
        const points = scoreFromRank(j.rank, si.weight, rankRatios);
        scored.push({ kpiItemId: m.id, itemName: m.name, rank: j.rank, points, maxPoints: si.weight });
        itemRows.push({
          id: newId("ei"),
          companyId,
          evaluationId: evalId,
          kpiItemId: m.id,
          categoryId: si.categoryId,
          itemName: m.name,
          categoryName: categories.find((c) => c.id === si.categoryId)?.name ?? "等級要件（固定枠）",
          unit: m.unit,
          direction,
          actualValue: actual,
          rank: j.rank,
          points,
          maxPoints: si.weight,
          thresholdLabel: j.criterion?.displayLabel ?? null,
          thresholdLower: j.criterion?.lowerBound ?? null,
          thresholdUpper: j.criterion?.upperBound ?? null,
          rationale: j.rationale,
          calcNote: m.formula,
          isProvisional: m.isProvisional,
          displayOrder: idx + 1,
        });
      });

      /* ── 総合判定 ── */
      const th = thresholds.find((t) => t.fromGradeId === grade.id) ?? null;
      const overall = judgeOverall({
        items: scored,
        raiseRequiresAllA: scheme.raiseRequiresAllA,
        requiredKpiPoints: th?.requiredKpiPoints ?? null,
        requiredBehaviorPoints: hasBehavior ? (th?.requiredBehaviorPoints ?? null) : null,
        behaviorTotal: hasBehavior ? behaviorTotal : null,
        gates: gateRows.map((g) => ({ text: g.text, achieved: g.achieved })),
      });

      /* ── 保存（同じサイクル・同じ人の未確定分は作り直す） ── */
      if (existing) {
        await db.delete(s.evaluations).where(eq(s.evaluations.id, existing.id));
      }

      await db.insert(s.evaluations).values({
        id: evalId,
        companyId,
        cycleId,
        employeeId: res.employeeId,
        gradeId: grade.id,
        responseId: res.id,
        schemeId: scheme.id,
        totalScore: overall.totalScore,
        maxScore: overall.maxScore,
        requirementRate,
        requirementAchieved: reqAchieved,
        requirementTotal: reqTotal,
        behaviorTotal: hasBehavior ? behaviorTotal : null,
        raiseEligible: overall.raiseEligible,
        promotionEligible: overall.promotionEligible,
        promotionBlockedReason: overall.promotionBlockedReason,
        requiredKpiPointsSnapshot: th?.requiredKpiPoints ?? null,
        requiredBehaviorPointsSnapshot: hasBehavior ? (th?.requiredBehaviorPoints ?? null) : null,
        evaluatorId,
        status: "draft",
        // いつの基準で計算したかを必ず残す。
        // ここが空だと「基準を変えたのに集計し直していない評価」を
        // 見つけられず、集計し直しても警告が消えない（→ src/lib/impact.ts）。
        computedAt: new Date(),
      });

      await insertMany((rows) => db.insert(s.evaluationItems).values(rows), itemRows);
      await insertMany(
        (rows) => db.insert(s.evaluationRequirements).values(rows),
        reqRows.map((r) => ({
          id: newId("er"),
          companyId,
          evaluationId: evalId,
          gradeRequirementId: r.grId,
          category: r.category,
          text: r.text,
          achieved: r.achieved,
        })),
      );
      await insertMany(
        (rows) => db.insert(s.evaluationGates).values(rows),
        gateRows.map((g) => ({
          id: newId("eg"),
          companyId,
          evaluationId: evalId,
          promotionRequirementId: g.prId,
          kind: g.kind,
          text: g.text,
          achieved: g.achieved,
        })),
      );
      await insertMany(
        (rows) => db.insert(s.evaluationBehaviors).values(rows),
        behRows.map((b) => ({
          id: newId("eb"),
          companyId,
          evaluationId: evalId,
          guidelineId: b.gId,
          aspect: b.aspect,
          aspectName: b.aspectName,
          score: b.score,
          levelLabel: b.label,
        })),
      );

      out.push({
        evaluationId: evalId,
        employeeId: res.employeeId,
        employeeName: user.name,
        ok: true,
        message: overall.raiseReason,
      });
    } catch (e) {
      // ひとり分の計算でつまずいても、ほかの人の集計は続ける。
      // 何が足りなかったのかは画面にそのまま出す（黙って飛ばさない）。
      out.push({
        evaluationId: "",
        employeeId: res.employeeId,
        employeeName: user.name,
        ok: false,
        message: e instanceof Error ? `集計できませんでした：${e.message}` : "集計できませんでした。",
      });
    }
  }

  return out;
}

/** 未提出の人を一覧するための補助（誰の評価がまだ作れないかを画面に出す）。 */
export async function listPendingRespondents(companyId: string, cycleId: string) {
  const db = await getDb();
  const forms = await db
    .select()
    .from(s.forms)
    .where(and(eq(s.forms.companyId, companyId), eq(s.forms.cycleId, cycleId)));
  if (forms.length === 0) return [];
  const gradeIds = forms.map((f) => f.gradeId);
  const members = await db
    .select({ id: s.users.id, name: s.users.name, gradeId: s.users.gradeId })
    .from(s.users)
    .where(and(eq(s.users.companyId, companyId), inArray(s.users.gradeId, gradeIds)));
  const responses = await db
    .select()
    .from(s.formResponses)
    .where(and(eq(s.formResponses.companyId, companyId), eq(s.formResponses.cycleId, cycleId)));
  return members.map((m) => {
    const r = responses.find((x) => x.employeeId === m.id);
    return { ...m, status: r?.status ?? "none" };
  });
}
