import { clsx } from "clsx";
import { redirect } from "next/navigation";
import { canSeeCriteria, homePathFor, requireRoute } from "@/lib/session";
import {
  getActiveScheme,
  listBehaviorGuidelines,
  listGradeRequirements,
  listGrades,
  listPromotionRequirements,
  listPromotionThresholds,
  listRaiseSettings,
} from "@/lib/queries";
import { currentVersionRows } from "@/lib/domain/versioned-master";
import { pointGroupLabel, promotionStepFrom } from "@/lib/domain/grade-label";
import {
  Badge,
  Card,
  CardRow,
  ChipLink,
  Disclosure,
  EmptyState,
  InlineDetail,
  Num,
  PageTitle,
  ProvisionalMark,
  ReasonNote,
  SectionHeading,
} from "@/components/ui";
import {
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
 * 一般（EMPLOYEE）には、この画面も、この画面が読む値も一切渡さない。
 *
 * 画面の並びは「どの等級を見るか → 満点の内訳 → 選べる項目 → 1項目ずつの採点の流れ」。
 * 情報量が多いので、項目ごとの細かい話は既定で畳んでおき、見たいものだけ開く。
 */
export default async function CriteriaPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string; item?: string }>;
}) {
  const viewer = await requireRoute("/criteria");
  // 配点・閾値・必要点数は一般の方に出さない（明示要件）。
  // requireRoute と canSeeCriteria の二重で止めるのは、見せてよいロールの定義が
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
  /* 昇格の段階の呼び名は等級名から作る（S1・A1）。保存してある段階の文字列は名前を変えても追従しない */
  const step = grade ? promotionStepFrom(grade.id, grades, thresholds) : null;
  const raise = grade ? (raises.find((r) => r.gradeId === grade.id) ?? null) : null;
  const myReqs = grade
    ? currentVersionRows(gradeReqs).filter((r) => r.gradeId === grade.id && r.isActive)
    : [];
  const myPromo = grade
    ? currentVersionRows(promoReqs).filter((r) => r.gradeId === grade.id && r.isActive)
    : [];
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
     ?item= を付けるのは、飛んだ先の畳んだ箱を開いた状態でサーバーが返すため。
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
        lede="等級ごとの配点・選べる項目・ランクの決め方・昇格に必要な点数を確認できます。この画面は一般の方には表示されません。"
        tags={grade ? <span className="tag">表示中の等級 {grade.name}</span> : undefined}
      />

      <SectionHeading>等級を選ぶ</SectionHeading>
      <div className="mb-5 flex flex-wrap gap-2">
        {grades.map((g) => (
          <ChipLink key={g.id} href={`/criteria?grade=${g.id}`} current={g.id === grade?.id}>
            {g.name}
          </ChipLink>
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

          <div className="mt-3">
            <Disclosure summary="ほかの等級区分と見くらべる" meta={`全${rules.length}区分`}>
              <PointRuleComparison rules={rules} grades={grades} currentGroup={pointGroup} />
              <p className="footnote mt-2">
                等級区分は配点をまとめる単位です。
                同じ区分の等級（{pointGroupLabel("AM", grades)}、{pointGroupLabel("Manager", grades)}）は配点が同じです。
                違うのは等級要件の中身だけです。
              </p>
            </Disclosure>
          </div>

          <SectionHeading>昇格・昇給の条件</SectionHeading>
          <Card className="card-pad">
            <p className="m-0 text-sub">
              {th ? (
                <>
                  {grade.name} から次の等級へ上がるには{" "}
                  <span className="num font-bold">
                    <Num value={th.requiredKpiPoints} />
                    <span className="unit">点</span>
                  </span>{" "}
                  ／ 満点 <Num value={rule?.totalPoints ?? null} unit="点" />。行動指針は{" "}
                  <Num value={th.requiredBehaviorPoints} unit="点" /> 以上{step && `（${step}）`}
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
              <p className="m-0 mt-2 text-sub">
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
              この点数はアンケートの回答画面には表示されません。
            </p>
            {/* 「出さない」という事実は残し、その理由だけ畳む */}
            <div className="mt-1">
              <InlineDetail summary="回答画面に点数を出さない理由">
                <p className="m-0 text-sub">回答が点数合わせにならないようにするためです。</p>
              </InlineDetail>
            </div>
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

          {/* 合計と満点は一覧の要約なので、一覧の下に1行で積まず見出しの右に置く（左に1行だけ残ると右側が空く。§28-9） */}
          <SectionHeading
            aside={
              scheme && adopted.length > 0 ? (
                <span className="footnote">
                  合計 <Num value={adopted.reduce((sum, a) => sum + a.weight, 0)} unit="点" /> ／ 満点{" "}
                  <Num value={rule?.totalPoints ?? scheme.totalPoints} unit="点" />
                </span>
              ) : undefined
            }
          >
            いま採用している項目
          </SectionHeading>
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
                            <a href={criteriaHref(item.kpiItemId)} className="text-note underline">
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
          )}

          {/* 読み方の案内は見出しに添える1行なので、見出しの右に置く（§28-9）。項目が無いときは案内しない */}
          <SectionHeading aside={selectable.length > 0 ? <span className="footnote">見たい項目を開いてください</span> : undefined}>
            1項目ずつの採点の流れ
          </SectionHeading>
          {/* 点数の決まり方（式とランクごとの割合）は仕組みの解説。
              33項目の一覧より前に置くと、毎回そこを読み飛ばすことになる */}
          <div className="mb-2">
            <InlineDetail summary="点数の決まり方（配点とランクの割合）">
              <p className="m-0 text-sub">聞くこと → 実績値 → ランク → 点数、の順に1項目ぶんを通して見られます。</p>
              <p className="m-0 mt-1 text-sub">点数は「配点 × ランクの割合」で決まります。</p>
              <p className="m-0 mt-1 text-sub">
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
                。
              </p>
            </InlineDetail>
          </div>
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
                  <ul className="m-0 list-disc space-y-1 pl-5 text-sub">
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
          {/* 計算式は「知りたくなったときに読む」もの。要件の一覧より前に出す必要はない */}
          <div className="mt-2">
            <InlineDetail summary="等級要件達成率の出し方と、目標の上限">
              <p className="m-0 text-sub">等級要件達成率は「達成した項目数 ÷ 聞いた項目数」で計算します。</p>
              <p className="m-0 mt-1 text-sub">分母は、この等級のアンケートで聞いた等級要件の項目数です。</p>
              <p className="m-0 mt-1 text-sub">未回答の項目は未達として数えます。</p>
              <p className="m-0 mt-1 text-sub">
                半期に目標として設定できるのは最大 <Num value={grade.targetCap} unit="件" /> です。
                この上限は達成率の計算には使いません。
              </p>
            </InlineDetail>
          </div>

          <SectionHeading>昇格要件（受講後の報告書・テスト）</SectionHeading>
          {myPromo.length === 0 ? (
            <ReasonNote>この等級の昇格要件が登録されていません。</ReasonNote>
          ) : (
            <Card>
              {myPromo.map((p) => (
                <CardRow
                  key={p.id}
                  title={p.text}
                  /* 種類と段階は短い補足なので、札と一緒に行の右端へまとめる
                     （名前の下に積むと、件数ぶん右側が空いたまま残る。§28-9） */
                  marks={
                    <div className="row-actions gap-x-3">
                      <span className="text-note text-ink-muted">
                        {p.kind === "report" ? "受講して報告書を提出" : "独学してテストに合格"}
                        {step ? ` ／ ${step}` : ""}
                      </span>
                      {p.isGate ? <Badge tone="alert">必須（未提出だと昇格の判定は否）</Badge> : <Badge tone="done">任意</Badge>}
                    </div>
                  }
                />
              ))}
            </Card>
          )}

          {myBehaviors.length > 0 && (
            <>
              <SectionHeading>行動指針（{grade.name} の等級帯）</SectionHeading>
              {/* 観点ごとの段階は1行が短いので、等級要件と同じく広い画面では2列のカードに並べる
                  （1列に積むと右側が空いたまま残る。§28-9） */}
              <div className="card-grid">
                {myBehaviors.map((b, i) => {
                  /* 観点が奇数のとき、最後の1枚は2列ぶんに広げて段階を2段に組む
                     （1枚だけ左に残ると、その高さぶん右側が空く） */
                  const wide = myBehaviors.length % 2 === 1 && i === myBehaviors.length - 1;
                  return (
                    <Card key={b.id} className={clsx("card-pad", wide && "sm:col-span-2")}>
                      <p className="section-heading m-0 mb-2">{b.aspectName}</p>
                      <ul
                        className={clsx(
                          "m-0 list-none space-y-0.5 p-0 text-note text-ink-muted",
                          wide && "md:columns-2 md:gap-x-8",
                        )}
                      >
                        {b.levels.map((l) => (
                          <li key={l.id} className="break-inside-avoid">
                            <span className="num font-bold">{l.score}</span> {l.label}：{l.text}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
