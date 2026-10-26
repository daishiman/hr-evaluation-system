/**
 * 単純な固定ウィンドウ方式のレート制限。
 *
 * ログイン試行の制限（Better Auth 既定: sign-in・change-password は「10秒に3回まで」）
 * と同じ閾値を、Better Auth のルーターを経由しないAPI
 * （サーバー側から `auth.api.xxx` を直接呼ぶ場所）にも適用するための小さな仕組み。
 *
 * Better Auth 自身の制限は `auth.handler` を通したときだけ効く。
 * `src/actions/account.ts`（パスワード変更）のように `auth.api.changePassword` を
 * 直接呼ぶ経路は、その仕組みの外側にあるため素通りしてしまう。ここではその抜け穴を、
 * 同じ期間・同じ上限で塞ぐ。ただしここは最初の試行から数える固定窓で、
 * 許可された試行ごとに基準時刻を進める Better Auth とは再開時刻が異なる。
 *
 * 保存先はメモリ（Map）。Better Auth の既定（secondaryStorage 未設定時）もメモリなので、
 * 「同じisolateの間だけ効く」という制約も含めて既存のログイン制限と揃えている。
 *
 * 鍵を次々に変えて送られても isolate のメモリを食い尽くさないよう、鍵の先頭（`:` の前）が
 * 表す用途ごとに表を分け、それぞれに件数の上限を置く（合わせて1万件。DD-032 の11）。
 * 上限に届いたら、期限切れ → 止めていない項目の古い順 → 止めている項目の古い順に捨てる。
 * 止めている項目を後に回すのは、新しい鍵を大量に送って自分の制限を押し出すのを防ぐため。
 */

export interface RateLimitRule {
  /** この期間（ミリ秒）に何回まで許すか */
  windowMs: number;
  max: number;
}

interface Entry {
  count: number;
  windowStart: number;
  /** 掃除で「期限切れ」「止めている」を見分けるため、使った決まりを持たせておく */
  windowMs: number;
  max: number;
}

/**
 * 用途ごとの件数の上限。鍵の先頭（`:` の前）で用途を見分ける。
 * 決まっていない用途の鍵は `other` の表にまとめて入れる。
 */
export const RATE_LIMIT_PURPOSE_CAPS = {
  "account-password": 2_000,
  "improvement-submit": 1_000,
  usage: 2_000,
  "agent-api": 2_000,
  "agent-device": 2_000,
  other: 1_000,
} as const satisfies Record<string, number>;

/** すべての表を合わせた件数の上限 */
export const RATE_LIMIT_TOTAL_MAX = Object.values(RATE_LIMIT_PURPOSE_CAPS).reduce((sum, cap) => sum + cap, 0);

type Purpose = keyof typeof RATE_LIMIT_PURPOSE_CAPS;

interface Table {
  entries: Map<string, Entry>;
  /** 残っている項目の、いちばん早い期限（これより前なら期限切れを探さない） */
  nextExpiry: number;
}

const tables = new Map<Purpose, Table>();

function purposeOf(key: string): Purpose {
  const head = key.slice(0, Math.max(key.indexOf(":"), 0));
  return Object.hasOwn(RATE_LIMIT_PURPOSE_CAPS, head) ? (head as Purpose) : "other";
}

function tableFor(purpose: Purpose): Table {
  let table = tables.get(purpose);
  if (!table) {
    table = { entries: new Map(), nextExpiry: Infinity };
    tables.set(purpose, table);
  }
  return table;
}

const expired = (entry: Entry, now: number) => now - entry.windowStart >= entry.windowMs;
const blocked = (entry: Entry, now: number) => !expired(entry, now) && entry.count >= entry.max;

/** 表が上限に届いているとき、1件分の空きを作る */
function makeRoom(table: Table, cap: number, now: number): void {
  if (table.entries.size < cap) return;
  if (now >= table.nextExpiry) {
    let next = Infinity;
    for (const [key, entry] of table.entries) {
      if (expired(entry, now)) table.entries.delete(key);
      else next = Math.min(next, entry.windowStart + entry.windowMs);
    }
    table.nextExpiry = next;
    if (table.entries.size < cap) return;
  }
  // Map は入れた順に回るので、最初に見つかったものが最も古い
  for (const [key, entry] of table.entries) {
    if (!blocked(entry, now)) {
      table.entries.delete(key);
      return;
    }
  }
  const oldest = table.entries.keys().next();
  if (!oldest.done) table.entries.delete(oldest.value);
}

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

/** 改善要望の連投。文章を書き直せる余裕を残しつつ、画像付き連投を抑える。 */
export const IMPROVEMENT_SUBMIT_RATE_LIMIT: RateLimitRule = { windowMs: 60_000, max: 5 };

/**
 * 利用状況の記録を受け取るAPIの制限。
 *
 * 画面側は貯めてからまとめて送るので、普通に使っている限り1分に数回しか来ない。
 * 画面を次々に開いても足りるよう20回まで見ておき、それを超える分は数えない
 * （記録が多少欠けても業務は止まらないが、書き込みが増え続けるのは困る）。
 */
export const USAGE_INGEST_RATE_LIMIT: RateLimitRule = { windowMs: 60_000, max: 20 };

/**
 * 作業指示文を受け取るAPIの制限。
 *
 * 鍵を当てにくるのは1つの回線から連続で来るので、鍵を確かめる前に
 * 回線ごとで数える。正しい鍵で使う分には、1分に30回もあれば足りる
 * （一覧を1回、指示文をまとめて数回）。
 */
export const AGENT_API_RATE_LIMIT: RateLimitRule = { windowMs: 60_000, max: 30 };

/**
 * key への1回の試行を記録し、許可するかどうかを返す。
 * 固定ウィンドウ方式（ウィンドウが変わったら数え直す）。
 */
export function consumeRateLimit(key: string, rule: RateLimitRule, now: number = Date.now()): RateLimitResult {
  const purpose = purposeOf(key);
  const table = tableFor(purpose);
  const entry = table.entries.get(key);

  if (!entry || now - entry.windowStart >= rule.windowMs) {
    if (entry) table.entries.delete(key);
    else makeRoom(table, RATE_LIMIT_PURPOSE_CAPS[purpose], now);
    // 数え直す項目は、入れ直して「新しい項目」の側へ回す
    table.entries.set(key, { count: 1, windowStart: now, windowMs: rule.windowMs, max: rule.max });
    table.nextExpiry = Math.min(table.nextExpiry, now + rule.windowMs);
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
  tables.clear();
}

/** テストから表の件数を見るためだけに公開する（用途を省くと全体の件数）。 */
export function _rateLimitStoreSizeForTest(purpose?: Purpose): number {
  if (purpose) return tables.get(purpose)?.entries.size ?? 0;
  let size = 0;
  for (const table of tables.values()) size += table.entries.size;
  return size;
}
