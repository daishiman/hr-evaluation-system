"use server";

import { z } from "zod";
import { runAction, runRead } from "@/lib/action";
import { loadVaultKey, memoNotice } from "@/lib/credential-vault";
import { IMPORT_MAX_BYTES, IMPORT_TOO_LARGE_MESSAGE, importMembersCsv } from "@/lib/import";
import { requireTargetCompany } from "@/lib/session";

/**
 * 社員一覧のまとめ取り込み（会社の管理者のみ）。
 *
 * メールアドレスが同じ方はすでにいる方として更新し、いない方はアカウントを作る。
 * 先に全行を確認し、不備が1行でもあればファイル全体を保存しない。
 *
 * 「まず内容を確認する」は何も保存しないので runRead（画面を描き直さない）、
 * 「この内容を取り込む」は runAction（成功したら社員一覧ごと描き直す）に分ける。
 */

const inputSchema = z.object({
  companyId: z.string().min(1).optional(),
  /** スプレッドシートからコピーした社員一覧（CSV／タブ区切り） */
  csv: z.string().min(1, "取り込む内容を貼り付けてください").max(2_000_000),
});

/** 保存せず、取り込むとどうなるかだけを返す。 */
export async function previewMembersImport(raw: unknown) {
  return runRead(
    { role: "COMPANY_ADMIN", input: inputSchema, maxBytes: IMPORT_MAX_BYTES, tooLargeMessage: IMPORT_TOO_LARGE_MESSAGE },
    raw,
    async ({ viewer, input }) => {
      const result = await importMembersCsv(requireTargetCompany(viewer, input.companyId), input.csv, {
        dryRun: true,
        actorId: viewer.id,
      });
      return {
        ...result,
        message:
          `取り込むとどうなるかの確認です（まだ保存していません）。新しく作る方${result.created}人、情報を更新する方${result.updated}人。` +
          (result.failed > 0 ? `${result.failed}行に修正が必要です。本取込ではファイル全体を保存しません。` : "") +
          headerNotes(result.unmatchedHeaders),
      };
    },
  );
}

/** 取り込んで保存する。新しく作った方の仮パスワードは、暗号化した控えも残す。 */
export async function importMembers(raw: unknown) {
  return runAction(
    { role: "COMPANY_ADMIN", input: inputSchema, maxBytes: IMPORT_MAX_BYTES, tooLargeMessage: IMPORT_TOO_LARGE_MESSAGE },
    raw,
    async ({ viewer, input }) => {
      const result = await importMembersCsv(requireTargetCompany(viewer, input.companyId), input.csv, {
        dryRun: false,
        actorId: viewer.id,
        vault: await loadVaultKey(),
      });
      // 不備が1行でもあれば importMembersCsv が 409 で断るので、ここに来るのは全行を保存できたときだけ
      return {
        ...result,
        message:
          `${result.created}人を新しく登録し、${result.updated}人の情報を更新しました。` +
          (result.created > 0 ? memoNotice(result.memoStored) : "") +
          headerNotes(result.unmatchedHeaders),
      };
    },
  );
}

function headerNotes(unmatched: string[]): string {
  if (unmatched.length === 0) return "";
  return `見出しの意味が分からなかった列が${unmatched.length}件あります（例：${unmatched[0]}）。これらは読み飛ばしました。`;
}
