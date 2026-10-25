import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

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
      "- name: 本番 D1 のバックアップの暗号化の準備",
      "- name: 本番 D1 のバックアップ取得",
      "- name: 本番 D1 のバックアップを暗号化",
      "- name: 本番 D1 のバックアップを保管",
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

  it("未適用がある時だけバックアップを取得し、暗号化したものだけを短期保管する", () => {
    expect(deployWorkflow).toMatch(
      /- name: 本番 D1 のバックアップ取得[\s\S]*?if: steps\.migration_plan\.outputs\.status == 'pending'[\s\S]*?db:backup/,
    );
    expect(deployWorkflow).toMatch(
      /- name: 本番 D1 のバックアップを保管[\s\S]*?path: backup\.sql\.age\n[\s\S]*?if-no-files-found: error[\s\S]*?retention-days: 14/,
    );
    expect(migrateWorkflow).toMatch(
      /- name: バックアップを保管[\s\S]*?path: backup\.sql\.age\n[\s\S]*?if-no-files-found: error[\s\S]*?retention-days: 14/,
    );
  });

  // Public のリポジトリでは、Artifact はログインした誰もが落とせる（DD-031）。
  for (const [label, workflow, prefix] of [
    ["Deploy", deployWorkflow, "本番 D1 の"],
    ["Migrate", migrateWorkflow, ""],
  ]) {
    it(`${label}: 受け手を書き出しの前に確かめ、暗号化してから保管し、平文を上げない`, () => {
      const order = [
        `- name: ${prefix}バックアップの暗号化の準備`,
        `- name: ${prefix}バックアップ取得`,
        `- name: ${prefix}バックアップを暗号化`,
        `- name: ${prefix}バックアップを保管`,
      ].map((marker) => positionOf(workflow, marker));
      expect(order).toEqual([...order].sort((a, b) => a - b));

      expect(workflow).toContain("bash .github/scripts/encrypt-d1-backup.sh check");
      expect(workflow).toContain("bash .github/scripts/encrypt-d1-backup.sh encrypt");
      expect(workflow).toContain(
        "D1_BACKUP_AGE_RECIPIENT: ${{ vars.D1_BACKUP_AGE_RECIPIENT }}",
      );
      // 平文を指す path は1つも無い（backup.sql.age だけ）。
      expect(workflow).not.toMatch(/path:\s*backup\.sql\s*$/m);
      // 開く鍵は CI に渡さない。
      expect(workflow).not.toMatch(/AGE_(?:SECRET|IDENTITY|PRIVATE)/);
    });
  }

  it("自動Deployと手動の復旧用Migrateを同時実行しない", () => {
    expect(concurrencyGroup(deployWorkflow)).toBe(concurrencyGroup(migrateWorkflow));
  });

  it("CIでは手動Migrateを促さない", () => {
    expect(ciWorkflow).not.toContain("新規マイグレーションの検知");
    expect(ciWorkflow).not.toContain("Migrate ワークフローを手動実行");
  });
});

describe("書き出しの暗号化の台本（.github/scripts/encrypt-d1-backup.sh）", () => {
  const script = join(process.cwd(), ".github/scripts/encrypt-d1-backup.sh");
  // 形だけ正しい公開鍵（bech32 の字だけで 58 文字）。鍵としては使わない。
  const recipient = `age1${"q".repeat(58)}`;
  const dirs = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  /**
   * 作業用の場所で台本を流す。`age` は偽物を PATH の先頭に置く。
   * 偽物は -o の先へ `header` を1行目に書き、入力をそのまま続ける。
   */
  function run(mode, { recipients, header = "age-encryption.org/v1", plain = "secret rows\n" } = {}) {
    const dir = mkdtempSync(join(tmpdir(), "d1-backup-"));
    dirs.push(dir);
    const bin = join(dir, "bin");
    const fakeAge = join(bin, "age");
    spawnSync("mkdir", [bin]);
    writeFileSync(
      fakeAge,
      [
        "#!/usr/bin/env bash",
        'out=""; while [ $# -gt 0 ]; do case "$1" in -o) out="$2"; shift 2;; -r) shift 2;; *) in="$1"; shift;; esac; done',
        `{ echo ${JSON.stringify(header)}; cat "$in"; } > "$out"`,
      ].join("\n"),
    );
    chmodSync(fakeAge, 0o755);
    if (plain !== null) writeFileSync(join(dir, "backup.sql"), plain);
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` };
    if (recipients === undefined) delete env.D1_BACKUP_AGE_RECIPIENT;
    else env.D1_BACKUP_AGE_RECIPIENT = recipients;
    const result = spawnSync("bash", [script, mode], { cwd: dir, env, encoding: "utf8" });
    return {
      status: result.status,
      output: `${result.stdout}${result.stderr}`,
      plainExists: existsSync(join(dir, "backup.sql")),
      sealedExists: existsSync(join(dir, "backup.sql.age")),
    };
  }

  it("受け手が無い・空白だけ・形が違うときは止める", () => {
    for (const recipients of [undefined, "", "  \n ", "age1short", "AGE-SECRET-KEY-1ABC", `${recipient} *`]) {
      const result = run("check", { recipients });
      expect(result.status, String(recipients)).toBe(1);
      expect(result.output).toContain("::error::");
    }
  });

  it("形の違う値を表示しない（秘密鍵を貼り間違えたときに漏らさない）", () => {
    const result = run("check", { recipients: "AGE-SECRET-KEY-1QQQQ" });
    expect(result.output).not.toContain("AGE-SECRET-KEY-1QQQQ");
  });

  it("空白か改行で区切った複数の受け手を受け付ける", () => {
    const result = run("check", { recipients: `${recipient}\n${recipient} ${recipient}` });
    expect(result.status).toBe(0);
    expect(result.output).toContain("3 本");
  });

  it("暗号化できたら平文を消し、暗号化したものだけを残す", () => {
    const result = run("encrypt", { recipients: recipient });
    expect(result.status, result.output).toBe(0);
    expect(result.plainExists).toBe(false);
    expect(result.sealedExists).toBe(true);
  });

  it("出力が age の形式でなければ、出力を消して止める（平文を保管に回さない）", () => {
    const result = run("encrypt", { recipients: recipient, header: "secret rows" });
    expect(result.status).toBe(1);
    expect(result.sealedExists).toBe(false);
  });

  it("受け手が無ければ暗号化もせず止める", () => {
    const result = run("encrypt", { recipients: "" });
    expect(result.status).toBe(1);
    expect(result.sealedExists).toBe(false);
  });

  it("書き出しが無いか空なら止める", () => {
    expect(run("encrypt", { recipients: recipient, plain: null }).status).toBe(1);
    expect(run("encrypt", { recipients: recipient, plain: "" }).status).toBe(1);
  });
});
