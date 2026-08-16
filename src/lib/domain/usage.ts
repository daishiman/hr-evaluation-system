/**
 * 利用状況（どの画面が・どれだけ・どこで詰まっているか）の数え方。
 *
 * ここは計算だけを持つ純粋な層で、DBもブラウザも触らない。集める側（ブラウザ）と
 * 読む側（システム全体管理者の画面）が同じ数え方を使うための正本にする。
 *
 * ── 個人を特定しない ──
 * 数える単位は「日 × 会社 × 画面 × 役割」までで、利用者IDは持たない。
 * 「誰が何をしたか」ではなく「どの立場の人が、どの画面で詰まっているか」だけを残す。
 * 役割まで落とすのは、同じ画面でも一般の方と管理者では迷う場所が違うため。
 *
 * ── 増え続けないこと（無料の範囲で収める要）──
 * 出来事を1行ずつ残さず、上の単位に足し込む（同じ日の同じ画面は1行のまま増えない）。
 * 1日あたりの行数は「画面数 × 役割4 × 会社数」で頭打ちになり、利用が増えても
 * 行は増えない。保存期間も USAGE_RETENTION_DAYS で切る。
 */

/* ───────────────────────── 数える単位 ───────────────────────── */

/** 画面1枚ぶんの数。すべて「その日・その画面・その役割」での合計。 */
export interface UsageScreenCounters {
  /** 画面を開いた回数 */
  views: number;
  /** 滞在時間の合計（ミリ秒）。平均を出すために合計と回数の両方を持つ */
  dwellMs: number;
  /** 滞在時間を測れた回数。開いた直後に閉じた等で測れない場合があるため views とは別に数える */
  dwellSamples: number;
  /** 長く止まった回数（USAGE_LONG_STAY_MS 以上） */
  longStays: number;
  /** いちど離れてすぐ戻ってきた回数（USAGE_BACKTRACK_WINDOW_MS 以内） */
  backtracks: number;
  /** 同じ場所を続けて押した回数（反応が無いと思われている疑い） */
  rageClicks: number;
  /** 入力欄に触れたのに送信せず離れた回数 */
  abandons: number;
  /** その画面で起きたエラーの件数 */
  errors: number;
}

/** 通信1種類ぶんの数（method + 宛先）。 */
export interface UsageApiCounters {
  /** 呼び出し回数 */
  calls: number;
  /** 所要時間の合計（ミリ秒） */
  durationMs: number;
  /** 失敗した回数（通信できなかった場合を含む） */
  errors: number;
  /** 時間がかかった回数（USAGE_SLOW_API_MS 以上） */
  slowCalls: number;
}

export const EMPTY_SCREEN_COUNTERS: UsageScreenCounters = {
  views: 0,
  dwellMs: 0,
  dwellSamples: 0,
  longStays: 0,
  backtracks: 0,
  rageClicks: 0,
  abandons: 0,
  errors: 0,
};

export const EMPTY_API_COUNTERS: UsageApiCounters = {
  calls: 0,
  durationMs: 0,
  errors: 0,
  slowCalls: 0,
};

/* ───────────────────────── しきい値 ─────────────────────────
 *
 * どれも「迷っているらしい」を機械的に判定するための線引き。値は仮置きであり、
 * 実際の利用が溜まってから見直す前提で、ここ1箇所に集める（画面側で判定しない）。
 */

/** これ以上1枚の画面に留まったら「長く止まった」と数える。 */
export const USAGE_LONG_STAY_MS = 90_000;

/** 離れてからこの時間内に同じ画面へ戻ったら「戻ってやり直した」と数える。 */
export const USAGE_BACKTRACK_WINDOW_MS = 60_000;

/** この時間内に USAGE_RAGE_CLICK_COUNT 回、同じ場所を押したら「連打」と数える。 */
export const USAGE_RAGE_CLICK_WINDOW_MS = 1_500;
export const USAGE_RAGE_CLICK_COUNT = 3;

/** この時間以上かかった通信を「時間がかかった」と数える。 */
export const USAGE_SLOW_API_MS = 1_000;

/**
 * 滞在時間として認めない長さ。画面を開いたままお昼に行った、という時間を
 * 平均へ混ぜると、実際には誰も困っていない画面が最上位に来てしまう。
 */
export const USAGE_MAX_DWELL_MS = 30 * 60_000;

/** 記録を残す日数。これより古い日は消す（保存量と、個人が辿られる余地の両方を抑える）。 */
export const USAGE_RETENTION_DAYS = 180;

/** 画面が既定で見せる期間。長くすると読む行が増えるだけで、判断は変わらない。 */
export const USAGE_DEFAULT_RANGE_DAYS = 30;

/** 画面で選べる期間。 */
export const USAGE_RANGE_DAYS = [7, 30, 90] as const;
export type UsageRangeDays = (typeof USAGE_RANGE_DAYS)[number];

/* ───────────────────────── 送信1回ぶんの上限 ─────────────────────────
 *
 * ブラウザ側は貯めてからまとめて送る。1回の送信で触る行数の上限をここで決め、
 * 書き込み量が想定を超えないようにする。
 */

/** 1回の送信に含めてよい画面の数。 */
export const USAGE_BATCH_MAX_SCREENS = 40;
/** 1回の送信に含めてよい通信の種類の数。 */
export const USAGE_BATCH_MAX_APIS = 40;

/* ───────────────────────── 日付（日本時間で切る） ───────────────────────── */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * その時刻が日本時間で何日にあたるかを `YYYY-MM-DD` で返す。
 *
 * 世界標準時で切ると、日本の朝9時より前の操作が前日に入る。「昨日の朝礼前に
 * 何が起きたか」を読む画面でこれが起きると、日付の並びが業務の感覚と合わなくなる。
 */
export function usageDateKey(at: Date): string {
  return new Date(at.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` を days 日ずらす。 */
export function shiftDateKey(dateKey: string, days: number): string {
  const base = new Date(`${dateKey}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/** その日を最終日として、days 日ぶんの日付を古い順に並べる。 */
export function dateKeyRange(endDateKey: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => shiftDateKey(endDateKey, i - days + 1));
}

/** これより古い日付は消してよい、という境目（この日付は残す）。 */
export function usageRetentionCutoff(today: Date, days: number = USAGE_RETENTION_DAYS): string {
  return shiftDateKey(usageDateKey(today), -(days - 1));
}

/* ───────────────────────── 足し込み ───────────────────────── */

/** 数を足し合わせる。負の数は受け取らない（送信側が壊れても記録を壊さない）。 */
export function addScreenCounters(a: UsageScreenCounters, b: UsageScreenCounters): UsageScreenCounters {
  return {
    views: a.views + b.views,
    dwellMs: a.dwellMs + b.dwellMs,
    dwellSamples: a.dwellSamples + b.dwellSamples,
    longStays: a.longStays + b.longStays,
    backtracks: a.backtracks + b.backtracks,
    rageClicks: a.rageClicks + b.rageClicks,
    abandons: a.abandons + b.abandons,
    errors: a.errors + b.errors,
  };
}

export function addApiCounters(a: UsageApiCounters, b: UsageApiCounters): UsageApiCounters {
  return {
    calls: a.calls + b.calls,
    durationMs: a.durationMs + b.durationMs,
    errors: a.errors + b.errors,
    slowCalls: a.slowCalls + b.slowCalls,
  };
}

/* ───────────────────────── 「迷い」の読み方 ─────────────────────────
 *
 * 迷いを1つの点数に潰さない。点数だけを見せると「なぜ高いのか」が誰にも言えず、
 * 直す場所が決まらない。内訳（どの兆候が何回か）を必ず一緒に出す。
 */

/** 迷いの兆候の種類。画面に出す言葉もここで決める。 */
export const FRICTION_KINDS = ["longStays", "backtracks", "rageClicks", "abandons", "errors"] as const;
export type FrictionKind = (typeof FRICTION_KINDS)[number];

export const FRICTION_LABEL: Record<FrictionKind, string> = {
  longStays: "長く止まった",
  backtracks: "戻ってやり直した",
  rageClicks: "同じ場所を続けて押した",
  abandons: "入力したのに送らず離れた",
  errors: "エラーが出た",
};

/** その兆候が出ているとき、管理者が次に何を見ればよいか。 */
export const FRICTION_HINT: Record<FrictionKind, string> = {
  longStays: "入力量が多いか、何を入れる欄か分かりにくい可能性があります。",
  backtracks: "前の画面で決められず、確認しに戻っています。必要な情報が足りていません。",
  rageClicks: "押しても反応が無いと思われています。処理中の表示か、押せない理由の表示が要ります。",
  abandons: "入力を始めたのに送れていません。必須項目か、送信できない理由が伝わっていません。",
  errors: "その画面で実際にエラーが出ています。届いた改善要望と併せて確認してください。",
};

/** 兆候の合計件数。 */
export function frictionSignals(c: UsageScreenCounters): number {
  return FRICTION_KINDS.reduce((sum, kind) => sum + c[kind], 0);
}

/** 内訳を多い順に。0件の兆候は返さない（読む行を増やさない）。 */
export function frictionBreakdown(c: UsageScreenCounters): { kind: FrictionKind; count: number }[] {
  return FRICTION_KINDS.map((kind) => ({ kind, count: c[kind] }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count || FRICTION_KINDS.indexOf(a.kind) - FRICTION_KINDS.indexOf(b.kind));
}

/**
 * 表示100回あたりの兆候件数。
 *
 * 件数そのままで並べると、単に人がよく通る画面（ホーム）が必ず上に来る。
 * 「その画面を開いた人のうち、どれくらいが詰まったか」で並べたいので率にする。
 */
export function frictionPer100Views(c: UsageScreenCounters): number {
  if (c.views === 0) return 0;
  return Math.round((frictionSignals(c) / c.views) * 1000) / 10;
}

/** 1回あたりの滞在時間。測れた回数が0なら null（0秒と区別する）。 */
export function averageDwellMs(c: UsageScreenCounters): number | null {
  if (c.dwellSamples === 0) return null;
  return Math.round(c.dwellMs / c.dwellSamples);
}

/** 1回あたりの通信時間。呼び出しが0なら null。 */
export function averageApiMs(c: UsageApiCounters): number | null {
  if (c.calls === 0) return null;
  return Math.round(c.durationMs / c.calls);
}

/**
 * 先に直す画面の並び。
 *
 * 兆候の「率」を主にしつつ、率が同じなら人が多く通る方（件数）を上にする。
 * 率だけで並べると、月に2回しか開かれない画面が最上位に居座る。
 * ほとんど使われていない画面（USAGE_MIN_VIEWS_FOR_RANKING 未満）は
 * たまたま1回詰まっただけで100%になるため、順位付けの対象から外す。
 */
export const USAGE_MIN_VIEWS_FOR_RANKING = 5;

export function rankByFriction<T extends { counters: UsageScreenCounters }>(rows: T[]): T[] {
  return rows
    .filter((r) => frictionSignals(r.counters) > 0 && r.counters.views >= USAGE_MIN_VIEWS_FOR_RANKING)
    .sort(
      (a, b) =>
        frictionPer100Views(b.counters) - frictionPer100Views(a.counters) ||
        b.counters.views - a.counters.views,
    );
}

/**
 * 「次に直す1画面」を1つだけ選ぶ。
 *
 * 一覧を出すだけだと、管理者は毎回どこから手を付けるかを自分で決めることになる。
 * 迷いの多い画面・人がよく通る画面・時間のかかる画面はそれぞれ別の順位になるため、
 * ここで1つに決め切る（決められないときは null を返し、画面では何も勧めない）。
 *
 * 決め方: 順位付けの対象（USAGE_MIN_VIEWS_FOR_RANKING 以上開かれた画面）の中から、
 * **兆候の実件数が最も多い画面**を選ぶ。率で選ばないのは、率は「その画面がどれだけ
 * 悪いか」を示すだけで、直したときに救われる人の数を示さないため。率が90%でも
 * 月6回しか開かれない画面より、率が20%でも月400回開かれる画面を直す方が、
 * 実際に詰まっている人は多く減る。件数が同じなら率の高い方（より確かに悪い方）。
 */
export function pickNextScreenToFix<T extends { counters: UsageScreenCounters }>(rows: T[]): T | null {
  const candidates = rankByFriction(rows);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, row) =>
    frictionSignals(row.counters) > frictionSignals(best.counters) ? row : best,
  );
}

/** 時間がかかっている画面の並び（1回あたりの滞在が長い順）。滞在を測れていない画面は外す。 */
export function rankByDwell<T extends { counters: UsageScreenCounters }>(rows: T[]): T[] {
  return rows
    .filter((r) => r.counters.dwellSamples >= USAGE_MIN_VIEWS_FOR_RANKING)
    // 上で「測れた回数が1以上」に絞ってあるので、ここは必ず割り算できる。
    // `averageDwellMs(...) ?? 0` と書くと、決して通らない逃げ道が1本残る。
    // 並べるだけなので丸めない（丸めると1秒未満の差が消えて順番がぶれる）。
    .sort((a, b) => b.counters.dwellMs / b.counters.dwellSamples - a.counters.dwellMs / a.counters.dwellSamples);
}

/* ───────────────────────── 表示用の加工 ───────────────────────── */

/**
 * ミリ秒を人が読む形にする。
 *
 * 「92300ミリ秒」を頭の中で分に直させない。1分未満は秒、1分以上は分と秒に分ける。
 */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ミリ秒`;
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}秒`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}分` : `${minutes}分${seconds}秒`;
}

/** `YYYY-MM-DD` を「8/17」に。横軸に並べるので年は落とす。 */
export function formatDateTick(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}/${Number(day)}`;
}

/**
 * 記録に無い画面を0件として補う。
 *
 * 使われていない画面こそ「作ったのに誰も使えていない」を示す最重要の手がかりで、
 * 記録が無いという理由で一覧から消えると永久に気づけない。
 */
export function fillUnusedScreens<T extends { routePattern: string }>(
  measured: T[],
  allScreens: { routePattern: string; label: string }[],
  empty: (screen: { routePattern: string; label: string }) => T,
): T[] {
  const seen = new Set(measured.map((row) => row.routePattern));
  return [...measured, ...allScreens.filter((s) => !seen.has(s.routePattern)).map(empty)];
}
