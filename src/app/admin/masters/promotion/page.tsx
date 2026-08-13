import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listGrades, listPromotionRequirements, listPromotionThresholds } from "@/lib/queries";
import { getDb } from "@/lib/db";
import { promotionRequirementUsage } from "@/lib/master-usage";
import { detectStaleCycles } from "@/lib/impact";
import { RecordForm } from "@/components/RecordForm";
import { PromotionRequirementEditor } from "@/components/PromotionRequirementEditor";
import { StaleCyclesNotice } from "@/components/StaleCyclesNotice";
import { ChipLink, EmptyState, PageTitle, ProvisionalMark, ReasonNote, SectionHeading } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * 昇格だけを扱う画面。
 *
 * 「その等級から上がるには何が要るか」の2つだけを置く:
 *   1. 点数の線引き（必要なKPI評価点・必要な行動指針の点数）
 *   2. 点数では測らない要件（昇格要件）
 * 等級そのものの設定・等級要件・行動指針の中身は別の画面にある。
 */
export default async function AdminPromotion({ searchParams }: { searchParams: Promise<{ grade?: string }> }) {
  const viewer = await requireRole("COMPANY_ADMIN");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;
  const companyId = viewer.companyId;

  const [grades, thresholds, promoReqs, staleCycles] = await Promise.all([
    listGrades(companyId),
    listPromotionThresholds(companyId),
    listPromotionRequirements(companyId),
    detectStaleCycles(companyId),
  ]);

  /* 「完全に消せるか」を画面で出し分けるための材料。判定そのものは API 側でも必ず行う。 */
  const usage = await promotionRequirementUsage(await getDb(), companyId);

  const sp = await searchParams;
  const grade = grades.find((g) => g.id === sp.grade) ?? grades[0] ?? null;

  if (!grade) {
    return (
      <>
        <PageTitle title="昇格の条件・要件" />
        <EmptyState title="等級が登録されていません" body="初期データの投入が済んでいるかご確認ください。" />
      </>
    );
  }

  const th = thresholds.find((t) => t.fromGradeId === grade.id) ?? null;
  const myPromoReqs = promoReqs.filter((r) => r.gradeId === grade.id);

  return (
    <>
      <PageTitle
        sticky
        title="昇格の条件・要件"
        lede="この等級から次の等級へ上がるための条件を決めます。ここで決めた点数は、アンケートの回答画面には表示されません。"
        tags={<span className="tag">編集中の等級 {grade.name}</span>}
      />

      <StaleCyclesNotice cycles={staleCycles} />

      <SectionHeading>等級を選ぶ</SectionHeading>
      <div className="mb-5 flex flex-wrap gap-2">
        {grades.map((g) => (
          <ChipLink
            key={g.id}
            href={`/admin/masters/promotion?grade=${g.id}`} current={g.id === grade.id}
          >
            {g.name}
          </ChipLink>
        ))}
      </div>

      <SectionHeading>点数の線引き</SectionHeading>
      {!th ? (
        <ReasonNote>この等級からの昇格条件が登録されていません。最上位の等級の場合は設定不要です。</ReasonNote>
      ) : (
        <>
          {th.isProvisional && (
            <div className="mb-3">
              <ReasonNote>
                <ProvisionalMark /> いまの値は叩き台の初期値です。制度として決まった点数を入れて保存すると、仮置きの表示が消えます。
              </ReasonNote>
            </div>
          )}
          <RecordForm
            key={grade.id}
            url="/api/masters"
            method="PUT"
            fixed={{ kind: "threshold", id: th.id }}
            submitLabel="昇格の条件を保存する"
            description={`${th.label}。行動指針の点数は、観点ごとの点数（模範3〜悪影響-1）の合計です。何を問うかは行動指針の画面で決めます。`}
            fields={[
              {
                name: "requiredKpiPoints",
                label: "必要なKPI評価点",
                type: "number",
                required: true,
                defaultValue: th.requiredKpiPoints,
                unit: "点 / 100点",
                policy: { allowDecimal: false, min: 0, max: 100 },
              },
              {
                name: "requiredBehaviorPoints",
                label: "必要な行動指針の点数",
                type: "number",
                required: true,
                defaultValue: th.requiredBehaviorPoints,
                unit: "点",
                policy: { allowDecimal: false, min: 0, max: 100 },
              },
            ]}
          />
          <p className="footnote">
            行動指針の中身は
            <Link href="/admin/behavior" className="mx-1 text-brand-deep">
              行動指針
            </Link>
            で決めます。行動指針を出さない等級では、この点数は判定に使われません。
          </p>
        </>
      )}

      <SectionHeading>昇格要件</SectionHeading>
      <PromotionRequirementEditor key={grade.id} gradeId={grade.id} gradeName={grade.name} rows={myPromoReqs} usage={usage} />
    </>
  );
}
