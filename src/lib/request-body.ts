import { HttpError } from "@/lib/session";

/**
 * JSONを解析する前に宣言サイズを、読取中にも実バイト数を検査する。
 * 画像を含む投稿がWorkerのメモリを無制限に使わないための共通境界。
 */
export async function readJsonBodyWithinLimit(request: Request, maxBytes: number): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) {
    throw new HttpError(413, "送信内容が大きすぎます。画像を外すか、撮り直してお試しください。");
  }

  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "送信内容を確認してください。");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, "送信内容が大きすぎます。画像を外すか、撮り直してお試しください。");
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
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(400, "送信内容の形式を確認してください。");
  }
}
