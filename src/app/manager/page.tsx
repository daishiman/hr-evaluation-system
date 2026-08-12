import { ManagerDashboard, type TeamMemberSummary } from "@/app/manager/ManagerDashboard";
import type { MyActionForm } from "@/app/me/MyDashboard";
import { EmptyState } from "@/components/ui";
import { daysUntilDeadline, formatJpDate, jstDateString } from "@/lib/domain/form-deadline";
import { listPendingRespondents } from "@/lib/evaluate";
import { getOpenCycle, listEvaluations, listForms, listMembers } from "@/lib/queries";
import { listMyForms } from "@/lib/response-access";
import { requireRole } from "@/lib/session";
import { listStalledEvaluations } from "@/lib/stalled";

export const dynamic = "force-dynamic";

/** マネージャーのホーム。未確定評価、締切、担当チームの順に次の作業を示す。 */
export default async function ManagerHome() {
  const viewer = await requireRole("MANAGER");
  if (!viewer.companyId) {
    return <EmptyState title="所属している会社がありません" body="システム全体管理者にご連絡ください。" />;
  }
  const companyId = viewer.companyId;

  const [openCycle, team, stalled, myForms] = await Promise.all([
    getOpenCycle(companyId),
    listMembers(companyId, { managerId: viewer.id }),
    // 締め切った期間に残っている分。開いている期間しか見ない下の集計とは別に読む
    // （締め切った瞬間に画面から消えてしまうのが、放置に気づけなかった原因）。
    listStalledEvaluations(companyId, { managerId: viewer.id }),
    // マネージャー・会社管理者自身も回答者になりうる。担当チームの集計とは別に、
    // 一般の方のホーム（/me）と同じ判定関数で「自分の未提出」を読む
    // （サイドバーから自分で開かない限り誰の画面にも出なかったため）。
    listMyForms(companyId, viewer.id, viewer.gradeId),
  ]);
  const activeTeam = team.filter((member) => member.isActive);
  const now = new Date();
  const ownPendingForms: MyActionForm[] = myForms
    .filter((form) => form.deadline.canAnswer && form.responseStatus !== "submitted" && !form.supersededBy)
    .sort((a, b) => (a.deadline.effectiveUntil ?? "9999-12-31").localeCompare(b.deadline.effectiveUntil ?? "9999-12-31"))
    .map((form) => ({
      formId: form.formId,
      title: form.title,
      cycleName: form.cycleName,
      questionCount: form.questionCount,
      responseStatus: form.responseStatus,
      deadlineLabel: form.deadline.effectiveUntil ? formatJpDate(form.deadline.effectiveUntil) : null,
      daysUntilDeadline: daysUntilDeadline(form.deadline.effectiveUntil, now),
    }));

  if (!openCycle) {
    return (
      <ManagerDashboard
        viewerName={viewer.name}
        cycle={null}
        stalled={stalled}
        ownPendingForms={ownPendingForms}
        draftEvaluations={[]}
        readyToBuild={0}
        team={activeTeam.map((member) => ({
          id: member.id,
          name: member.name,
          gradeName: member.gradeName,
          department: member.department,
          responseStatus: null,
        }))}
      />
    );
  }

  const [pending, evaluations, forms] = await Promise.all([
    listPendingRespondents(companyId, openCycle.id),
    listEvaluations(companyId, viewer.role, { cycleId: openCycle.id }),
    listForms(companyId, openCycle.id),
  ]);
  // ホームは担当チームの判断面。会社全体の件数を混ぜると、自分が対応できない作業が「次の一手」になる。
  const teamIds = new Set(activeTeam.map((member) => member.id));
  const teamPendingRows = pending.filter((respondent) => teamIds.has(respondent.id));
  const teamEvaluations = evaluations.filter((evaluation) => teamIds.has(evaluation.employeeId));
  const draftEvaluations = teamEvaluations.filter((evaluation) => evaluation.status !== "finalized");
  const evaluatedEmployees = new Set(teamEvaluations.map((evaluation) => evaluation.employeeId));
  const readyToBuild = teamPendingRows.filter(
    (respondent) => respondent.status === "submitted" && !evaluatedEmployees.has(respondent.id),
  ).length;
  const teamPending = new Map(teamPendingRows.map((respondent) => [respondent.id, respondent.status]));
  const teamRows: TeamMemberSummary[] = activeTeam.map((member) => ({
    id: member.id,
    name: member.name,
    gradeName: member.gradeName,
    department: member.department,
    responseStatus: teamPending.get(member.id) ?? null,
  }));
  const deadlines = forms
    .filter((form) => form.status === "published" && form.closesAt)
    .map((form) => form.closesAt as string)
    .sort();
  const deadline =
    deadlines.find((day) => daysUntilDeadline(day, now) !== null) ?? deadlines.at(-1) ?? openCycle.periodEnd;
  const deadlineDays = daysUntilDeadline(deadline, now);
  const deadlineLabel = `${formatJpDate(deadline)}${deadline < jstDateString(now) ? "（期限経過）" : ""}`;

  return (
    <ManagerDashboard
      viewerName={viewer.name}
      stalled={stalled}
      ownPendingForms={ownPendingForms}
      cycle={{
        id: openCycle.id,
        name: openCycle.name,
        periodStart: openCycle.periodStart,
        periodEnd: openCycle.periodEnd,
        deadlineLabel,
        daysUntilDeadline: deadlineDays,
      }}
      draftEvaluations={draftEvaluations.map((evaluation) => ({
        id: evaluation.id,
        employeeName: evaluation.employeeName,
        gradeName: evaluation.gradeName,
      }))}
      readyToBuild={readyToBuild}
      team={teamRows}
    />
  );
}
