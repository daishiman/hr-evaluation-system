import Link from "next/link";
import { requireRole } from "@/lib/session";
import {
  getRaisePolicy,
  listGrades,
  listOffices,
  listRaiseExceptions,
  listRaisePatterns,
  listRaiseRevisions,
  listRaiseSettings,
} from "@/lib/queries";
import { RecordForm } from "@/components/RecordForm";
import { Badge, Card, CardRow, Disclosure, EmptyState, Num, PageTitle, ProvisionalMark, ReasonNote, RecordList, SectionHeading } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { formatDate } from "@/lib/view";

export const dynamic = "force-dynamic";

/**
 * 昇給の設定。
 *
 * これまでスプレッドシートの「昇給ルール（仮）」シートに書いてあった内容を、
 * そのまま画面から直せるようにしたもの。金額はここだけで決め、コードには書かない。
 * 金額を変えたときは改定履歴に1行残す（あとから「いつ・いくらから・なぜ」を説明できるようにするため）。
 */
export default async function AdminRaises({ searchParams }: { searchParams: Promise<{ grade?: string }> }) {
  const viewer = await requireRole("COMPANY_ADMIN");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;
  const companyId = viewer.companyId;

  const [grades, raises, policy, patterns, exceptions, revisions, offices] = await Promise.all([
    listGrades(companyId),
    listRaiseSettings(companyId),
    getRaisePolicy(companyId),
    listRaisePatterns(companyId),
    listRaiseExceptions(companyId),
    listRaiseRevisions(companyId),
    listOffices(companyId),
  ]);

  const sp = await searchParams;
  const grade = grades.find((g) => g.id === sp.grade) ?? grades[0] ?? null;
  const raise = grade ? (raises.find((r) => r.gradeId === grade.id) ?? null) : null;
  const myRevisions = grade ? revisions.filter((r) => r.gradeId === grade.id) : [];

  return (
    <>
      <PageTitle
        title="昇給の設定"
        lede="昇給の条件と、等級ごとの金額をここで決めます。金額を変えると改定履歴に記録が残ります。"
      />

      <SectionHeading>昇給の条件</SectionHeading>
      {!policy ? (
        <ReasonNote>昇給ルールが登録されていません。初期データの投入が済んでいるかご確認ください。</ReasonNote>
      ) : (
        <>
          {policy.isProvisional && (
            <div className="mb-3">
              <ReasonNote>
                <ProvisionalMark /> 元の資料が「仮」の状態だったため、そのままの値を入れています。決まった内容に直して保存してください。
              </ReasonNote>
            </div>
          )}
          <RecordForm
            url="/api/masters"
            method="PUT"
            fixed={{ kind: "raisePolicy", id: policy.id }}
            submitLabel="昇給の条件を保存する"
            description={`判定の単位：${policy.judgeUnit}${policy.judgeTimingNote ? `（${policy.judgeTimingNote}）` : ""}`}
            fields={[
              {
                name: "requiredACount",
                label: "昇給に必要なAの数",
                type: "number",
                required: true,
                defaultValue: policy.requiredACount,
                unit: `項目 / ${policy.selectedItemCount}項目中`,
              },
              { name: "chancesPerYear", label: "年間の昇給機会", type: "number", required: true, defaultValue: policy.chancesPerYear, unit: "回" },
              { name: "reflectUpperNote", label: "上期評価の反映時期", type: "text", defaultValue: policy.reflectUpperNote ?? "" },
              { name: "reflectLowerNote", label: "下期評価の反映時期", type: "text", defaultValue: policy.reflectLowerNote ?? "" },
              { name: "targetNote", label: "対象者の範囲", type: "text", defaultValue: policy.targetNote ?? "" },
              {
                name: "allowDecrease",
                label: "降給",
                type: "checkbox",
                defaultValue: policy.allowDecrease,
                help: "評価が下がったときに給与を下げる（通常はチェックしません）",
              },
            ]}
          />
        </>
      )}

      <SectionHeading>等級を選ぶ</SectionHeading>
      {grades.length === 0 ? (
        <ReasonNote>等級が登録されていません。</ReasonNote>
      ) : (
        <div className="mb-5 flex flex-wrap gap-2">
          {grades.map((g) => (
            <Link key={g.id} href={`/admin/raises?grade=${g.id}`} className="chip" aria-current={g.id === grade?.id ? "true" : undefined}>
              {g.name}
            </Link>
          ))}
        </div>
      )}

      {grade && (
        <>
          <SectionHeading>{grade.name} の昇給額</SectionHeading>
          {!raise ? (
            <ReasonNote>この等級の昇給額が登録されていません。</ReasonNote>
          ) : (
            <>
              {raise.isProvisional && (
                <div className="mb-3">
                  <ReasonNote>
                    <ProvisionalMark /> いまの金額は叩き台の初期値です。実際の金額に変えて保存してください。
                  </ReasonNote>
                </div>
              )}
              <RecordForm
                url="/api/masters"
                method="PUT"
                fixed={{ kind: "raise", id: raise.id }}
                submitLabel="昇給額を保存する"
                description={`年額は「月額 × 月数」で自動計算します（いまの年額 ${raise.annualAmount.toLocaleString("ja-JP")}円）。${
                  raise.capNote ? `／${raise.capNote}` : ""
                }`}
                fields={[
                  { name: "monthlyAmount", label: "月額", type: "number", required: true, defaultValue: raise.monthlyAmount, unit: "円" },
                  { name: "months", label: "支給の月数", type: "number", required: true, defaultValue: raise.months, unit: "ヶ月" },
                  {
                    name: "maxCount",
                    label: "同じ等級での昇給回数の上限",
                    type: "number",
                    required: true,
                    defaultValue: raise.maxCount,
                    unit: "回",
                  },
                  {
                    name: "effectiveFrom",
                    label: "適用開始",
                    type: "date",
                    help: "金額を変えたときだけ、改定履歴に記録されます",
                  },
                  { name: "reason", label: "改定の理由", type: "text", help: "例：2026年度の賃上げ方針にあわせて増額" },
                  { name: "note", label: "補足", type: "text", defaultValue: raise.note ?? "" },
                ]}
              />
            </>
          )}

          <div className="mt-4">
            <Disclosure summary={`${grade.name} の改定履歴`} meta={`${myRevisions.length}件`}>
              {myRevisions.length === 0 ? (
                <p className="footnote m-0">
                  まだ金額を変えていません。上の金額を変えて保存すると、変更前後の金額と理由がここに残ります。
                </p>
              ) : (
                /* 改定履歴は1件ごとの出来事（理由という長い文章を含む）なのでカードで出す
                   （docs/product/spec.md §5-5）。 */
                <RecordList
                  items={myRevisions.map((r) => ({
                    key: r.id,
                    title: formatDate(r.createdAt),
                    rows: [
                      {
                        label: "月額",
                        value: (
                          <>
                            <Num value={r.beforeAmount} unit="円" />
                            <span className="mx-1 text-[var(--ink-muted)]">→</span>
                            <Num value={r.afterAmount} unit="円" />
                          </>
                        ),
                      },
                      { label: "適用開始", value: r.effectiveFrom ?? "—" },
                      { label: "変更した人", value: r.revisedByName ?? "—" },
                    ],
                    note: r.reason ? `理由：${r.reason}` : null,
                  }))}
                />
              )}
            </Disclosure>
          </div>
        </>
      )}

      <div className="mt-4">
        <Disclosure summary="事業所ごとの調整率" meta={offices.length === 0 ? "事業所なし" : `${offices.length}事業所`}>
          <p className="m-0 text-[13px]">
            事業所ごとに金額を変える場合だけ設定します。1.0 のままなら等級の金額をそのまま適用します。
          </p>
          <div className="mt-3 grid gap-3">
            {offices.length === 0 ? (
              <ReasonNote>事業所が登録されていません。</ReasonNote>
            ) : (
              offices.map((o) => (
                <RecordForm
                  key={o.id}
                  url="/api/masters"
                  method="PUT"
                  fixed={{ kind: "office", id: o.id }}
                  title={o.name}
                  submitLabel="この事業所の設定を保存する"
                  description={
                    raise
                      ? `いまの調整率だと、${grade?.name}の月額は ${Math.round(raise.monthlyAmount * o.raiseAdjustRate).toLocaleString("ja-JP")}円 になります。`
                      : undefined
                  }
                  fields={[
                    { name: "name", label: "事業所名", type: "text", required: true, defaultValue: o.name },
                    { name: "raiseAdjustRate", label: "調整率", type: "number", required: true, defaultValue: o.raiseAdjustRate, unit: "倍" },
                  ]}
                />
              ))
            )}
          </div>
        </Disclosure>
      </div>

      <div className="mt-4">
        <Disclosure summary="判定ルールと特例を確認する" meta={`判定${patterns.length}件・特例${exceptions.length}件`}>
          <SectionHeading>ランクの組み合わせと扱い</SectionHeading>
          {patterns.length === 0 ? (
            <ReasonNote>判定パターンが登録されていません。</ReasonNote>
          ) : (
            <div className="mt-3">
              {/* ランクの組み合わせを上から見比べる参照表。項目が揃っているので表のまま。 */}
              <DataTable
                caption="ランクの組み合わせと扱い"
                rows={patterns}
                rowKey={(p) => p.id}
                columns={[
                  { key: "pattern", header: "KPIのランク", role: "title", cell: (p) => p.pattern },
                  {
                    key: "judgment",
                    header: "判定",
                    role: "mark",
                    cell: (p) => (
                      <Badge tone={p.judgment.includes("満たす") ? "done" : "required"}>{p.judgment}</Badge>
                    ),
                  },
                  { key: "treatment", header: "扱い", cell: (p) => p.treatment },
                ]}
              />
            </div>
          )}

          <SectionHeading>特例の扱い（{exceptions.length}件）</SectionHeading>
          {exceptions.length === 0 ? (
            <ReasonNote>特例が登録されていません。</ReasonNote>
          ) : (
            <Card className="mt-3">
              {exceptions.map((e) => (
                <CardRow
                  key={e.id}
                  title={e.caseText}
                  sub={e.handling}
                  marks={e.excludesJudgement ? <Badge tone="required">判定の対象外</Badge> : undefined}
                />
              ))}
            </Card>
          )}
          <p className="footnote">
            特例は自動適用されません。該当する方がいる期は、評価を確定する前に上長が確認してください。
          </p>
        </Disclosure>
      </div>
    </>
  );
}
