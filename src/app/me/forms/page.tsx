import Link from "next/link";
import { requireViewer } from "@/lib/session";
import { listMyForms, type MyFormRow } from "@/lib/response-access";
import { Badge, Card, EmptyState, PageTitle, ReasonNote, SectionHeading } from "@/components/ui";
import { formatPeriod, RESPONSE_STATUS_LABEL } from "@/lib/view";
import { daysUntilDeadline, formatJpDate } from "@/lib/domain/form-deadline";

export const dynamic = "force-dynamic";

/**
 * 自分が回答するアンケートの一覧。
 *
 * 以前は「いまの等級」だけで絞っていたため、昇格すると過去に自分が答えた
 * アンケートが一覧から丸ごと消えていた。等級ではなく「自分の回答があるか」を
 * 基準にし、これから答えるもの（いまの等級・公開中）と、過去に答えたもの（当時の版）を
 * どちらも並べる。
 */
export default async function MyForms() {
  const viewer = await requireViewer();
  if (!viewer.companyId) {
    return <EmptyState title="所属している会社がありません" body="会社の管理者にご連絡ください。" />;
  }

  const rows = await listMyForms(viewer.companyId, viewer.id, viewer.gradeId ?? null);

  // これから答える（未提出で、いま回答できる）／それ以外（提出済み・締切後・過去の等級）
  const todo = rows.filter((r) => r.responseStatus !== "submitted" && r.deadline.canAnswer);
  const past = rows.filter((r) => !todo.includes(r));

  return (
    <>
      <PageTitle
        title="実績を報告する"
        lede="半期ごとに、担当した実績を数値で報告します。入力の途中でやめても、内容は自動で保存されます。"
      />

      {!viewer.gradeId && (
        <div className="mb-4">
          <ReasonNote>
            等級が設定されていないため、新しいアンケートは表示されません。過去に答えた分はこの下に残ります。等級の設定は会社の管理者にご依頼ください。
          </ReasonNote>
        </div>
      )}

      <SectionHeading>回答する</SectionHeading>
      {todo.length === 0 ? (
        <EmptyState
          title="いま回答できるアンケートはありません"
          body="新しい評価期間が始まると、ここに並びます。始まったら会社からお知らせがあります。"
        />
      ) : (
        <Card>{todo.map((r) => <FormRow key={r.formId} row={r} />)}</Card>
      )}

      {past.length > 0 && (
        <>
          <div className="mt-6">
            <SectionHeading>提出済み・過去のアンケート</SectionHeading>
          </div>
          <p className="footnote mb-2">
            過去の分は、回答したときの設問文・選択肢のまま読めます。等級が変わっても消えません。
          </p>
          <Card>{past.map((r) => <FormRow key={r.formId} row={r} />)}</Card>
        </>
      )}

      <p className="footnote mt-3">
        点数のつけ方や昇格に必要な点数は、この画面には表示されません。判定の結果と理由は「評価の結果を見る」で確認できます。
      </p>
    </>
  );
}

/** 1行分の表示。締切の状態と、提出した日付をここで正直に出す。 */
function FormRow({ row }: { row: MyFormRow }) {
  const remain = daysUntilDeadline(row.deadline.effectiveUntil, new Date());
  return (
    <div className="card-row">
      <div className="row-main">
        <p className="todo-row-title m-0">
          <Link href={`/me/forms/${row.formId}`} className="text-[var(--brand-deep)]">
            {row.title}
          </Link>
        </p>
        <p className="todo-row-sub m-0">
          {row.cycleName ?? "—"} ／ 対象期間 {formatPeriod(row.periodStart, row.periodEnd)} ／ 全{row.questionCount}問
          {row.gradeName ? ` ／ ${row.gradeName}` : ""}
        </p>
        {row.submittedAt ? (
          <p className="footnote m-0">提出日 {formatJpDate(jstDay(row.submittedAt))}</p>
        ) : row.deadline.canAnswer && row.deadline.effectiveUntil ? (
          <p className="footnote m-0">
            {formatJpDate(row.deadline.effectiveUntil)}まで
            {remain !== null && remain <= 7 ? `（あと${remain === 0 ? "今日" : `${remain}日`}）` : ""}
            {row.deadline.extended ? "・期限を延ばしてもらっています" : ""}
          </p>
        ) : (
          <p className="footnote m-0">{row.deadline.message}</p>
        )}
        {row.supersededBy && (
          <p className="footnote m-0">
            このアンケートは新しい版に差し替わりました。入力途中の内容はこのまま残ります。回答は
            <Link href={`/me/forms/${row.supersededBy.formId}`} className="text-[var(--brand-deep)]">
              新しい版
            </Link>
            からお願いします。
          </p>
        )}
      </div>
      {row.responseStatus === "submitted" ? (
        <Badge tone="done">{RESPONSE_STATUS_LABEL.submitted}</Badge>
      ) : !row.deadline.canAnswer ? (
        <Badge tone="closed">締め切り済み</Badge>
      ) : row.responseStatus === "draft" ? (
        <Badge tone="active">入力途中</Badge>
      ) : (
        <Badge tone="required">未着手</Badge>
      )}
    </div>
  );
}

/** 提出日時（UTC保存）を日本時間の日付にして表示する。 */
function jstDay(d: Date): string {
  const shifted = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}
