/**
 * 改善要望に添える技術情報を、ブラウザ側で自動的に拾い集める。
 *
 * 使われる場面: 利用者が「ここが使いにくい」を送った瞬間。開発ツール（DevTools）を
 * 開いて写しを取ってもらうことは現実的にできないので、同じ内容を自動で集める。
 *
 * 集めるのは「その画面を直すために要るもの」だけにする。何でも集めると、
 * 記録票が読まれなくなるうえに、入力した中身まで外へ出てしまう。
 * - 打ち込んだ値、入力欄の中身は**一切集めない**（欄の名前だけ）
 * - 通信は失敗したものだけ。本文・ヘッダー・クエリは持たない
 * - 伏せる処理と件数の上限は src/lib/domain/improvement-issue.ts が正本
 *
 * 保存先はメモリだけ（配列）。端末に残さないので、閉じれば消える。
 */

import {
  DIAGNOSTICS_LIMITS,
  maskSensitive,
  pathOnly,
  type DiagnosticsBreadcrumb,
  type DiagnosticsLogEntry,
  type DiagnosticsNetworkEntry,
  type ImprovementDiagnostics,
} from "@/lib/domain/improvement-issue";

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
    try {
      const response = await originalFetch(input, init);
      // 成功した通信まで並べると、肝心の失敗が埋もれる。
      if (!response.ok) {
        push(
          network,
          {
            at: Date.now(),
            agoMs: 0,
            method,
            path: pathOnly(url),
            status: response.status,
            durationMs: Math.round(performance.now() - started),
          },
          DIAGNOSTICS_LIMITS.network,
        );
      }
      return response;
    } catch (e) {
      push(
        network,
        {
          at: Date.now(),
          agoMs: 0,
          method,
          path: pathOnly(url),
          status: null,
          durationMs: Math.round(performance.now() - started),
        },
        DIAGNOSTICS_LIMITS.network,
      );
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

/** 送信の直前に、いままで貯めたものを1つにまとめる。 */
export function collectDiagnostics(): ImprovementDiagnostics {
  const now = Date.now();
  const ua = navigator.userAgent;
  const ago = <T extends Timed>(entry: T) => ({ ...entry, agoMs: Math.max(0, now - entry.at) });
  return {
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
  };
}
