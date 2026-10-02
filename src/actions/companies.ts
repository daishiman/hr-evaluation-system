"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { runAction } from "@/lib/action";
import { withCompensation } from "@/lib/compensation";
import { prepareCredential } from "@/lib/credential-issue";
import { memoNotice } from "@/lib/credential-vault";
import { getDb, schema as s } from "@/lib/db";
import { newId } from "@/lib/id";
import { HttpError } from "@/lib/session";
import { copyCompanyMasters, deleteCompanyMasters, findTemplateCompany } from "@/lib/template";
import { assertEmailAvailable } from "@/lib/user-integrity";

/**
 * 会社の追加・変更・利用停止（システム全体管理者のみ）。
 *
 * 画面専用の書き込みなので、URL の口（Route Handler）ではなく Server Action に置く。
 * 成功すると runAction が refresh() を呼び、会社の一覧は保存の応答と同時に新しくなる。
 */

const createSchema = z.object({
  name: z.string().trim().min(1, "会社名を入力してください").max(60),
  slug: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[a-z0-9-]+$/, "英小文字・数字・ハイフンで入力してください"),
  businessType: z.string().max(40).nullable().optional(),
  adminName: z.string().trim().min(1).max(60),
  adminEmail: z.string().email("メールアドレスの形式を確認してください"),
  adminPassword: z.string().min(10, "パスワードは10文字以上にしてください").max(72),
});

/**
 * 会社を追加する。会社と同時に、その会社の管理者アカウントを1つ作り、
 * システム標準テンプレートの制度（等級・KPI・ランク基準・配点・昇給ルール）を丸ごと複製する。
 * 複製後は会社ごとに自由に書き換えられる（テンプレート側は変わらない）。
 *
 * 3段に分けて書き、途中で失敗したら書いた分を逆順に消す（D-003）。
 * ひな形の複製は数百行になりうるので、1回の batch には収めない。
 */
export async function createCompany(raw: unknown) {
  return runAction({ role: "SUPER_ADMIN", input: createSchema }, raw, async ({ viewer, input }) => {
    const db = await getDb();

    const dupSlug = await db.select({ id: s.companies.id }).from(s.companies).where(eq(s.companies.slug, input.slug)).limit(1);
    if (dupSlug.length > 0) throw new HttpError(400, "この会社IDはすでに使われています。別の文字にしてください。");
    const email = input.adminEmail.trim().toLowerCase();
    await assertEmailAvailable(db, email);

    const template = await findTemplateCompany(db);
    const companyId = newId("co");
    const userId = crypto.randomUUID();
    const credential = await prepareCredential(db, { userId, password: input.adminPassword, issuedBy: viewer.id });

    const copied = await withCompensation("company.create", { companyId, userId }, async (step) => {
      await step(
        "company",
        () =>
          db.insert(s.companies).values({
            id: companyId,
            name: input.name,
            slug: input.slug,
            businessType: input.businessType?.trim() || "給付事業",
            isActive: true,
            templateSourceId: template?.id ?? null,
          }),
        // 複製の途中で止まったときは、複製の取り消しが登録されていない。会社を消す前に必ず掃除する
        async () => {
          await deleteCompanyMasters(db, companyId);
          await db.delete(s.companies).where(eq(s.companies.id, companyId));
        },
      );

      // 制度のひな形を複製する（ひな形が無いときは空のまま作り、その旨を返す）
      const counts = template
        ? await step(
            "masters",
            () => copyCompanyMasters(db, template.id, companyId),
            () => deleteCompanyMasters(db, companyId),
          )
        : null;

      // 管理者・ログイン用アカウント・控えは1つの batch で書く（どれか1つだけが残らない）
      await step(
        "admin",
        () =>
          db.batch([
            db.insert(s.users).values({
              id: userId,
              name: input.adminName,
              email,
              emailVerified: true,
              companyId,
              role: "COMPANY_ADMIN",
              isActive: true,
              mustChangePassword: true,
            }),
            db.insert(s.accounts).values({
              id: newId("acc"),
              accountId: userId,
              providerId: "credential",
              userId,
              password: credential.hashed,
            }),
            ...credential.memo,
          ]),
        // アカウントと控えは利用者の削除に連なって消える
        () => db.delete(s.users).where(eq(s.users.id, userId)),
      );
      return counts;
    });

    const notice = memoNotice(credential.stored);
    return {
      id: companyId,
      copied,
      // 控えを残せたか（値そのものは返さない）。残せなかったときだけ、画面は発行した値を開いたままにする
      memoStored: credential.stored,
      message: copied
        ? `${input.name}を追加し、管理者アカウントを作りました。${notice}` +
          `標準の制度（等級${copied["等級"]}件・KPI項目${copied["KPI項目"]}件・ランク基準${copied["ランク基準"]}件・昇給額${copied["昇給額"]}件ほか）を写してあります。` +
          `内容はこの会社だけ変更できます。場所は「等級の設定」「昇格の条件・要件」「行動指針」「KPI・評価セット」です。`
        : `${input.name}を追加し、管理者アカウントを作りました。${notice}標準の制度が登録されていません。制度（等級・KPI・配点）は管理者の画面から登録してください。`,
    };
  });
}

const patchSchema = z.object({
  companyId: z.string().min(1),
  name: z.string().trim().min(1).max(60).optional(),
  businessType: z.string().max(40).nullable().optional(),
  isActive: z.boolean().optional(),
});

/** 会社の情報変更・利用停止。データは消さず停止で扱う。 */
export async function updateCompany(raw: unknown) {
  return runAction({ role: "SUPER_ADMIN", input: patchSchema }, raw, async ({ input }) => {
    const db = await getDb();

    const co = (await db.select().from(s.companies).where(eq(s.companies.id, input.companyId)).limit(1))[0];
    if (!co) throw new HttpError(404, "会社が見つかりませんでした。");

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.businessType !== undefined) patch.businessType = input.businessType?.trim() || co.businessType;
    if (input.isActive !== undefined) patch.isActive = input.isActive;
    if (Object.keys(patch).length === 0) return { message: "変更はありませんでした。" };

    if (input.isActive === false) {
      // 会社を止めたら、その会社の利用者もログインできない状態にする。
      // 会社だけ止まって利用者が残る（またはその逆の）状態を作らないよう、1つの batch で書く
      await db.batch([
        db.update(s.companies).set(patch).where(eq(s.companies.id, co.id)),
        db.update(s.users).set({ isActive: false }).where(eq(s.users.companyId, co.id)),
      ]);
    } else {
      await db.update(s.companies).set(patch).where(eq(s.companies.id, co.id));
    }

    return {
      message:
        input.isActive === false
          ? `${co.name}を利用停止にしました。データは残っています。再開すると社員の再有効化が必要です。`
          : input.isActive === true
            ? `${co.name}の利用を再開しました。社員は個別に再有効化してください。`
            : "会社の情報を保存しました。",
    };
  });
}
