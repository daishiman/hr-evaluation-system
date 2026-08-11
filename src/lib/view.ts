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

export function formatDate(v: string | Date | null | undefined): string {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return String(v);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
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
