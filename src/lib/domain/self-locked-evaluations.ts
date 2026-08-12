/**
 * 「対象者と、確定を頼める上長が同一人物（またはそもそも上長がいない）」で、
 * 誰にも確定を頼めないまま止まっている評価を見つける。
 *
 * 背景（`src/lib/domain/evaluation-authority.ts` とセットで読む）:
 *  評価対象者は自分自身の評価を確定できない（`isOwnEvaluation` が役割の例外なしに止める）。
 *  そのため、確定は本人ではない別の誰かに頼む必要がある。
 *  通常はその人の上長（`users.managerId`。列コメントに「上長（評価者）」とある）が確定する想定だが、
 *   - 上長が設定されていない（`managerId` が null）
 *   - 上長が自分自身になっている（`managerId` === 自分の `id`）
 *  のどちらかだと、記録の上では「次に頼める人」が存在しない。
 *  これに気づけないと、確定が誰の作業一覧にも自然には出てこないまま止まり続ける。
 *
 * なぜ EMPLOYEE は対象にしないか:
 *  確定操作自体が MANAGER 以上の役割にしか開かれていない（`apiViewer("MANAGER")`）。
 *  EMPLOYEE は自分の評価を確定しようとする権限を持たないため、
 *  いずれにせよ確定するのは自分以外の MANAGER 以上の誰かであり、この問題は起きない。
 *
 * この判定は「読むだけ」。確定も差し戻しも一切しない。
 */

/** 判定にかける前の1件。DBから読んだ値をそのまま渡す。 */
export interface SelfLockedSource {
  evaluationId: string;
  cycleId: string;
  cycleName: string;
  employeeId: string;
  employeeName: string | null;
  gradeName: string | null;
  /** 評価対象者の役割。SUPER_ADMIN | COMPANY_ADMIN | MANAGER | EMPLOYEE */
  employeeRole: string;
  /** 評価対象者の上長ID。未設定なら null */
  managerId: string | null;
}

export type SelfLockedRow = SelfLockedSource;

/** 確定操作を行いうる（＝自己承認の穴に嵌りうる）役割。 */
const CONFIRMABLE_ROLES = new Set(["MANAGER", "COMPANY_ADMIN"]);

/** この1件が「頼める上長がいない」状態かどうか。 */
export function isSelfLocked(row: Pick<SelfLockedSource, "employeeId" | "employeeRole" | "managerId">): boolean {
  if (!CONFIRMABLE_ROLES.has(row.employeeRole)) return false;
  return row.managerId === null || row.managerId === row.employeeId;
}

/** 一覧から、頼める上長がいない分だけを残す。並び順は入力の順のまま。 */
export function selectSelfLocked(rows: SelfLockedSource[]): SelfLockedRow[] {
  return rows.filter(isSelfLocked);
}

/** ホームの見出し文。0件のときは呼び出し側で表示自体を出さない想定なので空文字を返す。 */
export function selfLockedHeadline(count: number): string {
  if (count <= 0) return "";
  return `本人が確定できず、確定を頼まれている評価が${count}件あります`;
}
