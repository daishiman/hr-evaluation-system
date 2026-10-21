import { notFound } from "next/navigation";
import { ReportPrintControls } from "@/components/ReportPrintControls";
import { ReportTemplate } from "@/components/ReportTemplate";
import { PageTitle } from "@/components/ui";
import { loadEvaluationReport } from "@/lib/report-data";
import { canViewEvaluationOf, requireRoute } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * 1人の評価レポート（DD-024）。id は社員の利用者 id。見せ方は canViewEvaluationOf が決め、開けない人には 404 を返す。
 *
 * 本人は点数の数値を除いた形（self）、上長と管理者は点数まで含む形（reviewer）で読む。
 * 保存した写しは持たず、開くたびに確定した評価から作り直す。
 */
export default async function EvaluationReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireRoute("/reports/[id]");
  if (!viewer.companyId) notFound();
  const view = await canViewEvaluationOf(viewer, id);
  if (!view) notFound();

  const report = await loadEvaluationReport({
    companyId: viewer.companyId,
    employeeId: id,
    view,
    viewerRole: viewer.role,
  });

  // 本人は自分の結果の一覧へ、上長と管理者はその人のページへ戻す
  const back =
    view === "self"
      ? { label: "評価の結果を見る", href: "/me/results" }
      : { label: "メンバー1人", href: `/manager/members/${id}` };

  return (
    <>
      {/* 見出しと印刷ボタンは紙に刷らない。紙ではレポートの①が見出しを兼ねる */}
      <div className="no-print">
        <PageTitle
          title="評価レポート"
          lede="最新の確定した評価と、これまでの推移を確認できます。"
          breadcrumb={[back]}
          actions={report.kind === "empty" ? undefined : <ReportPrintControls />}
        />
      </div>
      <ReportTemplate report={report} emptyHref={back.href} emptyLabel={`${back.label}へ戻る`} />
    </>
  );
}
