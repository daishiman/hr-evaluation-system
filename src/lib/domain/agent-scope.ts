/**
 * 作業する側（Claude Code）に渡す鍵の、できることの範囲。
 *
 * ここは計算だけを持つ（DBも通信も触らない）。決めているのは3つ。
 *  1. 鍵に持たせてよい権限は何か（2つだけ）
 *  2. どの要望を読めるか（鍵に焼き込んだ会社のものだけ）
 *  3. どの要望の状態を変えられるか（その鍵が実際に受け取ったものだけ）
 *
 * 「読める範囲」と「書ける範囲」を別々の場所で判断すると、片方だけ広いまま
 * 残る。両方をこの1箇所で決め、入口（route.ts）は結果に従うだけにする。
 */

/**
 * 鍵に持たせる権限。これ以上は増やさない。
 *  improvements:read       … 要望と作業指示文を読む
 *  improvements:write-own  … 自分が受け取った要望の状態を変える
 */
export const AGENT_SCOPES = ["improvements:read", "improvements:write-own"] as const;
export type AgentScope = (typeof AGENT_SCOPES)[number];

/** 新しく発行する鍵に付ける権限。読み取りと、自分が取った分の状態更新だけ。 */
export const DEFAULT_AGENT_SCOPES: readonly AgentScope[] = AGENT_SCOPES;

const SCOPE_LABEL: Record<AgentScope, string> = {
  "improvements:read": "要望の読み取り",
  "improvements:write-own": "自分が取得した要望の状態更新",
};

/** 画面に出す権限の呼び名。英語の識別子は画面に出さない。 */
export function agentScopeLabel(scope: AgentScope): string {
  return SCOPE_LABEL[scope];
}

export function isAgentScope(value: string): value is AgentScope {
  return (AGENT_SCOPES as readonly string[]).includes(value);
}

/**
 * 保存してある権限の文字列を読む。知らない名前は落とす。
 *
 * 落とすのは、あとから権限名を減らしたときに、古い行の名前が
 * そのまま通ってしまうのを防ぐため（増やす方向にだけ効かせる）。
 */
export function parseAgentScopes(raw: string | null | undefined): AgentScope[] {
  const names = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return [...new Set(names.filter(isAgentScope))];
}

export function serializeAgentScopes(scopes: readonly AgentScope[]): string {
  return [...new Set(scopes)].join(",");
}

export function hasAgentScope(scopes: readonly AgentScope[], scope: AgentScope): boolean {
  return scopes.includes(scope);
}

/* ───────────────────────── 呼び出してきた鍵 ───────────────────────── */

/**
 * どの鍵で来たか。
 *
 * companyId が null なのは2つの場合だけ。
 *  ・サーバーの設定値の鍵（画面より前からある入口）
 *  ・会社を焼き込む前に発行した鍵
 * どちらも読み取りだけに使えるものとして扱い、状態は変えさせない。
 * 「どの会社の話か」が決まらないまま書き込ませないため。
 */
export interface AgentCallerScope {
  keyId: string | null;
  companyId: string | null;
  scopes: readonly AgentScope[];
}

export type AgentGuardResult = { ok: true } | { ok: false; status: 403 | 404; message: string };

/** 見つからないときの文。他社のものか、存在しないかを言い分けない。 */
export const AGENT_NOT_FOUND_MESSAGE = "対象の要望が見つかりません。要望IDを確かめてください。";

export const AGENT_NO_WRITE_SCOPE_MESSAGE =
  "この鍵には状態を変える権限がありません。\n発行画面で新しい鍵を作り直してください。";

export const AGENT_NOT_CLAIMED_MESSAGE =
  "この要望は、この鍵ではまだ受け取っていません。\n先に受け取ってから、もう一度お試しください。\n`pnpm improvements get 要望ID`";

/**
 * 読んでよい要望か。鍵に会社が焼き込んであれば、その会社のものだけ。
 * 会社が無い鍵（移行期間の鍵）は、これまでどおり全社を読める。
 */
export function canReadImprovement(caller: AgentCallerScope, itemCompanyId: string): AgentGuardResult {
  if (!hasAgentScope(caller.scopes, "improvements:read")) {
    return { ok: false, status: 403, message: "この鍵には要望を読む権限がありません。" };
  }
  if (caller.companyId !== null && caller.companyId !== itemCompanyId) {
    return { ok: false, status: 404, message: AGENT_NOT_FOUND_MESSAGE };
  }
  return { ok: true };
}

/**
 * 状態を変えてよい要望か。3つを全部満たしたときだけ通す。
 *  ・鍵に状態更新の権限がある
 *  ・鍵に焼き込んだ会社と、要望の会社が同じ
 *  ・その鍵で実際に受け取った要望である
 *
 * 3つ目を外すと、要望IDを順に当てるだけで他人の作業を「対応済み」にできる。
 */
export function canWriteImprovement(
  caller: AgentCallerScope,
  item: { companyId: string; claimedByThisKey: boolean },
): AgentGuardResult {
  if (!hasAgentScope(caller.scopes, "improvements:write-own")) {
    return { ok: false, status: 403, message: AGENT_NO_WRITE_SCOPE_MESSAGE };
  }
  // 会社が決まらない鍵には書かせない（読み取りだけの鍵として扱う）。
  if (caller.companyId === null || caller.keyId === null) {
    return { ok: false, status: 403, message: AGENT_NO_WRITE_SCOPE_MESSAGE };
  }
  if (caller.companyId !== item.companyId) {
    return { ok: false, status: 404, message: AGENT_NOT_FOUND_MESSAGE };
  }
  if (!item.claimedByThisKey) {
    return { ok: false, status: 403, message: AGENT_NOT_CLAIMED_MESSAGE };
  }
  return { ok: true };
}

/* ───────────────────────── 終わったときの書き戻し ───────────────────────── */

/**
 * 作業する側が返せる結果。
 *  done   … 直して公開まで済んだ（対応済みにする）
 *  failed … 直しきれなかった（対応中のまま、理由を残す）
 */
export const AGENT_RESULTS = ["done", "failed"] as const;
export type AgentResult = (typeof AGENT_RESULTS)[number];

export const RELEASE_REF_MAX = 200;

/**
 * 「対応済み」にするには、公開した先の証跡を必ず書かせる。
 *
 * テストが通っただけで対応済みにすると、直っていないものが完了扱いで
 * 一覧から消える。ここで証跡（本番URL・版の名前・確認依頼の番号など）を
 * 必須にしておけば、あとから人が「本当に出たか」を確かめられる。
 */
export function releaseRefError(raw: string): string | null {
  const value = raw.trim();
  if (value.length === 0) {
    return "公開した先を書いてください（本番URL・版の名前・確認依頼の番号のどれか）。";
  }
  if (value.length > RELEASE_REF_MAX) {
    return `公開した先は${RELEASE_REF_MAX}文字以内で書いてください。`;
  }
  return null;
}

export const AGENT_FAILED_NOTE_MAX = 1000;

export function failedNoteError(raw: string): string | null {
  const value = raw.trim();
  if (value.length === 0) return "直しきれなかった理由を書いてください。";
  if (value.length > AGENT_FAILED_NOTE_MAX) {
    return `理由は${AGENT_FAILED_NOTE_MAX}文字以内で書いてください。`;
  }
  return null;
}

/** 履歴と一覧に出す1文。あとから読む人が、何が起きたかだけで分かる形にする。 */
export function agentResultNote(result: AgentResult, detail: string, keyLabel: string | null): string {
  const who = keyLabel ? `「${keyLabel}」の鍵` : "作業する側";
  return result === "done"
    ? `${who}が直して公開しました（${detail.trim()}）`
    : `${who}が直しきれませんでした（${detail.trim()}）`;
}

/** 履歴に残す操作の名前。人の操作（status）と混ぜない。 */
export function agentResultAction(result: AgentResult): "agent-done" | "agent-failed" {
  return result === "done" ? "agent-done" : "agent-failed";
}
