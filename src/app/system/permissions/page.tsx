import { Card, PageTitle, SectionHeading } from "@/components/ui";
import { PermissionMatrix } from "@/components/permissions/PermissionMatrix";
import { permissionRows, sharedOperationRows } from "@/lib/permission-rows";
import { requireRoute } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * 権限一覧（システム全体管理者だけ。DD-006）。
 *
 * 「どの役割が、どの画面を開けて、何ができるか」を1枚の表で見せる。
 * 中身は台帳（system-spec/route-ledger.json）から作る。画面の入口・サーバー処理・メニューも
 * 同じ台帳を読むので、ここに書いてあることと実際の動きはずれない（D-007）。
 *
 * 台帳はリポジトリに入っている固定のデータなので、画面を開くたびに DB を読む必要はない。
 */
export default async function SystemPermissions() {
  await requireRoute("/system/permissions");
  const rows = permissionRows();
  const shared = sharedOperationRows();

  return (
    <>
      <PageTitle
        title="権限一覧"
        lede="役割ごとに、開ける画面とできる操作の一覧です。メニュー・画面の入口・保存の処理は、どれもこの一覧と同じ決まりで動きます。"
      />

      <PermissionMatrix rows={rows} />

      <SectionHeading>どの画面からでも使う操作</SectionHeading>
      <Card className="card-pad">
        {/* 1件は名前と説明の2行で短いので、広い画面では2列に並べる（1列だと右側が空いたまま残る。§28-9） */}
        <ul className="m-0 grid gap-x-8 gap-y-3 pl-5 md:grid-cols-2">
          {shared.map((op) => (
            <li key={op.id}>
              <span className="font-semibold">{op.label}</span>
              <span className="footnote">（{op.minRoleLabel}から）</span>
              <br />
              <span className="footnote">{op.description}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
