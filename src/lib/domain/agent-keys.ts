/**
 * 画面から発行する API の鍵の、決まりごと。
 *
 * ここは計算だけを持つ（乱数もDBも触らない）。決めることは4つ。
 *  1. 生の鍵をどう組み立て、どこまでを画面に出してよいか
 *  2. 保存してよいのは何か（生の鍵は保存しない）
 *  3. 発行・失効の記録をどう読ませるか
 *  4. 使った時刻をいつ書き換えるか
 *
 * 生の鍵は発行した瞬間の1回だけ画面に出し、以降はどこからも読めない。
 * だから保存するのはハッシュと先頭数文字だけにする。先頭数文字は
 * 「いま手元にあるのはこの鍵か」を見分けるためのもので、当てる材料にはならない。
 */

/** 鍵に使う乱数の長さ（バイト）。base64url にすると43文字になる。 */
export const AGENT_KEY_BYTES = 32;

/** 画面に出してよい先頭の文字数。これ以上出すと当てる手がかりになる。 */
export const AGENT_KEY_PREFIX_LENGTH = 8;

/** 鍵を発行する画面。案内文とAPIの断り文から、同じ場所を指す。 */
export const AGENT_KEY_PAGE_PATH = "/system/agent-keys";

/** 鍵を発行する画面の呼び名。メニュー・案内文で同じ言葉を使う。 */
export const AGENT_KEY_PAGE_LABEL = "Claude Code 連携の鍵";

/**
 * 乱数から鍵の文字列を作る。
 *
 * base64url（記号は - と _ だけ）にする。コマンドに貼ったときに
 * シェルが解釈する記号が入らないため、引用の作法を間違えても事故にならない。
 */
export function encodeAgentKey(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/** 画面に出す先頭数文字。生の鍵が手元に無くなっても、どれのことかは分かる。 */
export function agentKeyPrefix(raw: string): string {
  return raw.slice(0, AGENT_KEY_PREFIX_LENGTH);
}

/** 一覧に出す鍵の呼び名。全文が出ていないことを、見た目でも言葉でも示す。 */
export function agentKeyMaskedLabel(prefix: string): string {
  return `${prefix}…（以降は表示しません）`;
}

/** 手元のターミナルへ貼る1行。鍵を単引用符で囲み、貼り間違いで壊れないようにする。 */
export function agentKeyExportLine(raw: string): string {
  return `export HR_AGENT_KEY='${raw}'`;
}

/* ───────────────────────── 発行の記録 ───────────────────────── */

export type AgentKeyState = "active" | "revoked";

export interface AgentKeyRecord {
  id: string;
  keyPrefix: string;
  createdAt: Date;
  createdByName: string | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  revokedByName: string | null;
}

/** いま使える鍵かどうか。失効の印があれば、それだけで使えない。 */
export function agentKeyState(record: Pick<AgentKeyRecord, "revokedAt">): AgentKeyState {
  return record.revokedAt ? "revoked" : "active";
}

export function agentKeyStateLabel(state: AgentKeyState): string {
  return state === "active" ? "使えます" : "失効しました";
}

export function agentKeyStateTone(state: AgentKeyState): "done" | "dropped" {
  return state === "active" ? "done" : "dropped";
}

/**
 * 使われたことがあるかを1行で言う。
 *
 * 「一度も使われていません」を黙って空欄にしない。鍵を配ったつもりで
 * 相手に届いていない、という取り違えはここでしか気づけない。
 */
export function agentKeyUsageNote(lastUsedAt: Date | null): string {
  return lastUsedAt ? "使われています" : "まだ一度も使われていません";
}

/** 一覧のうち、いま使える鍵。無ければ null。 */
export function activeAgentKey<T extends Pick<AgentKeyRecord, "revokedAt">>(records: readonly T[]): T | null {
  return records.find((r) => agentKeyState(r) === "active") ?? null;
}

/* ───────────────────────── 使った時刻の書き換え ───────────────────────── */

/** 使った時刻を書き直す間隔。呼ばれるたびに書くと、読み取りのたびに書き込みが起きる。 */
export const AGENT_KEY_TOUCH_INTERVAL_MS = 60_000;

export function shouldTouchLastUsed(lastUsedAt: Date | null, now: Date): boolean {
  if (!lastUsedAt) return true;
  return now.getTime() - lastUsedAt.getTime() >= AGENT_KEY_TOUCH_INTERVAL_MS;
}

/* ───────────────────────── 画面に出す注意書き ───────────────────────── */

/**
 * 発行直後にだけ出す注意。
 *
 * 「閉じたら二度と出ない」を最初に言う。あとから言っても、その時には
 * もう閉じられている。
 */
export const AGENT_KEY_ONCE_NOTICE = "この画面を閉じると、鍵をもう一度表示することはできません。";

/** 作り直し・失効を押す前に出す確認文。何が止まるのかを先に言う。 */
export function agentKeyConfirmText(action: "reissue" | "revoke"): string {
  return action === "reissue"
    ? "いまの鍵はすぐに使えなくなります。新しい鍵を配り直すまで、受け取りは止まります。"
    : "いまの鍵はすぐに使えなくなります。次の鍵を発行するまで、受け取りは止まります。";
}
