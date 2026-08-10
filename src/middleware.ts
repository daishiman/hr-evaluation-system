import { NextResponse, type NextRequest } from "next/server";

/**
 * 全リクエスト共通の入口。
 *
 * 1. 書き込み（GET以外）は、別サイトの画面から勝手に送られていないかを確認する。
 *    ログイン状態のまま外部サイトを開いても、そこからデータを書き換えられないようにするため。
 * 2. すべての応答に基本のセキュリティヘッダーを付ける。
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function middleware(req: NextRequest) {
  if (!SAFE_METHODS.has(req.method)) {
    const origin = req.headers.get("origin");
    const self = req.nextUrl.origin;
    if (origin && origin !== self) {
      return NextResponse.json(
        { ok: false, message: "この操作は受け付けられませんでした。画面を開き直してからもう一度お試しください。" },
        { status: 403 },
      );
    }
  }

  const res = NextResponse.next();
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return res;
}

export const config = {
  // 静的ファイルは対象外にする（配信を速いままにするため）
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
