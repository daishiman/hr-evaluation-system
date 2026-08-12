import { Card, CardRow } from "@/components/ui";
import { formatDate } from "@/lib/view";
import { MY_PENDING_BODY, myPendingHeadline, type MyPendingCycle } from "@/lib/domain/stalled-evaluations";

/**
 * ご本人（一般）に、「その期の評価はまだ確定していない」という事実だけを出す。
 *
 * なぜ要るか:
 *  アンケートを出したあと、評価が確定されるまで本人の画面には**何も出ない**。
 *  結果が並ばないのが「まだ途中だから」なのか「自分の提出が届いていないから」なのか、
 *  本人には区別がつかない。出したのに何も返ってこない状態が、本人からは
 *  一切見えないままだった（残課題 N3）。
 *
 * 何を出さないか（意図的な欠落。詳細は lib/domain/stalled-evaluations.ts の節を見ること）:
 *  - 経過日数（何日そのままか）
 *  - 確定待ち／集計待ちの区別
 *  - 他の人の状況・件数、社内の基準値
 *  - 上長へ知らせる・急かすといった催促の導線
 *
 * ここからは何も変えない。確定も削除も再集計もしない、読むだけの知らせ。
 */
export function MyPendingResultsNotice({ cycles }: { cycles: MyPendingCycle[] }) {
  if (cycles.length === 0) return null;

  return (
    <Card className="card-pad">
      <p className="todo-row-title m-0 text-head">{myPendingHeadline(cycles)}</p>
      <p className="todo-row-sub m-0 mt-1">{MY_PENDING_BODY}</p>

      {/* 1期だけのときは、見出しで期の名前を言い切っているので行を重ねない。 */}
      {cycles.length > 1 && (
        <div className="mt-3">
          {cycles.map((cycle) => (
            <CardRow key={cycle.cycleId} title={cycle.cycleName} sub={`${formatDate(cycle.periodEnd)}までの評価期間`} />
          ))}
        </div>
      )}
    </Card>
  );
}
