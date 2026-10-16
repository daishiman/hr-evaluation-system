import { sql, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { schema as s, type DB } from "@/lib/db";
import { newId } from "@/lib/id";
import {
  accountSecurityChanges,
  type AccountAccess,
  type AccountSecuritySource,
} from "@/lib/domain/account-security-events";

type SqliteBatchItem = BatchItem<"sqlite">;

/**
 * アカウントの権限にかかわる操作の監査記録を書く文を作る（まだ実行しない。E7・DD-013）。
 *
 * 呼び出し側は、本体の書き込みと同じ D1 batch の末尾に入れる（本体だけ書かれて記録が欠ける、を作らない）。
 * 何を残すかは accountSecurityChanges が変更前と変更後の状態から決める。何も変わらなければ空の配列。
 *
 * when は「本体の書き込みが本当に効いたときだけ記録する」条件。最後の全体管理者を落とさない条件付きの
 * UPDATE のように、batch の中で本体が0行で終わりうるときに渡す（渡さないと、起きなかった変更を記録してしまう）。
 * 条件は batch の中で本体の文のあとに評価されるので、本体の結果を見て判定できる。
 */
export function accountSecurityEventStatements(
  db: DB,
  args: {
    userId: string;
    actorId: string | null;
    source: AccountSecuritySource;
    before: AccountAccess | null;
    after: AccountAccess;
    passwordReissued?: boolean;
    /** 1回の保存で書く記録に共通の id。CSV の取り込みは import_batches の id を渡す */
    operationId?: string;
    when?: SQL;
  },
): SqliteBatchItem[] {
  const changes = accountSecurityChanges(args.before, args.after, { passwordReissued: args.passwordReissued ?? false });
  const operationId = args.operationId ?? newId("asop");
  const occurredAt = Date.now();
  const condition = args.when ?? sql`1 = 1`;
  // db.run(sql`…`) は値を埋めると D1 の batch に入れられない（drizzle の SQLiteRaw が stmt を持たない）ので、
  // insert … select にする。select の列は表の定義の順（id, user_id, …, occurred_at）に並べる。
  return changes.map((change) =>
    db.insert(s.accountSecurityEvents).select(sql`
      select ${newId("asev")}, ${args.userId}, ${args.actorId}, ${change.companyId}, ${change.eventType}, ${args.source},
        ${operationId}, ${change.before ? JSON.stringify(change.before) : null}, ${change.after ? JSON.stringify(change.after) : null},
        ${occurredAt}
      where ${condition}
    `),
  );
}

/**
 * 利用者がもう「有効な全体管理者」ではないこと。全体管理者を外す・止める保存で、
 * 最後の全体管理者を落とさない条件に止められたときに記録を書かないための when に使う。
 */
export function noLongerActiveSuperAdmin(userId: string): SQL {
  return sql`exists (
    select 1 from ${s.users} as changed
    where changed.id = ${userId} and not (changed.role = 'SUPER_ADMIN' and changed.is_active = 1)
  )`;
}
