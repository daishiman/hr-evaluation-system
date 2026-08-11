import Link from "next/link";
import { requireRole } from "@/lib/session";
import {
  countEvaluationsByOffice,
  getRaisePolicy,
  listCycles,
  listKgiCoefficients,
  listOffices,
  listOfficeKgiResults,
  listOfficeKgiRevisions,
} from "@/lib/queries";
import { matchKgiCoefficient } from "@/lib/domain/kgi";
import { RecordForm } from "@/components/RecordForm";
import { Badge, Card, EmptyState, LinkButton, Num, PageTitle, ProvisionalMark, ReasonNote, RecordList, SectionHeading } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { formatDate, formatPeriod, CYCLE_STATUS_LABEL } from "@/lib/view";

export const dynamic = "force-dynamic";

/**
 * 事業所KGIの達成率を登録する画面（会社の管理者以上）。
 *
 * 賞与の個人Pt（＝KPI評価点合計 × 達成係数）を出すために要る実績値を、
 * 事業所ごと・評価期間ごとに人が登録する。アンケートには聞く設問が無く、
 * 元スプレッドシートでも別表から手で持ってきていた数字のため。
 *
 * 未登録の事業所は「未登録」と出し、0% とは書かない。
 * 0% と書くと「KGIをまったく達成できなかった」という別の意味になり、
 * 最小係数で賞与額が算出されてしまうため。
 */
export default async function AdminKgi({ searchParams }: { searchParams: Promise<{ cycle?: string }> }) {
  const viewer = await requireRole("COMPANY_ADMIN");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;
  const companyId = viewer.companyId;

  const [cycles, offices, coefficients, policy] = await Promise.all([
    listCycles(companyId),
    listOffices(companyId),
    listKgiCoefficients(companyId),
    getRaisePolicy(companyId),
  ]);

  const sp = await searchParams;
  const cycle = cycles.find((c) => c.id === sp.cycle) ?? cycles[0] ?? null;

  if (!cycle) {
    return (
      <>
        <PageTitle title="事業所KGIの達成率" lede="賞与の個人Ptを出すために使う、事業所ごとの達成率を登録します。" />
        <EmptyState
          title="評価期間がまだありません"
          body="達成率は評価期間ごとに登録します。先に評価期間を作ってください。"
          action={
            <LinkButton href="/admin/cycles" variant="primary">
              評価期間を作る
            </LinkButton>
          }
        />
      </>
    );
  }

  const [results, revisions, counts] = await Promise.all([
    listOfficeKgiResults(companyId, cycle.id),
    listOfficeKgiRevisions(companyId, cycle.id),
    countEvaluationsByOffice(companyId, cycle.id),
  ]);

  const coefficientRows = coefficients.map((c) => ({
    label: c.label,
    lowerBound: c.lowerBound,
    upperBound: c.upperBound,
    coefficient: c.coefficient,
    displayOrder: c.displayOrder,
  }));
  const yenPerPoint = policy?.bonusYenPerPoint ?? 0;
  const registered = results.length;

  return (
    <>
      <PageTitle
        title="事業所KGIの達成率"
        lede="賞与の個人Pt（＝KPI評価点合計 × 達成係数）を出すために使う数字です。事業所ごと・評価期間ごとに登録します。"
      />

      {coefficients.length === 0 && (
        <div className="mb-4">
          <ReasonNote
            action={
              <LinkButton href="/admin/masters" variant="secondary">
                達成係数を設定する
              </LinkButton>
            }
          >
            達成係数の表が登録されていないため、達成率を入れても個人Pt・賞与額を出せません。
          </ReasonNote>
        </div>
      )}
      {yenPerPoint <= 0 && (
        <div className="mb-4">
          <ReasonNote
            action={
              <LinkButton href="/admin/raises" variant="secondary">
                昇給の設定を開く
              </LinkButton>
            }
          >
            個人Pt 1点あたりの金額が未設定のため、個人Ptまでは出せますが賞与額は出せません。
          </ReasonNote>
        </div>
      )}

      <SectionHeading>評価期間を選ぶ</SectionHeading>
      <div className="mb-5 flex flex-wrap gap-2">
        {cycles.map((c) => (
          <Link key={c.id} href={`/admin/kgi?cycle=${c.id}`} className="chip" aria-current={c.id === cycle.id ? "true" : undefined}>
            {c.name}
          </Link>
        ))}
      </div>

      <Card className="card-pad">
        <p className="m-0 text-[13px]">
          {cycle.name}（{formatPeriod(cycle.periodStart, cycle.periodEnd)}／
          {CYCLE_STATUS_LABEL[cycle.status] ?? cycle.status}）の達成率を、
          <Num value={offices.length} unit="事業所" /> 中 <Num value={registered} unit="事業所" /> 登録済みです。
        </p>
        {counts.unknownOffice > 0 && (
          <p className="footnote m-0 mt-2">
            この期間の評価のうち <Num value={counts.unknownOffice} unit="件" />
            は、どの事業所の方か分からないため（社員に事業所が設定されていません）達成率を当てられません。
            社員の画面で事業所を設定してから集計し直してください。
          </p>
        )}
      </Card>

      <SectionHeading>事業所ごとの達成率</SectionHeading>
      {offices.length === 0 ? (
        <ReasonNote
          action={
            <LinkButton href="/admin/masters" variant="secondary">
              事業所を確認する
            </LinkButton>
          }
        >
          事業所が登録されていません。先に事業所を登録してください。
        </ReasonNote>
      ) : (
        <div className="grid gap-3">
          {offices.map((o) => {
            const current = results.find((r) => r.officeId === o.id) ?? null;
            const match = current ? matchKgiCoefficient(current.achievementRate, coefficientRows) : null;
            const c = counts.byOffice.get(o.id) ?? { draft: 0, finalized: 0, withBonus: 0 };

            return (
              <div key={o.id}>
                <RecordForm
                  url="/api/kgi-results"
                  method="PUT"
                  fixed={{ officeId: o.id, cycleId: cycle.id }}
                  title={o.name}
                  submitLabel="この事業所の達成率を保存する"
                  description={
                    current
                      ? `いまの登録：${current.achievementRate}%${
                          match ? `（達成係数 ${match.coefficient}／「${match.row.label}」）` : "（当てはまる達成係数が表にありません）"
                        }。確認中の評価 ${c.draft}件に反映され、確定済み ${c.finalized}件は据え置かれます。`
                      : `まだ登録されていません。登録すると、この事業所の確認中の評価 ${c.draft}件に個人Pt・賞与額が入ります（確定済み ${c.finalized}件は据え置き）。`
                  }
                  fields={[
                    {
                      name: "achievementRate",
                      label: "KGI達成率",
                      type: "number",
                      required: true,
                      defaultValue: current?.achievementRate ?? null,
                      unit: "%",
                      help: "実績 ÷ 目標 × 100。小数も入力できます（例：99.5）",
                    },
                    {
                      name: "reason",
                      label: "変更の理由",
                      type: "text",
                      help: "値を変えたときだけ、変更履歴に記録されます",
                    },
                    {
                      name: "note",
                      label: "数字の出どころ",
                      type: "text",
                      defaultValue: current?.note ?? "",
                      help: "例：2026年度上期 事業所別KGI集計表",
                    },
                  ]}
                />
                <p className="footnote mt-1">
                  {current ? (
                    <>
                      最終更新 {formatDate(current.updatedAt)}
                      {current.recordedByName ? `／${current.recordedByName}` : ""}。
                      個人Pt・賞与額が入っている評価は <Num value={c.withBonus} unit="件" />
                      です（賞与額は配点が未確定のため <ProvisionalMark /> 仮の金額です）。
                    </>
                  ) : (
                    <>
                      未登録のため、この事業所の方の個人Pt・賞与額は「まだ出せません」と表示されます（0円とは表示しません）。
                    </>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <SectionHeading>使われる達成係数</SectionHeading>
      {coefficients.length === 0 ? (
        <ReasonNote>達成係数が登録されていません。</ReasonNote>
      ) : (
        <>
          {/* 区分ごとの係数を上から見比べる参照表。行の項目が同じで数値を突き合わせる用途なので表のまま。 */}
          <DataTable
            caption="使われる達成係数"
            rows={coefficients}
            rowKey={(c) => c.id}
            columns={[
              {
                key: "label",
                header: "区分",
                role: "title",
                cell: (c) => (
                  <>
                    {c.label}
                    {c.isProvisional ? (
                      <>
                        {" "}
                        <ProvisionalMark />
                      </>
                    ) : null}
                  </>
                ),
              },
              { key: "coefficient", header: "達成係数", num: true, cell: (c) => <Num value={c.coefficient} /> },
              {
                key: "range",
                header: "適用する達成率",
                cell: (c) =>
                  `${c.lowerBound === null ? "下限なし" : `${c.lowerBound}% 以上`} ／ ${
                    c.upperBound === null ? "上限なし" : `${c.upperBound}% 未満`
                  }`,
              },
            ]}
          />
          <p className="footnote">
            元の表は「111〜120%」のように整数で書かれていて、99%と100%の間・110%と111%の間が抜けていました。
            99.5% のような小数が来てもどこかに必ず当てはまるよう、下限以上・上限未満で連続させています。
            係数そのものは <Link href="/admin/masters">等級・昇格・行動指針</Link> で変更できます。
          </p>
        </>
      )}

      <SectionHeading>この評価期間の変更履歴（{revisions.length}件）</SectionHeading>
      {revisions.length === 0 ? (
        <Card className="card-pad">
          <p className="footnote m-0">
            まだ達成率を登録・変更していません。上で保存すると、変更前後の値と理由がここに残ります。
          </p>
        </Card>
      ) : (
        /* 履歴は1件ごとの出来事（理由という長い文章を含む）なので、表ではなくカードで出す
           （docs/product/spec.md §5-5）。 */
        <RecordList
          items={revisions.map((r) => ({
            key: r.id,
            title: r.officeName ?? "—",
            marks: r.beforeRate === null ? <Badge tone="active">初回登録</Badge> : undefined,
            rows: [
              { label: "変更した日", value: formatDate(r.createdAt) },
              {
                label: "達成率",
                value: (
                  <>
                    {r.beforeRate === null ? "未登録" : <Num value={r.beforeRate} unit="%" />}
                    <span className="mx-1 text-[var(--ink-muted)]">→</span>
                    <Num value={r.afterRate} unit="%" />
                  </>
                ),
              },
              { label: "変更した人", value: r.revisedByName ?? "—" },
            ],
            note: r.reason ? `理由：${r.reason}` : null,
          }))}
        />
      )}

      <p className="footnote">
        確定済みの評価は、確定した時点の達成率・係数・金額のまま据え置きます（ここで達成率を変えても動きません）。
        確定前の評価だけが、保存と同時に個人Pt・賞与額を計算し直します。
      </p>
    </>
  );
}
