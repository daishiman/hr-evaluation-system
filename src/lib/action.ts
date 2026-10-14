import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { describeError } from "@/lib/api";
import type { ActionResult } from "@/lib/action-result";
import { minRoleFor } from "@/lib/route-access";
import { apiViewer, HttpError, type Viewer } from "@/lib/session";

/**
 * 画面からの書き込み（Server Action）の共通の包み。
 *
 * ── なぜ包むか ──
 * 書き込みの直後に、その画面の一覧・件数・メニューを必ず新しくするため。
 * 包みの中で refresh() を呼ぶと、Next.js は書き込みの返事と同じ応答で
 * 「書き込み後の画面」を描き直して返す。画面側が再読み込みを頼み忘れても
 * 古い一覧が残らない（以前の Route Handler 方式で起きていた取りこぼし）。
 *
 * ── 守ること ──
 * - 権限の確認（apiViewer。別サイトからの送信の拒否を含む）を、入力を読むより先に行う。
 *   要る役割は operation から台帳で引く。台帳に無い操作は誰にも許さない。
 * - 画面を描いた会社（`__scope`）が今の会社と違えば、何も書かずに 409 で返す（takeScope）。
 * - 入力は zod で検査してから使う。Server Action の引数は誰でも好きな形で送れる。
 * - 失敗は例外ではなく { ok: false, message } で返す。本番の Next.js は
 *   投げた例外の文面を伏せるので、値で返さないと直し方を伝えられない。
 */

type WriteContext<S extends z.ZodType> = { viewer: Viewer; input: z.output<S> };

export interface ActionSpec<S extends z.ZodType> {
  /**
   * 台帳（system-spec/route-ledger.json）の操作の名前。実行に要る最低限の役割はここから引く。
   * 役割の名前を直接書かないのは、権限一覧のページに出す内容と実際の判定をずらさないため。
   */
  operation: string;
  /** 入力の形 */
  input: S;
  /**
   * 1回に受け取る上限（バイト）。画像や CSV のように大きくなりうる入力だけに付ける。
   * 全体の上限は next.config.ts の serverActions.bodySizeLimit が別に持つ。
   */
  maxBytes?: number;
  /** maxBytes を超えたときに出す言葉 */
  tooLargeMessage?: string;
}

type Payload<T> = Omit<T, "message">;

/** 画面を描いた会社と、いま操作している会社が違うときの言葉（S7） */
export const SCOPE_CONFLICT_MESSAGE =
  "別の画面で会社を切り替えたため、この画面の内容は古くなっています。再読み込みしてください。";

/**
 * 入力から、画面を描いた会社（`__scope`）を取り出す。
 *
 * 画面は、描いたときの会社の id を `__scope` として入力に添えて送る（ScopedForm・useSaveAction）。
 * 別のタブで会社を切り替えたあとに古い画面から送ると、今の会社と食い違う。そのまま通すと、
 * 古い画面で選んだ等級・上長の id が今の会社の社員に書き込まれるので、書く前に止める。
 * 平らなオブジェクトのときだけ見る。FormData や配列は対象外で、そのまま返す。
 * `__scope` が無い呼び出し（画面の外・試験）は scope を undefined で返し、照合しない。
 */
export function takeScope(raw: unknown): { raw: unknown; scope?: string | null } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw instanceof FormData || !("__scope" in raw)) {
    return { raw };
  }
  const { __scope, ...rest } = raw as Record<string, unknown>;
  return { raw: rest, scope: typeof __scope === "string" && __scope !== "" ? __scope : null };
}

/** 受け取った入力の大きさ。JSON に直したときの UTF-8 のバイト数で数える。 */
export function payloadBytes(raw: unknown): number {
  return new TextEncoder().encode(JSON.stringify(raw ?? null)).byteLength;
}

/**
 * 権限・大きさ・入力を確かめてから body を実行する。
 * onSuccess は body が成功したときだけ呼ぶ（runAction は refresh()、runRead は何もしない）。
 */
async function run<S extends z.ZodType, T extends { message?: string }>(
  spec: ActionSpec<S>,
  raw: unknown,
  body: (ctx: WriteContext<S>) => Promise<T>,
  onSuccess: () => void,
): Promise<ActionResult<Payload<T>>> {
  try {
    const min = minRoleFor(spec.operation);
    if (!min) throw new HttpError(403, "この操作を行う権限がありません。");
    const viewer = await apiViewer(min);
    const taken = takeScope(raw);
    if (taken.scope !== undefined && taken.scope !== (viewer.companyId ?? null)) {
      throw new HttpError(409, SCOPE_CONFLICT_MESSAGE);
    }
    if (spec.maxBytes !== undefined && payloadBytes(taken.raw) > spec.maxBytes) {
      throw new HttpError(413, spec.tooLargeMessage ?? "送る内容が大きすぎます。減らしてから送ってください。");
    }
    const input = spec.input.parse(taken.raw);
    const { message, ...data } = await body({ viewer, input });
    onSuccess();
    return { ok: true, message: message ?? "保存しました。", ...(data as Payload<T>) };
  } catch (e) {
    // redirect() や notFound() は Next.js が扱う合図なので、握りつぶさずに投げ直す
    unstable_rethrow(e);
    return { ok: false, message: describeError(e).message };
  }
}

/**
 * 書き込みを実行し、成功したら表示中の画面を描き直す。
 *
 * 失敗したときは描き直さない（入力欄の中身をそのまま残して直してもらうため）。
 */
export function runAction<S extends z.ZodType, T extends { message?: string }>(
  spec: ActionSpec<S>,
  raw: unknown,
  write: (ctx: WriteContext<S>) => Promise<T>,
): Promise<ActionResult<Payload<T>>> {
  return run(spec, raw, write, () => refresh());
}

/**
 * 読み出しだけの Server Action。画面は描き直さない。
 *
 * 初期パスワードの控えを開くときのように、画面を開いた時点では渡さず、
 * 押した人にだけ、押したときに返したい値に使う。
 */
export function runRead<S extends z.ZodType, T extends { message?: string }>(
  spec: ActionSpec<S>,
  raw: unknown,
  read: (ctx: WriteContext<S>) => Promise<T>,
): Promise<ActionResult<Payload<T>>> {
  return run(spec, raw, read, () => {});
}
