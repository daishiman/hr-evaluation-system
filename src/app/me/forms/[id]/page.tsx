import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { getForm, getResponse, listFormQuestions } from "@/lib/queries";
import { FormAnswer } from "@/components/FormAnswer";
import { PageTitle, ReasonNote } from "@/components/ui";
import { formatPeriod } from "@/lib/view";

export const dynamic = "force-dynamic";

/**
 * アンケートの回答画面。
 * 自分の等級のアンケートしか開けない。設問は queries 側で
 * 評価される方向けに絞ったものだけが渡る（配点・ゲート情報は含まれない）。
 */
export default async function AnswerForm({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireViewer();
  const { id } = await params;
  if (!viewer.companyId) notFound();

  const form = await getForm(viewer.companyId, id);
  if (!form) notFound();
  if (form.gradeId !== viewer.gradeId) {
    return (
      <>
        <PageTitle title="このアンケートは開けません" />
        <ReasonNote>
          ご自身の等級に割り当てられたアンケートではありません。「実績を報告する」から、ご自身のアンケートを開いてください。
        </ReasonNote>
      </>
    );
  }
  if (form.status === "draft") {
    return (
      <>
        <PageTitle title={form.title} />
        <ReasonNote>このアンケートはまだ準備中です。公開されるとこの画面から回答できます。</ReasonNote>
      </>
    );
  }

  const [questions, response] = await Promise.all([
    listFormQuestions(viewer.companyId, id, viewer.role),
    getResponse(viewer.companyId, id, viewer.id),
  ]);

  return (
    <>
      <PageTitle
        title={form.title}
        lede={`${form.cycleName ?? ""} ／ ${form.gradeName ?? ""} ／ 回答期間 ${formatPeriod(form.opensAt, form.closesAt)}`}
      />
      {form.description && <p className="mb-4 text-[13px] leading-relaxed">{form.description}</p>}

      <FormAnswer
        formId={form.id}
        questions={questions.map((q) => ({
          id: q.id,
          section: q.section,
          questionType: q.questionType,
          title: q.title,
          helpText: q.helpText,
          unit: q.unit,
          required: q.required,
          validationMin: q.validationMin,
          validationMax: q.validationMax,
          optionsJson: q.optionsJson,
          displayOrder: q.displayOrder,
        }))}
        initial={(response?.answers ?? []).map((a) => ({
          questionId: a.questionId,
          valueNumber: a.valueNumber,
          valueText: a.valueText,
        }))}
        submitted={response?.status === "submitted"}
        closed={form.status === "closed"}
        note={response?.respondentNote ?? null}
      />
    </>
  );
}
