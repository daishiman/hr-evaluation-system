import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError } from "@/lib/session";

/**
 * APIハンドラの共通処理。
 * 権限エラー・入力エラーを日本語のメッセージに揃えて返す。
 * 画面側の分岐に頼らず、ここを通ったものだけがデータを触れる。
 */
export function jsonError(e: unknown) {
  if (e instanceof HttpError) {
    return NextResponse.json(
      { ok: false, message: e.message },
      { status: e.status, headers: e.responseHeaders },
    );
  }
  if (e instanceof z.ZodError) {
    const first = e.issues[0];
    return NextResponse.json(
      { ok: false, message: `入力内容を確認してください（${first?.path.join(".") || "入力値"}：${first?.message}）` },
      { status: 400 },
    );
  }
  console.error(e);
  return NextResponse.json({ ok: false, message: "処理中に問題が発生しました。時間をおいて試してください。" }, { status: 500 });
}

export async function handle(fn: () => Promise<unknown>) {
  try {
    const data = await fn();
    return NextResponse.json({ ok: true, ...(data && typeof data === "object" ? data : { data }) });
  } catch (e) {
    return jsonError(e);
  }
}

export function badRequest(message: string): never {
  throw new HttpError(400, message);
}

export function notFound(message = "対象が見つかりませんでした。"): never {
  throw new HttpError(404, message);
}
