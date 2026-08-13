import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireViewer } from "@/lib/session";
import { getForm, getResponse, listFormQuestions } from "@/lib/queries";
import { listActiveExtensions } from "@/lib/response-access";
import { FormAnswer } from "@/components/FormAnswer";
import { ResponseSnapshot } from "@/components/ResponseSnapshot";
import { Card, DefList, PageTitle, ReasonNote } from "@/components/ui";
import { formatDate, formatPeriod } from "@/lib/view";
import { formatJpDate, judgeFormDeadline } from "@/lib/domain/form-deadline";
import { parseMulti, toAnswerRows } from "@/lib/domain/answer-snapshot";
import { judgeFormEntry } from "@/lib/domain/form-entry";

export const dynamic = "force-dynamic";

/**
 * アンケートの回答画面。
 *
 * 回答できるのは「いまの等級のアンケート」または「自分が回答した実績があるアンケート」。
 * 昇格して等級が変わっても、当時答えたアンケートは当時の版のまま開けるようにする。
 * それ以外（別の等級向け）は中身の確認画面 /forms/[id] へ送る。読むことは妨げない。
 * 提出済みの回答は、回答時点の設問文で読む（form_answers に写した内容が正）。
 * 回答できる・できないはサーバー側の締切判定に合わせ、理由を日本語で書く。
 */
export default async function AnswerForm({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireViewer();
  const { id } = await params;
  if (!viewer.companyId) notFound();

  const form = await getForm(viewer.companyId, id);
  if (!form) notFound();

  const response = await getResponse(viewer.companyId, id, viewer.id);
  // 対象等級が違う人は、閉ざさずに「中身だけの画面」へ送る。
  // 読むだけの画面はここに二重に作らず、/forms/[id] の1本に集約する。
  if (judgeFormEntry({ viewerGradeId: viewer.gradeId, formGradeId: form.gradeId, hasResponse: !!response }) === "content-only") {
    redirect(`/forms/${form.id}`);
  }
  if (form.status === "draft") {
    return (
      <>
        <PageTitle title={form.title} />
        <ReasonNote>このアンケートはまだ準備中です。公開されるとこの画面から回答できます。</ReasonNote>
      </>
    );
  }

  const [questions, extensions] = await Promise.all([
    listFormQuestions(viewer.companyId, id, viewer.role),
    listActiveExtensions(id, viewer.id),
  ]);

  const judgement = judgeFormDeadline({
    status: form.status,
    opensAt: form.opensAt,
    closesAt: form.closesAt,
    extensions,
    now: new Date(),
  });

  /* 設問を上から順に埋めていく縦長の画面。
     どの期の・どの等級のアンケートかを帯に固定して、スクロールしても見えるようにする。 */
  const header = (
    <PageTitle
      sticky
      title={form.title}
      lede={`回答期間 ${formatPeriod(form.opensAt, form.closesAt)}`}
      tags={
        <>
          {form.cycleName && <span className="tag">{form.cycleName}</span>}
          {form.gradeName && (
            <span className="tag" data-tone="muted">
              {form.gradeName}
            </span>
          )}
        </>
      }
    />
  );

  // 提出済みは「回答したときの姿」で読ませる。入力欄を出しても押せないだけで意味がないため。
  if (response?.status === "submitted") {
    const rows = toAnswerRows(response.answers, questions);
    return (
      <>
        {header}
        <div className="mb-4">
          <Card>
            <DefList
              rows={[
                { label: "提出した日", value: formatDate(response.submittedAt) },
                { label: "状態", value: "提出済み（内容は変更できません）" },
                ...(response.respondentNote ? [{ label: "ひとこと", value: response.respondentNote }] : []),
              ]}
            />
          </Card>
        </div>
        <ResponseSnapshot rows={rows} />
        <p className="footnote mt-3">
          内容を直す必要がある場合は、会社の管理者にご連絡ください。提出済みの回答はこの画面からは書き換えられません。
        </p>
      </>
    );
  }

  const deadlineNote = judgement.canAnswer
    ? judgement.effectiveUntil
      ? `${formatJpDate(judgement.effectiveUntil)}まで回答できます${judgement.extended ? "（期限を延ばしてもらっています）" : ""}`
      : "回答期限は設けられていません"
    : null;

  return (
    <>
      {header}
      {form.description && <p className="mb-4 text-sub leading-relaxed">{form.description}</p>}

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
          validationInteger: q.validationInteger,
          optionsJson: q.optionsJson,
          displayOrder: q.displayOrder,
        }))}
        initial={(response?.answers ?? []).map((a) => ({
          questionId: a.questionId,
          valueNumber: a.valueNumber,
          valueText: a.valueText,
          valueChoices: a.valueJson ? parseMulti(a.valueJson) : null,
        }))}
        submitted={false}
        lockedReason={
          judgement.canAnswer
            ? null
            : `${judgement.message}${response ? "入力した内容は消えずに残っています。" : ""}事情があって今から提出したい場合は、上長または会社の管理者にご相談ください。個別に期限を延ばすことができます。`
        }
        deadlineNote={deadlineNote}
        note={response?.respondentNote ?? null}
      />

      <p className="footnote mt-3">
        ほかの回では答えた内容も見返せます。
        <Link href="/me/forms" className="text-[var(--brand-deep)]">
          実績を報告する
        </Link>
        の一覧から開いてください。
      </p>
    </>
  );
}
