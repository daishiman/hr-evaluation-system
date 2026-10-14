import { DetailDialogButton } from "@/components/ConfirmButton";
import { PermissionMatrix } from "@/components/permissions/PermissionMatrix";
import { DefList, Disclosure } from "@/components/ui";
import { permissionRows, ROLE_SUMMARY } from "@/lib/permission-rows";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/roles";

/**
 * 「役割ごとにできること」の折りたたみ（利用者一覧・社員一覧に置く。DD-006）。
 *
 * 役割を選ぶ・変える画面で、選ぶ前に違いを確かめられるようにする。
 * 一言の要約と開ける画面の数をここに出し、細かい可否は「権限一覧を開く」の窓で見せる
 * （中身は /system/permissions と同じ部品・同じ台帳）。
 */
export function RoleCapabilities({ roles = ROLES, initialRole }: { roles?: readonly Role[]; initialRole?: Role }) {
  const rows = permissionRows();
  const openable = (role: Role) => rows.filter((row) => row.byRole[role] !== "none").length;

  return (
    <Disclosure summary="役割ごとにできること" meta="権限一覧を窓で開けます" rememberAs="role-capabilities">
      <DefList
        rows={roles.map((role) => ({
          key: role,
          label: ROLE_LABEL[role],
          value: (
            <>
              {ROLE_SUMMARY[role]}
              <span className="footnote">（開ける画面 {openable(role)}）</span>
            </>
          ),
        }))}
      />
      <div className="mt-3">
        <DetailDialogButton label="権限一覧を開く" title="権限一覧" variant="secondary" wide>
          <PermissionMatrix rows={rows} initialRole={initialRole} />
        </DetailDialogButton>
      </div>
    </Disclosure>
  );
}
