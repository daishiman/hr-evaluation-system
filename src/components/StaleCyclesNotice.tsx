import Link from "next/link";
import { Card, InlineDetail } from "@/components/ui";

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
  const hasRecomputable = cycles.some((cycle) => cycle.recomputable > 0);

  return (
    <Card className="card-pad">
      <p className="m-0 text-sub font-bold">
        {hasRecomputable
          ? "基準を変えたあと、集計し直していない評価があります"
          : "基準を変える前に確定した評価があります"}
      </p>
      <ul className="m-0 mt-2 list-disc pl-5 text-sub">
        {cycles.map((c) => {
          if (c.recomputable === 0) {
            return (
              <li key={c.cycleId}>
                {c.cycleName}：確定済み {c.finalized}件は、判定した当時の基準のまま据え置かれます。
              </li>
            );
          }

          return (
            <li key={c.cycleId}>
              {c.cycleName}：確認中 {c.recomputable}件が古い基準のままです
              {c.finalized > 0 && `（確定済み ${c.finalized}件は当時の基準のまま据え置き）`}。
              <Link href={`/manager/cycles?cycle=${c.cycleId}`} className="ml-1 text-[var(--brand-deep)]">
                集計し直す
              </Link>
            </li>
          );
        })}
      </ul>
      {/* いま必要なのは「何ができるか」だけ。動かない理由は押したときに読めればよい。 */}
      {hasRecomputable && (
        <p className="footnote m-0 mt-2">確認中の評価だけを、現在の基準で集計し直せます。</p>
      )}
      <InlineDetail summary="確定済みの評価が動かない理由">
        <p className="m-0">確定済みの評価は、判定した当時の値を控えています。</p>
        <p className="m-0 mt-1">そのため、現在の基準では集計し直しません。</p>
      </InlineDetail>
    </Card>
  );
}
