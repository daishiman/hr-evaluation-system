import { eq, gt, lte } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { schema as s, type DB } from "@/lib/db";
import { joinMembership } from "@/lib/memberships";
import { importVaultKey, memoExpiryCutoff, type SealedMemo, type VaultKey } from "@/lib/security/keys";

// 包む・開く処理は DB に触れないので keys.ts に置く（包み直しの script と同じ関数を通るため）
export {
  importVaultKey,
  isMemoExpired,
  LEGACY_CREDENTIAL_READ_UNTIL,
  MEMO_TTL_DAYS,
  memoExpiresAt,
  memoExpiryCutoff,
  openMemo,
  sealMemo,
  type OpenFailure,
  type SealedMemo,
  type VaultKey,
} from "@/lib/security/keys";

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
 * - 包む鍵は CREDENTIAL_ENC_KEY そのものではなく、HKDF で導いた控え専用の鍵
 *   （src/lib/security/keys.ts。DD-032 の1）。版は `h1:` で始まる。
 *   `h1:` の無い古い形式（生の鍵で包んだもの）は、LEGACY_CREDENTIAL_READ_UNTIL までだけ読む。
 * - 暗号文は利用者IDに結び付ける（追加認証データ）。DB上で別の人の行へ
 *   写し替えても開けない。
 * - 本人がパスワードを変えたら消す。再発行したら置き換える。
 * - 発行から14日を過ぎたら開けない・一覧に出さない。表からは次の発行の batch で消す。
 * - 開けるのはシステム全体管理者と、同じ会社の管理者だけ（呼び出し側で判定）。
 * - 鍵が無いときは控えを作らない。発行そのものは止めない（画面でその旨を伝える）。
 */

export const CREDENTIAL_KEY_NAME = "CREDENTIAL_ENC_KEY";

/** 実行環境の秘密の値から鍵を読む。未設定・形が違うときは null。 */
export async function loadVaultKey(): Promise<VaultKey | null> {
  const { env } = await getCloudflareContext({ async: true });
  return importVaultKey((env as unknown as Record<string, string | undefined>)[CREDENTIAL_KEY_NAME]);
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
 * companyId を渡すとその会社に所属する人だけ（ほかの会社にも所属していてよい）、
 * null なら全社（システム全体管理者の一覧）。
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
    .innerJoin(s.companyMemberships, joinMembership(companyId))
    .where(live);
  return rows.map((r) => r.userId);
}

/** 控えを保存したかどうかを、発行した人へ伝える言葉。 */
export function memoNotice(stored: boolean): string {
  return stored ? "控えは一覧の行から開けます。" : "控えは保存していません。今メモしてください。";
}
