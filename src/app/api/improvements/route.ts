import { z } from "zod";
import { getDb, schema as s } from "@/lib/db";
import { apiViewer, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";
import { newId } from "@/lib/id";
import {
  IMPROVEMENT_BODY_MAX,
  isAcceptableShot,
  normalizeImprovementBody,
  shotBytesOf,
} from "@/lib/domain/improvement";
import { routeMetaOf } from "@/lib/nav";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  path: z.string().min(1).max(300),
  body: z.string().min(1, "改善したいことを入力してください").max(IMPROVEMENT_BODY_MAX + 100),
  viewport: z.string().max(40).nullish(),
  shot: z.string().nullish(),
});

/**
 * 改善要望を受け取る。
 *
 * ・どの画面から届いたかは path から引き当てる（送信側の名乗りを信じない）
 * ・会社は必ずセッションから決める（本文の company 指定は受け付けない）
 * ・画像は形式と大きさをここでも確かめる（ブラウザ側の縮小に頼らない）
 */
export async function POST(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("EMPLOYEE");
    if (!viewer.companyId) throw new HttpError(400, "所属会社が設定されていません。");

    const input = bodySchema.parse(await req.json());
    const body = normalizeImprovementBody(input.body);
    if (!body) throw new HttpError(400, "改善したいことを入力してください。");

    // クエリと URL 断片は落とす。個人名や検索語が要望に紛れ込むのを防ぐ。
    const path = input.path.split(/[?#]/)[0];
    const screenLabel = routeMetaOf(path)?.label ?? "その他の画面";

    if (input.shot && !isAcceptableShot(input.shot)) {
      throw new HttpError(400, "画像を受け取れませんでした。撮り直してお試しください。");
    }

    const db = await getDb();
    const id = newId("improve");
    await db.insert(s.improvementRequests).values({
      id,
      companyId: viewer.companyId,
      reporterId: viewer.id,
      path,
      screenLabel,
      body,
      viewport: input.viewport ?? null,
      userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
      status: "open",
    });

    if (input.shot) {
      await db.insert(s.improvementShots).values({
        requestId: id,
        dataUrl: input.shot,
        bytes: shotBytesOf(input.shot),
      });
    }

    return { id, message: "改善要望を送りました。ありがとうございます。" };
  });
}
