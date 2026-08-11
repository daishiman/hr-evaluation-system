import { describe, expect, it } from "vitest";
import {
  atLeast,
  canEditForm,
  canEditScheme,
  canSeeCriteria,
  canSeeFormContent,
  canSeeFormResponses,
  resolveCompanyId,
  ROLE_LABEL,
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

  it("一般の方には評価基準・配点を見せない", () => {
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

/**
 * 役割の呼び名。
 *
 * マネージャーも会社の管理者も自分の上長から評価を受けるため、
 * 「評価される／しない」で役割を言い分けない。設定を持たない立場は「一般」。
 */
describe("役割の呼び名", () => {
  it("EMPLOYEE は「一般」と呼ぶ", () => {
    expect(ROLE_LABEL.EMPLOYEE).toBe("一般");
  });

  it("評価されるかどうかで役割を言い分けない", () => {
    for (const role of ROLES) {
      expect(ROLE_LABEL[role]).not.toContain("評価される");
      expect(ROLE_LABEL[role]).not.toContain("被評価");
    }
  });

  it("保存する値（EMPLOYEE など）は呼び名と切り離しておく", () => {
    // 呼び名を変えてもDBの値は変えない。過去のデータと突き合わせができなくなるため
    expect(ROLES).toEqual(["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER", "EMPLOYEE"]);
  });
});
