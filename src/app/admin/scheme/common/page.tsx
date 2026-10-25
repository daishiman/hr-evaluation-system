import { requireRoute } from "@/lib/session";
import { EmptyState, PageTitle, ReasonNote } from "@/components/ui";
import { detectStaleCycles } from "@/lib/impact";
import { StaleCyclesNotice } from "@/components/StaleCyclesNotice";
import { SchemeCommonSettings } from "@/components/SchemeCommonSettings";
import { getActiveScheme } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * 全等級区分に共通の設定（昇給の条件）。会社の管理者のみ。
 *
 * 以前は KPI・評価セットの入口に、等級区分のカードと並べて置いていた。
 * 入口をどの作業をするか選ぶだけの画面にしたので、ここへ分けた（DD-027）。
 * 静的な segment は [group] より優先されるので、等級区分の手順の画面とは重ならない。
 */
export default async function AdminSchemeCommonPage() {
  const viewer = await requireRoute("/admin/scheme/common");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;

  const [scheme, staleCycles] = await Promise.all([
    getActiveScheme(viewer.companyId),
    detectStaleCycles(viewer.companyId),
  ]);

  return (
    <>
      <PageTitle title="全等級区分に共通の設定" lede="会社全体で1つだけ決める設定です。" />
      <StaleCyclesNotice cycles={staleCycles} />
      {scheme ? (
        <SchemeCommonSettings
          schemeId={scheme.id}
          raiseRequiresAllA={scheme.raiseRequiresAllA}
          updatedAt={scheme.updatedAt.getTime()}
        />
      ) : (
        <ReasonNote>有効な評価セットが登録されていません。初期データの投入が済んでいるかご確認ください。</ReasonNote>
      )}
    </>
  );
}
