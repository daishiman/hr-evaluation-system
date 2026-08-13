import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { canReadResponseBody } from "@/lib/domain/evaluation-authority";
import { getResponseDetail } from "@/lib/response-access";
import { ResponseSnapshot } from "@/components/ResponseSnapshot";
import { Card, DefList, PageTitle, ReasonNote } from "@/components/ui";
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
  const viewer = await requireViewer();
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

      <ResponseSnapshot rows={detail.rows} />

      <p className="footnote mt-3">
        この画面は回答したときの設問文・選択肢のまま表示しています。設問が作り直されても、当時の内容は変わりません。
      </p>
    </>
  );
}
