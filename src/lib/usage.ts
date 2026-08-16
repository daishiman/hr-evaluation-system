import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { chunkRowsForD1, schema as s, type DB } from "@/lib/db";
import { routeIdentityOf, routeMetaOf, ROUTE_META } from "@/lib/nav";
import type { Role } from "@/lib/session";
import {
  addApiCounters,
  addScreenCounters,
  EMPTY_API_COUNTERS,
  EMPTY_SCREEN_COUNTERS,
  USAGE_BATCH_MAX_APIS,
  USAGE_BATCH_MAX_SCREENS,
  USAGE_MAX_DWELL_MS,
  usageDateKey,
  usageRetentionCutoff,
  type UsageApiCounters,
  type UsageScreenCounters,
} from "@/lib/domain/usage";

/**
 * 利用状況の受け取りと読み出し。
 *
 * 数え方そのものは src/lib/domain/usage.ts が正本で、ここはDBとの出入りだけを持つ。
 *
 * ── 受け取るときの原則 ──
 * 会社と役割は**必ずセッションから決める**。本文に入れさせない。本文で受け取ると、
 * ログインさえしていれば他社の記録を好きなだけ増やせてしまい、この画面の数字が
 * 誰にでも汚せるものになる。ブラウザが送ってよいのは「どの画面を・何回」だけ。
 */

/* ───────────────────────── 受け取る形 ───────────────────────── */

const nonNegative = z.number().int().min(0).max(100_000);

const screenBatchSchema = z.object({
  /** 実URL。ここで動的IDを落として集計用ルートに直す */
  path: z.string().min(1).max(300),
  views: nonNegative,
  dwellMs: z.number().int().min(0).max(USAGE_MAX_DWELL_MS * USAGE_BATCH_MAX_SCREENS),
  dwellSamples: nonNegative,
  longStays: nonNegative,
  backtracks: nonNegative,
  rageClicks: nonNegative,
  abandons: nonNegative,
  errors: nonNegative,
});

const apiBatchSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string().min(1).max(300),
  calls: nonNegative,
  durationMs: z.number().int().min(0).max(60 * 60_000),
  errors: nonNegative,
  slowCalls: nonNegative,
});

export const usageBatchSchema = z
  .object({
    screens: z.array(screenBatchSchema).max(USAGE_BATCH_MAX_SCREENS).default([]),
    apis: z.array(apiBatchSchema).max(USAGE_BATCH_MAX_APIS).default([]),
  })
  .strict();

export type UsageBatch = z.infer<typeof usageBatchSchema>;

/**
 * 1回の送信で受け取る上限。
 *
 * 中身は数と短いURLだけなので、上限に当たること自体が「送る側が壊れている」合図。
 * 画像を含む改善要望とは桁が違うため、専用に小さく取る。
 */
export const USAGE_BATCH_MAX_BYTES = 32 * 1024;

/* ───────────────────────── 受け取って足し込む ───────────────────────── */

/** 画面のURLから、集計に使うルートの形だけを取り出す。台帳に無いURLは数えない。 */
function screenRouteOf(path: string): string | null {
  const { routePattern } = routeIdentityOf(path);
  // 台帳に載っていない形（存在しないURLを手で送られた場合）は記録を汚さないため捨てる
  return routeMetaOf(routePattern) ? routePattern : null;
}

/**
 * APIの宛先を集計用の形にする。
 *
 * 画面の台帳（route-ledger）はAPIを持たないので、ID部分を自前で潰す。
 * ランダムなIDをそのまま残すと、同じAPIが呼ばれるたびに新しい行が増えて
 * 行数の頭打ちが壊れる。
 */
export function apiRoutePatternOf(path: string): string | null {
  const clean = path.split(/[?#]/)[0] || "";
  if (!clean.startsWith("/api/")) return null;
  const normalized = clean
    .split("/")
    .map((seg) =>
      /* 内部ID（接頭辞_ランダム20桁 → src/lib/id.ts）・UUID・数字だけの区切りは
         まとめて [id] に潰す。画面のURLに使う語は英小文字とハイフンだけなので、
         下線を含む区切りをIDとみなしても、本物の画面名を潰すことはない。 */
      /^[a-z]+_[0-9a-z]{6,}$/i.test(seg) ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg) ||
      /^\d+$/.test(seg) ||
      seg.length > 24
        ? "[id]"
        : seg,
    )
    .join("/");
  return normalized.slice(0, 120);
}

const screenKey = (date: string, companyId: string, routePattern: string, role: string) =>
  `${date}:${companyId}:${routePattern}:${role}`;

const apiKey = (date: string, companyId: string, method: string, routePattern: string) =>
  `${date}:${companyId}:${method}:${routePattern}`;

/**
 * 送られてきた1回ぶんを、その日の行へ足し込む。
 *
 * 同じ日の同じ画面は1行のままで、数だけが増える（行は増えない）。
 * 会社と役割は呼び出し側が検証済みのセッションから渡す。
 */
export async function recordUsageBatch(
  db: DB,
  { companyId, role }: { companyId: string; role: Role },
  batch: UsageBatch,
  now: Date = new Date(),
): Promise<{ screens: number; apis: number }> {
  const date = usageDateKey(now);

  /* 同じ送信の中に同じ画面が複数入っていることがある（別のIDの詳細画面など）。
     先にまとめてから書く。1回の送信で同じ行を2度更新しない。 */
  const screens = new Map<string, { routePattern: string; counters: UsageScreenCounters }>();
  for (const row of batch.screens) {
    const routePattern = screenRouteOf(row.path);
    if (!routePattern) continue;
    const current = screens.get(routePattern)?.counters ?? EMPTY_SCREEN_COUNTERS;
    screens.set(routePattern, {
      routePattern,
      counters: addScreenCounters(current, {
        views: row.views,
        // 異常に長い滞在（開きっぱなし）は平均を壊すので、ここで頭を切る
        dwellMs: Math.min(row.dwellMs, USAGE_MAX_DWELL_MS * Math.max(1, row.dwellSamples)),
        dwellSamples: row.dwellSamples,
        longStays: row.longStays,
        backtracks: row.backtracks,
        rageClicks: row.rageClicks,
        abandons: row.abandons,
        errors: row.errors,
      }),
    });
  }

  const apis = new Map<string, { method: string; routePattern: string; counters: UsageApiCounters }>();
  for (const row of batch.apis) {
    const routePattern = apiRoutePatternOf(row.path);
    // 記録を送るAPI自身は数えない（数えると、数えたことでまた通信が増える）
    if (!routePattern || routePattern === "/api/usage") continue;
    const mapKey = `${row.method} ${routePattern}`;
    const current = apis.get(mapKey)?.counters ?? EMPTY_API_COUNTERS;
    apis.set(mapKey, {
      method: row.method,
      routePattern,
      counters: addApiCounters(current, {
        calls: row.calls,
        durationMs: row.durationMs,
        errors: row.errors,
        slowCalls: row.slowCalls,
      }),
    });
  }

  const screenRows = [...screens.values()].map(({ routePattern, counters }) => ({
    key: screenKey(date, companyId, routePattern, role),
    date,
    companyId,
    routePattern,
    role,
    ...counters,
    updatedAt: now,
  }));

  const apiRows = [...apis.values()].map(({ method, routePattern, counters }) => ({
    key: apiKey(date, companyId, method, routePattern),
    date,
    companyId,
    method,
    routePattern,
    ...counters,
    updatedAt: now,
  }));

  /* 既にある行には足す（上書きしない）。SQLite の upsert で、
     いま送られてきた値（excluded）を今の値に加算する。 */
  for (const chunk of chunkRowsForD1(screenRows)) {
    await db
      .insert(s.usageScreenDaily)
      .values(chunk)
      .onConflictDoUpdate({
        target: s.usageScreenDaily.key,
        set: {
          views: sql`${s.usageScreenDaily.views} + excluded.views`,
          dwellMs: sql`${s.usageScreenDaily.dwellMs} + excluded.dwell_ms`,
          dwellSamples: sql`${s.usageScreenDaily.dwellSamples} + excluded.dwell_samples`,
          longStays: sql`${s.usageScreenDaily.longStays} + excluded.long_stays`,
          backtracks: sql`${s.usageScreenDaily.backtracks} + excluded.backtracks`,
          rageClicks: sql`${s.usageScreenDaily.rageClicks} + excluded.rage_clicks`,
          abandons: sql`${s.usageScreenDaily.abandons} + excluded.abandons`,
          errors: sql`${s.usageScreenDaily.errors} + excluded.errors`,
          updatedAt: now,
        },
      });
  }

  for (const chunk of chunkRowsForD1(apiRows)) {
    await db
      .insert(s.usageApiDaily)
      .values(chunk)
      .onConflictDoUpdate({
        target: s.usageApiDaily.key,
        set: {
          calls: sql`${s.usageApiDaily.calls} + excluded.calls`,
          durationMs: sql`${s.usageApiDaily.durationMs} + excluded.duration_ms`,
          errors: sql`${s.usageApiDaily.errors} + excluded.errors`,
          slowCalls: sql`${s.usageApiDaily.slowCalls} + excluded.slow_calls`,
          updatedAt: now,
        },
      });
  }

  await pruneOldUsageOncePerDay(db, now);

  return { screens: screenRows.length, apis: apiRows.length };
}

/**
 * 保存期間より古い日を消す。
 *
 * 記録が届くたびに消しに行くと、消すための問い合わせが本来の書き込みより多くなる。
 * 実行中のプロセスごとに1日1回だけにする（プロセスは頻繁に入れ替わるので、
 * 消し忘れたまま残り続けることはない）。
 */
let lastPrunedDate = "";

async function pruneOldUsageOncePerDay(db: DB, now: Date): Promise<void> {
  const today = usageDateKey(now);
  if (lastPrunedDate === today) return;
  lastPrunedDate = today;
  const cutoff = usageRetentionCutoff(now);
  try {
    await db.delete(s.usageScreenDaily).where(lt(s.usageScreenDaily.date, cutoff));
    await db.delete(s.usageApiDaily).where(lt(s.usageApiDaily.date, cutoff));
  } catch (e) {
    // 掃除に失敗しても、記録そのものは受け取れている。業務を止めない。
    console.warn("利用状況の古い記録を消せませんでした", e);
  }
}

/* ───────────────────────── 読み出し ───────────────────────── */

export interface UsageScreenRow {
  routePattern: string;
  label: string;
  counters: UsageScreenCounters;
  /** 役割ごとの内訳。どの立場の人が詰まっているかを見るために持つ */
  byRole: { role: Role; counters: UsageScreenCounters }[];
}

export interface UsageApiRow {
  method: string;
  routePattern: string;
  counters: UsageApiCounters;
}

export interface UsageDailyPoint {
  date: string;
  views: number;
  frictionSignals: number;
}

export interface UsageReport {
  /** 集計した期間（両端を含む） */
  from: string;
  to: string;
  days: number;
  screens: UsageScreenRow[];
  /** 台帳にある画面すべて。1件も記録が無い画面を一覧から消さないために持つ */
  allScreens: { routePattern: string; label: string }[];
  apis: UsageApiRow[];
  daily: UsageDailyPoint[];
  /** 記録が1件でもあるか。無いときは画面側で「まだ集まっていない」を出す */
  measured: boolean;
}

/* ───────────────────────── 画面の呼び名（重なりをほどく） ─────────────────────────
 *
 * 台帳の呼び名はサイドバーの語をそのまま使うため、別の画面が同じ名前になることがある
 * （「ホーム」は本人・上長・会社管理・全体管理に4つ、「アンケート1本」は3つある）。
 * 順位表に同じ名前が並ぶと、管理者はどれを直せばよいか決められない。
 * ここで、重なったものにだけ手がかりを添える（重ならない画面の呼び名は変えない）。
 */

/** いちばん上の区切り＝誰の画面か。 */
const PERSONA_BY_TOP_SEGMENT: Record<string, string> = {
  me: "本人",
  manager: "上長",
  admin: "会社管理",
  system: "全体管理",
};

function disambiguator(pattern: string): string | null {
  const segs = pattern.split("/").filter(Boolean);
  /* いちばん上の画面（/me・/system など）は上の階層が「入口」しか無いので、立場で呼び分ける。 */
  if (segs.length <= 1) return PERSONA_BY_TOP_SEGMENT[segs[0] ?? ""] ?? null;
  /* 下の階層は「どこから入る画面か」がいちばん分かりやすい手がかりになる。 */
  for (let i = segs.length - 1; i >= 1; i--) {
    const parent = routeMetaOf("/" + segs.slice(0, i).join("/"));
    if (parent && parent.label !== routeMetaOf(pattern)?.label) return parent.label;
  }
  return PERSONA_BY_TOP_SEGMENT[segs[0]] ?? null;
}

const SCREEN_LABELS = (() => {
  const count = new Map<string, number>();
  for (const meta of ROUTE_META) count.set(meta.label, (count.get(meta.label) ?? 0) + 1);

  const labels = new Map<string, string>();
  const used = new Map<string, number>();
  for (const meta of ROUTE_META) {
    if ((count.get(meta.label) ?? 0) < 2) {
      labels.set(meta.pattern, meta.label);
      continue;
    }
    const hint = disambiguator(meta.pattern);
    /* 手がかりを足しても重なる（旧URLの転送など）ときだけ、URLの形そのものを添える。
       読みやすさより、どれのことか分かることを優先する。 */
    let label = hint ? `${meta.label}（${hint}）` : `${meta.label}（${meta.pattern}）`;
    if ((used.get(label) ?? 0) > 0) label = `${meta.label}（${meta.pattern}）`;
    used.set(label, (used.get(label) ?? 0) + 1);
    labels.set(meta.pattern, label);
  }
  return labels;
})();

/** 画面の呼び名。同じ名前の画面が複数あるときだけ、どれかが分かる手がかりを添える。 */
export function usageScreenLabel(routePattern: string): string {
  return SCREEN_LABELS.get(routePattern) ?? routeMetaOf(routePattern)?.label ?? "その他の画面";
}

/** 画面の台帳に載っている、集計対象の画面すべて（0件を埋もれさせないために使う）。 */
export function allMeasurableScreens(): { routePattern: string; label: string }[] {
  return ROUTE_META.map((meta) => ({ routePattern: meta.pattern, label: usageScreenLabel(meta.pattern) }));
}

/**
 * 期間内の利用状況をまとめて読む。
 *
 * companyId に null を渡すと全社ぶんを合算する（この画面だけが持てる視点）。
 */
export async function readUsageReport(
  db: DB,
  { companyId, days, now = new Date() }: { companyId: string | null; days: number; now?: Date },
): Promise<UsageReport> {
  const to = usageDateKey(now);
  const from = usageRetentionCutoff(now, days);
  const scope = companyId
    ? and(gte(s.usageScreenDaily.date, from), eq(s.usageScreenDaily.companyId, companyId))
    : gte(s.usageScreenDaily.date, from);

  const screenRows = await db
    .select({
      routePattern: s.usageScreenDaily.routePattern,
      role: s.usageScreenDaily.role,
      views: sql<number>`SUM(${s.usageScreenDaily.views})`,
      dwellMs: sql<number>`SUM(${s.usageScreenDaily.dwellMs})`,
      dwellSamples: sql<number>`SUM(${s.usageScreenDaily.dwellSamples})`,
      longStays: sql<number>`SUM(${s.usageScreenDaily.longStays})`,
      backtracks: sql<number>`SUM(${s.usageScreenDaily.backtracks})`,
      rageClicks: sql<number>`SUM(${s.usageScreenDaily.rageClicks})`,
      abandons: sql<number>`SUM(${s.usageScreenDaily.abandons})`,
      errors: sql<number>`SUM(${s.usageScreenDaily.errors})`,
    })
    .from(s.usageScreenDaily)
    .where(scope)
    .groupBy(s.usageScreenDaily.routePattern, s.usageScreenDaily.role);

  const dailyRows = await db
    .select({
      date: s.usageScreenDaily.date,
      views: sql<number>`SUM(${s.usageScreenDaily.views})`,
      signals: sql<number>`SUM(${s.usageScreenDaily.longStays} + ${s.usageScreenDaily.backtracks} + ${s.usageScreenDaily.rageClicks} + ${s.usageScreenDaily.abandons} + ${s.usageScreenDaily.errors})`,
    })
    .from(s.usageScreenDaily)
    .where(scope)
    .groupBy(s.usageScreenDaily.date)
    .orderBy(s.usageScreenDaily.date);

  const apiScope = companyId
    ? and(gte(s.usageApiDaily.date, from), eq(s.usageApiDaily.companyId, companyId))
    : gte(s.usageApiDaily.date, from);

  const apiRows = await db
    .select({
      method: s.usageApiDaily.method,
      routePattern: s.usageApiDaily.routePattern,
      calls: sql<number>`SUM(${s.usageApiDaily.calls})`,
      durationMs: sql<number>`SUM(${s.usageApiDaily.durationMs})`,
      errors: sql<number>`SUM(${s.usageApiDaily.errors})`,
      slowCalls: sql<number>`SUM(${s.usageApiDaily.slowCalls})`,
    })
    .from(s.usageApiDaily)
    .where(apiScope)
    .groupBy(s.usageApiDaily.method, s.usageApiDaily.routePattern)
    .orderBy(desc(sql`SUM(${s.usageApiDaily.calls})`));

  /* 画面ごとに、役割の内訳と合計を組む。 */
  const byRoute = new Map<string, UsageScreenRow>();
  for (const row of screenRows) {
    const counters: UsageScreenCounters = {
      views: Number(row.views ?? 0),
      dwellMs: Number(row.dwellMs ?? 0),
      dwellSamples: Number(row.dwellSamples ?? 0),
      longStays: Number(row.longStays ?? 0),
      backtracks: Number(row.backtracks ?? 0),
      rageClicks: Number(row.rageClicks ?? 0),
      abandons: Number(row.abandons ?? 0),
      errors: Number(row.errors ?? 0),
    };
    const existing = byRoute.get(row.routePattern);
    if (existing) {
      existing.counters = addScreenCounters(existing.counters, counters);
      existing.byRole.push({ role: row.role as Role, counters });
    } else {
      byRoute.set(row.routePattern, {
        routePattern: row.routePattern,
        label: usageScreenLabel(row.routePattern),
        counters,
        byRole: [{ role: row.role as Role, counters }],
      });
    }
  }

  return {
    from,
    to,
    days,
    measured: screenRows.length > 0,
    screens: [...byRoute.values()],
    allScreens: allMeasurableScreens(),
    apis: apiRows.map((row) => ({
      method: row.method,
      routePattern: row.routePattern,
      counters: {
        calls: Number(row.calls ?? 0),
        durationMs: Number(row.durationMs ?? 0),
        errors: Number(row.errors ?? 0),
        slowCalls: Number(row.slowCalls ?? 0),
      },
    })),
    daily: dailyRows.map((row) => ({
      date: row.date,
      views: Number(row.views ?? 0),
      frictionSignals: Number(row.signals ?? 0),
    })),
  };
}

/** 会社をまたいだ記録の有無だけを軽く見る（案内文の出し分けに使う）。 */
export async function hasAnyUsage(db: DB): Promise<boolean> {
  const rows = await db.select({ key: s.usageScreenDaily.key }).from(s.usageScreenDaily).limit(1);
  return rows.length > 0;
}

export type { UsageScreenCounters, UsageApiCounters };
