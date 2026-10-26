import { jsonError, SMALL_JSON_MAX_BYTES } from "@/lib/api";
import { getAuth } from "@/lib/auth";
import { readBodyWithinLimit } from "@/lib/request-body";
import { isAllowedAuthRoute } from "@/lib/security/auth-route-allowlist";

/**
 * Better Auth のエンドポイント（ログイン・ログアウト・セッション取得）。
 * 画面が使う3つの口のほかは、better-auth へ渡す前に 404 にする（DD-032 の2）。
 * better-auth は本文を上限なしに読むので、ほかの Route Handler と同じ上限まで先に読み、
 * 読んだ本文で要求を作り直して渡す（DD-032 の9）。ログインの本文はメールとパスワードだけで、短い JSON の上限に収まる。
 */
async function handler(request: Request) {
  if (!isAllowedAuthRoute(request.method, new URL(request.url).pathname)) {
    return new Response("Not Found", { status: 404 });
  }
  let body: Uint8Array<ArrayBuffer> | null;
  try {
    body = await readBodyWithinLimit(request, SMALL_JSON_MAX_BYTES);
  } catch (e) {
    return jsonError(e);
  }
  const auth = await getAuth();
  return auth.handler(new Request(request.url, { method: request.method, headers: request.headers, body }));
}

export { handler as GET, handler as POST };
