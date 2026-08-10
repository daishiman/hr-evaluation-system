import Link from "next/link";
import { requireRole } from "@/lib/session";
import {
  getActiveScheme,
  listGradeRequirements,
  listGrades,
  listKgiCoefficients,
  listPromotionRequirements,
  listPromotionThresholds,
  listRaiseSettings,
  listRankCriteria,
  listRankRatios,
  listSchemeItems,
} from "@/lib/queries";
import { detectStaleCycles } from "@/lib/impact";
import { RecordForm } from "@/components/RecordForm";
import { PromotionRequirementEditor } from "@/components/PromotionRequirementEditor";
import { GRADE_REQUIREMENT_MAX } from "@/lib/domain/grade-requirements";
import { Card, EmptyState, LinkButton, Num, PageTitle, ProvisionalMark, ReasonNote, SectionHeading } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * 制度マスタ。等級・昇格の条件・昇給額・等級要件・昇格要件・ランク基準をここで決める。
 *
 * 評価に使う数値をコードに書かないための画面。ここを変えると、以後の評価の計算が変わる。
 * すでに確定した評価は判定当時の値を持っているため、過去の結果は動かない。
 */
export default async function AdminMasters({ searchParams }: { searchParams: Promise<{ grade?: string; tab?: string }> }) {
  const viewer = await requireRole("COMPANY_ADMIN");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;
  const companyId = viewer.companyId;

  const [grades, thresholds, raises, gradeReqs, promoReqs, scheme, kgi] = await Promise.all([
    listGrades(companyId),
    listPromotionThresholds(companyId),
    listRaiseSettings(companyId),
    listGradeRequirements(companyId),
    listPromotionRequirements(companyId),
    getActiveScheme(companyId),
    listKgiCoefficients(companyId),
  ]);

  const sp = await searchParams;
  const grade = grades.find((g) => g.id === sp.grade) ?? grades[0] ?? null;
  const items = scheme ? await listSchemeItems(companyId, scheme.id) : [];
  const criteria = items.length > 0 ? await listRankCriteria(companyId, items.map((i) => i.kpiItemId)) : [];
  const ratios = scheme ? await listRankRatios(companyId, scheme.id) : [];
  // 基準を直した結果、どのサイクルが古いままかをこの画面で知らせる
  const staleCycles = await detectStaleCycles(companyId);

  if (!grade) {
    return (
      <>
        <PageTitle title="制度マスタ" />
        <EmptyState title="等級が登録されていません" body="初期データの投入が済んでいるかご確認ください。" />
      </>
    );
  }

  const th = thresholds.find((t) => t.fromGradeId === grade.id) ?? null;
  const raise = raises.find((r) => r.gradeId === grade.id) ?? null;
  const myGradeReqs = gradeReqs.filter((r) => r.gradeId === grade.id && r.isActive);
  const supportCount = myGradeReqs.filter((r) => r.category === "support").length;
  const operationCount = myGradeReqs.filter((r) => r.category === "operation").length;
  const myPromoReqs = promoReqs.filter((r) => r.gradeId === grade.id);

  return (
    <>
      <PageTitle
        title="制度マスタ"
        lede="評価に使う数値と要件をここで決めます。変更は以後の評価に反映され、確定済みの評価は判定当時の内容のまま残ります。"
      />

      {staleCycles.length > 0 && (
        <Card className="card-pad">
          <p className="m-0 text-[13px] font-bold">基準を変えたあと、集計し直していない評価があります</p>
          <ul className="m-0 mt-2 list-disc pl-5 text-[13px]">
            {staleCycles.map((c) => (
              <li key={c.cycleId}>
                {c.cycleName}：確認中 {c.recomputable}件が古い基準のままです
                {c.finalized > 0 && `（確定済み ${c.finalized}件は当時の基準のまま据え置き）`}。
                <Link href={`/manager/cycles?cycle=${c.cycleId}`} className="ml-1 text-[var(--brand-deep)]">
                  集計し直す
                </Link>
              </li>
            ))}
          </ul>
          <p className="footnote m-0 mt-2">
            確定済みの評価は、基準を変えても結果が動きません（判定した当時の値を控えてあるためです）。
          </p>
        </Card>
      )}

      <SectionHeading>等級を選ぶ</SectionHeading>
      <div className="mb-5 flex flex-wrap gap-2">
        {grades.map((g) => (
          <Link key={g.id} href={`/admin/masters?grade=${g.id}`} className="chip" aria-pressed={g.id === grade.id}>
            {g.name}
          </Link>
        ))}
      </div>

      <SectionHeading>{grade.name} の等級設定</SectionHeading>
      <RecordForm
        url="/api/masters"
        method="PUT"
        fixed={{ kind: "grade", id: grade.id }}
        submitLabel="等級の設定を保存する"
        description="「半期の目標設定上限数」は目標を何件まで立てられるかの目安です。等級要件達成率の分母には使いません（分母は登録した等級要件の項目数です）。"
        fields={[
          { name: "name", label: "等級の名前", type: "text", required: true, defaultValue: grade.name },
          { name: "targetCap", label: "半期の目標設定上限数", type: "number", required: true, defaultValue: grade.targetCap, unit: "件" },
          { name: "autonomyLevel", label: "自律の水準", type: "text", defaultValue: grade.autonomyLevel ?? "" },
          { name: "responsibilityLevel", label: "責任の水準", type: "text", defaultValue: grade.responsibilityLevel ?? "" },
          { name: "deadlineNote", label: "期限の考え方", type: "text", defaultValue: grade.deadlineNote ?? "" },
          {
            name: "behaviorBand",
            label: "行動指針の適用",
            type: "select",
            defaultValue: grade.behaviorBand ?? "",
            help: "この等級のアンケートに行動指針（創造性・専門性・個別性・対等性・連帯性の5問）を出すかどうかです。次に作るアンケートから反映されます。",
            options: [
              { value: "", label: "適用しない" },
              { value: "g1_2", label: "等級1〜2の基準を適用する" },
              { value: "g3_4", label: "等級3〜4の基準を適用する" },
            ],
          },
        ]}
      />
      <div className="mt-3">
        <ReasonNote>
          行動指針の適用について: 移行元の資料では、AM Ⅰ・AM Ⅱ に行動指針を出さない記録（同期ログ）と、出している記録（実際のアンケート用紙と回答一覧）が食い違っていました。
          実際に使われていたアンケート用紙のほうを採用して初期値を入れています。制度としての正解はこの画面で会社ごとに切り替えられます。
        </ReasonNote>
      </div>

      <SectionHeading>昇格の条件</SectionHeading>
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
            url="/api/masters"
            method="PUT"
            fixed={{ kind: "threshold", id: th.id }}
            submitLabel="昇格の条件を保存する"
            description={`${th.label}。ここで決めた点数は、アンケートの回答画面には絶対に表示されません。`}
            fields={[
              { name: "requiredKpiPoints", label: "必要なKPI評価点", type: "number", required: true, defaultValue: th.requiredKpiPoints, unit: "点 / 100点" },
              { name: "requiredBehaviorPoints", label: "必要な行動指針の点数", type: "number", required: true, defaultValue: th.requiredBehaviorPoints, unit: "点" },
            ]}
          />
        </>
      )}

      <SectionHeading>昇給額</SectionHeading>
      <Card className="card-pad">
        <p className="m-0 text-[13px]">
          {raise
            ? `${grade.name}のいまの昇給額は 月額 ${raise.monthlyAmount.toLocaleString("ja-JP")}円 です。`
            : "この等級の昇給額はまだ登録されていません。"}
        </p>
        <p className="footnote m-0 mt-1">
          金額・回数の上限・事業所ごとの調整率と、変更したときの記録は
          <Link href={`/admin/raises?grade=${grade.id}`} className="mx-1 text-[var(--brand-deep)]">
            昇給の設定
          </Link>
          でまとめて扱います。
        </p>
      </Card>

      <SectionHeading>等級要件</SectionHeading>
      <Card className="card-pad">
        <p className="m-0 text-[13px]">
          {grade.name} の等級要件は、<b>支援について {supportCount}項目</b>・<b>運営について {operationCount}項目</b>（合計{" "}
          <b>{supportCount + operationCount}項目</b>）です。この合計が等級要件達成率の分母になります。
        </p>
        <p className="footnote m-0 mt-1">
          項目の追加・並べ替え・見直しは専用の画面で行います（区分ごとに{GRADE_REQUIREMENT_MAX}項目まで）。
        </p>
        <div className="mt-3">
          <LinkButton variant="secondary" href={`/admin/masters/requirements?grade=${grade.id}`}>
            等級要件を編集する
          </LinkButton>
        </div>
      </Card>

      <SectionHeading>昇格要件</SectionHeading>
      <PromotionRequirementEditor gradeId={grade.id} gradeName={grade.name} rows={myPromoReqs} />

      <SectionHeading>KPIのランク基準（会社全体）</SectionHeading>
      {!scheme || items.length === 0 ? (
        <ReasonNote>評価セットが未設定のため、ランク基準を表示できません。</ReasonNote>
      ) : (
        <>
          <p className="footnote">
            ランクごとの点数の割合：{ratios.map((r) => `${r.rank}=${Math.round(r.ratio * 100)}%`).join("、")}
            {ratios.some((r) => r.isProvisional) && (
              <>
                {" "}
                <ProvisionalMark note="ランクごとの割合は制度として未確定のため、叩き台の初期値です。" />
              </>
            )}
          </p>
          <div className="grid gap-4">
            {items.map((i) => {
              const crits = criteria.filter((c) => c.kpiItemId === i.kpiItemId).sort((a, b) => a.rank.localeCompare(b.rank));
              return (
                <Card key={i.id} className="card-pad">
                  <p className="todo-row-title m-0">
                    {i.name} <span className="unit">配点 </span>
                    <Num value={i.weight} unit="点" />
                  </p>
                  <p className="todo-row-sub m-0">
                    単位 {i.unit} ／ {i.direction === "lower" ? "低いほど良い" : "高いほど良い"}
                    {i.formula ? ` ／ 計算式 ${i.formula}` : ""}
                  </p>
                  <div className="mt-3 grid gap-2">
                    {crits.map((c) => (
                      <RecordForm
                        key={c.id}
                        url="/api/masters"
                        method="PUT"
                        fixed={{ kind: "rankCriteria", id: c.id }}
                        submitLabel={`ランク${c.rank}の基準を保存`}
                        fields={[
                          { name: "lowerBound", label: `ランク${c.rank} の下限`, type: "number", defaultValue: c.lowerBound, unit: i.unit },
                          { name: "upperBound", label: `ランク${c.rank} の上限`, type: "number", defaultValue: c.upperBound, unit: i.unit },
                          { name: "displayLabel", label: "画面に出す表記", type: "text", defaultValue: c.displayLabel },
                        ]}
                      />
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {kgi.length > 0 && (
        <>
          <SectionHeading>事業所KGIの達成係数</SectionHeading>
          <p className="footnote">賞与の個人ポイント計算に使う係数です。</p>
          <div className="grid gap-3 md:grid-cols-2">
            {kgi.map((k) => (
              <RecordForm
                key={k.id}
                url="/api/masters"
                method="PUT"
                fixed={{ kind: "kgi", id: k.id }}
                submitLabel="係数を保存する"
                title={k.label}
                description={k.isProvisional ? "いまの値は叩き台の初期値です。" : undefined}
                fields={[
                  { name: "label", label: "区分の名前", type: "text", required: true, defaultValue: k.label },
                  { name: "coefficient", label: "係数", type: "number", required: true, defaultValue: k.coefficient },
                ]}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}
