import { describe, expect, it } from "vitest";
import { isSelfLocked, selectSelfLocked, selfLockedHeadline, type SelfLockedSource } from "@/lib/domain/self-locked-evaluations";

function source(over: Partial<SelfLockedSource> = {}): SelfLockedSource {
  return {
    evaluationId: "e1",
    cycleId: "c1",
    cycleName: "2025年度 下期",
    employeeId: "u1",
    employeeName: "山田 太郎",
    gradeName: "Manager Ⅰ",
    employeeRole: "COMPANY_ADMIN",
    managerId: null,
    ...over,
  };
}

describe("isSelfLocked", () => {
  it("上長が未設定の会社の管理者は、頼める上長がいない", () => {
    expect(isSelfLocked(source({ employeeRole: "COMPANY_ADMIN", managerId: null }))).toBe(true);
  });

  it("上長が自分自身になっているマネージャーも、頼める上長がいない", () => {
    expect(isSelfLocked(source({ employeeId: "u1", employeeRole: "MANAGER", managerId: "u1" }))).toBe(true);
  });

  it("別の人が上長になっていれば、頼める先があるので対象外", () => {
    expect(isSelfLocked(source({ employeeId: "u1", employeeRole: "MANAGER", managerId: "u2" }))).toBe(false);
  });

  it("EMPLOYEE は自分で確定する権限自体が無いので、上長が未設定でも対象外", () => {
    expect(isSelfLocked(source({ employeeRole: "EMPLOYEE", managerId: null }))).toBe(false);
  });

  it("SUPER_ADMIN は通常の評価対象ではないため対象外", () => {
    expect(isSelfLocked(source({ employeeRole: "SUPER_ADMIN", managerId: null }))).toBe(false);
  });
});

describe("selectSelfLocked", () => {
  it("対象になる行だけを残し、順序は保つ", () => {
    const rows = [
      source({ evaluationId: "e1", employeeId: "u1", managerId: null }),
      source({ evaluationId: "e2", employeeId: "u2", employeeRole: "MANAGER", managerId: "u3" }),
      source({ evaluationId: "e3", employeeId: "u4", employeeRole: "MANAGER", managerId: "u4" }),
    ];
    expect(selectSelfLocked(rows).map((r) => r.evaluationId)).toEqual(["e1", "e3"]);
  });

  it("該当なしなら空配列", () => {
    const rows = [source({ employeeRole: "MANAGER", managerId: "u9" })];
    expect(selectSelfLocked(rows)).toEqual([]);
  });
});

describe("selfLockedHeadline", () => {
  it("0件は空文字", () => {
    expect(selfLockedHeadline(0)).toBe("");
  });

  it("件数を含む見出しを返す", () => {
    expect(selfLockedHeadline(3)).toBe("本人が確定できず、確定を頼まれている評価が3件あります");
  });
});
