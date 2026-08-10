import Link from "next/link";
import { requireViewer } from "@/lib/session";
import { getResponse, listCycles, listForms } from "@/lib/queries";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui";
import { formatPeriod, RESPONSE_STATUS_LABEL } from "@/lib/view";

export const dynamic = "force-dynamic";

/** 自分が回答するアンケートの一覧。今の期を先頭に、過去の提出内容も見返せるようにする。 */
export default async function MyForms() {
  const viewer = await requireViewer();
  if (!viewer.companyId) {
    return <EmptyState title="所属している会社がありません" body="会社の管理者にご連絡ください。" />;
  }
  if (!viewer.gradeId) {
    return (
      <EmptyState
        title="等級が設定されていません"
        body="アンケートは等級ごとに用意されます。会社の管理者に等級の設定を依頼してください。"
      />
    );
  }

  const cycles = await listCycles(viewer.companyId);
  const all = await listForms(viewer.companyId);
  const mine = all.filter((f) => f.gradeId === viewer.gradeId && f.status !== "draft");

  const rows = await Promise.all(
    mine.map(async (f) => ({
      form: f,
      response: await getResponse(viewer.companyId!, f.id, viewer.id),
      cycle: cycles.find((c) => c.id === f.cycleId) ?? null,
    })),
  );

  return (
    <>
      <PageTitle
        title="実績を報告する"
        lede="半期ごとに、担当した実績を数値で報告します。入力の途中でやめても、内容は自動で保存されます。"
      />

      {rows.length === 0 ? (
        <EmptyState
          title="回答するアンケートはまだありません"
          body="新しい評価期間が始まると、ここに並びます。始まったら会社からお知らせがあります。"
        />
      ) : (
        <Card>
          {rows.map(({ form, response, cycle }) => {
            const submitted = response?.status === "submitted";
            const closed = form.status === "closed";
            return (
              <div key={form.id} className="card-row">
                <div className="row-main">
                  <p className="todo-row-title m-0">
                    <Link href={`/me/forms/${form.id}`} className="text-[var(--brand-deep)]">
                      {form.title}
                    </Link>
                  </p>
                  <p className="todo-row-sub m-0">
                    {cycle?.name ?? form.cycleName} ／ 対象期間{" "}
                    {formatPeriod(cycle?.periodStart, cycle?.periodEnd)} ／ 全{form.questionCount}問
                  </p>
                </div>
                {submitted ? (
                  <Badge tone="done">{RESPONSE_STATUS_LABEL.submitted}</Badge>
                ) : closed ? (
                  <Badge tone="closed">締め切り済み</Badge>
                ) : response ? (
                  <Badge tone="active">入力途中</Badge>
                ) : (
                  <Badge tone="required">未着手</Badge>
                )}
              </div>
            );
          })}
        </Card>
      )}

      <p className="footnote mt-3">
        点数のつけ方や昇格に必要な点数は、この画面には表示されません。判定の結果と理由は「評価の結果を見る」で確認できます。
      </p>
    </>
  );
}
