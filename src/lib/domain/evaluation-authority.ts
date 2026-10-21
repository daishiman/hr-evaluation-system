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

import { atLeast, type Role } from "@/lib/roles";

/** 本人が自分の評価に書き込もうとしたときに、画面とAPIの両方で使う理由文。 */
export const SELF_EVALUATION_BLOCK_REASON =
  "自分自身の評価は、ご自身では確定・差し戻し・コメントの保存ができません。ご自身の上長、または会社の管理者に確定を依頼してください。";

/** 評価の対象者と、いま操作している人が同じかどうか。 */
export function isOwnEvaluation(viewerId: string, employeeId: string): boolean {
  return viewerId === employeeId;
}

interface EmployeeAuthorityTarget {
  employeeId: string;
  managerId: string | null;
}

/**
 * 評価者向け画面は会社管理者以上、または直属上長だけが開ける。
 * 閲覧（canReadEmployee）と書き込み（canActOnEmployeeEvaluation）は、これに本人かどうかを組み合わせて決める。
 */
export function canReviewEmployeeEvaluation(
  viewerId: string,
  viewerRole: Role,
  target: EmployeeAuthorityTarget,
): boolean {
  if (atLeast(viewerRole, "COMPANY_ADMIN")) return true;
  return viewerRole === "MANAGER" && target.managerId === viewerId;
}

/**
 * 個人情報を読む対象範囲。
 *
 * 会社境界は呼び出し側の問い合わせで閉じ、この純粋関数は「本人・管理者・直属上長」だけを判定する。
 * MANAGER を会社全員へ広げる例外は作らない。
 * 本人か、canReviewEmployeeEvaluation が通る人。
 */
export function canReadEmployee(
  viewerId: string,
  viewerRole: Role,
  target: EmployeeAuthorityTarget,
): boolean {
  return isOwnEvaluation(viewerId, target.employeeId) || canReviewEmployeeEvaluation(viewerId, viewerRole, target);
}

/**
 * 評価への書き込みは、自己評価を除く管理者または直属上長だけ。
 * 本人でなく、canReviewEmployeeEvaluation が通る人。
 */
export function canActOnEmployeeEvaluation(
  viewerId: string,
  viewerRole: Role,
  target: EmployeeAuthorityTarget,
): boolean {
  return !isOwnEvaluation(viewerId, target.employeeId) && canReviewEmployeeEvaluation(viewerId, viewerRole, target);
}

/**
 * 回答本文の閲覧範囲。
 * 下書きは回答者本人だけに閉じる。提出後だけ、直属上長と会社管理者以上へ開く。
 */
export function canReadResponseBody(
  viewerId: string,
  viewerRole: Role,
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

/** 評価レポート（/reports/[id]）の見せ方。reviewer は点数まで全部、self は点数の数値と比べる値を除いた本人向け。 */
export type EvaluationView = "reviewer" | "self";

/**
 * 評価レポートを、誰がどの形で読めるか（DD-024）。null なら開けない（画面は 404）。
 *
 * 本人は役割にかかわらず self にする。マネージャーや会社の管理者が自分のレポートを開いても、
 * 自分の点数を評価者の形では見せない（本人向けは数値を出さない、が qa-y12 の決め）。
 * 本人でなければ canReviewEmployeeEvaluation と同じ範囲が reviewer
 * （会社の管理者以上は全員、マネージャーは直属の部下だけ。間接の部下は含めない）。
 * 会社境界は呼び出し側が先に閉じる（src/lib/session.ts の canViewEvaluationOf）。
 */
export function evaluationViewOf(
  viewerId: string,
  viewerRole: Role,
  target: EmployeeAuthorityTarget,
): EvaluationView | null {
  if (isOwnEvaluation(viewerId, target.employeeId)) return "self";
  return canReviewEmployeeEvaluation(viewerId, viewerRole, target) ? "reviewer" : null;
}

/** 評価メモの公開範囲（employee_notes.visibility が取る値）。manager が既定、admin は「管理者のみ」。 */
export const NOTE_VISIBILITIES = ["manager", "admin"] as const;
export type NoteVisibility = (typeof NOTE_VISIBILITIES)[number];

/** 自分が読めない公開範囲でメモを残そうとしたときの理由文（保存の action が返す）。 */
export const NOTE_VISIBILITY_BLOCK_REASON =
  "「管理者だけが読めるようにする」は、会社の管理者だけが選べます。この選択を外して、もう一度保存してください。";

/**
 * 公開範囲ごとの「この役割以上なら読める」最低の役割。役割の上下は src/lib/roles.ts の atLeast で比べる。
 * manager は MANAGER 以上、admin（管理者のみ）は COMPANY_ADMIN 以上。
 */
const NOTE_VISIBILITY_MIN_ROLE: Record<NoteVisibility, Role> = {
  manager: "MANAGER",
  admin: "COMPANY_ADMIN",
};

/**
 * 評価メモのうち、その役割が読める公開範囲。書ける公開範囲もこれと同じにする
 * （自分が読めない段階のメモは書けない。メモの入力欄に出す選択肢と、保存時の検査の両方がここを引く）。
 *
 * 一般（本人）は、どの公開範囲にも届かないので空になる（本人には見せない）。
 * 誰のメモを読み書きしてよいか（マネージャーは直属の部下だけ）は、呼び出し側が先に確かめる。
 */
export function readableNoteVisibilities(viewerRole: Role): NoteVisibility[] {
  return NOTE_VISIBILITIES.filter((visibility) => atLeast(viewerRole, NOTE_VISIBILITY_MIN_ROLE[visibility]));
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
    viewerRole: Role;
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
      if (atLeast(scope.viewerRole, "COMPANY_ADMIN")) {
        return true;
      }
      if (scope.viewerRole === "MANAGER") {
        return scope.assignedEmployeeIds.has(row.employeeId);
      }
      return false;
    }) ?? null
  );
}
