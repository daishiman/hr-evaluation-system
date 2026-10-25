/**
 * 書き込み（Server Action）が画面へ返す形。
 *
 * 画面とサーバーの両方から読むので、サーバー専用の部品はここに入れない。
 * 成功も失敗も「例外」ではなく値で返す。例外で返すと、本番ではNext.jsが
 * 文面を伏せてしまい、利用者に「何を直せばよいか」を伝えられないため。
 */
export type ActionOk<T extends object = object> = { ok: true; message: string } & T;
/** fixHref は、断った理由を直す画面の場所。あるときだけ画面が「直す画面を開く」のリンクを出す（DD-028 の2） */
export type ActionFail = { ok: false; message: string; fixHref?: string };
export type ActionResult<T extends object = object> = ActionOk<T> | ActionFail;

/**
 * 画面に渡す書き込みの型。入力は呼び出し側の形をそのまま受ける。
 *
 * 失敗の側は fixHref を持たない形で受ける。ActionFail のままだと、`{ ok: false; message }` を返す
 * 書き込みから T を推し量れず（never になる）、useSaveAction が型で断る。fixHref を持つ失敗もこの形に収まり、
 * 画面へ返す値（ActionResult）にはそのまま残る。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SaveAction<I = any, T extends object = object> = (input: I) => Promise<ActionOk<T> | { ok: false; message: string }>;

/**
 * 画面を描いた会社（`__scope`）を入力に添える（S7・D-004）。サーバー側で取り除くのは action.ts の takeScope。
 *
 * 平らなオブジェクトの入力にだけ添える。FormData・配列・文字などはそのまま返す。
 * scope が undefined（会社の画面の外。ログイン画面など）なら何も添えない。
 * null（全体管理者が会社をまだ選んでいない）は空の文字として送る。
 */
export function withScope<I>(input: I, scope: string | null | undefined): I {
  if (scope === undefined) return input;
  if (!input || typeof input !== "object" || Array.isArray(input) || input instanceof FormData) return input;
  return { ...(input as Record<string, unknown>), __scope: scope ?? "" } as I;
}
