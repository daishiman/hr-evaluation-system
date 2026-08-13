import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { EvaluationDetail } from "@/components/EvaluationDetail";
import { listEvaluations } from "@/lib/queries";
import { canReadSelfResult } from "@/lib/domain/evaluation-authority";

export const dynamic = "force-dynamic";

export default async function MyResult({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer();
  if (!viewer.companyId) notFound();

  // 自分の評価しか開けない（URLを書き換えても他人の結果は出さない）
  const mine = await listEvaluations(viewer.companyId, viewer.role, { employeeId: viewer.id });
  const result = mine.find((e) => e.id === id);
  if (!result || !canReadSelfResult(viewer.id, result.employeeId, result.status)) notFound();

  return <EvaluationDetail companyId={viewer.companyId} evaluationId={id} role={viewer.role} backHref="/me/results" backLabel="評価の結果を見る" />;
}
