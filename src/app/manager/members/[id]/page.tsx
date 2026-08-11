import Link from "next/link";
import { notFound } from "next/navigation";
import { canViewEmployee, requireRole, ROLE_LABEL, type Role } from "@/lib/session";
import { getMember, listEvaluations, listNotes } from "@/lib/queries";
import { Badge, Card, DefList, EmptyState, Num, PageTitle, ReasonNote, SectionHeading } from "@/components/ui";
import { TrendChart } from "@/components/LazyCharts";
import { NoteForm } from "@/components/NoteForm";
import { formatDate, formatPeriod } from "@/lib/view";

export const dynamic = "force-dynamic";

/**
 * メンバー1人分の詳細。
 * 過去の評価を並べて比較できるようにする（半期ごとの推移が本人の成長の記録になる）。
 */
export default async function MemberDetail({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole("MANAGER");
  const { id } = await params;
  if (!viewer.companyId) notFound();
  if (!(await canViewEmployee(viewer, id))) notFound();

  const member = await getMember(viewer.companyId, id);
  if (!member) notFound();

  const [evals, notes] = await Promise.all([
    listEvaluations(viewer.companyId, viewer.role, { employeeId: id }),
    listNotes(viewer.companyId, id),
  ]);
  const finalized = evals.filter((e) => e.status === "finalized");

  // 古い順に並べて推移を出す
  const trend = [...finalized].reverse().map((e) => ({
    cycle: e.cycleName ?? "—",
    達成率: e.requirementRate ?? 0,
    KPI評価点: e.totalScore ?? 0,
  }));

  return (
    <>
      <PageTitle
        breadcrumb={[{ label: "メンバー", href: "/manager/members" }]}
        title={`${member.name} さん`}
        lede={`${member.gradeName ?? "等級未設定"} ／ ${member.department ?? "所属未設定"} ／ ${ROLE_LABEL[member.role as Role] ?? member.role}`}
      />

      <SectionHeading>基本情報</SectionHeading>
      <Card className="card-pad">
        <DefList
          rows={[
            { label: "社員番号", value: member.employeeCode ?? "—" },
            { label: "メールアドレス", value: member.email },
            { label: "入社日", value: formatDate(member.hiredAt) },
            { label: "等級", value: member.gradeName ?? "未設定" },
            { label: "状態", value: member.isActive ? "在籍" : "利用停止" },
            { label: "メモ", value: member.profileNote ?? "—" },
          ]}
        />
        <p className="footnote m-0 mt-3">
          等級・所属・入社日の変更は会社の管理者が行います。マネージャーは閲覧のみです。
        </p>
      </Card>

      <SectionHeading>評価の推移</SectionHeading>
      {trend.length < 2 ? (
        <ReasonNote>
          確定した評価が{trend.length}件のため、推移のグラフはまだ出せません。2回目の評価が確定すると比較できます。
        </ReasonNote>
      ) : (
        <Card className="card-pad">
          <TrendChart
            data={trend}
            series={[
              { key: "達成率", label: "等級要件達成率（%）" },
              { key: "KPI評価点", label: "KPI評価点（点）" },
            ]}
          />
        </Card>
      )}

      <SectionHeading>これまでの評価</SectionHeading>
      {evals.length === 0 ? (
        <EmptyState title="評価がまだありません" body="アンケートの提出後、サイドバーの「評価・結果を確認する」から評価を作成できます。" />
      ) : (
        <Card>
          {evals.map((e) => (
            <div key={e.id} className="card-row">
              <div className="row-main">
                <p className="todo-row-title m-0">
                  <Link href={`/manager/evaluations/${e.id}`} className="text-[var(--brand-deep)]">
                    {e.cycleName}
                  </Link>
                </p>
                <p className="todo-row-sub m-0">
                  {formatPeriod(e.periodStart, e.periodEnd)} ／ 等級要件の達成{" "}
                  <Num value={e.requirementAchieved} />/<Num value={e.requirementTotal} /> 項目
                </p>
              </div>
              <div className="shrink-0 text-right">
                <Num value={e.totalScore} display />
                <span className="unit">点</span>
                <p className="m-0 text-[11px] text-[var(--ink-muted)]">
                  満点 <Num value={e.maxScore} unit="点" />
                </p>
              </div>
              {e.status === "finalized" ? <Badge tone="done">確定済み</Badge> : <Badge tone="active">確認中</Badge>}
            </div>
          ))}
        </Card>
      )}

      <SectionHeading aside={<span className="footnote">本人には表示されません</span>}>評価メモ</SectionHeading>
      <NoteForm employeeId={member.id} />
      {notes.length === 0 ? (
        <p className="footnote mt-2">メモはまだありません。面談で気づいたことを残しておくと、次の評価のときに役立ちます。</p>
      ) : (
        <Card className="mt-3">
          {notes.map((n) => (
            <div key={n.id} className="card-row items-start">
              <div className="row-main">
                <p className="m-0 text-[13px] leading-relaxed">{n.body}</p>
                <p className="todo-row-sub m-0 mt-1">
                  {n.authorName ?? "—"} ／ {formatDate(n.createdAt ? new Date(n.createdAt) : null)}
                </p>
              </div>
              {n.visibility === "admin" && <Badge tone="closed">管理者のみ</Badge>}
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
