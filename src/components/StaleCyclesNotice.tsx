import Link from "next/link";
import { Card } from "@/components/ui";

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
      <p className="m-0 text-[13px] font-bold">
        {hasRecomputable
          ? "基準を変えたあと、集計し直していない評価があります"
          : "基準を変える前に確定した評価があります"}
      </p>
      <ul className="m-0 mt-2 list-disc pl-5 text-[13px]">
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
      <p className="footnote m-0 mt-2">
        {hasRecomputable
          ? "確認中の評価だけを現在の基準で集計し直せます。確定済みの評価は、判定した当時の値を控えているため動きません。"
          : "確定済みの評価は、判定した当時の値を控えているため、現在の基準では集計し直しません。"}
      </p>
    </Card>
  );
}
