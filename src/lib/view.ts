/** 画面表示用の小さな変換。ここを1箇所にして表記ゆれを防ぐ。 */

/* ランク→形の大きさ の換算は domain/evaluation-view.ts に置いた。
   レーダーの軸をどう作るか（実点数で描くか、ランクで描くか、判定外をどう扱うか）は
   閲覧者のロールで変わる判断であり、テストを書ける純関数側に集めたいため。
   既存の呼び出しのために、ここからも同じものを見えるようにしておく。 */
export { RANK_RATIO } from "@/lib/domain/evaluation-view";
import { RANK_RATIO as RATIO } from "@/lib/domain/evaluation-view";

export function rankToPercent(rank: string): number {
  return RATIO[rank] ?? 0;
}

/* 日付と時刻は日本時間（UTC+9。夏時間なし）で書く。サーバー（Workers）は UTC で動くので、
   機械の時間帯で読む getDate・getHours を使うと、日本時間の0時〜9時の出来事が前の日・9時間前になる。
   CSV（csv.ts の formatDateTime）と同じく、9時間進めてから getUTC* で読む。 */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function toJstClock(d: Date): Date {
  return new Date(d.getTime() + JST_OFFSET_MS);
}

export function formatDate(v: string | Date | null | undefined): string {
  if (!v) return "—";
  // 「2026-09-30」は時刻を持たない暦の日付なので、時間帯を通さずにそのまま読む
  const ymd = typeof v === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim()) : null;
  if (ymd) return `${Number(ymd[1])}年${Number(ymd[2])}月${Number(ymd[3])}日`;
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return String(v);
  const j = toJstClock(d);
  return `${j.getUTCFullYear()}年${j.getUTCMonth() + 1}月${j.getUTCDate()}日`;
}

/**
 * 日付と時刻。届いた順や提出の時刻を追う画面（改善要望・回答一覧など）で使う。
 * 「今日の何時に届いたか」まで分からないと、同じ日の並びが読めないため。
 */
export function formatDateTime(v: Date | null | undefined): string {
  if (!v || Number.isNaN(v.getTime())) return "—";
  const j = toJstClock(v);
  const hh = String(j.getUTCHours()).padStart(2, "0");
  const mm = String(j.getUTCMinutes()).padStart(2, "0");
  return `${formatDate(v)} ${hh}:${mm}`;
}

export function formatPeriod(start?: string | null, end?: string | null): string {
  if (!start || !end) return "—";
  return `${formatDate(start)} 〜 ${formatDate(end)}`;
}

export const CYCLE_STATUS_LABEL: Record<string, string> = {
  draft: "準備中",
  open: "回答受付中",
  closed: "確定済み",
};

export const FORM_STATUS_LABEL: Record<string, string> = {
  draft: "下書き",
  published: "公開中",
  closed: "締め切り済み",
};

export const RESPONSE_STATUS_LABEL: Record<string, string> = {
  draft: "入力途中",
  submitted: "提出済み",
};

export const SECTION_LABEL: Record<string, string> = {
  support: "支援について",
  operation: "運営について",
  training: "昇格要件（受講と報告書）",
  test: "昇格要件（独学とテスト）",
  behavior: "行動指針",
  kpi: "実績の数値",
};

export const SECTION_ORDER = ["support", "operation", "training", "test", "behavior", "kpi"];

export const SECTION_HELP: Record<string, string> = {
  support: "この半期に自分の担当として行ったものに「はい」を選んでください。行っていないものは「いいえ」です。",
  operation: "この半期に自分の担当として行ったものに「はい」を選んでください。行っていないものは「いいえ」です。",
  training: "受講して報告書まで提出したものに「はい」を選んでください。受講しただけのものは「いいえ」です。",
  test: "テストに合格したものに「はい」を選んでください。受けていない・不合格のものは「いいえ」です。",
  behavior: "この半期のふだんの行動に、もっとも近いものを1つだけ選んでください。",
  kpi: "半期の実績を数値で入力してください。分からない欄は空のままにしてください。",
};
