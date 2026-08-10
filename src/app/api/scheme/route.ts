import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/lib/db";
import { apiViewer, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";
import { newId } from "@/lib/id";
import { validateScheme } from "@/lib/domain/scheme";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  schemeId: z.string().min(1),
  raiseRequiresAllA: z.boolean().optional(),
  /**
   * ランク→点数の換算方式。
   *  ratio    … 一律割合方式（A=100% / B=80% / C=60% / D=40% / E=0%）※既定・仮
   *  absolute … 項目別絶対点方式（項目ごとに違う点数表 kpi_reference_points を使う）
   */
  scoringMode: z.enum(["ratio", "absolute"]).optional(),
  items: z
    .array(
      z.object({
        kpiItemId: z.string().min(1),
        categoryId: z.string().nullable(),
        weight: z.number().int().min(0).max(100),
        isFixedSlot: z.boolean(),
      }),
    )
    .min(1)
    .max(20),
  ratios: z
    .array(z.object({ rank: z.enum(["A", "B", "C", "D", "E"]), ratio: z.number().min(0).max(1) }))
    .optional(),
});

/**
 * 評価セット（8項目と配点）の保存。会社の管理者以上のみ。
 *
 * 「7カテゴリから1つずつ + 固定枠1 = 8項目、合計100点」の確認は
 * 画面だけでなくここでも行う。画面を通さずに送られても崩れた設定は保存されない。
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

    const categories = await db.select().from(s.kpiCategories).where(eq(s.kpiCategories.companyId, companyId));
    const kpiItems = await db.select().from(s.kpiItems).where(eq(s.kpiItems.companyId, companyId));

    // 他社のKPI項目を混ぜられないようにする
    const known = new Set(kpiItems.map((k) => k.id));
    if (body.items.some((i) => !known.has(i.kpiItemId))) {
      throw new HttpError(400, "この会社に登録されていないKPI項目が含まれています。");
    }

    const v = validateScheme(body.items, {
      totalPoints: scheme.totalPoints,
      categoryIds: categories.map((c) => c.id),
      categoryNameOf: (id) => categories.find((c) => c.id === id)?.name ?? id,
    });
    if (!v.ok) throw new HttpError(400, v.errors.join(" "));

    await db.delete(s.schemeItems).where(eq(s.schemeItems.schemeId, scheme.id));
    await db.insert(s.schemeItems).values(
      body.items.map((i, idx) => ({
        id: newId("si"),
        companyId,
        schemeId: scheme.id,
        kpiItemId: i.kpiItemId,
        categoryId: i.categoryId,
        weight: i.weight,
        isFixedSlot: i.isFixedSlot,
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

    let extraNote = "";
    if (body.scoringMode === "absolute") {
      /* 項目別絶対点方式にするには、その項目の点数表が要る。
         表が無い項目は一律割合方式で計算されるため、それを黙って起こさず先に伝える。 */
      const refs = await db
        .select({ kpiItemId: s.kpiReferencePoints.kpiItemId })
        .from(s.kpiReferencePoints)
        .where(eq(s.kpiReferencePoints.companyId, companyId));
      const haveTable = new Set(refs.map((r) => r.kpiItemId));
      const missing = body.items.filter((i) => !i.isFixedSlot && !haveTable.has(i.kpiItemId));
      if (missing.length > 0) {
        const names = missing
          .map((i) => kpiItems.find((k) => k.id === i.kpiItemId)?.name ?? i.kpiItemId)
          .join("・");
        extraNote = `ただし点数表が未登録の項目（${names}）は、これまでどおり一律割合で計算します。`;
      }
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
        "評価セットを保存しました。確定済みの評価は判定当時の設定のまま残るため、過去の結果は変わりません。" +
        (extraNote ? ` ${extraNote}` : ""),
    };
  });
}
