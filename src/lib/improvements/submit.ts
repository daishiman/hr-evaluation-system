/**
 * 改善要望を受け取って保存する。
 *
 * 入口は2つあり、どちらもここを通る。
 *  - 画面の「改善要望を送る」（Server Action: src/actions/improvements.ts）
 *  - 公開前の確かめ（scripts/verify-improvement-preview.mjs が POST /api/improvements を呼ぶ）
 * 入口ごとに書くと、片方だけ画像の検査や回数の制限が抜ける。
 *
 * ・どの画面から届いたかは path から引き当てる（送信側の名乗りを信じない）
 * ・会社は必ずセッションから決める（本文の company 指定は受け付けない）
 * ・画像は形式と大きさをここでも確かめる（ブラウザ側の縮小に頼らない）
 */

import { z } from "zod";
import { getDb } from "@/lib/db";
import { assertCompanyChosen, HttpError } from "@/lib/session";
import {
  IMPROVEMENT_BODY_MAX,
  isAcceptableShot,
  normalizeImprovementBody,
  shotBytesOf,
} from "@/lib/domain/improvement";
import {
  diagnosticsLevelFor,
  IMPROVEMENT_EXPECTED_MAX,
  IMPROVEMENT_KINDS,
  normalizeDiagnostics,
  serializeDiagnostics,
} from "@/lib/domain/improvement-instruction";
import { routeIdentityOf } from "@/lib/nav";
import { findImprovementBySubmission, saveImprovementRequest } from "@/lib/improvement-write";
import { consumeRateLimit, IMPROVEMENT_SUBMIT_RATE_LIMIT } from "@/lib/rate-limit";

export const improvementSubmitSchema = z
  .object({
    path: z.string().min(1).max(300).refine((value) => value.startsWith("/") && !value.startsWith("//"), {
      message: "画面のパスを確認してください",
    }),
    body: z.string().min(1, "改善したいことを入力してください").max(IMPROVEMENT_BODY_MAX),
    kind: z.enum(IMPROVEMENT_KINDS),
    expected: z.string().max(IMPROVEMENT_EXPECTED_MAX).nullish(),
    /** 形は信用せず、中身は normalizeDiagnostics で切り直す（ここでは器だけ確かめる）。 */
    diagnostics: z.record(z.string(), z.unknown()).nullish(),
    viewport: z.string().regex(/^\d{2,5}×\d{2,5}$/).nullish(),
    shot: z.string().nullish(),
    submissionKey: z.string().uuid(),
  })
  .strict();

export type ImprovementSubmitInput = z.output<typeof improvementSubmitSchema>;

export interface Reporter {
  id: string;
  companyId: string;
}

/** 送った人と、その人の会社。会社が無い人からは受け取らない。 */
export function reporterOf(viewer: { id: string; companyId: string | null }): Reporter {
  assertCompanyChosen(viewer);
  return { id: viewer.id, companyId: viewer.companyId };
}

/** 改善要望を1件保存する。同じ送信の繰り返しは、前の1件を返すだけにする。 */
export async function submitImprovement(
  reporter: Reporter,
  input: ImprovementSubmitInput,
  userAgent: string | null,
): Promise<{ id: string; message: string }> {
  const body = normalizeImprovementBody(input.body);
  if (!body) throw new HttpError(400, "改善したいことを入力してください。");

  // クエリと URL 断片は落とす。個人名や検索語が要望に紛れ込むのを防ぐ。
  const route = routeIdentityOf(input.path);

  const db = await getDb();
  const existing = await findImprovementBySubmission(db, reporter.companyId, reporter.id, input.submissionKey);
  if (existing) return { id: existing, message: "この改善要望は送信済みです。" };

  const limited = consumeRateLimit(`improvement-submit:${reporter.id}`, IMPROVEMENT_SUBMIT_RATE_LIMIT);
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
      companyId: reporter.companyId,
      reporterId: reporter.id,
      submissionKey: input.submissionKey,
      path: route.path,
      routePattern: route.routePattern,
      screenLabel: route.label,
      body,
      kind: input.kind,
      expected: input.expected?.trim() || null,
      // 技術情報が大きすぎたり壊れていたりしても、要望そのものは必ず保存する。
      // 種類ごとの収集量はここで決め直す。送信側が「全部集めた」と名乗っても、
      // 新機能の要望に通信の中身が付いてくることはない（判断はサーバーが正本）。
      diagnostics: input.diagnostics
        ? serializeDiagnostics(normalizeDiagnostics(input.diagnostics, diagnosticsLevelFor(input.kind)))
        : null,
      viewport: input.viewport ?? null,
      userAgent: userAgent?.slice(0, 300) ?? null,
      shot: input.shot ?? null,
      shotBytes: input.shot ? shotBytesOf(input.shot) : 0,
    });
  } catch {
    // D1の例外には画像のbound valueが含まれ得るため、そのままログへ渡さない。
    throw new HttpError(500, "保存できませんでした。入力内容は残っています。時間をおいてもう一度お試しください。");
  }

  return { id, message: "改善要望を送りました。ありがとうございます。" };
}
