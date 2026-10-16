import { Disclosure, InlineDetail } from "@/components/ui";
import { BLOCKED_HELP_LABEL, BLOCKED_KEEP, BLOCKED_WHAT, BLOCKED_WHY, blockedMark } from "@/lib/domain/master-delete";
import type { UsageMap } from "@/lib/master-usage";

/**
 * 「使用中（◯件）」を押したときに出す、使っている場所の一覧。
 *
 * 行に残すのは「使用中（◯件）」という事実だけ（master-delete.ts の blockedMark）で、
 * どこで使っているかはここに入れる。
 *
 * 場所の名前をつないで1行にしない。アンケート名は差し込みで長く、
 * 2件つないだだけで70文字を超える1行になっていた（実測）。
 * ここは押して開いた先なので省略する理由も無く、先頭2件ではなく**全件**を出す。
 * 名前は読む文ではなく探すものなので、文ではなく並びにする。
 */
export function UsedByDetail({ mark, usedBy }: { mark: string; usedBy: readonly string[] }) {
  return (
    <InlineDetail summary={mark}>
      <p className="m-0 text-sub">この項目を使っている場所です。</p>
      <ul className="m-0 mt-1 list-disc pl-5 text-sub">
        {usedBy.map((place, i) => (
          // 同じ名前の場所が2つあり得る（同名のアンケート）ため、並び順も鍵に混ぜる
          <li key={`${i}-${place}`}>{place}</li>
        ))}
      </ul>
    </InlineDetail>
  );
}

/**
 * 使用中の行を消せない理由と、代わりにできること（spec §22-5）。
 * どの行でも同じ文なので、行には置かず、一覧の下に1つだけ置く（等級要件・昇格要件・行動指針の観点・基準セット）。
 * 出すかどうかは呼ぶ側が決める。使用中の行が1つも無い画面には出さない（関わりのない説明を並べない）。
 * KPI 項目・KPI カテゴリは線引きと文が違う（master-delete.ts の KPI_*）ので、これを使わない。
 */
export function BlockedHelp() {
  return (
    <Disclosure summary={BLOCKED_HELP_LABEL}>
      <p className="m-0 text-sub">{BLOCKED_WHY}</p>
      <p className="m-0 mt-1 text-sub">{BLOCKED_KEEP}</p>
      <p className="m-0 mt-1 text-sub">{BLOCKED_WHAT}</p>
    </Disclosure>
  );
}

/**
 * 行ごとの使っている場所（usedByOf）と印（markOf）、使用中の行が1つでもあるか（anyBlocked）。
 * 行の印と、一覧の下の理由を出すかどうかを同じ数え方で決めるため、画面ごとに書き直さない。
 */
export function blockedRows(usage: UsageMap, rows: readonly { id: string }[]) {
  const usedByOf = (id: string) => usage[id] ?? [];
  return {
    usedByOf,
    markOf: (id: string) => blockedMark(usedByOf(id)),
    anyBlocked: rows.some((r) => usedByOf(r.id).length > 0),
  };
}
