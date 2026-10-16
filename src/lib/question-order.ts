import { SECTION_ORDER } from "@/lib/view";

/** 回答画面・見本に描く節の順（制度の区分順のあとに自由記入）。 */
export const SCREEN_SECTIONS: readonly string[] = [...SECTION_ORDER, "free"];

/**
 * 設問を、回答画面の上から下の順に並べた写しを返す（節は SCREEN_SECTIONS の順、節の中は保存した順）。
 *
 * 画面（「最初の未入力の欄へ移る」）と受け口（提出を断るときの「例：」）が同じ順を使う。
 * 以前は受け口が設問の行を読み出した順のまま例を選んでいたため、
 * 「例：」に挙がる設問と、画面で最初に見える未入力の欄が違うことがあった。
 * 知らない節の設問は最後に置く（数からは落とさない）。
 */
export function inScreenOrder<T extends { section: string; displayOrder: number }>(questions: readonly T[]): T[] {
  const rank = (section: string) => {
    const i = SCREEN_SECTIONS.indexOf(section);
    return i < 0 ? SCREEN_SECTIONS.length : i;
  };
  return [...questions].sort((a, b) => rank(a.section) - rank(b.section) || a.displayOrder - b.displayOrder);
}
