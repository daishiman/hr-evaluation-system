import { z } from "zod";
import { apiViewer, HttpError, resolveCompanyId } from "@/lib/session";
import { handle } from "@/lib/api";
import { importResponsesCsv } from "@/lib/import";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  formId: z.string().min(1),
  companyId: z.string().min(1).optional(),
  /** スプレッドシートからコピーした回答一覧（CSV／タブ区切り） */
  csv: z.string().min(1, "取り込む内容を貼り付けてください").max(2_000_000),
  /** true のときは保存せず、取り込んだ場合の結果だけを返す */
  dryRun: z.boolean().optional(),
});

/**
 * 回答一覧（Googleフォームの書き出し）をまとめて取り込む。
 * 会社の管理者だけが使える。取り込めなかった行は理由つきで返す。
 */
export async function POST(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("COMPANY_ADMIN");
    const body = bodySchema.parse(await req.json());
    const companyId = resolveCompanyId(viewer, body.companyId);
    if (!companyId) throw new HttpError(400, "会社を指定してください。");

    const result = await importResponsesCsv(companyId, body.formId, body.csv, { dryRun: body.dryRun === true });

    const notes: string[] = [];
    if (result.unmatchedHeaders.length > 0) {
      notes.push(`設問に結びつかなかった列が${result.unmatchedHeaders.length}件あります（例：${result.unmatchedHeaders[0]}）。これらは取り込んでいません。`);
    }
    const unreadable = result.rows.filter((r) => r.unreadable && r.unreadable.length > 0).length;
    if (unreadable > 0) {
      notes.push(`${unreadable}人ぶんに、受け付けられない値がありました（選択肢と一致しない・桁が多すぎる・整数でない など）。その設問は点数に反映されていません。何行目の何がなぜ受け付けられなかったかは、下の一覧をご確認ください。`);
    }
    if (result.dryRun) {
      return {
        ...result,
        message:
          `取り込むとどうなるかの確認です（まだ保存していません）。${result.imported}件を取り込めます。` +
          (result.skipped > 0 ? `${result.skipped}件は取り込めません（理由は下の一覧をご確認ください）。` : "") +
          notes.join(""),
      };
    }

    return {
      ...result,
      message:
        `${result.imported}件を取り込みました。` +
        (result.skipped > 0 ? `${result.skipped}件は取り込めませんでした（理由は下の一覧をご確認ください）。` : "") +
        (notes.length > 0 ? notes.join("") : ""),
    };
  });
}
