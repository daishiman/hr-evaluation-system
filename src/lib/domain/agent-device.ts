/**
 * ブラウザで承認して、端末ごとに短命の通行証を受け取る仕組みの、判断の正本。
 *
 * ここは計算だけを持つ（DBも通信も触らない）。決めているのは4つ。
 *  1. 画面に打ち込む合言葉の形（読み間違えない文字だけを使う）
 *  2. 通行証の寿命（短い方＝毎回の受け取り／長い方＝入り直しの間隔）
 *  3. 承認待ちの状態（待ち／承認済み／断られた／時間切れ）
 *  4. 断ったときに次へ進める1文
 *
 * 長命の鍵と違うのは、**漏れても短時間で切れる**こと。だから鍵の値を
 * 手で配って回る必要がなくなる。承認だけは必ず人がブラウザで行う。
 */

/* ───────────────────────── 画面に打ち込む合言葉 ───────────────────────── */

/**
 * 合言葉に使う文字。0/O・1/I/L のように読み違えるものを外してある。
 * 声に出して伝える・書き写すことがあるので、見分けにくい文字は入れない。
 */
export const USER_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** 合言葉の文字数。4文字ずつ2組に区切って見せる。 */
export const USER_CODE_LENGTH = 8;

/** 承認の画面。台本の案内と画面のリンクで同じ場所を指す。 */
export const DEVICE_APPROVE_PATH = "/system/agent-keys";

/** 合言葉を人が読む形にする（4文字ずつ区切る）。 */
export function formatUserCode(raw: string): string {
  const value = raw.toUpperCase();
  return `${value.slice(0, 4)}-${value.slice(4)}`;
}

/**
 * 打ち込まれた合言葉をならす。小文字・区切り・空白の違いで弾かない。
 * 形が違えば null を返す（推測して近い合言葉を探しにいかない）。
 */
export function normalizeUserCode(input: string | null | undefined): string | null {
  const value = (input ?? "").toUpperCase().replace(/[^A-Z0-9]/gu, "");
  if (value.length !== USER_CODE_LENGTH) return null;
  for (const ch of value) {
    if (!USER_CODE_ALPHABET.includes(ch)) return null;
  }
  return value;
}

/* ───────────────────────── 寿命 ───────────────────────── */

/** 承認を待てる時間。過ぎたら合言葉は無効になる。 */
export const DEVICE_GRANT_TTL_MS = 10 * 60_000;

/** 受け取りに使う通行証の寿命。短くし、切れたら自動で取り直す。 */
export const ACCESS_TOKEN_TTL_MS = 15 * 60_000;

/** 入り直さずに済む期間。過ぎたらブラウザでの承認からやり直す。 */
export const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60_000;

/** 台本が承認を待つ間隔（秒）。短くしすぎると回数制限に当たる。 */
export const DEVICE_POLL_INTERVAL_SECONDS = 5;

/** 残り時間を分で言う。秒まで出しても待つ側の判断は変わらない。 */
export function expiresInMinutes(expiresAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 60_000));
}

/** 期限切れかどうか。期限そのものは切れている側に入れる。 */
export function isExpired(expiresAt: Date | null, now: Date): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() <= now.getTime();
}

/* ───────────────────────── 承認待ちの状態 ───────────────────────── */

export type DeviceGrantState = "pending" | "approved" | "denied" | "expired";

export interface DeviceGrantTiming {
  expiresAt: Date;
  approvedAt: Date | null;
  deniedAt: Date | null;
}

/**
 * いまどの状態か。断られた・承認済みが先で、時間切れはそのあと。
 *
 * 承認済みを時間切れより先に見るのは、承認した直後に期限をまたいでも
 * 受け取れるようにするため（人が押したあとで失敗させない）。
 */
export function deviceGrantState(grant: DeviceGrantTiming, now: Date): DeviceGrantState {
  if (grant.deniedAt) return "denied";
  if (grant.approvedAt) return "approved";
  if (isExpired(grant.expiresAt, now)) return "expired";
  return "pending";
}

/* ───────────────────────── 断り文と案内 ───────────────────────── */

export const DEVICE_PENDING_MESSAGE = "まだ承認されていません。ブラウザで承認してください。";

export const DEVICE_DENIED_MESSAGE = "この端末は承認されませんでした。\nもう一度やり直してください。";

export const DEVICE_EXPIRED_MESSAGE = "合言葉の期限が切れました。\nもう一度やり直してください。";

export const DEVICE_UNKNOWN_MESSAGE = "この合言葉は見つかりません。\n打ち間違いを確かめてください。";

export const DEVICE_APPROVED_MESSAGE = "承認しました。ターミナルの表示が進みます。";

/** 通す前に添える注意。押した先で何が起きるかを、押す前に言う。 */
export const DEVICE_APPROVE_NOTE =
  "通すと、この端末は要望を読めるようになります。\n心当たりが無ければ通さないでください。";

/** 期限切れ・止められた端末に返す1文。次の一手は入り直しの1つだけ。 */
export const AGENT_SESSION_ENDED_MESSAGE =
  "この端末は使えなくなっています。\n`pnpm improvements login` でやり直してください。";

export const DEVICE_REFRESH_EXPIRED_MESSAGE =
  "通行証の期限が切れました。\n`pnpm improvements login` でやり直してください。";

/** 承認の画面で、押す前に見せる1文。どの端末を通すのかを言う。 */
export function deviceApprovalQuestion(label: string, code: string): string {
  const name = label.trim().length > 0 ? label.trim() : "名前のない端末";
  return `「${name}」（${formatUserCode(code)}）を通しますか。`;
}

/** ターミナルに出す案内。合言葉と開く場所だけを、この順で出す。 */
export function deviceLoginInstructions(origin: string, code: string, minutes: number): string {
  return [
    "ブラウザで次の画面を開き、合言葉を入れてください。",
    `  ${origin}${DEVICE_APPROVE_PATH}`,
    `  合言葉: ${formatUserCode(code)}`,
    `この合言葉は${minutes}分で切れます。承認されるまでここで待ちます。`,
  ].join("\n");
}

/* ───────────────────────── 通した端末の一覧 ───────────────────────── */

/** 一覧の見出し。名前が入っていない古い行だけ、名前の代わりを置く。 */
export function sessionDisplayName(label: string): string {
  const value = label.replace(/\s+/gu, " ").trim();
  return value.length > 0 ? value : "名前のない端末";
}

/** いつ入り直しが要るか。日で言う（分や時間まで出しても判断は変わらない）。 */
export function sessionExpiryNote(refreshExpiresAt: Date, now: Date): string {
  const days = Math.ceil((refreshExpiresAt.getTime() - now.getTime()) / (24 * 60 * 60_000));
  if (days <= 0) return "期限切れです。入り直しが要ります。";
  return `あと${days}日で入り直しが要ります。`;
}

/** 止める前に見せる1文。止めた先で何が起きるかを言う。 */
export function sessionRevokeConfirmText(name: string): string {
  return `「${name}」はすぐに使えなくなります。\n入り直せばまた使えます。`;
}

export const SESSION_LIST_EMPTY_TITLE = "まだ通した端末はありません";

/* ───────────────────────── 古い方式の鍵 ───────────────────────── */

/**
 * 長命の鍵は、いきなり止めない。止めると手元が動かなくなる人が出る。
 * 使えるまま「古い方式です」と伝え続け、入り直しが済んだら画面から止める。
 */
export const LEGACY_KEY_NOTICE =
  "この鍵は古い方式です。\n`pnpm improvements login` で短い通行証に移せます。";
