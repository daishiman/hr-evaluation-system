import { handle } from "@/lib/api";
import { apiViewer } from "@/lib/session";
import { listAllUsers, listCompanies, listMembers } from "@/lib/queries";
import { matchPerson, type PersonHit } from "@/lib/domain/search";

export const dynamic = "force-dynamic";

/**
 * ヘッダーの検索のうち「人」を探す部分。
 *
 * 検索してよい範囲は、その人が普段の画面で見られる範囲と同じにする。
 *   ・システム全体管理者 … すべての利用者と会社
 *   ・会社の管理者     … 自社の社員
 *   ・マネージャー     … 自分の下にいるメンバーだけ
 *   ・一般           … 人は探せない（自分以外の名前を持たない）
 *
 * 画面（メニュー）の検索は通信しない。ロールごとのメニューは
 * すでに画面側が持っているので、src/lib/nav.ts の表から出す。
 */
export async function GET(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("EMPLOYEE");
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
    if (q.length === 0) return { people: [] as PersonHit[] };

    const people: PersonHit[] = [];

    if (viewer.role === "SUPER_ADMIN") {
      for (const c of await listCompanies()) {
        if (!c.isActive) continue;
        people.push({ kind: "company", id: c.id, name: c.name, note: null, href: "/system/companies" });
      }
      for (const u of await listAllUsers()) {
        people.push({
          kind: "user",
          id: u.id,
          name: u.name,
          note: u.companyName ?? null,
          href: `/system/users/${u.id}`,
          email: u.email,
        });
      }
    } else if (viewer.role === "COMPANY_ADMIN" && viewer.companyId) {
      for (const m of await listMembers(viewer.companyId)) {
        people.push({
          kind: "member",
          id: m.id,
          name: m.name,
          note: m.gradeName ?? m.department ?? null,
          href: `/admin/members/${m.id}`,
          email: m.email,
          code: m.employeeCode,
        });
      }
    } else if (viewer.role === "MANAGER" && viewer.companyId) {
      for (const m of await listMembers(viewer.companyId, { managerId: viewer.id })) {
        people.push({
          kind: "member",
          id: m.id,
          name: m.name,
          note: m.gradeName ?? m.department ?? null,
          href: `/manager/members/${m.id}`,
          email: m.email,
          code: m.employeeCode,
        });
      }
    }

    // 上位だけ返す。全部返しても読めないうえ、社員名簿を丸ごと配ることになる
    return { people: people.filter((p) => matchPerson(p, q)).slice(0, 8) };
  });
}
