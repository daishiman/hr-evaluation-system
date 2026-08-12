/**
 * 最初のパスワード（管理者が発行して本人に渡す仮のもの）を、その場で作る。
 *
 * 人が思いつくパスワードを管理者が手打ちすると、会社ごとに同じ文字列を使い回したり、
 * 「password1234」のような当てやすいものになりやすい。発行のときは常に作った値を
 * 初期表示にして、手で考える余地をなくす。
 *
 * ここで作るのは「本人が最初の1回だけ使う」もの。ログイン後に本人が変更するまで
 * mustChangePassword が立ち続ける（src/lib/session.ts）。
 *
 * 注意: 乱数は必ず crypto.getRandomValues を使う。Math.random は予測できる並びを返す
 * ことがあり、発行するパスワードの材料にしてはいけない。
 */

/**
 * 発行するパスワードの文字数。
 *
 * 本人の変更画面が求める下限（PasswordChangeForm の MIN_LENGTH ＝ 10文字）を
 * 下回らないこと。仮のものが規則を満たしていないと、渡された本人が
 * 「発行された値のままでは変更画面を通せない」ちぐはぐに出くわす。
 * 下限ちょうどではなく12文字にしているのは、この値が紙やチャットに残りやすく、
 * 本人が変えるまでの間だけとはいえ使い回される可能性があるため。
 */
export const PASSWORD_LENGTH = 12;

/**
 * 使う文字。
 *
 * 紛らわしい文字（0とO、1とlとI、2とZ）を外している。この値は口頭・紙・チャットで
 * 人から人へ渡るもので、読み違えると「ログインできない」という問い合わせになり、
 * 発行し直しの手間の方が大きい。
 *
 * 記号は入れない。伝えるときに「アンダーバー」「ハイフン」の言い分けが要るうえ、
 * 環境によっては入力しづらい。強さは長さ（12文字）で確保する。
 * この文字種は54種類あるので、12文字で 54^12 ≒ 10^20 通り。仮のものとして十分。
 */
export const PASSWORD_ALPHABET =
  // 小文字（l・o を除く）
  "abcdefghijkmnpqrstuvwxyz" +
  // 大文字（I・O・Z を除く）
  "ABCDEFGHJKLMNPQRSTUVWXY" +
  // 数字（0・1・2 を除く）
  "3456789";

/** CSV一括発行の成功レスポンスで一度だけ返す、利用者ごとの資格情報。 */
export type IssuedMemberCredential = {
  row: number;
  name: string;
  email: string;
  initialPassword: string;
};

/**
 * 決めた文字種・長さで1つ作る。
 *
 * 文字の選び方に偏りが出ないよう、文字種の数で割り切れない乱数は捨てて引き直す
 * （256 を単純に剰余で丸めると、先頭側の文字だけ出やすくなる）。
 */
export function generateInitialPassword(): string {
  /* 長さと文字種はこのファイルの定数で、`initial-password.test.ts` が
     「長さは10文字以上」「文字種は重複なく揃っている」ことを検査している。
     以前あった「長さ0・文字種0なら空文字を返す」逃げ道は、その検査がある限り
     通ることが無く、読む人に「空のパスワードが出ることがある」と誤解させるため外した。 */
  const n = PASSWORD_ALPHABET.length;
  const limit = Math.floor(256 / n) * n;
  const out: string[] = [];
  const buf = new Uint8Array(PASSWORD_LENGTH * 2);
  while (out.length < PASSWORD_LENGTH) {
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (b >= limit) continue;
      out.push(PASSWORD_ALPHABET[b % n]);
      if (out.length === PASSWORD_LENGTH) break;
    }
  }
  return out.join("");
}

/**
 * 同じ発行処理の中ですでに使った値と重ならないパスワードを1つ作る。
 *
 * crypto の衝突は現実にはほぼ起きないが、CSVで複数人へ発行する以上、
 * 「おそらく別」ではなく「必ず別」を呼び出し側へ返す。乱数源の故障時に
 * 無限ループしないよう、同じ値しか得られない場合は処理そのものを止める。
 */
export function generateUniqueInitialPassword(
  issued: ReadonlySet<string>,
  generate: () => string = generateInitialPassword,
): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    const password = generate();
    if (!issued.has(password)) return password;
  }
  throw new Error("重複しない初期パスワードを生成できませんでした。");
}
