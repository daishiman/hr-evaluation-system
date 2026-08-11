import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/lib/db";
import { apiViewer, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";
import { newId } from "@/lib/id";
import { validateScheme } from "@/lib/domain/scheme";
import { pointsForSlot, slotKindOf, targetsPointGroup, type GradePointRule } from "@/lib/domain/grade-points";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  schemeId: z.string().min(1),
  /**
   * 等級区分（Beginner / Regular / Chief / AM / Manager）。等級区分ごとに保存する。
   *
   * 全等級区分に共通の設定（昇給の条件）だけを保存するときは項目を送らないので、
   * pointGroup も items も省略できる。両方そろっているか、両方無いかのどちらかであること
   * （片方だけ送られたら、どの等級区分へ入れるのか決まらないため下で弾く）。
   */
  pointGroup: z.string().min(1).optional(),
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
    .max(20)
    .optional(),
  ratios: z
    .array(z.object({ rank: z.enum(["A", "B", "C", "D", "E"]), ratio: z.number().min(0).max(1) }))
    .optional(),
});

/**
 * 全等級区分に共通の設定（昇給の条件・ランクの割合）の保存。
 *
 * 項目の保存と一緒でも、共通の設定だけでも同じ処理を通す。
 * 2箇所に書くと、片方だけ直したときに「入口から保存したときだけ効かない」が起きる。
 */
async function saveCommon(
  db: Awaited<ReturnType<typeof getDb>>,
  schemeId: string,
  companyId: string,
  body: z.infer<typeof bodySchema>,
) {
  if (body.ratios) {
    await db.delete(s.schemeRankRatios).where(eq(s.schemeRankRatios.schemeId, schemeId));
    await db.insert(s.schemeRankRatios).values(
      body.ratios.map((r) => ({
        id: newId("srr"),
        companyId,
        schemeId,
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
      .where(eq(s.evaluationSchemes.id, schemeId));
  }
}

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

    /* 全等級区分に共通の設定（昇給の条件）だけの保存。
       等級区分ごとの項目には一切触らない（別の等級区分の設定を巻き込まないため）。 */
    if (!body.items || !body.pointGroup) {
      if (body.items || body.pointGroup) {
        throw new HttpError(400, "どの等級区分の設定かが分かりませんでした。画面を開き直してからもう一度お試しください。");
      }
      if (body.raiseRequiresAllA === undefined && body.scoringMode === undefined && !body.ratios) {
        throw new HttpError(400, "保存する内容がありませんでした。");
      }
      await saveCommon(db, scheme.id, companyId, body);
      return { message: "全等級区分に共通の設定を保存しました。", warnings: [] as string[] };
    }
    const items = body.items;
    const pointGroup = body.pointGroup;

    const [ruleRow] = await db
      .select()
      .from(s.gradePointRules)
      .where(and(eq(s.gradePointRules.companyId, companyId), eq(s.gradePointRules.pointGroup, pointGroup)))
      .limit(1);
    if (!ruleRow) {
      throw new HttpError(400, `等級区分「${pointGroup}」の配点ルールが登録されていません。`);
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
    if (items.some((i) => !known.has(i.kpiItemId))) {
      throw new HttpError(400, "この会社に登録されていないKPI項目が含まれています。");
    }

    /* 選べる項目は絞らない（どの項目でも、どの分類からでも選べる）。
       ここで引くのは「その等級区分でランク基準が定義済みか」だけ。
       未定義の項目も採点はされるが、上位等級向けの閾値が当たるため、検証側で知らせる。 */
    const criteriaRows = await db
      .select({ kpiItemId: s.kpiRankCriteria.kpiItemId, targetGrades: s.kpiRankCriteria.targetGrades })
      .from(s.kpiRankCriteria)
      .where(eq(s.kpiRankCriteria.companyId, companyId));
    const ratedItemIds = new Set(
      criteriaRows.filter((r) => targetsPointGroup(r.targetGrades, pointGroup)).map((r) => r.kpiItemId),
    );

    const selections = items.map((i) => ({
      kpiItemId: i.kpiItemId,
      categoryId: i.categoryId,
      isFixedSlot: i.isFixedSlot,
      isMajorSlot: i.isMajorSlot ?? false,
      // 配点はリクエストの値を使わない。等級区分の型から決める。
      weight: pointsForSlot(rule, slotKindOf({ isFixedSlot: i.isFixedSlot, isMajorSlot: i.isMajorSlot ?? false })),
    }));

    const v = validateScheme(selections, {
      rule,
      fixedSlotItemIds: kpiItems.filter((k) => k.isFixedSlot).map((k) => k.id),
      ratedItemIds,
      itemNameOf: (id) => kpiItems.find((k) => k.id === id)?.name ?? id,
    });
    if (!v.ok) throw new HttpError(400, v.errors.join(" "));

    /* 保存はこの等級区分ぶんだけ入れ替える。
       ほかの等級区分の設定に触らないのは、タブを切り替えながら1つずつ保存する画面のため。 */
    await db
      .delete(s.schemeItems)
      .where(and(eq(s.schemeItems.schemeId, scheme.id), eq(s.schemeItems.pointGroup, pointGroup)));
    await db.insert(s.schemeItems).values(
      selections.map((i, idx) => ({
        id: newId("si"),
        companyId,
        schemeId: scheme.id,
        pointGroup,
        kpiItemId: i.kpiItemId,
        categoryId: i.categoryId,
        weight: i.weight,
        isFixedSlot: i.isFixedSlot,
        isMajorSlot: i.isMajorSlot,
        displayOrder: idx + 1,
      })),
    );

    await saveCommon(db, scheme.id, companyId, body);

    return {
      message:
        `${pointGroup} の評価セット（${selections.length}項目・${v.total}点）を保存しました。` +
        "確定済みの評価は判定当時の設定のまま残るため、過去の結果は変わりません。",
      // 保存はできたが伝えるべきこと（ランク基準が未定義の項目など）。画面がそのまま出す。
      warnings: v.warnings,
    };
  });
}
