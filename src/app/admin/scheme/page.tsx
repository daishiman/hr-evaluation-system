import { redirect } from "next/navigation";
import { requireRoute } from "@/lib/session";
import { EmptyState, ReasonNote } from "@/components/ui";
import { detectStaleCycles } from "@/lib/impact";
import { StaleCyclesNotice } from "@/components/StaleCyclesNotice";
import { FormAlignNotice } from "@/components/FormAlignNotice";
import { getDb } from "@/lib/db";
import { alignDraftForms } from "@/lib/form-align";
import { checkGradePointRule } from "@/lib/domain/grade-points";
import { kpiItemPath } from "@/lib/domain/scheme-steps";
import { listKpiCategories, listKpiItems } from "@/lib/queries";
import { loadSchemeSetup } from "./data";
import { SchemeHub } from "./SchemeHub";

export const dynamic = "force-dynamic";

/**
 * KPI・評価セットの入口。会社の管理者のみ。
 *
 * この画面の目的は1つだけ：**どの作業をするかを選ぶ**。
 * 等級区分ごとの設定（使うKPIを選ぶ／基準を決める）は等級区分ごとの手順画面、
 * 共通の設定・KPI項目・KPIカテゴリはそれぞれの画面で行う（DD-027）。
 *
 * 以前はこの1画面で「等級区分の切り替え・配点の確認・項目の選択・基準の編集・KPIの比較」を
 * 同時にやらせていて、何をする画面なのか分からなくなっていた（2026-08-11 の指摘）。
 * 手順を分けたあとも、共通の設定・KPI項目・カテゴリをこの画面に積んでいたので、DD-027 で外へ出した。
 */
export default async function AdminSchemePage({
  searchParams,
}: {
  /** item は以前の「聞き方を決める」のリンク（/admin/scheme?item=<id>）。KPI項目の画面のその行へ送る */
  searchParams: Promise<{ item?: string }>;
}) {
  const viewer = await requireRoute("/admin/scheme");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;

  /* 旧い URL は消さずに転送する（文書・ブックマーク・比べる警告のリンクが 404 にならないように） */
  const item = (await searchParams).item;
  if (item) redirect(kpiItemPath(item));

  const db = await getDb();
  const [setup, staleCycles, categories, kpiItems, drift] = await Promise.all([
    loadSchemeSetup(viewer.companyId),
    detectStaleCycles(viewer.companyId),
    listKpiCategories(viewer.companyId),
    listKpiItems(viewer.companyId),
    /* 設定とずれた下書きの件数（何も書かない）。そろえられないものも、直す必要があるので数える（DD-028 の6） */
    alignDraftForms(db, { companyId: viewer.companyId, dryRun: true, actorId: viewer.id }),
  ]);

  /* 配点の型そのものが壊れていると、どう選んでも保存できない状態になる。
     「保存できない」とだけ出すと画面の不具合に見えるため、原因をここで名指しする。 */
  const ruleErrors = setup.groups.flatMap((g) => checkGradePointRule(g.rule, g.label));

  return (
    <SchemeHub
      notices={
        <>
          <StaleCyclesNotice cycles={staleCycles} />
          <FormAlignNotice count={drift.items.length + drift.failed.length} />
          {!setup.scheme && (
            <ReasonNote>有効な評価セットが登録されていません。初期データの投入が済んでいるかご確認ください。</ReasonNote>
          )}
          {setup.scheme && setup.groups.length === 0 && (
            <ReasonNote>等級区分ごとの配点ルールが登録されていません。初期データの投入をご確認ください。</ReasonNote>
          )}
          {ruleErrors.length > 0 && (
            <ReasonNote>
              <p className="m-0 font-bold">配点の決まりに食い違いがあります（このままでは保存できません）</p>
              <ul className="m-0 list-disc pl-5">
                {ruleErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </ReasonNote>
          )}
        </>
      }
      groups={setup.scheme ? setup.groups : []}
      raiseRequiresAllA={setup.scheme?.raiseRequiresAllA ?? null}
      items={{ active: kpiItems.filter((i) => i.isActive).length, total: kpiItems.length }}
      categoryCount={categories.length}
    />
  );
}
