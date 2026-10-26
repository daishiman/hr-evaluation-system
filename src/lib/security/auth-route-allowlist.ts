/**
 * 認証の口のうち、画面が使うものだけを開ける（DD-032 の2）。
 *
 * better-auth は、使っていない口（自分で登録する・パスワードを忘れた・利用者を消す など）も
 * 既定で持っている。設定で閉じたつもりでも、版が上がって口が増えることがあるので、
 * 開ける口を名指しで決め、ほかはすべて 404 にする。
 * 比べるのは完全一致だけ。末尾の / や大文字の違いを同じ口として扱わない。
 */

const ALLOWED_AUTH_ROUTES: ReadonlySet<string> = new Set([
  "POST /api/auth/sign-in/email",
  "POST /api/auth/sign-out",
  "GET /api/auth/get-session",
]);

export function isAllowedAuthRoute(method: string, pathname: string): boolean {
  return ALLOWED_AUTH_ROUTES.has(`${method} ${pathname}`);
}
