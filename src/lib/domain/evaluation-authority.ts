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

interface EmployeeAuthorityTarget {
  employeeId: string;
  managerId: string | null;
}

/**
 * 個人情報を読む対象範囲。
 *
 * 会社境界は呼び出し側の問い合わせで閉じ、この純粋関数は「本人・管理者・直属上長」だけを判定する。
 * MANAGER を会社全員へ広げる例外は作らない。
 */
export function canReadEmployee(
  viewerId: string,
  viewerRole: EvaluationActionRole,
  target: EmployeeAuthorityTarget,
): boolean {
  if (viewerId === target.employeeId) return true;
  if (viewerRole === "SUPER_ADMIN" || viewerRole === "COMPANY_ADMIN") return true;
  return viewerRole === "MANAGER" && target.managerId === viewerId;
}

/** 評価への書き込みは、自己評価を除く管理者または直属上長だけ。 */
export function canActOnEmployeeEvaluation(
  viewerId: string,
  viewerRole: EvaluationActionRole,
  target: EmployeeAuthorityTarget,
): boolean {
  if (viewerId === target.employeeId) return false;
  if (viewerRole === "SUPER_ADMIN" || viewerRole === "COMPANY_ADMIN") return true;
  return viewerRole === "MANAGER" && target.managerId === viewerId;
}

/** 評価者向け画面は会社管理者以上、または直属上長だけが開ける。 */
export function canReviewEmployeeEvaluation(
  viewerId: string,
  viewerRole: EvaluationActionRole,
  target: EmployeeAuthorityTarget,
): boolean {
  if (viewerRole === "SUPER_ADMIN" || viewerRole === "COMPANY_ADMIN") return true;
  return viewerRole === "MANAGER" && target.managerId === viewerId;
}

/**
 * 回答本文の閲覧範囲。
 * 下書きは回答者本人だけに閉じる。提出後だけ、直属上長と会社管理者以上へ開く。
 */
export function canReadResponseBody(
  viewerId: string,
  viewerRole: EvaluationActionRole,
  target: EmployeeAuthorityTarget,
  responseStatus: string,
): boolean {
  if (viewerId === target.employeeId) return true;
  if (responseStatus !== "submitted") return false;
  return canReadEmployee(viewerId, viewerRole, target);
}

/** 本人用の結果入口は、本人の確定済み評価だけを公開する。 */
export function canReadSelfResult(viewerId: string, employeeId: string, status: string): boolean {
  return viewerId === employeeId && status === "finalized";
}

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
