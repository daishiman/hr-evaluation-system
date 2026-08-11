/**
 * 集計し直しの結果を、実行した人に1行で伝えるための要約。
 *
 * 「何人ぶん作れて、何人ぶん作れなかったか」を必ず出す。
 * とくに確定済みは意図して据え置いているので、黙って飛ばさず件数を言う
 * （黙って0件だと「動かなかった」と区別がつかない）。
 */

export interface BuildOutcome {
  employeeName: string;
  ok: boolean;
  message: string;
}

/** 確定済みのため作り直さなかった、と集計側が返してきたときの文言。 */
export const FINALIZED_SKIP_MESSAGE = "確定済みのため作り直しませんでした。";

export function summarizeBuildResults(results: readonly BuildOutcome[]): string {
  if (results.length === 0) {
    return "集計できる回答がありませんでした。提出済みの回答があるか、この期のアンケートが配られているかを確認してください。";
  }

  const built = results.filter((r) => r.ok);
  const finalized = results.filter((r) => !r.ok && r.message === FINALIZED_SKIP_MESSAGE);
  const failed = results.filter((r) => !r.ok && r.message !== FINALIZED_SKIP_MESSAGE);

  const parts: string[] = [`${built.length}人ぶんの評価を作りました。`];
  if (finalized.length > 0) {
    parts.push(`確定済みの${finalized.length}人ぶんは、判定した当時の基準のまま据え置きました。`);
  }
  if (failed.length > 0) {
    const names = failed.slice(0, 3).map((r) => `${r.employeeName}：${r.message}`).join(" ／ ");
    parts.push(
      `${failed.length}人ぶんは作れませんでした（${names}${failed.length > 3 ? ` ほか${failed.length - 3}人` : ""}）。`,
    );
  }
  return parts.join("");
}
