import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listBehaviorBandSets, listGradeRequirements, listGrades, listPromotionThresholds, listRaiseSettings } from "@/lib/queries";
import { detectStaleCycles } from "@/lib/impact";
import { RecordForm } from "@/components/RecordForm";
import { StaleCyclesNotice } from "@/components/StaleCyclesNotice";
import { behaviorBandLabel } from "@/lib/domain/behavior";
import { GRADE_REQUIREMENT_MAX } from "@/lib/domain/grade-requirements";
import { currentVersionRows } from "@/lib/domain/versioned-master";
import { Card, EmptyState, LinkButton, Num, PageTitle, SectionHeading } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * 等級そのものの設定だけを扱う画面。
 *
 * 「等級とは何か」（名前・水準・目標の上限）をここで決める。
 * その等級で何を問うか・どうすれば上がれるか・行動指針を出すかは、
 * それぞれ別の画面に置く。1つの画面に全部を積むと、直したい設定が
 * どこにあるか毎回探すことになるため。
 */
export default async function AdminMasters({ searchParams }: { searchParams: Promise<{ grade?: string }> }) {
  const viewer = await requireRole("COMPANY_ADMIN");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;
  const companyId = viewer.companyId;

  const [grades, raises, gradeReqs, thresholds, staleCycles, bandSets] = await Promise.all([
    listGrades(companyId),
    listRaiseSettings(companyId),
    listGradeRequirements(companyId),
    listPromotionThresholds(companyId),
    detectStaleCycles(companyId),
    listBehaviorBandSets(companyId),
  ]);

  const sp = await searchParams;
  const grade = grades.find((g) => g.id === sp.grade) ?? grades[0] ?? null;

  if (!grade) {
    return (
      <>
        <PageTitle title="等級の設定" />
        <EmptyState title="等級が登録されていません" body="初期データの投入が済んでいるかご確認ください。" />
      </>
    );
  }

  const raise = raises.find((r) => r.gradeId === grade.id) ?? null;
  const myGradeReqs = currentVersionRows(gradeReqs).filter((r) => r.gradeId === grade.id && r.isActive);
  const supportCount = myGradeReqs.filter((r) => r.category === "support").length;
  const operationCount = myGradeReqs.filter((r) => r.category === "operation").length;
  const th = thresholds.find((t) => t.fromGradeId === grade.id) ?? null;

  return (
    <>
      {/* 設定項目が縦に長く並ぶ画面。どの等級を編集しているかを帯に固定する */}
      <PageTitle
        sticky
        title="等級の設定"
        lede="等級の名前と水準をここで決めます。変更は以後の評価に反映され、確定済みの評価は判定当時の内容のまま残ります。"
        tags={<span className="tag">編集中の等級 {grade.name}</span>}
      />

      <StaleCyclesNotice cycles={staleCycles} />

      <SectionHeading>等級を選ぶ</SectionHeading>
      <div className="mb-5 flex flex-wrap gap-2">
        {grades.map((g) => (
          <Link key={g.id} href={`/admin/masters?grade=${g.id}`} className="chip" aria-current={g.id === grade.id ? "true" : undefined}>
            {g.name}
          </Link>
        ))}
      </div>

      <SectionHeading>{grade.name} の内容</SectionHeading>
      {/* 等級の切り替えで入力欄を作り直す。key を付けないと、前の等級に入れた値が
          そのまま残り、それを保存して別の等級の内容を上書きしてしまう */}
      <RecordForm
        key={grade.id}
        url="/api/masters"
        method="PUT"
        fixed={{ kind: "grade", id: grade.id }}
        submitLabel="等級の設定を保存する"
        description="「半期の目標設定上限数」は、本人が半期に立てられる目標の件数の目安です。等級要件達成率には使いません。達成率の分母は、そのアンケートを作った時点で実際に出題した等級要件の項目数です。"
        fields={[
          { name: "name", label: "等級の名前", type: "text", required: true, defaultValue: grade.name },
          {
            name: "targetCap",
            label: "半期の目標設定上限数",
            type: "number",
            required: true,
            defaultValue: grade.targetCap,
            unit: "件",
            policy: { allowDecimal: false, min: 1, max: 50 },
          },
          { name: "autonomyLevel", label: "自律の水準", type: "text", defaultValue: grade.autonomyLevel ?? "" },
          { name: "responsibilityLevel", label: "責任の水準", type: "text", defaultValue: grade.responsibilityLevel ?? "" },
          { name: "deadlineNote", label: "期限の考え方", type: "text", defaultValue: grade.deadlineNote ?? "" },
        ]}
      />

      {/* 等級の名前は見出しと帯（編集中の等級）に出ている。
          下のカードの文からは等級名を外し、文が差し込みで伸びないようにする。 */}
      <SectionHeading>{grade.name} について、別の画面で決めること</SectionHeading>
      <div className="stack">
        <Card className="card-pad">
          <p className="m-0 text-sub font-bold">等級要件（支援・運営）</p>
          <p className="m-0 mt-1 text-sub">
            いまは <b>支援について {supportCount}項目</b>・<b>運営について {operationCount}項目</b>（合計{" "}
            <b>{supportCount + operationCount}項目</b>）です。次に作るアンケートでは、この有効な項目の合計が達成率の分母になります。
          </p>
          <p className="footnote m-0 mt-1">区分ごとに{GRADE_REQUIREMENT_MAX}項目までです。</p>
          <div className="mt-3">
            <LinkButton variant="secondary" href={`/admin/masters/requirements?grade=${grade.id}`}>
              等級要件を編集する
            </LinkButton>
          </div>
        </Card>

        <Card className="card-pad">
          <p className="m-0 text-sub font-bold">昇格の条件・要件</p>
          {/* 「KPI評価点◯点・行動指針◯点」は式であって文ではない。
              1行の文に詰めず、必要な点数を並びにして出す。 */}
          {th ? (
            <>
              <p className="m-0 mt-1 text-sub">次の等級へ上がるには、次の点数が必要です。</p>
              <ul className="m-0 mt-1 list-disc pl-5 text-sub">
                <li>
                  KPI評価点 <Num value={th.requiredKpiPoints} unit="点" />
                </li>
                <li>
                  行動指針 <Num value={th.requiredBehaviorPoints} unit="点" />
                </li>
              </ul>
            </>
          ) : (
            <>
              <p className="m-0 mt-1 text-sub">この等級からの昇格条件は登録されていません。</p>
              <p className="footnote m-0 mt-1">最上位の等級であれば、設定は要りません。</p>
            </>
          )}
          <div className="mt-3">
            <LinkButton variant="secondary" href={`/admin/masters/promotion?grade=${grade.id}`}>
              昇格の条件・要件を編集する
            </LinkButton>
          </div>
        </Card>

        <Card className="card-pad">
          <p className="m-0 text-sub font-bold">行動指針</p>
          {/* 出す基準セットの呼び名は差し込み。文に混ぜず、値として別の行に置く */}
          {grade.behaviorBand ? (
            <>
              <p className="m-0 mt-1 text-sub">この等級のアンケートに出す行動指針です。</p>
              <p className="m-0 mt-1 text-sub font-bold">{behaviorBandLabel(bandSets, grade.behaviorBand)}</p>
            </>
          ) : (
            <p className="m-0 mt-1 text-sub">この等級のアンケートには、行動指針を出しません。</p>
          )}
          <div className="mt-3">
            <LinkButton variant="secondary" href="/admin/behavior">
              行動指針を編集する
            </LinkButton>
          </div>
        </Card>

        <Card className="card-pad">
          <p className="m-0 text-sub font-bold">昇給額</p>
          <p className="m-0 mt-1 text-sub">
            {raise ? (
              <>
                いまの昇給額は 月額 <Num value={raise.monthlyAmount} unit="円" /> です。
              </>
            ) : (
              "この等級の昇給額はまだ登録されていません。"
            )}
          </p>
          <p className="footnote m-0 mt-1">金額・回数の上限・事業所ごとの調整率と、変更したときの記録をまとめて扱います。</p>
          <div className="mt-3">
            <LinkButton variant="secondary" href={`/admin/raises?grade=${grade.id}`}>
              昇給の設定を開く
            </LinkButton>
          </div>
        </Card>
      </div>
    </>
  );
}
