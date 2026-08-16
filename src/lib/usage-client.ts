/**
 * 利用状況をブラウザ側で数える。
 *
 * 使われる場面: すべての業務画面。利用者には何も見えない。
 *
 * ── 何を数えるか ──
 * 「どの画面を・何回開き・どれだけ留まり・どこで詰まったか」だけ。
 * 入力した中身・押した文字・利用者を特定する値は**一切送らない**。画面の呼び名も
 * 送らず、送るのは台帳にある形（/admin/forms/[id]）だけにする。詳細画面のURLに
 * 入っているID・共有トークンは、送る前にここで落とす。
 *
 * ── なぜ貯めてから送るか ──
 * 出来事ごとに送ると、記録のための通信が業務の通信より多くなり、
 * 保存できる無料の範囲もすぐ尽きる。画面の切り替わり・タブを離れる時にだけ
 * まとめて送り、送信は sendBeacon（画面を閉じても届く・応答を待たない）で行う。
 *
 * 数え方のしきい値は src/lib/domain/usage.ts が正本。ここでは判定だけを行う。
 */

import { routeIdentityOf } from "@/lib/nav";
import {
  EMPTY_API_COUNTERS,
  EMPTY_SCREEN_COUNTERS,
  USAGE_BACKTRACK_WINDOW_MS,
  USAGE_BATCH_MAX_APIS,
  USAGE_BATCH_MAX_SCREENS,
  USAGE_LONG_STAY_MS,
  USAGE_MAX_DWELL_MS,
  USAGE_RAGE_CLICK_COUNT,
  USAGE_RAGE_CLICK_WINDOW_MS,
  USAGE_SLOW_API_MS,
  type UsageApiCounters,
  type UsageScreenCounters,
} from "@/lib/domain/usage";

/** 記録の送り先。ここへの通信自体は数えない。 */
const ENDPOINT = "/api/usage";

/** 貯めたものを送る間隔。長く開いたままの画面でも、この間隔で届く。 */
const FLUSH_INTERVAL_MS = 60_000;

const screens = new Map<string, UsageScreenCounters>();
const apis = new Map<string, { method: string; path: string; counters: UsageApiCounters }>();

let installed = false;

/* いま見ている画面 */
let currentRoute: string | null = null;
/** 最後に開いた画面。タブから戻ってきたときに数え直す先として覚えておく */
let lastRoute: string | null = null;
let enteredAt = 0;
/** タブを裏に回していた時間。滞在から差し引く（席を外した時間は「かかった時間」ではない） */
let hiddenMs = 0;
let hiddenSince = 0;
/** この画面で入力欄に触れたか。触れたのに送信しないまま離れたら「送らず離れた」 */
let touchedInput = false;
let submitted = false;

/* 直前に離れた画面。すぐ戻ってきたら「戻ってやり直した」 */
let leftRoute: string | null = null;
let leftAt = 0;

/* 連打の判定用 */
let lastClickKey = "";
let lastClickAt = 0;
let sameClickStreak = 0;

let lastFlushAt = 0;

function counterOf(route: string): UsageScreenCounters {
  const existing = screens.get(route);
  if (existing) return existing;
  const fresh = { ...EMPTY_SCREEN_COUNTERS };
  screens.set(route, fresh);
  return fresh;
}

/** URLから、台帳にある形だけを取り出す。IDや共有トークンはここで消える。 */
function routeOf(pathname: string): string {
  return routeIdentityOf(pathname).routePattern;
}

/* ───────────────────────── 画面の出入り ───────────────────────── */

/** いま見ている画面を閉じ、滞在時間と兆候を確定させる。 */
function closeCurrentScreen(now: number): void {
  if (currentRoute === null) return;
  const counters = counterOf(currentRoute);

  // 裏に回したままなら、その分も差し引いてから閉じる
  if (hiddenSince > 0) {
    hiddenMs += now - hiddenSince;
    hiddenSince = 0;
  }

  const dwell = Math.max(0, now - enteredAt - hiddenMs);
  // 開いたままお昼に行った時間を平均へ混ぜない
  if (dwell > 0 && dwell <= USAGE_MAX_DWELL_MS) {
    counters.dwellMs += Math.round(dwell);
    counters.dwellSamples += 1;
    if (dwell >= USAGE_LONG_STAY_MS) counters.longStays += 1;
  }

  // 入力を始めたのに送っていない
  if (touchedInput && !submitted) counters.abandons += 1;

  leftRoute = currentRoute;
  leftAt = now;
  currentRoute = null;
}

/**
 * 画面が変わったことを伝える。全画面共通の入口（UsageTracker）から呼ぶ。
 *
 * 同じ画面を開き直した場合（一覧から詳細へ行って戻る等）も1回として数える。
 */
export function trackScreen(pathname: string): void {
  if (!installed) return;
  const now = Date.now();
  const route = routeOf(pathname);
  if (route === currentRoute) return;

  closeCurrentScreen(now);

  const counters = counterOf(route);
  counters.views += 1;
  // すぐ戻ってきた＝前の画面で決められなかった
  if (leftRoute === route && now - leftAt <= USAGE_BACKTRACK_WINDOW_MS) counters.backtracks += 1;

  openScreen(route, now);

  if (now - lastFlushAt >= FLUSH_INTERVAL_MS) flush();
}

/** 画面を「いま見ている」状態にする。開いた回数はここでは数えない。 */
function openScreen(route: string, now: number): void {
  currentRoute = route;
  lastRoute = route;
  enteredAt = now;
  hiddenMs = 0;
  hiddenSince = document.visibilityState === "hidden" ? now : 0;
  touchedInput = false;
  submitted = false;
}

/* ───────────────────────── 詰まりの兆候 ───────────────────────── */

/** 押した場所の見分け。中身（打った値）は読まない。 */
function clickKeyOf(el: Element): string {
  return `${el.tagName}:${el.getAttribute("aria-label") ?? ""}:${(el.textContent ?? "").slice(0, 24)}`;
}

function noteError(): void {
  if (currentRoute) counterOf(currentRoute).errors += 1;
}

/* ───────────────────────── 送る ───────────────────────── */

function buildBatch() {
  const screenRows = [...screens.entries()]
    .filter(([, c]) => c.views > 0 || c.dwellSamples > 0 || c.errors > 0)
    .slice(0, USAGE_BATCH_MAX_SCREENS)
    .map(([path, c]) => ({ path, ...c }));

  const apiRows = [...apis.values()]
    .slice(0, USAGE_BATCH_MAX_APIS)
    .map(({ method, path, counters }) => ({ method, path, ...counters }));

  return { screens: screenRows, apis: apiRows };
}

/**
 * 貯めたものを送る。
 *
 * 応答は読まない。記録が届かなくても業務は続けられるので、失敗しても
 * 画面には何も出さず、貯めていた分は捨てる（溜め続けてメモリを増やさない）。
 */
export function flush(): void {
  if (!installed) return;
  const batch = buildBatch();
  if (batch.screens.length === 0 && batch.apis.length === 0) return;

  /* 送る分は先に手放す。応答を待って消すと、その間に増えた分まで一緒に消える。
     いま見ている画面のぶんは閉じたときに数え直されるので、ここで失われない。 */
  screens.clear();
  apis.clear();
  lastFlushAt = Date.now();

  const body = JSON.stringify(batch);
  try {
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) return;
  } catch {
    // sendBeacon が使えない場合は下の fetch に落とす
  }
  void fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

/* ───────────────────────── 取り付け ───────────────────────── */

/**
 * 数え始める。全画面共通の入口から1回だけ呼ぶ。
 *
 * ここで失敗してもアプリの動きを止めない。利用状況が取れないことは、
 * 業務が止まることより軽い。
 */
export function installUsageTracking(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  lastFlushAt = Date.now();

  /* 連打（押しても反応が無いと思われている） */
  document.addEventListener(
    "click",
    (e) => {
      const el = (e.target as Element | null)?.closest?.("button, a, [role='button'], summary");
      if (!el || !currentRoute) return;
      const now = Date.now();
      const key = clickKeyOf(el);
      if (key === lastClickKey && now - lastClickAt <= USAGE_RAGE_CLICK_WINDOW_MS) {
        sameClickStreak += 1;
        // ちょうど閾値に達した1回だけ数える（4回目・5回目で二重に数えない）
        if (sameClickStreak === USAGE_RAGE_CLICK_COUNT) counterOf(currentRoute).rageClicks += 1;
      } else {
        sameClickStreak = 1;
      }
      lastClickKey = key;
      lastClickAt = now;
    },
    { capture: true },
  );

  /* 入力を始めたか（何を打ったかは見ない） */
  document.addEventListener(
    "input",
    (e) => {
      const el = e.target as Element | null;
      if (el?.matches?.("input, textarea, select")) touchedInput = true;
    },
    { capture: true },
  );

  document.addEventListener("submit", () => {
    submitted = true;
  }, { capture: true });

  window.addEventListener("error", noteError);
  window.addEventListener("unhandledrejection", noteError);

  /* 通信の回数と所要時間 */
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    let path = "";
    try {
      path = new URL(url, window.location.origin).pathname;
    } catch {
      path = "";
    }
    // 自分のアプリのAPIだけを数える。記録を送る先は数えない
    const counted = path.startsWith("/api/") && path !== ENDPOINT && url.startsWith(window.location.origin);
    if (!counted) return originalFetch(input, init);

    const started = performance.now();
    const remember = (ok: boolean) => {
      const elapsed = Math.round(performance.now() - started);
      const key = `${method} ${path}`;
      const entry = apis.get(key) ?? { method, path, counters: { ...EMPTY_API_COUNTERS } };
      entry.counters.calls += 1;
      entry.counters.durationMs += elapsed;
      if (!ok) entry.counters.errors += 1;
      if (elapsed >= USAGE_SLOW_API_MS) entry.counters.slowCalls += 1;
      apis.set(key, entry);
    };

    try {
      const response = await originalFetch(input, init);
      remember(response.ok);
      if (!response.ok) noteError();
      return response;
    } catch (e) {
      remember(false);
      noteError();
      throw e;
    }
  };

  /* タブを離れている間は滞在に数えない。離れた時点で貯めた分を送る */
  document.addEventListener("visibilitychange", () => {
    const now = Date.now();
    if (document.visibilityState === "hidden") {
      closeCurrentScreen(now);
      flush();
      /* 「タブを離れて戻ってきた」を「前の画面から戻ってきた」と取り違えない。
         迷って戻ったわけではないので、戻りの判定材料からは外す。 */
      leftRoute = null;
      return;
    }
    /* 戻ってきたら同じ画面を計り直す。ここで開いた回数は増やさない
       （画面を開いたのではなく、タブを切り替えただけ）。 */
    if (currentRoute === null && lastRoute !== null) openScreen(lastRoute, now);
  });

  window.addEventListener("pagehide", () => {
    closeCurrentScreen(Date.now());
    flush();
  });

  window.setInterval(() => {
    if (Date.now() - lastFlushAt >= FLUSH_INTERVAL_MS) flush();
  }, FLUSH_INTERVAL_MS);
}
