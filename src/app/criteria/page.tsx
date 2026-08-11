import { redirect } from "next/navigation";
import { canSeeCriteria, homePathFor, requireRole } from "@/lib/session";
import {
  listBehaviorGuidelines,
  listGradeRequirements,
  listGrades,
  listPromotionRequirements,
  listPromotionThresholds,
  listRaiseSettings,
} from "@/lib/queries";
import { Badge, Card, CardRow, EmptyState, Num, PageTitle, ProvisionalMark, ReasonNote, SectionHeading } from "@/components/ui";
import {
  getActiveScheme,
  listGradePointRules,
  listQuestionsFor,
  listRankCriteriaFor,
  listRankRatios,
  listSchemeItemsAllGroups,
  listSelectableItemsByGroup,
  slotCountOf,
  type SelectableItem,
} from "./data";
import { PointDesign, PointRuleComparison } from "./PointDesign";
import { SelectableItems } from "./SelectableItems";
import { anchorIdOf, ScoringFlow } from "./ScoringFlow";

export const dynamic = "force-dynamic";

/**
 * 採点基準の確認ページ（マネージャー以上のみ）。
 *
 * ここに出る数値（等級区分ごとの配点・ランク基準・昇格に必要な点数・昇給額）は
 * すべてDBのマスタから読んでいる。制度を変えるとこの画面の表示も変わる。
 * 評価される方には、この画面も、この画面が読む値も一切渡さない。
 *
 * 画面の並びは「どの等級を見るか → 満点の内訳 → 選べる項目 → 1項目ずつの採点の流れ」。
 * 情報量が多いので、項目ごとの細かい話は既定で畳んでおき、見たいものだけ開く。
 */
export default async function CriteriaPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string; item?: string }>;
}) {
  const viewer = await requireRole("MANAGER");
  // 配点・閾値・必要点数は評価される側に出さない（明示要件）。
  // requireRole と canSeeCriteria の二重で止めるのは、見せてよいロールの定義が
  // 変わったときにこの画面だけ取り残されないようにするため。
  if (!canSeeCriteria(viewer.role)) redirect(`${homePathFor(viewer.role)}?denied=1`);
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;
  const companyId = viewer.companyId;

  const [grades, gradeReqs, promoReqs, behaviors, thresholds, raises, rules, selectableByGroup, scheme] =
    await Promise.all([
      listGrades(companyId),
      listGradeRequirements(companyId),
      listPromotionRequirements(companyId),
      listBehaviorGuidelines(companyId),
      listPromotionThresholds(companyId),
      listRaiseSettings(companyId),
      listGradePointRules(companyId),
      listSelectableItemsByGroup(companyId),
      getActiveScheme(companyId),
    ]);

  const sp = await searchParams;
  const grade = grades.find((g) => g.id === sp.grade) ?? grades[0] ?? null;
  const pointGroup = grade?.pointGroup ?? null;

  const rule = rules.find((r) => r.pointGroup === pointGroup) ?? null;
  const selectable = pointGroup ? (selectableByGroup.get(pointGroup) ?? []) : [];

  // 評価セットで実際に選ばれている項目（等級区分ごとに選び直せる）
  const schemeItems = scheme ? await listSchemeItemsAllGroups(companyId, scheme.id) : [];
  const ratios = scheme ? await listRankRatios(companyId, scheme.id) : [];
  const adopted = schemeItems.filter((i) => i.pointGroup === pointGroup);
  const adoptedIds = new Set(adopted.map((i) => i.kpiItemId));

  const itemIds = selectable.map((i) => i.kpiItemId);
  const [questions, criteria] = await Promise.all([
    listQuestionsFor(companyId, itemIds),
    listRankCriteriaFor(companyId, itemIds),
  ]);

  /* この等級区分を対象として想定されていないランク基準しか無い項目。
     採点自体は行われる（採点は target_grades を見ず、項目ごとの唯一の閾値を使う）。
     つまり上位等級向けの閾値がそのまま当たるので、消さずに名前を出して注意を添える。 */
  const withoutCriteria = selectable.filter((i) => !i.hasCriteria).sort((a, b) => a.no - b.no);

  const th = grade ? (thresholds.find((t) => t.fromGradeId === grade.id) ?? null) : null;
  const raise = grade ? (raises.find((r) => r.gradeId === grade.id) ?? null) : null;
  const myReqs = grade ? gradeReqs.filter((r) => r.gradeId === grade.id) : [];
  const myPromo = grade ? promoReqs.filter((r) => r.gradeId === grade.id) : [];
  const myBehaviors = grade?.behaviorBand ? behaviors.filter((b) => b.band === grade.behaviorBand) : [];

  /* この項目がその等級区分で何点になるか。
     実際に選ばれていればその配点をそのまま使う。
     選ばれていない項目は、どの枠に入れるかを会社が自由に決められるようになったため
     点数を先読みできない。10点枠に入れた場合の点数を「めやす」として出す。 */
  const weightOf = (item: SelectableItem): number => {
    const hit = adopted.find((a) => a.kpiItemId === item.kpiItemId);
    if (hit) return hit.weight;
    if (item.isFixedSlot) return rule?.fixedSlotPoints ?? 0;
    return rule?.minorSlotPoints ?? 0;
  };
  const slotLabelOf = (item: SelectableItem): string => {
    if (item.isFixedSlot) return "固定枠";
    const hit = adopted.find((a) => a.kpiItemId === item.kpiItemId);
    if (hit?.isMajorSlot) return `${rule?.majorSlotPoints}点枠`;
    if (hit) return `${rule?.minorSlotPoints}点枠`;
    return "未採用";
  };

  /* 項目名から、その項目のランク基準（A〜E）へ飛ぶリンク。
     ?item= を付けるのは、飛んだ先の <details> を開いた状態でサーバーが返すため。
     この画面はサーバーコンポーネントなので、リンクだけでは開閉を切り替えられない。
     「選んだ項目」と「その項目をどう評価するか」を必ず行き来できるようにしておく。 */
  const criteriaHref = (kpiItemId: string): string =>
    `/criteria?grade=${grade?.id ?? ""}&item=${kpiItemId}#${anchorIdOf(kpiItemId)}`;

  return (
    <>
      {/* 項目ごとの採点の流れまで並ぶ長い画面。どの等級を見ているかを帯に固定する */}
      <PageTitle
        sticky
        title="評価の基準"
        lede="等級ごとの配点・選べる項目・ランクの決め方・昇格に必要な点数を確認できます。この画面は評価される方には表示されません。"
        tags={grade ? <span className="tag">表示中の等級 {grade.name}</span> : undefined}
      />

      <SectionHeading>等級を選ぶ</SectionHeading>
      <div className="mb-5 flex flex-wrap gap-2">
        {grades.map((g) => (
          <a key={g.id} href={`/criteria?grade=${g.id}`} className="chip" aria-current={g.id === grade?.id ? "true" : undefined}>
            {g.name}
          </a>
        ))}
      </div>

      {!grade ? (
        <EmptyState title="等級が登録されていません" body="会社の管理者に等級の登録を依頼してください。" />
      ) : (
        <>
          <SectionHeading>この等級の持ち点の型</SectionHeading>
          <PointDesign
            rule={rule}
            gradeName={grade.name}
            selectableCount={selectable.length}
          />

          <details className="card card-pad mt-3">
            <summary className="cursor-pointer text-[13px] font-semibold">ほかの等級区分と見くらべる</summary>
            <div className="mt-3">
              <PointRuleComparison rules={rules} currentGroup={pointGroup} />
              <p className="footnote mt-2">
                等級区分は配点をまとめる単位です。AMⅠとAMⅡ、ManagerⅠとManagerⅡは配点が同じで、等級要件の中身だけが違います。
              </p>
            </div>
          </details>

          <SectionHeading>昇格・昇給の条件</SectionHeading>
          <Card className="card-pad">
            <p className="m-0 text-[13px]">
              {th ? (
                <>
                  {grade.name} から次の等級へ上がるには{" "}
                  <span className="num font-bold">
                    <Num value={th.requiredKpiPoints} />
                    <span className="unit">点</span>
                  </span>{" "}
                  ／ 満点 <Num value={rule?.totalPoints ?? null} unit="点" />。行動指針は{" "}
                  <Num value={th.requiredBehaviorPoints} unit="点" /> 以上（{th.label}）
                  {th.isProvisional && (
                    <>
                      {" "}
                      <ProvisionalMark note="昇格に必要な点数は制度として未確定のため、叩き台の初期値です。管理画面から変更できます。" />
                    </>
                  )}
                </>
              ) : (
                "この等級からの昇格条件はまだ登録されていません。"
              )}
            </p>
            {raise && (
              <p className="m-0 mt-2 text-[13px]">
                昇給額は月額 <Num value={raise.monthlyAmount} unit="円" /> ／ 年額{" "}
                <Num value={raise.annualAmount} unit="円" />
                {raise.isProvisional && (
                  <>
                    {" "}
                    <ProvisionalMark note="昇給額は制度として未確定のため、叩き台の初期値です。管理画面から変更できます。" />
                  </>
                )}
                {raise.note ? `（${raise.note}）` : ""}
              </p>
            )}
            <p className="footnote m-0 mt-2">
              昇給は{scheme?.raiseRequiresAllA === false ? "満点" : "「選んだ項目がすべてA」"}が条件です。
              この点数はアンケートの回答画面には表示されません（回答が点数合わせにならないようにするためです）。
            </p>
          </Card>

          <SectionHeading>この等級で選べる項目</SectionHeading>
          {!rule ? (
            <ReasonNote>この等級区分の配点の型が登録されていないため、選べる項目を出せません。</ReasonNote>
          ) : (
            <SelectableItems
              items={selectable}
              withoutCriteria={withoutCriteria}
              majorSlotPoints={rule.majorSlotPoints}
              majorSlotCount={rule.majorSlotCount}
              minorSlotPoints={rule.minorSlotPoints}
              minorSlotCount={rule.minorSlotCount}
              fixedSlotPoints={rule.fixedSlotPoints}
              adoptedIds={adoptedIds}
              gradeName={grade.name}
              criteriaHref={criteriaHref}
            />
          )}

          <SectionHeading>いま採用している項目</SectionHeading>
          {!scheme ? (
            <ReasonNote>
              有効な評価セットが登録されていません。会社の管理者が等級区分ごとに項目と配点を設定すると表示されます。
            </ReasonNote>
          ) : adopted.length === 0 ? (
            <ReasonNote>
              {grade.name} の項目がまだ選ばれていません。上の「選べる項目」から{" "}
              {rule ? slotCountOf(rule) : 0} 件を選ぶ必要があります。
            </ReasonNote>
          ) : (
            <>
              <Card>
                {adopted.map((a) => {
                  const item = selectable.find((i) => i.kpiItemId === a.kpiItemId);
                  return (
                    <CardRow
                      key={a.id}
                      alignTop
                      title={
                        <>
                          {item ? `No.${item.no} ${item.name}` : "（この等級区分では選べない項目が入っています）"}{" "}
                          {a.isFixedSlot && <Badge tone="done">固定枠</Badge>}
                          {a.isMajorSlot && <Badge tone="active">金銭の枠</Badge>}
                        </>
                      }
                      sub={item ? `${item.categoryName ?? "カテゴリ未設定"} ／ 単位 ${item.unit}` : ""}
                      value={
                        <>
                          <Num value={a.weight} display />
                          <span className="unit">点</span>
                          {item && (
                            <p className="m-0 mt-1">
                              <a href={criteriaHref(item.kpiItemId)} className="text-[12px] underline">
                                評価の基準を見る
                              </a>
                            </p>
                          )}
                        </>
                      }
                    />
                  );
                })}
              </Card>
              <p className="footnote mt-2">
                合計 <Num value={adopted.reduce((sum, a) => sum + a.weight, 0)} unit="点" /> ／ 満点{" "}
                <Num value={rule?.totalPoints ?? scheme.totalPoints} unit="点" />。
              </p>
            </>
          )}

          <SectionHeading>1項目ずつの採点の流れ</SectionHeading>
          <p className="footnote mb-2">
            聞くこと → 実績値 → ランク → 点数、の順に1項目ぶんを通して見られます。点数は「配点 × ランクの割合」で決まり、
            割合は{" "}
            {ratios.length > 0
              ? ratios.map((r) => `${r.rank}=${Math.round(r.ratio * 100)}%`).join("、")
              : "まだ登録されていません"}
            です
            {ratios.some((r) => r.isProvisional) && (
              <>
                {" "}
                <ProvisionalMark note="ランクごとの割合は制度として未確定のため、叩き台の初期値です。" />
              </>
            )}
            。見たい項目を開いてください。
          </p>
          <ScoringFlow
            items={selectable}
            weightOf={weightOf}
            slotLabelOf={slotLabelOf}
            adoptedIds={adoptedIds}
            questions={questions}
            criteria={criteria}
            ratios={ratios}
            openItemId={sp.item ?? null}
          />

          <SectionHeading>等級要件（{grade.name}）</SectionHeading>
          {myReqs.length === 0 ? (
            <ReasonNote>この等級の要件が登録されていません。</ReasonNote>
          ) : (
            <div className="card-grid">
              {[
                { key: "support", title: "支援について" },
                { key: "operation", title: "運営について" },
              ].map((sec) => (
                <Card key={sec.key} className="card-pad">
                  <p className="section-heading m-0 mb-2">{sec.title}</p>
                  <ul className="m-0 list-disc space-y-1 pl-5 text-[13px]">
                    {myReqs
                      .filter((r) => r.category === sec.key)
                      .map((r) => (
                        <li key={r.id}>{r.text}</li>
                      ))}
                  </ul>
                </Card>
              ))}
            </div>
          )}
          <p className="footnote mt-2">
            等級要件達成率は「達成した項目数 ÷ この等級のアンケートで聞いた等級要件の項目数」で計算します。
            未回答の項目は未達として数えます。半期に目標として設定できるのは最大{" "}
            <Num value={grade.targetCap} unit="件" /> です（達成率の計算には使いません）。
          </p>

          <SectionHeading>昇格要件（受講後の報告書・テスト）</SectionHeading>
          {myPromo.length === 0 ? (
            <ReasonNote>この等級の昇格要件が登録されていません。</ReasonNote>
          ) : (
            <Card>
              {myPromo.map((p) => (
                <CardRow
                  key={p.id}
                  title={p.text}
                  sub={`${p.kind === "report" ? "受講して報告書を提出" : "独学してテストに合格"}${p.transitionLabel ? ` ／ ${p.transitionLabel}` : ""}`}
                  marks={p.isGate ? <Badge tone="alert">必須（未提出だと昇格不可）</Badge> : <Badge tone="done">任意</Badge>}
                />
              ))}
            </Card>
          )}

          {myBehaviors.length > 0 && (
            <>
              <SectionHeading>行動指針（{grade.name} の等級帯）</SectionHeading>
              <Card>
                {myBehaviors.map((b) => (
                  <CardRow
                    key={b.id}
                    alignTop
                    title={b.aspectName}
                    detail={
                      <ul className="m-0 mt-1 list-none space-y-0.5 p-0 text-[12px] text-[var(--ink-muted)]">
                        {b.levels.map((l) => (
                          <li key={l.id}>
                            <span className="num font-bold">{l.score}</span> {l.label}：{l.text}
                          </li>
                        ))}
                      </ul>
                    }
                  />
                ))}
              </Card>
            </>
          )}
        </>
      )}
    </>
  );
}
