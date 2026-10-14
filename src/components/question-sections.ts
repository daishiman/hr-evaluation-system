import { SECTION_ORDER } from "@/lib/view";

/** 見本・回答とも、制度の区分順と区分内の保存済み順で設問を描く。元の配列は変更しない。 */
export function orderedQuestionSections<T extends { section: string; displayOrder: number }>(questions: readonly T[]) {
  return SECTION_ORDER.concat("free")
    .map((section) => ({
      section,
      rows: questions.filter((question) => question.section === section).sort((a, b) => a.displayOrder - b.displayOrder),
    }))
    .filter((group) => group.rows.length > 0);
}
