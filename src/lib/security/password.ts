/**
 * パスワードの長さの決まり（DD-032 の4）。
 *
 * 画面のフォーム・サーバーの検査・better-auth の設定・管理者を追加する script が、
 * どれもこの値を使う。場所ごとに数字を書くと、どこか1か所だけ緩いままになりやすい。
 *
 * このファイルは何も import しない。scripts/add-user.mjs が
 * `node --experimental-strip-types` で、このファイルをそのまま読むため。
 */

export const PASSWORD_MIN_LENGTH = 10;

/** 長すぎる入力でハッシュの計算を重くさせない上限 */
export const PASSWORD_MAX_LENGTH = 200;

/** 決まりに合えば null、合わなければ利用者に見せる理由を返す */
export function validateNewPassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `パスワードは${PASSWORD_MIN_LENGTH}文字以上にしてください`;
  if (password.length > PASSWORD_MAX_LENGTH) return `パスワードは${PASSWORD_MAX_LENGTH}文字以下にしてください`;
  return null;
}
