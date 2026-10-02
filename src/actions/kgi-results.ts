"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { runAction } from "@/lib/action";
import { getDb, schema as s } from "@/lib/db";
import { batchAll, type BatchStatement } from "@/lib/db-batch";
import { newId } from "@/lib/id";
import { officeKgiRateStatements } from "@/lib/kgi-apply";
import { assertCompanyChosen, HttpError } from "@/lib/session";

/**
 * 事業所KGIの達成率の登録・変更（会社の管理者以上）。
 *
 * 賞与の個人Pt（＝KPI評価点合計 × 達成係数）を出すために要る実績値。
 * アンケートには聞く設問が無く、元スプレッドシートでも別表から手で持ってきていたため、
 * ここから人が登録する。
 *
 * 保存すると、そのサイクル・その事業所の **確認中の評価だけ** に個人Pt・賞与額を入れる。
 * 確定済みの評価は書き換えない（過去評価の不変性）。据え置いた件数は返り値に含める。
 *
 * 画面専用の書き込みなので、URL の口（Route Handler）ではなく Server Action に置く。
 * 成功すると runAction が refresh() を呼び、一覧は保存の応答と同時に新しくなる。
 */

const kgiResultSchema = z.object({
  officeId: z.string().min(1),
  cycleId: z.string().min(1),
  /* 達成率（%）。1000% は現実的にあり得ないが、桁を1つ間違えた入力（例: 1050）を
     そのまま受けると係数1.5で賞与が跳ね上がるため、上限で止める。 */
  achievementRate: z
    .number({ error: "達成率は数字で入力してください。" })
    .min(0, { error: "達成率は0%以上で入力してください。" })
    .max(1000, { error: "達成率が大きすぎます。桁を間違えていないかご確認ください（1000%まで）。" }),
  reason: z.string().max(200).nullable().optional(),
  note: z.string().max(300).nullable().optional(),
});

export async function saveKgiResult(raw: unknown) {
  return runAction({ role: "COMPANY_ADMIN", input: kgiResultSchema }, raw, async ({ viewer, input }) => {
    assertCompanyChosen(viewer);
    const companyId = viewer.companyId;
    const db = await getDb();

    /* 事業所もサイクルも、必ず自社のものであることを確かめてから触る。
       画面の選択肢に出していなくても、IDを差し替えて送られる可能性があるため。 */
    const office = (
      await db
        .select({ id: s.offices.id, name: s.offices.name })
        .from(s.offices)
        .where(and(eq(s.offices.id, input.officeId), eq(s.offices.companyId, companyId)))
        .limit(1)
    )[0];
    if (!office) throw new HttpError(404, "事業所が見つかりませんでした。");

    const cycle = (
      await db
        .select({ id: s.evaluationCycles.id, name: s.evaluationCycles.name })
        .from(s.evaluationCycles)
        .where(and(eq(s.evaluationCycles.id, input.cycleId), eq(s.evaluationCycles.companyId, companyId)))
        .limit(1)
    )[0];
    if (!cycle) throw new HttpError(404, "評価期間が見つかりませんでした。");

    const current = (
      await db
        .select()
        .from(s.officeKgiResults)
        .where(
          and(
            eq(s.officeKgiResults.companyId, companyId),
            eq(s.officeKgiResults.officeId, input.officeId),
            eq(s.officeKgiResults.cycleId, input.cycleId),
          ),
        )
        .limit(1)
    )[0];

    const changed = !current || current.achievementRate !== input.achievementRate;

    /* 達成率の行・変更履歴・評価の賞与欄は1つの batch で書く。
       別々に書くと、途中で失敗したときに「値は変わったのに履歴が無い」
       「達成率は変わったのに賞与額は古いまま」という状態が残りうる。 */
    const statements: BatchStatement[] = [
      current
        ? db
            .update(s.officeKgiResults)
            .set({
              achievementRate: input.achievementRate,
              note: input.note ?? current.note,
              recordedById: viewer.id,
            })
            .where(eq(s.officeKgiResults.id, current.id))
        : db.insert(s.officeKgiResults).values({
            id: newId("okr"),
            companyId,
            officeId: input.officeId,
            cycleId: input.cycleId,
            achievementRate: input.achievementRate,
            note: input.note ?? null,
            recordedById: viewer.id,
          }),
    ];

    /* 値が動いたときだけ履歴を1行残す（昇給額の改定履歴と同じ作法）。
       賞与額の根拠になる数字なので、あとから「誰がいつ何％に変えたか」を説明できるようにする。 */
    if (changed) {
      statements.push(
        db.insert(s.officeKgiRevisions).values({
          id: newId("okrev"),
          companyId,
          officeId: input.officeId,
          cycleId: input.cycleId,
          beforeRate: current?.achievementRate ?? null,
          afterRate: input.achievementRate,
          reason: input.reason || null,
          revisedById: viewer.id,
        }),
      );
    }

    const recalc = await officeKgiRateStatements(db, companyId, input.officeId, input.cycleId, input.achievementRate);
    await batchAll(db, [...statements, ...recalc.statements]);
    const applied = recalc.result;

    /* 何が起きたかを、画面にそのまま出せる日本語で返す。
       「保存しました」だけだと、確定済みが据え置かれたことに気づけない。 */
    const parts: string[] = [
      `${office.name}の${cycle.name}の達成率を ${input.achievementRate}% として保存しました。`,
    ];
    if (changed && current) parts.push(`（${current.achievementRate}% から変更したため、変更履歴に記録しました）`);
    else if (changed) parts.push("（初めての登録として変更履歴に記録しました）");
    else parts.push("（達成率は変わっていないため履歴は増えていません）");

    if (applied.updated > 0) {
      parts.push(
        applied.unmatched > 0
          ? `確認中の評価 ${applied.updated}件を見直しましたが、この達成率に当てはまる達成係数が表にありません。個人Pt・賞与額は出せないままです。`
          : `確認中の評価 ${applied.updated}件に個人Pt・賞与額を反映しました。`,
      );
    } else {
      parts.push("この事業所・この評価期間には、まだ確認中の評価がありません。評価を集計すると個人Pt・賞与額が入ります。");
    }
    if (applied.skippedFinalized > 0) {
      parts.push(`確定済みの評価 ${applied.skippedFinalized}件は、確定した時点の内容のまま据え置きました（書き換えません）。`);
    }
    if (applied.yenPerPointMissing && applied.unmatched === 0 && applied.updated > 0) {
      parts.push("1点あたりの金額が未設定です。個人Ptのみで、賞与額は出していません。昇給の設定で登録できます。");
    }

    const warnings = [...applied.coverageProblems];
    if (applied.unmatched > 0) {
      warnings.push(`達成率 ${input.achievementRate}% に当てはまる達成係数が表にありません。「事業所KGIの達成率」の達成係数をご確認ください。`);
    }

    return {
      message: parts.join(""),
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  });
}
