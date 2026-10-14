import { and, eq } from "drizzle-orm";
import { getDb, schema as s, type DB } from "@/lib/db";
import { managerCandidateIn, managerOfIn } from "@/lib/memberships";
import { atLeast, HttpError, type Role } from "@/lib/session";

type ManagerLookup = (userId: string) => Promise<string | null>;

/**
 * その会社での「この人の上長」を引く関数を作る。上長は所属ごとに違うので、会社を必ず決めてからたどる
 * （S7。別の会社の上長の連鎖をたどると、循環を見落としたり、無い循環で断ったりする）。
 */
export function managerLookupIn(companyId: string): ManagerLookup {
  return async (userId) => managerOfIn(await getDb(), userId, companyId);
}

/** 上長の連鎖をたどり、本人への逆戻りや既存の循環へ接続する変更を拒否する。 */
export async function assertNoManagerCycle(
  userId: string,
  managerId: string | null,
  lookup: ManagerLookup,
): Promise<void> {
  const seen = new Set([userId]);
  let current = managerId;

  while (current) {
    if (seen.has(current)) {
      throw new HttpError(400, "上長の関係が循環します。別の上長を選んでください。");
    }
    seen.add(current);
    current = await lookup(current);
  }
}

/**
 * メールアドレスがまだ誰にも使われていないことを確かめる（使われていれば 400）。
 *
 * メールはログインの名前なので、利用者を作る・メールを変える入口のすべてで同じ確かめ方をする。
 * 入口ごとに書くと、正規化（小文字化）や「本人は除く」の扱いが食い違うため、ここ1か所に置く。
 * email は呼び出し側で trim・小文字化したものを渡す（保存する値と同じものを確かめる）。
 * exceptUserId を渡すと、その人自身が使っている場合は通す（メールの変更）。
 */
export async function assertEmailAvailable(db: DB, email: string, exceptUserId?: string): Promise<void> {
  const hit = (await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, email)).limit(1))[0];
  if (!hit || hit.id === exceptUserId) return;
  throw new HttpError(
    400,
    exceptUserId ? "このメールアドレスはすでに別の方が使っています。" : "このメールアドレスはすでに登録されています。",
  );
}

/** 利用中のアカウントは、利用中かつテンプレートではない会社だけに所属できる。 */
export async function assertCompanyAssignable(companyId: string, isActiveUser: boolean) {
  const db = await getDb();
  const companies = await db
    .select({ id: s.companies.id, isActive: s.companies.isActive, isTemplate: s.companies.isTemplate })
    .from(s.companies)
    .where(eq(s.companies.id, companyId))
    .limit(1);
  const company = companies[0];
  if (!company) throw new HttpError(400, "所属会社が見つかりませんでした。");
  if (company.isTemplate || (isActiveUser && !company.isActive)) {
    throw new HttpError(400, "利用中の方は、利用中の実在会社に所属させてください。");
  }
}

/**
 * 等級・上長がその会社のものであることを確かめる（他社の id を混ぜられないようにする）。
 * 上長は、その会社に所属があり、利用中で、マネージャー以上の人だけ。
 * 社員の管理・所属の追加・全体管理者の利用者の変更で、同じ確かめ方と同じ文にする。
 */
export async function assertCompanyRefs(
  db: DB,
  companyId: string,
  gradeId?: string | null,
  managerId?: string | null,
): Promise<void> {
  if (gradeId) {
    const grade = await db
      .select({ id: s.grades.id })
      .from(s.grades)
      .where(and(eq(s.grades.id, gradeId), eq(s.grades.companyId, companyId)))
      .limit(1);
    if (grade.length === 0) throw new HttpError(400, "この会社に登録されていない等級です。");
  }
  if (managerId) {
    const manager = await managerCandidateIn(db, managerId, companyId);
    if (!manager) throw new HttpError(400, "この会社に登録されていない上長です。");
    if (!manager.isActive) throw new HttpError(400, "利用停止中の方は上長に指定できません。");
    if (!atLeast(manager.role as Role, "MANAGER")) {
      throw new HttpError(400, "上長にはマネージャー以上の方を指定してください。");
    }
  }
}
