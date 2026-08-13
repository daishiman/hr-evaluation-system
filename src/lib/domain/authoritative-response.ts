/**
 * 同じ評価期間・同じ社員に複数の提出回答が残っていても、評価へ使う1件を決定的に選ぶ。
 *
 * 正本は「最後に提出した回答」。同時刻なら新しいフォーム版、最後に回答IDで決める。
 * DBの暗黙の返却順や配列の入力順へ依存しない。
 */
export function resolveAuthoritativeResponses<
  T extends { id: string; employeeId: string; submittedAt: Date | null; formVersion: number },
>(rows: readonly T[]): T[] {
  const byEmployee = new Map<string, T>();
  for (const candidate of rows) {
    const current = byEmployee.get(candidate.employeeId);
    if (!current || compareAuthority(candidate, current) > 0) byEmployee.set(candidate.employeeId, candidate);
  }
  return [...byEmployee.values()].sort((a, b) => a.employeeId.localeCompare(b.employeeId));
}

function compareAuthority(
  left: { id: string; submittedAt: Date | null; formVersion: number },
  right: { id: string; submittedAt: Date | null; formVersion: number },
): number {
  const submitted = (left.submittedAt?.getTime() ?? 0) - (right.submittedAt?.getTime() ?? 0);
  if (submitted !== 0) return submitted;
  if (left.formVersion !== right.formVersion) return left.formVersion - right.formVersion;
  return left.id.localeCompare(right.id);
}
