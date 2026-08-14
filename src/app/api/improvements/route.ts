import { z } from "zod";
import { getDb } from "@/lib/db";
import { apiViewer, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";
import {
  IMPROVEMENT_BODY_MAX,
  isAcceptableShot,
  normalizeImprovementBody,
  shotBytesOf,
} from "@/lib/domain/improvement";
import { routeIdentityOf } from "@/lib/nav";
import { readJsonBodyWithinLimit } from "@/lib/request-body";
import { findImprovementBySubmission, saveImprovementRequest } from "@/lib/improvement-write";
import { consumeRateLimit, IMPROVEMENT_SUBMIT_RATE_LIMIT } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export const IMPROVEMENT_REQUEST_MAX_BYTES = 960_000;

const bodySchema = z.object({
  path: z.string().min(1).max(300).refine((value) => value.startsWith("/") && !value.startsWith("//"), {
    message: "画面のパスを確認してください",
  }),
  body: z.string().min(1, "改善したいことを入力してください").max(IMPROVEMENT_BODY_MAX),
  viewport: z.string().regex(/^\d{2,5}×\d{2,5}$/).nullish(),
  shot: z.string().nullish(),
  submissionKey: z.string().uuid(),
}).strict();

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

    const input = bodySchema.parse(await readJsonBodyWithinLimit(req, IMPROVEMENT_REQUEST_MAX_BYTES));
    const body = normalizeImprovementBody(input.body);
    if (!body) throw new HttpError(400, "改善したいことを入力してください。");

    // クエリと URL 断片は落とす。個人名や検索語が要望に紛れ込むのを防ぐ。
    const route = routeIdentityOf(input.path);

    const db = await getDb();
    const existing = await findImprovementBySubmission(db, viewer.companyId, viewer.id, input.submissionKey);
    if (existing) return { id: existing, message: "この改善要望は送信済みです。" };

    const limited = consumeRateLimit(`improvement-submit:${viewer.id}`, IMPROVEMENT_SUBMIT_RATE_LIMIT);
    if (!limited.allowed) {
      throw new HttpError(
        429,
        `送信が続いています。入力内容は残っています。${limited.retryAfterSeconds}秒後にもう一度お試しください。`,
        { "Retry-After": String(limited.retryAfterSeconds) },
      );
    }

    if (input.shot && !isAcceptableShot(input.shot)) {
      throw new HttpError(400, "画像を受け取れませんでした。撮り直してお試しください。");
    }

    let id: string;
    try {
      id = await saveImprovementRequest(db, {
        companyId: viewer.companyId,
        reporterId: viewer.id,
        submissionKey: input.submissionKey,
        path: route.path,
        routePattern: route.routePattern,
        screenLabel: route.label,
        body,
        viewport: input.viewport ?? null,
        userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
        shot: input.shot ?? null,
        shotBytes: input.shot ? shotBytesOf(input.shot) : 0,
      });
    } catch {
      // D1の例外には画像のbound valueが含まれ得るため、そのままログへ渡さない。
      throw new HttpError(500, "保存できませんでした。入力内容は残っています。時間をおいてもう一度お試しください。");
    }

    return { id, message: "改善要望を送りました。ありがとうございます。" };
  });
}
