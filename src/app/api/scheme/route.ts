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

    if (body.raiseRequiresAllA !== undefined) {
      await db
        .update(s.evaluationSchemes)
        .set({ raiseRequiresAllA: body.raiseRequiresAllA })
        .where(eq(s.evaluationSchemes.id, scheme.id));
    }

    return {
      message:
        "評価セットを保存しました。確定済みの評価は判定当時の設定のまま残るため、過去の結果は変わりません。",
    };
  });
}
