/**
 * 昇給と昇格の最終の結論（G24・I25・DD-024）。
 *
 * 点数の判定（evaluations.raise_eligible・promotion_eligible）は集計が機械的に決める。
 * そこへ上司が「判定どおりにする（follow）／変える（override）」を記録し、
 * 最終の結論は表示のたびにこのファイルの finalDecision で出す。
 * 結論を列に保存しないのは、点数の判定と上司の判断のどちらが結論を決めたかを、
 * いつでも並べて見せられるようにするため（保存すると、2つが食い違ったときにどちらが正か分からなくなる）。
 *
 * 結論を出す場所（評価の詳細・本人の結果・評価期間の一覧・レポート・CSV）は、どれもこの関数だけを通す。
 * 各所で `raiseEligible ? … : …` と書き直すと、上司が変えた結論を見落とす画面が必ず出るため
 * （src/lib/final-decision.contract.test.ts で固定）。
 *
 * 確定のときの入力の検査（validateDecisionInput）も、画面と Server Action が同じ関数を使う。
 * 画面だけで確かめると、Server Action を直接呼んだ確定が通る。サーバーだけで確かめると、
 * 押せない理由が画面に出ない（qa-y11 (14)）。
 */

import { CRITERIA_LEAK_PATTERNS, parseReasonText } from "@/lib/domain/evaluation-view";

export const DECISION_KINDS = ["follow", "override"] as const;
/** follow ＝ 点数の判定どおりにする ／ override ＝ 変える */
export type DecisionKind = (typeof DECISION_KINDS)[number];

export type DecisionSubject = "raise" | "promotion";
export const DECISION_SUBJECTS: readonly DecisionSubject[] = ["raise", "promotion"];

export const DECISION_SUBJECT_LABEL: Record<DecisionSubject, string> = {
  raise: "昇給",
  promotion: "昇格",
};

/** 上司の理由の上限。上司コメント（evaluatorComment）と同じ長さにそろえる */
export const DECISION_REASON_MAX = 2000;

export interface FinalDecision {
  /** 最終の結論。true ＝ 認める */
  approved: boolean;
  /** 点数の判定。true ＝ 可 */
  scoreJudgement: boolean;
  /** 上司の判断。null は記録なし */
  decision: DecisionKind | null;
  /** 上司が点数の判定を変えたか */
  overridden: boolean;
  /** 判断の記録が無い（この仕組みより前に確定した評価・まだ確定していない評価） */
  unrecorded: boolean;
}

/**
 * 点数の判定と上司の判断から、最終の結論を出す。
 *
 * - follow: 点数の判定のまま
 * - override: 点数の判定の逆（可 → 見送る、否 → 認める）。結論は2つしか無いので、「変える」で結論が決まる
 * - 記録なし: 点数の判定を結論として出し、記録なしの印を付ける（過去の確定は書き換えない）
 */
export function finalDecision(scoreJudgement: boolean, decision: DecisionKind | null | undefined): FinalDecision {
  if (decision === "override") {
    return { approved: !scoreJudgement, scoreJudgement, decision, overridden: true, unrecorded: false };
  }
  if (decision === "follow") {
    return { approved: scoreJudgement, scoreJudgement, decision, overridden: false, unrecorded: false };
  }
  return { approved: scoreJudgement, scoreJudgement, decision: null, overridden: false, unrecorded: true };
}

/* ───────────── 文言（DecisionBadge・CSV・レポートが共有する）─────────────
 * 言い回しをここ1か所に置き、画面ごとに書き直さない（qa-y11 (15)）。
 * 色だけで区別しないよう、上司が変えたことは必ず「上司の判断」という語で示す（qa-y10 (21)）。 */

/** 「上司の判断」の印に使う語 */
export const DECISION_MARK = "上司の判断";
/** 判断の記録が無い古い確定に出す文 */
export const DECISION_UNRECORDED_TEXT = "上司の判断の記録なし（この仕組みより前に確定）";
/** まだ確定していない評価に出す文 */
export const DECISION_PENDING_TEXT = "上司の判断はまだ記録されていません（確定のときに記録します）";

/** 結論の語。例：見送り */
export function conclusionWord(approved: boolean): string {
  return approved ? "あり" : "見送り";
}

/** 項目名を除いた結論。表の「昇給」の列のように、項目名が別にあるところで使う。例：見送り（上司の判断） */
export function conclusionValue(fd: FinalDecision): string {
  const word = conclusionWord(fd.approved);
  return fd.overridden ? `${word}（${DECISION_MARK}）` : word;
}

/** 結論の1行。例：昇給：見送り（上司の判断） */
export function conclusionText(subject: DecisionSubject, fd: FinalDecision): string {
  return `${DECISION_SUBJECT_LABEL[subject]}：${conclusionValue(fd)}`;
}

/** 評価1件の行から、昇給・昇格の最終の結論を出す（各所で raiseEligible と raiseDecision を組み直さない） */
export function finalDecisionOf(
  subject: DecisionSubject,
  row: Pick<DecisionColumns, "raiseEligible" | "promotionEligible" | "raiseDecision" | "promotionDecision">,
): FinalDecision {
  return subject === "raise"
    ? finalDecision(row.raiseEligible, row.raiseDecision)
    : finalDecision(row.promotionEligible, row.promotionDecision);
}

/** 点数の判定の語。例：点数の判定では可 */
export function scoreJudgementText(scoreJudgement: boolean): string {
  return `点数の判定では${scoreJudgement ? "可" : "否"}`;
}

/** 上司の判断の語。CSV の「上司の判断」列と、レポートの②に出す */
export function decisionKindText(fd: FinalDecision, opts: { finalized: boolean }): string {
  if (fd.decision === "follow") return "点数の判定どおり";
  if (fd.decision === "override") return "変える";
  return opts.finalized ? DECISION_UNRECORDED_TEXT : DECISION_PENDING_TEXT;
}

/**
 * CSV（評価結果）の1項目ぶんの4列：結論・点数の判定・上司の判断・判断の理由（backend の (20)）。
 * 点数の判定の列には、否のときだけ点数の判定の理由を添える（以前の「昇格可否」の列が持っていた情報を落とさない）。
 * 判断の理由は「変える」のときだけ出す（follow のときは保存していない）。
 */
export function decisionCsvCells(
  fd: FinalDecision,
  opts: { finalized: boolean; scoreReason: string | null; decisionReason: string | null },
): [conclusion: string, scoreJudgement: string, decisionKind: string, decisionReason: string] {
  const reason = opts.scoreReason?.trim();
  const score = fd.scoreJudgement ? "可" : reason ? `否（${reason}）` : "否";
  return [
    conclusionValue(fd),
    score,
    decisionKindText(fd, { finalized: opts.finalized }),
    fd.overridden ? (opts.decisionReason ?? "") : "",
  ];
}

/** 「変える」を選んだときに出る結論の語（見送る／認める）。入力欄の上に出す */
export function overrideConclusionVerb(scoreJudgement: boolean): string {
  return scoreJudgement ? "見送る" : "認める";
}

/** 理由文が無いときに「可／否」の横に添える文 */
const SCORE_JUDGEMENT_FALLBACK: Record<DecisionSubject, Record<"true" | "false", string>> = {
  raise: { true: "昇給の要件を満たしています。", false: "昇給の要件を満たしていません。" },
  promotion: { true: "昇格の要件をすべて満たしています。", false: "昇格の要件を満たしていません。" },
};

/**
 * 点数の判定の短い理由（上司の判断の欄で「可／否」の横に添える1行）。
 * 保存済みの理由文（見出し＋並び）から、最初の見出しだけを取り出す。
 * 理由文が無い（昇格の要件をすべて満たしたときは未達の理由が保存されない）ときは定型の文を返す。
 */
export function shortJudgementReason(
  subject: DecisionSubject,
  scoreJudgement: boolean,
  text: string | null | undefined,
): string {
  const headline = parseReasonText(text).find((b) => b.headline !== "")?.headline;
  return headline ?? SCORE_JUDGEMENT_FALLBACK[subject][`${scoreJudgement}`];
}

/* ───────────── 本人に見せる文の検査（DD-023）───────────── */

/**
 * 本人向けの網（CRITERIA_LEAK_PATTERNS）に触れた語を、重ならない形で返す。
 * 上司の理由とコメントは本人にもそのまま見えるので、保存のときにこれで調べ、
 * 触れた語を名指しして書き直してもらう（表示のときに黙って差し替えない）。
 */
export function findCriteriaLeakWords(text: string | null | undefined): string[] {
  if (!text) return [];
  const words = new Set<string>();
  for (const pattern of CRITERIA_LEAK_PATTERNS) {
    const global = new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`);
    for (const m of text.matchAll(global)) words.add(m[0].trim());
  }
  return [...words];
}

function leakMessage(target: string, words: string[]): string {
  return `${target}に、本人に見せられない語があります（${words.map((w) => `「${w}」`).join("・")}）。点数や配点ではなく、行動や事実で書き直してください。`;
}

/** 上司コメントの検査。問題が無ければ null、あれば画面とサーバーで同じ1行を返す */
export function commentProblem(comment: string | null | undefined): string | null {
  const words = findCriteriaLeakWords(comment);
  return words.length > 0 ? leakMessage("上長からのコメント", words) : null;
}

/* ───────────── 確定のときの入力の検査 ───────────── */

export interface DecisionInput {
  raiseDecision?: DecisionKind | null;
  raiseDecisionReason?: string | null;
  promotionDecision?: DecisionKind | null;
  promotionDecisionReason?: string | null;
}

export interface NormalizedDecision {
  raiseDecision: DecisionKind;
  raiseDecisionReason: string | null;
  promotionDecision: DecisionKind;
  promotionDecisionReason: string | null;
}

export type DecisionCheck =
  | { ok: true; value: NormalizedDecision }
  | { ok: false; problems: string[] };

/**
 * 確定の前に、昇給と昇格の判断がそろっているかを確かめる。
 *
 * 問題の文は1件1行で、上から順に「選ぶ → 理由を書く → 長さ → 本人に見せられない語」。
 * 画面は先頭の1行を「押せない理由」として出し、サーバーは全件を 400 の文として返す。
 * follow のときの理由は保存しない（理由を書くのは変えるときだけ。qa-y10 (20)）。
 */
export function validateDecisionInput(input: DecisionInput): DecisionCheck {
  const problems: string[] = [];
  const value: Partial<NormalizedDecision> = {};
  for (const subject of DECISION_SUBJECTS) {
    const label = DECISION_SUBJECT_LABEL[subject];
    const decision = subject === "raise" ? input.raiseDecision : input.promotionDecision;
    const rawReason = subject === "raise" ? input.raiseDecisionReason : input.promotionDecisionReason;
    if (decision !== "follow" && decision !== "override") {
      problems.push(`${label}について「点数の判定どおりにする」か「変える」かを選んでください。`);
      continue;
    }
    if (decision === "follow") {
      assign(value, subject, decision, null);
      continue;
    }
    const reason = (rawReason ?? "").trim();
    if (reason === "") {
      problems.push(`${label}を変える理由を書いてください。`);
      continue;
    }
    if (reason.length > DECISION_REASON_MAX) {
      problems.push(`${label}を変える理由は${DECISION_REASON_MAX}字までです（いま${reason.length}字）。`);
      continue;
    }
    const words = findCriteriaLeakWords(reason);
    if (words.length > 0) {
      problems.push(leakMessage(`${label}を変える理由`, words));
      continue;
    }
    assign(value, subject, decision, reason);
  }
  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, value: value as NormalizedDecision };
}

function assign(
  value: Partial<NormalizedDecision>,
  subject: DecisionSubject,
  decision: DecisionKind,
  reason: string | null,
): void {
  if (subject === "raise") {
    value.raiseDecision = decision;
    value.raiseDecisionReason = reason;
  } else {
    value.promotionDecision = decision;
    value.promotionDecisionReason = reason;
  }
}

/* ───────────── 閲覧者に合わせた判断の見せ方 ───────────── */

export interface DecisionColumns {
  raiseEligible: boolean;
  promotionEligible: boolean;
  raiseDecision: DecisionKind | null;
  raiseDecisionReason: string | null;
  promotionDecision: DecisionKind | null;
  promotionDecisionReason: string | null;
  decisionRecordedBy?: string | null;
  decisionRecordedAt?: Date | null;
  status: string;
}

/**
 * 本人には、確定した評価の判断だけを見せる（qa-y13 (8)）。
 * 確定を戻した（reopen）評価は判断を保持したまま確認中になるので、本人の返り値からは判断を外す。
 * 理由の文は本人にも同じ文で見せる（DD-023）ので、確定していれば削らない。
 */
export function scopeDecisionColumns<T extends DecisionColumns>(row: T, isReviewer: boolean): T {
  if (isReviewer || row.status === "finalized") return row;
  return {
    ...row,
    raiseDecision: null,
    raiseDecisionReason: null,
    promotionDecision: null,
    promotionDecisionReason: null,
    decisionRecordedBy: null,
    decisionRecordedAt: null,
  };
}
