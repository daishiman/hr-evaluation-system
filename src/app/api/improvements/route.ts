import { z } from "zod";
import { getDb } from "@/lib/db";
import { apiViewer } from "@/lib/session";
import { API_CACHE_CONTROL, handle, SMALL_JSON_MAX_BYTES } from "@/lib/api";
import { IMPROVEMENT_REQUEST_MAX_BYTES, improvementStatusLabel } from "@/lib/domain/improvement";
import { improvementKindLabel } from "@/lib/domain/improvement-instruction";
import { readJsonBodyWithinLimit } from "@/lib/request-body";
import { improvementSubmitSchema, reporterOf, submitImprovement } from "@/lib/improvements/submit";
import { getImprovementsForAgent, listImprovementsForAgent } from "@/lib/queries";
import { appOrigin } from "@/lib/origin";
import { guardAgentRequest, type AgentCaller } from "@/lib/agent-api";
import {
  AGENT_BULK_MAX,
  AGENT_LIST_MAX,
  agentCliCommand,
  agentFetchCommand,
  agentFormat,
  parseAgentIds,
  type AgentFormat,
} from "@/lib/domain/agent-api";
import {
  buildBulkImprovementInstruction,
  buildImprovementInstruction,
} from "@/lib/improvement-instruction-draft";
import { recordHandout } from "@/lib/improvement-handout-write";
import { applyAgentResult } from "@/lib/improvement-agent-write";
import { AGENT_RESULTS } from "@/lib/domain/agent-scope";

export const dynamic = "force-dynamic";

/**
 * 改善要望を受け取る。
 *
 * 画面からの送信は Server Action（src/actions/improvements.ts の submitImprovement）を通る。
 * この入口は、公開前の確かめ（scripts/verify-improvement-preview.mjs）のために残している。
 * 中身は src/lib/improvements/submit.ts の1本で、どちらから届いても同じ検査を通る。
 *
 * 落とす・戻す・払い出す（以前の PUT）は画面からしか呼ばれないので、
 * Server Action（handOutImprovement / disposeImprovement）へ移した。
 */
export async function POST(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("EMPLOYEE");
    const reporter = reporterOf(viewer);
    const input = improvementSubmitSchema.parse(await readJsonBodyWithinLimit(req, IMPROVEMENT_REQUEST_MAX_BYTES));
    return submitImprovement(reporter, input, req.headers.get("user-agent"));
  });
}

/* ───────────────────────── 作業する側へ払い出す ───────────────────────── */

function markdown(body: string): Response {
  return new Response(body, {
    headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": API_CACHE_CONTROL },
  });
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": API_CACHE_CONTROL },
  });
}

/** 未対応の要望の一覧。中身は返さず、どれを取りにいくかを選ぶためだけに使う。 */
async function agentList(format: AgentFormat, origin: string, caller: AgentCaller): Promise<Response> {
  const rows = await listImprovementsForAgent(AGENT_LIST_MAX, caller.companyId);
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
    `1件だけ：\`pnpm improvements get 要望ID\``,
    `まとめて：\`pnpm improvements get 要望ID 要望ID\``,
    `一度に渡せるのは${AGENT_BULK_MAX}件までです。`,
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
    `アプリのリポジトリで実行します（鍵は .env.local に置いてあります）。`,
    ``,
    `\`\`\``,
    agentCliCommand(`?id=${rows[0]?.id ?? "要望ID"}`),
    `\`\`\``,
    ``,
    `リポジトリの外から取りにいくときは、次の形でも受け取れます。`,
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
  // 会社が焼き込まれた鍵では、他社の要望はここで1件も返らない。
  // 「見つかりません」と「他社のものです」を言い分けない（IDを当てる手がかりにさせない）。
  const items = await getImprovementsForAgent(ids, caller.companyId);
  if (items.length === 0) {
    return markdown("# 対象の要望が見つかりません\n\n要望IDを確かめてください。\n");
  }

  const document =
    items.length === 1
      ? (await buildImprovementInstruction(items[0])).document
      : await buildBulkImprovementInstruction(items);

  const db = await getDb();
  for (const item of items) {
    await recordHandout(db, item, { via: "api", keyId: caller.keyId, keyLabel: caller.keyLabel });
  }

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
  return agentList(format, await appOrigin(), gate.caller);
}

/* ───────────────────────── 終わったことを書き戻す ───────────────────────── */

const agentResultSchema = z
  .object({
    id: z.string().min(1).max(60),
    result: z.enum(AGENT_RESULTS),
    /** review と done なら確認依頼の場所、failed なら直しきれなかった理由。 */
    detail: z.string().min(1).max(1000),
  })
  .strict();

/**
 * 作業する側（Claude Code）が、直した結果を書き戻す入口。
 *
 * 通す条件は3つとも**ここではなく** src/lib/domain/agent-scope.ts で決める。
 *  ・鍵に状態を変える権限がある
 *  ・鍵に焼き込んだ会社と、要望の会社が同じ
 *  ・その鍵で実際に受け取った要望である
 *
 * 進み方は「対応中 → レビュー待ち → 対応済み」。対応済みにできるのは
 * 確認依頼が取り込まれたときだけで、順番を飛ばした要求は 409 で断る
 * （直っていないものを一覧から消さないため）。
 */
export async function PATCH(req: Request) {
  const gate = await guardAgentRequest(req);
  if (gate.denied) return gate.denied;

  return handle(async () => {
    const input = agentResultSchema.parse(await readJsonBodyWithinLimit(req, SMALL_JSON_MAX_BYTES));
    return await applyAgentResult(gate.caller, input.id, { result: input.result, detail: input.detail });
  });
}
