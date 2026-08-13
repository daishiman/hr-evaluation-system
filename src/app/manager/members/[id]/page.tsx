import { notFound } from "next/navigation";
import { canViewEmployee, requireRole, ROLE_LABEL, type Role } from "@/lib/session";
import { getMember, listEvaluations, listNotes } from "@/lib/queries";
import { Badge, Card, DefList, PageTitle, RecordList, SectionHeading } from "@/components/ui";
import { EvaluationTrend, type TrendItem } from "@/components/EvaluationTrend";
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
  /* 推移・内訳・一覧を1つの節にまとめて渡す。等級はここで決めた「その期の等級」
     （evaluations.gradeId）を使う。いまの等級（users.gradeId）で塗ると、
     昇格前の評価まで新しい等級のものとして表示されてしまう。 */
  const trendItems: TrendItem[] = evals.map((e) => ({
    id: e.id,
    href: `/manager/evaluations/${e.id}`,
    cycle: e.cycleName ?? "—",
    period: formatPeriod(e.periodStart, e.periodEnd),
    periodStart: e.periodStart ?? null,
    gradeName: e.gradeName ?? null,
    finalized: e.status === "finalized",
    values: { 達成率: e.requirementRate ?? null, KPI評価点: e.totalScore ?? null },
    sub: `等級要件の達成 ${e.requirementAchieved ?? "—"}/${e.requirementTotal ?? "—"} 項目`,
    headline: { value: e.totalScore ?? null, unit: "点", caption: "KPI評価点" },
    rows: [
      { label: "KPI評価点", value: e.totalScore ?? null, unit: "点" },
      { label: "満点", value: e.maxScore ?? null, unit: "点" },
      { label: "等級要件の達成率", value: e.requirementRate ?? null, unit: "%" },
      {
        label: "等級要件の達成",
        text: `${e.requirementAchieved ?? "—"} / ${e.requirementTotal ?? "—"} 項目`,
      },
      { label: "評価の状態", text: e.status === "finalized" ? "確定済み" : "確認中" },
      { label: "評価者のコメント", text: e.evaluatorComment ?? "—" },
    ],
  }));

  return (
    <>
      <PageTitle
        breadcrumb={[{ label: "メンバー", href: "/manager/members" }]}
        title={`${member.name} さん`}
        lede={`${member.gradeName ?? "等級未設定"} ／ ${member.department ?? "所属未設定"} ／ ${ROLE_LABEL[member.role as Role] ?? member.role}`}
      />

      <SectionHeading>基本情報</SectionHeading>
      <Card className="card-pad" off={!member.isActive}>
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

      <EvaluationTrend
        items={trendItems}
        series={[
          { key: "達成率", label: "等級要件の達成率（%）" },
          { key: "KPI評価点", label: "KPI評価点（点）" },
        ]}
        emptyBody="アンケートの提出後、サイドバーの「評価・結果を確認する」から評価を作成できます。"
      />

      <SectionHeading aside={<span className="footnote">本人には表示されません</span>}>評価メモ</SectionHeading>
      <NoteForm employeeId={member.id} />
      {notes.length === 0 ? (
        <p className="footnote mt-2">メモはまだありません。面談で気づいたことを残しておくと、次の評価のときに役立ちます。</p>
      ) : (
        <div className="mt-3">
          {/* メモは長い文章が主役なので、行（CardRow）ではなくカード（RecordList）で出す（§5-5）。 */}
          <RecordList
            items={notes.map((n) => ({
              key: n.id,
              title: `${n.authorName ?? "—"} ／ ${formatDate(n.createdAt ? new Date(n.createdAt) : null)}`,
              marks: n.visibility === "admin" ? <Badge tone="closed">管理者のみ</Badge> : undefined,
              note: n.body,
            }))}
          />
        </div>
      )}
    </>
  );
}
