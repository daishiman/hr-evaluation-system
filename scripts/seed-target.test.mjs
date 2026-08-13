import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertFullSeedTargetIsLocal,
  REMOTE_FULL_SEED_BLOCK_MESSAGE,
} from "./seed-target.mjs";

const root = process.cwd();

describe("全置換seedの実行先", () => {
  it("--remote は必ず拒否する", () => {
    expect(() => assertFullSeedTargetIsLocal(["--remote"])).toThrow(
      REMOTE_FULL_SEED_BLOCK_MESSAGE,
    );
  });

  it("ローカル実行とSQL生成だけは維持する", () => {
    expect(() => assertFullSeedTargetIsLocal(["--local"])).not.toThrow();
    expect(() => assertFullSeedTargetIsLocal(["--local", "--generate-only"])).not.toThrow();
  });

  it("remote guardをseed組み立て・ファイル書込み・wrangler実行より先に通す", () => {
    const source = readFileSync(join(root, "scripts/seed.mjs"), "utf8");
    const guard = source.indexOf("assertFullSeedTargetIsLocal(process.argv.slice(2))");
    const dangerousSteps = [
      source.indexOf('await import("./seed-data.mjs")'),
      source.indexOf("await buildSeed()"),
      source.indexOf("writeFileSync(out"),
      source.indexOf('execFileSync("pnpm"'),
    ];

    expect(guard).toBeGreaterThan(-1);
    expect(dangerousSteps.every((position) => position > guard)).toBe(true);
  });

  it("package scriptsからremote全置換の入口を公開しない", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(pkg.scripts).not.toHaveProperty("db:seed:remote");
    expect(pkg.scripts["db:seed:local"]).toBe("node scripts/seed.mjs --local");
  });

  it.each([
    { args: ["--remote"] },
    { args: ["--remote", "--generate-only"] },
  ])(
    "実プロセスでも $args を書込み前に拒否する",
    ({ args }) => {
      const seedSqlPath = join(root, "drizzle/seed.sql");
      const before = readFileSync(seedSqlPath, "utf8");
      const result = spawnSync(process.execPath, [join(root, "scripts/seed.mjs"), ...args], {
        cwd: root,
        encoding: "utf8",
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(REMOTE_FULL_SEED_BLOCK_MESSAGE);
      expect(result.stdout).not.toContain("投入件数:");
      expect(result.stdout).not.toContain("SQL: drizzle/seed.sql");
      expect(result.stdout).not.toContain("デモ用パスワード:");
      expect(result.stdout).not.toContain("実行: pnpm");
      expect(readFileSync(seedSqlPath, "utf8")).toBe(before);
    },
  );
});
