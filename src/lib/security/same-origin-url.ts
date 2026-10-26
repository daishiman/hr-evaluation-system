/** 観測してよい自社通信だけを返す。相対URLは現在ページ基準で解決する（製品にbaseタグは無い）。 */
export function sameOriginUrl(raw: string, currentPageUrl: string): URL | null {
  try {
    const page = new URL(currentPageUrl);
    const url = new URL(raw, page);
    return url.origin === page.origin ? url : null;
  } catch {
    return null;
  }
}
