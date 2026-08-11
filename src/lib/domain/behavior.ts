/**
 * 行動指針の等級帯。
 *
 * 画面名だけを持つ定数も Client Component に置くと、Server Component から値を
 * 読めなくなる。制度上の語と、等級を切り替えたときの現在値の解決は、サーバーと
 * ブラウザのどちらからも読めるこのモジュールを正本にする。
 */

export const BEHAVIOR_BANDS = ["g1_2", "g3_4"] as const;

export type BehaviorBand = (typeof BEHAVIOR_BANDS)[number];

export const BAND_LABEL = {
  g1_2: "等級1〜2の基準",
  g3_4: "等級3〜4の基準",
} as const satisfies Record<BehaviorBand, string>;

/** DB から来る文字列にも安全に使える表示名。未知の値は隠さず、そのまま表示する。 */
export function behaviorBandLabel(value: string | null | undefined): string {
  if (!value) return "";
  return (BAND_LABEL as Readonly<Record<string, string>>)[value] ?? value;
}

export interface BehaviorAssignmentGrade {
  id: string;
  behaviorBand: string | null;
}

/** 選んだ等級にいま保存されている行動指針の等級帯。見つからなければ適用なし。 */
export function behaviorBandForGrade(
  grades: readonly BehaviorAssignmentGrade[],
  gradeId: string,
): string | null {
  return grades.find((grade) => grade.id === gradeId)?.behaviorBand ?? null;
}

/** select の空文字を API / DB の「適用なし」である null にそろえる。 */
export function behaviorBandPayloadValue(value: string): string | null {
  return value === "" ? null : value;
}
