import { describe, expect, it } from "vitest";
import { accountSecurityChanges, type AccountAccess } from "./account-security-events";

const member = (companyId: string, role: "EMPLOYEE" | "MANAGER" | "COMPANY_ADMIN", isActive = true): AccountAccess => ({
  superAdmin: false,
  isActive,
  membership: { companyId, role },
});
const superAdmin = (isActive = true): AccountAccess => ({ superAdmin: true, isActive, membership: null });
const noReissue = { passwordReissued: false };

describe("accountSecurityChanges（権限にかかわる操作から、残す出来事を決める）", () => {
  it("新規作成は1件にまとめ、最初の仮パスワードを再発行として数えない", () => {
    expect(accountSecurityChanges(null, member("co_a", "MANAGER"), { passwordReissued: true })).toEqual([
      {
        eventType: "account_created",
        companyId: "co_a",
        before: null,
        after: { role: "MANAGER", companyId: "co_a", isActive: true },
      },
    ]);
  });

  it("全体管理者の新規作成は、会社の無い出来事として残す", () => {
    expect(accountSecurityChanges(null, superAdmin(), noReissue)).toEqual([
      {
        eventType: "account_created",
        companyId: null,
        before: null,
        after: { role: "SUPER_ADMIN", companyId: null, isActive: true },
      },
    ]);
  });

  it("全体管理者にするときは、外した所属の会社と役割を before に残す（役割の変更とは別に数えない）", () => {
    expect(accountSecurityChanges(member("co_a", "COMPANY_ADMIN"), superAdmin(), noReissue)).toEqual([
      {
        eventType: "super_admin_granted",
        companyId: "co_a",
        before: { role: "COMPANY_ADMIN", companyId: "co_a" },
        after: { role: "SUPER_ADMIN", companyId: null },
      },
    ]);
  });

  it("所属の無い人を全体管理者にしたときは、会社も役割も null で残す", () => {
    const orphan: AccountAccess = { superAdmin: false, isActive: true, membership: null };
    expect(accountSecurityChanges(orphan, superAdmin(), noReissue)).toEqual([
      {
        eventType: "super_admin_granted",
        companyId: null,
        before: { role: null, companyId: null },
        after: { role: "SUPER_ADMIN", companyId: null },
      },
    ]);
  });

  it("全体管理者から外すときは、作った所属の会社と役割を after に残す", () => {
    expect(accountSecurityChanges(superAdmin(), member("co_b", "EMPLOYEE"), noReissue)).toEqual([
      {
        eventType: "super_admin_revoked",
        companyId: "co_b",
        before: { role: "SUPER_ADMIN", companyId: null },
        after: { role: "EMPLOYEE", companyId: "co_b" },
      },
    ]);
  });

  it("全体管理者から外して所属を作らなかったときは、after の会社も役割も null で残す", () => {
    const orphan: AccountAccess = { superAdmin: false, isActive: true, membership: null };
    expect(accountSecurityChanges(superAdmin(), orphan, noReissue)).toEqual([
      {
        eventType: "super_admin_revoked",
        companyId: null,
        before: { role: "SUPER_ADMIN", companyId: null },
        after: { role: null, companyId: null },
      },
    ]);
  });

  it("会社を移しながら役割も変えたら、移動と役割の変更を別々に残す（会社の列は移った先）", () => {
    expect(accountSecurityChanges(member("co_a", "EMPLOYEE"), member("co_b", "MANAGER"), noReissue)).toEqual([
      { eventType: "company_moved", companyId: "co_b", before: { companyId: "co_a" }, after: { companyId: "co_b" } },
      { eventType: "role_changed", companyId: "co_b", before: { role: "EMPLOYEE" }, after: { role: "MANAGER" } },
    ]);
  });

  it("所属を失っていた人に所属を作ったときは、会社の移動として null から残す", () => {
    const orphan: AccountAccess = { superAdmin: false, isActive: true, membership: null };
    expect(accountSecurityChanges(orphan, member("co_a", "EMPLOYEE"), noReissue)).toEqual([
      { eventType: "company_moved", companyId: "co_a", before: { companyId: null }, after: { companyId: "co_a" } },
      { eventType: "role_changed", companyId: "co_a", before: { role: null }, after: { role: "EMPLOYEE" } },
    ]);
  });

  it("停止と再開を、変えた向きで分けて残す", () => {
    expect(accountSecurityChanges(member("co_a", "EMPLOYEE"), member("co_a", "EMPLOYEE", false), noReissue)).toEqual([
      { eventType: "deactivated", companyId: "co_a", before: { isActive: true }, after: { isActive: false } },
    ]);
    expect(accountSecurityChanges(superAdmin(false), superAdmin(true), noReissue)).toEqual([
      { eventType: "reactivated", companyId: null, before: { isActive: false }, after: { isActive: true } },
    ]);
  });

  it("パスワードの再発行は値を持たない出来事として残す（本文も hash も入れる場所が無い）", () => {
    expect(accountSecurityChanges(member("co_a", "MANAGER"), member("co_a", "MANAGER"), { passwordReissued: true })).toEqual([
      { eventType: "password_reissued", companyId: "co_a", before: null, after: null },
    ]);
  });

  it("権限にかかわる値が何も変わらない保存（氏名・部署だけなど）は、何も残さない", () => {
    expect(accountSecurityChanges(member("co_a", "MANAGER"), member("co_a", "MANAGER"), noReissue)).toEqual([]);
    expect(accountSecurityChanges(superAdmin(), superAdmin(), noReissue)).toEqual([]);
    const orphan: AccountAccess = { superAdmin: false, isActive: true, membership: null };
    expect(accountSecurityChanges(orphan, orphan, noReissue)).toEqual([]);
  });
});
