import { getAuth } from "@/lib/auth";

/** Better Auth のエンドポイント（ログイン・ログアウト・セッション取得）。 */
async function handler(request: Request) {
  const auth = await getAuth();
  return auth.handler(request);
}

export { handler as GET, handler as POST };
