/**
 * 書き込み（Server Action）が画面へ返す形。
 *
 * 画面とサーバーの両方から読むので、サーバー専用の部品はここに入れない。
 * 成功も失敗も「例外」ではなく値で返す。例外で返すと、本番ではNext.jsが
 * 文面を伏せてしまい、利用者に「何を直せばよいか」を伝えられないため。
 */
export type ActionOk<T extends object = object> = { ok: true; message: string } & T;
export type ActionFail = { ok: false; message: string };
export type ActionResult<T extends object = object> = ActionOk<T> | ActionFail;

/** 画面に渡す書き込みの型。入力は呼び出し側の形をそのまま受ける。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SaveAction<I = any, T extends object = object> = (input: I) => Promise<ActionResult<T>>;
