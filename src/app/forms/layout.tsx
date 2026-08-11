import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { canSeeFormContent, homePathFor, requireViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * アンケートの中身を読む画面（全ロール共通・確認専用）。
 *
 * ログインしていれば、自社のアンケートはどの等級あてのものでも読める。
 * 「この設問で適切か」を確かめられる人が作った本人だけだと、
 * 文面の誤りが配ったあとまで誰にも気づかれないため。
 *
 * 見せてよいロールの判断は canSeeFormContent が正本なので、ここでも通す
 * （方針が変われば1箇所を直せば全画面に効く）。回答データはこの配下に一切出さない。
 */
export default async function FormContentLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  if (!canSeeFormContent(viewer.role)) redirect(`${homePathFor(viewer.role)}?denied=1`);
  return <AppShell viewer={viewer}>{children}</AppShell>;
}
