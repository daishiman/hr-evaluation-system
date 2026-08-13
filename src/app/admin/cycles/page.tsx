import Link from "next/link";
import { requireRole } from "@/lib/session";
import { getActiveScheme, listCycles, listForms } from "@/lib/queries";
import { ActionButton } from "@/components/ActionButton";
import { RecordForm } from "@/components/RecordForm";
import { Badge, Card, CardHead, DownloadButton, EmptyState, LinkButton, PageTitle, ReasonNote, SectionHeading } from "@/components/ui";
import { CYCLE_STATUS_LABEL, formatPeriod } from "@/lib/view";
import { listUnfinalizedNamesInCycle } from "@/lib/stalled";
import { cycleCloseConfirmText } from "@/lib/domain/stalled-evaluations";
import { cycleOpenReadiness } from "@/lib/domain/setup-readiness";
import { loadSchemeReadiness } from "@/lib/scheme-readiness";

export const dynamic = "force-dynamic";

/**
 * 評価期間（半期）の管理。
 * 「期間を作る → アンケートを配る → 受付を締め切る」の順に並べる。
 */
export default async function AdminCycles() {
  const viewer = await requireRole("COMPANY_ADMIN");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;
  const companyId = viewer.companyId;

  const [cycles, forms, scheme] = await Promise.all([
    listCycles(companyId),
    listForms(companyId),
    getActiveScheme(companyId),
  ]);

  // 受付中の期間だけ、「まだ確定していない人」を先に数えておく。
  // 放置は締め切った瞬間に生まれるので、締め切る前に見せないと気づくのが1回遅れる。
  // 締め切りは止めない（期末に締められないほうが業務は困る）。
  const openCycles = cycles.filter((c) => c.status === "open");
  const unfinalized = new Map<string, (string | null)[]>(
    await Promise.all(
      openCycles.map(
        async (c) => [c.id, await listUnfinalizedNamesInCycle(companyId, c.id)] as [string, (string | null)[]],
      ),
    ),
  );

  const thisYear = new Date().getFullYear();
  const schemeReadinessByCycle = new Map(
    await Promise.all(
      cycles.map(async (cycle) => [cycle.id, await loadSchemeReadiness(companyId, cycle.schemeId)] as const),
    ),
  );

  return (
    <>
      <PageTitle
        title="評価期間"
        lede="半期ごとの評価期間を作ります。期間を作ってからアンケートを配り、期末に受付を締め切って評価を作ります。"
      />

      {!scheme && (
        <div className="mb-4">
          <ReasonNote action={<LinkButton href="/admin/scheme" variant="secondary">評価セットを設定する</LinkButton>}>
            有効な評価セット（KPIの項目と配点）がないため、評価期間を作れません。
          </ReasonNote>
        </div>
      )}

      <SectionHeading>評価期間を作る</SectionHeading>
      <RecordForm
        url="/api/cycles"
        method="POST"
        submitLabel="この期間を作る"
        description="いま有効な評価セット（KPIの項目と配点）がこの期間に紐づきます。あとで配点を変えても、この期間の判定条件は作成時のまま残ります。"
        resetAfterSubmit
        fields={[
          { name: "name", label: "期間の名前", type: "text", required: true, placeholder: `${thisYear}年度 上期`, help: "例：2026年度 上期" },
          { name: "periodStart", label: "開始日", type: "date", required: true },
          { name: "periodEnd", label: "終了日", type: "date", required: true },
        ]}
      />

      <SectionHeading>これまでの評価期間（{cycles.length}件）</SectionHeading>
      {cycles.length === 0 ? (
        <EmptyState title="評価期間がまだありません" body="上のフォームから最初の半期を作ってください。" />
      ) : (
        <div className="stack">
          {cycles.map((c) => {
            const my = forms.filter((f) => f.cycleId === c.id);
            const published = my.filter((f) => f.status === "published").length;
            const openReadiness = cycleOpenReadiness({
              schemeReady: schemeReadinessByCycle.get(c.id)?.schemeReady === true,
              publishedFormCount: published,
            });
            const responses = my.reduce((sum, f) => sum + Number(f.responseCount ?? 0), 0);
            // 受付中の期間だけ数えている。0件のときは何も足さない（余計な確認を挟まない）。
            const pending = unfinalized.get(c.id) ?? [];
            return (
              <Card key={c.id} className="card-pad" off={c.status === "closed"}>
                <CardHead
                  title={
                    <>
                      {c.name}{" "}
                      {c.status === "open" ? (
                        <Badge tone="active">回答受付中</Badge>
                      ) : c.status === "closed" ? (
                        <Badge tone="closed">締め切り済み</Badge>
                      ) : (
                        <Badge tone="done">準備中</Badge>
                      )}
                    </>
                  }
                  sub={
                    `${formatPeriod(c.periodStart, c.periodEnd)} ／ アンケート${my.length}件（公開中 ${published}件） ／ 回答${responses}件` +
                    (pending.length > 0 ? ` ／ 未確定 ${pending.length}件` : "")
                  }
                  actions={
                    <>
                      <LinkButton href={`/admin/forms?cycle=${c.id}`} variant="tertiary">
                        アンケートを見る
                      </LinkButton>
                      <LinkButton href={`/manager/cycles?cycle=${c.id}`} variant="tertiary">
                        進行状況を見る
                      </LinkButton>
                      <DownloadButton href={`/api/export?type=results&cycleId=${c.id}`} variant="tertiary">
                        評価結果をCSVに書き出す
                      </DownloadButton>
                      <DownloadButton href={`/api/export?type=kpi&cycleId=${c.id}`} variant="tertiary">
                        KPI明細をCSVに書き出す
                      </DownloadButton>
                    </>
                  }
                />

                <div className="mt-3 flex flex-wrap gap-3">
                  {c.status !== "open" && c.status !== "closed" && openReadiness.ready && (
                    <ActionButton
                      url="/api/cycles"
                      method="PATCH"
                      body={{ cycleId: c.id, status: "open" }}
                      label="回答の受付を始める"
                    />
                  )}
                  {c.status === "open" && (
                    <ActionButton
                      url="/api/cycles"
                      method="PATCH"
                      body={{ cycleId: c.id, status: "closed" }}
                      label="受付を締め切る"
                      variant="secondary"
                      confirm={cycleCloseConfirmText(pending)}
                    />
                  )}
                  {c.status === "closed" && (
                    <ActionButton
                      url="/api/cycles"
                      method="PATCH"
                      body={{ cycleId: c.id, status: "open" }}
                      label="受付を再開する"
                      variant="tertiary"
                      confirm="受付を再開すると、この期間の回答を再び受け付けます。アンケートは個別に公開し直してください。よろしいですか？"
                    />
                  )}
                </div>

                {c.status === "planning" && !openReadiness.ready && (
                  <div className="mt-3">
                    <ReasonNote>{openReadiness.message}</ReasonNote>
                  </div>
                )}

                {/* 確認の窓を開かなくても「誰が残っているか」まで辿れるようにする。
                    窓の中だけに書くと、押す気のない人には最後まで見えない。 */}
                {pending.length > 0 && (
                  <div className="mt-3">
                    <ReasonNote
                      action={
                        <LinkButton href={`/manager/cycles?cycle=${c.id}`} variant="secondary">
                          残っている方を見る
                        </LinkButton>
                      }
                    >
                      この期間には、まだ確定していない評価が{pending.length}件あります。締め切ることはできます。
                      締め切ったあとは、ホームの「締め切った期間に残っている評価」で追いかけます。
                    </ReasonNote>
                  </div>
                )}

                {my.length === 0 && (
                  <div className="mt-3">
                    <ReasonNote
                      action={
                        <LinkButton href={`/admin/forms?cycle=${c.id}`} variant="secondary">
                          アンケートを作る
                        </LinkButton>
                      }
                    >
                      この期間のアンケートがまだありません。等級ごとのアンケートを作ると、対象の方が回答できます。
                    </ReasonNote>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
