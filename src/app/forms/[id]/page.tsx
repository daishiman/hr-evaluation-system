import { notFound } from "next/navigation";
import { canEditForm, canSeeCriteria, canSeeFormResponses, requireRoute } from "@/lib/session";
import { getForm, listFormQuestions } from "@/lib/queries";
import { formRowTitle } from "@/lib/domain/grade-label";
import { toContentQuestions } from "@/lib/domain/form-visibility";
import { answerBlockLabel, judgeAnswerBlock, type AnswerBlock } from "@/lib/domain/form-entry";
import { judgeFormDeadline } from "@/lib/domain/form-deadline";
import { listActiveExtensions } from "@/lib/response-access";
import { FormPreview } from "@/components/FormPreview";
import { RespondentGuide } from "@/components/RespondentGuide";
import { Badge, Card, InlineDetail, LinkButton, PageTitle, ReasonNote } from "@/components/ui";
import { FORM_STATUS_LABEL, formatPeriod } from "@/lib/view";

export const dynamic = "force-dynamic";

// 回答できる本人に、見本の先頭の注記で入口を言う。見本の既定の理由（対象の等級の方は「実績を報告する」から）は
// 管理画面向けの三人称で、上の回答ボタンと入口の名前が食い違う
const ANSWERER_REASON = "回答は上の「このアンケートに回答する」から行います。";

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
  const viewer = await requireRoute("/forms/[id]");
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
  const judgement = judgeFormDeadline({
    cycleStatus: form.cycleStatus ?? "unknown",
    status: form.status,
    opensAt: form.opensAt,
    closesAt: form.closesAt,
    extensions: await listActiveExtensions(form.id, viewer.id),
    now: new Date(),
  });
  // 理由は1つだけ選ぶ。上部の注記と見本の節ごとの理由が、同じ結果から作られる
  const block = judgeAnswerBlock({
    draft: form.status === "draft",
    viewerGradeId: viewer.gradeId,
    formGradeId: form.gradeId,
    deadline: judgement,
  });

  return (
    <>
      <PageTitle
        sticky
        breadcrumb={[{ label: "アンケートの中身", href: `/forms?cycle=${form.cycleId}` }]}
        title={formRowTitle(form)}
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
            {block.kind === "can-answer" && <LinkButton href={`/me/forms/${form.id}`}>このアンケートに回答する</LinkButton>}
            {canEditForm(viewer.role) && (
              <LinkButton href={`/admin/forms/${form.id}`} variant="secondary">
                このアンケートを設定する
              </LinkButton>
            )}
          </>
        }
      />

      {block.kind !== "can-answer" && (
        <div className="mb-4">
          <AnswerBlockNote
            block={block}
            formId={form.id}
            gradeName={form.gradeName ?? "—"}
            deadlineMessage={judgement.message}
            canSeeResponses={canSeeFormResponses(viewer.role)}
          />
        </div>
      )}

      {/* 一覧で沈めている締め切り済みは、開いた先でも同じ見た目にする */}
      <Card className="card-pad" off={form.status === "closed"}>
        <p className="m-0 text-sub">回答期間 {formatPeriod(form.opensAt, form.closesAt)}</p>
        {form.description && (
          <p className="m-0 mt-2 whitespace-pre-wrap text-sub leading-relaxed">
            <RespondentGuide>{form.description}</RespondentGuide>
          </p>
        )}
        {/* 開く前に知っておくべき事実（誰の回答も出ない・点数は出ない）だけを既定で出し、
            「なぜそうしているか」と画面の読み方は畳む。畳んでも消えないよう InlineDetail に入れる。 */}
        <p className="footnote m-0 mt-2">誰がどう答えたかは、この画面には表示されません。</p>
        {!canSeeCriteria(viewer.role) && (
          <p className="footnote m-0 mt-1">配点や昇格に必要な点数は表示されません。</p>
        )}
        <div className="mt-2">
          <InlineDetail summary="この画面の見方">
            <p className="m-0 text-sub">
              設問文・補足・答え方を、保存されているとおりに表示します。印の無い設問は必須、「（任意）」の設問は空欄でも提出できます。
            </p>
            <p className="m-0 mt-1 text-sub">
              文字や数値を打つ欄はなく、選択肢を試しに選んでも保存されません。開いても回答や下書きは作られません。
            </p>
            {!canSeeCriteria(viewer.role) && (
              <p className="m-0 mt-1 text-sub">
                配点などを出さないのは、回答が点数合わせにならないようにするためです。
              </p>
            )}
          </InlineDetail>
        </div>
      </Card>

      <div className="mt-5">
        {/* 回答できないときの理由は上の注記（AnswerBlockNote）が言う。見本の先頭の注記で言い直すと同じ理由が2つ並ぶ */}
        <FormPreview
          questions={previewQuestions}
          reason={block.kind === "can-answer" ? ANSWERER_REASON : ""}
          blockedLabel={answerBlockLabel(block)}
        />
      </div>
    </>
  );
}

/**
 * 回答できない理由の注記。judgeAnswerBlock が選んだ1つだけを出す（2つ並べない）。
 *
 * 等級の無い人に締切の文を返すと、管理者本人に「管理者にご連絡ください」と言うことになる。
 * そのため等級なしは見る人で文を分け、回答一覧を開ける人には回答の代わりに確かめられる場所を示す。
 */
function AnswerBlockNote({
  block,
  formId,
  gradeName,
  deadlineMessage,
  canSeeResponses,
}: {
  block: AnswerBlock;
  formId: string;
  gradeName: string;
  deadlineMessage: string;
  canSeeResponses: boolean;
}) {
  switch (block.kind) {
    case "can-answer":
      return null;
    case "draft":
      return (
        <ReasonNote>
          まだ配っていない下書きです。公開までに設問が変わることがあります。この画面から回答することはできません。
        </ReasonNote>
      );
    case "no-grade":
      // 回答一覧を開けるかは、その画面の入口と同じ台帳で見る（canSeeFormResponses）
      return canSeeResponses ? (
        <ReasonNote action={<LinkButton href={`/admin/forms/${formId}/responses`}>回答一覧を見る</LinkButton>}>
          このアンケートに回答するのは、対象の等級（{gradeName}）の方です。あなたには等級が設定されていないため、回答画面は開きません。
          集まった回答は「回答一覧」で確かめられます。
        </ReasonNote>
      ) : (
        <ReasonNote>
          等級が設定されていないため、このアンケートには回答できません。回答が必要な場合は、会社の管理者に等級の設定をご依頼ください。
        </ReasonNote>
      );
    case "other-grade":
      return (
        <ReasonNote action={<LinkButton href="/me/forms">自分のアンケートを見る</LinkButton>}>
          このアンケートは別の等級（{gradeName}）の方向けです。中身は確認できますが、回答はできません。
          ご自身の等級のアンケートは「実績を報告する」から開けます。
        </ReasonNote>
      );
    case "deadline":
      return (
        <ReasonNote action={<LinkButton href="/me/forms">自分のアンケートを見る</LinkButton>}>{deadlineMessage}</ReasonNote>
      );
  }
}
