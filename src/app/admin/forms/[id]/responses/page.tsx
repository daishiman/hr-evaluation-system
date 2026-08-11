import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyReminder } from "@/components/CopyReminder";
import { CopyUrl } from "@/components/CopyUrl";
import { appOrigin, formUrl } from "@/lib/origin";
import { requireRole } from "@/lib/session";
import { getForm, listResponseStatus } from "@/lib/queries";
import { listFormExtensions } from "@/lib/response-access";
import { CsvImport } from "@/components/CsvImport";
import { ActionButton } from "@/components/ActionButton";
import { RecordForm } from "@/components/RecordForm";
import { Badge, Card, EmptyState, Num, PageTitle, ReasonNote, SectionHeading } from "@/components/ui";
import { FORM_STATUS_LABEL, formatDate } from "@/lib/view";
import { formatJpDate, judgeFormDeadline, jstDateString } from "@/lib/domain/form-deadline";

export const dynamic = "force-dynamic";

/** 「2026/07/24 12:32」の形にする（回答日時は分まで見えれば足りる）。 */
function formatWhen(v: Date | string | null): string {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${formatDate(d)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * アンケート1本の回答一覧。
 *
 * これまでスプレッドシートの「回答一覧」シートで見ていたものに当たる。
 * 提出済みだけを並べず、対象等級の在籍者を全員並べて未回答の人を見えるようにする
 * （催促できる状態にするため）。
 */
export default async function AdminFormResponses({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole("COMPANY_ADMIN");
  const { id } = await params;
  if (!viewer.companyId) notFound();
  const companyId = viewer.companyId;

  const form = await getForm(companyId, id);
  if (!form) notFound();

  const [rows, extensions] = await Promise.all([
    listResponseStatus(companyId, form.id),
    listFormExtensions(companyId, form.id),
  ]);
  /* 催促の文面にはそのまま開けるURLを入れる（相対パスだと貼り付け先で開けないため）。
     優先順位の理由は appOrigin() 側に書いてある。 */
  const origin = await appOrigin();
  const judgement = judgeFormDeadline({
    status: form.status,
    opensAt: form.opensAt,
    closesAt: form.closesAt,
    now: new Date(),
  });
  const activeExtensions = extensions.filter((e) => !e.revokedAt);
  const active = rows.filter((r) => r.isActive);
  const submitted = active.filter((r) => r.status === "submitted");
  const drafting = active.filter((r) => r.status === "draft");
  const missing = active.filter((r) => !r.responseId);

  return (
    <>
      <PageTitle
        title="回答一覧"
        lede={`${form.title}（${form.cycleName ?? ""} ／ 対象：${form.gradeName ?? "—"} ／ ${FORM_STATUS_LABEL[form.status] ?? form.status}）`}
        actions={
          <>
            <a href={`/api/export?type=responses&formId=${form.id}`} className="btn btn-secondary">
              CSVに書き出す
            </a>
            <Link href={`/admin/forms/${form.id}`} className="btn btn-tertiary">
              設問を見る
            </Link>
          </>
        }
      />

      <Card className="card-pad">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="footnote m-0">対象の人数</dt>
            <dd className="m-0"><Num value={active.length} unit="人" display /></dd>
          </div>
          <div>
            <dt className="footnote m-0">提出済み</dt>
            <dd className="m-0"><Num value={submitted.length} unit="人" display /></dd>
          </div>
          <div>
            <dt className="footnote m-0">入力途中</dt>
            <dd className="m-0"><Num value={drafting.length} unit="人" display /></dd>
          </div>
          <div>
            <dt className="footnote m-0">未回答</dt>
            <dd className="m-0"><Num value={missing.length} unit="人" display /></dd>
          </div>
        </dl>
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
          <p className="mt-2">
            <CopyUrl url={formUrl(origin, form.publicToken)} label="回答画面のURL" />
          </p>
          <div className="mt-3">
            <CopyReminder
              names={missing.map((r) => r.name)}
              url={formUrl(origin, form.publicToken)}
              deadline={form.closesAt}
            />
          </div>
        </div>
      )}

      <SectionHeading aside={<span className="footnote">氏名の順に並んでいます</span>}>
        対象者と回答の状況（{rows.length}人）
      </SectionHeading>

      {rows.length === 0 ? (
        <EmptyState
          title="対象になる人がいません"
          body={`${form.gradeName ?? "この等級"}に登録されている方がいないため、回答する人がいません。メンバー画面で等級を設定してください。`}
        />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>氏名</th>
                <th>社員番号</th>
                <th>事業所</th>
                <th>状況</th>
                <th>回答日時</th>
                <th>取り込み元</th>
                <th>個別の期限</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const ext = activeExtensions.filter((e) => e.employeeId === r.employeeId);
                const until = ext.map((e) => e.extendedUntil).sort().at(-1) ?? null;
                return (
                <tr key={r.employeeId}>
                  <td>
                    {r.responseId ? (
                      <Link href={`/me/responses/${r.responseId}`} className="text-[var(--brand-deep)]">
                        {r.name}
                      </Link>
                    ) : (
                      r.name
                    )}
                    {!r.isActive && <span className="footnote"> （利用停止中）</span>}
                  </td>
                  <td>{r.employeeCode ?? "—"}</td>
                  <td>{r.officeName ?? r.department ?? "—"}</td>
                  <td>
                    {r.status === "submitted" ? (
                      <Badge tone="done">提出済み</Badge>
                    ) : r.status === "draft" ? (
                      <Badge tone="active">入力途中</Badge>
                    ) : (
                      <Badge tone="required">未回答</Badge>
                    )}
                  </td>
                  <td>{formatWhen(r.submittedAt)}</td>
                  <td>{r.importSource === "csv" ? "取り込み（CSV）" : r.responseId ? "この画面から回答" : "—"}</td>
                  <td>{until ? formatJpDate(until) : "—"}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <SectionHeading aside={<span className="footnote">記録は消えません（取り消しても履歴に残ります）</span>}>
        回答期限の延長
      </SectionHeading>
      <p className="footnote mb-2">
        締切を過ぎると回答できなくなります。休職・出張などで間に合わなかった方には、ここでその方だけ期限を延ばせます。延ばした期限は本人の回答画面にも表示されます。
      </p>

      {rows.length > 0 && (
        <RecordForm
          url={`/api/forms/${form.id}/extensions`}
          method="POST"
          submitLabel="この内容で期限を延ばす"
          fields={[
            {
              name: "employeeId",
              label: "対象の方",
              type: "select",
              required: true,
              options: rows.map((r) => ({
                value: r.employeeId,
                label: `${r.name}（${r.status === "submitted" ? "提出済み" : r.status === "draft" ? "入力途中" : "未回答"}）`,
              })),
            },
            {
              name: "extendedUntil",
              label: "いつまで延ばすか",
              type: "date",
              required: true,
              help: `もとの締切（${form.closesAt ? formatJpDate(form.closesAt) : "指定なし"}）より後の日付を選んでください。指定した日の終わりまで回答できます。`,
              defaultValue: jstDateString(new Date()),
            },
            {
              name: "reason",
              label: "理由",
              type: "textarea",
              help: "あとから「なぜ延ばしたか」を確認できるようにするための記録です（例：長期休暇のため）。",
            },
          ]}
        />
      )}

      {extensions.length > 0 && (
        <div className="mt-4">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>対象の方</th>
                  <th>延ばした期限</th>
                  <th>理由</th>
                  <th>登録した日時</th>
                  <th>状態</th>
                </tr>
              </thead>
              <tbody>
                {extensions.map((e) => (
                  <tr key={e.id}>
                    <td>{e.employeeName ?? "—"}</td>
                    <td>{formatJpDate(e.extendedUntil)}</td>
                    <td>{e.reason ?? "—"}</td>
                    <td>{formatWhen(e.createdAt)}</td>
                    <td>
                      {e.revokedAt ? (
                        <span className="footnote">{formatWhen(e.revokedAt)}に取り消し</span>
                      ) : (
                        <ActionButton
                          url={`/api/forms/${form.id}/extensions`}
                          method="PATCH"
                          body={{ extensionId: e.id }}
                          label="延長を取り消す"
                          variant="tertiary"
                          confirm={`${e.employeeName ?? "この方"}の延長を取り消すと、締切を過ぎている場合はその場で回答できなくなります。記録は履歴として残ります。`}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <SectionHeading>これまでのスプレッドシートから取り込む</SectionHeading>
      <CsvImport formId={form.id} formTitle={form.title} />
    </>
  );
}
