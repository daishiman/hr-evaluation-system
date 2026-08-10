import { z } from "zod";
import { apiViewer, HttpError, resolveCompanyId } from "@/lib/session";
import { handle } from "@/lib/api";
import { importMembersCsv } from "@/lib/import";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  companyId: z.string().min(1).optional(),
  /** スプレッドシートからコピーした社員一覧（CSV／タブ区切り） */
  csv: z.string().min(1, "取り込む内容を貼り付けてください").max(2_000_000),
  /** 新しく登録する方に設定する最初のパスワード */
  initialPassword: z.string().min(8, "最初のパスワードは8文字以上にしてください").max(72).optional(),
  /** true のときは保存せず、結果の見込みだけを返す */
  dryRun: z.boolean().optional(),
});

/**
 * 社員一覧をまとめて取り込む。会社の管理者だけが使える。
 *
 * メールアドレスが同じ方はすでにいる方として更新し、いない方はアカウントを作る。
 * 不備のある行はその行だけ理由つきで止め、揃っている行は取り込む。
 */
export async function POST(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("COMPANY_ADMIN");
    const body = bodySchema.parse(await req.json());
    const companyId = resolveCompanyId(viewer, body.companyId);
    if (!companyId) throw new HttpError(400, "会社を指定してください。");

    const result = await importMembersCsv(companyId, body.csv, {
      dryRun: body.dryRun === true,
      initialPassword: body.initialPassword,
    });

    const notes: string[] = [];
    if (result.unmatchedHeaders.length > 0) {
      notes.push(`見出しの意味が分からなかった列が${result.unmatchedHeaders.length}件あります（例：${result.unmatchedHeaders[0]}）。これらは読み飛ばしました。`);
    }

    const message = result.dryRun
      ? `取り込むとどうなるかの確認です（まだ保存していません）。新しく作る方${result.created}人、情報を更新する方${result.updated}人。` +
        (result.failed > 0 ? `${result.failed}行は取り込めません（理由は下の一覧をご確認ください）。` : "") +
        notes.join("")
      : `${result.created}人を新しく登録し、${result.updated}人の情報を更新しました。` +
        (result.failed > 0 ? `${result.failed}行は取り込めませんでした（理由は下の一覧をご確認ください）。` : "") +
        notes.join("");

    return { ...result, message };
  });
}
