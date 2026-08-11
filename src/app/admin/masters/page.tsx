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
  listSchemeItems,
} from "@/lib/queries";
import { detectStaleCycles } from "@/lib/impact";
import { RecordForm } from "@/components/RecordForm";
import { PromotionRequirementEditor } from "@/components/PromotionRequirementEditor";
import { RankCriteriaPanel } from "@/components/RankCriteriaPanel";
import { GRADE_REQUIREMENT_MAX } from "@/lib/domain/grade-requirements";
import { Card, Disclosure, EmptyState, LinkButton, PageTitle, ProvisionalMark, ReasonNote, SectionHeading } from "@/components/ui";

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
  /* ランク基準（8項目 × A〜Eで40件）は折りたたみを開いたときに読む。
     ここでは「開く価値があるか」を出すための件数だけを数える。 */
  const schemeItemCount = scheme ? (await listSchemeItems(companyId, scheme.id)).length : 0;
  // 基準を直した結果、どのサイクルが古いままかをこの画面で知らせる
  const staleCycles = await detectStaleCycles(companyId);

  if (!grade) {
    return (
      <>
        <PageTitle title="等級・昇格・行動指針" />
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
      {/* 設定項目が縦に長く並ぶ画面。どの等級を編集しているかを帯に固定する */}
      <PageTitle
        sticky
        title="等級・昇格・行動指針"
        lede="評価に使う数値と要件をここで決めます。変更は以後の評価に反映され、確定済みの評価は判定当時の内容のまま残ります。"
        tags={<span className="tag">編集中の等級 {grade.name}</span>}
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
          <Link key={g.id} href={`/admin/masters?grade=${g.id}`} className="chip" aria-current={g.id === grade.id ? "true" : undefined}>
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
        <Disclosure summary="行動指針の初期設定について">
          <p className="footnote m-0">
            移行元には、AM Ⅰ・AM Ⅱへ行動指針を出さない記録と、実際に出したアンケートがありました。初期値は実際のアンケートを採用していますが、会社の制度に合わせて上の「行動指針の適用」で切り替えられます。
          </p>
        </Disclosure>
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
      {schemeItemCount === 0 ? (
        <ReasonNote>評価セットが未設定のため、ランク基準を表示できません。</ReasonNote>
      ) : (
        <>
          <p className="footnote">
            A〜Eの線引きは項目ごとに決めます。開いたときに読み込むため、直したいときだけ開いてください。
          </p>
          <RankCriteriaPanel itemCount={schemeItemCount} />
        </>
      )}

      {kgi.length > 0 && (
        <div className="mt-4">
          <Disclosure summary="事業所KGIの達成係数を変更する" meta={`${kgi.length}区分`}>
            <p className="footnote">
              賞与の個人ポイント計算に使います（個人Pt ＝ KPI評価点の合計 × 係数）。通常は変更が必要なときだけ開きます。
            </p>
            <details className="mb-4">
              <summary className="cursor-pointer text-[12px] font-semibold text-[var(--ink-muted)]">初期値の決め方を確認する</summary>
              <p className="footnote m-0 mt-2">
                元資料の区分間に空白があったため、上の区分の下限にそろえて連続する範囲へ補っています。元資料そのままの値ではありません。
              </p>
            </details>
            <div className="field-grid">
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
          </Disclosure>
        </div>
      )}
    </>
  );
}
