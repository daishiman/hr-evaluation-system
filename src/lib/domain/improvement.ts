/**
 * 改善要望（各画面から送られる「ここが使いにくい」の共有）の決まりごと。
 *
 * 画面・API・一覧のどこから見ても同じ判断になるよう、状態・権限・
 * 絞り込み・画像の上限をここ1箇所に集める。
 * ここには DOM もDBも持ち込まない（純粋な計算だけを置く）。
 */

import type { Role } from "@/lib/session";

/* ───────────────────────── 状態 ───────────────────────── */

export const IMPROVEMENT_STATUSES = ["open", "doing", "done", "dropped"] as const;
export type ImprovementStatus = (typeof IMPROVEMENT_STATUSES)[number];

const STATUS_LABEL: Record<ImprovementStatus, string> = {
  open: "未対応",
  doing: "対応中",
  done: "対応済み",
  dropped: "見送り",
};

/** 画面に出す状態の呼び名。DBの値（open など）は画面に出さない。 */
export function improvementStatusLabel(status: ImprovementStatus): string {
  return STATUS_LABEL[status];
}

/** 状態バッジの色。意味のある状態だけに色を割り当てる（→ ui.tsx の Badge）。 */
export function improvementStatusTone(status: ImprovementStatus): "required" | "active" | "done" | "dropped" {
  switch (status) {
    case "open":
      return "required";
    case "doing":
      return "active";
    case "done":
      return "done";
    default:
      return "dropped";
  }
}

/** 保存されている文字列が、扱ってよい状態かどうか。 */
export function isImprovementStatus(value: string): value is ImprovementStatus {
  return (IMPROVEMENT_STATUSES as readonly string[]).includes(value);
}

/**
 * 状態を変えてよいか。
 *
 * 「対応済み」「見送り」で終わりにはしない。取り違えて閉じたときに
 * 元へ戻せないと、要望そのものが消えたのと同じになるため、
 * どの状態からでも戻せる。禁じるのは「同じ状態への付け替え」だけ。
 */
export function canChangeImprovementStatus(from: ImprovementStatus, to: ImprovementStatus): boolean {
  return from !== to;
}

/** 状態と対応メモを一緒に保存するときの業務ルール。 */
export function improvementHandlingError(
  currentStatus: ImprovementStatus,
  currentNote: string | null,
  nextStatus: ImprovementStatus,
  nextNote: string | null,
): string | null {
  const before = currentNote?.trim() ?? "";
  const after = nextNote?.trim() ?? "";
  if (nextStatus === "dropped" && after.length === 0) return "見送りにする理由を入力してください。";
  if (currentStatus === nextStatus && before === after) return "変更する内容がありません。";
  return null;
}

/* ───────────────────────── 権限 ───────────────────────── */

/**
 * 送られた要望の一覧を見てよいか。
 *
 * 見てよいのは会社の管理者とシステム全体管理者だけ。
 * 他の人が書いた不満がそのまま載るため、マネージャーにも開かない。
 * 画面の出し分けだけに頼らず、API と各画面もこの関数を通す。
 */
export function canReadImprovements(role: Role): boolean {
  return role === "COMPANY_ADMIN" || role === "SUPER_ADMIN";
}

/** 状態を書き換えてよいか。読める人と同じ範囲にする。 */
export function canHandleImprovements(role: Role): boolean {
  return canReadImprovements(role);
}

/* ───────────────────────── 本文と画像の上限 ───────────────────────── */

/** 本文の上限。1件で仕様書を書かせない（長い話は打ち合わせで受ける）。 */
export const IMPROVEMENT_BODY_MAX = 1000;

/**
 * 画像1枚の上限。D1 の1行に収める前提の大きさにする。
 * 送る側（ブラウザ）で縮小と圧縮をしてからこの検査を通す。
 */
export const IMPROVEMENT_SHOT_MAX_BYTES = 700_000;

/** data URL の文字数から、元の画像のバイト数を見積もる。 */
export function shotBytesOf(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return 0;
  const body = dataUrl.slice(comma + 1);
  const padding = body.endsWith("==") ? 2 : body.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((body.length * 3) / 4) - padding);
}

/** 受け取ってよい画像かどうか（形式と大きさ）。 */
export function isAcceptableShot(dataUrl: string): boolean {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match || match[2].length % 4 !== 0) return false;
  const bytes = shotBytesOf(dataUrl);
  if (bytes > IMPROVEMENT_SHOT_MAX_BYTES) return false;
  try {
    const decoded = atob(match[2]);
    const has = (...signature: number[]) => signature.every((value, index) => decoded.charCodeAt(index) === value);
    if (match[1] === "png") return has(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    if (match[1] === "jpeg") return has(0xff, 0xd8, 0xff);
    return has(0x52, 0x49, 0x46, 0x46) && decoded.slice(8, 12) === "WEBP";
  } catch {
    return false;
  }
}

/** 入力された本文を保存できる形に整える。長さは呼び出し側が拒否し、ここでは黙って切らない。 */
export function normalizeImprovementBody(raw: string): string {
  return raw.replace(/\r\n/g, "\n").trim();
}

/* ───────────────────────── 一覧の絞り込みとまとめ ───────────────────────── */

export interface ImprovementRow {
  id: string;
  status: ImprovementStatus;
  path: string;
  routePattern: string;
  screenLabel: string;
  createdAt: Date;
}

export interface ImprovementFilter {
  /** null は「すべて」 */
  status?: ImprovementStatus | null;
  /** null は「すべての画面」 */
  routePattern?: string | null;
  /** この日時より後に届いたものだけ */
  since?: Date | null;
}

/** 一覧の絞り込み。画面と API で同じ結果になるよう、ここだけで判定する。 */
export function filterImprovements<T extends ImprovementRow>(rows: T[], filter: ImprovementFilter): T[] {
  return rows.filter((r) => {
    if (filter.status && r.status !== filter.status) return false;
    if (filter.routePattern && r.routePattern !== filter.routePattern) return false;
    if (filter.since && r.createdAt.getTime() < filter.since.getTime()) return false;
    return true;
  });
}

/** 状態ごとの件数。0件の状態も0として必ず並べる（欠けた札を作らない）。 */
export function countImprovementsByStatus(rows: ImprovementRow[]): Record<ImprovementStatus, number> {
  const counts = { open: 0, doing: 0, done: 0, dropped: 0 };
  for (const r of rows) counts[r.status] += 1;
  return counts;
}

/** 「どの画面から届いたか」の集計。多い順に並べ、同数なら画面名の順にする。 */
export function groupImprovementsByScreen(
  rows: ImprovementRow[],
): { routePattern: string; screenLabel: string; count: number }[] {
  const map = new Map<string, { routePattern: string; screenLabel: string; count: number }>();
  for (const r of rows) {
    const hit = map.get(r.routePattern);
    if (hit) hit.count += 1;
    else map.set(r.routePattern, { routePattern: r.routePattern, screenLabel: r.screenLabel, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.screenLabel.localeCompare(b.screenLabel, "ja"));
}

/** 期間の絞り込みの選択肢。 */
export const IMPROVEMENT_PERIODS = ["7d", "30d", "all"] as const;
export type ImprovementPeriod = (typeof IMPROVEMENT_PERIODS)[number];

/** 期間の選択から、切り出す起点の日時を出す。「すべて」は起点なし。 */
export function improvementPeriodStart(period: ImprovementPeriod, now: Date): Date | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/** 保存されている文字列が、扱ってよい期間かどうか。 */
export function isImprovementPeriod(value: string): value is ImprovementPeriod {
  return (IMPROVEMENT_PERIODS as readonly string[]).includes(value);
}
