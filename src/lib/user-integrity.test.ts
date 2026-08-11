import { describe, expect, it } from "vitest";
import { assertNoManagerCycle } from "@/lib/user-integrity";

const lookupFrom = (parents: Record<string, string | null>) => async (userId: string) => parents[userId] ?? null;

describe("上長関係の循環", () => {
  it("循環しない上長チェーンを許可する", async () => {
    await expect(
      assertNoManagerCycle("employee", "manager", lookupFrom({ manager: "admin", admin: null })),
    ).resolves.toBeUndefined();
  });

  it("本人へ戻る間接循環を拒否する", async () => {
    await expect(
      assertNoManagerCycle("employee", "manager", lookupFrom({ manager: "admin", admin: "employee" })),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("接続先に既存の循環があっても停止して拒否する", async () => {
    await expect(
      assertNoManagerCycle("employee", "manager-a", lookupFrom({ "manager-a": "manager-b", "manager-b": "manager-a" })),
    ).rejects.toMatchObject({ status: 400 });
  });
});
