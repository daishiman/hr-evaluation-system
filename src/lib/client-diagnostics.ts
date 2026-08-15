/**
 * 改善要望に添える技術情報を、ブラウザ側で自動的に拾い集める。
 *
 * 使われる場面: 利用者が「ここが使いにくい」を送った瞬間。開発ツール（DevTools）を
 * 開いて写しを取ってもらうことは現実的にできないので、同じ内容を自動で集める。
 *
 * 集めるのは「その画面を直すために要るもの」だけにする。何でも集めると、
 * 記録票が読まれなくなるうえに、入力した中身まで外へ出てしまう。
 * - 画面の入力欄そのものは**一切見ない**（押した／触れた欄の名前だけ）
 * - 通信は失敗したものだけ。中身は自分のアプリ宛てに限り、ヘッダーとクエリは持たない
 * - 伏せる処理・件数と大きさの上限・種類ごとの収集量は
 *   src/lib/domain/improvement-instruction.ts が正本（送信直前にそこを必ず通す）
 *
 * 保存先はメモリだけ（配列）。端末に残さないので、閉じれば消える。
 */

import {
  DIAGNOSTICS_LIMITS,
  diagnosticsLevelFor,
  maskSensitive,
  normalizeDiagnostics,
  pathOnly,
  type DiagnosticsBreadcrumb,
  type DiagnosticsLogEntry,
  type DiagnosticsNetworkEntry,
  type ImprovementDiagnostics,
  type ImprovementKind,
} from "@/lib/domain/improvement-instruction";

interface Timed {
  at: number;
}

const logs: (DiagnosticsLogEntry & Timed)[] = [];
const network: (DiagnosticsNetworkEntry & Timed)[] = [];
const breadcrumbs: (DiagnosticsBreadcrumb & Timed)[] = [];

let installed = false;
let largestContentfulPaintMs: number | null = null;

function push<T extends Timed>(buffer: T[], entry: T, limit: number) {
  buffer.push(entry);
  if (buffer.length > limit) buffer.splice(0, buffer.length - limit);
}

/** 例外・引数の並びを、1行の読める文へ潰す。値そのものは深追いしない。 */
function toText(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/** 押したもの・触れた欄の「呼び名」。中身（打った値）は取らない。 */
function labelOf(el: Element): string {
  const aria = el.getAttribute("aria-label");
  if (aria) return aria;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    const labelled = el.labels?.[0]?.textContent;
    if (labelled) return labelled.trim();
    return el.getAttribute("name") || el.id || el.tagName.toLowerCase();
  }
  return (el.textContent || el.tagName.toLowerCase()).trim();
}

/**
 * 送った中身を読む。読めない形（ファイル・ストリーム）のときは持たない。
 *
 * 伏せ字にするのは送信直前（normalizeDiagnostics）で一括して行う。
 * ここで伏せると、伏せ方が2箇所に分かれて必ず片方が古くなる。
 */
async function readRequestBody(input: RequestInfo | URL, init?: RequestInit): Promise<string | null> {
  try {
    if (typeof init?.body === "string") return init.body;
    if (input instanceof Request && input.body) return await input.clone().text();
  } catch {
    // 読めなくても通信そのものは通す。
  }
  return null;
}

function browserOf(ua: string): string {
  const edge = /Edg\/([\d.]+)/.exec(ua);
  if (edge) return `Edge ${edge[1]}`;
  const chrome = /Chrome\/([\d.]+)/.exec(ua);
  if (chrome) return `Chrome ${chrome[1]}`;
  const firefox = /Firefox\/([\d.]+)/.exec(ua);
  if (firefox) return `Firefox ${firefox[1]}`;
  const safari = /Version\/([\d.]+).*Safari/.exec(ua);
  if (safari) return `Safari ${safari[1]}`;
  return "不明";
}

function osOf(ua: string): string {
  if (/Windows NT 10/.test(ua)) return "Windows 10/11";
  if (/Windows/.test(ua)) return "Windows";
  if (/iPhone|iPad/.test(ua)) return "iOS";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Android/.test(ua)) return "Android";
  if (/Linux/.test(ua)) return "Linux";
  return "不明";
}

/**
 * 拾い集めを始める。全画面共通の入口（FeedbackWidget）から1回だけ呼ぶ。
 *
 * ここで失敗してもアプリの動きを止めない。技術情報が取れないことは、
 * 要望そのものを送れないことより軽い。
 */
export function installDiagnostics(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const record = (level: DiagnosticsLogEntry["level"], text: string) => {
    // agoMs は送信の直前に「いま」から数え直す（ここでは置き場所だけ作る）。
    push(logs, { at: Date.now(), agoMs: 0, level, text: maskSensitive(text) }, DIAGNOSTICS_LIMITS.logs);
  };

  for (const level of ["error", "warn"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      record(level, args.map(toText).join(" "));
      original(...args);
    };
  }

  window.addEventListener("error", (e) => record("error", toText(e.error ?? e.message)));
  window.addEventListener("unhandledrejection", (e) => record("reject", toText(e.reason)));

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const started = performance.now();
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    const url = input instanceof Request ? input.url : String(input);
    // 自分のアプリ以外への通信は、宛先と結果だけを控える。よその中身は持ち出さない。
    const external = /^[a-z][\w+.-]*:\/\//i.test(url) && !url.startsWith(window.location.origin);
    const base = { method, path: pathOnly(url), external, truncated: false };

    const remember = (status: number | null, requestBody: string | null, responseBody: string | null) => {
      push(
        network,
        {
          ...base,
          at: Date.now(),
          agoMs: 0,
          status,
          durationMs: Math.round(performance.now() - started),
          requestBody,
          responseBody,
        },
        DIAGNOSTICS_LIMITS.network,
      );
    };

    // 送った中身は、控える前にここで伏せる（原本を持ち回らない）。
    const sentBody = external ? null : await readRequestBody(input, init);

    try {
      const response = await originalFetch(input, init);
      // 成功した通信まで並べると、肝心の失敗が埋もれる。
      if (!response.ok) {
        remember(response.status, sentBody, null);
        // 返りの中身は複製から読む。原本を読むと、呼び出し元が読めなくなる。
        // 読み終わるのを待たずに応答を返す（画面の反応を遅らせない）。
        if (!external) {
          const slot = network[network.length - 1];
          void response
            .clone()
            .text()
            .then((t) => {
              slot.responseBody = t;
            })
            .catch(() => {});
        }
      }
      return response;
    } catch (e) {
      remember(null, sentBody, null);
      throw e;
    }
  };

  document.addEventListener(
    "click",
    (e) => {
      const el = (e.target as Element | null)?.closest?.("button, a, [role='button'], summary");
      // 改善要望の窓の中の操作は「その画面の操作」ではないので数えない。
      if (!el || el.closest(".feedback-root")) return;
      addBreadcrumb("click", labelOf(el));
    },
    { capture: true },
  );

  document.addEventListener(
    "focusout",
    (e) => {
      const el = e.target as Element | null;
      if (!el || !el.matches?.("input, textarea, select") || el.closest(".feedback-root")) return;
      addBreadcrumb("input", labelOf(el));
    },
    { capture: true },
  );

  document.addEventListener("submit", (e) => addBreadcrumb("submit", labelOf(e.target as Element)), { capture: true });

  try {
    new PerformanceObserver((list) => {
      const last = list.getEntries().at(-1);
      if (last) largestContentfulPaintMs = Math.round(last.startTime);
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch {
    // この指標を取れないブラウザでは「不明」のままにする。
  }
}

/** 画面を移ったことを1歩として残す。移動は click では拾えないので呼び出し側から渡す。 */
export function addBreadcrumb(kind: DiagnosticsBreadcrumb["kind"], label: string): void {
  push(
    breadcrumbs,
    { at: Date.now(), agoMs: 0, kind, label: maskSensitive(label).slice(0, DIAGNOSTICS_LIMITS.text) },
    DIAGNOSTICS_LIMITS.breadcrumbs,
  );
}

function navigationTiming(): ImprovementDiagnostics["performance"] {
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return {
    ttfbMs: nav ? Math.round(nav.responseStart) : null,
    domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
    loadMs: nav && nav.loadEventEnd > 0 ? Math.round(nav.loadEventEnd) : null,
    largestContentfulPaintMs,
  };
}

/**
 * 送信の直前に、いままで貯めたものを1つにまとめる。
 *
 * 最後に normalizeDiagnostics を通す。伏せ字・件数・大きさ・
 * 「種類ごとにどこまで集めるか」の判断をサーバー側と同じ関数に任せるためで、
 * これにより窓に出す下見と、実際に送るものが必ず一致する。
 */
export function collectDiagnostics(kind: ImprovementKind): ImprovementDiagnostics {
  const now = Date.now();
  const ua = navigator.userAgent;
  const ago = <T extends Timed>(entry: T) => ({ ...entry, agoMs: Math.max(0, now - entry.at) });
  return normalizeDiagnostics({
    userAgent: ua,
    browser: browserOf(ua),
    os: osOf(ua),
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    devicePixelRatio: window.devicePixelRatio || 1,
    theme: document.documentElement.dataset.theme || "不明",
    language: navigator.language,
    online: navigator.onLine,
    logs: logs.map(ago),
    network: network.map(ago),
    breadcrumbs: breadcrumbs.map(ago),
    performance: navigationTiming(),
  }, diagnosticsLevelFor(kind));
}
