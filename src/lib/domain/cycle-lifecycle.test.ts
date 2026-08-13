import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canTransitionCycleStatus } from "./cycle-lifecycle";

describe("評価期間の状態遷移", () => {
  it.each([
    ["planning", "planning"],
    ["planning", "open"],
    ["open", "open"],
    ["open", "closed"],
    ["closed", "closed"],
    ["closed", "open"],
  ] as const)("%s → %s を許可する", (from, to) => {
    expect(canTransitionCycleStatus(from, to)).toBe(true);
  });

  it.each([
    ["planning", "closed"],
    ["open", "planning"],
    ["closed", "planning"],
  ] as const)("%s → %s の段階飛ばし・巻き戻しを拒否する", (from, to) => {
    expect(canTransitionCycleStatus(from, to)).toBe(false);
  });

  it("未知の状態は fail-closed にする", () => {
    expect(canTransitionCycleStatus("broken", "open")).toBe(false);
    expect(canTransitionCycleStatus("open", "broken")).toBe(false);
  });
});

describe("評価期間APIへの状態契約の配線", () => {
  const route = readFileSync(new URL("../../app/api/cycles/route.ts", import.meta.url), "utf8");

  it("openへ移す前に同じ会社の別のopen期間を拒否する", () => {
    expect(route).toContain("別の評価期間が受付中です");
    expect(route).toContain("ne(s.evaluationCycles.id, cycle.id)");
  });

  it("期間終了と公開中アンケートの終了を1つのbatchで確定する", () => {
    expect(route).toContain("await db.batch([");
    expect(route).toContain(".update(s.evaluationCycles)");
    expect(route).toContain(".update(s.forms)");
  });
});
