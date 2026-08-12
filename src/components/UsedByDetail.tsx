import { InlineDetail } from "@/components/ui";

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
