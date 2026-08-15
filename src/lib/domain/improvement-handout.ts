/**
 * 届いた要望と、払い出した作業指示文の「ずれ」の見方。
 *
 * ここは計算だけを持つ（外への通信もDBも触らない）。判断は3つ。
 *  1. この要望は指示文として払い出したか
 *  2. 払い出したあと、アプリ側の内容が変わったか
 *  3. 変わったなら、どの項目が変わったか
 *
 * 「変わったか」を更新日時で見ない。触っただけ・保存し直しただけで差分ありになり、
 * 中身が同じものを何度も払い出すことになる。渡した時点の内容から作った指紋を残し、
 * 今の内容の指紋と突き合わせる。
 */

/**
 * 指紋の材料。払い出したあとに人の手で変わり得るものだけを入れる。
 *
 * 技術情報（diagnostics）と届いた日時は送信の瞬間に確定して以後変わらないので、
 * 材料に入れない。一覧で毎回大きなJSONを読み直さずに済ませるためでもある。
 */
export interface FingerprintParts {
  kind: string;
  screenLabel: string;
  path: string;
  routePattern: string;
  body: string;
  expected: string | null;
  status: string;
  handledNote: string | null;
}

/** 指紋の中の項目名 → 画面に出す日本語。並び順は読む順。 */
const FIELD_LABEL: Record<string, string> = {
  body: "要望の本文",
  expected: "どうなってほしいか",
  kind: "種類",
  screen: "画面",
  status: "対応状況",
  note: "対応メモ",
};

const FIELD_ORDER = ["body", "expected", "kind", "screen", "status", "note"] as const;

/**
 * 文字列を8桁の短い印にする（FNV-1a）。
 *
 * 秘密を守るための計算ではなく「同じか違うか」を見るためだけのもの。
 * 暗号用の計算は非同期になり、一覧の1行ごとに待ちが入るのでここでは使わない。
 */
function shortHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function partsMap(parts: FingerprintParts): Record<string, string> {
  return {
    body: parts.body,
    expected: parts.expected ?? "",
    kind: parts.kind,
    // 画面まわりは3つで1つの意味なので、まとめて1項目として数える。
    screen: `${parts.screenLabel} ${parts.path} ${parts.routePattern}`,
    status: parts.status,
    note: parts.handledNote ?? "",
  };
}

/** 今の内容の指紋。`body=xxxxxxxx;expected=…` の形（項目の並びは固定）。 */
export function improvementFingerprint(parts: FingerprintParts): string {
  const map = partsMap(parts);
  return FIELD_ORDER.map((key) => `${key}=${shortHash(map[key])}`).join(";");
}

function readFingerprint(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of raw.split(";")) {
    const at = pair.indexOf("=");
    if (at > 0) out[pair.slice(0, at)] = pair.slice(at + 1);
  }
  return out;
}

/**
 * 前回渡した指紋と今の指紋を比べ、変わった項目の日本語名を読む順に返す。
 * 前回の指紋が空（＝比べる材料がない）ときは、変わっていない扱いにする。
 */
export function changedFieldLabels(before: string, after: string): string[] {
  if (before === "") return [];
  const old = readFingerprint(before);
  const now = readFingerprint(after);
  return FIELD_ORDER.filter((key) => (old[key] ?? "") !== (now[key] ?? "")).map((key) => FIELD_LABEL[key]);
}

/** 要望から見た、指示文の払い出し状態。 */
export type HandoutState = "none" | "handed" | "changed";

/**
 * 払い出しの控え。行が無ければ null（まだ払い出していない）。
 *
 * 外へ出す処理が無くなったので「途中で終わった」状態は作らない。
 * 控えの保存と払い出しは同じ1回の保存で終わり、片方だけ残ることがない。
 */
export interface HandoutSnapshot {
  contentFingerprint: string;
  handedOutAt: Date | null;
}

export function handoutState(snapshot: HandoutSnapshot | null, current: string): HandoutState {
  if (!snapshot) return "none";
  return changedFieldLabels(snapshot.contentFingerprint, current).length > 0 ? "changed" : "handed";
}

const STATE_LABEL: Record<HandoutState, string> = {
  none: "未払い出し",
  handed: "払い出し済み",
  changed: "更新あり",
};

export function handoutStateLabel(state: HandoutState): string {
  return STATE_LABEL[state];
}

/** バッジの色。状態は色だけでなく上の言葉でも読めるようにしてある。 */
export function handoutStateTone(state: HandoutState): "closed" | "done" | "active" {
  const tone = { none: "closed", handed: "done", changed: "active" } as const;
  return tone[state];
}

/**
 * その状態のとき、払い出すとどうなるか。
 * 画面の予告とサーバーの処理で同じ言葉を使う。
 */
export type PlannedAction = "handout" | "rehandout" | "skip";

export function plannedAction(state: HandoutState): PlannedAction {
  const plan = { none: "handout", changed: "rehandout", handed: "skip" } as const;
  return plan[state];
}

/** 状態の理由。何も起きない行が無言にならないようにする。 */
export function handoutNote(state: HandoutState): string {
  if (state === "none") return "まだ指示文を渡していません。";
  if (state === "changed") return "渡したあとに内容が変わりました。もう一度渡せます。";
  return "渡した内容のままです。もう一度渡しても中身は同じです。";
}

/* ───────────────────────── 払い出しの履歴 ───────────────────────── */

/**
 * 払い出しの経路。画面からの控えと、API で実際に取りに来たときを分ける。
 *
 * 分けないと「コピーしただけ」と「実際に渡った」が同じ1件に見える。
 * 渡っていないのに渡した気になる取り違えは、この区別でしか防げない。
 */
export type HandoutVia = "screen" | "api";

export function handoutViaLabel(via: HandoutVia): string {
  return via === "screen" ? "画面からコピー" : "Claude Code が取得";
}

/**
 * 履歴を1件ぶん読む形。鍵は記録した時点の呼び名を持たせる。
 *
 * 鍵のIDだけを持つと、その鍵を止めたあと一覧で「不明」になる。
 * 誰がどの鍵で取ったかは後から意味を変えないので、呼び名ごと写しておく。
 */
export interface HandoutEvent {
  id: string;
  via: HandoutVia;
  actorName: string | null;
  keyName: string | null;
  createdAt: Date;
}

/** 履歴1件の「誰が・どの鍵で」。空欄で並べず、必ず1行の日本語にする。 */
export function handoutEventWho(event: Pick<HandoutEvent, "via" | "actorName" | "keyName">): string {
  if (event.via === "screen") return event.actorName ?? "退職された方";
  return event.keyName ? `鍵「${event.keyName}」` : "サーバーの設定値の鍵";
}

/**
 * 1件あたりに残す履歴の上限。
 *
 * 履歴は要望1件につき積み上がる。何度も払い出し直す要望ほど増えるので、
 * 新しい方から20件だけ残し、あふれた古い行は消す。20件は
 * 「同じ要望を出し直した経緯を追える」と「表が読める」の境目。
 * 最新の払い出し日時と通算の回数は別に持つので、丸めても総数は消えない。
 */
export const HANDOUT_HISTORY_MAX = 20;

/**
 * 一覧に出す「何回・いつ」。日時は表示用に整えた文字列で受け取る
 * （日付の書き方はアプリ全体で1箇所に寄せてあるため、ここでは組み立てない）。
 */
export function handoutCountText(count: number, lastAtText: string | null): string {
  if (count <= 0 || !lastAtText) return "まだ渡していません";
  return `${count}回・最終 ${lastAtText}`;
}

/** 履歴の丸めの説明。画面で「全部あるはず」と誤解させないために出す。 */
export function handoutHistoryNote(count: number): string {
  if (count <= HANDOUT_HISTORY_MAX) return "払い出した記録です。新しい順に並びます。";
  return "新しい順に20件までを残しています。古い記録は消えています。";
}

/**
 * 一括操作の結果1件ぶん。指示文の払い出しと、落とす・戻す操作の両方が並ぶ。
 * どちらも同じ表に出すので、実行内容の言葉はここ1箇所で決める。
 */
export const BULK_ACTIONS = [
  "handed",
  "rehanded",
  "skipped",
  "failed",
  "rejected",
  "duplicated",
  "discarded",
  "restored",
] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

const ACTION_LABEL: Record<BulkAction, string> = {
  handed: "払い出し",
  rehanded: "再払い出し",
  skipped: "スキップ",
  failed: "失敗",
  rejected: "対応しない",
  duplicated: "重複",
  discarded: "廃棄",
  restored: "元に戻した",
};

export function bulkActionLabel(action: BulkAction): string {
  return ACTION_LABEL[action];
}

export function bulkActionTone(action: BulkAction): "done" | "active" | "closed" | "alert" | "dropped" {
  if (action === "failed") return "alert";
  if (action === "handed" || action === "restored") return "done";
  if (action === "rehanded") return "active";
  if (action === "rejected" || action === "duplicated" || action === "discarded") return "dropped";
  return "closed";
}

export type BulkCounts = Record<BulkAction, number>;

export function summarizeBulk(results: { action: BulkAction }[]): BulkCounts {
  const counts = Object.fromEntries(BULK_ACTIONS.map((a) => [a, 0])) as BulkCounts;
  for (const r of results) counts[r.action] += 1;
  return counts;
}

/**
 * 件数のまとめ。0件のものは書かない。
 * 8通りすべてを並べると、実際に起きたことが0件の列に埋もれる。
 */
export function bulkSummaryText(counts: BulkCounts): string {
  const parts = BULK_ACTIONS.filter((a) => counts[a] > 0).map((a) => `${ACTION_LABEL[a]}${counts[a]}件`);
  return parts.length > 0 ? parts.join("／") : "対象がありません";
}
