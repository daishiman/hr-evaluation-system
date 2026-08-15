/**
 * GitHub の書き込み用トークンを用意するための案内。
 *
 * 「設定が足りません」だけでは、受け取った人が取得先を検索することになる。
 * 用意できるのは運営者本人だけなので、どこで作るか・何を選ぶかまで
 * その場に出す。URL はここにしか書かない（画面・API・手順書が同じものを指す）。
 *
 * 対象リポジトリは設定値（GITHUB_REPO）から受け取る。ここに書き写すと、
 * 出し先を変えたときに案内だけが古いまま残る。
 */

/** 新しく作る画面（fine-grained personal access token） */
export const GITHUB_TOKEN_NEW_URL = "https://github.com/settings/personal-access-tokens/new";

/** 発行済みの確認・失効 */
export const GITHUB_TOKEN_LIST_URL = "https://github.com/settings/personal-access-tokens";

/** 登録に使うコマンド。画面と手順書で同じ文字列を出す。 */
export const GITHUB_TOKEN_PUT_COMMAND = "wrangler secret put GITHUB_TOKEN";

/**
 * トークンが未設定のときに出す案内。
 * 1行1手順にして、上から順に実行すれば終わる形にする。
 */
export function githubTokenSetupLines(repo: string): string[] {
  return [
    `取得先：${GITHUB_TOKEN_NEW_URL}`,
    "Resource owner はリポジトリの持ち主を選びます。",
    "Repository access を開きます。",
    `Only select repositories で ${repo} だけを選びます。`,
    "Permissions の Issues を開きます。",
    "Read and write を選びます。",
    "ほかの権限は No access のままで足ります。",
    "作成後の値は一度しか表示されません。",
    "その場でコピーしてください。",
    `登録は ${GITHUB_TOKEN_PUT_COMMAND} を実行します。`,
    "期限を付けた場合、切れたら同じ手順で入れ直します。",
    `発行済みの確認・失効：${GITHUB_TOKEN_LIST_URL}`,
  ];
}

/**
 * 未設定エラーの本文。1行目が何が起きたか、2行目以降が手順。
 * 画面側はこの改行で区切って、URL を押せる形に置き換える。
 */
export function githubTokenMissingMessage(repo: string): string {
  return ["GitHub の書き込み用トークンが未設定です。", ...githubTokenSetupLines(repo)].join("\n");
}
