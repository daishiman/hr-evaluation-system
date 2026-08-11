import { and, eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { getDb } from "@/lib/db";
import { HttpError } from "@/lib/session";
import { newId } from "@/lib/id";
import { GRADE_REQUIREMENT_MAX, swapForMove } from "@/lib/domain/grade-requirements";
import { checkKgiCoverage, checkRangeCoverage } from "@/lib/domain/kgi";
import { rangeLabel } from "@/lib/domain/scoring";
import type { MasterUpdateBody } from "./body-schema";

type Db = Awaited<ReturnType<typeof getDb>>;

/**
 * 制度マスタ1件の更新を実行する。
 * 会社境界の確認と、kind ごとの保存規則をここに集約する。
 */
export async function applyMasterUpdate(args: {
  db: Db;
  companyId: string;
  viewerId: string;
  body: MasterUpdateBody;
}): Promise<{ message: string; warnings?: string[] }> {
  const { db, companyId, viewerId, body } = args;

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
        for (const k of ["name", "targetCap", "autonomyLevel", "responsibilityLevel", "deadlineNote", "behaviorBand", "isActive"] as const) {
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
        const current = (
          await db
            .select()
            .from(s.raiseSettings)
            .where(and(eq(s.raiseSettings.id, body.id), eq(s.raiseSettings.companyId, companyId)))
            .limit(1)
        )[0];
        if (!current) throw new HttpError(404, "昇給額が見つかりませんでした。");

        /* 「年間の上昇額」＝ 1回あたりの昇給額 × 年間の昇給機会。
           元シート（昇給設定）の値がこの定義:
             Beginner 3,000円 → 6,000円 ／ Regular 4,000円 → 8,000円
             Chief 5,000円 → 10,000円 ／ Manager Ⅱ 10,000円 → 20,000円
           月額基本給が1年でいくら上がるか、という意味であって、
           半期6ヶ月分の支給総額（昇給額×6）ではない。
           昇給機会の回数は会社ごとに変えられるので raise_policies から取る。 */
        const policy = (
          await db.select().from(s.raisePolicies).where(eq(s.raisePolicies.companyId, companyId)).limit(1)
        )[0];
        const chancesPerYear = policy?.chancesPerYear ?? 2;

        await db
          .update(s.raiseSettings)
          .set({
            monthlyAmount: body.monthlyAmount,
            months: body.months,
            annualAmount: body.monthlyAmount * chancesPerYear,
            ...(body.maxCount !== undefined ? { maxCount: body.maxCount } : {}),
            note: body.note ?? null,
            isProvisional: false,
          })
          .where(eq(s.raiseSettings.id, body.id));

        // 金額が変わったときだけ改定履歴を1行残す。
        // 給与の金額は「いつ・いくらから・いくらに・なぜ変えたか」を後から説明できないと困るため。
        if (current.monthlyAmount !== body.monthlyAmount) {
          await db.insert(s.raiseRevisions).values({
            id: newId("rrev"),
            companyId,
            gradeId: current.gradeId,
            beforeAmount: current.monthlyAmount,
            afterAmount: body.monthlyAmount,
            effectiveFrom: body.effectiveFrom || null,
            reason: body.reason || null,
            revisedById: viewerId,
          });
          return { message: "昇給額を保存し、改定履歴に記録しました。" };
        }
        return { message: "昇給額を保存しました。（金額は変わっていないため履歴は増えていません）" };
      }
      case "raisePolicy": {
        await ensure(
          await db.select({ id: s.raisePolicies.id }).from(s.raisePolicies)
            .where(and(eq(s.raisePolicies.id, body.id), eq(s.raisePolicies.companyId, companyId))).limit(1),
          "昇給ルール",
        );
        await db
          .update(s.raisePolicies)
          .set({
            requiredACount: body.requiredACount,
            chancesPerYear: body.chancesPerYear,
            ...(body.allowDecrease !== undefined ? { allowDecrease: body.allowDecrease } : {}),
            ...(body.judgeUnit !== undefined ? { judgeUnit: body.judgeUnit } : {}),
            ...(body.reflectUpperNote !== undefined ? { reflectUpperNote: body.reflectUpperNote } : {}),
            ...(body.reflectLowerNote !== undefined ? { reflectLowerNote: body.reflectLowerNote } : {}),
            ...(body.targetNote !== undefined ? { targetNote: body.targetNote } : {}),
            isProvisional: false,
          })
          .where(eq(s.raisePolicies.id, body.id));
        return { message: "昇給ルールを保存しました。" };
      }
      case "office": {
        await ensure(
          await db.select({ id: s.offices.id }).from(s.offices)
            .where(and(eq(s.offices.id, body.id), eq(s.offices.companyId, companyId))).limit(1),
          "事業所",
        );
        await db
          .update(s.offices)
          .set({
            raiseAdjustRate: body.raiseAdjustRate,
            ...(body.name !== undefined ? { name: body.name } : {}),
          })
          .where(eq(s.offices.id, body.id));
        return { message: "事業所の設定を保存しました。" };
      }
      case "gradeRequirement": {
        await ownGrade(body.gradeId);
        /* 支援・運営はそれぞれ最大10項目まで（制度上の上限）。
           画面でも追加ボタンを止めているが、直接APIを叩かれても超えないようにここで止める。 */
        const activeInCategory = async (excludeId?: string) => {
          const rows = await db
            .select({ id: s.gradeRequirements.id })
            .from(s.gradeRequirements)
            .where(
              and(
                eq(s.gradeRequirements.companyId, companyId),
                eq(s.gradeRequirements.gradeId, body.gradeId),
                eq(s.gradeRequirements.category, body.category),
                eq(s.gradeRequirements.isActive, true),
              ),
            );
          return rows.filter((r) => r.id !== excludeId).length;
        };
        const label = body.category === "support" ? "支援について" : "運営について";
        if (body.id) {
          await ensure(
            await db.select({ id: s.gradeRequirements.id }).from(s.gradeRequirements)
              .where(and(eq(s.gradeRequirements.id, body.id), eq(s.gradeRequirements.companyId, companyId))).limit(1),
            "等級要件",
          );
          if (body.isActive === true && (await activeInCategory(body.id)) >= GRADE_REQUIREMENT_MAX) {
            throw new HttpError(400, `「${label}」は${GRADE_REQUIREMENT_MAX}項目までです。ほかの項目を使わない状態にしてから戻してください。`);
          }
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
        if ((await activeInCategory()) >= GRADE_REQUIREMENT_MAX) {
          throw new HttpError(400, `「${label}」は${GRADE_REQUIREMENT_MAX}項目までです。`);
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
      case "gradeRequirementOrder": {
        await ownGrade(body.gradeId);
        const rows = await db
          .select()
          .from(s.gradeRequirements)
          .where(and(eq(s.gradeRequirements.companyId, companyId), eq(s.gradeRequirements.gradeId, body.gradeId)));
        const swap = swapForMove(rows, body.category, body.id, body.direction);
        if (!swap) throw new HttpError(400, "これ以上は動かせません。");
        // 2件の並び順を入れ替える。片方だけ書き換わると順番が重複するため、まとめて実行する。
        await db.batch([
          db.update(s.gradeRequirements).set({ seq: swap[0].seq }).where(eq(s.gradeRequirements.id, swap[0].id)),
          db.update(s.gradeRequirements).set({ seq: swap[1].seq }).where(eq(s.gradeRequirements.id, swap[1].id)),
        ] as unknown as Parameters<typeof db.batch>[0]);
        return { message: "並び順を変更しました。" };
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
        return { message: "昇格要件を追加しました。次に作るアンケートから設問に載ります。" };
      }
      case "promotionRequirementOrder": {
        await ownGrade(body.gradeId);
        const rows = await db
          .select()
          .from(s.promotionRequirements)
          .where(and(eq(s.promotionRequirements.companyId, companyId), eq(s.promotionRequirements.gradeId, body.gradeId)));
        // 並べ替えの決まりは等級要件と同じ。区分の列名だけ違う（category ↔ kind）ので合わせて渡す。
        const swap = swapForMove(
          rows.map((r) => ({ id: r.id, category: r.kind, seq: r.seq, text: r.text, isActive: r.isActive })),
          body.reqKind,
          body.id,
          body.direction,
        );
        if (!swap) throw new HttpError(400, "これ以上は動かせません。");
        await db.batch([
          db.update(s.promotionRequirements).set({ seq: swap[0].seq }).where(eq(s.promotionRequirements.id, swap[0].id)),
          db.update(s.promotionRequirements).set({ seq: swap[1].seq }).where(eq(s.promotionRequirements.id, swap[1].id)),
        ] as unknown as Parameters<typeof db.batch>[0]);
        return { message: "並び順を変更しました。" };
      }
      case "behaviorGuideline": {
        await ensure(
          await db.select({ id: s.behaviorGuidelines.id }).from(s.behaviorGuidelines)
            .where(and(eq(s.behaviorGuidelines.id, body.id), eq(s.behaviorGuidelines.companyId, companyId))).limit(1),
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
            "行動指針を保存しました。次に作るアンケートから反映されます（すでに公開したアンケートと確定済みの評価は変わりません）。",
        };
      }
      case "behaviorLevel": {
        await ensure(
          await db.select({ id: s.behaviorLevels.id }).from(s.behaviorLevels)
            .where(and(eq(s.behaviorLevels.id, body.id), eq(s.behaviorLevels.companyId, companyId))).limit(1),
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
            "行動指針を保存しました。次に作るアンケートから反映されます（すでに公開したアンケートと確定済みの評価は変わりません）。",
        };
      }
      case "rankCriteria": {
        const current = (
          await db
            .select({ id: s.kpiRankCriteria.id, kpiItemId: s.kpiRankCriteria.kpiItemId })
            .from(s.kpiRankCriteria)
            .where(and(eq(s.kpiRankCriteria.id, body.id), eq(s.kpiRankCriteria.companyId, companyId)))
            .limit(1)
        );
        await ensure(current, "ランク基準");

        /* 「画面に出す表記」は受け取らない。判定に使うのは下限・上限の数値だけなので、
           文言を人が別に書けるようにすると、書いてある範囲と実際に判定される範囲が
           食い違う（説明文だけが嘘になる）。単位と向きを見て、こちらで作る。 */
        const item = (
          await db
            .select({ unit: s.kpiItems.unit, direction: s.kpiItems.direction })
            .from(s.kpiItems)
            .where(eq(s.kpiItems.id, current[0].kpiItemId))
            .limit(1)
        )[0];
        const next = {
          lowerBound: body.lowerBound !== undefined ? body.lowerBound : undefined,
          upperBound: body.upperBound !== undefined ? body.upperBound : undefined,
        };
        const merged = (
          await db.select().from(s.kpiRankCriteria).where(eq(s.kpiRankCriteria.id, body.id)).limit(1)
        )[0];
        const displayLabel = rangeLabel(
          {
            lowerBound: next.lowerBound !== undefined ? next.lowerBound : merged.lowerBound,
            upperBound: next.upperBound !== undefined ? next.upperBound : merged.upperBound,
          },
          item?.unit ?? null,
          item?.direction === "lower" ? "lower" : "higher",
        );

        await db
          .update(s.kpiRankCriteria)
          .set({
            ...(next.lowerBound !== undefined ? { lowerBound: next.lowerBound } : {}),
            ...(next.upperBound !== undefined ? { upperBound: next.upperBound } : {}),
            displayLabel,
          })
          .where(eq(s.kpiRankCriteria.id, body.id));

        /* 保存後に、その項目のA〜Eが数直線を隙間なく・重なりなく覆えているかを見る。
           1行ずつ直す途中では必ず一時的にずれるため、保存自体は止めない。
           そのかわり「どこが抜けたか／重なったか」を日本語で返し、直し忘れを防ぐ。 */
        const target = current[0];
        const siblings = await db
          .select()
          .from(s.kpiRankCriteria)
          .where(and(eq(s.kpiRankCriteria.companyId, companyId), eq(s.kpiRankCriteria.kpiItemId, target.kpiItemId)));
        const problems = checkRangeCoverage(
          siblings
            .sort((a, b) => a.rank.localeCompare(b.rank))
            .map((r) => ({
              label: `${r.rank}（${rangeLabel(r, item?.unit ?? null, item?.direction === "lower" ? "lower" : "higher")}）`,
              lowerBound: r.lowerBound,
              upperBound: r.upperBound,
            })),
          "実績値",
        );
        if (problems.length > 0) {
          return {
            message:
              "ランク基準を保存しました。ただし、この項目の基準に次の問題があります。" +
              problems.map((p) => p.message).join(" ") +
              " このままだと、あてはまるランクが決まらない実績値や、2つのランクに同時にあてはまる実績値が出ます。",
            warnings: problems.map((p) => p.message),
          };
        }
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
            isProvisional: false,
          })
          .where(eq(s.kgiCoefficients.id, body.id));

        // 達成係数の表も、達成率の数直線を覆えているかを同じ物差しで見る
        const rows = await db.select().from(s.kgiCoefficients).where(eq(s.kgiCoefficients.companyId, companyId));
        const kgiProblems = checkKgiCoverage(rows.sort((a, b) => a.displayOrder - b.displayOrder));
        if (kgiProblems.length > 0) {
          return {
            message:
              "達成係数を保存しました。ただし次の問題があります。" +
              kgiProblems.map((p) => p.message).join(" ") +
              " このままだと、係数が決まらない達成率が出ます。",
            warnings: kgiProblems.map((p) => p.message),
          };
        }
        return { message: "達成係数を保存しました。" };
      }
    
  }
}
