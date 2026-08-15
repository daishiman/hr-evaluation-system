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

/* ───────────────────────── 用途の名前 ───────────────────────── */

/**
 * 鍵は複数本持てる。だから1本ずつ「どこで使う鍵か」の名前を必ず付ける。
 *
 * 名前を省けるようにすると、先頭数文字だけが並ぶ一覧になる。そうなると
 * どれを止めてよいか分からず、結局どれも止められなくなる。
 */
export const AGENT_KEY_LABEL_MAX = 30;

/** 前後の空白と連続した空白をならす。改行は空白1つに畳む。 */
export function normalizeAgentKeyLabel(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/gu, " ").trim().slice(0, AGENT_KEY_LABEL_MAX);
}

/** 名前として受け取れない理由。問題なければ null。 */
export function agentKeyLabelError(raw: string | null | undefined): string | null {
  const label = normalizeAgentKeyLabel(raw);
  if (label.length === 0) return "この鍵をどこで使うかを入れてください。";
  return null;
}

/** 名前の入力欄に出す例。空欄のまま迷わせない。 */
export const AGENT_KEY_LABEL_PLACEHOLDER = "自宅の Claude Code";

/* ───────────────────────── 発行の記録 ───────────────────────── */

export type AgentKeyState = "active" | "revoked";

export interface AgentKeyRecord {
  id: string;
  /** どこで使う鍵か。発行時に必ず入る。 */
  label: string;
  keyPrefix: string;
  createdAt: Date;
  createdByName: string | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  revokedByName: string | null;
}

/**
 * 一覧の見出し。名前を主役にし、先頭数文字は見分けの補助として添える。
 * 古い記録で名前が入っていないときだけ、名前の代わりを置く。
 */
export function agentKeyDisplayName(record: Pick<AgentKeyRecord, "label" | "keyPrefix">): string {
  const label = normalizeAgentKeyLabel(record.label);
  return label.length > 0 ? label : "名前のない鍵";
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

/** 一覧のうち、いま使える鍵すべて。 */
export function activeAgentKeys<T extends Pick<AgentKeyRecord, "revokedAt">>(records: readonly T[]): T[] {
  return records.filter((r) => agentKeyState(r) === "active");
}

/* ───────────────────────── 発行できる本数 ───────────────────────── */

/**
 * 同時に使える鍵の上限。
 *
 * 上限が無いと、使わなくなった鍵が止められないまま増え続ける。増えた鍵は
 * どれも同じ権限で通るので、1本でも漏れれば全部の中身が出る。
 * 10本は「人ごと・端末ごとに配っても足りる」と「一覧を目で追える」の境目。
 */
export const AGENT_KEY_MAX = 10;

export function canIssueAgentKey(activeCount: number): boolean {
  return activeCount < AGENT_KEY_MAX;
}

/** いま何本使えるか。上限に達したら、次に何をすればよいかまで書く。 */
export function agentKeyCapNote(activeCount: number): string {
  if (canIssueAgentKey(activeCount)) {
    return `いま使える鍵は${activeCount}本です（上限${AGENT_KEY_MAX}本）。`;
  }
  return `使える鍵が上限の${AGENT_KEY_MAX}本に達しています。使っていない鍵を止めてから発行してください。`;
}

/** 上限に達したときにサーバーが返す断り文。画面と同じ言葉で返す。 */
export const AGENT_KEY_CAP_MESSAGE = agentKeyCapNote(AGENT_KEY_MAX);

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

/**
 * 1本を止める前に出す確認文。止まる範囲を先に言う。
 *
 * 鍵は複数本あるので「全部止まる」ではない。どれが止まり、どれが動き続けるかを
 * 名前で示す（名前を付けさせているのは、この一文を書けるようにするためでもある）。
 */
export function agentKeyRevokeConfirmText(name: string, remaining: number): string {
  const rest =
    remaining > 0
      ? `残りの${remaining}本はそのまま使えます。`
      : "これを止めると、画面から発行した鍵は0本になります。";
  return `「${name}」はすぐに使えなくなります。${rest}`;
}

/* ───────────────────────── サーバーの設定値の鍵 ───────────────────────── */

/**
 * ターミナルから登録した鍵（環境変数）の扱い。
 *
 * この鍵は画面の一覧に出てこないので、画面の鍵を全部止めても残り続ける。
 * 「止めたはずなのに受け取れる」を消すため、画面から受け付けを止められるようにする。
 * 設定値そのものを消す手順も併せて出す（画面で止めるのは取り消しがきく方の手段）。
 */
export const AGENT_ENV_KEY_TITLE = "サーバーの設定値の鍵";

export function envKeyStateLabel(configured: boolean, enabled: boolean): string {
  if (!configured) return "登録されていません";
  return enabled ? "使えます" : "止めています";
}

export function envKeyStateTone(configured: boolean, enabled: boolean): "done" | "dropped" | "closed" {
  if (!configured) return "closed";
  return enabled ? "done" : "dropped";
}

/** その状態が何を意味するか。無言のバッジだけにしない。 */
export function envKeyNote(configured: boolean, enabled: boolean): string {
  if (!configured) return "ターミナルから登録した鍵はありません。画面の鍵だけで受け取ります。";
  if (enabled) return "画面の鍵を全部止めても、この鍵では受け取れます。";
  return "この鍵での受け取りを止めています。画面の鍵だけが通ります。";
}

export function envKeyToggleLabel(enabled: boolean): string {
  return enabled ? "この鍵での受け取りを止める" : "この鍵での受け取りを再開する";
}

export function envKeyToggleConfirm(enabled: boolean): string {
  return enabled
    ? "この鍵での受け取りをすぐに止めます。画面から、いつでも戻せます。"
    : "この鍵での受け取りを再開します。設定値はそのまま残っています。";
}

/** 設定値そのものを消すコマンド。画面と手順書で同じ文字列を出す。 */
export const AGENT_ENV_KEY_DELETE_COMMAND = "wrangler secret delete AGENT_API_KEY";
