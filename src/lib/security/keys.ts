/**
 * 秘密の値から、用途ごとの鍵を HKDF で導く（DD-032 の1）。
 *
 * ── なぜ導くか ──
 * 1つの秘密をそのまま複数の用途の鍵にすると、ある用途で作った値が別の用途でも
 * 通ってしまう筋道が残る（たとえば確認の印と、ログインの署名が同じ鍵になる）。
 * salt と用途の名前（info）を変えて導けば、元の秘密が同じでも用途ごとに別の鍵になる。
 *
 * ── 守ること ──
 * - info は版を持つ固定の文字列。中身を変えると、今までに作った値が読めなくなる。
 *   変えるときは新しい版の名前を足し、古い版を読む期間を決める。
 * - このファイルは Web Crypto のほかに何も import しない。鍵を包み直す script
 *   （scripts/rewrap-credential-vault.mjs）が、素の node からそのまま読むため。
 *   同じ理由で、初期パスワードの控えを包む・開く処理（DB に触れない部分）もここに置く。
 *   アプリは src/lib/credential-vault.ts から使い、script と同じ関数を通る（写しを作らない）。
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const HKDF_SALT = "hr-eval/hkdf/v1";

export const KEY_INFO = {
  importConfirmation: "hr-eval/import-confirmation/v1",
  credentialMemo: "hr-eval/credential-memo/v1",
} as const;

/** 控えの鍵の版の頭。これの無い版は、生の鍵で包んだ古い形式 */
export const CREDENTIAL_MEMO_VERSION_PREFIX = "h1:";

/** secret から、用途 info の32バイトの鍵を導く */
export async function deriveKeyBytes(secret: Uint8Array<ArrayBuffer>, info: string): Promise<Uint8Array<ArrayBuffer>> {
  const ikm = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: encoder.encode(HKDF_SALT), info: encoder.encode(info) },
    ikm,
    256,
  );
  return new Uint8Array(bits);
}

/** バイト列の SHA-256 の先頭6バイトを hex にする（鍵の指紋。鍵そのものは出さない） */
export async function fingerprintOf(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest.slice(0, 6)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 取り込みの確認の印（HMAC-SHA-256）の鍵。BETTER_AUTH_SECRET から導く */
export async function deriveImportConfirmationKey(secret: string): Promise<CryptoKey> {
  const bytes = await deriveKeyBytes(encoder.encode(secret), KEY_INFO.importConfirmation);
  return crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/**
 * 初期パスワードの控えの鍵（AES-GCM）。CREDENTIAL_ENC_KEY の32バイトから導く。
 * version は `h1:` と、導いた鍵の指紋。鍵を替えた後に、古い鍵で包んだ控えを見分けるのに使う。
 */
export async function deriveCredentialMemoKey(raw: Uint8Array<ArrayBuffer>): Promise<{ key: CryptoKey; version: string }> {
  const bytes = await deriveKeyBytes(raw, KEY_INFO.credentialMemo);
  const key = await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
  return { key, version: `${CREDENTIAL_MEMO_VERSION_PREFIX}${await fingerprintOf(bytes)}` };
}

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
  /** 古い形式（生の鍵で包み、版に h1: が無い）の控えを読む鍵。読む期限までだけ使う */
  legacy?: { key: CryptoKey; version: string };
}

/**
 * 古い形式の控えを読む期限（2026-11-30 の日本時間の終わり）。
 * 発行から14日で控えは開けなくなるので、この日までに残った古い形式は
 * 包み直す（scripts/rewrap-credential-vault.mjs）か、再発行で置き換える。
 */
export const LEGACY_CREDENTIAL_READ_UNTIL = "2026-11-30T15:00:00Z";

export interface SealedMemo {
  ciphertext: string;
  iv: string;
  keyVersion: string;
}

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
  const { key, version } = await deriveCredentialMemoKey(raw);
  // 古い形式は読むだけ。新しい控えをこの鍵で包むことはない
  const legacyKey = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
  return { key, version, legacy: { key: legacyKey, version: await fingerprintOf(raw) } };
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
  now = new Date(),
): Promise<{ ok: true; password: string } | { ok: false; reason: OpenFailure }> {
  const key = keyForMemo(vault, memo.keyVersion, now);
  // 期限を過ぎた古い形式も「鍵が替わった」と同じに扱う（再発行で新しい形式に置き換わる）
  if (!key) return { ok: false, reason: "key-changed" };
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(memo.iv), additionalData: encoder.encode(userId) },
      key,
      fromBase64(memo.ciphertext),
    );
    return { ok: true, password: decoder.decode(plain) };
  } catch {
    return { ok: false, reason: "broken" };
  }
}

/** 控えの版に合う鍵。合う鍵が無いか、古い形式を読む期限を過ぎていれば null */
function keyForMemo(vault: VaultKey, keyVersion: string, now: Date): CryptoKey | null {
  if (keyVersion.startsWith(CREDENTIAL_MEMO_VERSION_PREFIX)) return keyVersion === vault.version ? vault.key : null;
  if (now.getTime() >= Date.parse(LEGACY_CREDENTIAL_READ_UNTIL)) return null;
  return vault.legacy && keyVersion === vault.legacy.version ? vault.legacy.key : null;
}
