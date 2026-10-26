/**
 * 書き込みの送り元が、このサイト自身かを確かめる（DD-032 の17。PLT-19・APP-22）。
 *
 * - Origin があれば、その host と、届いた先の host を比べる。"null" や読めない値は拒む。
 * - Origin が無いときは、ブラウザが付ける Sec-Fetch-Site を見る。
 *   same-origin（同じサイトの画面から）と none（利用者がアドレスを直に開いた）だけを通す。
 * - どちらも無い送信は、送り元を確かめられないので拒む。
 *   以前は「Origin が無ければ通す」だったため、Origin を付けない送り方で確認を飛ばせた。
 */

export function isSameOriginRequest({
  origin,
  secFetchSite,
  host,
}: {
  origin: string | null;
  secFetchSite: string | null;
  host: string | null;
}): boolean {
  if (origin) {
    if (origin === "null" || !host) return false;
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  return secFetchSite === "same-origin" || secFetchSite === "none";
}
