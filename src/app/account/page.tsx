import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer, ROLE_LABEL, type Role } from "@/lib/session";
import { getSelfProfile, listProfileFieldPolicies } from "@/lib/queries";
import { PROFILE_FIELDS, resolveSelfEditMapForCompany, isSelfEditableField } from "@/lib/domain/profile-fields";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { Card, PageTitle, SectionHeading } from "@/components/ui";
import { SelfProfileEditor, type ProfileRow } from "@/components/SelfProfileEditor";
import { formatDate } from "@/lib/view";

export const dynamic = "force-dynamic";

/**
 * 自分の情報。
 *
 * 自分のことは全部ここで見られる。変えられるかどうかは会社の設定で決まり、
 * 変えられない項目も値は隠さない（見るのは自由、変えるのだけ制限する）。
 */
export default async function AccountPage() {
  const viewer = await requireViewer();
  const me = await getSelfProfile(viewer.id);
  if (!me) notFound();

  const policies = me.companyId ? await listProfileFieldPolicies(me.companyId) : [];
  const selfEdit = resolveSelfEditMapForCompany(me.companyId, policies);

  // 値の取り出しは1箇所にまとめる（項目を足すときにここだけ見ればよい）
  const valueOf = (key: string): string | null => {
    switch (key) {
      case "name":
        return me.name;
      case "department":
        return me.department;
      case "employeeCode":
        return me.employeeCode;
      case "hiredAt":
        return me.hiredAt;
      case "role":
        return ROLE_LABEL[me.role as Role] ?? me.role;
      case "gradeId":
        return me.gradeName;
      case "managerId":
        return me.managerName;
      case "isActive":
        return me.isActive ? "在籍" : "利用停止";
      default:
        return null;
    }
  };

  const rows: ProfileRow[] = PROFILE_FIELDS.map((f) => ({
    key: f.key,
    label: f.label,
    hint: f.hint,
    icon: f.icon,
    editable: isSelfEditableField(f.key) ? selfEdit[f.key] : false,
    // 読むときは「2024年4月1日」、入力欄に入れるときは「2024-04-01」
    value: f.key === "hiredAt" ? (me.hiredAt ? formatDate(me.hiredAt) : null) : valueOf(f.key),
    editValue: f.key === "hiredAt" ? me.hiredAt : undefined,
    type: (f.key === "hiredAt" ? "date" : "text") as ProfileRow["type"],
    managedBy: "会社の管理者",
  }));

  const editableCount = rows.filter((r) => r.editable).length;

  return (
    <>
      <PageTitle title="自分の情報" />

      {/* いちばん上は「自分が誰として、どの立場でこのシステムを使っているか」だけ。
          細かい登録内容はその下の一覧に置く。 */}
      <Card className="card-pad hero-tint">
        <div className="identity-head">
          <Avatar name={me.name} seed={me.id} size={64} />
          <div className="min-w-0">
            <p className="m-0 text-[20px] font-bold leading-tight">{me.name}</p>
            <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--ink-muted)]">
              <span className="inline-flex items-center gap-1">
                <Icon name="mail" size={13} />
                {me.email}
              </span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="tag">
                <Icon name="shield" size={13} />
                {ROLE_LABEL[me.role as Role] ?? me.role}
              </span>
              {me.companyName && (
                <span className="tag">
                  <Icon name="building" size={13} />
                  {me.companyName}
                </span>
              )}
              {me.gradeName && (
                <span className="tag">
                  <Icon name="layers" size={13} />
                  {me.gradeName}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      <SectionHeading
        aside={
          <span className="footnote">
            {editableCount === 0
              ? me.companyId
                ? "この会社では、登録内容の変更は会社の管理者が行います"
                : "会社所属がないため、この画面では登録内容を変更できません"
              : `${editableCount}件を自分で変えられます`}
          </span>
        }
      >
        登録内容
      </SectionHeading>
      <Card>
        <SelfProfileEditor rows={rows} />
      </Card>

      <SectionHeading>パスワード</SectionHeading>
      <Card className="card-pad">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 text-[13px]">
            {me.mustChangePassword
              ? "いまのパスワードは、アカウントを発行したときの仮のものです。"
              : "パスワードはいつでも変更できます。"}
          </p>
          <Link href="/account/password" className={`btn ${me.mustChangePassword ? "btn-primary" : "btn-secondary"}`}>
            パスワードを変える
          </Link>
        </div>
      </Card>

      <p className="footnote mt-3">
        上長・管理者は、評価のための所見をこの他に記録することがあります。その内容はこの画面には出ません。
      </p>
    </>
  );
}
