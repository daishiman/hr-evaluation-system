import { notFound } from "next/navigation";
import { canEditForm, canSeeCriteria, requireViewer } from "@/lib/session";
import { getForm, listFormQuestions } from "@/lib/queries";
import { toContentQuestions } from "@/lib/domain/form-visibility";
import { canAnswerForm } from "@/lib/domain/form-entry";
import { FormPreview } from "@/components/FormPreview";
import { Badge, Card, LinkButton, PageTitle, ReasonNote } from "@/components/ui";
import { FORM_STATUS_LABEL, formatPeriod } from "@/lib/view";

export const dynamic = "force-dynamic";

/**
 * アンケート1本の中身（全ロール共通・確認専用）。
 *
 * 回答画面ではなく読むための画面なので、入力欄は作らない。開いても回答や
 * 下書きの行はできない（回答は「実績を報告する」から行う）。
 *
 * 他社のアンケートは getForm の会社の絞り込みで届かない。URLにIDを入れられても
 * 自社のものしか開けない。
 */
export default async function FormContentDetail({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireViewer();
  const { id } = await params;
  if (!viewer.companyId) notFound();

  const form = await getForm(viewer.companyId, id);
  if (!form) notFound();

  // 昇格の必須要件かどうか（isGate）は listFormQuestions がロールを見て落とす。
  // 選択肢の配点は、ここで見てよい人だけに残す。
  const questions = await listFormQuestions(viewer.companyId, form.id, viewer.role);
  const previewQuestions = toContentQuestions(questions, canSeeCriteria(viewer.role));

  // 回答できる人には回答画面への入口を出す。できない人には、その理由をここで伝える
  // （回答用のURLを踏んだ人もこの画面に着くため、行き止まりにしない）。
  const canAnswer = canAnswerForm(viewer.gradeId, form.gradeId) && form.status === "published";
  const otherGrade = viewer.gradeId !== null && !canAnswerForm(viewer.gradeId, form.gradeId);

  return (
    <>
      <PageTitle
        sticky
        breadcrumb={[{ label: "アンケートの中身", href: `/forms?cycle=${form.cycleId}` }]}
        title={form.title}
        lede={`${form.cycleName ?? ""} ／ 対象：${form.gradeName ?? "—"} ／ 第${form.version}版`}
        tags={
          <>
            <span className="tag">対象 {form.gradeName ?? "—"}</span>
            <span className="tag" data-tone="muted">
              第{form.version}版
            </span>
            <Badge tone={form.status === "published" ? "active" : form.status === "closed" ? "closed" : "dropped"}>
              {FORM_STATUS_LABEL[form.status] ?? form.status}
            </Badge>
          </>
        }
        actions={
          <>
            {canAnswer && <LinkButton href={`/me/forms/${form.id}`}>このアンケートに回答する</LinkButton>}
            {canEditForm(viewer.role) && (
              <LinkButton href={`/admin/forms/${form.id}`} variant="secondary">
                このアンケートを設定する
              </LinkButton>
            )}
          </>
        }
      />

      {form.status === "draft" && (
        <div className="mb-4">
          <ReasonNote>
            まだ配っていない下書きです。公開までに設問が変わることがあります。この画面から回答することはできません。
          </ReasonNote>
        </div>
      )}

      {otherGrade && (
        <div className="mb-4">
          <ReasonNote action={<LinkButton href="/me/forms">自分のアンケートを見る</LinkButton>}>
            このアンケートは別の等級（{form.gradeName ?? "—"}）の方向けです。中身は確認できますが、回答はできません。
            ご自身の等級のアンケートは「実績を報告する」から開けます。
          </ReasonNote>
        </div>
      )}

      <Card className="card-pad">
        <p className="m-0 text-sub">回答期間 {formatPeriod(form.opensAt, form.closesAt)}</p>
        {form.description && <p className="m-0 mt-2 whitespace-pre-wrap text-sub leading-relaxed">{form.description}</p>}
        <p className="footnote m-0 mt-2">
          設問文・補足・必須／任意・答え方を、保存されているとおりに表示します。入力欄はないので、開いても回答や下書きは作られません。
          誰がどう答えたかは、この画面には表示されません。
        </p>
        {!canSeeCriteria(viewer.role) && (
          <p className="footnote m-0 mt-1">
            配点や昇格に必要な点数は表示されません（回答が点数合わせにならないようにするためです）。
          </p>
        )}
      </Card>

      <div className="mt-5">
        <FormPreview questions={previewQuestions} />
      </div>
    </>
  );
}
