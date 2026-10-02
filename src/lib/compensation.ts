import { HttpError } from "@/lib/session";

/**
 * 何回かに分けて書く処理を、途中で失敗しても「書きかけ」を残さないようにする。
 *
 * ── なぜ1回の batch にしないか ──
 * 会社の追加は、制度ひな形の複製だけで数十〜数百行になる。D1 の batch は
 * 1回に送れる文と値の数に上限があり、ひな形が育つと一度に収まらなくなる。
 * そこで「順に書き、失敗したら書いた分を逆順に消す」形（補償）を採る（DD／D-003）。
 *
 * ── 使い方 ──
 *   await withCompensation("company.create", { companyId }, async (step) => {
 *     await step("company", () => insertCompany(), () => deleteCompany());
 *     await step("masters", () => copyMasters(), () => deleteMasters());
 *   });
 *
 * - 成功した手順の「取り消し」だけを、成功した逆の順に呼ぶ。
 * - 取り消しが全部うまくいったら、元の失敗をそのまま投げ直す
 *   （「このメールアドレスは使われています」などの言葉を画面へ届けるため）。
 * - 取り消し自体が失敗したら、残りの取り消しは続けたうえで、
 *   何が残ったかをログに1行ずつ書き、管理者への連絡を促す言葉で止める。
 *   どの行が残ったかはログの ids と step で追える（手で直す手順は運用手順書）。
 */

/** 取り消しに失敗したときに画面へ出す言葉。 */
export const COMPENSATION_FAILED_MESSAGE = "途中で止まり、一部が残りました。管理者に連絡してください。";

export type CompensationIds = Record<string, string | null | undefined>;

/** 1手順。run が成功したら、その戻り値を渡して undo を呼べるよう覚えておく。 */
export type Step = <R>(name: string, run: () => Promise<R>, undo: (result: R) => Promise<unknown>) => Promise<R>;

interface Done {
  name: string;
  undo: () => Promise<unknown>;
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** 構造化ログ。Workers Logs で event 名から探せるよう、1行のJSONで出す。 */
function log(level: "warn" | "error", fields: Record<string, unknown>): void {
  const line = JSON.stringify(fields);
  if (level === "error") console.error(line);
  else console.warn(line);
}

export async function withCompensation<T>(
  operation: string,
  ids: CompensationIds,
  body: (step: Step) => Promise<T>,
): Promise<T> {
  const done: Done[] = [];
  let current: string | null = null;

  const step: Step = async (name, run, undo) => {
    current = name;
    const result = await run();
    done.push({ name, undo: () => undo(result) });
    current = null;
    return result;
  };

  try {
    return await body(step);
  } catch (original) {
    const failedAt = current;
    const undone: string[] = [];
    const leftovers: string[] = [];

    for (const d of [...done].reverse()) {
      try {
        await d.undo();
        undone.push(d.name);
      } catch (undoError) {
        leftovers.push(d.name);
        log("error", {
          event: "compensation_failed",
          operation,
          step: d.name,
          ids,
          error: errorText(undoError),
        });
      }
    }

    log("warn", {
      event: "compensation_applied",
      operation,
      failed_step: failedAt,
      undone,
      leftovers,
      ids,
      error: errorText(original),
    });

    if (leftovers.length > 0) throw new HttpError(500, COMPENSATION_FAILED_MESSAGE);
    throw original;
  }
}

/**
 * 取り消せない書き込みの「続き」を、前へ進めて揃える。
 *
 * 認証ライブラリのパスワード変更のように、先に済んだ書き込みを戻せないことがある。
 * そのときは補償ではなく、続きの書き込みを1回だけやり直す。
 * それでも失敗したら Workers Logs に1行残し、false を返す（呼ぶ側が正しい言葉を選ぶ）。
 * 続きは1回の batch にして、やり直しても二重に書かれない形にしておくこと。
 */
export async function rollForward(
  operation: string,
  ids: CompensationIds,
  write: () => Promise<unknown>,
): Promise<boolean> {
  try {
    await write();
    return true;
  } catch (first) {
    log("warn", { event: "rollforward_retry", operation, ids, error: errorText(first) });
  }
  try {
    await write();
    return true;
  } catch (second) {
    log("error", { event: "rollforward_failed", operation, ids, error: errorText(second) });
    return false;
  }
}
