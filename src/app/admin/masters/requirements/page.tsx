import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listGradeRequirements, listGrades } from "@/lib/queries";
import { EmptyState, PageTitle } from "@/components/ui";
import { GradeRequirementEditor } from "@/components/GradeRequirementEditor";

export const dynamic = "force-dynamic";

/**
 * 等級要件の編集だけを行う画面。
 *
 * 制度マスタの中に混ぜていたときは「支援について」「運営について」が1つの一覧に
 * 混ざって見えず、いくつ登録できるのかも分からなかった。
 * 等級要件は達成率の分母を決める設定なので、専用の画面に切り出して数を見せる。
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
        <PageTitle title="等級要件の設定" />
        <EmptyState title="等級が登録されていません" body="先に制度マスタで等級を登録してください。" />
      </>
    );
  }

  return (
    <>
      <PageTitle
        title="等級要件の設定"
        lede="等級ごとに「支援について」「運営について」の項目を決めます。ここに登録した項目の数が、等級要件達成率の分母になります。"
      />

      {/* 等級の切り替えは常に見えるところに置く（どの等級を編集中か分からなくなるため） */}
      <div className="sticky top-[56px] z-10 -mx-1 mb-4 border-b border-[var(--line)] bg-[var(--brand-mist)] px-1 py-3">
        <p className="footnote m-0 mb-2">編集する等級</p>
        <div className="flex flex-wrap gap-2">
          {grades.map((g) => {
            const n = reqs.filter((r) => r.gradeId === g.id && r.isActive).length;
            return (
              <Link key={g.id} href={`/admin/masters/requirements?grade=${g.id}`} className="chip" aria-pressed={g.id === grade.id}>
                {g.name}
                <span className="ml-1 text-[var(--ink-muted)]">{n}項目</span>
              </Link>
            );
          })}
        </div>
      </div>

      <GradeRequirementEditor
        gradeId={grade.id}
        gradeName={grade.name}
        rows={reqs.filter((r) => r.gradeId === grade.id)}
      />

      <p className="footnote mt-5">
        等級そのものの設定（名前・昇格の条件・昇給額など）は
        <Link href={`/admin/masters?grade=${grade.id}`} className="mx-1 text-[var(--brand-deep)]">
          制度マスタ
        </Link>
        で行います。
      </p>
    </>
  );
}
