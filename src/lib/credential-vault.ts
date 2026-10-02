import { and, eq, gt, lte } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { schema as s, type DB } from "@/lib/db";

/**
 * 初期パスワードの控え（あとから一覧の行で開き直せるもの）。
 *
 * ── なぜ控えを持つか ──
 * 発行した直後の画面でしか仮パスワードを見られないと、書き写す前に一覧が
 * 新しくなった・別の画面へ移った、で二度と見られなくなる。そのせいで
 * 「一覧に出すと控えが消える」板挟みが起き、一覧の反映を遅らせていた。
 * 控えを安全に残せれば、一覧はすぐ新しくしてよい（ユーザー決定：一覧優先・控えを保存）。
 *
 * ── 守ること ──
 * - 平文で保存しない。AES-GCM で暗号化し、鍵は Workers の秘密の値
 *   （CREDENTIAL_ENC_KEY）にだけ置く。DBだけが漏れても読めない。
 * - 暗号文は利用者IDに結び付ける（追加認証データ）。DB上で別の人の行へ
 *   写し替えても開けない。
 * - 本人がパスワードを変えたら消す。再発行したら置き換える。
 * - 発行から14日を過ぎたら開けない・一覧に出さない。表からは次の発行の batch で消す。
 * - 開けるのはシステム全体管理者と、同じ会社の管理者だけ（呼び出し側で判定）。
 * - 鍵が無いときは控えを作らない。発行そのものは止めない（画面でその旨を伝える）。
 */

export const CREDENTIAL_KEY_NAME = "CREDENTIAL_ENC_KEY";

/**
 * 控えを開ける日数（ユーザー決定）。
 *
 * 本人が初めてログインしてパスワードを変えると控えは消えるので、残るのは
 * まだ一度も入っていない人の分だけ。長く残すほど、鍵が漏れたときに読める値が増える。
 * 2週間あれば、渡し損ねた人へ届け直すには足りる。
 */
export const MEMO_TTL_DAYS = 14;
const MEMO_TTL_MS = MEMO_TTL_DAYS * 24 * 60 * 60 * 1000;

/** この時刻か、それより前に発行した控えは期限切れ。 */
export function memoExpiryCutoff(now = new Date()): Date {
  return new Date(now.getTime() - MEMO_TTL_MS);
}

export function memoExpiresAt(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + MEMO_TTL_MS);
}

export function isMemoExpired(issuedAt: Date, now = new Date()): boolean {
  return issuedAt.getTime() <= memoExpiryCutoff(now).getTime();
}

export interface VaultKey {
  key: CryptoKey;
  /** 鍵の指紋。鍵を入れ替えたあと、古い鍵で作った控えを見分けるのに使う */
  version: string;
}

export interface SealedMemo {
  ciphertext: string;
  iv: string;
  keyVersion: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * 設定値から鍵を作る。32バイト（base64で44文字）でなければ鍵なしと同じに扱う。
 *
 * 人が考えた短い文字列を鍵にさせないため、長さが合わないものは受け付けない。
 * 作り方は `openssl rand -base64 32`（docs/deploy-notes.md）。
 */
export async function importVaultKey(base64: string | null | undefined): Promise<VaultKey | null> {
  if (!base64) return null;
  let raw: Uint8Array<ArrayBuffer>;
  try {
    raw = fromBase64(base64.trim());
  } catch {
    return null;
  }
  if (raw.byteLength !== 32) return null;
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
  const version = [...digest.slice(0, 6)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { key, version };
}

/** 実行環境の秘密の値から鍵を読む。未設定・形が違うときは null。 */
export async function loadVaultKey(): Promise<VaultKey | null> {
  const { env } = await getCloudflareContext({ async: true });
  return importVaultKey((env as unknown as Record<string, string | undefined>)[CREDENTIAL_KEY_NAME]);
}

export async function sealMemo(vault: VaultKey, userId: string, password: string): Promise<SealedMemo> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(userId) },
    vault.key,
    encoder.encode(password),
  );
  return { ciphertext: toBase64(new Uint8Array(cipher)), iv: toBase64(iv), keyVersion: vault.version };
}

/** 開けない理由。画面の言葉は呼び出し側で決める。 */
export type OpenFailure = "key-changed" | "broken";

export async function openMemo(
  vault: VaultKey,
  userId: string,
  memo: SealedMemo,
): Promise<{ ok: true; password: string } | { ok: false; reason: OpenFailure }> {
  if (memo.keyVersion !== vault.version) return { ok: false, reason: "key-changed" };
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(memo.iv), additionalData: encoder.encode(userId) },
      vault.key,
      fromBase64(memo.ciphertext),
    );
    return { ok: true, password: decoder.decode(plain) };
  } catch {
    return { ok: false, reason: "broken" };
  }
}

/**
 * 控えを書く文を作る（まだ実行しない）。
 *
 * 利用者・ログイン用アカウントと同じ batch に入れて、どれか1つだけが
 * 書かれる状態を作らないために、実行は呼び出し側に任せる。
 * 同じ人の控えがすでにあれば置き換える（再発行）。
 */
export function memoUpsert(
  db: DB,
  row: SealedMemo & { userId: string; issuedBy: string | null; issuedAt?: Date },
) {
  const values = {
    userId: row.userId,
    ciphertext: row.ciphertext,
    iv: row.iv,
    keyVersion: row.keyVersion,
    issuedBy: row.issuedBy,
    issuedAt: row.issuedAt ?? new Date(),
  };
  return db
    .insert(s.initialCredentialMemos)
    .values(values)
    .onConflictDoUpdate({
      target: s.initialCredentialMemos.userId,
      set: {
        ciphertext: values.ciphertext,
        iv: values.iv,
        keyVersion: values.keyVersion,
        issuedBy: values.issuedBy,
        issuedAt: values.issuedAt,
      },
    });
}

/** 控えを消す文。本人がパスワードを変えたとき・控えを残さず再発行するときに使う。 */
export function memoDelete(db: DB, userId: string) {
  return db.delete(s.initialCredentialMemos).where(eq(s.initialCredentialMemos.userId, userId));
}

/**
 * 期限を過ぎた控えを、全社分まとめて消す文（まだ実行しない）。
 *
 * 決まった時刻に動く仕組み（cron）は持たないので、控えを書く batch に一緒に入れる。
 * 控えが増えるのは発行のときだけなので、増えるたびに古いものが片付く。
 * 発行が途絶えている間に期限を過ぎた控えは表に残るが、開けず一覧にも出ない。
 * 同じ batch で書く新しい控えより前に置くこと（いま書いた控えを消さないため）。
 */
export function memoPurgeExpired(db: DB, now = new Date()) {
  return db.delete(s.initialCredentialMemos).where(lte(s.initialCredentialMemos.issuedAt, memoExpiryCutoff(now)));
}

export async function readMemo(db: DB, userId: string) {
  return (
    await db.select().from(s.initialCredentialMemos).where(eq(s.initialCredentialMemos.userId, userId)).limit(1)
  )[0];
}

/**
 * 控えを持っている人の ID。一覧の行に「控えを見る」を出すかどうかに使う。
 *
 * 中身（暗号文）は読まない。開くのは押した人だけ・押したときだけ（revealCredentialMemo）。
 * companyId を渡すとその会社の人だけ、null なら全社（システム全体管理者の一覧）。
 * 期限を過ぎた控えは、表に残っていても数えない（押しても開けないボタンを出さない）。
 */
export async function listMemoHolderIds(db: DB, companyId: string | null, now = new Date()): Promise<string[]> {
  const memo = s.initialCredentialMemos;
  const live = gt(memo.issuedAt, memoExpiryCutoff(now));
  if (companyId === null) {
    return (await db.select({ userId: memo.userId }).from(memo).where(live)).map((r) => r.userId);
  }
  const rows = await db
    .select({ userId: memo.userId })
    .from(memo)
    .innerJoin(s.users, eq(s.users.id, memo.userId))
    .where(and(eq(s.users.companyId, companyId), live));
  return rows.map((r) => r.userId);
}

/** 控えを保存したかどうかを、発行した人へ伝える言葉。 */
export function memoNotice(stored: boolean): string {
  return stored ? "控えは一覧の行から開けます。" : "控えは保存していません。今メモしてください。";
}
