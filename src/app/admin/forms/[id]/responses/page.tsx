import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { CopyReminder } from "@/components/CopyReminder";
import { requireRole } from "@/lib/session";
import { getForm, listResponseStatus } from "@/lib/queries";
import { CsvImport } from "@/components/CsvImport";
import { Badge, Card, EmptyState, Num, PageTitle, ReasonNote, SectionHeading } from "@/components/ui";
import { FORM_STATUS_LABEL, formatDate } from "@/lib/view";

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

  const rows = await listResponseStatus(companyId, form.id);
  // 催促の文面にはそのまま開けるURLを入れる（相対パスだと貼り付け先で開けないため）
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;
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

      {missing.length > 0 && (
        <div className="mt-4">
          <ReasonNote>
            {missing.length}人がまだ回答していません（{missing.slice(0, 5).map((r) => r.name).join("、")}
            {missing.length > 5 ? " ほか" : ""}）。回答画面のURLは <code className="text-[11px]">/f/{form.publicToken}</code> です。
          </ReasonNote>
          <div className="mt-3">
            <CopyReminder
              names={missing.map((r) => r.name)}
              url={`${origin}/f/${form.publicToken}`}
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
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.employeeId}>
                  <td>
                    {r.name}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SectionHeading>これまでのスプレッドシートから取り込む</SectionHeading>
      <CsvImport formId={form.id} formTitle={form.title} />
    </>
  );
}
