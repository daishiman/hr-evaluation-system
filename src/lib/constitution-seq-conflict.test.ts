import { describe, expect, it } from "vitest";
import { isConstitutionSeqConflict } from "@/lib/domain/constitution-events";

describe("監査番号の競合判定", () => {
  it("D1の文字列の失敗と、Drizzleが包んだSQLiteの失敗を判別する", () => {
    expect(isConstitutionSeqConflict("D1_ERROR: UNIQUE constraint failed: uq_ce_entity_seq")).toBe(true);
    expect(isConstitutionSeqConflict(new Error("Failed query", {
      cause: new Error("UNIQUE constraint failed: constitution_events.entity_id, constitution_events.seq"),
    }))).toBe(true);
    expect(isConstitutionSeqConflict(new Error("Failed query", {
      cause: "UNIQUE constraint failed: constitution_events.entity_id, constitution_events.seq",
    }))).toBe(true);
  });

  it.each([
    "UNIQUE constraint failed: users.email",
    "UNIQUE constraint failed: constitution_events.entity_id",
    "UNIQUE constraint failed: constitution_events.seq",
    "network error: constitution_events.entity_id, constitution_events.seq",
  ])("別の失敗を競合409として扱わない: %s", (message) => {
    expect(isConstitutionSeqConflict(new Error(message))).toBe(false);
  });

  it("原因がない失敗や循環する原因チェーンでも終了する", () => {
    expect(isConstitutionSeqConflict(undefined)).toBe(false);
    expect(isConstitutionSeqConflict(null)).toBe(false);
    const cyclic = new Error("network failure");
    cyclic.cause = cyclic;
    expect(isConstitutionSeqConflict(cyclic)).toBe(false);
  });
});
