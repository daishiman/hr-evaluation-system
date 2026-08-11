import { MyDashboard, type MyActionForm } from "@/app/me/MyDashboard";
import { EmptyState } from "@/components/ui";
import { daysUntilDeadline, formatJpDate } from "@/lib/domain/form-deadline";
import { getOpenCycle, listEvaluations } from "@/lib/queries";
import { listMyForms } from "@/lib/response-access";
import { requireViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

/** 評価される方のホーム。回答すべきアンケートと最新結果を最優先で示す。 */
export default async function MyHome() {
  const viewer = await requireViewer();
  if (!viewer.companyId) {
    return <EmptyState title="所属している会社がありません" body="会社の管理者に、所属会社の設定を依頼してください。" />;
  }

  const [openCycle, forms, evaluations] = await Promise.all([
    getOpenCycle(viewer.companyId),
    listMyForms(viewer.companyId, viewer.id, viewer.gradeId),
    listEvaluations(viewer.companyId, viewer.role, { employeeId: viewer.id }),
  ]);
  const now = new Date();
  const actionable = forms
    .filter((form) => form.deadline.canAnswer && form.responseStatus !== "submitted" && !form.supersededBy)
    .sort((a, b) => (a.deadline.effectiveUntil ?? "9999-12-31").localeCompare(b.deadline.effectiveUntil ?? "9999-12-31"));
  const actionableForms: MyActionForm[] = actionable.map((form) => ({
    formId: form.formId,
    title: form.title,
    cycleName: form.cycleName,
    questionCount: form.questionCount,
    responseStatus: form.responseStatus,
    deadlineLabel: form.deadline.effectiveUntil ? formatJpDate(form.deadline.effectiveUntil) : null,
    daysUntilDeadline: daysUntilDeadline(form.deadline.effectiveUntil, now),
  }));
  const latestSubmitted = forms.find((form) => form.responseStatus === "submitted") ?? null;
  const results = evaluations.filter((evaluation) => evaluation.status === "finalized");

  return (
    <MyDashboard
      viewerName={viewer.name}
      cycleName={openCycle?.name ?? null}
      actionableForms={actionableForms}
      latestSubmittedForm={latestSubmitted ? { formId: latestSubmitted.formId, title: latestSubmitted.title } : null}
      results={results.map((evaluation) => ({
        id: evaluation.id,
        cycleName: evaluation.cycleName,
        gradeName: evaluation.gradeName,
        requirementRate: evaluation.requirementRate,
        requirementAchieved: evaluation.requirementAchieved,
        requirementTotal: evaluation.requirementTotal,
        raiseEligible: evaluation.raiseEligible,
        promotionEligible: evaluation.promotionEligible,
      }))}
      gradeAssigned={Boolean(viewer.gradeId)}
    />
  );
}
