import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { Badge, EmptyState, PageTitle, ReasonNote } from "@/components/ui";
import { SchemeGroupPicker } from "@/components/SchemeGroupPicker";
import { groupPosition, schemeStepPath, stepLede, stepNumber, STEPS, stepTitle } from "@/lib/domain/scheme-steps";
import { loadKpiChoices, loadSchemeSetup } from "../data";

export const dynamic = "force-dynamic";

/**
 * 手順1「この等級区分で使うKPIを選ぶ」。
 *
 * 1画面1目的。ここでは選ぶだけで、基準（A〜E）は次の手順で扱う。
 */
export default async function SchemeSelectPage({ params }: { params: Promise<{ group: string }> }) {
  const viewer = await requireRole("COMPANY_ADMIN");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;
  const pointGroup = decodeURIComponent((await params).group);

  const [setup, choices] = await Promise.all([loadSchemeSetup(viewer.companyId), loadKpiChoices(viewer.companyId)]);
  const group = setup.groups.find((g) => g.pointGroup === pointGroup);
  // 他社の等級区分名を打ち込まれても、この会社に無ければ存在しない画面として扱う
  if (!group) notFound();

  const position = groupPosition(setup.order, pointGroup);
  const head = (
    <PageTitle
      breadcrumb={[
        { label: "制度設定ガイド", href: "/admin/setup" },
        { label: "KPI・評価セット", href: "/admin/scheme" },
        /* 等級名はパンくずに詰めない（5等級ぶんつなぐと1段が130文字を超える）。
           どの等級が入るかは、下の配点カードに並びで出している。 */
        { label: pointGroup },
      ]}
      title={`${pointGroup}：${stepTitle("select")}`}
      lede={stepLede("select", pointGroup)}
      tags={
        <>
          <Badge tone="active">
            ステップ {stepNumber("select")} / {STEPS.length}
          </Badge>
          <Badge tone="closed">
            等級区分 {position} / {setup.order.length}
          </Badge>
        </>
      }
      sticky
    />
  );

  if (!setup.scheme) {
    return (
      <>
        {head}
        <ReasonNote>有効な評価セットが登録されていません。初期データの投入が済んでいるかご確認ください。</ReasonNote>
      </>
    );
  }

  return (
    <>
      {head}
      <SchemeGroupPicker
        schemeId={setup.scheme.id}
        pointGroup={group.pointGroup}
        gradeNames={group.gradeNames}
        rule={group.rule}
        ratedItemIds={group.ratedItemIds}
        initial={group.saved}
        categories={choices.categories}
        kpiItems={choices.kpiItems}
        criteriaPath={schemeStepPath(group.pointGroup, "criteria")}
      />
    </>
  );
}
