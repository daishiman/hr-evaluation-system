import { and, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import {
  checkKgiCoverage,
  effectiveOfficeId,
  planBonusRecalc,
  type BonusRecalcTarget,
  type KgiCoefficientRow,
} from "@/lib/domain/kgi";

/**
 * 事業所KGIの達成率を、その事業所・そのサイクルの評価に反映する。
 *
 * 反映するのは賞与の欄（達成率・係数・個人Pt・賞与額・判定根拠）だけで、
 * KPIのランク判定や得点には触れない。理由は planBonusRecalc のコメントを参照。
 * 確定済みの評価は書き換えず、据え置いた件数だけを返す。
 */

export interface KgiApplyResult {
  /** 個人Pt・賞与額を入れ直した評価の件数 */
  updated: number;
  /** 確定済みのため据え置いた評価の件数 */
  skippedFinalized: number;
  /** 係数を引き当てられなかった評価の件数（係数表に穴がある） */
  unmatched: number;
  /** 引き当てた係数（全件同じ）。引き当てられなければ null */
  coefficient: number | null;
  /** 係数表そのものの問題（穴・重なり）を日本語で */
  coverageProblems: string[];
  /** 1点あたり金額が未設定のため賞与額を出せなかったか */
  yenPerPointMissing: boolean;
}

export async function applyOfficeKgiRate(
  companyId: string,
  officeId: string,
  cycleId: string,
  achievementRate: number,
): Promise<KgiApplyResult> {
  const db = await getDb();

  const [kgiRows, policyRows, evalRows] = await Promise.all([
    db.select().from(s.kgiCoefficients).where(eq(s.kgiCoefficients.companyId, companyId)),
    db.select().from(s.raisePolicies).where(eq(s.raisePolicies.companyId, companyId)).limit(1),
    db
      .select({
        id: s.evaluations.id,
        status: s.evaluations.status,
        totalScore: s.evaluations.totalScore,
        evalOfficeId: s.evaluations.officeId,
        responseOfficeId: s.formResponses.officeId,
        userOfficeId: s.users.officeId,
      })
      .from(s.evaluations)
      .leftJoin(s.formResponses, eq(s.formResponses.id, s.evaluations.responseId))
      .leftJoin(s.users, eq(s.users.id, s.evaluations.employeeId))
      .where(and(eq(s.evaluations.companyId, companyId), eq(s.evaluations.cycleId, cycleId))),
  ]);

  const coefficients: KgiCoefficientRow[] = kgiRows.map((k) => ({
    label: k.label,
    lowerBound: k.lowerBound,
    upperBound: k.upperBound,
    coefficient: k.coefficient,
    displayOrder: k.displayOrder,
  }));
  const yenPerPoint = policyRows[0]?.bonusYenPerPoint ?? 0;

  const targets: BonusRecalcTarget[] = evalRows
    .filter((r) => effectiveOfficeId(r) === officeId)
    .map((r) => ({ evaluationId: r.id, status: r.status, totalScore: r.totalScore }));

  const plan = planBonusRecalc(targets, { achievementRate, coefficients, yenPerPoint });

  // まとめて書き込む。D1 は1文あたりの値の数に上限があるため、少しずつ分ける。
  const CHUNK = 20;
  for (let i = 0; i < plan.updates.length; i += CHUNK) {
    const chunk = plan.updates.slice(i, i + CHUNK);
    if (chunk.length === 0) continue;
    await db.batch(
      chunk.map((u) =>
        db
          .update(s.evaluations)
          .set({
            officeAchievementRate: u.officeAchievementRate,
            kgiCoefficient: u.coefficient,
            personalPoints: u.personalPoints,
            bonusYen: u.bonusYen,
            bonusRationale: u.rationale,
            // どの事業所の評価かを写し取っておく（次回からは join を辿らずに済む）
            officeId,
          })
          .where(eq(s.evaluations.id, u.evaluationId)),
      ) as unknown as Parameters<typeof db.batch>[0],
    );
  }

  return {
    updated: plan.updates.length,
    skippedFinalized: plan.skippedFinalized.length,
    unmatched: plan.unmatched.length,
    coefficient: plan.updates.find((u) => u.coefficient !== null)?.coefficient ?? null,
    coverageProblems: checkKgiCoverage(coefficients).map((p) => p.message),
    yenPerPointMissing: yenPerPoint <= 0,
  };
}
