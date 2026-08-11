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
