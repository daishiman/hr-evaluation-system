import { and, eq, inArray } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { getDb } from "@/lib/db";
import { HttpError } from "@/lib/session";
import { newId } from "@/lib/id";
import { BEHAVIOR_LEVEL_TEMPLATE, defaultLevelText, nextDisplayOrder } from "@/lib/domain/behavior";
import type { MasterUpdateBody } from "./body-schema";

type Db = Awaited<ReturnType<typeof getDb>>;

type BehaviorBody = Extract<
  MasterUpdateBody,
  { kind: "behaviorBandSet" | "behaviorGuideline" | "behaviorLevel" }
>;

/**
 * 行動指針（基準セット・観点・段階文言）の更新。
 * 等級への割当は grade 更新側。ここはセット本体と中身だけを扱う。
 */
export async function applyBehaviorMasterUpdate(args: {
  db: Db;
  companyId: string;
  body: BehaviorBody;
}): Promise<{ message: string }> {
  const { db, companyId, body } = args;

  const ensure = async (rows: { id: string }[], label: string) => {
    if (rows.length === 0) throw new HttpError(404, `${label}が見つかりませんでした。`);
  };

  switch (body.kind) {
    case "behaviorBandSet": {
      const sets = await db
        .select()
        .from(s.behaviorBandSets)
        .where(eq(s.behaviorBandSets.companyId, companyId));

      /* ── 既存セットの呼び名を変える／使用を止める・再開する ── */
      if (body.id) {
        const current = sets.find((set) => set.id === body.id);
        if (!current) throw new HttpError(404, "行動指針の基準が見つかりませんでした。");

        const renameTo = body.name?.trim();
        if (renameTo !== undefined && sets.some((set) => set.id !== current.id && set.name === renameTo)) {
          throw new HttpError(400, `「${renameTo}」という基準はすでにあります。別の呼び名にしてください。`);
        }

        /* 使用中（どれかの等級に出す設定になっている）セットは止めさせない。
           止められると、その等級のアンケートから行動指針が黙って消える。
           「先に等級の割り当てを変える」という順番を強制して、消える瞬間を人が決められるようにする。 */
        if (body.isActive === false) {
          const using = await db
            .select({ name: s.grades.name })
            .from(s.grades)
            .where(and(eq(s.grades.companyId, companyId), eq(s.grades.behaviorBand, current.code)));
          if (using.length > 0) {
            throw new HttpError(
              400,
              `この基準は ${using.map((g) => g.name).join("・")} に出す設定になっています。` +
                "先に「どの等級に出すか」で、ほかの基準か「適用しない」に変えてください。そのあとで使用を止められます。",
            );
          }
        }

        await db
          .update(s.behaviorBandSets)
          .set({
            ...(renameTo !== undefined ? { name: renameTo } : {}),
            ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          })
          .where(eq(s.behaviorBandSets.id, current.id));

        if (body.isActive === false) {
          return {
            message:
              `「${current.name}」の使用を止めました。次に作るアンケートでは選べません` +
              "（すでに公開したアンケートと確定済みの評価はそのまま残ります）。",
          };
        }
        if (body.isActive === true) return { message: `「${current.name}」をもう一度使う状態にしました。` };
        return { message: "行動指針の基準の呼び名を保存しました。" };
      }

      /* ── 新しいセットを作る（空から／既存を複製して） ── */
      const name = (body.name ?? "").trim();
      if (name === "") throw new HttpError(400, "基準の呼び名を入れてください。");
      if (sets.some((set) => set.name === name)) {
        throw new HttpError(400, `「${name}」という基準はすでにあります。別の呼び名にしてください。`);
      }

      const code = newId("band");
      await db.insert(s.behaviorBandSets).values({
        id: newId("bbs"),
        companyId,
        code,
        name,
        displayOrder: nextDisplayOrder(sets),
        isActive: true,
      });

      if (!body.copyFromBand) {
        return {
          message: `「${name}」を作りました。まだ問う内容が入っていないので、下で観点を追加してください。`,
        };
      }

      const source = sets.find((set) => set.code === body.copyFromBand);
      if (!source) throw new HttpError(404, "複製元の基準が見つかりませんでした。");

      /* 複製は「いまの中身の写し」を作る操作。複製後にどちらを直しても
         もう一方に影響しないよう、観点も5段階の文章も新しい行として作り直す。 */
      const sourceGuidelines = await db
        .select()
        .from(s.behaviorGuidelines)
        .where(and(eq(s.behaviorGuidelines.companyId, companyId), eq(s.behaviorGuidelines.band, source.code)));
      const sourceLevels = sourceGuidelines.length
        ? await db
            .select()
            .from(s.behaviorLevels)
            .where(inArray(s.behaviorLevels.guidelineId, sourceGuidelines.map((g) => g.id)))
        : [];

      for (const guideline of sourceGuidelines) {
        const newGuidelineId = newId("bg");
        await db.insert(s.behaviorGuidelines).values({
          id: newGuidelineId,
          companyId,
          band: code,
          aspect: guideline.aspect,
          aspectName: guideline.aspectName,
          seq: guideline.seq,
          isActive: guideline.isActive,
        });
        const levels = sourceLevels.filter((l) => l.guidelineId === guideline.id);
        if (levels.length > 0) {
          await db.insert(s.behaviorLevels).values(
            levels.map((level) => ({
              id: newId("blv"),
              companyId,
              guidelineId: newGuidelineId,
              score: level.score,
              label: level.label,
              text: level.text,
            })),
          );
        }
      }

      return {
        message:
          `「${source.name}」を複製して「${name}」を作りました（${sourceGuidelines.length}件の観点）。` +
          "中身はここから自由に直せます。複製元は変わりません。",
      };
    }
    case "behaviorGuideline": {
      /* ── 基準セットに新しい観点を追加する ── */
      if (!body.id) {
        const band = body.band;
        const aspectName = (body.aspectName ?? "").trim();
        if (!band) throw new HttpError(400, "どの基準に追加するかが指定されていません。");
        if (aspectName === "") throw new HttpError(400, "観点の呼び名を入れてください。");
        await ensure(
          await db
            .select({ id: s.behaviorBandSets.id })
            .from(s.behaviorBandSets)
            .where(and(eq(s.behaviorBandSets.companyId, companyId), eq(s.behaviorBandSets.code, band)))
            .limit(1),
          "行動指針の基準",
        );
        const siblings = await db
          .select({ seq: s.behaviorGuidelines.seq })
          .from(s.behaviorGuidelines)
          .where(and(eq(s.behaviorGuidelines.companyId, companyId), eq(s.behaviorGuidelines.band, band)));

        const guidelineId = newId("bg");
        await db.insert(s.behaviorGuidelines).values({
          id: guidelineId,
          companyId,
          band,
          /* aspect は (会社, 基準, 観点) の重複を止めるためだけの識別子。
             呼び名から作ると同じ名前を2度使えなくなるので、採番した値を入れる。 */
          aspect: newId("aspect"),
          aspectName,
          seq: siblings.reduce((m, x) => Math.max(m, x.seq), 0) + 1,
          isActive: true,
        });
        /* 5段階は制度の骨格なので、追加した観点にも必ず同じ点数で用意する。
           文章は下書きのまま出さないよう、続けて直してもらう前提の文言を入れる。 */
        await db.insert(s.behaviorLevels).values(
          BEHAVIOR_LEVEL_TEMPLATE.map((level) => ({
            id: newId("blv"),
            companyId,
            guidelineId,
            score: level.score,
            label: level.label,
            text: defaultLevelText(aspectName, level.label),
          })),
        );
        return {
          message: `「${aspectName}」を追加しました。5段階の文章は下書きのままなので、続けて直してください。`,
        };
      }

      await ensure(
        await db
          .select({ id: s.behaviorGuidelines.id })
          .from(s.behaviorGuidelines)
          .where(and(eq(s.behaviorGuidelines.id, body.id), eq(s.behaviorGuidelines.companyId, companyId)))
          .limit(1),
        "行動指針の観点",
      );
      await db
        .update(s.behaviorGuidelines)
        .set({
          ...(body.aspectName !== undefined ? { aspectName: body.aspectName } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        })
        .where(eq(s.behaviorGuidelines.id, body.id));
      return {
        message:
          "行動指針を保存しました。次に作るアンケートから反映されます。すでに公開したアンケートと確定済みの評価は変わりません。",
      };
    }
    case "behaviorLevel": {
      await ensure(
        await db
          .select({ id: s.behaviorLevels.id })
          .from(s.behaviorLevels)
          .where(and(eq(s.behaviorLevels.id, body.id), eq(s.behaviorLevels.companyId, companyId)))
          .limit(1),
        "行動指針の段階",
      );
      await db
        .update(s.behaviorLevels)
        .set({
          ...(body.label !== undefined ? { label: body.label } : {}),
          ...(body.text !== undefined ? { text: body.text } : {}),
        })
        .where(eq(s.behaviorLevels.id, body.id));
      return {
        message:
          "行動指針を保存しました。次に作るアンケートから反映されます。すでに公開したアンケートと確定済みの評価は変わりません。",
      };
    }
  }
}
