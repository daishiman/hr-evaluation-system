import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getViewer, homePathFor } from "@/lib/session";
import { getDb, schema as s } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { LinkButton, PageTitle, ReasonNote } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * 配布用URL（/f/トークン）。
 *
 * 人事評価の回答は誰が答えたかが分からないと集計できないため、
 * このURLでもログインは必須にしている（URLを知っていれば誰でも書ける状態にはしない）。
 * ログイン後は、自分の等級のアンケートであれば回答画面へそのまま送る。
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

  if (viewer.gradeId !== form.gradeId) {
    return (
      <AppShell viewer={viewer}>
        <PageTitle title="このアンケートの対象ではありません" />
        <ReasonNote action={<LinkButton href="/me/forms">自分のアンケートを見る</LinkButton>}>
          このアンケートは別の等級の方向けです。ご自身の等級のアンケートは「実績を報告する」から開けます。
        </ReasonNote>
      </AppShell>
    );
  }

  redirect(`/me/forms/${form.id}`);
}
