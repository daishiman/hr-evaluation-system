import { describe, expect, it } from "vitest";
import { homeItemFor, isCurrent, navGroupsFor, type NavGroup } from "@/lib/nav";

const hrefsOf = (groups: NavGroup[]) => groups.flatMap((g) => g.items.map((i) => i.href));

describe("サイドバーのメニュー", () => {
  it("評価される方には、制度の設定と評価基準を一切出さない", () => {
    const hrefs = hrefsOf(navGroupsFor("EMPLOYEE"));
    expect(hrefs.some((h) => h.startsWith("/admin"))).toBe(false);
    expect(hrefs.some((h) => h.startsWith("/system"))).toBe(false);
    expect(hrefs).not.toContain("/criteria");
    // 自分の実績報告と結果、パスワード変更だけが見える
    expect(hrefs).toEqual(["/me", "/me/forms", "/me/results", "/account/password"]);
  });

  it("マネージャーには制度の設定を出さない（評価基準は見てよい）", () => {
    const hrefs = hrefsOf(navGroupsFor("MANAGER"));
    expect(hrefs).toContain("/criteria");
    expect(hrefs.some((h) => h.startsWith("/admin"))).toBe(false);
    expect(hrefs.some((h) => h.startsWith("/system"))).toBe(false);
  });

  it("会社の管理者には制度の設定が出て、システム管理は出ない", () => {
    const hrefs = hrefsOf(navGroupsFor("COMPANY_ADMIN"));
    expect(hrefs).toContain("/admin/masters/requirements");
    expect(hrefs).toContain("/admin/scheme");
    expect(hrefs.some((h) => h.startsWith("/system"))).toBe(false);
  });

  it("システム全体管理者にはシステム管理と会社ごとの運用の両方が出る", () => {
    const hrefs = hrefsOf(navGroupsFor("SUPER_ADMIN"));
    expect(hrefs).toContain("/system/companies");
    expect(hrefs).toContain("/admin/masters");
  });

  it("どのロールでも、分類のあるグループには見出しが付いている", () => {
    for (const role of ["EMPLOYEE", "MANAGER", "COMPANY_ADMIN", "SUPER_ADMIN"] as const) {
      const groups = navGroupsFor(role);
      // 見出しなしで許されるのはホームだけ
      const untitled = groups.filter((g) => g.title === null);
      expect(untitled).toHaveLength(1);
      expect(untitled[0].items).toHaveLength(1);
      expect(untitled[0].items[0].label).toBe("ホーム");
    }
  });

  it("ホームはロールごとの入口と一致する", () => {
    expect(homeItemFor("EMPLOYEE").href).toBe("/me");
    expect(homeItemFor("MANAGER").href).toBe("/manager");
    expect(homeItemFor("COMPANY_ADMIN").href).toBe("/admin");
    expect(homeItemFor("SUPER_ADMIN").href).toBe("/system");
  });
});

describe("現在地の判定", () => {
  const hrefs = hrefsOf(navGroupsFor("COMPANY_ADMIN"));
  const at = (pathname: string, href: string) =>
    isCurrent(pathname, { href, label: href, exact: href === "/admin" }, hrefs);

  it("詳細画面にいるときも、その一覧が現在地になる", () => {
    expect(at("/admin/forms/f1", "/admin/forms")).toBe(true);
    expect(at("/admin/forms/f1/responses", "/admin/forms")).toBe(true);
  });

  it("ホームは完全一致のときだけ（配下の画面で光らせない）", () => {
    expect(at("/admin", "/admin")).toBe(true);
    expect(at("/admin/forms", "/admin")).toBe(false);
  });

  it("等級要件にいるとき、制度マスタは現在地にしない（深い方だけを光らせる）", () => {
    expect(at("/admin/masters/requirements", "/admin/masters/requirements")).toBe(true);
    expect(at("/admin/masters/requirements", "/admin/masters")).toBe(false);
    // 制度マスタ自身にいるときは制度マスタが現在地
    expect(at("/admin/masters", "/admin/masters")).toBe(true);
  });

  it("関係のない画面ではどれも現在地にならない", () => {
    expect(hrefs.every((h) => !at("/admin/nowhere", h))).toBe(true);
  });
});
