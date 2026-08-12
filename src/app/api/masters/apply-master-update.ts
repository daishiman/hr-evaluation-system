import { and, eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { getDb } from "@/lib/db";
import { HttpError } from "@/lib/session";
import { newId } from "@/lib/id";
import { checkKgiCoverage } from "@/lib/domain/kgi";
import { rangeLabel, type Direction } from "@/lib/domain/scoring";
import { checkBounds, checkNumberMagnitude } from "@/lib/domain/number-input";
import { checkRankBoundaries } from "@/lib/domain/rank-bounds";
import type { MasterUpdateBody } from "./body-schema";
import { applyBehaviorMasterUpdate } from "./apply-behavior-master-update";
import { applyVersionedRequirementUpdate } from "./versioned-requirement-update";
import { recordConstitutionEvent } from "@/lib/domain/constitution-events";
import { kpiItemUsage } from "@/lib/master-usage";
import { KPI_ITEM_LOCKED_NOTE, KPI_ITEM_STRUCTURAL_FIELDS } from "@/lib/domain/master-delete";

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
}): Promise<{ message: string; warnings?: string[]; id?: string; previousVersionId?: string }> {
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
        /* 行動指針の基準セットは会社ごとに作れるので、送られてきた code が
           「自社に実在し、いま使えるセットか」をここで必ず確かめる。
           画面の選択肢を絞るだけでは、他社のセットや使用停止中のセットを
           直接送られたときに素通りしてしまう。 */
        if (body.behaviorBand) {
          const set = (
            await db
              .select({ isActive: s.behaviorBandSets.isActive })
              .from(s.behaviorBandSets)
              .where(and(eq(s.behaviorBandSets.companyId, companyId), eq(s.behaviorBandSets.code, body.behaviorBand)))
              .limit(1)
          )[0];
          if (!set) throw new HttpError(404, "その行動指針の基準が見つかりませんでした。");
          if (!set.isActive) throw new HttpError(400, "その行動指針の基準は使用を止めています。もう一度使う状態にしてから割り当ててください。");
        }
        const before = (await db.select().from(s.grades).where(eq(s.grades.id, body.id)).limit(1))[0];
        const patch: Record<string, unknown> = {};
        for (const k of ["name", "targetCap", "autonomyLevel", "responsibilityLevel", "deadlineNote", "behaviorBand", "isActive"] as const) {
          if (body[k] !== undefined) patch[k] = body[k];
        }
        await db.update(s.grades).set(patch).where(eq(s.grades.id, body.id));
        await recordConstitutionEvent({
          db,
          companyId,
          entityType: "grade",
          entityId: body.id,
          eventType: "updated",
          actorId: viewerId,
          before,
          after: { ...before, ...patch },
        });
        if (Object.keys(patch).length === 1 && body.behaviorBand !== undefined) {
          return {
            message: body.behaviorBand
              ? "この等級に出す行動指針を保存しました。次に作るアンケートから反映されます。"
              : "この等級では行動指針を出さない設定にしました。次に作るアンケートから反映されます。",
          };
        }
        return { message: "等級の設定を保存しました。" };
      }
      case "threshold": {
        const before = (
          await db.select().from(s.promotionThresholds)
            .where(and(eq(s.promotionThresholds.id, body.id), eq(s.promotionThresholds.companyId, companyId))).limit(1)
        )[0];
        await ensure(before ? [before] : [], "昇格の条件");
        const patch = {
          requiredKpiPoints: body.requiredKpiPoints,
          requiredBehaviorPoints: body.requiredBehaviorPoints,
          isProvisional: false,
        };
        await db
          .update(s.promotionThresholds)
          .set(patch)
          .where(eq(s.promotionThresholds.id, body.id));
        await recordConstitutionEvent({
          db,
          companyId,
          entityType: "promotionThreshold",
          entityId: body.id,
          eventType: "updated",
          actorId: viewerId,
          before,
          after: { ...before, ...patch },
        });
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

        const patch = {
          monthlyAmount: body.monthlyAmount,
          months: body.months,
          annualAmount: body.monthlyAmount * chancesPerYear,
          ...(body.maxCount !== undefined ? { maxCount: body.maxCount } : {}),
          note: body.note ?? null,
          isProvisional: false,
        };
        await db
          .update(s.raiseSettings)
          .set(patch)
          .where(eq(s.raiseSettings.id, body.id));
        await recordConstitutionEvent({
          db,
          companyId,
          entityType: "raiseSetting",
          entityId: body.id,
          eventType: "updated",
          actorId: viewerId,
          before: current,
          after: { ...current, ...patch },
        });

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
        const before = (
          await db.select().from(s.raisePolicies)
            .where(and(eq(s.raisePolicies.id, body.id), eq(s.raisePolicies.companyId, companyId))).limit(1)
        )[0];
        await ensure(before ? [before] : [], "昇給ルール");
        const patch = {
          requiredACount: body.requiredACount,
          chancesPerYear: body.chancesPerYear,
          ...(body.allowDecrease !== undefined ? { allowDecrease: body.allowDecrease } : {}),
          ...(body.judgeUnit !== undefined ? { judgeUnit: body.judgeUnit } : {}),
          ...(body.reflectUpperNote !== undefined ? { reflectUpperNote: body.reflectUpperNote } : {}),
          ...(body.reflectLowerNote !== undefined ? { reflectLowerNote: body.reflectLowerNote } : {}),
          ...(body.targetNote !== undefined ? { targetNote: body.targetNote } : {}),
          isProvisional: false,
        };
        await db
          .update(s.raisePolicies)
          .set(patch)
          .where(eq(s.raisePolicies.id, body.id));
        await recordConstitutionEvent({
          db,
          companyId,
          entityType: "raisePolicy",
          entityId: body.id,
          eventType: "updated",
          actorId: viewerId,
          before,
          after: { ...before, ...patch },
        });
        return { message: "昇給ルールを保存しました。" };
      }
      case "office": {
        const before = (
          await db.select().from(s.offices)
            .where(and(eq(s.offices.id, body.id), eq(s.offices.companyId, companyId))).limit(1)
        )[0];
        await ensure(before ? [before] : [], "事業所");
        const patch = {
          raiseAdjustRate: body.raiseAdjustRate,
          ...(body.name !== undefined ? { name: body.name } : {}),
        };
        await db
          .update(s.offices)
          .set(patch)
          .where(eq(s.offices.id, body.id));
        await recordConstitutionEvent({
          db,
          companyId,
          entityType: "office",
          entityId: body.id,
          eventType: "updated",
          actorId: viewerId,
          before,
          after: { ...before, ...patch },
        });
        return { message: "事業所の設定を保存しました。" };
      }
      case "gradeRequirementCreate":
      case "gradeRequirementRevise":
      case "gradeRequirementActivation":
      case "gradeRequirementRestoreContent":
      case "gradeRequirementOrder":
      case "promotionRequirementCreate":
      case "promotionRequirementRevise":
      case "promotionRequirementActivation":
      case "promotionRequirementRestoreContent":
      case "promotionRequirementOrder":
        return applyVersionedRequirementUpdate({ db, companyId, viewerId, body });
      case "behaviorBandSet":
      case "behaviorGuideline":
      case "behaviorLevel":
        return applyBehaviorMasterUpdate({ db, companyId, viewerId, body });
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
        const mergedLower = next.lowerBound !== undefined ? next.lowerBound : merged.lowerBound;
        const mergedUpper = next.upperBound !== undefined ? next.upperBound : merged.upperBound;

        /* 桁が多すぎる値は、先に断る。あとの検査（下限>上限・隣と繋がらない）でも結果的に止まるが、
           そこで出る言葉は原因を指していない。回答の受け取りと同じ 1兆の決まりを、ここでも当てる。 */
        for (const [side, v] of [
          ["下限", mergedLower],
          ["上限", mergedUpper],
        ] as const) {
          const m = checkNumberMagnitude(`ランク基準の${side}（${v}）`, v);
          if (!m.ok) throw new HttpError(400, m.message);
        }

        /* 下限が上限より大きい（または同じ）組は、当てはまる値が1つも無い空の範囲になる。
           保存してしまうと、そのランクに誰も入らないことに気づけないので、ここで断る。
           画面でも同じ判定をしているが、画面を通さずに送られたときに素通りしないよう受け口でも見る。 */
        const bounds = checkBounds(mergedLower, mergedUpper);
        if (!bounds.ok) throw new HttpError(400, bounds.message);

        /* 1つのランクの中だけを見ても、ランク同士の重なり・隙間は防げない。
           保存したあとの姿でA〜E全体を見て、繋がらなくなるなら書き込む前に断る。
           （画面はA〜Eをまとめて保存するので、ここに来るのは画面を通さない呼び出しだけ） */
        const direction: Direction = item?.direction === "lower" ? "lower" : "higher";
        const beforeRows = await db
          .select()
          .from(s.kpiRankCriteria)
          .where(and(eq(s.kpiRankCriteria.companyId, companyId), eq(s.kpiRankCriteria.kpiItemId, current[0].kpiItemId)));
        const afterRows = beforeRows.map((r) =>
          r.id === body.id ? { rank: r.rank, lowerBound: mergedLower, upperBound: mergedUpper } : r,
        );
        const whole = checkRankBoundaries(afterRows, direction);
        if (!whole.ok) throw new HttpError(400, whole.issues.map((x) => x.message).join(" "));

        const displayLabel = rangeLabel(
          {
            lowerBound: mergedLower,
            upperBound: mergedUpper,
          },
          item?.unit ?? null,
          item?.direction === "lower" ? "lower" : "higher",
        );

        const rankPatch = {
          ...(next.lowerBound !== undefined ? { lowerBound: next.lowerBound } : {}),
          ...(next.upperBound !== undefined ? { upperBound: next.upperBound } : {}),
          displayLabel,
        };
        await db
          .update(s.kpiRankCriteria)
          .set(rankPatch)
          .where(eq(s.kpiRankCriteria.id, body.id));
        await recordConstitutionEvent({
          db,
          companyId,
          entityType: "kpiRankCriteria",
          entityId: body.id,
          eventType: "updated",
          actorId: viewerId,
          before: merged,
          after: { ...merged, ...rankPatch },
        });

        /* 以前はここで保存後に全体を見て「警告」を返していた。いまは書き込む前に断るので、
           保存できた時点でA〜Eは必ず繋がっている（警告という中途半端な状態を残さない）。 */
        return { message: "ランク基準を保存しました。" };
      }
      /**
       * ランクA〜Eをまとめて保存する。
       *
       * 1ランクずつ保存する作りだと、直している途中は必ずどこかが繋がらない。
       * そのため「保存はできるが警告だけ出す」という中途半端な状態が必要になり、
       * 結局は矛盾したまま運用できてしまっていた。まとめて受け取れば、
       * **繋がっているものしか保存できない**と言い切れる。
       */
      case "rankCriteriaSet": {
        const item = (
          await db
            .select({ id: s.kpiItems.id, unit: s.kpiItems.unit, direction: s.kpiItems.direction })
            .from(s.kpiItems)
            .where(and(eq(s.kpiItems.id, body.kpiItemId), eq(s.kpiItems.companyId, companyId)))
            .limit(1)
        )[0];
        if (!item) throw new HttpError(404, "KPI項目が見つかりませんでした。");
        const direction: Direction = item.direction === "lower" ? "lower" : "higher";

        const siblings = await db
          .select()
          .from(s.kpiRankCriteria)
          .where(and(eq(s.kpiRankCriteria.companyId, companyId), eq(s.kpiRankCriteria.kpiItemId, item.id)));
        if (siblings.length === 0) throw new HttpError(404, "この項目にはランク基準がありません。");

        /* 送られてきた行が、すべてこの項目のものか確かめる（他社・他項目の行を混ぜられない）。 */
        const byId = new Map(siblings.map((r) => [r.id, r]));
        for (const row of body.rows) {
          if (!byId.has(row.id)) throw new HttpError(400, "この項目のランク基準ではないものが含まれています。");
        }

        const sent = new Map(body.rows.map((r) => [r.id, r]));
        const afterRows = siblings.map((r) => {
          const x = sent.get(r.id);
          return x ? { ...r, lowerBound: x.lowerBound, upperBound: x.upperBound } : r;
        });

        const whole = checkRankBoundaries(afterRows, direction);
        if (!whole.ok) throw new HttpError(400, whole.issues.map((x) => x.message).join(" "));

        await db.batch(
          afterRows.map((r) =>
            db
              .update(s.kpiRankCriteria)
              .set({
                lowerBound: r.lowerBound,
                upperBound: r.upperBound,
                displayLabel: rangeLabel(r, item.unit, direction),
              })
              .where(and(eq(s.kpiRankCriteria.id, r.id), eq(s.kpiRankCriteria.companyId, companyId))),
          ) as unknown as Parameters<typeof db.batch>[0],
        );

        const beforeById = new Map(siblings.map((r) => [r.id, r]));
        for (const r of afterRows) {
          const displayLabel = rangeLabel(r, item.unit, direction);
          await recordConstitutionEvent({
            db,
            companyId,
            entityType: "kpiRankCriteria",
            entityId: r.id,
            eventType: "updated",
            actorId: viewerId,
            before: beforeById.get(r.id) ?? null,
            after: { ...beforeById.get(r.id), lowerBound: r.lowerBound, upperBound: r.upperBound, displayLabel },
          });
        }

        return {
          message:
            "ランクA〜Eの基準を保存しました。次に集計する評価から反映されます（確定済みの評価は当時の基準のまま残ります）。",
        };
      }
      case "kgi": {
        const before = (
          await db.select().from(s.kgiCoefficients)
            .where(and(eq(s.kgiCoefficients.id, body.id), eq(s.kgiCoefficients.companyId, companyId))).limit(1)
        )[0];
        await ensure(before ? [before] : [], "達成係数");
        const kgiPatch = {
          coefficient: body.coefficient,
          isProvisional: false,
        };
        await db
          .update(s.kgiCoefficients)
          .set(kgiPatch)
          .where(eq(s.kgiCoefficients.id, body.id));
        await recordConstitutionEvent({
          db,
          companyId,
          entityType: "kgiCoefficient",
          entityId: body.id,
          eventType: "updated",
          actorId: viewerId,
          before,
          after: { ...before, ...kgiPatch },
        });

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
      case "kpiCategoryCreate": {
        const name = body.name.trim();
        const siblings = await db
          .select({ name: s.kpiCategories.name, displayOrder: s.kpiCategories.displayOrder })
          .from(s.kpiCategories)
          .where(eq(s.kpiCategories.companyId, companyId));
        if (siblings.some((c) => c.name === name)) {
          throw new HttpError(400, `「${name}」はすでにあるカテゴリ名です。別の名前にしてください。`);
        }
        const id = newId("kpicat");
        const nextOrder = siblings.reduce((max, c) => Math.max(max, c.displayOrder), 0) + 1;
        await db.insert(s.kpiCategories).values({
          id,
          companyId,
          // カテゴリの分類コード（code）は他のどこからも参照されない内部識別子。
          // 表示に使うのは name だけなので、ここでは id をそのまま使う。
          code: id,
          name,
          displayOrder: nextOrder,
        });
        await recordConstitutionEvent({
          db,
          companyId,
          entityType: "kpiCategory",
          entityId: id,
          eventType: "created",
          actorId: viewerId,
          after: { id, name, displayOrder: nextOrder },
        });
        return { message: `「${name}」を追加しました。次に作るKPI項目からこのカテゴリを選べます。`, id };
      }

      case "kpiItemCreate": {
        const name = body.name.trim();
        if (body.categoryId) {
          const cat = await db
            .select({ id: s.kpiCategories.id })
            .from(s.kpiCategories)
            .where(and(eq(s.kpiCategories.id, body.categoryId), eq(s.kpiCategories.companyId, companyId)))
            .limit(1);
          if (cat.length === 0) throw new HttpError(404, "指定したKPIカテゴリが見つかりませんでした。");
        }
        const siblings = await db.select({ no: s.kpiItems.no }).from(s.kpiItems).where(eq(s.kpiItems.companyId, companyId));
        const nextNo = siblings.reduce((max, i) => Math.max(max, i.no), 0) + 1;
        const id = newId("kpiitm");
        const values = {
          id,
          companyId,
          no: nextNo,
          name,
          categoryId: body.categoryId ?? null,
          measureType: body.measureType.trim(),
          unit: body.unit.trim(),
          direction: body.direction,
          formula: body.formula?.trim() || null,
          formulaNote: body.formulaNote?.trim() || null,
          remarks: body.remarks?.trim() || null,
          // 固定枠（等級要件達成率）は初期データにすでに1件あり、ここからは新規作成できない。
          isFixedSlot: false,
          isMonetary: body.isMonetary ?? false,
          isProvisional: body.isProvisional ?? false,
          isActive: true,
        };
        await db.insert(s.kpiItems).values(values);
        await recordConstitutionEvent({
          db,
          companyId,
          entityType: "kpiItem",
          entityId: id,
          eventType: "created",
          actorId: viewerId,
          after: values,
        });
        return {
          message: `「${name}」を追加しました。基準（A〜E）を設定すると評価セットで選べるようになります。`,
          id,
        };
      }

      case "kpiItemUpdate": {
        const before = (
          await db
            .select()
            .from(s.kpiItems)
            .where(and(eq(s.kpiItems.id, body.id), eq(s.kpiItems.companyId, companyId)))
            .limit(1)
        )[0];
        if (!before) throw new HttpError(404, "KPI項目が見つかりませんでした。");

        if (body.categoryId) {
          const cat = await db
            .select({ id: s.kpiCategories.id })
            .from(s.kpiCategories)
            .where(and(eq(s.kpiCategories.id, body.categoryId), eq(s.kpiCategories.companyId, companyId)))
            .limit(1);
          if (cat.length === 0) throw new HttpError(404, "指定したKPIカテゴリが見つかりませんでした。");
        }

        /* 一度でも使われた項目は、計算の意味が変わる列（単位・向き・実績区分・分類・金銭系）を
           ここで必ず弾く。画面側が該当欄を出さない実装であっても、API を直に叩かれた場合の
           最後の砦になる。 */
        const usage = await kpiItemUsage(db, companyId);
        const usedBy = usage[body.id] ?? [];
        const locked = usedBy.length > 0;

        const candidate: Record<string, unknown> = {
          name: body.name?.trim(),
          unit: body.unit?.trim(),
          direction: body.direction,
          measureType: body.measureType?.trim(),
          categoryId: body.categoryId,
          formula: body.formula === undefined ? undefined : body.formula?.trim() || null,
          formulaNote: body.formulaNote === undefined ? undefined : body.formulaNote?.trim() || null,
          remarks: body.remarks === undefined ? undefined : body.remarks?.trim() || null,
          isMonetary: body.isMonetary,
          isProvisional: body.isProvisional,
          isActive: body.isActive,
        };

        const patch: Record<string, unknown> = {};
        const lockedAttempts: string[] = [];
        const beforeRecord = before as unknown as Record<string, unknown>;
        for (const [key, value] of Object.entries(candidate)) {
          if (value === undefined) continue;
          if (locked && (KPI_ITEM_STRUCTURAL_FIELDS as readonly string[]).includes(key)) {
            if (value !== beforeRecord[key]) lockedAttempts.push(key);
            continue;
          }
          patch[key] = value;
        }

        if (Object.keys(patch).length > 0) {
          await db.update(s.kpiItems).set(patch).where(eq(s.kpiItems.id, body.id));
          await recordConstitutionEvent({
            db,
            companyId,
            entityType: "kpiItem",
            entityId: body.id,
            eventType: "updated",
            actorId: viewerId,
            before,
            after: { ...before, ...patch },
          });
        }

        const name = (patch.name as string | undefined) ?? before.name;
        if (lockedAttempts.length > 0) {
          return {
            message: `「${name}」を保存しました。${KPI_ITEM_LOCKED_NOTE}`,
            warnings: [KPI_ITEM_LOCKED_NOTE],
          };
        }
        if (Object.keys(patch).length === 0) {
          return { message: "変更はありませんでした。" };
        }
        return { message: `「${name}」を保存しました。` };
      }

  }
}
