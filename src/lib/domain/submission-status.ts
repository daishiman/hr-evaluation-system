/**
 * 提出状況（S8・A7）。
 *
 * 対象者と回答から、対象者全員に「提出済み・入力途中・未回答」のどれかと提出日時を付け、件数を数える。
 * 回答が無い人も「未回答」として必ず行に出す（回答の表から数えると、まだ手を付けていない人が消える）。
 * 対象者の求め方（誰がこのアンケート・評価期間の対象か）は呼び出し側が決める。ここは突き合わせだけ。
 */

export type SubmissionState = "submitted" | "draft" | "none";
/** 一覧の絞り込み。all は全員 */
export type SubmissionFilter = SubmissionState | "all";

/** 状態の言葉。画面・件数の見出しはここ1箇所の言葉を使う */
export const SUBMISSION_STATE_LABEL: Record<SubmissionState, string> = {
  submitted: "提出済み",
  draft: "入力途中",
  none: "未回答",
};

export const SUBMISSION_STATES: SubmissionState[] = ["submitted", "draft", "none"];

export interface SubmissionCounts {
  total: number;
  submitted: number;
  draft: number;
  none: number;
}

type Target = { employeeId: string };
type Response = { employeeId: string; status: string; submittedAt: Date | null };

export type SubmissionRow<T extends Target, R extends Response> = T & {
  state: SubmissionState;
  /** 提出日時。入力途中・未回答は null */
  submittedAt: Date | null;
  /** 状態の元にした回答（未回答は null） */
  response: R | null;
};

function isSubmitted(response: Response): boolean {
  return response.status === "submitted";
}

/**
 * 1人に回答が複数あるとき（版の作り直しなど）に、状態の元にする1件を選ぶ。
 * 提出済みがあればそれを、提出済みどうしなら最後に提出したものを取る（評価に使う回答と同じ考え方）。
 */
function preferred<R extends Response>(current: R | undefined, candidate: R): R {
  if (!current) return candidate;
  if (!isSubmitted(candidate)) return current;
  if (!isSubmitted(current)) return candidate;
  return (candidate.submittedAt?.getTime() ?? 0) > (current.submittedAt?.getTime() ?? 0) ? candidate : current;
}

export function summarizeSubmissions<T extends Target, R extends Response>(
  targets: readonly T[],
  responses: readonly R[],
): { rows: SubmissionRow<T, R>[]; counts: SubmissionCounts } {
  const byEmployee = new Map<string, R>();
  for (const response of responses) {
    byEmployee.set(response.employeeId, preferred(byEmployee.get(response.employeeId), response));
  }
  const rows = targets.map((target) => {
    const response = byEmployee.get(target.employeeId) ?? null;
    // submitted 以外の状態は、知らない値も含めて入力途中に倒す（提出済みと取り違えない）
    const state: SubmissionState = !response ? "none" : isSubmitted(response) ? "submitted" : "draft";
    const submittedAt = response && isSubmitted(response) ? response.submittedAt : null;
    return { ...target, state, submittedAt, response };
  });
  return { rows, counts: countSubmissions(rows) };
}

/** 行の件数。担当の部下だけに絞ったあとなど、行を減らしたら数え直す */
export function countSubmissions(rows: readonly { state: SubmissionState }[]): SubmissionCounts {
  const counts: SubmissionCounts = { total: rows.length, submitted: 0, draft: 0, none: 0 };
  for (const row of rows) counts[row.state] += 1;
  return counts;
}

export function filterSubmissionRows<T extends { state: SubmissionState }>(
  rows: readonly T[],
  filter: SubmissionFilter,
): T[] {
  return filter === "all" ? [...rows] : rows.filter((row) => row.state === filter);
}

/** URL の ?status= を絞り込みに直す。知らない値は全員 */
export function parseSubmissionFilter(value: string | undefined): SubmissionFilter {
  return SUBMISSION_STATES.find((state) => state === value) ?? "all";
}
