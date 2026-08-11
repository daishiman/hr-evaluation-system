import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listGradeRequirements, listGrades } from "@/lib/queries";
import { EmptyState, PageTitle, SectionHeading } from "@/components/ui";
import { GradeRequirementEditor } from "@/components/GradeRequirementEditor";

export const dynamic = "force-dynamic";

/**
 * 等級要件の編集だけを行う画面。
 *
 * 制度マスタの中に混ぜていたときは「支援について」「運営について」が1つの一覧に
 * 混ざって見えず、いくつ登録できるのかも分からなかった。
 * 等級要件は次に作るアンケートの達成率分母を決める設定なので、専用の画面に切り出して数を見せる。
 */
export default async function AdminGradeRequirements({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string }>;
}) {
  const viewer = await requireRole("COMPANY_ADMIN");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;

  const [grades, reqs] = await Promise.all([listGrades(viewer.companyId), listGradeRequirements(viewer.companyId)]);
  const sp = await searchParams;
  const grade = grades.find((g) => g.id === sp.grade) ?? grades[0] ?? null;

  if (!grade) {
    return (
      <>
        <PageTitle title="等級要件（支援・運営）" />
        <EmptyState title="等級が登録されていません" body="先に「等級の設定」で等級を登録してください。" />
      </>
    );
  }

  return (
    <>
      {/* どの等級を編集中かは、見出しの帯に札で出して固定する
          （スクロールしても消えない。固定する実装は PageTitle の1箇所だけ） */}
      <PageTitle
        sticky
        title="等級要件（支援・運営）"
        lede="等級ごとに「支援について」「運営について」の項目を決めます。次に作るアンケートでは、有効な項目の数が等級要件達成率の分母になります。公開済みアンケートは作成時の項目数を保ちます。"
        tags={
          <>
            <span className="tag">
              編集中の等級 {grade.name}
            </span>
            <span className="tag" data-tone="muted">
              {reqs.filter((r) => r.gradeId === grade.id && r.isActive).length}項目
            </span>
          </>
        }
      />

      <SectionHeading>編集する等級を選ぶ</SectionHeading>
      <div className="mb-5 flex flex-wrap gap-2">
        {grades.map((g) => {
          const n = reqs.filter((r) => r.gradeId === g.id && r.isActive).length;
          return (
            <Link key={g.id} href={`/admin/masters/requirements?grade=${g.id}`} className="chip" aria-current={g.id === grade.id ? "true" : undefined}>
              {g.name}
              <span className="ml-1 text-[var(--ink-muted)]">{n}項目</span>
            </Link>
          );
        })}
      </div>

      <GradeRequirementEditor
        gradeId={grade.id}
        gradeName={grade.name}
        rows={reqs.filter((r) => r.gradeId === grade.id)}
      />

      <p className="footnote mt-5">
        等級そのものの設定（名前・水準・半期の目標設定上限数）は
        <Link href={`/admin/masters?grade=${grade.id}`} className="mx-1 text-[var(--brand-deep)]">
          等級の設定
        </Link>
        で行います。昇格条件は「昇格の条件・要件」、昇給額は「昇給の設定」で変更します。
      </p>
    </>
  );
}
