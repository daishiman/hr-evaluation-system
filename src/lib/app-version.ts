/**
 * いま配っているアプリの版。
 *
 * 指示文に載せる。載っていないと、読み手は「直っている版の話なのか」を
 * 判断できず、すでに直した不具合をもう一度追いかけることになる。
 *
 * 値は Cloudflare 側が配布ごとに割り当てるもの（CF_VERSION_METADATA）。
 * 手元やテストのように実行コンテキストが無い場所では読めないので null を返し、
 * 指示文には「不明」と出す（黙って空欄にしない）。
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

interface VersionEnv {
  CF_VERSION_METADATA?: { id?: string; tag?: string };
}

export async function appVersion(): Promise<string | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as unknown as VersionEnv).CF_VERSION_METADATA?.id ?? null;
  } catch {
    return null;
  }
}
