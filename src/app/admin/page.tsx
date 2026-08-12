import { requireRole } from "@/lib/session";
import {
  getActiveScheme,
  listBehaviorGuidelines,
  listCycles,
  listEvaluations,
  listForms,
  listGradeRequirements,
  listGrades,
  listKpiItems,
  listMembers,
  listPromotionRequirements,
  listPromotionThresholds,
  listRaiseSettings,
  listSchemeItems,
} from "@/lib/queries";
import { listPendingRespondents } from "@/lib/evaluate";
import { listStalledEvaluations } from "@/lib/stalled";
import { currentVersionRows } from "@/lib/domain/versioned-master";
import { EmptyState } from "@/components/ui";
import { AdminDashboard } from "./AdminDashboard";

export const dynamic = "force-dynamic";

/**
 * 会社の管理者のホーム。
 *
 * DBから読む責務はこのServer Componentに残し、何を次の一手として見せるかは
 * AdminDashboardの純粋な表示モデルに任せる。取得と表示判断を分けておくと、
 * 設定順を変えるときにDBアクセスまで巻き込まずに済む。
 */
export default async function AdminHome() {
  const viewer = await requireRole("COMPANY_ADMIN");
  if (!viewer.companyId) {
    return <EmptyState title="所属している会社がありません" body="システム管理者にご連絡ください。" />;
  }
  const companyId = viewer.companyId;

  const [
    cycles,
    members,
    grades,
    gradeRequirements,
    promotionRequirements,
    behaviorGuidelines,
    kpiItems,
    scheme,
    thresholds,
    raises,
  ] = await Promise.all([
    listCycles(companyId),
    listMembers(companyId),
    listGrades(companyId),
    listGradeRequirements(companyId),
    listPromotionRequirements(companyId),
    listBehaviorGuidelines(companyId),
    listKpiItems(companyId),
    getActiveScheme(companyId),
    listPromotionThresholds(companyId),
    listRaiseSettings(companyId),
  ]);

  // 開いている期間を運用対象にする。無ければ直近の期間を、履歴の文脈として表示する。
  const openCycle = cycles.find((cycle) => cycle.status === "open") ?? null;
  const shownCycle = openCycle ?? cycles[0] ?? null;
  const [pending, evaluations, forms, schemeItems, stalled] = await Promise.all([
    shownCycle ? listPendingRespondents(companyId, shownCycle.id) : Promise.resolve([]),
    shownCycle ? listEvaluations(companyId, viewer.role, { cycleId: shownCycle.id }) : Promise.resolve([]),
    shownCycle ? listForms(companyId, shownCycle.id) : Promise.resolve([]),
    scheme ? listSchemeItems(companyId, scheme.id) : Promise.resolve([]),
    // 締め切った期間に残っている分。上の集計は1期ぶんしか見ないので、別に読む。
    listStalledEvaluations(companyId),
  ]);

  return (
    <AdminDashboard
      stalled={stalled}
      snapshot={{
        companyName: viewer.companyName ?? "会社",
        memberCount: members.length,
        gradeCount: grades.length,
        activeGradeRequirementCount: currentVersionRows(gradeRequirements).filter((row) => row.isActive).length,
        activePromotionRequirementCount: currentVersionRows(promotionRequirements).filter((row) => row.isActive).length,
        activeBehaviorGuidelineCount: behaviorGuidelines.filter((row) => row.isActive).length,
        behaviorAppliedGradeCount: grades.filter((row) => row.isActive && Boolean(row.behaviorBand)).length,
        kpiItemCount: kpiItems.length,
        hasActiveScheme: scheme !== null,
        schemeItemCount: schemeItems.length,
        cycleCount: cycles.length,
        cycle: shownCycle
          ? {
              id: shownCycle.id,
              name: shownCycle.name,
              periodStart: shownCycle.periodStart,
              periodEnd: shownCycle.periodEnd,
              status: shownCycle.status,
            }
          : null,
        hasOpenCycle: openCycle !== null,
        formCount: forms.length,
        draftFormCount: forms.filter((form) => form.status === "draft").length,
        publishedFormCount: forms.filter((form) => form.status === "published").length,
        respondentCount: pending.length,
        submittedCount: pending.filter((row) => row.status === "submitted").length,
        evaluationCount: evaluations.length,
        finalizedEvaluationCount: evaluations.filter((row) => row.status === "finalized").length,
        provisionalPromotionCount: thresholds.filter((row) => row.isProvisional).length,
        provisionalRaiseCount: raises.filter((row) => row.isProvisional).length,
      }}
    />
  );
}
