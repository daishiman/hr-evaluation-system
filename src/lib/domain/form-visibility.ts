/**
 * アンケートの中身を「誰に見せる形」に整える。
 *
 * 設問そのものは全ロールが読めるようにしたが、選択肢には配点（score）が
 * 一緒に入っている。配点は評価される方に見せない決まり（canSeeCriteria）なので、
 * 中身の確認画面に渡す前にここで落とす。文言・値・並びは一切変えない。
 */

export interface QuestionOption {
  value: string;
  label: string;
  score?: number;
}

/**
 * 選択肢のJSONから配点だけ取り除く。
 *
 * 読めない形のJSONは、中身が分からないまま渡すより「選択肢が登録されていません」と
 * 出したほうが正直なので null にする（壊れたデータを黙って表示しない）。
 */
export function stripOptionScores(optionsJson: string | null): string | null {
  if (!optionsJson) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(optionsJson);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const options = parsed
    .filter((o): o is QuestionOption => typeof o === "object" && o !== null)
    .map((o) => ({ value: String(o.value ?? ""), label: String(o.label ?? "") }));
  if (options.length === 0) return null;
  return JSON.stringify(options);
}

export interface ContentQuestion {
  id: string;
  section: string;
  questionType: string;
  title: string;
  helpText: string | null;
  unit: string | null;
  required: boolean;
  validationMin: number | null;
  validationMax: number | null;
  optionsJson: string | null;
  displayOrder: number;
}

/**
 * 中身の確認画面に渡す設問を作る。
 *
 * 配点を見てよい人（マネージャー以上）には元のまま渡す。選択肢の並びや
 * 数値の幅は誰にとっても同じで、変わるのは配点を持つかどうかだけ。
 */
export function toContentQuestions<T extends ContentQuestion>(questions: T[], canSeeScores: boolean): ContentQuestion[] {
  return questions
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((q) => ({
      id: q.id,
      section: q.section,
      questionType: q.questionType,
      title: q.title,
      helpText: q.helpText,
      unit: q.unit,
      required: q.required,
      validationMin: q.validationMin,
      validationMax: q.validationMax,
      optionsJson: canSeeScores ? q.optionsJson : stripOptionScores(q.optionsJson),
      displayOrder: q.displayOrder,
    }));
}
