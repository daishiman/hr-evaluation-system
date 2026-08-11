import { and, eq, inArray } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { getDb } from "@/lib/db";
import { HttpError } from "@/lib/session";
import { bandSetBlockedReason, deleteBlockedReason } from "@/lib/domain/master-delete";
import {
  bandSetUsedBy,
  behaviorGuidelineUsage,
  gradeRequirementUsage,
  promotionRequirementUsage,
} from "@/lib/master-usage";
import type { MasterDeleteBody } from "./body-schema";

type Db = Awaited<ReturnType<typeof getDb>>;

/**
 * 制度設定の項目を完全に消す。
 *
 * 消してよいのは「どこからも参照されていないもの」だけ。判定はここで必ず行う
 * （画面がボタンを出していないだけの状態にしない）。会社の境界も、対象を取り出す
 * ときに company_id で必ず絞る（他社の id を送られても見つからない扱いになる）。
 *
 * 消せないときは 400 で理由を返す。画面はその文をそのまま出す。
 */
export async function deleteMasterItem(args: {
  db: Db;
  companyId: string;
  body: MasterDeleteBody;
}): Promise<{ message: string }> {
  const { db, companyId, body } = args;

  switch (body.kind) {
    case "behaviorGuideline": {
      const row = (
        await db
          .select({ id: s.behaviorGuidelines.id, aspectName: s.behaviorGuidelines.aspectName })
          .from(s.behaviorGuidelines)
          .where(and(eq(s.behaviorGuidelines.id, body.id), eq(s.behaviorGuidelines.companyId, companyId)))
          .limit(1)
      )[0];
      if (!row) throw new HttpError(404, "行動指針の観点が見つかりませんでした。");

      const usage = await behaviorGuidelineUsage(db, companyId);
      const blocked = deleteBlockedReason(usage[row.id] ?? []);
      if (blocked) throw new HttpError(400, blocked);

      /* 5段階の文章は観点にぶら下がっているので一緒に消す。
         外部キーの連鎖に任せず自分で消す（D1 は接続ごとに外部キーの設定が変わりうる）。 */
      await db.delete(s.behaviorLevels).where(eq(s.behaviorLevels.guidelineId, row.id));
      await db.delete(s.behaviorGuidelines).where(eq(s.behaviorGuidelines.id, row.id));
      return { message: `「${row.aspectName}」を消しました。一覧から無くなります。` };
    }

    case "behaviorBandSet": {
      const set = (
        await db
          .select({ id: s.behaviorBandSets.id, code: s.behaviorBandSets.code, name: s.behaviorBandSets.name })
          .from(s.behaviorBandSets)
          .where(and(eq(s.behaviorBandSets.id, body.id), eq(s.behaviorBandSets.companyId, companyId)))
          .limit(1)
      )[0];
      if (!set) throw new HttpError(404, "行動指針の基準が見つかりませんでした。");

      const usingGrades = await db
        .select({ name: s.grades.name })
        .from(s.grades)
        .where(and(eq(s.grades.companyId, companyId), eq(s.grades.behaviorBand, set.code)));
      const guidelines = await db
        .select({ id: s.behaviorGuidelines.id })
        .from(s.behaviorGuidelines)
        .where(and(eq(s.behaviorGuidelines.companyId, companyId), eq(s.behaviorGuidelines.band, set.code)));

      const usage = await behaviorGuidelineUsage(db, companyId);
      const blocked = bandSetBlockedReason(
        usingGrades.map((g) => g.name),
        bandSetUsedBy(guidelines.map((g) => g.id), usage),
      );
      if (blocked) throw new HttpError(400, blocked);

      if (guidelines.length > 0) {
        const ids = guidelines.map((g) => g.id);
        await db.delete(s.behaviorLevels).where(inArray(s.behaviorLevels.guidelineId, ids));
        await db.delete(s.behaviorGuidelines).where(inArray(s.behaviorGuidelines.id, ids));
      }
      await db.delete(s.behaviorBandSets).where(eq(s.behaviorBandSets.id, set.id));
      return {
        message:
          `「${set.name}」を消しました` +
          (guidelines.length > 0 ? `（中に入っていた観点${guidelines.length}件も一緒に消えました）。` : "。"),
      };
    }

    case "gradeRequirement": {
      const row = (
        await db
          .select({ id: s.gradeRequirements.id, text: s.gradeRequirements.text })
          .from(s.gradeRequirements)
          .where(and(eq(s.gradeRequirements.id, body.id), eq(s.gradeRequirements.companyId, companyId)))
          .limit(1)
      )[0];
      if (!row) throw new HttpError(404, "等級要件が見つかりませんでした。");

      const usage = await gradeRequirementUsage(db, companyId);
      const blocked = deleteBlockedReason(usage[row.id] ?? []);
      if (blocked) throw new HttpError(400, blocked);

      await db.delete(s.gradeRequirements).where(eq(s.gradeRequirements.id, row.id));
      return { message: `「${row.text}」を消しました。一覧から無くなります。` };
    }

    case "promotionRequirement": {
      const row = (
        await db
          .select({ id: s.promotionRequirements.id, text: s.promotionRequirements.text })
          .from(s.promotionRequirements)
          .where(and(eq(s.promotionRequirements.id, body.id), eq(s.promotionRequirements.companyId, companyId)))
          .limit(1)
      )[0];
      if (!row) throw new HttpError(404, "昇格要件が見つかりませんでした。");

      const usage = await promotionRequirementUsage(db, companyId);
      const blocked = deleteBlockedReason(usage[row.id] ?? []);
      if (blocked) throw new HttpError(400, blocked);

      await db.delete(s.promotionRequirements).where(eq(s.promotionRequirements.id, row.id));
      return { message: `「${row.text}」を消しました。一覧から無くなります。` };
    }
  }
}
