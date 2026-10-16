import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyReminder } from "@/components/CopyReminder";
import { CopyUrl } from "@/components/CopyUrl";
import { appOrigin, formUrl } from "@/lib/origin";
import { requireRoute } from "@/lib/session";
import { getForm } from "@/lib/queries";
import { formRowTitle } from "@/lib/domain/grade-label";
import { canReadResponseBody } from "@/lib/domain/evaluation-authority";
import { listFormSubmissionRows } from "@/lib/submission-queries";
import { parseSubmissionFilter, SUBMISSION_STATE_LABEL } from "@/lib/domain/submission-status";
import { listFormExtensions } from "@/lib/response-access";
import { CsvImport } from "@/components/CsvImport";
import { ActionButton } from "@/components/ActionButton";
import { RecordForm } from "@/components/RecordForm";
import { grantFormExtension, revokeFormExtension } from "@/actions/form-extensions";
import { Badge, Card, DownloadButton, EmptyState, Num, PageTitle, ReasonNote, RecordList, SectionHeading, StatGrid } from "@/components/ui";
import { SubmissionStatusTable } from "@/components/SubmissionStatusTable";
import { FORM_STATUS_LABEL, formatDateTime } from "@/lib/view";
import { formatJpDate, judgeFormDeadline } from "@/lib/domain/form-deadline";
import { jstDateKey } from "@/lib/domain/jst";

export const dynamic = "force-dynamic";

/** 「2026年7月24日 12:32」の形にする（日時は分まで見えれば足りる）。日本時間で書くのは formatDateTime に任せる。 */
function formatWhen(v: Date | string | null): string {
  if (!v) return "—";
  return formatDateTime(typeof v === "string" ? new Date(v) : v);
}

/**
 * アンケート1本の回答一覧。
 *
 * これまでスプレッドシートの「回答一覧」シートで見ていたものに当たる。
 * 提出済みだけを並べず、対象等級の在籍者を全員並べて未回答の人を見えるようにする
 * （催促できる状態にするため）。
 */
export default async function AdminFormResponses({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const viewer = await requireRoute("/admin/forms/[id]/responses");
  const { id } = await params;
  if (!viewer.companyId) notFound();
  const companyId = viewer.companyId;

  const form = await getForm(companyId, id);
  if (!form) notFound();

  const [submission, extensions] = await Promise.all([
    listFormSubmissionRows(companyId, form.id),
    listFormExtensions(companyId, form.id),
  ]);
  if (!submission) notFound();
  const filter = parseSubmissionFilter((await searchParams).status);
  /* 催促の文面にはそのまま開けるURLを入れる（相対パスだと貼り付け先で開けないため）。
     優先順位の理由は appOrigin() 側に書いてある。 */
  const origin = await appOrigin();
  const judgement = judgeFormDeadline({
    cycleStatus: form.cycleStatus ?? "unknown",
    status: form.status,
    opensAt: form.opensAt,
    closesAt: form.closesAt,
    now: new Date(),
  });
  const activeExtensions = extensions.filter((e) => !e.revokedAt);
  /* 利用停止中の人は対象者一覧そのものから外す（問い合わせの時点で在籍中の人だけを読む。
     表示だけの絞り込みで、すでにある回答・評価のデータは一切変更しない）。期の途中で停止した人が
     いても、それまでに提出済みだった回答は formResponses に残ったまま。 */
  const { rows: active, counts } = submission;
  const missing = active.filter((r) => r.state === "none");

  return (
    <>
      <PageTitle
        breadcrumb={[
          { label: "アンケート", href: `/admin/forms?cycle=${form.cycleId}` },
          { label: formRowTitle(form), href: `/admin/forms/${form.id}` },
        ]}
        title="回答一覧"
        lede={`${form.cycleName ?? ""} ／ 対象：${form.gradeName ?? "—"}`}
        tags={
          <>
            {form.cycleName && <span className="tag">{form.cycleName}</span>}
            <span className="tag">対象 {form.gradeName ?? "—"}</span>
            <span className="tag" data-tone="muted">
              {FORM_STATUS_LABEL[form.status] ?? form.status}
            </span>
          </>
        }
        actions={
          <DownloadButton href={`/api/export?type=responses&formId=${form.id}`} variant="secondary">
            CSVに書き出す
          </DownloadButton>
        }
      />

      <Card className="card-pad">
        <StatGrid
          stats={[
            { label: "対象の人数", value: <Num value={counts.total} unit="人" display /> },
            { label: SUBMISSION_STATE_LABEL.submitted, value: <Num value={counts.submitted} unit="人" display /> },
            { label: SUBMISSION_STATE_LABEL.draft, value: <Num value={counts.draft} unit="人" display /> },
            { label: SUBMISSION_STATE_LABEL.none, value: <Num value={counts.none} unit="人" display /> },
          ]}
        />
      </Card>

      <p className="footnote mt-2">
        回答期間 {form.opensAt ? formatJpDate(form.opensAt) : "指定なし"} 〜{" "}
        {form.closesAt ? formatJpDate(form.closesAt) : "指定なし"}（締切日は当日いっぱいまで回答できます）／ いまの状態：
        {judgement.message}
        {activeExtensions.length > 0 ? ` ／ 個別に期限を延ばしている方：${activeExtensions.length}人` : ""}
      </p>

      {missing.length > 0 && (
        <div className="mt-4">
          <ReasonNote>
            {missing.length}人がまだ回答していません（{missing.slice(0, 5).map((r) => r.name).join("、")}
            {missing.length > 5 ? " ほか" : ""}）。
          </ReasonNote>
          <div className="mt-2">
            <CopyReminder
              names={missing.map((r) => r.name)}
              url={formUrl(origin, form.publicToken)}
              deadline={form.closesAt}
              lead={<CopyUrl url={formUrl(origin, form.publicToken)} label="回答画面のURL" />}
            />
          </div>
        </div>
      )}

      <SectionHeading aside={<span className="footnote">氏名の順に並んでいます</span>}>
        対象者と回答の状況（{active.length}人）
      </SectionHeading>

      {active.length === 0 ? (
        <EmptyState
          title="対象になる人がいません"
          body={`${form.gradeName ?? "この等級"}に登録されている在籍中の方がいないため、回答する人がいません。メンバー画面で等級を設定してください。`}
        />
      ) : (
        /* 対象者は「同じ項目を持つ多数の行を上から見比べる」一覧なので表のまま。
           狭い画面では DataTable が自動でカードに畳む（docs/product/spec.md §5-5）。
           利用停止中の人は対象者一覧から外すため、ここには active（在籍中）だけを渡す。
           状態の絞り込みは ?status= で持ち、件数は絞る前の全員ぶんを出す。 */
        <SubmissionStatusTable
          caption="対象者と回答の状況"
          rows={active}
          counts={counts}
          filter={filter}
          filterHref={(f) => `/admin/forms/${form.id}/responses${f === "all" ? "" : `?status=${f}`}`}
          /* 氏名をリンクにするのは、リンク先（/me/responses/[id]）が開ける回答だけ。管理者でも他人の下書きは開けないので、
             リンクにすると押した先が「この回答は開けません」の行き止まりになる。
             この画面を開けるのは管理者だけで、管理者が読めるかは上長かどうかに依らない（managerId は見ない）。 */
          nameCell={(r) =>
            r.response &&
            canReadResponseBody(viewer.id, viewer.role, { employeeId: r.employeeId, managerId: null }, r.response.status) ? (
              <Link href={`/me/responses/${r.response.id}`} className="text-brand-deep">
                {r.name}
              </Link>
            ) : (
              r.name
            )
          }
          columns={[
            { key: "code", header: "社員番号", cell: (r) => r.employeeCode ?? "—" },
            { key: "office", header: "事業所", cell: (r) => r.officeName ?? r.department ?? "—" },
            {
              key: "from",
              header: "取り込み元",
              cell: (r) =>
                r.response?.importSource === "csv" ? "取り込み（CSV）" : r.response ? "この画面から回答" : "—",
            },
            {
              key: "until",
              header: "個別の期限",
              cell: (r) => {
                const until = activeExtensions
                  .filter((e) => e.employeeId === r.employeeId)
                  .map((e) => e.extendedUntil)
                  .sort()
                  .at(-1);
                return until ? formatJpDate(until) : "—";
              },
            },
          ]}
        />
      )}

      <SectionHeading aside={<span className="footnote">記録は消えません（取り消しても履歴に残ります）</span>}>
        回答期限の延長
      </SectionHeading>
      <p className="footnote mb-2">
        締切を過ぎると回答できなくなります。休職・出張などで間に合わなかった方には、ここでその方だけ期限を延ばせます。延ばした期限は本人の回答画面にも表示されます。
      </p>

      {active.length > 0 && (
        <RecordForm
          action={grantFormExtension}
          resource="form-extensions"
          fixed={{ formId: form.id }}
          submitLabel="この内容で期限を延ばす"
          fields={[
            {
              name: "employeeId",
              label: "対象の方",
              type: "select",
              required: true,
              options: active.map((r) => ({
                value: r.employeeId,
                label: `${r.name}（${SUBMISSION_STATE_LABEL[r.state]}）`,
              })),
            },
            {
              name: "extendedUntil",
              label: "いつまで延ばすか",
              type: "date",
              required: true,
              help: `もとの締切（${form.closesAt ? formatJpDate(form.closesAt) : "指定なし"}）より後の日付を選んでください。指定した日の終わりまで回答できます。`,
              defaultValue: jstDateKey(new Date()),
            },
            {
              name: "reason",
              label: "理由",
              type: "textarea",
              help: "あとから「なぜ延ばしたか」を確認するための記録です。例：長期休暇のため",
            },
          ]}
        />
      )}

      {extensions.length > 0 && (
        /* 延長は1件ごとに理由（長い文章）と操作が付くため、表ではなくカードで出す
           （docs/product/spec.md §5-5）。 */
        <div className="mt-4">
          <RecordList
            items={extensions.map((e) => ({
              key: e.id,
              off: e.revokedAt !== null,
              title: e.employeeName ?? "—",
              marks: e.revokedAt ? <Badge tone="closed">取り消し済み</Badge> : <Badge tone="active">延長中</Badge>,
              rows: [
                { label: "延ばした期限", value: formatJpDate(e.extendedUntil) },
                { label: "登録した日時", value: formatWhen(e.createdAt) },
                ...(e.revokedAt ? [{ label: "取り消した日時", value: formatWhen(e.revokedAt) }] : []),
              ],
              note: e.reason ? `理由：${e.reason}` : null,
              action: e.revokedAt ? null : (
                <ActionButton
                  action={revokeFormExtension}
                  resource="form-extensions"
                  input={{ formId: form.id, extensionId: e.id }}
                  label="延長を取り消す"
                  variant="tertiary"
                  confirm={`${e.employeeName ?? "この方"}の延長を取り消すと、締切を過ぎている場合はその場で回答できなくなります。記録は履歴として残ります。`}
                />
              ),
            }))}
          />
        </div>
      )}

      <SectionHeading>これまでのスプレッドシートから取り込む</SectionHeading>
      <CsvImport formId={form.id} formTitle={formRowTitle(form)} />
    </>
  );
}
