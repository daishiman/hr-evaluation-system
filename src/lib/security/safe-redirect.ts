/**
 * 戻り先を、自分のサイトの中の path だけにする（DD-032 の6）。
 *
 * 「/ で始まるか」だけを見る判定では、// や /\ で始まる値・途中にタブや改行を挟んだ値を
 * 通してしまう。ブラウザはそれらを外のサイトとして読むので、ログインの後に外へ送られる。
 * 先に形を絞り、そのうえで同じ origin の基準の URL で解決して、origin が変わらないものだけを返す。
 * 返すのは path・query・hash だけで、解決の基準の origin は返さない。
 * 解決で点の区切りを畳むと、path が // で始まり直すことがある。組み立てた値も同じ判定にかける。
 */

const BASE = "http://base.invalid";

export function isSafeRedirectPath(value: string): boolean {
  if (!value.startsWith("/")) return false;
  if (value[1] === "/" || value[1] === "\\") return false;
  // 制御文字（タブ・改行・NUL など）と \ は、ブラウザが読み替えるので受けない
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return false;
  try {
    return new URL(value, BASE).origin === BASE;
  } catch {
    return false;
  }
}

/** 戻り先として使える path を返す。使えなければ fallback */
export function safeRedirectPath(input: unknown, fallback: string): string {
  if (typeof input !== "string" || !isSafeRedirectPath(input)) return fallback;
  const url = new URL(input, BASE);
  const path = `${url.pathname}${url.search}${url.hash}`;
  return isSafeRedirectPath(path) ? path : fallback;
}
