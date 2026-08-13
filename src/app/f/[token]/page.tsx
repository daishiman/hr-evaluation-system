import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getViewer, homePathFor } from "@/lib/session";
import { getDb, schema as s } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { LinkButton, PageTitle, ReasonNote } from "@/components/ui";
import { listActiveExtensions } from "@/lib/response-access";
import { formatJpDate, judgeFormDeadline } from "@/lib/domain/form-deadline";
import { judgeFormEntry } from "@/lib/domain/form-entry";

export const dynamic = "force-dynamic";

/**
 * 配布用URL（/f/トークン）。
 *
 * 人事評価の回答は誰が答えたかが分からないと集計できないため、
 * このURLでもログインは必須にしている（URLを知っていれば誰でも書ける状態にはしない）。
 *
 * 以前は状態も回答期間も見ずに回答画面へ送っていたため、まだ公開していないアンケートや
 * 締め切ったアンケートのURLを踏んだ人が、理由の分からない画面に着いていた。
 * ここで状態と期間を見て、「いつから／いつまでか」を日本語で案内する。
 */
export default async function PublicForm({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/f/${token}`)}`);

  const db = await getDb();
  const form = (await db.select().from(s.forms).where(eq(s.forms.publicToken, token)).limit(1))[0];

  if (!form || form.companyId !== viewer.companyId) {
    return (
      <AppShell viewer={viewer}>
        <PageTitle title="このURLのアンケートは開けません" />
        <ReasonNote action={<LinkButton href={homePathFor(viewer.role)}>ホームへ戻る</LinkButton>}>
          URLが間違っているか、ご所属の会社のアンケートではありません。担当の方にURLをご確認ください。
        </ReasonNote>
      </AppShell>
    );
  }

  const cycle = (
    await db
      .select({ status: s.evaluationCycles.status })
      .from(s.evaluationCycles)
      .where(and(eq(s.evaluationCycles.id, form.cycleId), eq(s.evaluationCycles.companyId, form.companyId)))
      .limit(1)
  )[0];

  // 過去に自分が答えていれば、等級が変わっていても読み返せるようにする
  const mine = (
    await db
      .select({ id: s.formResponses.id })
      .from(s.formResponses)
      .where(and(eq(s.formResponses.formId, form.id), eq(s.formResponses.employeeId, viewer.id)))
      .limit(1)
  )[0];

  // 対象等級が違っても閉ざさない。中身の確認画面へ送り、そこで回答できない理由を伝える。
  if (judgeFormEntry({ viewerGradeId: viewer.gradeId, formGradeId: form.gradeId, hasResponse: !!mine }) === "content-only") {
    redirect(`/forms/${form.id}`);
  }

  const judgement = judgeFormDeadline({
    cycleStatus: cycle?.status ?? "unknown",
    status: form.status,
    opensAt: form.opensAt,
    closesAt: form.closesAt,
    extensions: await listActiveExtensions(form.id, viewer.id),
    now: new Date(),
  });

  // 提出済み・回答途中なら、締切後でも読み返せるように回答画面へ送る（そこで読み取り専用になる）
  if (!judgement.canAnswer && !mine) {
    const detail =
      judgement.state === "before_open" && form.opensAt
        ? `受付は${formatJpDate(form.opensAt)}に始まります。`
        : judgement.state === "not_published"
          ? "担当の方が公開の準備をしています。"
          : "";
    return (
      <AppShell viewer={viewer}>
        <PageTitle title={form.title} />
        <ReasonNote action={<LinkButton href="/me/forms">自分のアンケートを見る</LinkButton>}>
          {judgement.message}
          {detail}
          {judgement.state === "past_deadline" || judgement.state === "closed_by_admin"
            ? "事情があって今から提出したい場合は、上長または会社の管理者にご相談ください。個別に期限を延ばすことができます。"
            : "受付が始まると「実績を報告する」の一覧にも並びます。"}
        </ReasonNote>
      </AppShell>
    );
  }

  redirect(`/me/forms/${form.id}`);
}
