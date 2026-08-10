/** 画面表示用の小さな変換。ここを1箇所にして表記ゆれを防ぐ。 */

export const RANK_RATIO: Record<string, number> = { A: 100, B: 80, C: 60, D: 40, E: 0 };

export function rankToPercent(rank: string): number {
  return RANK_RATIO[rank] ?? 0;
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
  support: "半期のあいだに満たせた項目に「はい」を選んでください。",
  operation: "運営面で満たせた項目に「はい」を選んでください。",
  training: "受講して報告書を提出したものに「はい」を選んでください。",
  test: "独学してテストに合格したものに「はい」を選んでください。",
  behavior: "普段の行動にもっとも近いものを1つ選んでください。",
  kpi: "半期の実績を数値で入力してください。分からない欄は空のままにしてください。",
};
