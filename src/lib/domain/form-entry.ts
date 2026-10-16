/**
 * アンケートを開いた人を「回答画面」と「中身だけの確認画面」のどちらに通すか。
 *
 * 以前は対象等級が違うと画面を閉ざしていたため、上長や管理者が
 * 「部下に配っているアンケートの中身」を確認できなかった。
 * ここでは閉ざすのをやめ、回答できない人には読むだけの画面を渡す。
 *
 * 回答できるかどうかの線引き（canAnswerForm）は、画面と保存APIの両方がこの関数を使う。
 * 画面側だけで判断すると、URLを直接叩かれたときに素通りするため。
 */

import type { DeadlineState } from "./form-deadline";

export type FormEntry = "answer" | "content-only";

/**
 * この人がこのアンケートに回答してよいか。
 *
 * 等級が割り当てられていない人（会社の管理者など）は、どのアンケートにも回答できない。
 * 「どちらも等級なし」で一致してしまわないよう、null は明示的に弾く。
 */
export function canAnswerForm(viewerGradeId: string | null, formGradeId: string | null): boolean {
  return viewerGradeId !== null && formGradeId !== null && viewerGradeId === formGradeId;
}

/**
 * 回答用のURLを開いた人の行き先。
 *
 * 過去に自分が答えたアンケートは、昇格して等級が変わっても回答画面で読み返せるようにする
 * （当時の版・当時の設問文のまま残すため）。
 */
export function judgeFormEntry(input: {
  viewerGradeId: string | null;
  formGradeId: string | null;
  hasResponse: boolean;
}): FormEntry {
  if (input.hasResponse) return "answer";
  return canAnswerForm(input.viewerGradeId, input.formGradeId) ? "answer" : "content-only";
}

/**
 * 読む画面（/forms/[id]）で、いま回答できない理由を1つに決めた結果。
 *
 * 以前は理由ごとに条件を並べて注記を出していたため、等級の無い管理者に締切の文
 * （「管理者にご連絡ください」）が出たり、下書きと等級違いの注記が2つ並んだりした。
 * 選ぶ順をここ1か所に決め、画面の注記と見本の節ごとの理由の両方がこの結果を使う。
 */
export type AnswerBlock =
  | { kind: "can-answer" }
  | { kind: "draft" }
  | { kind: "no-grade" }
  | { kind: "other-grade" }
  | { kind: "deadline"; state: DeadlineState };

/**
 * 回答できない理由を選ぶ。順は 下書き → 等級なし → 等級違い → 締切 → 回答できる。
 *
 * 締切を等級より後にするのは、等級が合わなければ時期にかかわらず回答できず、
 * 締切の文（連絡先や延長の案内）を見せても役に立たないため。
 * 等級なしを等級違いと分けるのは、直し方（等級を設定してもらう）が違うため。
 * 回答できるかの線引きは canAnswerForm のまま使い、ここでは理由を選ぶだけにする。
 */
export function judgeAnswerBlock(input: {
  /** アンケートが下書き（forms.status = draft）か */
  draft: boolean;
  viewerGradeId: string | null;
  formGradeId: string | null;
  /** judgeFormDeadline の結果のうち、回答できるかと状態 */
  deadline: { canAnswer: boolean; state: DeadlineState };
}): AnswerBlock {
  if (input.draft) return { kind: "draft" };
  if (input.viewerGradeId === null) return { kind: "no-grade" };
  if (!canAnswerForm(input.viewerGradeId, input.formGradeId)) return { kind: "other-grade" };
  if (!input.deadline.canAnswer) return { kind: "deadline", state: input.deadline.state };
  return { kind: "can-answer" };
}

/**
 * 回答画面（/me/forms/[id]）で入力欄を止めるときの文。回答できるなら null。
 *
 * 止めるかどうかは judgeAnswerBlock（保存APIが断る条件と同じ線引き）で決める。
 * 締切だけで決めていたため、昇格などで等級が変わった人の下書きは入力欄が開いたままになり、
 * 打つたびに下書きの自動保存が等級違いで断られて「保存できていません」が続いた。
 * 締切の文（message）はほかの画面にも出るので、回答画面だけの案内（answerHint）はここで続ける。
 */
export function answerLockedReason(input: {
  block: AnswerBlock;
  deadline: { message: string; answerHint: string | null };
  /** 下書きがあるか（あれば、入力した内容が残っていることを言う） */
  hasResponse: boolean;
}): string | null {
  const kept = input.hasResponse ? "入力した内容は消えずに残っています。" : "";
  switch (input.block.kind) {
    case "can-answer":
      return null;
    case "no-grade":
      return `等級が設定されていないため、回答できません。等級の設定を会社の管理者に依頼してください。${kept}`;
    case "other-grade":
      return `いまの等級向けのアンケートではないため、続きの入力と提出はできません。等級の設定が違う場合は、会社の管理者にご連絡ください。${kept}`;
    // 下書きのアンケートの締切の判定は必ず「未公開」で、準備中の文はその message が持つ。
    // ここで自前の文を持つと、/f/[token] や保存APIの断りと、同じ下書きに2通りの文が出る
    case "draft":
    case "deadline":
      return `${input.deadline.message}${input.deadline.answerHint ?? ""}${kept}`;
  }
}

/**
 * 見本の節ごとに添える「送信できない理由」の短い文。
 * 長い説明は画面上部の注記が持つので、ここは何が理由かだけを言う。
 */
export function answerBlockLabel(block: AnswerBlock): string {
  switch (block.kind) {
    case "can-answer":
      return "回答は「このアンケートに回答する」から";
    case "draft":
      return "まだ配っていない下書きのため";
    case "no-grade":
      return "等級が設定されていないため";
    case "other-grade":
      return "対象の等級が違うため";
    case "deadline":
      return deadlineBlockLabel(block.state);
  }
}

function deadlineBlockLabel(state: DeadlineState): string {
  switch (state) {
    case "closed_by_admin":
      return "締め切られたため";
    case "past_deadline":
      return "回答期限を過ぎたため";
    case "before_open":
      return "受付の開始前のため";
    case "cycle_not_open":
      return "評価期間が開いていないため";
    default:
      // 回答できない締切の状態は上の4つ。ほかの状態が来ても、当てはまらない理由を言い切らない
      return "いまは回答を受け付けていないため";
  }
}
