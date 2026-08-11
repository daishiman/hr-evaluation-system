import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/lib/db";
import { apiViewer, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";
import { newId } from "@/lib/id";
import { validateScheme } from "@/lib/domain/scheme";
import { pointsForSlot, slotKindOf, type GradePointRule } from "@/lib/domain/grade-points";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  schemeId: z.string().min(1),
  /** 等級区分（Beginner / Regular / Chief / AM / Manager）。等級区分ごとに保存する */
  pointGroup: z.string().min(1),
  raiseRequiresAllA: z.boolean().optional(),
  /**
   * ランク→点数の換算方式。
   *
   * 2026-08-11 に「等級別配点 × ランク割合」へ一本化したため ratio しか受け付けない。
   * absolute（項目別絶対点方式）は、当時 absolute で確定した評価を当時の方式のまま
   * 表示するために列と既存値だけを残している（本番に absolute の評価セットは0件）。
   */
  scoringMode: z
    .literal("ratio", {
      error: "採点方式は「等級別の配点 × ランクの割合」に一本化しました。項目ごとの点数表は新しく選べません。",
    })
    .optional(),
  items: z
    .array(
      z.object({
        kpiItemId: z.string().min(1),
        categoryId: z.string().nullable(),
        isFixedSlot: z.boolean(),
        /** 20点枠（金銭系）として選んだか */
        isMajorSlot: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(20),
  ratios: z
    .array(z.object({ rank: z.enum(["A", "B", "C", "D", "E"]), ratio: z.number().min(0).max(1) }))
    .optional(),
});

/**
 * 評価セット（等級区分ごとの項目選択）の保存。会社の管理者以上のみ。
 *
 * 配点はリクエストの値を一切使わず grade_point_rules から決める。
 * 固定枠・20点枠・その等級区分で選べるかどうかも、画面を通さずに送られた場合に備えて
 * ここで必ず確かめる（画面が正しく送ることに依存しない）。
 */
export async function PUT(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("COMPANY_ADMIN");
    if (!viewer.companyId) throw new HttpError(400, "所属会社が設定されていません。");
    const companyId = viewer.companyId;
    const body = bodySchema.parse(await req.json());
    const db = await getDb();

    const scheme = (
      await db
        .select()
        .from(s.evaluationSchemes)
        .where(and(eq(s.evaluationSchemes.id, body.schemeId), eq(s.evaluationSchemes.companyId, companyId)))
        .limit(1)
    )[0];
    if (!scheme) throw new HttpError(404, "評価セットが見つかりませんでした。");

    const [ruleRow] = await db
      .select()
      .from(s.gradePointRules)
      .where(and(eq(s.gradePointRules.companyId, companyId), eq(s.gradePointRules.pointGroup, body.pointGroup)))
      .limit(1);
    if (!ruleRow) {
      throw new HttpError(400, `等級区分「${body.pointGroup}」の配点ルールが登録されていません。`);
    }
    const rule: GradePointRule = {
      pointGroup: ruleRow.pointGroup,
      totalPoints: ruleRow.totalPoints,
      fixedSlotPoints: ruleRow.fixedSlotPoints,
      majorSlotPoints: ruleRow.majorSlotPoints,
      majorSlotCount: ruleRow.majorSlotCount,
      minorSlotPoints: ruleRow.minorSlotPoints,
      minorSlotCount: ruleRow.minorSlotCount,
    };

    const kpiItems = await db.select().from(s.kpiItems).where(eq(s.kpiItems.companyId, companyId));

    // 他社のKPI項目を混ぜられないようにする
    const known = new Set(kpiItems.map((k) => k.id));
    if (body.items.some((i) => !known.has(i.kpiItemId))) {
      throw new HttpError(400, "この会社に登録されていないKPI項目が含まれています。");
    }

    /* その等級区分で選べる項目は「元の配点表にその等級区分の行があるか」が正。
       固定枠になれるのは kpi_items.is_fixed_slot、20点枠に置けるのは is_monetary の項目だけ。 */
    const refRows = await db
      .select({ kpiItemId: s.kpiReferencePoints.kpiItemId })
      .from(s.kpiReferencePoints)
      .where(
        and(eq(s.kpiReferencePoints.companyId, companyId), eq(s.kpiReferencePoints.pointGroup, body.pointGroup)),
      );
    const selectableItemIds = new Set(refRows.map((r) => r.kpiItemId));

    const selections = body.items.map((i) => ({
      kpiItemId: i.kpiItemId,
      categoryId: i.categoryId,
      isFixedSlot: i.isFixedSlot,
      isMajorSlot: i.isMajorSlot ?? false,
      // 配点はリクエストの値を使わない。等級区分の型から決める。
      weight: pointsForSlot(rule, slotKindOf({ isFixedSlot: i.isFixedSlot, isMajorSlot: i.isMajorSlot ?? false })),
    }));

    const v = validateScheme(selections, {
      rule,
      selectableItemIds,
      fixedSlotItemIds: kpiItems.filter((k) => k.isFixedSlot).map((k) => k.id),
      monetaryItemIds: kpiItems.filter((k) => k.isMonetary).map((k) => k.id),
      itemNameOf: (id) => kpiItems.find((k) => k.id === id)?.name ?? id,
    });
    if (!v.ok) throw new HttpError(400, v.errors.join(" "));

    /* 保存はこの等級区分ぶんだけ入れ替える。
       ほかの等級区分の設定に触らないのは、タブを切り替えながら1つずつ保存する画面のため。 */
    await db
      .delete(s.schemeItems)
      .where(and(eq(s.schemeItems.schemeId, scheme.id), eq(s.schemeItems.pointGroup, body.pointGroup)));
    await db.insert(s.schemeItems).values(
      selections.map((i, idx) => ({
        id: newId("si"),
        companyId,
        schemeId: scheme.id,
        pointGroup: body.pointGroup,
        kpiItemId: i.kpiItemId,
        categoryId: i.categoryId,
        weight: i.weight,
        isFixedSlot: i.isFixedSlot,
        isMajorSlot: i.isMajorSlot,
        displayOrder: idx + 1,
      })),
    );

    if (body.ratios) {
      await db.delete(s.schemeRankRatios).where(eq(s.schemeRankRatios.schemeId, scheme.id));
      await db.insert(s.schemeRankRatios).values(
        body.ratios.map((r) => ({
          id: newId("srr"),
          companyId,
          schemeId: scheme.id,
          rank: r.rank,
          ratio: r.ratio,
          isProvisional: false,
        })),
      );
    }

    if (body.raiseRequiresAllA !== undefined || body.scoringMode !== undefined) {
      await db
        .update(s.evaluationSchemes)
        .set({
          ...(body.raiseRequiresAllA !== undefined ? { raiseRequiresAllA: body.raiseRequiresAllA } : {}),
          ...(body.scoringMode !== undefined ? { scoringMode: body.scoringMode } : {}),
        })
        .where(eq(s.evaluationSchemes.id, scheme.id));
    }

    return {
      message:
        `${body.pointGroup} の評価セット（${selections.length}項目・${v.total}点）を保存しました。` +
        "確定済みの評価は判定当時の設定のまま残るため、過去の結果は変わりません。",
    };
  });
}
