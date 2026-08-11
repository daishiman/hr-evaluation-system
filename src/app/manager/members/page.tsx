import Link from "next/link";
import { requireRole, ROLE_LABEL, type Role } from "@/lib/session";
import { listEvaluations, listMembers } from "@/lib/queries";
import { Badge, Card, CardRow, EmptyState, Num, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * メンバー一覧。
 * 一覧には「名前・等級・直近の状態」の3つだけ置き、細かい数字は詳細画面に送る（認知負荷を下げる）。
 */
export default async function ManagerMembers() {
  const viewer = await requireRole("MANAGER");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;

  const [members, evals] = await Promise.all([
    listMembers(viewer.companyId),
    listEvaluations(viewer.companyId, viewer.role),
  ]);

  const latestOf = (userId: string) => evals.find((e) => e.employeeId === userId && e.status === "finalized") ?? null;

  return (
    <>
      <PageTitle
        title="メンバー"
        lede="等級・所属・直近の評価を確認できます。名前を選ぶと、その方の評価の履歴が見られます。"
      />

      {members.length === 0 ? (
        <EmptyState title="メンバーが登録されていません" body="会社の管理者に社員の登録を依頼してください。" />
      ) : (
        <Card>
          {members.map((m) => {
            const last = latestOf(m.id);
            return (
              <CardRow
                key={m.id}
                title={
                  <>
                    <Link href={`/manager/members/${m.id}`} className="text-[var(--brand-deep)]">
                      {m.name}
                    </Link>
                    {m.role !== "EMPLOYEE" && (
                      <span className="footnote"> （{ROLE_LABEL[m.role as Role] ?? m.role}）</span>
                    )}
                  </>
                }
                sub={`${m.gradeName ?? "等級未設定"} ／ ${m.department ?? "所属未設定"} ／ 社員番号 ${m.employeeCode ?? "—"}`}
                value={
                  last ? (
                    <>
                      <Num value={last.requirementRate} unit="%" />
                      <p className="m-0 text-[11px] text-[var(--ink-muted)]">{last.cycleName} の等級要件達成率</p>
                    </>
                  ) : (
                    <span className="footnote">確定した評価なし</span>
                  )
                }
                marks={!m.isActive ? <Badge tone="closed">利用停止</Badge> : undefined}
              />
            );
          })}
        </Card>
      )}
      <p className="footnote mt-3">
        メンバーの登録・等級の変更は会社の管理者が行います。マネージャーは内容の確認と評価メモの記入ができます。
      </p>
    </>
  );
}
