import { requireViewer } from "@/lib/session";
import { Card, PageTitle } from "@/components/ui";
import { PasswordChangeForm } from "@/components/PasswordChangeForm";

export const dynamic = "force-dynamic";

/**
 * 自分のパスワードを変更する画面。この画面の目的はそれだけ。
 *
 * 仮パスワードのままであることの案内は AppShell の全画面共通バナーが出す。
 * この画面はまさにその案内の行き先なので、ここで同じ文言を繰り返さない。
 */
export default async function AccountPasswordPage() {
  const viewer = await requireViewer();

  return (
    <>
      <PageTitle
        breadcrumb={[{ label: "自分の情報", href: "/account" }]}
        title="パスワードの変更"
        lede={`${viewer.email} のパスワードを変更します。`}
      />
      {/* 項目が3つだけの画面。幅いっぱいに伸ばさず、入力に見合った幅に絞る（.narrow-form） */}
      <Card className="card-pad narrow-form">
        <PasswordChangeForm />
      </Card>
      {/* 「他の端末のログインが切れる」は取り返しのつかない影響なので畳まない。
          押す前に必ず目に入る場所に、既定で出したままにする。 */}
      <p className="footnote narrow-form mt-3">
        変更すると、他の端末でのログインは切れます。
        同じ画面をもう一度開いていた場合は、ログインし直してください。
      </p>
    </>
  );
}
