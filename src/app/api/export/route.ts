import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/lib/db";
import { HttpError, requireTargetCompany } from "@/lib/session";
import { apiViewerFor, jsonError } from "@/lib/api";
import { csvResponse } from "@/lib/csv";
import { buildKpiDetailCsv, buildMembersCsv, buildResponsesCsv, buildResultsCsv } from "@/lib/export";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  type: z.enum(["responses", "results", "kpi", "members"]),
  formId: z.string().min(1).optional(),
  cycleId: z.string().min(1).optional(),
  companyId: z.string().min(1).optional(),
});

/**
 * これまでスプレッドシートで見ていた表のCSV書き出し。
 *
 * 回答・社員情報は会社の管理者以上、評価結果・KPI明細はマネージャー以上が使える。
 * 評価結果・KPI明細に載る人は、評価の画面と同じ範囲（会社の管理者以上は全員、マネージャーは直属の部下だけ）。
 * 入口の権限だけでは行の範囲が決まらないので、viewer を書き出しの関数へ渡して絞る（src/lib/export.ts）。
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = querySchema.parse(Object.fromEntries(url.searchParams));
    // 回答・社員の書き出しは会社の個人情報をまとめて出すので、評価の書き出しより強い操作として分ける
    const viewer = await apiViewerFor(
      q.type === "responses" || q.type === "members" ? "exports.companyData" : "exports.evaluationData",
    );

    const companyId = requireTargetCompany(viewer, q.companyId);

    const db = await getDb();

    if (q.type === "members") {
      const file = await buildMembersCsv(companyId);
      return csvResponse(file.filename, file.csv);
    }

    if (q.type === "responses") {
      if (!q.formId) throw new HttpError(400, "書き出すアンケートを指定してください。");
      const file = await buildResponsesCsv(companyId, q.formId);
      return csvResponse(file.filename, file.csv);
    }

    if (!q.cycleId) throw new HttpError(400, "書き出す評価期間を指定してください。");
    // 期の名前もここで読み、ファイル名に使う（書き出しの関数では読み直さない。載る行が0件でも名前が入る）
    const cycle = (
      await db
        .select({ id: s.evaluationCycles.id, name: s.evaluationCycles.name })
        .from(s.evaluationCycles)
        .where(and(eq(s.evaluationCycles.companyId, companyId), eq(s.evaluationCycles.id, q.cycleId)))
        .limit(1)
    )[0];
    if (!cycle) throw new HttpError(404, "評価期間が見つかりませんでした。");

    const file =
      q.type === "results"
        ? await buildResultsCsv(companyId, cycle, url.origin, viewer)
        : await buildKpiDetailCsv(companyId, cycle, viewer);
    return csvResponse(file.filename, file.csv);
  } catch (e) {
    return jsonError(e);
  }
}
