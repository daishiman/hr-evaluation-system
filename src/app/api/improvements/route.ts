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
import {
  diagnosticsLevelFor,
  IMPROVEMENT_EXPECTED_MAX,
  IMPROVEMENT_KINDS,
  normalizeDiagnostics,
  serializeDiagnostics,
} from "@/lib/domain/improvement-issue";
import { routeIdentityOf } from "@/lib/nav";
import { readJsonBodyWithinLimit } from "@/lib/request-body";
import { findImprovementBySubmission, saveImprovementRequest } from "@/lib/improvement-write";
import { consumeRateLimit, IMPROVEMENT_SUBMIT_RATE_LIMIT } from "@/lib/rate-limit";
import { requireGithubSettings, type GithubIssueSettings } from "@/lib/github-issue";
import { syncImprovementIssue } from "@/lib/improvement-issue-sync";
import { applyDisposition } from "@/lib/improvement-disposition";
import { DISPOSITION_ACTIONS } from "@/lib/domain/improvement-disposition";

/** 記録票の設定。未設定なら null（落とす・戻す操作はそれでも進める）。 */
async function githubSettingsIfReady(): Promise<GithubIssueSettings | null> {
  try {
    return await requireGithubSettings();
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

export const IMPROVEMENT_REQUEST_MAX_BYTES = 960_000;

const bodySchema = z.object({
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
        kind: input.kind,
        expected: input.expected?.trim() || null,
        // 技術情報が大きすぎたり壊れていたりしても、要望そのものは必ず保存する。
        // 種類ごとの収集量はここで決め直す。送信側が「全部集めた」と名乗っても、
        // 新機能の要望に通信の中身が付いてくることはない（判断はサーバーが正本）。
        diagnostics: input.diagnostics
          ? serializeDiagnostics(normalizeDiagnostics(input.diagnostics, diagnosticsLevelFor(input.kind)))
          : null,
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

const syncSchema = z
  .object({
    id: z.string().min(1).max(60),
    /** 既定は記録票への反映。落とす・戻す操作は action で選ぶ。 */
    action: z.enum(["sync", ...DISPOSITION_ACTIONS]).default("sync"),
    reasonCode: z.string().max(40).default(""),
    reasonNote: z.string().max(1000).default(""),
    closeIssue: z.boolean().default(false),
    duplicateOfId: z.string().max(60).nullish(),
  })
  .strict();

/**
 * 選んだ要望1件を、開発の記録票（GitHub Issue）へ反映する。
 *
 * 一覧の一括送信は、画面がこの入口を**1件ずつ順番に**呼ぶ。まとめて1回で
 * 送らないのは3つの理由から。
 *  ・どこまで進んだかを件数で見せられる（50件を無言で待たせない）
 *  ・成功した分はその時点で確定し、失敗した行だけ送り直せる
 *  ・GitHub を一度に叩かない（並べて投げると受付上限で断られる）
 *
 * できるのはシステム全体管理者だけ。画面側でボタンを隠すだけにしない。
 * 記録票の置き場所は会社ごとではなく開発側のリポジトリなので、
 * 会社の管理者が押せると「自社の中の操作」のつもりで社外へ文章が出る。
 *
 * 入口を増やさず PUT として同居させている（道を1本増やすと、同じ依存一式を
 * 束ねた塊が配布物に増え、無料枠の上限まで約0.5MB食う）。
 */
export async function PUT(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("SUPER_ADMIN");
    if (!viewer.companyId) throw new HttpError(400, "操作する会社が選ばれていません。");

    const input = syncSchema.parse(await readJsonBodyWithinLimit(req, 4_000));
    const actor = { id: viewer.id, companyId: viewer.companyId };

    if (input.action !== "sync") {
      // 落とす・戻すはアプリの中だけで完結できる。記録票の設定が無くても止めない
      // （設定不足で要望を1件も片付けられない状態を作らない）。
      const settings = await githubSettingsIfReady();
      const result = await applyDisposition(settings, actor, input.id, {
        action: input.action,
        reasonCode: input.reasonCode,
        reasonNote: input.reasonNote,
        closeIssue: input.closeIssue,
        duplicateOfId: input.duplicateOfId ?? null,
      });
      return { result };
    }

    const settings = await requireGithubSettings();
    const result = await syncImprovementIssue(settings, actor, input.id);

    // 1件ごとの失敗は、この入口では成功として返す（結果の表に行として並ぶ）。
    // ここで例外にすると、続きの行が送られないまま画面が止まる。
    return { result };
  });
}
