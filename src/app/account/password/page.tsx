import { requireViewer } from "@/lib/session";
import { Card, PageTitle, ReasonNote } from "@/components/ui";
import { PasswordChangeForm } from "@/components/PasswordChangeForm";

export const dynamic = "force-dynamic";

/** 自分のパスワードを変更する画面。この画面の目的はそれだけ。 */
export default async function AccountPasswordPage() {
  const viewer = await requireViewer();

  return (
    <>
      <PageTitle
        breadcrumb={[{ label: "自分の情報", href: "/account" }]}
        title="パスワードの変更"
        lede={`${viewer.email} のパスワードを変更します。`}
      />
      {viewer.mustChangePassword && (
        <div className="mb-4">
          <ReasonNote>
            いまのパスワードは、アカウントを発行したときの仮のものです。あなただけが知っているものに変更してください。
          </ReasonNote>
        </div>
      )}
      <Card className="card-pad">
        <PasswordChangeForm />
      </Card>
      <p className="footnote mt-3">
        変更すると、他の端末でのログインは切れます（同じ画面をもう一度開いた場合はログインし直してください）。
      </p>
    </>
  );
}
