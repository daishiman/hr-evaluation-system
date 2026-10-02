"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { runRead } from "@/lib/action";
import {
  isMemoExpired,
  loadVaultKey,
  MEMO_TTL_DAYS,
  memoExpiresAt,
  openMemo,
  readMemo,
} from "@/lib/credential-vault";
import { getDb, schema as s } from "@/lib/db";
import { HttpError } from "@/lib/session";

/**
 * 初期パスワードの控えを開く（会社の管理者・システム全体管理者）。
 *
 * 一覧の行の「控えを見る」を押した人にだけ、押したときに返す。
 * 画面を開いた時点では渡さない（ページの中身やキャッシュに平文を残さないため）。
 * 何も変えないので runRead（画面は描き直さない・他のタブへも知らせない）。
 *
 * 開けるのは、システム全体管理者と、同じ会社の管理者だけ。
 * 他社の人の ID を送られても、控えの有無が分からない言い方で断る。
 * 発行から14日を過ぎた控えは開けない（表から消すのは次の発行の batch。ここは読むだけ）。
 */

const inputSchema = z.object({ userId: z.string().min(1) });

const NOT_FOUND = "この方の控えはありません。";
const EXPIRED = `発行から${MEMO_TTL_DAYS}日を過ぎたため開けません。再発行してください。`;

export async function revealCredentialMemo(raw: unknown) {
  return runRead({ role: "COMPANY_ADMIN", input: inputSchema }, raw, async ({ viewer, input }) => {
    const db = await getDb();
    const target = (
      await db
        .select({ id: s.users.id, companyId: s.users.companyId })
        .from(s.users)
        .where(eq(s.users.id, input.userId))
        .limit(1)
    )[0];
    // 他社の人は「いない」と同じ扱いにする（控えがあるかどうかも漏らさない）
    if (!target || (viewer.role !== "SUPER_ADMIN" && target.companyId !== viewer.companyId)) {
      throw new HttpError(404, NOT_FOUND);
    }

    // 本人がパスワードを変えると控えは消える（src/actions/account.ts）
    const memo = await readMemo(db, target.id);
    if (!memo) throw new HttpError(404, `${NOT_FOUND}ご本人が変更済みの可能性があります。`);
    // 鍵を読む前に断る。期限切れの控えは、鍵があっても開けない
    if (isMemoExpired(memo.issuedAt)) throw new HttpError(410, EXPIRED);

    const vault = await loadVaultKey();
    if (!vault) throw new HttpError(503, "控えを開く鍵が設定されていません。");
    const opened = await openMemo(vault, target.id, memo);
    if (!opened.ok) {
      throw new HttpError(
        409,
        opened.reason === "key-changed"
          ? "鍵が入れ替わったため開けません。再発行してください。"
          : "控えが壊れているため開けません。再発行してください。",
      );
    }

    // 誰が誰の控えを開いたかを運用の記録に残す（値そのものは書かない）
    console.info(
      JSON.stringify({
        event: "credential_memo_revealed",
        actorId: viewer.id,
        targetUserId: target.id,
        companyId: target.companyId,
      }),
    );

    return {
      password: opened.password,
      issuedAt: memo.issuedAt.toISOString(),
      expiresAt: memoExpiresAt(memo.issuedAt).toISOString(),
      message: "控えを開きました。ご本人へ安全な方法でお伝えください。",
    };
  });
}
