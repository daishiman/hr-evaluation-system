"use server";

import { and, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { z } from "zod";
import { runAction } from "@/lib/action";
import { chunkRowsForD1, getDb, schema as s } from "@/lib/db";
import { batchAll } from "@/lib/db-batch";
import { assertCompanyChosen, HttpError } from "@/lib/session";
import { newId } from "@/lib/id";
import { constitutionEventStatements, isConstitutionSeqConflict } from "@/lib/domain/constitution-events";
import { validateScheme } from "@/lib/domain/scheme";
import { pointsForSlot, slotKindOf, targetsPointGroup, type GradePointRule } from "@/lib/domain/grade-points";
import { pointGroupLabel } from "@/lib/domain/grade-label";
import { followSettings } from "@/lib/masters/follow-settings";
import { listAskableKpiItemIds } from "@/lib/queries";

/**
 * 評価セット（等級区分ごとの項目選択）と、全等級区分に共通の設定の保存（会社の管理者以上）。
 *
 * 画面専用の書き込みなので、URL の口（Route Handler）ではなく Server Action に置く。
 * 成功すると runAction が refresh() を呼び、表示中の画面は保存の応答と同時に新しくなる。
 */

type Db = Awaited<ReturnType<typeof getDb>>;
type SqliteBatchItem = BatchItem<"sqlite">;

const saveSchema = z.object({
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
        /** 20点枠として選んだか（項目分類による制約なし） */
        isMajorSlot: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(20)
    .optional(),
  ratios: z
    .array(z.object({ rank: z.enum(["A", "B", "C", "D", "E"]), ratio: z.number().min(0).max(1) }))
    .optional(),
  /**
   * 画面が評価セットを読んだときの更新時刻（ミリ秒）。これより後に保存されていれば 409 で断る（DD-028 の8）。
   * 照合を飛ばして先の人の変更を消さないよう、送らない保存は受け付けない（RELIABILITY-008）。
   */
  expectedUpdatedAt: z.number().int().nonnegative(),
});

/** 読んだ後にほかの人が保存していたとき・同時に保存したときの文（DD-028 の8） */
const SCHEME_CONFLICT_MESSAGE =
  "この評価セットは、ほかの人が先に保存しました。再読み込みして、最新の内容を確かめてから保存してください。";

type Snapshot = Record<string, unknown>;

/**
 * 制度の変更の記録に残す、評価セットのこの保存で触る部分。
 * 記録は変わった列だけを残すので、項目の組と割合は1つの文字列にして比べる（配列は中身が同じでも別物になるため）。
 */
async function schemeSnapshot(
  db: Db,
  scheme: typeof s.evaluationSchemes.$inferSelect,
  input: z.infer<typeof saveSchema>,
): Promise<Snapshot> {
  const snapshot: Snapshot = {};
  if (input.pointGroup) {
    const rows = await db
      .select({ kpiItemId: s.schemeItems.kpiItemId, isFixedSlot: s.schemeItems.isFixedSlot, isMajorSlot: s.schemeItems.isMajorSlot })
      .from(s.schemeItems)
      .where(and(eq(s.schemeItems.schemeId, scheme.id), eq(s.schemeItems.pointGroup, input.pointGroup)))
      .orderBy(s.schemeItems.displayOrder);
    snapshot[`items:${input.pointGroup}`] = JSON.stringify(rows.map(slotEntry));
  }
  if (input.ratios) {
    const rows = await db
      .select({ rank: s.schemeRankRatios.rank, ratio: s.schemeRankRatios.ratio })
      .from(s.schemeRankRatios)
      .where(eq(s.schemeRankRatios.schemeId, scheme.id))
      .orderBy(s.schemeRankRatios.rank);
    snapshot.ratios = JSON.stringify(rows.map((r) => [r.rank, r.ratio]));
  }
  if (input.raiseRequiresAllA !== undefined) snapshot.raiseRequiresAllA = scheme.raiseRequiresAllA;
  if (input.scoringMode !== undefined) snapshot.scoringMode = scheme.scoringMode;
  return snapshot;
}

/** 選んだ項目を「項目 id と枠」の1組にする（記録の前後で同じ形にそろえる） */
function slotEntry(item: { kpiItemId: string; isFixedSlot: boolean; isMajorSlot?: boolean | null }): [string, string] {
  return [item.kpiItemId, item.isFixedSlot ? "fixed" : item.isMajorSlot ? "major" : "minor"];
}

/** 保存の後の姿。送られた値だけを前の姿に重ねる */
function savedSnapshot(before: Snapshot, input: z.infer<typeof saveSchema>): Snapshot {
  const after: Snapshot = { ...before };
  if (input.pointGroup && input.items) after[`items:${input.pointGroup}`] = JSON.stringify(input.items.map(slotEntry));
  if (input.ratios) {
    after.ratios = JSON.stringify([...input.ratios].sort((a, b) => a.rank.localeCompare(b.rank)).map((r) => [r.rank, r.ratio]));
  }
  if (input.raiseRequiresAllA !== undefined) after.raiseRequiresAllA = input.raiseRequiresAllA;
  if (input.scoringMode !== undefined) after.scoringMode = input.scoringMode;
  return after;
}

/**
 * 評価セットの更新時刻を進める文・制度の変更の記録の文と、送られた書き込みを1つの batch で書く。
 *
 * 2人が同じ時刻に読んで同時に保存すると、記録の番号（seq）が重なって一意索引で後の保存が止まる。
 * 後の保存は何も書かれていないので、上書きせずに 409 で断る（先の人の変更を黙って消さない）。
 */
async function writeScheme(
  db: Db,
  args: { scheme: typeof s.evaluationSchemes.$inferSelect; companyId: string; actorId: string; input: z.infer<typeof saveSchema> },
  statements: SqliteBatchItem[],
): Promise<void> {
  const { scheme, companyId, actorId, input } = args;
  const before = await schemeSnapshot(db, scheme, input);
  const events = await constitutionEventStatements({
    db,
    companyId,
    entityType: "evaluationScheme",
    entityId: scheme.id,
    eventType: "updated",
    actorId,
    before,
    after: savedSnapshot(before, input),
  });
  try {
    await batchAll(db, [
      ...statements,
      db.update(s.evaluationSchemes).set({ updatedAt: new Date() }).where(eq(s.evaluationSchemes.id, scheme.id)),
      ...events,
    ]);
  } catch (error) {
    if (isConstitutionSeqConflict(error)) throw new HttpError(409, SCHEME_CONFLICT_MESSAGE);
    throw error;
  }
}

/**
 * 全等級区分に共通の設定（昇給の条件・ランクの割合）を書く文。
 *
 * 項目の保存と一緒でも、共通の設定だけでも同じ文を通す。
 * 2箇所に書くと、片方だけ直したときに「入口から保存したときだけ効かない」が起きる。
 * 実行はしない。呼び出し側が項目の入れ替えと一緒に1つの batch で書く。
 */
function commonStatements(
  db: Db,
  schemeId: string,
  companyId: string,
  input: z.infer<typeof saveSchema>,
): SqliteBatchItem[] {
  const statements: SqliteBatchItem[] = [];
  if (input.ratios) {
    statements.push(db.delete(s.schemeRankRatios).where(eq(s.schemeRankRatios.schemeId, schemeId)));
    statements.push(
      db.insert(s.schemeRankRatios).values(
        input.ratios.map((r) => ({
          id: newId("srr"),
          companyId,
          schemeId,
          rank: r.rank,
          ratio: r.ratio,
          isProvisional: false,
        })),
      ),
    );
  }

  if (input.raiseRequiresAllA !== undefined || input.scoringMode !== undefined) {
    statements.push(
      db
        .update(s.evaluationSchemes)
        .set({
          ...(input.raiseRequiresAllA !== undefined ? { raiseRequiresAllA: input.raiseRequiresAllA } : {}),
          ...(input.scoringMode !== undefined ? { scoringMode: input.scoringMode } : {}),
        })
        .where(eq(s.evaluationSchemes.id, schemeId)),
    );
  }
  return statements;
}

/**
 * 評価セット（等級区分ごとの項目選択）の保存。会社の管理者以上のみ。
 *
 * 配点は送られた値を一切使わず grade_point_rules から決める。
 * 固定枠・20点枠・件数・配点も、画面を通さずに送られた場合に備えて
 * ここで必ず確かめる（画面が正しく送ることに依存しない）。
 */
export async function saveScheme(raw: unknown) {
  return runAction({ operation: "scheme.save", input: saveSchema }, raw, async ({ viewer, input }) => {
    assertCompanyChosen(viewer);
    const companyId = viewer.companyId;
    const db = await getDb();

    const scheme = (
      await db
        .select()
        .from(s.evaluationSchemes)
        .where(and(eq(s.evaluationSchemes.id, input.schemeId), eq(s.evaluationSchemes.companyId, companyId)))
        .limit(1)
    )[0];
    if (!scheme) throw new HttpError(404, "評価セットが見つかりませんでした。");
    if (scheme.updatedAt.getTime() > input.expectedUpdatedAt) {
      throw new HttpError(409, SCHEME_CONFLICT_MESSAGE);
    }
    const writeArgs = { scheme, companyId, actorId: viewer.id, input };

    /* 全等級区分に共通の設定（昇給の条件）だけの保存。
       等級区分ごとの項目には一切触らない（別の等級区分の設定を巻き込まないため）。 */
    if (!input.items || !input.pointGroup) {
      if (input.items || input.pointGroup) {
        throw new HttpError(400, "どの等級区分の設定かが分かりませんでした。画面を開き直してからもう一度お試しください。");
      }
      if (input.raiseRequiresAllA === undefined && input.scoringMode === undefined && !input.ratios) {
        throw new HttpError(400, "保存する内容がありませんでした。");
      }
      await writeScheme(db, writeArgs, commonStatements(db, scheme.id, companyId, input));
      // ランクの割合は点に効くので確定前の評価を集計し直す。昇給の条件は点にも設問にも効かないので追従させない
      const follow = input.ratios
        ? await followSettings(db, { companyId, actorId: viewer.id, kinds: ["rankCriteriaSet"] })
        : "";
      return { message: `全等級区分に共通の設定を保存しました。${follow}`, warnings: [] as string[] };
    }
    const items = input.items;
    const pointGroup = input.pointGroup;

    const [ruleRow] = await db
      .select()
      .from(s.gradePointRules)
      .where(and(eq(s.gradePointRules.companyId, companyId), eq(s.gradePointRules.pointGroup, pointGroup)))
      .limit(1);
    if (!ruleRow) {
      throw new HttpError(400, "この等級区分の配点ルールが登録されていません。");
    }
    /* 区分は鍵（pointGroup）で照合し、利用者に返す文には会社の等級名から作った呼び名を出す */
    const groupGrades = await db
      .select({ name: s.grades.name, pointGroup: s.grades.pointGroup, displayOrder: s.grades.displayOrder })
      .from(s.grades)
      .where(and(eq(s.grades.companyId, companyId), eq(s.grades.pointGroup, pointGroup)));
    const groupLabel = pointGroupLabel(pointGroup, groupGrades);
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
    // 設問のひな形が無い項目は、アンケートに設問が出ない。これも検証側で知らせる
    const askableItemIds = await listAskableKpiItemIds(companyId);

    const selections = items.map((i) => ({
      kpiItemId: i.kpiItemId,
      categoryId: i.categoryId,
      isFixedSlot: i.isFixedSlot,
      isMajorSlot: i.isMajorSlot ?? false,
      // 配点は送られた値を使わない。等級区分の型から決める。
      weight: pointsForSlot(rule, slotKindOf({ isFixedSlot: i.isFixedSlot, isMajorSlot: i.isMajorSlot ?? false })),
    }));

    const v = validateScheme(selections, {
      rule,
      fixedSlotItemIds: kpiItems.filter((k) => k.isFixedSlot).map((k) => k.id),
      ratedItemIds,
      askableItemIds,
      itemNameOf: (id) => kpiItems.find((k) => k.id === id)?.name ?? id,
      groupLabel,
    });
    if (!v.ok) throw new HttpError(400, v.errors.join(" "));

    /* 保存はこの等級区分ぶんだけ入れ替える。
       ほかの等級区分の設定に触らないのは、タブを切り替えながら1つずつ保存する画面のため。
       古い項目の削除・新しい項目・共通の設定を1つの batch で書く。
       途中で止まって「項目が空のまま」「項目だけ新しく共通の設定は古い」を残さない。 */
    const itemRows = selections.map((i, idx) => ({
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
    }));
    await writeScheme(db, writeArgs, [
      db
        .delete(s.schemeItems)
        .where(and(eq(s.schemeItems.schemeId, scheme.id), eq(s.schemeItems.pointGroup, pointGroup))),
      // D1 は1文に載せられる値の数に上限がある。20項目を1文にすると超えるので分ける
      ...chunkRowsForD1(itemRows).map((rows) => db.insert(s.schemeItems).values(rows)),
      ...commonStatements(db, scheme.id, companyId, input),
    ]);
    const follow = await followSettings(db, { companyId, actorId: viewer.id, kinds: ["scheme"] });

    return {
      message:
        `${groupLabel}の評価セット（${selections.length}項目・${v.total}点）を保存しました。` +
        "確定済みの評価は判定当時の設定のまま残るため、過去の結果は変わりません。" +
        follow,
      // 保存はできたが伝えるべきこと（ランク基準が未定義の項目など）。画面がそのまま出す。
      warnings: v.warnings,
    };
  });
}
