/**
 * 届いた要望の「落とし方」（対応しない・重複・廃棄）と、その取り消しの決まりごと。
 *
 * ここは計算だけを持つ（DBも外への通信も触らない）。決めているのは4つ。
 *  1. 画面に出す状態（未対応・対応中・完了・対応しない・重複・廃棄）の読み方
 *  2. 落とすときに必ず要る理由の形（定型の理由＋自由記述）
 *  3. 一覧の既定の見え方（終わったもの・廃棄したものは隠す）と並べ替え
 *  4. まとめて落とすときの確認文（何件が対象かを必ず書く）
 *
 * 廃棄は「消す」ではなく印を立てるだけにしてある。誤って落としたものを
 * 元に戻せないと、送ってくれた声がそのまま消える。戻すために、廃棄の前の
 * 状態は履歴に残し、行そのものは残す。
 */

import type { Role } from "@/lib/session";
import { improvementStatusLabel, type ImprovementStatus } from "@/lib/domain/improvement";

/* ───────────────────────── 画面に出す状態 ───────────────────────── */

/**
 * 画面で読む状態。DBの列そのままではなく、次の4つを重ねて決める。
 *  ・廃棄の印が立っていれば「廃棄」（元の対応状況は履歴に残す）
 *  ・統合先が指してあれば「重複」
 *  ・対応中で、確認依頼の場所が入っていれば「レビュー待ち」
 *  ・どれでもなければ、対応状況をそのまま出す
 * 廃棄・重複・レビュー待ちを対応状況の1つにすると、戻すときに
 * 「どこへ戻すか」が消える。だから列に焼かず、重ねて判定する。
 */
export type ImprovementDisplayState = ImprovementStatus | "duplicate" | "discarded" | "review";

export interface ImprovementDisposition {
  status: ImprovementStatus;
  discarded: boolean;
  duplicateOfId: string | null;
  /** 確認依頼（PR）の場所。未作成なら null。既存の行はすべて null。 */
  reviewRef?: string | null;
}

export function improvementDisplayState(item: ImprovementDisposition): ImprovementDisplayState {
  if (item.discarded) return "discarded";
  if (item.duplicateOfId) return "duplicate";
  // 対応済みまで進んだあとも review_ref は残る。そこで「対応中のときだけ」
  // レビュー待ちと読む。残した値は詳細画面で「どの確認依頼で直ったか」を出すために使う。
  if (item.status === "doing" && (item.reviewRef ?? "").trim().length > 0) return "review";
  return item.status;
}

export function improvementDisplayStateLabel(state: ImprovementDisplayState): string {
  if (state === "discarded") return "廃棄";
  if (state === "duplicate") return "重複";
  if (state === "review") return "レビュー待ち";
  if (state === "dropped") return "対応しない";
  return improvementStatusLabel(state);
}

/** バッジの色。状態は色だけでなく上の言葉でも読める。 */
export function improvementDisplayStateTone(
  state: ImprovementDisplayState,
): "required" | "active" | "done" | "dropped" | "closed" {
  if (state === "open") return "required";
  if (state === "doing") return "active";
  // 色は「人の手番かどうか」で分ける。未対応（着手が要る）とレビュー待ち
  // （確認して取り込むのが要る）はどちらも人の番なので同じ色にし、
  // 作業中（手が離れている）だけを別の色にする。どちらかは言葉で読める。
  if (state === "review") return "required";
  if (state === "done") return "done";
  if (state === "discarded") return "closed";
  return "dropped";
}

/* ───────────────────────── 落とす・戻す操作 ───────────────────────── */

/**
 * 一覧と詳細から行える操作。
 *  reject … 対応しないと決める（要望は残す）
 *  duplicate … 他の要望と同じ内容だと決める（統合先を指す）
 *  discard … 廃棄する（誤送信・テスト投稿など。印を立てて隠すだけ）
 *  restore … 直前の操作を取り消して元に戻す
 */
export const DISPOSITION_ACTIONS = ["reject", "duplicate", "discard", "restore"] as const;
export type DispositionAction = (typeof DISPOSITION_ACTIONS)[number];

export function isDispositionAction(value: string): value is DispositionAction {
  return (DISPOSITION_ACTIONS as readonly string[]).includes(value);
}

const ACTION_LABEL: Record<DispositionAction, string> = {
  reject: "対応しない",
  duplicate: "重複",
  discard: "廃棄",
  restore: "元に戻す",
};

export function dispositionActionLabel(action: DispositionAction): string {
  return ACTION_LABEL[action];
}

/** 理由を書かせる操作かどうか。あとから「なぜ落としたか」を読めなくしない。 */
export function dispositionNeedsReason(action: DispositionAction): boolean {
  return action === "reject" || action === "duplicate" || action === "discard";
}

/* ───────────────────────── 理由 ───────────────────────── */

/**
 * 定型の理由。自由記述だけにすると、あとで数えられない書き方が並ぶ。
 * 逆に定型だけにすると事情が落ちるので、両方を受ける（自由記述は任意）。
 * どれにも当てはまらないときの `other` だけは、自由記述を必須にする。
 */
export const REJECT_REASONS = [
  { code: "by-design", label: "仕様どおり" },
  { code: "duplicate", label: "他の要望と同じ" },
  { code: "infeasible", label: "実現しない" },
  { code: "other", label: "その他" },
] as const;

export const DISCARD_REASONS = [
  { code: "mistake", label: "誤送信" },
  { code: "test", label: "テスト投稿" },
  { code: "unreadable", label: "内容が読み取れない" },
  { code: "spam", label: "いたずら" },
  { code: "other", label: "その他" },
] as const;

export type ReasonCode = (typeof REJECT_REASONS)[number]["code"] | (typeof DISCARD_REASONS)[number]["code"];

/** その操作で選べる理由の一覧。重複は「他の要望と同じ」で固定になる。 */
export function reasonChoices(action: DispositionAction): readonly { code: string; label: string }[] {
  if (action === "discard") return DISCARD_REASONS;
  if (action === "duplicate") return [{ code: "duplicate", label: "他の要望と同じ" }];
  return REJECT_REASONS;
}

export function reasonCodeLabel(action: DispositionAction, code: string): string {
  return reasonChoices(action).find((r) => r.code === code)?.label ?? "理由の記録なし";
}

/**
 * 理由の検査。理由なしでは落とせないようにする。
 * 画面のボタンを押せなくするだけにせず、サーバー側でも同じ関数を通す。
 */
export function dispositionReasonError(action: DispositionAction, code: string, note: string): string | null {
  if (!dispositionNeedsReason(action)) return null;
  const allowed = reasonChoices(action).some((r) => r.code === code);
  if (!allowed) return "落とす理由を選んでください。";
  if (code === "other" && note.trim().length === 0) return "「その他」を選んだときは理由を書いてください。";
  return null;
}

/** 履歴と結果の表に出す理由の1行。定型と自由記述を1つの文にまとめる。 */
export function reasonText(action: DispositionAction, code: string, note: string): string {
  const head = dispositionNeedsReason(action) ? reasonCodeLabel(action, code) : dispositionActionLabel(action);
  const tail = note.trim();
  return tail ? `${head}：${tail}` : head;
}

/* ───────────────────────── 権限と確認 ───────────────────────── */

/**
 * 落とす・戻す操作を行ってよいか。
 *
 * 対応状況のメモ書き（未対応→対応中→完了）は会社の管理者も続けて行える。
 * ここで絞るのは、要望を見えなくする操作だけ。
 */
export function canDisposeImprovements(role: Role): boolean {
  return role === "SUPER_ADMIN";
}

/** まとめて実行する前の確認文。対象が何件かを必ず書く。 */
export function bulkDispositionConfirm(action: DispositionAction, count: number): string {
  return `${count}件を「${dispositionActionLabel(action)}」にします。よろしいですか。`;
}

/** 1件だけ実行する前の確認文。 */
export function dispositionConfirm(action: DispositionAction): string {
  return `この要望を「${dispositionActionLabel(action)}」にします。`;
}

/* ───────────────────────── 一覧の見え方 ───────────────────────── */

/**
 * 一覧の既定は「まだ終わっていないもの」。
 * 完了・対応しない・重複・廃棄まで既定で出すと、読む列が毎回埋まる。
 */
export const IMPROVEMENT_VIEWS = ["active", "all", "trash"] as const;
export type ImprovementView = (typeof IMPROVEMENT_VIEWS)[number];

export function isImprovementView(value: string): value is ImprovementView {
  return (IMPROVEMENT_VIEWS as readonly string[]).includes(value);
}

const VIEW_LABEL: Record<ImprovementView, string> = {
  active: "終わっていないもの",
  all: "すべて",
  trash: "廃棄箱",
};

export function improvementViewLabel(view: ImprovementView): string {
  return VIEW_LABEL[view];
}

export function filterImprovementsByView<T extends ImprovementDisposition>(rows: T[], view: ImprovementView): T[] {
  if (view === "trash") return rows.filter((r) => r.discarded);
  if (view === "all") return rows.filter((r) => !r.discarded);
  return rows.filter((r) => !r.discarded && !r.duplicateOfId && (r.status === "open" || r.status === "doing"));
}

/** 並べ替え。既定は届いた順（新しいものから）。 */
export const IMPROVEMENT_SORTS = ["new", "old", "state"] as const;
export type ImprovementSort = (typeof IMPROVEMENT_SORTS)[number];

export function isImprovementSort(value: string): value is ImprovementSort {
  return (IMPROVEMENT_SORTS as readonly string[]).includes(value);
}

const SORT_LABEL: Record<ImprovementSort, string> = {
  new: "新しい順",
  old: "古い順",
  state: "状態順",
};

export function improvementSortLabel(sort: ImprovementSort): string {
  return SORT_LABEL[sort];
}

/** 状態順に並べるときの順番。手が要るものから先に読ませる。 */
const STATE_ORDER: Record<ImprovementDisplayState, number> = {
  open: 0,
  // レビュー待ちは対応中より前。放っておくと止まったままになるのは、
  // 作業中のものではなく「取り込み待ちで誰も見ていないもの」のほう。
  review: 1,
  doing: 2,
  done: 3,
  duplicate: 4,
  dropped: 5,
  discarded: 6,
};

export function sortImprovements<T extends ImprovementDisposition & { createdAt: Date }>(
  rows: T[],
  sort: ImprovementSort,
): T[] {
  const sorted = [...rows];
  if (sort === "old") return sorted.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  if (sort === "new") return sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return sorted.sort(
    (a, b) =>
      STATE_ORDER[improvementDisplayState(a)] - STATE_ORDER[improvementDisplayState(b)] ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

/* ───────────────────────── 履歴の読み方 ───────────────────────── */

/**
 * 操作の履歴に出す言葉。
 *
 * 履歴は消さずに積むだけなので、いまは無い操作の行も残っている。
 * 名前を知らない行を「不明」と出すと、当時の経緯が読めなくなるため、
 * 過去に使っていた操作の言葉もここに残しておく。
 */
const LEGACY_EVENT_LABEL: Record<string, string> = {
  status: "対応状況の変更",
  sync: "記録票へ送信",
  unlink: "ひも付け解除",
  "close-issue": "記録票を閉じる",
  refresh: "記録票の状態を取り込む",
  handout: "指示文の払い出し",
};

/** 作業する側（Claude Code）が書き戻した行。人の操作と読み分けられるようにする。 */
const AGENT_EVENT_LABEL: Record<string, string> = {
  "agent-review": "確認を依頼（作業する側）",
  "agent-done": "確認依頼が取り込まれた",
  "agent-failed": "直しきれず（作業する側）",
};

export function improvementEventLabel(action: string): string {
  if (isDispositionAction(action)) return dispositionActionLabel(action);
  return AGENT_EVENT_LABEL[action] ?? LEGACY_EVENT_LABEL[action] ?? "対応状況の変更";
}

/**
 * その行を起こしたのは誰か。人・鍵・分からない、の3つを言い分ける。
 *
 * 鍵で変えた行を空欄のままにすると「退職された方」と出て、実際には
 * 自動で変わったものが、人が変えたように読めてしまう。
 */
export function improvementEventActor(actorName: string | null, keyLabel: string | null): string {
  if (actorName) return actorName;
  if (keyLabel) return `作業する側（${keyLabel}）`;
  return "退職された方";
}
