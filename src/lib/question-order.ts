import { SECTION_LABEL, SECTION_ORDER } from "@/lib/view";

/**
 * 回答画面・見本に描く節の順（制度の区分順のあとに自由記入）。
 * 設問の保存の受け口（actions/forms.ts）も、受け付ける節の値をここから作る。
 */
export const SCREEN_SECTIONS: readonly string[] = [...SECTION_ORDER, "free"];

/**
 * 節の見出しの名前。回答画面・見本・提出済みの回答・組み立て画面がこの1つを使う。
 *
 * 自由記入（free）は制度の区分ではないので SECTION_LABEL に無く、ここで名前を付ける。
 * 画面ごとに書くと、自由記入の節だけ英字の "free" のまま出る画面が残る（組み立て画面がそうなっていた）。
 * 知らない節は値のまま出す（見出しを空にしない）。
 */
export function sectionLabel(section: string): string {
  return SECTION_LABEL[section] ?? (section === "free" ? "自由記入" : section);
}

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
