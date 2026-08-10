import { requireRole } from "@/lib/session";
import {
  getActiveScheme,
  listBehaviorGuidelines,
  listGradeRequirements,
  listGrades,
  listPromotionRequirements,
  listPromotionThresholds,
  listRaiseSettings,
  listRankCriteria,
  listRankRatios,
  listSchemeItems,
} from "@/lib/queries";
import { Badge, Card, EmptyState, Num, PageTitle, ProvisionalMark, ReasonNote, SectionHeading } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * 評価基準の確認ページ（マネージャー以上のみ）。
 *
 * ここに出る数値（ランク基準・配点・昇格に必要な点数・昇給額）は
 * すべてDBのマスタから読んでいる。制度を変えるとこの画面の表示も変わる。
 * 評価される方には、この画面も、この画面が読む値も一切渡さない。
 */
export default async function CriteriaPage({ searchParams }: { searchParams: Promise<{ grade?: string }> }) {
  const viewer = await requireRole("MANAGER");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;
  const companyId = viewer.companyId;

  const [grades, scheme, gradeReqs, promoReqs, behaviors, thresholds, raises] = await Promise.all([
    listGrades(companyId),
    getActiveScheme(companyId),
    listGradeRequirements(companyId),
    listPromotionRequirements(companyId),
    listBehaviorGuidelines(companyId),
    listPromotionThresholds(companyId),
    listRaiseSettings(companyId),
  ]);

  const sp = await searchParams;
  const grade = grades.find((g) => g.id === sp.grade) ?? grades[0] ?? null;

  const items = scheme ? await listSchemeItems(companyId, scheme.id) : [];
  const ratios = scheme ? await listRankRatios(companyId, scheme.id) : [];
  const criteria = items.length > 0 ? await listRankCriteria(companyId, items.map((i) => i.kpiItemId)) : [];

  const th = grade ? (thresholds.find((t) => t.fromGradeId === grade.id) ?? null) : null;
  const raise = grade ? (raises.find((r) => r.gradeId === grade.id) ?? null) : null;
  const myReqs = grade ? gradeReqs.filter((r) => r.gradeId === grade.id) : [];
  const myPromo = grade ? promoReqs.filter((r) => r.gradeId === grade.id) : [];
  const myBehaviors = grade?.behaviorBand ? behaviors.filter((b) => b.band === grade.behaviorBand) : [];

  return (
    <>
      <PageTitle
        title="評価基準を確認する"
        lede="等級ごとの要件・KPIのランク基準・配点・昇格に必要な点数を確認できます。この画面は評価される方には表示されません。"
      />

      <SectionHeading>等級を選ぶ</SectionHeading>
      <div className="mb-5 flex flex-wrap gap-2">
        {grades.map((g) => (
          <a key={g.id} href={`/criteria?grade=${g.id}`} className="chip" aria-pressed={g.id === grade?.id}>
            {g.name}
          </a>
        ))}
      </div>

      {!grade ? (
        <EmptyState title="等級が登録されていません" body="会社の管理者に等級の登録を依頼してください。" />
      ) : (
        <>
          <Card className="card-pad hero-tint">
            <p className="m-0 text-[12px] text-[var(--ink-muted)]">{grade.name} から次の等級へ上がるための条件</p>
            <p className="num-display m-0 text-[36px] leading-tight text-[var(--accent)]">
              <Num value={th?.requiredKpiPoints ?? null} />
              <span className="unit">点 / 100点</span>
            </p>
            <p className="m-0 mt-2 text-[13px]">
              {th ? (
                <>
                  行動指針は <Num value={th.requiredBehaviorPoints} unit="点" /> 以上（{th.label}）
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
            <p className="footnote m-0 mt-2">
              この点数はアンケートの回答画面には表示されません（回答が点数合わせにならないようにするためです）。
            </p>
          </Card>

          {raise && (
            <>
              <SectionHeading>昇給額</SectionHeading>
              <Card className="card-pad">
                <p className="m-0 text-[13px]">
                  月額 <Num value={raise.monthlyAmount} unit="円" /> ／ 年額{" "}
                  <Num value={raise.annualAmount} unit="円" />
                  {raise.isProvisional && (
                    <>
                      {" "}
                      <ProvisionalMark note="昇給額は制度として未確定のため、叩き台の初期値です。管理画面から変更できます。" />
                    </>
                  )}
                </p>
                {raise.note && <p className="footnote m-0 mt-1">{raise.note}</p>}
              </Card>
            </>
          )}

          <SectionHeading>KPI 8項目と配点</SectionHeading>
          {!scheme ? (
            <ReasonNote>有効な評価セットが登録されていません。会社の管理者が8項目と配点を設定すると表示されます。</ReasonNote>
          ) : (
            <>
              <Card>
                {items.map((i) => {
                  const crits = criteria
                    .filter((c) => c.kpiItemId === i.kpiItemId)
                    .sort((a, b) => a.rank.localeCompare(b.rank));
                  return (
                    <div key={i.id} className="card-row items-start">
                      <div className="row-main">
                        <p className="todo-row-title m-0">
                          {i.name}
                          {i.isProvisional && (
                            <>
                              {" "}
                              <ProvisionalMark note={"制度として未確定の項目です（叩き台）。"} />
                            </>
                          )}
                        </p>
                        <p className="todo-row-sub m-0">
                          {i.isFixedSlot ? "固定枠（差し替えできません）" : (i.categoryName ?? "カテゴリ未設定")} ／ 単位{" "}
                          {i.unit} ／ {i.direction === "lower" ? "低いほど良い" : "高いほど良い"}
                        </p>
                        {i.formula && <p className="m-0 mt-1 text-[11px] text-[var(--ink-muted)]">計算式：{i.formula}</p>}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {crits.map((c) => (
                            <span key={c.id} className="badge badge-done">
                              {c.rank}：{c.displayLabel}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <Num value={i.weight} display />
                        <span className="unit">点</span>
                      </div>
                    </div>
                  );
                })}
              </Card>
              <p className="footnote mt-2">
                配点の合計 <Num value={items.reduce((sum, i) => sum + i.weight, 0)} unit="点" /> ／ 満点{" "}
                <Num value={scheme.totalPoints} unit="点" />。ランクごとの点数の割合は{" "}
                {ratios.map((r) => `${r.rank}=${Math.round(r.ratio * 100)}%`).join("、")}
                {ratios.some((r) => r.isProvisional) && (
                  <>
                    {" "}
                    <ProvisionalMark note="ランクごとの割合は制度として未確定のため、叩き台の初期値です。" />
                  </>
                )}
                。昇給は{scheme.raiseRequiresAllA ? "「選んだ8項目がすべてA」" : "満点"}が条件です。
              </p>
            </>
          )}

          <SectionHeading>等級要件（{grade.name}）</SectionHeading>
          {myReqs.length === 0 ? (
            <ReasonNote>この等級の要件が登録されていません。</ReasonNote>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
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
            半期に目標として設定できるのは最大 <Num value={grade.targetCap} unit="件" /> です。
            等級要件達成率は「達成した件数 ÷ この上限」で計算します。
          </p>

          <SectionHeading>昇格要件（受講後の報告書・テスト）</SectionHeading>
          {myPromo.length === 0 ? (
            <ReasonNote>この等級の昇格要件が登録されていません。</ReasonNote>
          ) : (
            <Card>
              {myPromo.map((p) => (
                <div key={p.id} className="card-row">
                  <div className="row-main">
                    <p className="todo-row-title m-0">{p.text}</p>
                    <p className="todo-row-sub m-0">
                      {p.kind === "report" ? "受講して報告書を提出" : "独学してテストに合格"}
                      {p.transitionLabel ? ` ／ ${p.transitionLabel}` : ""}
                    </p>
                  </div>
                  {p.isGate ? <Badge tone="alert">必須（未提出だと昇格不可）</Badge> : <Badge tone="done">任意</Badge>}
                </div>
              ))}
            </Card>
          )}

          {myBehaviors.length > 0 && (
            <>
              <SectionHeading>行動指針（{grade.name} の等級帯）</SectionHeading>
              <Card>
                {myBehaviors.map((b) => (
                  <div key={b.id} className="card-row items-start">
                    <div className="row-main">
                      <p className="todo-row-title m-0">{b.aspectName}</p>
                      <ul className="m-0 mt-1 list-none space-y-0.5 p-0 text-[12px] text-[var(--ink-muted)]">
                        {b.levels.map((l) => (
                          <li key={l.id}>
                            <span className="num font-bold">{l.score}</span> {l.label}：{l.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </Card>
            </>
          )}
        </>
      )}
    </>
  );
}
