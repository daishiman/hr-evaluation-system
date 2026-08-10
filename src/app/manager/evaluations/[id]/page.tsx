import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { getEvaluationDetail } from "@/lib/queries";
import { EvaluationDetail } from "@/components/EvaluationDetail";
import { EvaluatorPanel } from "@/components/EvaluatorPanel";
import { SectionHeading } from "@/components/ui";

export const dynamic = "force-dynamic";

/** 評価1件の確認・確定。表示の中身は本人の画面と同じ部品を使い、判定の理由を必ず出す。 */
export default async function ManagerEvaluation({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole("MANAGER");
  const { id } = await params;
  if (!viewer.companyId) notFound();

  const detail = await getEvaluationDetail(viewer.companyId, id, viewer.role);
  if (!detail) notFound();

  return (
    <>
      <EvaluationDetail
        companyId={viewer.companyId}
        evaluationId={id}
        role={viewer.role}
        backHref="/manager/cycles"
      />

      <SectionHeading>確認と確定</SectionHeading>
      <EvaluatorPanel
        evaluationId={id}
        status={detail.head.status}
        comment={detail.head.evaluatorComment ?? ""}
        employeeName={detail.head.employeeName ?? ""}
      />
    </>
  );
}
