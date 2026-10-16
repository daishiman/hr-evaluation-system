import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { canEditForm, requireRoute } from "@/lib/session";
import { getDb, schema as s } from "@/lib/db";
import { getForm, listFormQuestions, listKpiItems } from "@/lib/queries";
import { formRowTitle } from "@/lib/domain/grade-label";
import { FormBuilder, type BuilderQuestion } from "@/components/FormBuilder";
import { FormPreview } from "@/components/FormPreview";
import { RespondentGuide } from "@/components/RespondentGuide";
import { ActionButton } from "@/components/ActionButton";
import { RecordForm } from "@/components/RecordForm";
import { rebuildFormQuestions, updateForm } from "@/actions/forms";
import { Badge, Card, Disclosure, InlineDetail, LinkButton, PageTitle, ReasonNote, SectionHeading } from "@/components/ui";
import { ComparisonGapNotice } from "@/components/ComparisonGapNotice";
import { loadFormComparisonGap } from "@/lib/comparison-gap-loader";
import { REBUILD_LABEL, noTemplateNamesOf, rebuildConfirm, rebuildWontFixNote } from "@/lib/domain/comparison-gap";
import { FORM_STATUS_LABEL } from "@/lib/view";

export const dynamic = "force-dynamic";

/**
 * アンケート1件の設問組み立て。
 * 回答が1件でもあると設問は編集できない（過去の回答と対応が取れなくなるため）。
 * その場合は理由を画面に出し、閲覧だけにする。
 */
export default async function AdminFormDetail({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRoute("/admin/forms/[id]");
  const { id } = await params;
  if (!viewer.companyId) notFound();
  const companyId = viewer.companyId;

  const form = await getForm(companyId, id);
  if (!form) notFound();
  // 画面に出す題名。空（既定の題名）なら評価期間と等級名から作る
  const displayTitle = formRowTitle(form);
  const defaultTitle = formRowTitle({ ...form, title: "" });

  const [questions, kpiItems, comparisonGap] = await Promise.all([
    listFormQuestions(companyId, form.id, viewer.role),
    listKpiItems(companyId),
    loadFormComparisonGap(companyId, { id: form.id, cycleId: form.cycleId }, { role: viewer.role, current: "form" }),
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
  const rebuildNote = rebuildWontFixNote(comparisonGap);
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
        title={displayTitle}
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
        {/* 設問は制度マスタ・評価セットの写し。直す向きは常に「制度 → アンケート」にする。 */}
        <p className="footnote m-0 mt-1">
          設問は、等級要件・昇格要件・行動指針・評価セットの設定から自動で作られます。
          下書きで回答がまだない場合だけ、制度側の設定を直してから作り直せます。
          公開済み・締め切り済みの版は変えられません。内容を変えるときは新しい版を作ってください。
        </p>
        {/* 「なぜ配点を隠すのか」は、この画面で操作する前に読む必要はない。押したときだけ出す。
            札は長く、globals.css（層の外）で折り返さない指定のため、320px では画面ごと横に流れる。
            この枠の中だけ important で折り返しを許し、文節で折る（auto-phrase。効かない環境では今までどおり）。 */}
        <div className="mt-1 text-pretty [word-break:auto-phrase] [&_summary]:whitespace-normal!">
          <InlineDetail summary="回答画面に配点・ランク基準は表示されません">
            <p className="footnote m-0">
              回答画面には、配点・ランク基準・昇格に必要な点数は一切表示されません。
              回答が点数合わせにならないようにするためです。
              公開済み・締め切り済みの版を変えないのも、当時の記録として残すためです。
            </p>
          </InlineDetail>
        </div>
        {/* 使うKPIを選ぶで選んだ項目との比べ（DD-012）。作り直しは下のボタンで行うので、部品には出さない */}
        {comparisonGap && (
          <div className="mt-3">
            <ComparisonGapNotice gaps={[comparisonGap]} />
          </div>
        )}
        {editable && form.status === "draft" && (
          // ボタンの札も長いので、上の札と同じく、この枠の中だけ折り返しを許す。
          // ボタンは警告の有無にかかわらず出す。作り直しは等級要件・昇格要件・行動指針の変更を写す操作でもあるため。
          // 押しても警告が消えないときは、押す前にその理由を1行で伝える（読み上げでもボタンより先に届く）
          <div className="mt-3 grid justify-items-start gap-2 text-pretty [word-break:auto-phrase] [&_.btn]:whitespace-normal!">
            {rebuildNote && <p className="m-0 text-sub">{rebuildNote}</p>}
            <ActionButton
              action={rebuildFormQuestions}
              resource="forms"
              input={{ formId: form.id }}
              label={REBUILD_LABEL}
              variant="secondary"
              confirm={rebuildConfirm(displayTitle, noTemplateNamesOf(comparisonGap))}
            />
          </div>
        )}
      </Card>

      <SectionHeading>回答者に見える内容（確認専用）</SectionHeading>
      <Disclosure summary="アンケートの中身を表示する" meta={`${previewQuestions.length}問`}>
        <p className="footnote mt-0">
          保存済みの設問文・補足・答え方を表示します。印の無い設問は必須、「（任意）」の設問は空欄でも提出できます。
          文字や数値を打つ欄はなく、選択肢を試しに選んでも保存されません。開いても回答や下書きは作られません。
        </p>
        {/* 見本には入力欄も送信ボタンも無い。入力と提出の動きは、回答者と同じ画面の試しの回答で確かめる */}
        {canEditForm(viewer.role) && (
          <p className="footnote m-0 mt-2">
            数値の入力から提出の検査までは
            <Link href={`/forms/${form.id}?try=1`} className="text-brand-deep">
              試しに回答する
            </Link>
            で試せます（保存されません）。
          </p>
        )}
        <div className="mt-4 border-t border-line pt-4">
          {form.description && (
            <p className="mb-4 whitespace-pre-wrap text-sub leading-relaxed">
              <RespondentGuide>{form.description}</RespondentGuide>
            </p>
          )}
          <FormPreview questions={previewQuestions} />
        </div>
      </Disclosure>

      <SectionHeading>タイトルと説明</SectionHeading>
      {editable ? (
        <RecordForm
          action={updateForm}
          resource="forms"
          fixed={{ formId: form.id }}
          submitLabel="保存する"
          fields={[
            {
              name: "title",
              label: "タイトル",
              type: "text",
              defaultValue: form.title,
              /* 空のまま保存すると既定の題名。既定の題名は評価期間と等級名から作るので、等級名を変えると追従する */
              placeholder: defaultTitle,
              help: `空のままにすると「${defaultTitle}」と表示します。`,
            },
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
              : "公開済みのアンケートは、タイトルと説明文を変更できません。回答が0件でも、すでに読まれている可能性があるためです。"}
            内容を変えるときは、アンケート一覧から新しい版を作ってください。
          </ReasonNote>
          <Card className="card-pad mt-2">
            <p className="m-0 text-sub font-bold">{displayTitle}</p>
            {form.description && <p className="m-0 mt-1 text-sub whitespace-pre-wrap">{form.description}</p>}
          </Card>
        </>
      )}

      <SectionHeading>回答期間</SectionHeading>
      <p className="footnote mb-2">
        締切日を過ぎると回答できなくなります（締切日は当日いっぱいまで回答できます）。回答があっても、この期間はあとから直せます。個別に期限を延ばしたいときは「回答一覧を見る」から設定してください。
      </p>
      <RecordForm
        action={updateForm}
        resource="forms"
        fixed={{ formId: form.id }}
        submitLabel="回答期間を保存する"
        inline
        fields={[
          { name: "opensAt", label: "受付の開始日", type: "date", defaultValue: form.opensAt ?? "" },
          { name: "closesAt", label: "締切日", type: "date", defaultValue: form.closesAt ?? "" },
        ]}
      />

      {/* 並べ替えの案内は、設問を変えられるとき（下書き）だけ出す。変えられない版でも出すと、
          つまみが無いのに「並べ替えられます」と読めてしまう（理由は FormBuilder が lockReason で出す） */}
      <SectionHeading
        aside={editable ? <span className="footnote">つまみの長押し・ドラッグか、矢印のボタンで並べ替えられます</span> : undefined}
      >
        設問（{rows.length}問）
      </SectionHeading>
      <FormBuilder
        formId={form.id}
        initial={rows}
        editable={editable}
        lockReason={
          editable
            ? undefined
            : responses.length > 0
              ? `このアンケートにはすでに${responses.length}件の回答があるため、設問を変更できません。内容を変えるときは、アンケート一覧から新しい版を作ってください。`
              : "公開済みのアンケートは、設問を変更できません。回答が0件でも、すでに読まれている可能性があるためです。内容を変えるときは、アンケート一覧から新しい版を作ってください。"
        }
      />
    </>
  );
}
