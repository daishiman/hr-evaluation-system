import { hashPassword } from "better-auth/crypto";
import type { DB } from "@/lib/db";
import { loadVaultKey, memoDelete, memoPurgeExpired, memoUpsert, sealMemo } from "@/lib/credential-vault";

/** 控えまわりで batch に入れる文。先頭が期限切れの掃除、次がこの人の控え。 */
type MemoStatements = readonly [
  ReturnType<typeof memoPurgeExpired>,
  ReturnType<typeof memoUpsert> | ReturnType<typeof memoDelete>,
];

/**
 * 仮パスワードを発行するときの「書く材料」をそろえる。
 *
 * 新規発行（会社の追加・利用者の追加）と再発行で、
 * ハッシュの作り方と控えの扱いを1か所にまとめる。
 * CSV取り込みはここを通らない。1つの batch に何人分も並べ、期限切れの掃除を先頭に1回だけ置くため、
 * 同じ部品（hashPassword・sealMemo・memoUpsert・memoPurgeExpired）を import-members.ts で直接使う。
 *
 * - memo は控えを書く文の組。利用者・アカウントと同じ batch に `...credential.memo` で入れて、
 *   どれか1つだけが書かれる状態を作らない。
 * - 組の先頭は期限を過ぎた控えの掃除。発行の経路を足しても掃除を入れ忘れないよう、ここで束ねる。
 * - 鍵が無いときは、古い控えを消す文を返す。再発行した後に
 *   前の値の控えが残ると、使えない値を渡してしまうため。
 */
export async function prepareCredential(
  db: DB,
  args: { userId: string; password: string; issuedBy: string | null },
): Promise<{ hashed: string; memo: MemoStatements; stored: boolean }> {
  const [hashed, vault] = await Promise.all([hashPassword(args.password), loadVaultKey()]);
  const purge = memoPurgeExpired(db);
  if (!vault) return { hashed, memo: [purge, memoDelete(db, args.userId)], stored: false };
  const sealed = await sealMemo(vault, args.userId, args.password);
  return {
    hashed,
    memo: [purge, memoUpsert(db, { userId: args.userId, issuedBy: args.issuedBy, ...sealed })],
    stored: true,
  };
}
