import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/lib/db";
import { apiViewer, HttpError, resolveCompanyId } from "@/lib/session";
import { jsonError } from "@/lib/api";
import { csvResponse } from "@/lib/csv";
import { buildKpiDetailCsv, buildResponsesCsv, buildResultsCsv } from "@/lib/export";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  type: z.enum(["responses", "results", "kpi"]),
  formId: z.string().min(1).optional(),
  cycleId: z.string().min(1).optional(),
  companyId: z.string().min(1).optional(),
});

/**
 * これまでスプレッドシートで見ていた表のCSV書き出し。
 *
 * 配点・閾値・昇格に必要な点数が含まれるため、マネージャー以上だけが使える。
 */
export async function GET(req: Request) {
  try {
    const viewer = await apiViewer("MANAGER");
    const url = new URL(req.url);
    const q = querySchema.parse(Object.fromEntries(url.searchParams));

    const companyId = resolveCompanyId(viewer, q.companyId);
    if (!companyId) throw new HttpError(400, "会社を指定してください。");

    const db = await getDb();

    if (q.type === "responses") {
      if (!q.formId) throw new HttpError(400, "書き出すアンケートを指定してください。");
      const file = await buildResponsesCsv(companyId, q.formId);
      return csvResponse(file.filename, file.csv);
    }

    if (!q.cycleId) throw new HttpError(400, "書き出す評価期間を指定してください。");
    const cycle = (
      await db
        .select({ id: s.evaluationCycles.id })
        .from(s.evaluationCycles)
        .where(and(eq(s.evaluationCycles.companyId, companyId), eq(s.evaluationCycles.id, q.cycleId)))
        .limit(1)
    )[0];
    if (!cycle) throw new HttpError(404, "評価期間が見つかりませんでした。");

    const file =
      q.type === "results"
        ? await buildResultsCsv(companyId, cycle.id, url.origin)
        : await buildKpiDetailCsv(companyId, cycle.id);
    return csvResponse(file.filename, file.csv);
  } catch (e) {
    return jsonError(e);
  }
}
