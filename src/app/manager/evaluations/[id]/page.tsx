import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { getEvaluationDetail, getMember, listEvaluations, listMembers } from "@/lib/queries";
import { isEvaluationStale } from "@/lib/impact";
import { ActionButton } from "@/components/ActionButton";
import { EvaluationDetail } from "@/components/EvaluationDetail";
import { EvaluatorPanel } from "@/components/EvaluatorPanel";
import { Card, InlineDetail, ReasonNote, SectionHeading } from "@/components/ui";
import {
  isOwnEvaluation,
  canReviewEmployeeEvaluation,
  selectNextActionableEvaluation,
  SELF_EVALUATION_BLOCK_REASON,
} from "@/lib/domain/evaluation-authority";

export const dynamic = "force-dynamic";

/** 評価1件の確認・確定。表示の中身は本人の画面と同じ部品を使い、判定の理由を必ず出す。 */
export default async function ManagerEvaluation({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole("MANAGER");
  const { id } = await params;
  if (!viewer.companyId) notFound();

  const detail = await getEvaluationDetail(viewer.companyId, id, viewer.role);
  if (!detail) notFound();
  const target = await getMember(viewer.companyId, detail.head.employeeId);
  if (
    !target ||
    !canReviewEmployeeEvaluation(viewer.id, viewer.role, {
      employeeId: target.id,
      managerId: target.managerId,
    })
  ) {
    notFound();
  }
  const stale = await isEvaluationStale(viewer.companyId, id);
  const finalized = detail.head.status === "finalized";
  // 自分自身の評価は、見るのは自由だが手は入れられない（自己承認になるため）。
  const own = isOwnEvaluation(viewer.id, detail.head.employeeId);

  // 確定後は、自分が操作できる次の未確定評価へそのまま進める（本人・担当外へは案内しない）。
  const nextDraft = finalized
    ? await (async () => {
        const [candidates, assignedMembers] = await Promise.all([
          listEvaluations(viewer.companyId!, viewer.role, { cycleId: detail.head.cycleId }),
          viewer.role === "MANAGER"
            ? listMembers(viewer.companyId!, { managerId: viewer.id })
            : Promise.resolve([]),
        ]);
        return selectNextActionableEvaluation(candidates, {
          currentId: id,
          viewerId: viewer.id,
          viewerRole: viewer.role,
          assignedEmployeeIds: new Set(
            assignedMembers.filter((member) => member.isActive).map((member) => member.id),
          ),
        });
      })()
    : null;

  // 結論を読んだ直後に「この結果をそのまま判断材料にしてよいか」を示す。
  // stale でなければ畳み、例外があるときだけ開いた状態で止める。
  const recomputePanel = own ? (
    <>
      <SectionHeading>この評価を扱う前に</SectionHeading>
      <Card className="card-pad">
        <ReasonNote>{SELF_EVALUATION_BLOCK_REASON}</ReasonNote>
      </Card>
    </>
  ) : finalized ? (
    <>
      <SectionHeading>この評価を扱う前に</SectionHeading>
      <Card className="card-pad">
        <ReasonNote>
          確定済みのため、集計し直せません。確定した評価は、判定した当時の基準・配点のまま据え置きます。
          内容を変えるときは、いったん確認中に戻してください。
        </ReasonNote>
      </Card>
    </>
  ) : stale ? (
    <>
      <SectionHeading>先に確認が必要です</SectionHeading>
      <Card className="card-pad">
        <div className="mb-3">
          <ReasonNote>
            この評価を計算したあとに、判定に使う基準が変わっています。いまの基準で集計し直すと結果が変わる可能性があります。
          </ReasonNote>
        </div>
        <p className="m-0 text-sub">
          提出された回答と、いまの基準・配点で、この方の評価だけを計算し直します。他の方の評価は変わりません。
        </p>
        <div className="mt-3">
          <ActionButton
            url="/api/evaluations/build"
            body={{ cycleId: detail.head.cycleId, employeeIds: [detail.head.employeeId] }}
            label="この人の評価を集計し直す"
            variant="primary"
            confirm={`${detail.head.employeeName ?? "この方"}の評価を、いまの基準で計算し直します。いま画面に出ている点数・判定は上書きされます。よろしいですか？`}
          />
        </div>
      </Card>
    </>
  ) : (
    <div className="mt-3">
      <InlineDetail summary="この人だけ集計し直す">
        <p className="m-0 text-sub">
          提出された回答と、いまの基準・配点で、この方の評価だけを計算し直します。他の方の評価は変わりません。
        </p>
        <div className="mt-3">
          <ActionButton
            url="/api/evaluations/build"
            body={{ cycleId: detail.head.cycleId, employeeIds: [detail.head.employeeId] }}
            label="この人の評価を集計し直す"
            variant="secondary"
            confirm={`${detail.head.employeeName ?? "この方"}の評価を、いまの基準で計算し直します。いま画面に出ている点数・判定は上書きされます。よろしいですか？`}
          />
        </div>
      </InlineDetail>
    </div>
  );

  return (
    <>
      <EvaluationDetail
        companyId={viewer.companyId}
        evaluationId={id}
        role={viewer.role}
        backHref="/manager/cycles"
        backLabel="評価・結果を確認する"
        afterConclusion={recomputePanel}
      />

      <SectionHeading>確認と確定</SectionHeading>
      <EvaluatorPanel
        evaluationId={id}
        status={detail.head.status}
        comment={detail.head.evaluatorComment ?? ""}
        employeeName={detail.head.employeeName ?? ""}
        blockedReason={own ? SELF_EVALUATION_BLOCK_REASON : null}
      />

      {finalized && nextDraft && (
        <p className="footnote mt-3">
          <Link href={`/manager/evaluations/${nextDraft.id}`} className="text-brand-deep">
            次の未確定評価へ（{nextDraft.employeeName ?? "氏名未設定"}）
          </Link>
        </p>
      )}
    </>
  );
}
