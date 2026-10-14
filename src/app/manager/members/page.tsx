import { requireRoute } from "@/lib/session";
import { listMembers } from "@/lib/queries";
import { getDb } from "@/lib/db";
import { availableSortKeys, parsePeopleView, type PeopleSearchParams } from "@/lib/domain/people-list";
import { canViewGradeScore, withGradeAndScore } from "@/lib/score-visibility";
import { EmptyState, PageTitle } from "@/components/ui";
import { PeopleList } from "@/components/PeopleList";

export const dynamic = "force-dynamic";

/**
 * メンバー一覧。
 * 一覧には「名前・等級・直近の状態」の3つだけ置き、細かい数字は詳細画面に送る（認知負荷を下げる）。
 * 名前などで探し、名前・役割・点数・等級で並べ替えられる（spec.md §28-13）。
 */
export default async function ManagerMembers({ searchParams }: { searchParams: Promise<PeopleSearchParams> }) {
  const viewer = await requireRoute("/manager/members");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;

  // 等級と確定した最新の点数は、見てよい役割にだけサーバーで付ける（S6）
  const members = await withGradeAndScore(
    await getDb(),
    viewer,
    await listMembers(viewer.companyId, viewer.role === "MANAGER" ? { managerId: viewer.id } : undefined),
  );
  const sortKeys = availableSortKeys({ acrossCompanies: false, gradeAndScore: canViewGradeScore(viewer) });
  const view = parsePeopleView(await searchParams, sortKeys);

  return (
    <>
      <PageTitle
        title="メンバー"
        lede={viewer.role === "MANAGER" ? "担当チームの等級・所属・直近の評価を確認できます。" : "会社に所属する全員の等級・所属・直近の評価を確認できます。"}
      />

      {members.length === 0 ? (
        <EmptyState title="メンバーが登録されていません" body="会社の管理者に社員の登録を依頼してください。" />
      ) : (
        <PeopleList
          sortKeys={sortKeys}
          initial={view}
          rows={members.map((m) => ({
            key: m.id,
            id: m.id,
            href: `/manager/members/${m.id}`,
            isActive: m.isActive,
            name: m.name,
            role: m.role,
            companyId: viewer.companyId,
            gradeName: m.gradeName,
            gradeOrder: m.gradeOrder,
            latestScore: m.latestScore,
            department: m.department,
            employeeCode: m.employeeCode,
          }))}
        />
      )}
      <p className="footnote mt-3">
        メンバーの登録・等級の変更は会社の管理者が行います。マネージャーは内容の確認と評価メモの記入ができます。
      </p>
    </>
  );
}
