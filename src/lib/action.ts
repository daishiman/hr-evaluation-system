import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { describeError } from "@/lib/api";
import type { ActionResult } from "@/lib/action-result";
import { apiViewer, HttpError, type Role, type Viewer } from "@/lib/session";

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
 * - 入力は zod で検査してから使う。Server Action の引数は誰でも好きな形で送れる。
 * - 失敗は例外ではなく { ok: false, message } で返す。本番の Next.js は
 *   投げた例外の文面を伏せるので、値で返さないと直し方を伝えられない。
 */

type WriteContext<S extends z.ZodType> = { viewer: Viewer; input: z.output<S> };

export interface ActionSpec<S extends z.ZodType> {
  /** 実行に要る最低限の役割 */
  role: Role;
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
    const viewer = await apiViewer(spec.role);
    if (spec.maxBytes !== undefined && payloadBytes(raw) > spec.maxBytes) {
      throw new HttpError(413, spec.tooLargeMessage ?? "送る内容が大きすぎます。減らしてから送ってください。");
    }
    const input = spec.input.parse(raw);
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
