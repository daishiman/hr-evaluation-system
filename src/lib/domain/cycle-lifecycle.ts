export type CycleStatus = "planning" | "open" | "closed";

const ALLOWED_TRANSITIONS: Readonly<Record<CycleStatus, readonly CycleStatus[]>> = {
  planning: ["planning", "open"],
  open: ["open", "closed"],
  closed: ["closed", "open"],
};

/** 評価期間の段階飛ばしや、準備中への巻き戻しを共通で拒否する。 */
export function canTransitionCycleStatus(from: string, to: string): boolean {
  if (!(from in ALLOWED_TRANSITIONS) || !(to in ALLOWED_TRANSITIONS)) return false;
  return ALLOWED_TRANSITIONS[from as CycleStatus].includes(to as CycleStatus);
}
