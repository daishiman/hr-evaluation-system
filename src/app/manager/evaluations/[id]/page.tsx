import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { getEvaluationDetail } from "@/lib/queries";
import { isEvaluationStale } from "@/lib/impact";
import { ActionButton } from "@/components/ActionButton";
import { EvaluationDetail } from "@/components/EvaluationDetail";
import { EvaluatorPanel } from "@/components/EvaluatorPanel";
import { Card, ReasonNote, SectionHeading } from "@/components/ui";

export const dynamic = "force-dynamic";

/** 評価1件の確認・確定。表示の中身は本人の画面と同じ部品を使い、判定の理由を必ず出す。 */
export default async function ManagerEvaluation({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole("MANAGER");
  const { id } = await params;
  if (!viewer.companyId) notFound();

  const detail = await getEvaluationDetail(viewer.companyId, id, viewer.role);
  if (!detail) notFound();
  const stale = await isEvaluationStale(viewer.companyId, id);
  const finalized = detail.head.status === "finalized";

  return (
    <>
      <EvaluationDetail
        companyId={viewer.companyId}
        evaluationId={id}
        role={viewer.role}
        backHref="/manager/cycles"
        backLabel="評価・結果を確認する"
      />

      <SectionHeading>この人だけ集計し直す</SectionHeading>
      <Card className="card-pad">
        {finalized ? (
          <ReasonNote>
            確定済みのため、集計し直せません。確定した評価は、判定した当時の基準・配点のまま据え置きます。
            内容を変えるときは、いったん確認中に戻してください。
          </ReasonNote>
        ) : (
          <>
            {stale && (
              <div className="mb-3">
                <ReasonNote>
                  この評価を計算したあとに、判定に使う基準が変わっています。いまの基準で集計し直すと結果が変わる可能性があります。
                </ReasonNote>
              </div>
            )}
            <p className="m-0 text-[13px]">
              提出された回答と、いまの基準・配点で、この方の評価だけを計算し直します。他の方の評価は変わりません。
            </p>
            <div className="mt-3">
              <ActionButton
                url="/api/evaluations/build"
                body={{ cycleId: detail.head.cycleId, employeeIds: [detail.head.employeeId] }}
                label="この人の評価を集計し直す"
                variant={stale ? "primary" : "secondary"}
                confirm={`${detail.head.employeeName ?? "この方"}の評価を、いまの基準で計算し直します。いま画面に出ている点数・判定は上書きされます。よろしいですか？`}
              />
            </div>
          </>
        )}
      </Card>

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
