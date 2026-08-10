import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { getDb, schema as s } from "@/lib/db";
import { getForm, listFormQuestions, listKpiItems } from "@/lib/queries";
import { FormBuilder, type BuilderQuestion } from "@/components/FormBuilder";
import { RecordForm } from "@/components/RecordForm";
import { Badge, Card, PageTitle, SectionHeading } from "@/components/ui";
import { FORM_STATUS_LABEL } from "@/lib/view";

export const dynamic = "force-dynamic";

/**
 * アンケート1件の設問組み立て。
 * 回答が1件でもあると設問は編集できない（過去の回答と対応が取れなくなるため）。
 * その場合は理由を画面に出し、閲覧だけにする。
 */
export default async function AdminFormDetail({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole("COMPANY_ADMIN");
  const { id } = await params;
  if (!viewer.companyId) notFound();
  const companyId = viewer.companyId;

  const form = await getForm(companyId, id);
  if (!form) notFound();

  const [questions, kpiItems] = await Promise.all([
    listFormQuestions(companyId, form.id, viewer.role),
    listKpiItems(companyId),
  ]);

  const db = await getDb();
  const responses = await db
    .select({ id: s.formResponses.id })
    .from(s.formResponses)
    .where(and(eq(s.formResponses.companyId, companyId), eq(s.formResponses.formId, form.id)));

  const rows: BuilderQuestion[] = questions.map((q) => ({
    id: q.id,
    section: q.section,
    questionType: q.questionType,
    title: q.title,
    helpText: q.helpText,
    unit: q.unit,
    required: q.required,
    validationMin: q.validationMin,
    validationMax: q.validationMax,
    options: q.optionsJson ? (JSON.parse(q.optionsJson) as { value: string; label: string; score?: number }[]) : [],
    isGate: q.isGate,
    linkLabel: q.kpiItemId
      ? `${kpiItems.find((k) => k.id === q.kpiItemId)?.name ?? "KPI項目"}（${q.kpiQuestionKey ?? ""}）`
      : q.gradeRequirementId
        ? "等級要件の達成状況として集計します"
        : q.promotionRequirementId
          ? "昇格要件の達成状況として集計します"
          : q.behaviorGuidelineId
            ? "行動指針の点数として集計します"
            : null,
    gradeRequirementId: q.gradeRequirementId,
    promotionRequirementId: q.promotionRequirementId,
    behaviorGuidelineId: q.behaviorGuidelineId,
    kpiItemId: q.kpiItemId,
    kpiQuestionKey: q.kpiQuestionKey,
  }));

  const editable = responses.length === 0;

  return (
    <>
      <PageTitle
        title={form.title}
        lede={`${form.cycleName ?? ""} ／ 対象：${form.gradeName ?? "—"} ／ 第${form.version}版 ／ ${FORM_STATUS_LABEL[form.status] ?? form.status}`}
        actions={
          <Link href={`/admin/forms?cycle=${form.cycleId}`} className="btn btn-tertiary">
            一覧に戻る
          </Link>
        }
      />

      <Card className="card-pad">
        <p className="m-0 text-[13px]">
          回答 {responses.length}件{" "}
          {form.status === "published" ? <Badge tone="active">公開中</Badge> : <Badge tone="done">{FORM_STATUS_LABEL[form.status]}</Badge>}
        </p>
        <p className="footnote m-0 mt-1">
          回答画面には、配点・ランク基準・昇格に必要な点数は一切表示されません（回答が点数合わせにならないようにするためです）。
        </p>
      </Card>

      <SectionHeading>タイトルと説明</SectionHeading>
      <RecordForm
        url="/api/forms"
        method="PATCH"
        fixed={{ formId: form.id }}
        submitLabel="保存する"
        fields={[
          { name: "title", label: "タイトル", type: "text", required: true, defaultValue: form.title },
          { name: "description", label: "冒頭の説明文", type: "textarea", defaultValue: form.description ?? "" },
        ]}
      />

      <SectionHeading aside={<span className="footnote">上下の矢印で並べ替えられます</span>}>設問（{rows.length}問）</SectionHeading>
      <FormBuilder
        formId={form.id}
        initial={rows}
        editable={editable}
        lockReason={
          editable
            ? undefined
            : `このアンケートにはすでに${responses.length}件の回答があるため、設問を変更できません。内容を変えるときは、アンケート一覧から新しい版を作ってください。`
        }
      />
    </>
  );
}
