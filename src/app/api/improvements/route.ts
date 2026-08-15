import { z } from "zod";
import { getDb } from "@/lib/db";
import { apiViewer, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";
import {
  IMPROVEMENT_BODY_MAX,
  IMPROVEMENT_REQUEST_MAX_BYTES,
  improvementStatusLabel,
  isAcceptableShot,
  normalizeImprovementBody,
  shotBytesOf,
} from "@/lib/domain/improvement";
import {
  diagnosticsLevelFor,
  IMPROVEMENT_EXPECTED_MAX,
  IMPROVEMENT_KINDS,
  improvementKindLabel,
  normalizeDiagnostics,
  serializeDiagnostics,
} from "@/lib/domain/improvement-instruction";
import { routeIdentityOf } from "@/lib/nav";
import { readJsonBodyWithinLimit } from "@/lib/request-body";
import { findImprovementBySubmission, saveImprovementRequest } from "@/lib/improvement-write";
import { consumeRateLimit, IMPROVEMENT_SUBMIT_RATE_LIMIT } from "@/lib/rate-limit";
import { getImprovementsForAgent, listImprovementsForAgent } from "@/lib/queries";
import { appOrigin } from "@/lib/origin";
import { guardAgentRequest, type AgentCaller } from "@/lib/agent-api";
import {
  AGENT_BULK_MAX,
  AGENT_LIST_MAX,
  agentFetchCommand,
  agentFormat,
  parseAgentIds,
  type AgentFormat,
} from "@/lib/domain/agent-api";
import {
  buildBulkImprovementInstruction,
  buildImprovementInstruction,
} from "@/lib/improvement-instruction-draft";
import { handOutImprovement, recordHandout } from "@/lib/improvement-handout-write";
import { applyDisposition } from "@/lib/improvement-disposition";
import { DISPOSITION_ACTIONS } from "@/lib/domain/improvement-disposition";

export const dynamic = "force-dynamic";

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


const disposeSchema = z
  .object({
    id: z.string().min(1).max(60),
    /** 既定は指示文の払い出し。落とす・戻す操作は action で選ぶ。 */
    action: z.enum(["handout", ...DISPOSITION_ACTIONS]).default("handout"),
    reasonCode: z.string().max(40).default(""),
    reasonNote: z.string().max(1000).default(""),
    duplicateOfId: z.string().max(60).nullish(),
  })
  .strict();

/**
 * 選んだ要望1件を払い出し済みにする、または落とす・戻す。
 *
 * 一覧のまとめ操作は、画面がこの入口を**1件ずつ順番に**呼ぶ。まとめて1回で
 * 送らないのは2つの理由から。
 *  ・どこまで進んだかを件数で見せられる（50件を無言で待たせない）
 *  ・成功した分はその時点で確定し、失敗した行だけやり直せる
 *
 * できるのはシステム全体管理者だけ。画面側でボタンを隠すだけにしない。
 *
 * 入口を増やさず PUT として同居させている（道を1本増やすと、同じ依存一式を
 * 束ねた塊が配布物に増え、無料枠の上限まで約0.5MB食う）。
 */
export async function PUT(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("SUPER_ADMIN");
    if (!viewer.companyId) throw new HttpError(400, "操作する会社が選ばれていません。");

    const input = disposeSchema.parse(await readJsonBodyWithinLimit(req, 4_000));
    const actor = { id: viewer.id, companyId: viewer.companyId };

    if (input.action === "handout") return { result: await handOutImprovement(actor, input.id) };

    // 1件ごとの失敗は、この入口では成功として返す（結果の表に行として並ぶ）。
    // ここで例外にすると、続きの行が動かないまま画面が止まる。
    return {
      result: await applyDisposition(actor, input.id, {
        action: input.action,
        reasonCode: input.reasonCode,
        reasonNote: input.reasonNote,
        duplicateOfId: input.duplicateOfId ?? null,
      }),
    };
  });
}

/* ───────────────────────── 作業する側へ払い出す ───────────────────────── */

function markdown(body: string): Response {
  return new Response(body, {
    headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "no-store" },
  });
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/** 未対応の要望の一覧。中身は返さず、どれを取りにいくかを選ぶためだけに使う。 */
async function agentList(format: AgentFormat, origin: string): Promise<Response> {
  const rows = await listImprovementsForAgent(AGENT_LIST_MAX);
  if (format === "json") {
    return json({
      count: rows.length,
      items: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        kindLabel: improvementKindLabel(r.kind),
        screen: r.screenLabel,
        routePattern: r.routePattern,
        summary: r.summary,
        status: r.status,
        statusLabel: improvementStatusLabel(r.status),
        handedOut: r.handedOutAt !== null,
        company: r.companyName,
      })),
    });
  }

  const lines = [
    `# 手つかずの改善要望 ${rows.length}件`,
    ``,
    `作業指示は1件ずつ取り出します。`,
    `1件だけ：\`?id=要望ID\``,
    `まとめて：\`?ids=要望ID,要望ID\`（最大${AGENT_BULK_MAX}件）`,
    ``,
    ...(rows.length === 0
      ? ["いま渡せる要望はありません。"]
      : rows.map((r) => {
          const marks = [improvementKindLabel(r.kind), improvementStatusLabel(r.status)];
          if (r.handedOutAt) marks.push("払い出し済み");
          return `- \`${r.id}\`（${marks.join("／")}）${r.screenLabel}：${r.summary}`;
        })),
    ``,
    `## 取り出し方`,
    ``,
    `\`\`\``,
    agentFetchCommand(origin, `?id=${rows[0]?.id ?? "要望ID"}`),
    `\`\`\``,
  ];
  return markdown(lines.join("\n"));
}

/**
 * 指示文の本体を返す。
 *
 * 受け取れた時点で「渡した」ことになるので、ここで払い出しの控えを残す。
 * 画面のボタンからだけ控えを残すと、API で直接取った分が未払い出しのまま残り、
 * あとから「内容が変わったか」を見られなくなる。
 */
async function agentDocuments(
  ids: string[],
  dropped: number,
  format: AgentFormat,
  caller: AgentCaller,
): Promise<Response> {
  const items = await getImprovementsForAgent(ids);
  if (items.length === 0) {
    return markdown("# 対象の要望が見つかりません\n\n要望IDを確かめてください。\n");
  }

  const document =
    items.length === 1
      ? (await buildImprovementInstruction(items[0])).document
      : await buildBulkImprovementInstruction(items);

  const db = await getDb();
  for (const item of items) await recordHandout(db, item, { via: "api", ...caller });

  const notice = dropped > 0 ? `\n\n（一度に渡せるのは${AGENT_BULK_MAX}件までです。${dropped}件は含めていません）\n` : "\n";
  if (format === "json") {
    return json({ count: items.length, dropped, ids: items.map((i) => i.id), document });
  }
  return markdown(`${document}${notice}`);
}

/**
 * 作業する側（Claude Code）が読む入口。
 *
 * 中身には利用者の生の声と技術情報が入るので、鍵が無ければ何も返さない。
 * 判定は src/lib/agent-api.ts に寄せてあり、ここでは通ったあとだけを書く。
 */
export async function GET(req: Request) {
  const gate = await guardAgentRequest(req);
  if (gate.denied) return gate.denied;

  const url = new URL(req.url);
  const format = agentFormat(url.searchParams.get("format"), req.headers.get("accept"));
  const single = url.searchParams.get("id");
  const many = url.searchParams.get("ids");

  if (single) return agentDocuments([single], 0, format, gate.caller);
  if (many) {
    const { ids, dropped } = parseAgentIds(many);
    if (ids.length === 0) return markdown("# 要望IDがありません\n\n`?ids=` に要望IDを並べてください。\n");
    return agentDocuments(ids, dropped, format, gate.caller);
  }
  return agentList(format, await appOrigin());
}
