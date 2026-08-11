import { z } from "zod";
import { BEHAVIOR_BANDS } from "@/lib/domain/behavior";

/**
 * 制度マスタ更新 API の入力スキーマ。
 * 画面ごとのフォームと、このスキーマの kind を一致させる。
 */
export const bodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("grade"),
    id: z.string().min(1),
    name: z.string().min(1).max(40).optional(),
    targetCap: z.number().int().min(1).max(50).optional(),
    autonomyLevel: z.string().max(200).nullable().optional(),
    responsibilityLevel: z.string().max(200).nullable().optional(),
    deadlineNote: z.string().max(200).nullable().optional(),
    /** 行動指針をこの等級に出すか。null なら出さない（会社ごとに切り替えられる） */
    behaviorBand: z.enum(BEHAVIOR_BANDS).nullable().optional(),
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
    maxCount: z.number().int().min(1).max(50).optional(),
    /** 改定履歴に残す理由と適用開始（金額を変えたときだけ使う） */
    reason: z.string().max(200).nullable().optional(),
    effectiveFrom: z.string().max(20).nullable().optional(),
    note: z.string().max(200).nullable().optional(),
  }),
  z.object({
    kind: z.literal("raisePolicy"),
    id: z.string().min(1),
    requiredACount: z.number().int().min(0).max(20),
    chancesPerYear: z.number().int().min(0).max(12),
    allowDecrease: z.boolean().optional(),
    judgeUnit: z.string().min(1).max(120).optional(),
    reflectUpperNote: z.string().max(200).nullable().optional(),
    reflectLowerNote: z.string().max(200).nullable().optional(),
    targetNote: z.string().max(300).nullable().optional(),
  }),
  z.object({
    kind: z.literal("office"),
    id: z.string().min(1),
    raiseAdjustRate: z.number().min(0).max(3),
    name: z.string().min(1).max(60).optional(),
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
    /** 等級要件の並べ替え（同じ区分の中で1つ上／下と入れ替える） */
    kind: z.literal("gradeRequirementOrder"),
    id: z.string().min(1),
    gradeId: z.string().min(1),
    category: z.enum(["support", "operation"]),
    direction: z.enum(["up", "down"]),
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
    /** 昇格要件の並べ替え（同じ種類の中で1つ上／下と入れ替える） */
    kind: z.literal("promotionRequirementOrder"),
    id: z.string().min(1),
    gradeId: z.string().min(1),
    reqKind: z.enum(["report", "test"]),
    direction: z.enum(["up", "down"]),
  }),
  z.object({
    /** 行動指針の観点（創造性…）の呼び名と、その等級帯で使うかどうか */
    kind: z.literal("behaviorGuideline"),
    id: z.string().min(1),
    aspectName: z.string().min(1).max(60).optional(),
    isActive: z.boolean().optional(),
  }),
  z.object({
    /** 行動指針の1段階ぶんの文言（点数そのものは制度の骨格なので変えられない） */
    kind: z.literal("behaviorLevel"),
    id: z.string().min(1),
    label: z.string().min(1).max(20).optional(),
    text: z.string().min(1).max(200).optional(),
  }),
  z.object({
    kind: z.literal("rankCriteria"),
    id: z.string().min(1),
    lowerBound: z.number().nullable().optional(),
    upperBound: z.number().nullable().optional(),
  }),
  z.object({
    kind: z.literal("kgi"),
    id: z.string().min(1),
    coefficient: z.number().min(0).max(5),
  }),
]);

export type MasterUpdateBody = z.infer<typeof bodySchema>;
