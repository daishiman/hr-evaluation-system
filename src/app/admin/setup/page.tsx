import { EmptyState, PageTitle, ReasonNote, SectionHeading } from "@/components/ui";
import {
  getActiveScheme,
  listBehaviorGuidelines,
  listCycles,
  listEvaluations,
  listForms,
  listGradeRequirements,
  listGrades,
  listKpiItems,
  listPromotionRequirements,
} from "@/lib/queries";
import { requireRole } from "@/lib/session";
import { SetupGuide, type SetupStep } from "./SetupGuide";
import { currentVersionRows } from "@/lib/domain/versioned-master";
import { loadSchemeReadiness } from "@/lib/scheme-readiness";

export const dynamic = "force-dynamic";

/**
 * 制度を作ってから評価結果を確定するまでの案内。
 * SUPER_ADMIN も既存の会社スコープでここへ入るため、すべての読み取りを
 * viewer.companyId で絞り、選択中の1社以外の件数を混ぜない。
 */
export default async function AdminSetupPage() {
  const viewer = await requireRole("COMPANY_ADMIN");
  if (!viewer.companyId) {
    return <EmptyState title="操作する会社が選ばれていません" body="サイドバーで会社を選んでから、設定を確認してください。" />;
  }
  const companyId = viewer.companyId;

  const [grades, gradeRequirements, promotionRequirements, behaviorGuidelines, kpiItems, scheme, cycles, forms] =
    await Promise.all([
      listGrades(companyId),
      listGradeRequirements(companyId),
      listPromotionRequirements(companyId),
      listBehaviorGuidelines(companyId),
      listKpiItems(companyId),
      getActiveScheme(companyId),
      listCycles(companyId),
      listForms(companyId),
    ]);

  const currentCycle = cycles.find((cycle) => cycle.status === "open") ?? cycles[0] ?? null;
  const [schemeReadiness, evaluations] = await Promise.all([
    loadSchemeReadiness(companyId, scheme?.id ?? null),
    currentCycle
      ? listEvaluations(companyId, viewer.role, { cycleId: currentCycle.id })
      : Promise.resolve([]),
  ]);

  const activeGrades = grades.filter((grade) => grade.isActive);
  const activeRequirements = currentVersionRows(gradeRequirements).filter((requirement) => requirement.isActive);
  const supportCount = activeRequirements.filter((requirement) => requirement.category === "support").length;
  const operationCount = activeRequirements.filter((requirement) => requirement.category === "operation").length;
  const promotionCount = currentVersionRows(promotionRequirements).filter((requirement) => requirement.isActive).length;

  const activeGuidelines = behaviorGuidelines.filter((guideline) => guideline.isActive);
  const behaviorLevelCount = activeGuidelines.reduce((sum, guideline) => sum + guideline.levels.length, 0);
  const behaviorAppliedGrades = activeGrades.filter((grade) => Boolean(grade.behaviorBand)).length;

  const activeKpis = kpiItems.filter((item) => item.isActive);
  const openCycles = cycles.filter((cycle) => cycle.status === "open").length;
  const planningCycles = cycles.filter((cycle) => cycle.status === "planning").length;
  const publishedForms = forms.filter((form) => form.status === "published").length;
  const draftForms = forms.filter((form) => form.status === "draft").length;
  const finalizedEvaluations = evaluations.filter((evaluation) => evaluation.status === "finalized").length;
  const selectedSchemeItems = schemeReadiness.groups.reduce((sum, group) => sum + group.progress.selectedCount, 0);

  const steps: SetupStep[] = [
    {
      number: 1,
      title: "等級要件・等級・昇格要件を決める",
      summary: "最初に、等級ごとに求める支援・運営の業務と、次の等級へ進む条件を決めます。",
      current: `等級 ${activeGrades.length}段階 ／ 支援 ${supportCount}項目 ／ 運営 ${operationCount}項目 ／ 昇格要件 ${promotionCount}項目`,
      complete: activeGrades.length > 0 && activeRequirements.length > 0,
      statusLabel: activeGrades.length > 0 && activeRequirements.length > 0 ? "登録あり" : "要設定",
      actions: [
        { href: "/admin/masters/requirements", label: "等級要件を設定する" },
        { href: "/admin/masters", label: "等級の設定を確認する" },
        { href: "/admin/masters/promotion", label: "昇格の条件・要件を確認する" },
      ],
      detail:
        "アンケートの支援・運営の設問と昇格要件は、ここで保存した内容から作られます。先にアンケートを作ると、あとで制度を直しても作成済みの版には自動反映されません。",
    },
    {
      number: 2,
      title: "行動指針を確認する",
      summary: "どの行動をどの水準で評価するかと、各等級のアンケートに出すかを確認します。",
      current: `行動指針 ${activeGuidelines.length}観点 ／ 判定文 ${behaviorLevelCount}件 ／ 適用する等級 ${behaviorAppliedGrades}/${activeGrades.length}段階`,
      complete: activeGuidelines.length > 0 && behaviorAppliedGrades > 0,
      statusLabel: activeGuidelines.length > 0 && behaviorAppliedGrades > 0 ? "設定あり" : "要確認",
      actions: [{ href: "/admin/behavior", label: "行動指針を確認する" }],
      detail:
        "行動指針を適用した等級には、アンケート作成時に行動指針の設問が入ります。等級ごとの適用を決めてから評価セットとアンケートへ進みます。",
    },
    {
      number: 3,
      title: "KPI・評価セットを決める",
      summary: "等級区分ごとに、評価するKPIと配点の組み合わせを決めます。",
      current: `利用できるKPI ${activeKpis.length}項目 ／ 有効な評価セット ${scheme ? "1件" : "なし"} ／ 選択済み ${selectedSchemeItems}枠`,
      complete: schemeReadiness.schemeReady,
      statusLabel: schemeReadiness.schemeReady ? "設定済み" : "要設定",
      actions: [{ href: "/admin/scheme", label: "KPI・評価セットを設定する" }],
      detail:
        "評価セットで選んだKPIから、アンケートのKPI設問と評価時の配点が決まります。評価期間やアンケートを作る前に、対象項目を確定します。",
    },
    {
      number: 4,
      title: "評価期間を作る",
      summary: "制度と評価セットを使う半期の期間を作り、運用する期を開きます。",
      current: `評価期間 ${cycles.length}件 ／ 進行中 ${openCycles}件 ／ 準備中 ${planningCycles}件`,
      complete: cycles.length > 0,
      statusLabel: cycles.length > 0 ? "作成あり" : "未作成",
      actions: [{ href: "/admin/cycles", label: "評価期間を作成・確認する" }],
      detail:
        "アンケートと評価結果は評価期間に属します。どの制度と期間で評価したかを残すため、アンケートより先に作成します。",
    },
    {
      number: 5,
      title: "アンケートを作って配る",
      summary: "評価期間と等級をもとにアンケートを作り、内容を確認して公開します。",
      current: `アンケート ${forms.length}件 ／ 公開中 ${publishedForms}件 ／ 下書き ${draftForms}件`,
      complete: forms.length > 0,
      statusLabel: forms.length > 0 ? "作成あり" : "未作成",
      actions: [{ href: "/admin/forms", label: "アンケートを作成・確認する" }],
      detail:
        "アンケートは、その時点の等級要件・行動指針・評価セットを保存した版です。回答者向けプレビューで設問と答え方を確認してから公開します。",
    },
    {
      number: 6,
      title: "評価・結果を確認する",
      summary: "回答を集計し、判定理由を確認してから評価結果を確定します。",
      current: currentCycle
        ? `${currentCycle.name}：評価 ${evaluations.length}件 ／ 確定済み ${finalizedEvaluations}件 ／ 確認中 ${evaluations.length - finalizedEvaluations}件`
        : "評価期間がないため、評価はまだ作られていません",
      complete: evaluations.length > 0,
      statusLabel: evaluations.length > 0 ? "評価あり" : "未集計",
      actions: [{ href: "/manager/cycles", label: "評価・結果を確認する" }],
      detail:
        "回答をもとに評価を作り、設問・実績値・ランク・点数のつながりを確認します。確定すると、その時点の制度と結果が保存されます。",
    },
  ];

  return (
    <>
      <PageTitle
        title="制度設定ガイド"
        lede={`${viewer.companyName ?? "選択中の会社"}で、制度の設定から評価結果の確定までを依存する順番に確認します。`}
      />

      <ReasonNote>
        上から順に設定すると、後の画面に必要な項目がそろいます。すでに設定済みの手順は、現在の件数だけ確認して次へ進めます。
      </ReasonNote>

      <SectionHeading>設定と運用の6ステップ</SectionHeading>
      <SetupGuide steps={steps} />
    </>
  );
}
