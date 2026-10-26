/**
 * 回数制限の数え先（送り元の IP）を決める（DD-032 の3）。
 *
 * ── どのヘッダーを信じるか ──
 * Cloudflare が付ける cf-connecting-ip だけを読む。x-forwarded-for や x-real-ip は
 * 利用者が自由に書けるので、そこを数え先にすると、値を変えるだけで制限をすり抜けられる。
 * このファイルの外でヘッダーの名前を書かない（試験が src 全体を見て確かめる）。
 *
 * ── 数え先の形 ──
 * - IPv4 はそのまま。
 * - IPv6 は先頭の64ビット（/64）にまとめる。1つの回線には /64 が丸ごと割り当てられることが多く、
 *   番号を変えるたびに別の人として数えると、制限が効かない。
 * - 読めない値・複数の値・ヘッダーが無いときは、共通の1つの入れ物で数える
 *   （壊れた値を送れば数えられない、という抜け道を作らない）。
 */

export const CLIENT_IP_HEADER = "cf-connecting-ip";

export const UNKNOWN_CLIENT_IP = "unknown";

function normalizeIpv4(value: string): string | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) return null;
  }
  return value;
}

/** IPv6 を8つの組に展開する。読めなければ null */
function expandIpv6(value: string): string[] | null {
  if (!/^[0-9a-f:]+$/i.test(value) || value.includes(":::")) return null;
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  if (groups.some((g) => !/^[0-9a-f]{1,4}$/i.test(g))) return null;
  return groups;
}

export function clientIpKey(headers: Headers): string {
  const value = headers.get(CLIENT_IP_HEADER)?.trim() ?? "";
  if (!value) return UNKNOWN_CLIENT_IP;

  const mapped = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) return normalizeIpv4(mapped[1]) ?? UNKNOWN_CLIENT_IP;

  if (value.includes(".")) return normalizeIpv4(value) ?? UNKNOWN_CLIENT_IP;

  const groups = expandIpv6(value);
  if (!groups) return UNKNOWN_CLIENT_IP;
  const prefix = groups.slice(0, 4).map((g) => parseInt(g, 16).toString(16));
  return `${prefix.join(":")}::/64`;
}
