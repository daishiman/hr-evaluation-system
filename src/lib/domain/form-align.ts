/**
 * 設定とずれた回答の無い下書きを、まとめてそろえるときの判定（DD-028 の6）。書き込みはしない。
 *
 * どちらを正にするかは、後から保存した側で決める。設定の側が新しければ下書きを設定から作り直し、
 * 下書きの側が新しければ、紐づいた設問の文の直しと外しを設定へ写す（保存の I28 と同じ経路）。
 * 書く文は src/lib/form-align.ts が組み立てる。
 */
import { isLinkedQuestion, type QuestionIdPlan, type QuestionLinks, type SubmittedQuestion } from "./form-question-links";
import type { StoredWithTitle } from "./form-to-settings";

export const ALIGN_CONFLICT = "内容を見た後に、アンケートか設定が保存されました。もう一度内容を見てから、そろえてください。";

/** toForm: 下書きを設定から作り直す ／ toSettings: 下書きの文の直しと外しを設定へ写す */
export type AlignDirection = "toForm" | "toSettings";

/**
 * どちらを正にするか。下書きの側は、下書きの設問を保存した時刻（設問の行の更新時刻の最大）で比べる。
 * 締切・題・状態だけを直しても設問の行は書き直さないので、その直しで向きは変わらない
 * （設問の保存は全ての行を入れ直すので、設問を消しただけでも時刻は進む）。
 * 同じ時刻は設定を変えない側（作り直す）に倒す。
 * 設問が1問も無い下書きは写すものが無く、設定の項目をすべて外すことになるので作り直す
 * （アンケートの保存も、設問が0問のときは断る）。
 */
export function alignDirection(args: { settingsAt: number; questionsAt: number; questionCount: number }): AlignDirection {
  return args.questionCount === 0 || args.settingsAt >= args.questionsAt ? "toForm" : "toSettings";
}

/** そろえる設問の形（下書きの設問と、設定から作り直した設問のどちらも） */
export type AlignQuestion = { [K in keyof QuestionLinks]?: QuestionLinks[K] | null } & {
  title: string;
  section: string;
  questionType: string;
};

function linksOf(q: AlignQuestion): QuestionLinks {
  return {
    gradeRequirementId: q.gradeRequirementId ?? null,
    promotionRequirementId: q.promotionRequirementId ?? null,
    behaviorGuidelineId: q.behaviorGuidelineId ?? null,
    kpiItemId: q.kpiItemId ?? null,
    kpiQuestionKey: q.kpiQuestionKey ?? null,
    isGate: q.isGate ?? false,
  };
}

const linkKeyOf = (q: AlignQuestion) => JSON.stringify(Object.values(linksOf(q)));

const storedOf = (q: AlignQuestion, id: string, title: string): StoredWithTitle => ({
  ...linksOf(q),
  id,
  title,
  section: q.section,
  questionType: q.questionType,
});

export type SettingsMatch =
  | { ok: true; submitted: SubmittedQuestion[]; ids: QuestionIdPlan[]; stored: StoredWithTitle[] }
  | { ok: false; title: string };

/**
 * 下書きを設定へ写すために、アンケートの保存（planFormToSettings）へ渡す形に組み直す。
 *
 * 下書きの設問を「送られた設問」に、設定から作り直した設問を「保存済みの設問」に見立てる。
 * 紐づけ（6つ）が同じ設問どうしを1対1で対応させ、対応した保存済みの側の id は下書きの設問の id にする。
 * こうすると、文の違いは文の直しに、下書きに無い設定の設問は外しになる。
 * 対応の無い下書きの紐づいた設問（設定で使わなくなった項目への設問など）は、写し方が決まらないので断る。
 */
export function matchToSettings(
  current: readonly (AlignQuestion & { id: string })[],
  rebuilt: readonly AlignQuestion[],
): SettingsMatch {
  const pool = rebuilt.map((q) => ({ q, key: linkKeyOf(q) }));
  const used = new Set<number>();
  const stored: StoredWithTitle[] = [];
  for (const q of current) {
    if (!isLinkedQuestion(q)) {
      stored.push(storedOf(q, q.id, q.title));
      continue;
    }
    const key = linkKeyOf(q);
    const index = pool.findIndex((p, n) => !used.has(n) && p.key === key);
    if (index < 0) return { ok: false, title: q.title };
    used.add(index);
    stored.push(storedOf(q, q.id, pool[index].q.title));
  }
  pool.forEach((p, n) => {
    if (!used.has(n)) stored.push(storedOf(p.q, `align:${n}`, p.q.title));
  });
  return {
    ok: true,
    submitted: current.map((q) => ({ ...linksOf(q), id: q.id, title: q.title, section: q.section, questionType: q.questionType })),
    ids: current.map((): QuestionIdPlan => "keep"),
    stored,
  };
}

/** 対応の無い設問があって、設定へ写せないときの理由（結果の文の括弧に入れるので句点は付けない） */
export function unmatchedQuestionReason(title: string): string {
  return `「${title}」は、いまの設定から作る設問にありません。アンケートの画面で、この設問を消してから設定の行を選んで足し直してください`;
}

export interface AlignKeyEntry {
  formId: string;
  outcome: AlignDirection | "failed";
  /** 下書きの設問を保存した時刻（設問の行の更新時刻の最大。ms）。設問を読めなかったときは null */
  questionsAt: number | null;
  /** つながった設定の更新時刻の最大（ms）。設定から作り直せなかったときは null */
  settingsAt: number | null;
}

/**
 * 内容を見たときの一覧の印。そろえる直前に作り直して比べ、違えば何も書かずに断る。
 * 下書きの設問か設定が間に保存されると、どちらかの時刻が変わるので印も変わる。
 * 締切・題だけの直しでは変わらない（そろえる内容に関わらない）。状態を変えた下書きは一覧から外れるので、印が変わる。
 */
export function alignPlanKey(entries: readonly AlignKeyEntry[]): string {
  const text = JSON.stringify(
    [...entries]
      .sort((a, b) => a.formId.localeCompare(b.formId))
      .map((e) => [e.formId, e.outcome, e.questionsAt, e.settingsAt]),
  );
  // FNV-1a（32bit）。印は比べるだけで、秘密ではない
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** 内容を見たときの文 */
export function alignPreviewMessage(items: number, failed: number): string {
  if (items === 0 && failed === 0) return "設定とずれた下書きはありません。";
  const parts = [`設定とずれた下書きが${items}件あります。`];
  if (failed > 0) parts.push(`このほか${failed}件は、そのままではそろえられません。`);
  return parts.join("");
}

export interface AlignFailure {
  name: string;
  reason: string;
}

const list = (names: readonly string[]) => `${names.length}件: ${names.join("、")}`;

/** そろえた後の文。follow は設定へ写したあとの追従の結果の文 */
export function alignResultMessage(outcome: {
  toSettings: readonly string[];
  toForm: readonly string[];
  failures: readonly AlignFailure[];
  follow: string;
}): string {
  const total = outcome.toSettings.length + outcome.toForm.length;
  if (total === 0 && outcome.failures.length === 0) return "そろえる下書きはありませんでした。";
  const parts: string[] = [];
  if (total > 0) parts.push(`設定とずれた下書きを${total}件そろえました。`);
  if (outcome.toSettings.length > 0) parts.push(`下書きの直しを設定へ反映しました（${list(outcome.toSettings)}）。`);
  if (outcome.toForm.length > 0) parts.push(`設定に合わせて作り直しました（${list(outcome.toForm)}）。`);
  if (outcome.failures.length > 0) {
    const failed = outcome.failures.map((f) => `${f.name}（${f.reason}）`).join("、");
    parts.push(`そろえられなかった下書きがあります（${outcome.failures.length}件: ${failed}）。`);
  }
  return parts.join("") + outcome.follow;
}
