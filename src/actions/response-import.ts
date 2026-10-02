"use server";

import { z } from "zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { runAction, runRead } from "@/lib/action";
import { HttpError, requireTargetCompany } from "@/lib/session";
import { IMPORT_MAX_BYTES, IMPORT_TOO_LARGE_MESSAGE, importResponsesCsv, type ImportResult } from "@/lib/import";
import { issueImportConfirmation, verifyImportConfirmation } from "@/lib/domain/import-confirmation";

/**
 * 回答一覧（Googleフォームの書き出し）をまとめて取り込む（会社の管理者のみ）。
 * 全行を事前確認し、1行でも不正なら全体を保存しない。
 *
 * 「まず内容を確認する」は何も保存しないので runRead（画面を描き直さない）、
 * 「この内容で取り込む」は runAction（成功したら回答一覧ごと描き直す）に分ける。
 */

const previewSchema = z.object({
  formId: z.string().min(1),
  companyId: z.string().min(1).optional(),
  /** スプレッドシートからコピーした回答一覧（CSV／タブ区切り） */
  csv: z.string().min(1, "取り込む内容を貼り付けてください").max(2_000_000),
});

const importSchema = previewSchema.extend({
  /** 確認で同じ内容を見たことを示す、サーバー署名済みトークン */
  confirmationToken: z.string().min(1).optional(),
});

/** 保存せず、取り込むとどうなるかと、本取込に使う確認トークンを返す。 */
export async function previewResponsesImport(raw: unknown) {
  return runRead(
    { role: "COMPANY_ADMIN", input: previewSchema, maxBytes: IMPORT_MAX_BYTES, tooLargeMessage: IMPORT_TOO_LARGE_MESSAGE },
    raw,
    async ({ viewer, input }) => {
      const companyId = requireTargetCompany(viewer, input.companyId);
      const secret = await importSecret();
      const result = await importResponsesCsv(companyId, input.formId, input.csv, {
        dryRun: true,
        actorId: viewer.id,
      });
      return {
        ...result,
        confirmationToken: await issueImportConfirmation(secret, input.formId, input.csv),
        message:
          `取り込むとどうなるかの確認です（まだ保存していません）。${result.imported}件を取り込めます。` +
          (result.skipped > 0 ? `${result.skipped}件に修正が必要です。本取込ではファイル全体を保存しません。` : "") +
          resultNotes(result),
      };
    },
  );
}

/** 確認済みの内容を取り込んで保存する。 */
export async function importResponses(raw: unknown) {
  return runAction(
    { role: "COMPANY_ADMIN", input: importSchema, maxBytes: IMPORT_MAX_BYTES, tooLargeMessage: IMPORT_TOO_LARGE_MESSAGE },
    raw,
    async ({ viewer, input }) => {
      const companyId = requireTargetCompany(viewer, input.companyId);
      const secret = await importSecret();
      if (
        !input.confirmationToken ||
        !(await verifyImportConfirmation(secret, input.confirmationToken, input.formId, input.csv))
      ) {
        throw new HttpError(409, "取り込む前に、同じ内容で「まず内容を確認する」を実行してください。");
      }

      const result = await importResponsesCsv(companyId, input.formId, input.csv, {
        dryRun: false,
        actorId: viewer.id,
      });
      // 不備が1行でもあれば importResponsesCsv が 409 で断るので、ここに来るのは全行を保存できたときだけ
      return { ...result, message: `${result.imported}件を取り込みました。` + resultNotes(result) };
    },
  );
}

async function importSecret(): Promise<string> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.BETTER_AUTH_SECRET) throw new Error("BETTER_AUTH_SECRET が設定されていません。");
  return env.BETTER_AUTH_SECRET;
}

function resultNotes(result: ImportResult): string {
  const notes: string[] = [];
  if (result.unmatchedHeaders.length > 0) {
    notes.push(`設問に結びつかなかった列が${result.unmatchedHeaders.length}件あります（例：${result.unmatchedHeaders[0]}）。これらは取り込んでいません。`);
  }
  const unreadable = result.rows.filter((r) => r.unreadable && r.unreadable.length > 0).length;
  if (unreadable > 0) {
    notes.push(`${unreadable}人ぶんに、受け付けられない値がありました。選択肢と一致しない・桁が多すぎる・整数でない、などです。その設問は点数に反映されていません。何行目の何がなぜ受け付けられなかったかは、下の一覧をご確認ください。`);
  }
  return notes.join("");
}
