import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/lib/db";
import { apiViewer, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";
import { newId } from "@/lib/id";

export const dynamic = "force-dynamic";

/**
 * 制度マスタの変更（等級・昇格に必要な点数・昇給額・等級要件・昇格要件・ランク基準）。
 *
 * 制度の値をコードに書かないための入口。ここで保存した値が評価の計算に使われる。
 * 確定済みの評価は判定当時の値を持っているため、ここを変えても過去の結果は動かない。
 */

const bodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("grade"),
    id: z.string().min(1),
    name: z.string().min(1).max(40).optional(),
    targetCap: z.number().int().min(1).max(50).optional(),
    autonomyLevel: z.string().max(200).nullable().optional(),
    responsibilityLevel: z.string().max(200).nullable().optional(),
    deadlineNote: z.string().max(200).nullable().optional(),
    isActive: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("threshold"),
    id: z.string().min(1),
    requiredKpiPoints: z.number().int().min(0).max(100),
    requiredBehaviorPoints: z.number().int().min(0).max(100),
  }),
  z.object({
    kind: z.literal("raise"),
    id: z.string().min(1),
    monthlyAmount: z.number().int().min(0).max(10_000_000),
    months: z.number().int().min(1).max(24),
    note: z.string().max(200).nullable().optional(),
  }),
  z.object({
    kind: z.literal("gradeRequirement"),
    id: z.string().optional(),
    gradeId: z.string().min(1),
    category: z.enum(["support", "operation"]),
    text: z.string().min(1).max(300),
    seq: z.number().int().min(1).max(99).optional(),
    isActive: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("promotionRequirement"),
    id: z.string().optional(),
    gradeId: z.string().min(1),
    reqKind: z.enum(["report", "test"]),
    text: z.string().min(1).max(300),
    transitionLabel: z.string().max(60).nullable().optional(),
    seq: z.number().int().min(1).max(99).optional(),
    isGate: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("rankCriteria"),
    id: z.string().min(1),
    lowerBound: z.number().nullable().optional(),
    upperBound: z.number().nullable().optional(),
    displayLabel: z.string().min(1).max(60).optional(),
  }),
  z.object({
    kind: z.literal("kgi"),
    id: z.string().min(1),
    coefficient: z.number().min(0).max(5),
    label: z.string().min(1).max(60).optional(),
  }),
]);

export async function PUT(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("COMPANY_ADMIN");
    if (!viewer.companyId) throw new HttpError(400, "所属会社が設定されていません。");
    const companyId = viewer.companyId;
    const body = bodySchema.parse(await req.json());
    const db = await getDb();

    /** 自社のレコードであることを必ず確かめてから触る。 */
    const ensure = async (rows: { id: string }[], label: string) => {
      if (rows.length === 0) throw new HttpError(404, `${label}が見つかりませんでした。`);
    };
    const ownGrade = async (id: string) =>
      ensure(
        await db.select({ id: s.grades.id }).from(s.grades).where(and(eq(s.grades.id, id), eq(s.grades.companyId, companyId))).limit(1),
        "等級",
      );

    switch (body.kind) {
      case "grade": {
        await ownGrade(body.id);
        const patch: Record<string, unknown> = {};
        for (const k of ["name", "targetCap", "autonomyLevel", "responsibilityLevel", "deadlineNote", "isActive"] as const) {
          if (body[k] !== undefined) patch[k] = body[k];
        }
        await db.update(s.grades).set(patch).where(eq(s.grades.id, body.id));
        return { message: "等級の設定を保存しました。" };
      }
      case "threshold": {
        await ensure(
          await db.select({ id: s.promotionThresholds.id }).from(s.promotionThresholds)
            .where(and(eq(s.promotionThresholds.id, body.id), eq(s.promotionThresholds.companyId, companyId))).limit(1),
          "昇格の条件",
        );
        await db
          .update(s.promotionThresholds)
          .set({
            requiredKpiPoints: body.requiredKpiPoints,
            requiredBehaviorPoints: body.requiredBehaviorPoints,
            isProvisional: false,
          })
          .where(eq(s.promotionThresholds.id, body.id));
        return {
          message: "昇格の条件を保存しました。この点数はアンケートの回答画面には表示されません。",
        };
      }
      case "raise": {
        await ensure(
          await db.select({ id: s.raiseSettings.id }).from(s.raiseSettings)
            .where(and(eq(s.raiseSettings.id, body.id), eq(s.raiseSettings.companyId, companyId))).limit(1),
          "昇給額",
        );
        await db
          .update(s.raiseSettings)
          .set({
            monthlyAmount: body.monthlyAmount,
            months: body.months,
            annualAmount: body.monthlyAmount * body.months,
            note: body.note ?? null,
            isProvisional: false,
          })
          .where(eq(s.raiseSettings.id, body.id));
        return { message: "昇給額を保存しました。" };
      }
      case "gradeRequirement": {
        await ownGrade(body.gradeId);
        if (body.id) {
          await ensure(
            await db.select({ id: s.gradeRequirements.id }).from(s.gradeRequirements)
              .where(and(eq(s.gradeRequirements.id, body.id), eq(s.gradeRequirements.companyId, companyId))).limit(1),
            "等級要件",
          );
          await db
            .update(s.gradeRequirements)
            .set({
              text: body.text.trim(),
              category: body.category,
              ...(body.seq !== undefined ? { seq: body.seq } : {}),
              ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
            })
            .where(eq(s.gradeRequirements.id, body.id));
          return { message: "等級要件を保存しました。" };
        }
        const existing = await db
          .select({ seq: s.gradeRequirements.seq })
          .from(s.gradeRequirements)
          .where(and(eq(s.gradeRequirements.companyId, companyId), eq(s.gradeRequirements.gradeId, body.gradeId)));
        await db.insert(s.gradeRequirements).values({
          id: newId("greq"),
          companyId,
          gradeId: body.gradeId,
          category: body.category,
          seq: body.seq ?? existing.reduce((m, x) => Math.max(m, x.seq), 0) + 1,
          text: body.text.trim(),
          isActive: true,
        });
        return { message: "等級要件を追加しました。次に作るアンケートから設問に載ります。" };
      }
      case "promotionRequirement": {
        await ownGrade(body.gradeId);
        if (body.id) {
          await ensure(
            await db.select({ id: s.promotionRequirements.id }).from(s.promotionRequirements)
              .where(and(eq(s.promotionRequirements.id, body.id), eq(s.promotionRequirements.companyId, companyId))).limit(1),
            "昇格要件",
          );
          await db
            .update(s.promotionRequirements)
            .set({
              text: body.text.trim(),
              kind: body.reqKind,
              transitionLabel: body.transitionLabel ?? null,
              ...(body.seq !== undefined ? { seq: body.seq } : {}),
              ...(body.isGate !== undefined ? { isGate: body.isGate } : {}),
              ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
            })
            .where(eq(s.promotionRequirements.id, body.id));
          return { message: "昇格要件を保存しました。" };
        }
        const existing = await db
          .select({ seq: s.promotionRequirements.seq })
          .from(s.promotionRequirements)
          .where(and(eq(s.promotionRequirements.companyId, companyId), eq(s.promotionRequirements.gradeId, body.gradeId)));
        await db.insert(s.promotionRequirements).values({
          id: newId("preq"),
          companyId,
          gradeId: body.gradeId,
          kind: body.reqKind,
          transitionLabel: body.transitionLabel ?? null,
          seq: body.seq ?? existing.reduce((m, x) => Math.max(m, x.seq), 0) + 1,
          text: body.text.trim(),
          isGate: body.isGate ?? true,
          isActive: true,
        });
        return { message: "昇格要件を追加しました。" };
      }
      case "rankCriteria": {
        await ensure(
          await db.select({ id: s.kpiRankCriteria.id }).from(s.kpiRankCriteria)
            .where(and(eq(s.kpiRankCriteria.id, body.id), eq(s.kpiRankCriteria.companyId, companyId))).limit(1),
          "ランク基準",
        );
        await db
          .update(s.kpiRankCriteria)
          .set({
            ...(body.lowerBound !== undefined ? { lowerBound: body.lowerBound } : {}),
            ...(body.upperBound !== undefined ? { upperBound: body.upperBound } : {}),
            ...(body.displayLabel !== undefined ? { displayLabel: body.displayLabel } : {}),
          })
          .where(eq(s.kpiRankCriteria.id, body.id));
        return { message: "ランク基準を保存しました。" };
      }
      case "kgi": {
        await ensure(
          await db.select({ id: s.kgiCoefficients.id }).from(s.kgiCoefficients)
            .where(and(eq(s.kgiCoefficients.id, body.id), eq(s.kgiCoefficients.companyId, companyId))).limit(1),
          "達成係数",
        );
        await db
          .update(s.kgiCoefficients)
          .set({
            coefficient: body.coefficient,
            ...(body.label !== undefined ? { label: body.label } : {}),
            isProvisional: false,
          })
          .where(eq(s.kgiCoefficients.id, body.id));
        return { message: "達成係数を保存しました。" };
      }
    }
  });
}
