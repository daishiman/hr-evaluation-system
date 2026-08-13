import { z } from "zod";

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
    /**
     * この等級に出す行動指針の基準セット（会社が作ったセットの code）。null なら出さない。
     * 値の妥当性は「自社に実在し、使用中であること」をサーバー側で必ず確かめる。
     */
    behaviorBand: z.string().min(1).max(60).nullable().optional(),
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
    kind: z.literal("gradeRequirementCreate"),
    gradeId: z.string().min(1),
    category: z.enum(["support", "operation"]),
    text: z.string().min(1).max(300),
  }),
  z.object({
    kind: z.literal("gradeRequirementRevise"),
    id: z.string().min(1),
    text: z.string().min(1).max(300),
  }),
  z.object({
    kind: z.literal("gradeRequirementActivation"),
    id: z.string().min(1),
    isActive: z.boolean(),
  }),
  z.object({
    /** 過去版の本文を、現在版の次の新しい版として復元する。 */
    kind: z.literal("gradeRequirementRestoreContent"),
    id: z.string().min(1),
    sourceVersionId: z.string().min(1),
  }),
  z.object({
    /** 等級要件の並べ替え（同じ区分の中で1つ上／下、または先頭／末尾へ移動） */
    kind: z.literal("gradeRequirementOrder"),
    id: z.string().min(1),
    direction: z.enum(["up", "down", "top", "bottom"]),
  }),
  z.object({
    kind: z.literal("promotionRequirementCreate"),
    gradeId: z.string().min(1),
    reqKind: z.enum(["report", "test"]),
    text: z.string().min(1).max(300),
    transitionLabel: z.string().max(60).nullable().optional(),
    isGate: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("promotionRequirementRevise"),
    id: z.string().min(1),
    text: z.string().min(1).max(300),
    transitionLabel: z.string().max(60).nullable().optional(),
    isGate: z.boolean(),
  }),
  z.object({
    kind: z.literal("promotionRequirementActivation"),
    id: z.string().min(1),
    isActive: z.boolean(),
  }),
  z.object({
    kind: z.literal("promotionRequirementRestoreContent"),
    id: z.string().min(1),
    sourceVersionId: z.string().min(1),
  }),
  z.object({
    /** 昇格要件の並べ替え（同じ種類の中で1つ上／下、または先頭／末尾へ移動） */
    kind: z.literal("promotionRequirementOrder"),
    id: z.string().min(1),
    direction: z.enum(["up", "down", "top", "bottom"]),
  }),
  z.object({
    /**
     * 行動指針の基準セット。
     * id なし＝新規作成（copyFromBand があれば、そのセットの観点と文章ごと複製する）。
     * id あり＝呼び名の変更・使用停止／再開。code は作ったあと変えない。
     */
    kind: z.literal("behaviorBandSet"),
    id: z.string().min(1).optional(),
    name: z.string().min(1).max(60).optional(),
    copyFromBand: z.string().min(1).max(60).optional(),
    isActive: z.boolean().optional(),
  }),
  z.object({
    /** 行動指針の観点（創造性…）。id なし＝その基準セットに新しい観点を追加する */
    kind: z.literal("behaviorGuideline"),
    id: z.string().min(1).optional(),
    band: z.string().min(1).max(60).optional(),
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
    /** ランクA〜Eをまとめて保存する（重なり・隙間はまとめて見ないと判定できない） */
    kind: z.literal("rankCriteriaSet"),
    kpiItemId: z.string().min(1),
    rows: z
      .array(
        z.object({
          id: z.string().min(1),
          lowerBound: z.number().nullable(),
          upperBound: z.number().nullable(),
        }),
      )
      .min(1)
      .max(10),
  }),
  z.object({
    kind: z.literal("kgi"),
    id: z.string().min(1),
    coefficient: z.number().min(0).max(5),
  }),
  z.object({
    /** KPIカテゴリの追加。呼び名だけを受け取る（分類コードはサーバー側で自動採番する）。 */
    kind: z.literal("kpiCategoryCreate"),
    name: z.string().min(1).max(60),
  }),
  z.object({
    /** KPI項目そのものの追加。No.は自動採番（既存の最大値+1）、固定枠は作れない。 */
    kind: z.literal("kpiItemCreate"),
    name: z.string().min(1).max(80),
    unit: z.string().min(1).max(10),
    direction: z.enum(["higher", "lower"]),
    measureType: z.string().min(1).max(40),
    categoryId: z.string().min(1).nullable().optional(),
    formula: z.string().max(300).nullable().optional(),
    formulaNote: z.string().max(300).nullable().optional(),
    remarks: z.string().max(300).nullable().optional(),
    isMonetary: z.boolean().optional(),
    isProvisional: z.boolean().optional(),
  }),
  z.object({
    /**
     * KPI項目の編集。使用中（アンケート・評価セット・評価の記録のどれかに登場済み）の
     * 項目は、単位・向き・実績区分・分類・金銭系フラグをサーバー側で必ず無視する
     * （画面から送られてきても apply-master-update.ts 側で弾く）。
     */
    kind: z.literal("kpiItemUpdate"),
    id: z.string().min(1),
    name: z.string().min(1).max(80).optional(),
    unit: z.string().min(1).max(10).optional(),
    direction: z.enum(["higher", "lower"]).optional(),
    measureType: z.string().min(1).max(40).optional(),
    categoryId: z.string().min(1).nullable().optional(),
    formula: z.string().max(300).nullable().optional(),
    formulaNote: z.string().max(300).nullable().optional(),
    remarks: z.string().max(300).nullable().optional(),
    isMonetary: z.boolean().optional(),
    isProvisional: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
]);

export type MasterUpdateBody = z.infer<typeof bodySchema>;

/**
 * 制度マスタの削除（完全に消す）の入力スキーマ。
 *
 * 消してよいのは、利用者が自分で足せる6種類だけ。等級・事業所・評価期間のように
 * 過去の記録がぶら下がるものは、ここに入れない（消せる形をそもそも作らない）。
 * 実際に消してよいかは、参照件数を数えたうえでサーバー側で判定する。
 */
export const deleteBodySchema = z.object({
  kind: z.enum([
    "behaviorBandSet",
    "behaviorGuideline",
    "gradeRequirement",
    "promotionRequirement",
    "kpiCategory",
    "kpiItem",
  ]),
  id: z.string().min(1),
});

export type MasterDeleteBody = z.infer<typeof deleteBodySchema>;
