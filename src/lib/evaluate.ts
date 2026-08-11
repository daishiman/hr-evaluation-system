import { and, eq, inArray } from "drizzle-orm";
import { getDb, insertMany, schema as s } from "@/lib/db";
import { computeActualValue, FormulaError } from "@/lib/domain/formula";
import {
  gradeRequirementRate,
  judgeOverall,
  judgeRank,
  rangeLabel,
  scoreItem,
  UNRATED_RATIONALE_EMPLOYEE,
  UNRATED_REQUIREMENT_RATIONALE_EMPLOYEE,
  type Direction,
  type Rank,
  type RankCriterion,
  type RankRatio,
  type ScoredItem,
  type ScoringMode,
} from "@/lib/domain/scoring";
import { computeBonus, type KgiCoefficientRow } from "@/lib/domain/kgi";
import { FINALIZED_SKIP_MESSAGE } from "@/lib/domain/build-summary";
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

  const [allSchemeItems, ratios, kpiItems, criteria, grades, thresholds, responses, kgiRows, raisePolicy, officeKgiRows] =
    await Promise.all([
    /* 評価セットは等級区分ごとに項目も配点も違う。人ごとに読みに行くとN+1になるため、
       全等級区分ぶんをここでまとめて読み、ループの中でその人の等級区分で絞る。 */
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
    // 事業所KGI達成係数（個人Pt・賞与額の算出に使う）
    db.select().from(s.kgiCoefficients).where(eq(s.kgiCoefficients.companyId, companyId)),
    db.select().from(s.raisePolicies).where(eq(s.raisePolicies.companyId, companyId)).limit(1),
    // このサイクルの事業所KGI達成率（/admin/kgi で登録する実績値）
    db
      .select()
      .from(s.officeKgiResults)
      .where(and(eq(s.officeKgiResults.companyId, companyId), eq(s.officeKgiResults.cycleId, cycleId))),
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

  /* ランク→点数の換算方式は「等級別配点 × ランク割合」に一本化した（2026-08-11）。
     配点そのものが等級区分ごとに決まる（grade_point_rules）ようになり、
     項目別絶対点方式が担っていた「等級ごとに重みを変える」役目がなくなったため。
     evaluation_schemes.scoring_mode は過去の評価の表示用に残っているだけで、
     新しく作る評価は必ず ratio で計算し、使った方式を scoring_mode_snapshot に写す。 */
  const scoringMode: ScoringMode = "ratio";

  const kgiCoefficients: KgiCoefficientRow[] = kgiRows.map((k) => ({
    label: k.label,
    lowerBound: k.lowerBound,
    upperBound: k.upperBound,
    coefficient: k.coefficient,
    displayOrder: k.displayOrder,
  }));
  const yenPerPoint = raisePolicy[0]?.bonusYenPerPoint ?? 0;

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
          message: FINALIZED_SKIP_MESSAGE,
        });
        continue;
      }

      /* ── この人の等級区分の評価セットを取り出す ──
         項目も配点も等級区分ごとに違う。0件のまま進めると、
         全項目が無い＝合計0点／満点0点の評価ができあがり、
         「設定がない」ことが「成績が0点だった」に化ける。手前で止めて理由を返す。 */
      const items = allSchemeItems.filter((si) => si.pointGroup === grade.pointGroup);
      if (items.length === 0) {
        out.push({
          evaluationId: existing?.id ?? "",
          employeeId: res.employeeId,
          employeeName: user.name,
          ok: false,
          message: `等級区分「${grade.pointGroup}」の評価セットが未設定です。評価セットの画面で ${grade.pointGroup} の項目を選んでから集計してください。`,
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
            /* 設問名はアンケートを作った時点の写しを使う。現在のマスタ名を引くと、
               公開済みの設問は旧名なのに、あとで作った評価だけ新名になる。 */
            aspectName: q.title,
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

      /* 等級要件達成率。分母は「このアンケートで実際に出題した等級要件の項目数」。
         出題数は等級・会社・アンケートの版で変わるため、判定した時点の分子・分母を
         evaluations に保存し、あとで設問を増減させても確定済みの評価が動かないようにする。 */
      const requirementRate = gradeRequirementRate(reqAchieved, reqTotal);

      items.forEach((si, idx) => {
        const m = kpiItems.find((k) => k.id === si.kpiItemId);
        if (!m) return;
        const crits: RankCriterion[] = criteria
          .filter((c) => c.kpiItemId === m.id)
          .map((c) => ({
            rank: c.rank as Rank,
            displayLabel: rangeLabel(c, m.unit, m.direction === "lower" ? "lower" : "higher"),
            lowerBound: c.lowerBound,
            upperBound: c.upperBound,
            meaning: c.meaning,
          }));

        /* 等級要件達成率（固定枠）は上で出した達成率をそのまま実績値にする。
           それ以外は計算式を評価する。

           計算式は「分母が0」「回答が空で変数が埋まらない」ときに例外を投げる。
           ここで受け止めないと、8項目のうち1項目でもつまずいた時点で
           その人の集計まるごとが失敗し、評価そのものが1件も作られない。
           分母0・未回答は「その項目だけ判定外」にするのが制度上の扱い
           （ランクEに落とさない＝実績が無いのに未達と断定しない）。 */
        let actual: number | null;
        let unratedReason: string | null = null;
        /* 本人向けの文は、評価者向けの文をそのまま出さない。
           評価者向けには「アンケートに等級要件を追加してください」のような
           運用側への指示が入っており、本人が読んでも行動につながらないため。 */
        let unratedReasonEmployee = UNRATED_RATIONALE_EMPLOYEE;
        if (si.isFixedSlot) {
          actual = requirementRate;
          unratedReason =
            "このアンケートに等級要件の設問が1件も含まれていないため、達成率を出せませんでした（判定外）。アンケートに等級要件を追加してください。";
          unratedReasonEmployee = UNRATED_REQUIREMENT_RATIONALE_EMPLOYEE;
        } else {
          try {
            actual = computeActualValue(m.formula ?? "", vars);
          } catch (e) {
            actual = null;
            unratedReason =
              e instanceof FormulaError
                ? `${e.message}（この項目は判定外として扱いました）`
                : "計算に必要な回答が不足しているため、実績値を出せませんでした（判定外）。回答を確認してください。";
          }
        }

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
            rationale:
              unratedReason ??
              "計算に必要な回答が不足しているため、実績値を出せませんでした（判定外）。回答を確認してください。",
            rationaleEmployee: unratedReasonEmployee,
            calcNote: m.formula,
            isProvisional: m.isProvisional,
            displayOrder: idx + 1,
          });
          // ランクは付けない（現行GASも「判定外」として扱っている）。配点は分母に残す。
          scored.push({ kpiItemId: m.id, itemName: m.name, rank: null, points: 0, maxPoints: si.weight });
          return;
        }

        // 本人向けの文に単位を付けるため、実績値の単位を渡す（「実績値 92%」）
        const j = judgeRank(actual, crits, direction, { unit: m.unit });
        /* 等級区分ごとの配点（scheme_items.weight）にランクの割合を掛ける。 */
        const sc = scoreItem({
          rank: j.rank,
          weight: si.weight,
          mode: scoringMode,
          ratios: rankRatios,
        });
        const points = sc.points;
        scored.push({ kpiItemId: m.id, itemName: m.name, rank: j.rank, points, maxPoints: sc.maxPoints });
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
          maxPoints: sc.maxPoints,
          thresholdLabel: j.criterion?.displayLabel ?? null,
          thresholdLower: j.criterion?.lowerBound ?? null,
          thresholdUpper: j.criterion?.upperBound ?? null,
          // 「どのランク行に当たったか」に加えて「その点数がどう決まったか」も残す
          rationale: `${j.rationale}${sc.note}`,
          /* 本人向けは配点・獲得点数・満点・閾値を出さない（実績値とランクだけ）。
             表示側で数字を消す作りにすると、消し忘れがそのまま本人に見えるため、
             ここで数字を含まない文を作り切って保存する。 */
          rationaleEmployee: `${j.rationaleEmployee}${sc.noteEmployee}`,
          calcNote: m.formula,
          isProvisional: m.isProvisional,
          displayOrder: idx + 1,
        });
      });

      /* ── 賞与（仮）: 個人Pt ＝ KPI評価点合計 × 事業所KGI達成係数 ──
         事業所KGIの達成率は、いまのアンケート73問の中に聞く設問が無い。
         元スプレッドシートでも別表から手で持ってきていた値のため、
         事業所ごと・サイクルごとに管理画面（/admin/kgi）から登録する。

         どの事業所の達成率を当てるかは、回答時点の所属を優先する（期中の異動があるため）。
         アンケートに設問キー office_kgi_rate を足した会社は、そちらの回答を優先する
         （事業所ではなく個人単位で達成率を持ちたい会社への逃げ道として残す）。
         どちらも無ければ達成率は null のままにして、賞与額を0円と書かない
         （0円と表示すると「賞与なしと判定された」に化けるため）。 */
      const officeId = res.officeId ?? user.officeId ?? null;
      const officeKgiRate =
        vars["office_kgi_rate"] ?? (officeId ? (officeKgiRows.find((k) => k.officeId === officeId)?.achievementRate ?? null) : null);

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

      const bonus = {
        rate: officeKgiRate,
        result: computeBonus({
          kpiTotalScore: overall.totalScore,
          officeAchievementRate: officeKgiRate,
          coefficients: kgiCoefficients,
          yenPerPoint,
        }),
      };

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
        // どの事業所の評価かを写し取る。事業所KGIの達成率を当てる先を後から辿れるようにするため。
        officeId,
        totalScore: overall.totalScore,
        maxScore: overall.maxScore,
        requirementRate,
        requirementAchieved: reqAchieved,
        requirementTotal: reqTotal,
        behaviorTotal: hasBehavior ? behaviorTotal : null,
        // 賞与（仮）。事業所KGIの達成率が未入力なら null のまま残し、0円とは書かない。
        officeAchievementRate: bonus.rate,
        kgiCoefficient: bonus.result.coefficient,
        personalPoints: bonus.result.personalPoints,
        bonusYen: bonus.result.bonusYen,
        bonusRationale: bonus.result.rationale,
        // 実際に使った方式を写す（会社の設定ではなく、この評価を計算した方式）
        scoringModeSnapshot: scoringMode,
        raiseEligible: overall.raiseEligible,
        raiseReason: overall.raiseReason,
        raiseReasonEmployee: overall.raiseReasonEmployee,
        promotionEligible: overall.promotionEligible,
        promotionBlockedReason: overall.promotionBlockedReason,
        promotionBlockedReasonEmployee: overall.promotionBlockedReasonEmployee,
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
