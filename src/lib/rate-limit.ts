/**
 * 単純な固定ウィンドウ方式のレート制限。
 *
 * ログイン試行の制限（Better Auth 既定: sign-in・change-password は「10秒に3回まで」）
 * と同じ考え方・同じ数字を、Better Auth のルーターを経由しないAPI
 * （サーバー側から `auth.api.xxx` を直接呼ぶ場所）にも適用するための小さな仕組み。
 *
 * Better Auth 自身の制限は `auth.handler` を通したときだけ効く。
 * `src/app/api/account/password/route.ts` のように `auth.api.changePassword` を
 * 直接呼ぶ経路は、その仕組みの外側にあるため素通りしてしまう。ここではその抜け穴を、
 * 同じウィンドウ・同じ上限で塞ぐ。
 *
 * 保存先はメモリ（Map）。Better Auth の既定（secondaryStorage 未設定時）もメモリなので、
 * 「同じisolateの間だけ効く」という制約も含めて既存のログイン制限と揃えている。
 */

export interface RateLimitRule {
  /** この期間（ミリ秒）に何回まで許すか */
  windowMs: number;
  max: number;
}

interface Entry {
  count: number;
  windowStart: number;
}

const store = new Map<string, Entry>();

export interface RateLimitResult {
  allowed: boolean;
  /** ブロック時、あと何秒待てば良いか（許可された場合は0） */
  retryAfterSeconds: number;
}

/**
 * ログイン・パスワード変更（現在のパスワード確認）と同じ設定。
 * Better Auth の既定の特別ルール（sign-in / change-password 系）に合わせてある。
 */
export const AUTH_ATTEMPT_RATE_LIMIT: RateLimitRule = { windowMs: 10_000, max: 3 };

/**
 * key への1回の試行を記録し、許可するかどうかを返す。
 * 固定ウィンドウ方式（ウィンドウが変わったら数え直す）。
 */
export function consumeRateLimit(key: string, rule: RateLimitRule, now: number = Date.now()): RateLimitResult {
  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= rule.windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= rule.max) {
    const retryAfterSeconds = Math.ceil((entry.windowStart + rule.windowMs - now) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
  }

  entry.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** テストから状態をリセットするためだけに公開する。本体のコードからは呼ばない。 */
export function _resetRateLimitStoreForTest(): void {
  store.clear();
}
