import { HttpError } from "@/lib/session";

/**
 * 本文を、宣言サイズと読取中の実バイト数の両方で上限まで読む。本文が無ければ null。
 * 中身を解析しない口（認証の口。本文を better-auth に渡し直す）もこれで読む（DD-032 の9）。
 */
export async function readBodyWithinLimit(request: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) {
    throw new HttpError(413, "送信内容が大きすぎます。内容を減らしてお試しください。");
  }

  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        // 超過は確定しているので、後片付けの失敗で413を別のエラーへ変えない。
        await reader.cancel().catch(() => {});
        throw new HttpError(413, "送信内容が大きすぎます。内容を減らしてお試しください。");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * JSONを解析する前に宣言サイズを、読取中にも実バイト数を検査する。
 * 画像を含む投稿がWorkerのメモリを無制限に使わないための共通境界。
 */
export async function readJsonBodyWithinLimit(request: Request, maxBytes: number): Promise<unknown> {
  const bytes = await readBodyWithinLimit(request, maxBytes);
  if (!bytes) throw new HttpError(400, "送信内容を確認してください。");
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(400, "送信内容の形式を確認してください。");
  }
}
