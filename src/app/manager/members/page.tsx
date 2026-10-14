import Link from "next/link";
import { ROLE_LABEL, type Role, requireRoute } from "@/lib/session";
import { listMembers } from "@/lib/queries";
import { getDb } from "@/lib/db";
import { GRADE_UNSET_LABEL } from "@/lib/domain/grade-label";
import { withGradeAndScore } from "@/lib/score-visibility";
import { Badge, Card, CardRow, EmptyState, PageTitle } from "@/components/ui";
import { LatestScoreValue } from "@/components/LatestScore";

export const dynamic = "force-dynamic";

/**
 * メンバー一覧。
 * 一覧には「名前・等級・直近の状態」の3つだけ置き、細かい数字は詳細画面に送る（認知負荷を下げる）。
 */
export default async function ManagerMembers() {
  const viewer = await requireRoute("/manager/members");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;

  // 等級と確定した最新の点数は、見てよい役割にだけサーバーで付ける（S6）
  const members = await withGradeAndScore(
    await getDb(),
    viewer,
    await listMembers(viewer.companyId, viewer.role === "MANAGER" ? { managerId: viewer.id } : undefined),
  );

  return (
    <>
      <PageTitle
        title="メンバー"
        lede={viewer.role === "MANAGER" ? "担当チームの等級・所属・直近の評価を確認できます。" : "会社に所属する全員の等級・所属・直近の評価を確認できます。"}
      />

      {members.length === 0 ? (
        <EmptyState title="メンバーが登録されていません" body="会社の管理者に社員の登録を依頼してください。" />
      ) : (
        <Card>
          {members.map((m) => (
            <CardRow
              key={m.id}
              title={
                <>
                  <Link href={`/manager/members/${m.id}`} className="text-brand-deep">
                    {m.name}
                  </Link>
                  {m.role !== "EMPLOYEE" && (
                    <span className="footnote"> （{ROLE_LABEL[m.role as Role] ?? m.role}）</span>
                  )}
                </>
              }
              sub={`${m.gradeName ?? GRADE_UNSET_LABEL} ／ ${m.department ?? "所属未設定"} ／ 社員番号 ${m.employeeCode ?? "—"}`}
              value={m.latestScore !== undefined && <LatestScoreValue score={m.latestScore} />}
              marks={!m.isActive ? <Badge tone="closed">利用停止</Badge> : undefined}
              off={!m.isActive}
            />
          ))}
        </Card>
      )}
      <p className="footnote mt-3">
        メンバーの登録・等級の変更は会社の管理者が行います。マネージャーは内容の確認と評価メモの記入ができます。
      </p>
    </>
  );
}
