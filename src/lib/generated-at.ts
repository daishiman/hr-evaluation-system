/**
 * Worker が応答を返せるようになった時刻を示すヘッダー。
 *
 * 「保存したのに再読み込みしても出ない」と報告されたとき、届いた画面が
 * Worker を通った時刻を開発者ツールで確認するために付ける（docs/deploy-notes.md §7）。
 * 時刻だけを載せ、利用者や会社を表す値は載せない。
 *
 * 静的ファイル（.open-next/assets）は Worker を通らずに配られるので付かない。
 * 画面や API の応答にこのヘッダーが無ければ、Worker 以外のどこかが応答を返している。
 */
export const GENERATED_AT_HEADER = "x-generated-at";

/**
 * 応答に生成時刻を付けた写しを返す。
 *
 * 時刻は Worker が応答の頭（状態とヘッダー）を返せるようになった時点。
 * データの読み取りはこの時刻より前にも後にも起こり、本文はこの後も流れ続けうる。
 * 保存前に読み取った本文へ保存後の時刻が付くこともあるため、
 * このヘッダーだけではDBの読取時刻や保存結果を含むことを保証しない。
 */
export function stampGeneratedAt(res: Response, now: Date = new Date()): Response {
  // 101（WebSocket への切り替え）などは Response を作り直せないので、そのまま返す。
  if (res.status < 200) return res;
  // fetch の結果などはヘッダーが書き換え不可なので、本文の流れはそのままに写しを作る。
  const stamped = new Response(res.body, res);
  stamped.headers.set(GENERATED_AT_HEADER, now.toISOString());
  return stamped;
}
