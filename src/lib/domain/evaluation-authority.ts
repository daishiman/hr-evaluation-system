/**
 * 「誰が、その評価に手を入れてよいか」の判定。
 *
 * 評価の対象は役割ではなく等級で決まるため、マネージャーも会社の管理者も自分自身が評価される。
 * その結果、自分の評価の画面を開くと、自分で「確定して本人に公開する」を押せてしまう状態だった。
 * 自己承認になるので、役割で例外を作らず「対象者本人からの書き込み」をすべて止める。
 *
 * 閲覧は止めない。自分の結果を見るのは本人の当然の権利で、ここで塞ぐと
 * 「自分の評価」メニューが機能しなくなる。
 */

/** 本人が自分の評価に書き込もうとしたときに、画面とAPIの両方で使う理由文。 */
export const SELF_EVALUATION_BLOCK_REASON =
  "自分自身の評価は、ご自身では確定・差し戻し・コメントの保存ができません。ご自身の上長、または会社の管理者に確定を依頼してください。";

/** 評価の対象者と、いま操作している人が同じかどうか。 */
export function isOwnEvaluation(viewerId: string, employeeId: string): boolean {
  return viewerId === employeeId;
}

type EvaluationActionRole = "SUPER_ADMIN" | "COMPANY_ADMIN" | "MANAGER" | "EMPLOYEE";

interface ActionableEvaluation {
  id: string;
  employeeId: string;
  status: string;
}

/**
 * 確定後に案内してよい、次の評価を1件だけ返す。
 *
 * 一覧の取得範囲だけに頼ると、マネージャーが担当外や自分自身の評価へ進めてしまう。
 * 画面遷移も確定操作と同じ担当範囲に揃え、本人評価と確定済みを除外する。
 */
export function selectNextActionableEvaluation<T extends ActionableEvaluation>(
  rows: T[],
  scope: {
    currentId: string;
    viewerId: string;
    viewerRole: EvaluationActionRole;
    assignedEmployeeIds: ReadonlySet<string>;
  },
): T | null {
  return (
    rows.find((row) => {
      if (
        row.id === scope.currentId ||
        row.status === "finalized" ||
        isOwnEvaluation(scope.viewerId, row.employeeId)
      ) {
        return false;
      }
      if (scope.viewerRole === "SUPER_ADMIN" || scope.viewerRole === "COMPANY_ADMIN") {
        return true;
      }
      if (scope.viewerRole === "MANAGER") {
        return scope.assignedEmployeeIds.has(row.employeeId);
      }
      return false;
    }) ?? null
  );
}
