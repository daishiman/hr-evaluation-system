import { ManagerDashboard, type TeamMemberSummary } from "@/app/manager/ManagerDashboard";
import { EmptyState } from "@/components/ui";
import { daysUntilDeadline, formatJpDate, jstDateString } from "@/lib/domain/form-deadline";
import { listPendingRespondents } from "@/lib/evaluate";
import { getOpenCycle, listEvaluations, listForms, listMembers } from "@/lib/queries";
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

  const [openCycle, team, stalled] = await Promise.all([
    getOpenCycle(companyId),
    listMembers(companyId, { managerId: viewer.id }),
    // 締め切った期間に残っている分。開いている期間しか見ない下の集計とは別に読む
    // （締め切った瞬間に画面から消えてしまうのが、放置に気づけなかった原因）。
    listStalledEvaluations(companyId, { managerId: viewer.id }),
  ]);
  const activeTeam = team.filter((member) => member.isActive);

  if (!openCycle) {
    return (
      <ManagerDashboard
        viewerName={viewer.name}
        cycle={null}
        stalled={stalled}
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
  const now = new Date();
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
