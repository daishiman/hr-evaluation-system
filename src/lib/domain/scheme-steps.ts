/**
 * KPI・評価セットの設定を「手順」として扱うための純関数。
 *
 * 背景（2026-08-11 の指摘）:
 *   1つの画面で「等級区分を選ぶ／配点を確認する／KPIを選ぶ／基準値を決める／KPIを比べる」を
 *   同時にやらせていたため、何をしている画面なのか分からなくなっていた。
 *   そこで等級区分ごとに2つの手順へ分け、終わったら次へ送る形にした。
 *
 *     入口（/admin/scheme）           … どの等級区分を設定するかを選ぶ
 *     手順1（/admin/scheme/[区分]）    … その等級区分で使うKPIを選ぶ
 *     手順2（/admin/scheme/[区分]/criteria）… 選んだ項目だけの基準（A〜E）を決める
 *     → 次の等級区分の手順1へ。全区分が終わったら制度設定ガイドへ戻す。
 *
 * ここには点数も等級区分名も書かない。すべて呼び出し側がDBから渡す。
 * このファイルが持つのは「どこまで進んでいるか」「次は何か」の判断だけ。
 */

import { expectedItemCount, pointsForSlot, type GradePointRule } from "./grade-points";

/** 1つの等級区分の中の手順。数が増えたらここだけを直す。 */
export type StepKey = "select" | "criteria";

/** 等級区分1つあたりの手順数（画面の「ステップ 1 / 2」の分母） */
export const STEPS: StepKey[] = ["select", "criteria"];

export function stepNumber(step: StepKey): number {
  return STEPS.indexOf(step) + 1;
}

/** 画面の見出しに出す手順名。用語はここ1箇所で決める（画面ごとに言い換えない）。 */
export function stepTitle(step: StepKey): string {
  return step === "select" ? "使うKPIを選ぶ" : "選んだ項目の基準を決める";
}

/** その手順で何をするのかの1行。見出しの下にそのまま出す。 */
export function stepLede(step: StepKey, pointGroup: string): string {
  return step === "select"
    ? `${pointGroup} の評価に使うKPIを選びます。ここでは全項目から選べます。`
    : `${pointGroup} で選んだ項目だけが対象です。実績値がどこからどこまでならA〜Eのどれになるかを決めます。`;
}

/** 手順のURL。パスの組み立てを画面ごとに書き起こさない。 */
export function schemeStepPath(pointGroup: string, step: StepKey): string {
  const base = `/admin/scheme/${encodeURIComponent(pointGroup)}`;
  return step === "select" ? base : `${base}/criteria`;
}

export interface SavedPick {
  kpiItemId: string;
  isFixedSlot: boolean;
  isMajorSlot: boolean;
}

export interface GroupProgressInput {
  rule: GradePointRule;
  /** 保存済みの選択（scheme_items のその等級区分ぶん） */
  saved: SavedPick[];
  /**
   * その等級区分を対象として、A〜Eの基準が作られている項目のID。
   * 「選べるかどうか」ではなく「基準の設定が済んでいるか」の判定にだけ使う。
   */
  ratedItemIds: Iterable<string>;
}

export interface GroupProgress {
  pointGroup: string;
  /** 選んだ項目数（固定枠を含む） */
  selectedCount: number;
  /** 選ぶべき項目数（固定枠を含む） */
  expectedCount: number;
  /** 選んだ項目の配点合計 */
  totalPoints: number;
  /** その等級区分の満点 */
  maxPoints: number;
  /** 手順1（使うKPIを選ぶ）が終わっているか */
  selectionDone: boolean;
  /** 手順2（基準を決める）が終わっているか */
  criteriaDone: boolean;
  /** 両方終わっているか */
  done: boolean;
  /** 基準がこの等級区分向けに用意されていない項目の数 */
  unratedCount: number;
  /** 次にやること（画面にそのまま出す1行） */
  nextAction: string;
  /** 次に開く手順。両方終わっていれば null */
  nextStep: StepKey | null;
}

/**
 * 等級区分1つの進み具合。
 *
 * 手順1が終わったと言えるのは「選んだ項目数が型どおりで、配点の合計が満点ちょうど」のとき。
 * 足りないときも多すぎるときも終わっていない（多すぎる場合を「終わっている」と数えると、
 * 保存できない状態のまま次へ送ってしまう）。
 */
export function computeGroupProgress(input: GroupProgressInput): GroupProgress {
  const { rule, saved } = input;
  const rated = new Set(input.ratedItemIds);
  const expectedCount = expectedItemCount(rule);

  const totalPoints = saved.reduce(
    (sum, x) => sum + pointsForSlot(rule, x.isFixedSlot ? "fixed" : x.isMajorSlot ? "major" : "minor"),
    0,
  );
  const selectionDone = saved.length === expectedCount && totalPoints === rule.totalPoints;

  const unratedCount = saved.filter((x) => !rated.has(x.kpiItemId)).length;
  /* 項目を選び終わっていないうちは、基準の話にたどり着いていない（未着手）。
     選び終わっていて、かつ全項目に基準があるときだけ手順2を終わりとする。 */
  const criteriaDone = selectionDone && unratedCount === 0;

  const nextStep: StepKey | null = !selectionDone ? "select" : !criteriaDone ? "criteria" : null;
  const shortage = expectedCount - saved.length;
  const nextAction = !selectionDone
    ? saved.length === 0
      ? `使うKPIを${expectedCount}件選んでください。`
      : shortage > 0
        ? `使うKPIをあと${shortage}件選んでください。`
        : shortage < 0
          ? `選んだKPIが${-shortage}件多いため、外してください。`
          : `配点の合計が${totalPoints}点です。${rule.totalPoints}点ちょうどにしてください。`
    : !criteriaDone
      ? `選んだ項目のうち${unratedCount}件の基準（A〜E）が未設定です。`
      : "設定は終わっています。内容を見直すこともできます。";

  return {
    pointGroup: rule.pointGroup,
    selectedCount: saved.length,
    expectedCount,
    totalPoints,
    maxPoints: rule.totalPoints,
    selectionDone,
    criteriaDone,
    done: criteriaDone,
    unratedCount,
    nextAction,
    nextStep,
  };
}

/**
 * 「次はこの等級区分」を決める。
 *
 * 表示順（制度上の順番）は崩さない。並びの中で current の次を返し、
 * 最後の等級区分なら null（＝制度設定ガイドの次の項目へ送る合図）。
 */
export function nextGroupOf(orderedGroups: string[], current: string): string | null {
  const i = orderedGroups.indexOf(current);
  if (i < 0 || i >= orderedGroups.length - 1) return null;
  return orderedGroups[i + 1];
}

/** 並びの中で何番目か（画面の「等級区分 2 / 5」）。見つからなければ 0。 */
export function groupPosition(orderedGroups: string[], current: string): number {
  return orderedGroups.indexOf(current) + 1;
}

export interface OverallProgress {
  /** 設定が終わっている等級区分の数 */
  done: number;
  /** 等級区分の総数 */
  total: number;
  /** 次に手をつける等級区分。すべて終わっていれば null */
  nextGroup: string | null;
  /** 入口の画面にそのまま出す1行 */
  summary: string;
}

/**
 * 全体の進み具合。
 *
 * 「次に手をつける等級区分」は、終わっていないもののうち**並びが最初のもの**にする。
 * 未完了のうち一番進んでいるものを勧めると、制度の順番（Beginner から上へ）と
 * 案内の順番が食い違い、どこまでやったのかを人が数え直すことになる。
 */
export function overallProgress(list: GroupProgress[]): OverallProgress {
  const total = list.length;
  const done = list.filter((g) => g.done).length;
  const next = list.find((g) => !g.done) ?? null;
  return {
    done,
    total,
    nextGroup: next?.pointGroup ?? null,
    summary: next
      ? `${total}つの等級区分のうち${done}つが設定済みです。次は「${next.pointGroup}」の設定です。`
      : `${total}つの等級区分すべての設定が終わっています。`,
  };
}
