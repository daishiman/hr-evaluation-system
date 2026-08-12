import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { getDb, schema as s } from "@/lib/db";
import { getForm, listFormQuestions, listKpiItems } from "@/lib/queries";
import { FormBuilder, type BuilderQuestion } from "@/components/FormBuilder";
import { FormPreview } from "@/components/FormPreview";
import { ActionButton } from "@/components/ActionButton";
import { RecordForm } from "@/components/RecordForm";
import { Badge, Card, LinkButton, PageTitle, ReasonNote, SectionHeading } from "@/components/ui";
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
    validationInteger: q.validationInteger,
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

  // 公開後は回答0件でもすでに読まれている可能性があるため、同じ版の内容は変えない。
  const editable = form.status === "draft" && responses.length === 0;
  const previewQuestions = questions.map((q) => ({
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
  }));

  return (
    <>
      {/* 設問を足していくと縦に長くなる画面。対象の等級・版・状態は帯に固定して見えたままにする */}
      <PageTitle
        sticky
        breadcrumb={[{ label: "アンケート", href: `/admin/forms?cycle=${form.cycleId}` }]}
        title={form.title}
        lede={`${form.cycleName ?? ""} ／ 対象：${form.gradeName ?? "—"} ／ 第${form.version}版`}
        tags={
          <>
            <span className="tag">{form.cycleName ?? "期間未設定"}</span>
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
          <LinkButton href={`/admin/forms/${form.id}/responses`} variant="secondary">
            回答一覧を見る
          </LinkButton>
        }
      />

      {/* 締め切り済みは一覧でも沈めている。詳細でも同じ見た目にして、
          開いた画面がいまも配っているものか一目で分かるようにする。 */}
      <Card className="card-pad" off={form.status === "closed"}>
        <p className="m-0 text-sub">
          回答 {responses.length}件{" "}
          {form.status === "published" ? <Badge tone="active">公開中</Badge> : <Badge tone="done">{FORM_STATUS_LABEL[form.status]}</Badge>}
        </p>
        <p className="footnote m-0 mt-1">
          回答画面には、配点・ランク基準・昇格に必要な点数は一切表示されません（回答が点数合わせにならないようにするためです）。
        </p>
        {/* 設問は制度マスタ・評価セットの写し。直す向きは常に「制度 → アンケート」にする。 */}
        <p className="footnote m-0 mt-1">
          設問は、等級要件・昇格要件・行動指針・評価セットの設定から自動で作られます。下書きで回答がまだない場合だけ、制度側の設定を直してから作り直せます。公開済み・締め切り済みの版は当時の記録として変えず、内容を変えるときは新しい版を作ってください。
        </p>
        {editable && form.status === "draft" && (
          <div className="mt-3">
            <ActionButton
              url={`/api/forms/${form.id}/questions`}
              body={{}}
              label="いまの評価項目に合わせて設問を作り直す"
              variant="secondary"
              confirm={`「${form.title}」の設問を、いまの等級要件・昇格要件・行動指針・評価セットから作り直します。手で足した設問は消えます。まだ回答は1件もありません。よろしいですか？`}
            />
          </div>
        )}
      </Card>

      <SectionHeading>回答者に見える内容（確認専用）</SectionHeading>
      <p className="footnote mb-2">
        保存済みの設問文・補足・必須／任意・答え方を表示します。ここには入力欄がなく、開いても回答や下書きは作られません。
      </p>
      <details className="card card-pad">
        <summary className="cursor-pointer text-sub font-semibold">アンケートの中身を表示する（{previewQuestions.length}問）</summary>
        <div className="mt-4 border-t border-[var(--line)] pt-4">
          {form.description && <p className="mb-4 whitespace-pre-wrap text-sub leading-relaxed">{form.description}</p>}
          <FormPreview questions={previewQuestions} />
        </div>
      </details>

      <SectionHeading>タイトルと説明</SectionHeading>
      {editable ? (
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
      ) : (
        /* 設問と同じ理由でタイトル・説明文も変えられない。
           入力欄を出しておいて保存時に断ると徒労になるため、理由を先に出す。 */
        <>
          <ReasonNote>
            {responses.length > 0
              ? `このアンケートにはすでに${responses.length}件の回答があるため、タイトルと説明文は変更できません。回答した方が読んだ文面をあとから変えると、何に対する回答か分からなくなるためです。`
              : "公開済みのアンケートは、回答が0件でもすでに読まれている可能性があるため、タイトルと説明文を変更できません。"}
            内容を変えるときは、アンケート一覧から新しい版を作ってください。
          </ReasonNote>
          <Card className="card-pad mt-2">
            <p className="m-0 text-sub font-bold">{form.title}</p>
            {form.description && <p className="m-0 mt-1 text-sub whitespace-pre-wrap">{form.description}</p>}
          </Card>
        </>
      )}

      <SectionHeading>回答期間</SectionHeading>
      <p className="footnote mb-2">
        締切日を過ぎると回答できなくなります（締切日は当日いっぱいまで回答できます）。回答があっても、この期間はあとから直せます。個別に期限を延ばしたいときは「回答一覧を見る」から設定してください。
      </p>
      <RecordForm
        url="/api/forms"
        method="PATCH"
        fixed={{ formId: form.id }}
        submitLabel="回答期間を保存する"
        fields={[
          { name: "opensAt", label: "受付の開始日", type: "date", defaultValue: form.opensAt ?? "" },
          { name: "closesAt", label: "締切日", type: "date", defaultValue: form.closesAt ?? "" },
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
            : responses.length > 0
              ? `このアンケートにはすでに${responses.length}件の回答があるため、設問を変更できません。内容を変えるときは、アンケート一覧から新しい版を作ってください。`
              : "公開済みのアンケートは、回答が0件でもすでに読まれている可能性があるため、設問を変更できません。内容を変えるときは、アンケート一覧から新しい版を作ってください。"
        }
      />
    </>
  );
}
