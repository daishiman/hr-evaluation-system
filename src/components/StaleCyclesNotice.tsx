import { Card, InlineDetail } from "@/components/ui";
import { SetupGapList } from "@/components/SetupGapList";
import { staleCycleGaps } from "@/lib/domain/setup-gaps";

/**
 * 「基準を変えたのに、集計し直していない評価がある」ことの知らせ。
 *
 * 再集計対象の制度設定はいくつかの画面に分かれているが、変更後に伝える内容は
 * 同じなので、文言と出し方をここ1つに集める。
 */
export interface StaleCycle {
  cycleId: string;
  cycleName: string;
  recomputable: number;
  finalized: number;
}

export function StaleCyclesNotice({ cycles }: { cycles: StaleCycle[] }) {
  if (cycles.length === 0) return null;
  // 集計し直せる期間は、ほかの設定不足と同じ「何が・どう直す・どこで」の組で出す（setup-gaps.ts）
  const gaps = staleCycleGaps(cycles);
  // 確定済みしかない期間は直すものが無いので、据え置きの事実だけを添える
  const settled = cycles.filter((c) => c.recomputable === 0);
  const settledNote = (
    <>
      {settled.length > 0 && (
        <ul className="m-0 mt-2 list-disc pl-5 text-sub">
          {settled.map((c) => (
            <li key={c.cycleId}>
              {c.cycleName}：確定済み {c.finalized}件は、判定した当時の基準のまま据え置かれます。
            </li>
          ))}
        </ul>
      )}
      {/* いま必要なのは「何ができるか」だけ。動かない理由は押したときに読めればよい。 */}
      <div className="mt-2">
        <InlineDetail summary="確定済みの評価が動かない理由">
          <p className="m-0">確定済みの評価は、判定した当時の値を控えています。</p>
          <p className="m-0 mt-1">そのため、現在の基準では集計し直しません。</p>
        </InlineDetail>
      </div>
    </>
  );

  if (gaps.length > 0) {
    return (
      <SetupGapList gaps={gaps} title="基準を変えたあと、集計し直していない評価があります">
        {settledNote}
      </SetupGapList>
    );
  }
  return (
    <Card className="card-pad">
      <p className="m-0 text-sub font-bold">基準を変える前に確定した評価があります</p>
      {settledNote}
    </Card>
  );
}
