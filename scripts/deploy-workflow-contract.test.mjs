import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(join(process.cwd(), path), "utf8");
const deployWorkflow = read(".github/workflows/deploy.yml");
const migrateWorkflow = read(".github/workflows/migrate.yml");
const ciWorkflow = read(".github/workflows/ci.yml");

function positionOf(workflow, marker) {
  expect(workflow).toContain(marker);
  return workflow.indexOf(marker);
}

function concurrencyGroup(workflow) {
  const match = workflow.match(/^\s*group:\s*([^\s#]+)\s*$/m);
  expect(match).not.toBeNull();
  return match?.[1];
}

describe("本番の自動マイグレーション契約", () => {
  it("検査とビルドの後に、バックアップ・適用・再確認・デプロイの順で実行する", () => {
    const markers = [
      "- name: ビルド",
      "- name: 本番 D1 の未適用マイグレーション確認",
      "- name: 本番 D1 のバックアップ取得",
      "- name: 本番 D1 のマイグレーション適用",
      "- name: 適用後の未適用マイグレーション確認",
      "- name: デプロイ",
    ];
    const positions = markers.map((marker) => positionOf(deployWorkflow, marker));

    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(deployWorkflow).toContain("id: migration_plan");
    expect(deployWorkflow).toContain(
      "if: steps.migration_plan.outputs.status == 'pending'",
    );
    expect(deployWorkflow).toContain(
      "run: ${{ steps.pm.outputs.run }} db:migrate:remote",
    );
  });

  it("未適用がある時だけバックアップを取得し、短期保管する", () => {
    expect(deployWorkflow).toMatch(
      /- name: 本番 D1 のバックアップ取得[\s\S]*?if: steps\.migration_plan\.outputs\.status == 'pending'[\s\S]*?db:backup/,
    );
    expect(deployWorkflow).toMatch(
      /- name: 本番 D1 のバックアップを保管[\s\S]*?if-no-files-found: error[\s\S]*?retention-days: 14/,
    );
    expect(migrateWorkflow).toMatch(
      /- name: バックアップを保管[\s\S]*?if-no-files-found: error[\s\S]*?retention-days: 14/,
    );
  });

  it("自動Deployと手動の復旧用Migrateを同時実行しない", () => {
    expect(concurrencyGroup(deployWorkflow)).toBe(concurrencyGroup(migrateWorkflow));
  });

  it("CIでは手動Migrateを促さない", () => {
    expect(ciWorkflow).not.toContain("新規マイグレーションの検知");
    expect(ciWorkflow).not.toContain("Migrate ワークフローを手動実行");
  });
});
