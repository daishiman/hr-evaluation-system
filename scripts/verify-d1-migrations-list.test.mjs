import { describe, expect, it } from "vitest";

import { classifyMigrationListOutput } from "./verify-d1-migrations-list.mjs";

describe("Wrangler の D1 migrations list 出力検査", () => {
  it("装飾や色があっても未適用 0 件を判定する", () => {
    const output = "\u001b[32m✅ No   migrations to apply!\u001b[0m\r\n";

    expect(classifyMigrationListOutput(output)).toEqual({
      status: "clear",
      migrationNames: [],
      contradictory: false,
    });
  });

  it("表の書式に依存せず未適用ありを判定する", () => {
    const output = [
      "Migrations to be applied:",
      "┌──────────────────────────────────┐",
      "│ Name                             │",
      "├──────────────────────────────────┤",
      "│ 0014_constitution_events.sql     │",
      "└──────────────────────────────────┘",
    ].join("\n");

    expect(classifyMigrationListOutput(output)).toEqual({
      status: "pending",
      migrationNames: ["0014_constitution_events.sql"],
      contradictory: false,
    });
  });

  it("未適用 0 件とファイル名が同時に出たら安全側で停止する", () => {
    const output = "✅ No migrations to apply!\n0015_example.sql\n";

    expect(classifyMigrationListOutput(output)).toEqual({
      status: "pending",
      migrationNames: ["0015_example.sql"],
      contradictory: true,
    });
  });

  it.each(["", "Wrangler completed successfully.\n", "No migrations were found.\n"])(
    "未適用 0 件を証明できない出力は unknown にする: %j",
    (output) => {
      expect(classifyMigrationListOutput(output).status).toBe("unknown");
    },
  );
});
