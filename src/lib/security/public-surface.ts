/**
 * 使っていない公開の口を、Next.js へ渡す前に閉じる（DD-032 の12）。
 *
 * 画像の変換の口（Next.js のものと Cloudflare のもの）は、このアプリでは使っていない。
 * 開いたままだと、外の画像を取りに行かせる・変換を重ねて負荷をかける、といった使われ方が残る。
 * worker.ts が handler.fetch の前にこれで判定し、404 を返す。
 */

const CLOSED_PREFIXES = ["/_next/image", "/cdn-cgi/image"] as const;

export function isClosedPublicPath(pathname: string): boolean {
  return CLOSED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
