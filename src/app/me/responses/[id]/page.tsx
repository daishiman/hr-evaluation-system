import { notFound } from "next/navigation";
import { requireRoute } from "@/lib/session";
import { canReadResponseBody, canReadSelfResult, canReviewEmployeeEvaluation } from "@/lib/domain/evaluation-authority";
import { getResponseDetail } from "@/lib/response-access";
import { listEvaluations } from "@/lib/queries";
import { ResponseSnapshot } from "@/components/ResponseSnapshot";
import { Card, DefList, LinkButton, PageTitle, ReasonNote } from "@/components/ui";
import { formatDate, RESPONSE_STATUS_LABEL } from "@/lib/view";

export const dynamic = "force-dynamic";

/**
 * 回答1件を回答IDで読む画面。
 *
 * 評価の詳細から「この評価のもとになった回答」へ辿れるようにするための入口。
 * 本人はもちろん、その人を見てよい立場（マネージャー・管理者）からも同じ画面を開く。
 * 表示は必ず回答時点の版（form_answers に写した当時の設問文・選択肢）で行う。
 */
export default async function ResponsePage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRoute("/me/responses/[id]");
  const { id } = await params;
  if (!viewer.companyId) notFound();

  const detail = await getResponseDetail(viewer.companyId, id);
  if (!detail) notFound();

  if (
    !canReadResponseBody(
      viewer.id,
      viewer.role,
      { employeeId: detail.response.employeeId, managerId: detail.response.managerId },
      detail.response.status,
    )
  ) {
    return (
      <>
        <PageTitle title="この回答は開けません" />
        <ReasonNote>
          ご自身の回答ではありません。ご自身の回答は「実績を報告する」から開けます。ほかの方の回答が必要な場合は、会社の管理者にご相談ください。
        </ReasonNote>
      </>
    );
  }

  const isMine = viewer.id === detail.response.employeeId;
  const canReview = !isMine && canReviewEmployeeEvaluation(viewer.id, viewer.role, {
    employeeId: detail.response.employeeId,
    managerId: detail.response.managerId,
  });
  // 回答IDと本人IDを選択中の会社内で同時に絞る。本人には確定済みの評価だけを案内する。
  const evaluations = detail.response.status === "submitted"
    ? await listEvaluations(viewer.companyId, isMine ? "EMPLOYEE" : viewer.role, {
        employeeId: detail.response.employeeId,
        responseId: id,
      })
    : [];
  const evaluation = evaluations.find((row) => canReview || canReadSelfResult(viewer.id, row.employeeId, row.status));

  return (
    <>
      <PageTitle
        breadcrumb={isMine ? [{ label: "実績を報告する", href: "/me/forms" }] : undefined}
        title={detail.form.title}
        lede={`${detail.form.cycleName ?? ""} ／ ${detail.form.gradeName ?? ""}${isMine ? "" : ` ／ ${detail.response.employeeName ?? "（氏名なし）"}さんの回答`}`}
        tags={
          <>
            {detail.form.cycleName && <span className="tag">{detail.form.cycleName}</span>}
            {detail.form.gradeName && (
              <span className="tag" data-tone="muted">
                {detail.form.gradeName}
              </span>
            )}
            <span className="tag" data-tone="muted">
              {RESPONSE_STATUS_LABEL[detail.response.status] ?? detail.response.status}
            </span>
          </>
        }
      />

      <div className="mb-4">
        <Card>
          <DefList
            rows={[
              ...(isMine ? [] : [{ label: "回答した方", value: detail.response.employeeName ?? "—" }]),
              { label: "状態", value: RESPONSE_STATUS_LABEL[detail.response.status] ?? detail.response.status },
              {
                label: "提出した日",
                value: detail.response.submittedAt
                  ? formatDate(detail.response.submittedAt)
                  : "まだ提出されていません（入力途中）",
              },
              {
                label: "入力の方法",
                value: detail.response.importSource ? `取り込み（${detail.response.importSource}）` : "この画面から入力",
              },
              ...(detail.response.respondentNote
                ? [{ label: "ひとこと", value: detail.response.respondentNote }]
                : []),
            ]}
          />
        </Card>
      </div>

      {detail.response.status === "submitted" && (
        <div className="mb-4">
          <Card className="card-pad">
            <p className="m-0 text-sub" data-aidd-copy="value">
              評価は、提出した回答と会社の評価基準から計算します。上長が内容を確認し、昇給・昇格の判断を確定すると本人に公開されます。
            </p>
            {evaluation ? (
              <div className="mt-3">
                <LinkButton href={isMine ? `/me/results/${evaluation.id}` : `/manager/evaluations/${evaluation.id}`}>
                  この回答から作った評価を見る
                </LinkButton>
              </div>
            ) : (
              <div className="mt-3">
                <ReasonNote>
                  {isMine
                    ? "この回答の評価はまだ公開されていません。上長・管理者の確認と確定をお待ちください。"
                    : "この回答から作った評価はまだありません。「評価・結果を確認する」で対象の期を選び、提出済みの回答から評価を作ってください。"}
                </ReasonNote>
                {canReview && <LinkButton href="/manager/cycles" variant="secondary">評価・結果を確認する</LinkButton>}
              </div>
            )}
          </Card>
        </div>
      )}

      <ResponseSnapshot rows={detail.rows} />

      <p className="footnote mt-3">
        この画面は回答したときの設問文・選択肢のまま表示しています。設問が作り直されても、当時の内容は変わりません。
      </p>
    </>
  );
}
