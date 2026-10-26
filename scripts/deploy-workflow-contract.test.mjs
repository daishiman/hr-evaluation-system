import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(join(process.cwd(), path), "utf8");
const WORKFLOW_DIR = ".github/workflows";
const workflowNames = readdirSync(join(process.cwd(), WORKFLOW_DIR)).filter((f) => /\.ya?ml$/.test(f));
const workflows = Object.fromEntries(workflowNames.map((f) => [f, read(`${WORKFLOW_DIR}/${f}`)]));
const deployWorkflow = workflows["deploy.yml"];
const migrateWorkflow = workflows["migrate.yml"];
const ciWorkflow = workflows["ci.yml"];
const packageScripts = JSON.parse(read("package.json")).scripts ?? {};

/*
 * ワークフローの YAML は、行の字下げで job と step に切り分けて読む（YAML の部品は入れていない）。
 * このリポジトリのワークフローは、どれも2字下げのブロック形式で書く。流れる形（{ } や [ ]）で
 * steps を書くと、ここで step が0件になり、下の契約が落ちて気づける。
 */

const indentOf = (line) => line.match(/^ */)[0].length;
const isBlank = (line) => line.trim() === "";
const isComment = (line) => /^\s*#/.test(line);
const unquote = (value) => value?.replace(/^(["'])(.*)\1$/, "$2");

/** jobs: の下の、指定した job の本文（次の job か、最上位のキーの手前まで）。無ければ null */
function jobBlock(workflow, id) {
  const lines = workflow.split("\n");
  const jobsAt = lines.findIndex((l) => /^jobs:\s*(#.*)?$/.test(l));
  if (jobsAt < 0) return null;
  const head = new RegExp(`^  ${id}:\\s*(#.*)?$`);
  const start = lines.findIndex((l, i) => i > jobsAt && head.test(l));
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (!isComment(lines[i]) && /^ {0,2}\S/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

/** jobs: の下に並ぶ job の id */
function jobIds(workflow) {
  const lines = workflow.split("\n");
  const jobsAt = lines.findIndex((l) => /^jobs:\s*(#.*)?$/.test(l));
  if (jobsAt < 0) return [];
  const ids = [];
  for (const line of lines.slice(jobsAt + 1)) {
    if (!isComment(line) && /^\S/.test(line)) break;
    const m = line.match(/^  ([A-Za-z0-9_-]+):\s*(#.*)?$/);
    if (m) ids.push(m[1]);
  }
  return ids;
}

/** run: の本文。1行の形と、| や > の後の、より深い字下げの行の両方を集める */
function runBodyOf(lines, contentIndent) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)run:\s*(.*)$/);
    if (!m || m[1].length !== contentIndent) continue;
    const rest = m[2].trim();
    if (/^[|>][-+]?\s*(#.*)?$/.test(rest)) {
      for (let j = i + 1; j < lines.length; j++) {
        if (isBlank(lines[j])) continue;
        if (indentOf(lines[j]) <= contentIndent) break;
        out.push(lines[j].trim());
      }
    } else {
      out.push(rest);
    }
  }
  return out.join("\n");
}

/** job の本文の steps を、step ごとに読む。注釈の行は落とす */
function stepsOf(block) {
  if (!block) return [];
  const lines = block.split("\n");
  const at = lines.findIndex((l) => /^\s*steps:\s*(#.*)?$/.test(l));
  if (at < 0) return [];
  const chunks = [];
  let dashIndent = null;
  for (let i = at + 1; i < lines.length; i++) {
    const line = lines[i];
    if (isBlank(line) || isComment(line)) continue;
    const ind = indentOf(line);
    const isDash = /^\s*- /.test(line);
    if (dashIndent === null) {
      if (!isDash) break;
      dashIndent = ind;
    }
    if (ind < dashIndent || (ind === dashIndent && !isDash)) break;
    if (ind === dashIndent && isDash) chunks.push([]);
    chunks.at(-1).push(line);
  }
  return chunks.map((raw) => {
    const contentIndent = dashIndent + 2;
    const lines = raw.map((l, i) => (i === 0 ? l.replace(/^(\s*)- /, "$1  ") : l));
    const fields = {};
    for (const l of lines) {
      if (indentOf(l) !== contentIndent) continue;
      const m = l.match(/^\s*([A-Za-z0-9_-]+):\s*(.*)$/);
      if (m && !(m[1] in fields)) fields[m[1]] = m[2].replace(/\s+#.*$/, "").trim();
    }
    return {
      text: lines.join("\n"),
      name: unquote(fields.name),
      id: fields.id,
      uses: fields.uses,
      if: fields.if,
      run: runBodyOf(lines, contentIndent),
    };
  });
}

/** 条件に合う最初の step の位置。無ければ、どの step かを名前で示して落とす */
function indexOfStep(steps, label, predicate) {
  const index = steps.findIndex(predicate);
  expect(index, `${label} の step が無い`).toBeGreaterThanOrEqual(0);
  return index;
}

/** run が呼ぶ package.json の script を、その中身に開いた文 */
function expandScripts(run) {
  const used = Object.entries(packageScripts).filter(([name]) =>
    new RegExp(`(^|\\s)${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`, "m").test(run),
  );
  return [run, ...used.map(([, body]) => body)].join("\n");
}

/** 最上位のキーの本文（次の最上位のキーの手前まで） */
function topLevelBlock(workflow, key) {
  const lines = workflow.split("\n");
  const start = lines.findIndex((l) => new RegExp(`^${key}:\\s*(#.*)?$`).test(l));
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && !isComment(l) && /^\S/.test(l));
  return lines.slice(start, end < 0 ? lines.length : end).join("\n");
}

/** job の本文の permissions: の中身 */
function jobPermissions(block) {
  const lines = block?.split("\n") ?? [];
  const at = lines.findIndex((l) => /^    permissions:\s*(#.*)?$/.test(l));
  if (at < 0) return "";
  const end = lines.findIndex((l, i) => i > at && !isBlank(l) && !isComment(l) && indentOf(l) <= 4);
  return lines.slice(at + 1, end < 0 ? lines.length : end).join("\n");
}

const deployJob = jobBlock(deployWorkflow, "deploy");
const verifyBuildJob = jobBlock(deployWorkflow, "verify-build");
const migrateJob = jobBlock(migrateWorkflow, "migrate");
const deploySteps = stepsOf(deployJob);
const verifyBuildSteps = stepsOf(verifyBuildJob);
const migrateSteps = stepsOf(migrateJob);

/** 秘密の要る job（Cloudflare に触る2つ） */
const SECRET_JOBS = [
  ["deploy.yml の deploy", deploySteps],
  ["migrate.yml の migrate", migrateSteps],
];

const isDownload = (s) => s.uses?.startsWith("actions/download-artifact@");
const isArtifactDelete = (s) =>
  (/DELETE/.test(s.text) && /actions\/artifacts\//.test(s.text)) || /deleteArtifact/.test(s.text);
const isTimeTravel = (s) => /\bd1 time-travel info\b/.test(s.run);
const isApply = (s) => /db:migrate:remote|d1 migrations apply/.test(expandScripts(s.run));

describe("本番の自動マイグレーション契約", () => {
  it("秘密のある deploy と migrate だけを production 環境の承認に結び付ける", () => {
    for (const [label, block] of [["deploy", deployJob], ["migrate", migrateJob]]) {
      expect(block, `${label} の production 環境が無い`).toMatch(/^    environment:\s*production\s*$/m);
    }
    expect(verifyBuildJob).not.toMatch(/^    environment:/m);
  });

  it("deploy の job は、成果物の取り込み・削除・未適用の確認・戻り先の記録・適用・再確認・公開・スモークテストの順に流す", () => {
    const order = [
      indexOfStep(deploySteps, "成果物の取り込み", isDownload),
      indexOfStep(deploySteps, "成果物の削除", isArtifactDelete),
      indexOfStep(deploySteps, "本番 D1 の未適用マイグレーション確認", (s) => s.id === "migration_plan"),
      indexOfStep(deploySteps, "Time Travel の記録", isTimeTravel),
      indexOfStep(deploySteps, "本番 D1 のマイグレーション適用", isApply),
      indexOfStep(deploySteps, "適用後の未適用マイグレーション確認", (s) => s.name === "適用後の未適用マイグレーション確認"),
      indexOfStep(deploySteps, "デプロイ", (s) => /opennextjs-cloudflare deploy/.test(expandScripts(s.run))),
      indexOfStep(deploySteps, "スモークテスト", (s) => /smoke\.sh/.test(s.run)),
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));

    const plan = deploySteps.find((s) => s.id === "migration_plan");
    expect(plan.name).toBe("本番 D1 の未適用マイグレーション確認");
    expect(deploySteps.find(isApply).if).toBe("steps.migration_plan.outputs.status == 'pending'");
  });

  it("ビルドは秘密の無い verify-build の job で行い、deploy の job では行わない", () => {
    expect(verifyBuildJob, "deploy.yml に verify-build の job が無い").not.toBeNull();
    expect(deployJob, "deploy.yml に deploy の job が無い").not.toBeNull();
    expect(deployJob).toMatch(/^    needs:\s*\[?\s*verify-build\s*\]?\s*$/m);

    expect(verifyBuildSteps.some((s) => /\bcf:dry-run\b/.test(s.run))).toBe(true);
    expect(verifyBuildSteps.some((s) => /\bcheck:security\b/.test(s.run))).toBe(true);
    for (const [label, steps] of SECRET_JOBS) {
      for (const script of ["test:coverage", "cf:dry-run", "typecheck", "cf-typegen", "check:docs", "opennextjs-cloudflare build"]) {
        expect(steps.some((s) => s.run.includes(script)), `${label} で ${script} を流している`).toBe(false);
      }
    }
  });

  it("DB の書き出しを Actions の成果物に上げない（両方のワークフロー）", () => {
    for (const [label, workflow] of [["deploy.yml", deployWorkflow], ["migrate.yml", migrateWorkflow]]) {
      for (const id of jobIds(workflow)) {
        for (const step of stepsOf(jobBlock(workflow, id))) {
          const isUpload = Boolean(step.uses?.startsWith("actions/upload-artifact@"));
          expect(/\bd1 export\b|\bdb:backup\b/.test(step.run), `${label} の ${id} に DB の書き出しがある`).toBe(false);
          expect(isUpload && /\.sql\b/.test(step.text), `${label} の ${id} で .sql を上げている`).toBe(false);
        }
      }
      expect(workflow.includes("backup.sql"), `${label} に backup.sql が残っている`).toBe(false);
      expect(/retention-days:\s*14\b/.test(workflow), `${label} に保管14日が残っている`).toBe(false);
    }
    // 手元から流す書き出しの口も残さない（戻り先は Time Travel の bookmark）
    expect(Object.keys(packageScripts)).not.toContain("db:backup");
    for (const [name, command] of Object.entries(packageScripts)) {
      expect(/\bd1 export\b/.test(command), `package.json の ${name} に DB の書き出しがある`).toBe(false);
    }
    // 書き出しを消した後に、事実と違うことになる注釈
    expect(migrateWorkflow.includes("バックアップ取得後に自動適用")).toBe(false);
    expect(migrateWorkflow.includes("実行前に必ずバックアップを取る")).toBe(false);
  });

  it("deploy と migrate は、migration を当てる前に Time Travel の時刻と bookmark を step summary に書く", () => {
    for (const [label, steps] of SECRET_JOBS) {
      const record = indexOfStep(steps, `${label} の Time Travel の記録`, isTimeTravel);
      const apply = indexOfStep(steps, `${label} の適用`, isApply);
      expect(record, `${label} で記録が適用の後にある`).toBeLessThan(apply);
      expect(steps[record].run).toContain("GITHUB_STEP_SUMMARY");
    }
  });

  it("自動Deployと手動の復旧用Migrateを同時実行しない", () => {
    const group = (workflow) => workflow.match(/^\s*group:\s*([^\s#]+)\s*$/m)?.[1];
    expect(group(deployWorkflow)).toBeTruthy();
    expect(group(deployWorkflow)).toBe(group(migrateWorkflow));
  });

  it("CIでは手動Migrateを促さない", () => {
    expect(ciWorkflow).not.toContain("新規マイグレーションの検知");
    expect(ciWorkflow).not.toContain("Migrate ワークフローを手動実行");
  });
});

describe("成果物の受け渡し（DD-032 の13）", () => {
  const upload = () => verifyBuildSteps.find((s) => s.uses?.startsWith("actions/upload-artifact@"));

  it("verify-build は .open-next を1日だけ保管で上げ、.map を除く", () => {
    const step = upload();
    expect(step, "verify-build に成果物の upload が無い").toBeTruthy();
    expect(step.text).toMatch(/^\s*\.open-next\/?\s*$/m);
    expect(step.text).toMatch(/^\s*!\S*\*\.map\s*$/m);
    expect(step.text).toMatch(/retention-days:\s*1\s*$/m);
    expect(step.text).toMatch(/if-no-files-found:\s*error\s*$/m);
    // .open-next は名前が . で始まるので、指定しないと中身が1つも上がらない
    expect(step.text).toMatch(/include-hidden-files:\s*true\s*$/m);
  });

  it("上げる前に、静的検査と .open-next の dir の検査を通す", () => {
    const at = verifyBuildSteps.indexOf(upload());
    const scan = indexOfStep(verifyBuildSteps, "成果物の検査", (s) =>
      /check-security-patterns\.mjs/.test(s.run) && /--dir\b/.test(s.run) && /\.open-next/.test(s.run),
    );
    const patterns = indexOfStep(verifyBuildSteps, "check:security", (s) => /\bcheck:security\b/.test(s.run));
    const build = indexOfStep(verifyBuildSteps, "ビルド", (s) => /\bcf:dry-run\b/.test(s.run));
    expect(build).toBeLessThan(scan);
    expect(scan).toBeLessThan(at);
    expect(patterns).toBeLessThan(at);
  });

  it("成果物の id は upload の出力から job の outputs で渡し、deploy は取り込んだらすぐ消す", () => {
    const step = upload();
    expect(step.id, "upload に id が無い").toBeTruthy();
    expect(verifyBuildJob).toMatch(new RegExp(`^    outputs:[\\s\\S]*steps\\.${step.id}\\.outputs\\.artifact-id`, "m"));

    const download = indexOfStep(deploySteps, "成果物の取り込み", isDownload);
    const remove = indexOfStep(deploySteps, "成果物の削除", isArtifactDelete);
    expect(remove).toBe(download + 1);
    expect(deploySteps[remove].text).toContain("needs.verify-build.outputs.");
  });

  it("書き込みの権限は、成果物を消す deploy の job の actions: write だけ", () => {
    const deployPermissions = jobPermissions(deployJob);
    expect(deployPermissions).toMatch(/^\s+actions:\s*write\s*$/m);
    expect(deployPermissions).toMatch(/^\s+contents:\s*read\s*$/m);
    expect(jobPermissions(verifyBuildJob)).not.toMatch(/:\s*write\b/);

    for (const [name, workflow] of Object.entries(workflows)) {
      const top = topLevelBlock(workflow, "permissions");
      expect(top, `${name} に最上位の permissions が無い`).not.toBeNull();
      expect(top, `${name} の最上位が contents: read でない`).toMatch(/^\s+contents:\s*read\s*$/m);
      const writes = workflow.split("\n").filter((l) => !isComment(l) && /^\s+[a-z-]+:\s*write\s*(#.*)?$/.test(l));
      expect(writes, name).toEqual(name === "deploy.yml" ? [expect.stringMatching(/^\s+actions:\s*write/)] : []);
    }
  });
});

describe("秘密のある job で依存のコードを走らせない（DD-032 の13）", () => {
  it("deploy と migrate の install は、どれも --ignore-scripts を付ける", () => {
    for (const [label, steps] of SECRET_JOBS) {
      const installs = steps.filter((s) => /\b(pnpm|npm|yarn)\s+(install|ci)\b|\bsteps\.pm\.outputs\.install\b/.test(s.run));
      expect(installs.length, `${label} に install が無い`).toBeGreaterThan(0);
      for (const s of installs) {
        expect(s.run, `${label} の install`).toMatch(/\b(pnpm|npm|yarn)\s+(install|ci)\b[^\n]*--ignore-scripts/);
      }
    }
  });

  // 依存の cache は、秘密の無い job（verify-build・CI）が依存のコードを動かした後に保存する。
  // 秘密のある job がそれを戻すと、前の job で走ったコードが install の結果に手を出せる
  it("deploy と migrate は、依存の cache を戻さない", () => {
    for (const [label, steps] of SECRET_JOBS) {
      for (const s of steps) {
        expect(/^\s*cache(-dependency-path)?:/m.test(s.text), `${label} の「${s.name ?? s.uses}」に cache`).toBe(false);
        expect(s.uses?.startsWith("actions/cache") ?? false, `${label} の「${s.name ?? s.uses}」`).toBe(false);
      }
    }
  });

  it("verify-build は秘密を1つも持たない", () => {
    expect(verifyBuildJob).not.toBeNull();
    expect(verifyBuildJob.includes("secrets.")).toBe(false);
  });

  it("秘密は、wrangler か OpenNext を動かす step の env にだけ現れる", () => {
    for (const [name, workflow] of Object.entries(workflows)) {
      const lines = workflow.split("\n");
      lines.forEach((line, i) => {
        if (isComment(line) || !line.includes("secrets.")) return;
        const parentOf = (at) => {
          for (let j = at - 1; j >= 0; j--) {
            if (!isBlank(lines[j]) && !isComment(lines[j]) && indentOf(lines[j]) < indentOf(lines[at])) return j;
          }
          return -1;
        };
        const env = parentOf(i);
        expect(lines[env]?.trim(), `${name}:${i + 1} の秘密が env の下に無い`).toBe("env:");
        const step = parentOf(env);
        expect(lines[step] ?? "", `${name}:${i + 1} の env が step のものでない`).toMatch(/^\s*- /);
      });
    }
    for (const [label, steps] of SECRET_JOBS) {
      for (const s of steps.filter((st) => st.text.includes("secrets."))) {
        expect(expandScripts(s.run), `${label} の「${s.name ?? s.id}」`).toMatch(/\bwrangler\b|opennextjs-cloudflare/);
      }
    }
  });

  it("deploy と migrate の run は、echo・set -x・printenv を使わない", () => {
    for (const [label, steps] of SECRET_JOBS) {
      for (const s of steps) {
        expect(/\becho\b/.test(s.run), `${label} の「${s.name ?? s.id}」に echo`).toBe(false);
        expect(/\bset\s+-[a-z]*x/.test(s.run), `${label} の「${s.name ?? s.id}」に set -x`).toBe(false);
        expect(/\bprintenv\b/.test(s.run), `${label} の「${s.name ?? s.id}」に printenv`).toBe(false);
      }
    }
  });
});

describe("依存の脆弱性の定期検査（DD-032 の13・D-011）", () => {
  const path = `${WORKFLOW_DIR}/security-audit.yml`;

  it("security-audit.yml が、push・PR・定期実行で本番用と開発用の両方の audit を流す", () => {
    expect(existsSync(join(process.cwd(), path)), `${path} が無い`).toBe(true);
    const workflow = read(path);
    const on = topLevelBlock(workflow, "on");
    expect(on).toMatch(/^\s+push:/m);
    expect(on).toMatch(/^\s+pull_request:/m);
    expect(on).toMatch(/^\s+schedule:/m);
    const runs = jobIds(workflow).flatMap((id) => stepsOf(jobBlock(workflow, id))).map((s) => s.run);
    // 本番の依存だけの検査と、開発用を含む全体の検査（--prod の無いほう）を別々に流す
    expect(runs.some((r) => /pnpm audit --prod --audit-level[ =]high\b/.test(r))).toBe(true);
    expect(runs.some((r) => /pnpm audit --audit-level[ =]high\b/.test(r))).toBe(true);
    expect(workflow.includes("secrets.")).toBe(false);
  });
});
