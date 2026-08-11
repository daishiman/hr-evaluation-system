import { headers } from "next/headers";

/**
 * いま動いているアプリの入口（https://ホスト名）を返す。
 *
 * 画面に出す配布用URLは、そのまま貼って開ける形（絶対URL）でなければ意味がない。
 * かといってドメインをコードに書くと、本番・プレビュー・ローカルで別物になるため必ずどこかで嘘になる。
 * そこで実行時に決める。
 *
 * 優先順位には理由がある。
 *  1. APP_ORIGIN（設定）— Host ヘッダーは呼び出し側が自由に付けられる。
 *     細工したリクエストで「別ドメインのURL」を画面に表示させ、それを管理者が
 *     コピーして配ってしまう筋道があるので、設定で固定できる方を先に見る。
 *  2. x-forwarded-proto + host — 設定が無いときの実際の値。Cloudflare/Next の前段が付ける。
 *
 * 末尾の / は必ず落とす。呼び出し側は `${origin}/f/...` と書くので、
 * 残っていると `//f/...` になり、プロトコル相対URLとして別ホストに飛びうる。
 */
export async function appOrigin(): Promise<string> {
  const configured = (process.env.APP_ORIGIN ?? (await cloudflareAppOrigin()))?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "";
  return host ? `${proto}://${host}` : "";
}

/**
 * wrangler.jsonc の vars を読む。
 * Cloudflare 上の vars は process.env ではなく実行コンテキストに入るため
 * （src/lib/auth.ts の BETTER_AUTH_URL と同じ経路）、そちらも見る。
 * ローカルの vitest など、実行コンテキストが無い場所では黙って null を返す
 * ——ここで落とすと、URLを1つ出せないだけで画面全体が表示できなくなるため。
 */
async function cloudflareAppOrigin(): Promise<string | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    return (env as { APP_ORIGIN?: string }).APP_ORIGIN ?? null;
  } catch {
    return null;
  }
}

/** アンケートの配布用URL。トークンからの組み立てを1か所にまとめる（画面ごとに書くとズレるため）。 */
export function formUrl(origin: string, publicToken: string): string {
  return `${origin}/f/${publicToken}`;
}
