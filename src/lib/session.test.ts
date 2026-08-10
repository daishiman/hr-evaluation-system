import { describe, expect, it } from "vitest";
import { atLeast, canEditScheme, canSeeCriteria, resolveCompanyId, type Viewer } from "@/lib/session";

/** 会社の絞り込みは全画面がこの関数を通るため、ロールごとの結果をここで固定する。 */
const viewer = (role: Viewer["role"], companyId: string | null): Viewer => ({
  id: "u1", name: "テスト", email: "t@example.com", role, companyId,
  gradeId: null, managerId: null, department: null, employeeCode: null,
  hiredAt: null, companyName: null, mustChangePassword: false,
});

describe("対象の会社の決め方", () => {
  it("システム全体管理者は指定した会社を操作できる", () => {
    expect(resolveCompanyId(viewer("SUPER_ADMIN", "cmp_a"), "cmp_b")).toBe("cmp_b");
  });

  it("システム全体管理者が指定しなければ、いま選んでいる会社になる", () => {
    expect(resolveCompanyId(viewer("SUPER_ADMIN", "cmp_a"), null)).toBe("cmp_a");
    expect(resolveCompanyId(viewer("SUPER_ADMIN", "cmp_a"))).toBe("cmp_a");
  });

  it("他のロールは他社IDを渡されても自社に強制される", () => {
    for (const role of ["COMPANY_ADMIN", "MANAGER", "EMPLOYEE"] as const) {
      expect(resolveCompanyId(viewer(role, "cmp_a"), "cmp_b")).toBe("cmp_a");
    }
  });
});

describe("権限の強さ", () => {
  it("システム全体管理者は会社の管理者にできることをすべてできる", () => {
    expect(atLeast("SUPER_ADMIN", "COMPANY_ADMIN")).toBe(true);
    expect(canEditScheme("SUPER_ADMIN")).toBe(true);
    expect(canSeeCriteria("SUPER_ADMIN")).toBe(true);
  });

  it("評価される方には評価基準・配点を見せない", () => {
    expect(canSeeCriteria("EMPLOYEE")).toBe(false);
    expect(canEditScheme("MANAGER")).toBe(false);
  });
});
