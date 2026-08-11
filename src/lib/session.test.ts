import { describe, expect, it } from "vitest";
import {
  atLeast,
  canEditForm,
  canEditScheme,
  canSeeCriteria,
  canSeeFormContent,
  canSeeFormResponses,
  resolveCompanyId,
  ROLES,
  type Viewer,
} from "@/lib/session";

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

/**
 * アンケートの「中身（設問）」と「回答（誰がどう答えたか）」は別物として扱う。
 * 中身は内容が適切か確かめるために全ロールへ開き、回答はこれまでどおり管理者だけにする。
 * ここが崩れると、評価そのものである回答が権限の緩和に巻き込まれて広がってしまう。
 */
describe("アンケートの見え方", () => {
  it("中身（設問）はどのロールでも読める", () => {
    for (const role of ROLES) {
      expect(canSeeFormContent(role), `${role} が中身を読めない`).toBe(true);
    }
  });

  it("回答（誰がどう答えたか）は会社の管理者以上だけ", () => {
    expect(canSeeFormResponses("EMPLOYEE")).toBe(false);
    expect(canSeeFormResponses("MANAGER")).toBe(false);
    expect(canSeeFormResponses("COMPANY_ADMIN")).toBe(true);
    expect(canSeeFormResponses("SUPER_ADMIN")).toBe(true);
  });

  it("読めるようにしても、作る・直す・公開するのは会社の管理者以上のまま", () => {
    expect(canEditForm("EMPLOYEE")).toBe(false);
    expect(canEditForm("MANAGER")).toBe(false);
    expect(canEditForm("COMPANY_ADMIN")).toBe(true);
    expect(canEditForm("SUPER_ADMIN")).toBe(true);
  });

  it("中身を読めることは、回答を読めることを意味しない", () => {
    const readOnly = ROLES.filter((r) => canSeeFormContent(r) && !canSeeFormResponses(r));
    expect(readOnly).toEqual(["MANAGER", "EMPLOYEE"]);
  });
});
