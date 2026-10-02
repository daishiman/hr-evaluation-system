import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError } from "@/lib/session";

/** 想定していない失敗のときに画面へ出す言葉。中身（例外の文面）は利用者に見せない。 */
export const UNEXPECTED_ERROR_MESSAGE = "処理中に問題が発生しました。時間をおいて試してください。";

/**
 * 失敗を、画面に出す言葉と状態コードへ直す。
 *
 * APIの応答（jsonError）と Server Action の戻り値（src/lib/action.ts）で
 * 同じ言葉を返すため、変換はここ1箇所に置く。想定外の失敗だけはログに残す。
 */
export function describeError(e: unknown): { status: number; message: string; headers?: HeadersInit } {
  if (e instanceof HttpError) return { status: e.status, message: e.message, headers: e.responseHeaders };
  if (e instanceof z.ZodError) {
    const first = e.issues[0];
    return {
      status: 400,
      message: `入力内容を確認してください（${first?.path.join(".") || "入力値"}：${first?.message}）`,
    };
  }
  console.error(e);
  return { status: 500, message: UNEXPECTED_ERROR_MESSAGE };
}

/**
 * APIの応答に付ける保存の指示。ブラウザにも途中の配信網にも残させない。
 *
 * 画面（HTML）は Next.js が動的描画のときに同じ指示を付けるが、
 * Route Handler の JSON には何も付かない。氏名や評価の状態を返すので、
 * 残ると古い中身や他の人の中身が出うる（docs/product/spec.md §27）。
 */
export const API_CACHE_CONTROL = "private, no-store";

/**
 * 短い JSON（ID・合言葉・真偽値が数個）だけを受け取る入口の上限（バイト）。
 *
 * 画面からの action と端末向けの API の両方で使う。入口ごとに数字を書くと、
 * 片方だけ変わって同じ形の入力が入口によって通ったり断られたりするため、ここ1か所に置く。
 * 画像や CSV のように大きくなりうる入口は、それぞれ専用の上限を持つ。
 */
export const SMALL_JSON_MAX_BYTES = 4_000;

function noStore(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  headers.set("cache-control", API_CACHE_CONTROL);
  return headers;
}

/**
 * APIハンドラの共通処理。
 * 権限エラー・入力エラーを日本語のメッセージに揃えて返す。
 * 画面側の分岐に頼らず、ここを通ったものだけがデータを触れる。
 */
export function jsonError(e: unknown) {
  const { status, message, headers } = describeError(e);
  return NextResponse.json({ ok: false, message }, { status, headers: noStore(headers) });
}

export async function handle(fn: () => Promise<unknown>) {
  try {
    const data = await fn();
    return NextResponse.json(
      { ok: true, ...(data && typeof data === "object" ? data : { data }) },
      { headers: noStore() },
    );
  } catch (e) {
    return jsonError(e);
  }
}
