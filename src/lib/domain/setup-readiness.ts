import type { GradeLike } from "./grade-label";
import {
  cycleOpenGaps,
  formPublicationGaps,
  gapsMessage,
  schemeGaps,
  type SchemeGroupState,
  type SetupGap,
} from "./setup-gaps";

/*
 * 準備ができているかの判定の窓口。不足の中身（何が・どう直す・どこで）は setup-gaps.ts が作る。
 * 画面は gaps を SetupGapList で並べ、サーバー処理は 409 の message に要約（gapsMessage）を載せる。
 */

/** setup/dashboard/APIが同じ評価セット完了条件を使うための正本。 */
export function setupReadiness(
  input: { hasScheme: boolean; groups: readonly SchemeGroupState[] },
  grades: readonly GradeLike[],
) {
  const gaps = schemeGaps(input, grades);
  return { schemeReady: gaps.length === 0, schemeGaps: gaps, schemeMessage: gapsMessage(gaps) };
}

export function cycleOpenReadiness(input: {
  schemeGaps: readonly SetupGap[];
  publishedFormCount: number;
  cycleId?: string;
}) {
  const gaps = cycleOpenGaps(input);
  return { ready: gaps.length === 0, gaps, message: gapsMessage(gaps) };
}

export function formPublicationReadiness(input: {
  schemeGaps: readonly SetupGap[];
  cycleStatus: string;
  questionCount: number;
  formId: string;
}) {
  const gaps = formPublicationGaps(input);
  return { ready: gaps.length === 0, gaps, message: gapsMessage(gaps) };
}
