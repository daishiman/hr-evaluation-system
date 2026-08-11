import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listProfileFieldPolicies } from "@/lib/queries";
import { CONFIGURABLE_FIELDS, PROFILE_FIELDS, resolveSelfEditMap } from "@/lib/domain/profile-fields";
import { Card, EmptyState, PageTitle, SectionHeading } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { ProfilePolicyEditor, type PolicyItem } from "@/components/ProfilePolicyEditor";

export const dynamic = "force-dynamic";

/** 社員が自分で変えてよい項目を、会社ごとに決める。 */
export default async function ProfilePolicyPage() {
  const viewer = await requireRole("COMPANY_ADMIN");
  if (!viewer.companyId) {
    return <EmptyState title="対象の会社が選ばれていません" body="上のメニューから会社を選んでください。" />;
  }

  const rows = await listProfileFieldPolicies(viewer.companyId);
  const map = resolveSelfEditMap(rows);

  const items: PolicyItem[] = CONFIGURABLE_FIELDS.map((f) => ({
    key: f.key,
    label: f.label,
    hint: f.hint,
    icon: f.icon,
    selfEditable: map[f.key as keyof typeof map],
  }));

  const locked = PROFILE_FIELDS.filter((f) => !f.configurable);

  return (
    <>
      <PageTitle
        breadcrumb={[{ label: "社員", href: "/admin/members" }]}
        title="本人が変更できる項目"
        lede="社員が自分の画面（自分の情報）で直せる項目を決めます。ここで「会社の管理者のみ」にした項目は、本人の画面では鍵付きで表示され、変更できません。"
      />

      <SectionHeading>項目ごとに決める</SectionHeading>
      <Card>
        <ProfilePolicyEditor items={items} />
      </Card>

      <SectionHeading>ここでは変えられない項目</SectionHeading>
      <Card className="card-pad">
        <p className="m-0 mb-3 text-sub">
          次の項目は、設定にかかわらず本人には開放しません。本人が自分の権限や評価の土台を書き換えられる状態を作らないためです。
        </p>
        <div className="flex flex-wrap gap-2">
          {locked.map((f) => (
            <span key={f.key} className="tag">
              <Icon name="lock" size={13} />
              {f.label}
            </span>
          ))}
        </div>
      </Card>

      <p className="footnote mt-3">
        変更は保存ボタンを押さずに、切り替えたその場で反映されます。設定を戻したいときは、もう一方を押してください。
      </p>
    </>
  );
}
