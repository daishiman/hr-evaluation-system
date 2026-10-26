import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * 監査の台帳と、秘密を替える手順書の契約（DD-032 の1・15・O38）。
 * 台帳は、監査の72行のどれも落とさず、行ごとに「どうしたか」と「何で確かめたか」を持つ。
 * 母数と、重複のまとめ先の正本は受領記録の受領表なので、台帳をそれと突き合わせる。
 * 台帳はリポジトリと一緒に公開されるので、実データと秘密の値が無いことも確かめる。
 */

const root = process.cwd();
const LEDGER = "docs/security/audit-ledger.md";
const RUNBOOK = "docs/security/secret-rotation-runbook.md";
const RECEIPT = "docs/product/spec-receipts/2026-10-22-vulnerability-audit-and-hardening.md";
const read = (path) => readFileSync(join(root, path), "utf8");
const readIfExists = (path) => (existsSync(join(root, path)) ? read(path) : "");

const LEDGER_COLUMNS = ["ID", "深刻度", "目標", "状態", "根拠", "残るリスク", "見直す時期", "確かめた日"];
const TOTAL_ROWS = 72;
const TOTAL_ITEMS = 47;

/** 表の1行をセルに分ける（\| は区切りにしない） */
function cellsOf(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim());
}

/** 見出しの行が header と一致する表の、本文の行（区切りの行の後） */
function tableRows(text, header) {
  const lines = text.split("\n");
  const at = lines.findIndex((l) => l.trim().startsWith("|") && cellsOf(l).join("|") === header.join("|"));
  if (at < 0) return null;
  const rows = [];
  for (const line of lines.slice(at + 2)) {
    if (!line.trim().startsWith("|")) break;
    rows.push(Object.fromEntries(cellsOf(line).map((c, i) => [header[i] ?? `extra${i}`, c])));
  }
  return rows;
}

/** 空の印（— や -）だけのセルは、書いていないものとして扱う */
const isEmptyCell = (cell) => !cell || /^[—\-–ー]+$/.test(cell.trim());

/** 受領表の「まとめ先」の列から、まとめ先の ID を取り出す（— で始まるものは、まとめていない行） */
const mergeTargetOf = (cell) => (cell.trim().startsWith("—") ? null : cell.trim());

const receiptRows = tableRows(read(RECEIPT), ["ID", "深刻度", "目標", "まとめ先"]) ?? [];
const ledgerText = readIfExists(LEDGER);
const ledgerRows = tableRows(ledgerText, LEDGER_COLUMNS);

const STATES = [
  // 直したものは、確かめたテストの名前を括弧に入れる
  { name: "直した", pattern: /^直した（[^）]*\.(test|spec)\.(ts|tsx|mjs)[^）]*）$/ },
  { name: "暫定の防御", pattern: /^暫定の防御(（[^）]+）)?$/ },
  { name: "受け入れた", pattern: /^受け入れた（[^）]+）$/ },
  { name: "範囲の外", pattern: /^範囲の外（[^）]+）$/ },
  { name: "当たらない", pattern: /^当たらない（[^）]+）$/ },
];
const stateOf = (cell) => STATES.find((s) => s.pattern.test(cell))?.name ?? null;

/** 短いテスト名は実在する1つのファイルにだけ結び付ける。完全な path も受ける。 */
function resolveTestReference(reference, files) {
  return files.filter((file) => file === reference || (!reference.includes("/") && file.endsWith(`/${reference}`)));
}

function testFilesIn(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return testFilesIn(path);
    return /\.(?:test|spec)\.(?:ts|tsx|mjs)$/.test(entry.name) ? [path] : [];
  });
}

describe("台帳のテスト名の解決", () => {
  const files = ["src/lib/first.test.ts", "scripts/shared.test.mjs", "src/lib/shared.test.mjs"];

  it("存在しない参照と、短名が重なる参照を区別する", () => {
    expect(resolveTestReference("missing.test.ts", files)).toEqual([]);
    expect(resolveTestReference("first.test.ts", files)).toEqual(["src/lib/first.test.ts"]);
    expect(resolveTestReference("shared.test.mjs", files)).toHaveLength(2);
    expect(resolveTestReference("scripts/shared.test.mjs", files)).toEqual(["scripts/shared.test.mjs"]);
  });
});

describe("受領表（台帳の母数の正本）", () => {
  it("受領表は72行で、まとめた後は47件", () => {
    expect(receiptRows).toHaveLength(TOTAL_ROWS);
    expect(receiptRows.filter((r) => mergeTargetOf(r["まとめ先"]) === null)).toHaveLength(TOTAL_ITEMS);
  });
});

describe("監査の台帳（DD-032 の15）", () => {
  it("台帳があり、8つの列の表を持つ", () => {
    expect(existsSync(join(root, LEDGER)), `${LEDGER} が無い`).toBe(true);
    expect(ledgerRows, "ID・深刻度・目標・状態・根拠・残るリスク・見直す時期・確かめた日 の表が無い").not.toBeNull();
  });

  it("冒頭に母数（72行・47件）を書き、表の行数がそれと一致する", () => {
    const head = ledgerText.split(/^\|/m)[0];
    expect(head).toMatch(/72\s*行/);
    expect(head).toMatch(/47\s*件/);
    expect(ledgerRows ?? []).toHaveLength(TOTAL_ROWS);
  });

  it("台帳の ID・深刻度・目標は、受領表の72行と一致する", () => {
    const byId = new Map((ledgerRows ?? []).map((r) => [r.ID, r]));
    expect(byId.size, "台帳の ID が重なっている").toBe((ledgerRows ?? []).length);
    for (const r of receiptRows) {
      const row = byId.get(r.ID);
      expect(row, `${r.ID} が台帳に無い`).toBeTruthy();
      expect(row?.["深刻度"], `${r.ID} の深刻度`).toBe(r["深刻度"]);
      expect(row?.["目標"], `${r.ID} の目標`).toBe(r["目標"]);
    }
  });

  it("どの行も、決まった5つの状態のどれかと、根拠と、確かめた日を持つ", () => {
    for (const row of ledgerRows ?? []) {
      expect(stateOf(row["状態"]), `${row.ID} の状態「${row["状態"]}」`).not.toBeNull();
      expect(isEmptyCell(row["根拠"]), `${row.ID} の根拠が空`).toBe(false);
      expect(row["確かめた日"], `${row.ID} の確かめた日`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("直した行が挙げる全てのテスト名は、実在する1つのテストに結び付く", () => {
    const files = ["src", "scripts", "e2e"].flatMap(testFilesIn);
    for (const row of ledgerRows ?? []) {
      if (stateOf(row["状態"]) !== "直した") continue;
      const references = row["状態"].slice("直した（".length, -1).split("・");
      for (const reference of references) {
        expect(resolveTestReference(reference, files), `${row.ID} の ${reference} が無いか同名で曖昧`).toHaveLength(1);
      }
    }
  });

  it("受け入れた行と暫定の防御の行は、残るリスクと見直す時期を空にしない", () => {
    for (const row of ledgerRows ?? []) {
      if (!["受け入れた", "暫定の防御"].includes(stateOf(row["状態"]))) continue;
      expect(isEmptyCell(row["残るリスク"]), `${row.ID} の残るリスクが空`).toBe(false);
      expect(isEmptyCell(row["見直す時期"]), `${row.ID} の見直す時期が空`).toBe(false);
    }
  });

  it("まとめた行は、根拠にまとめ先の ID を書き、まとめ先と同じ状態の種類を持つ", () => {
    const byId = new Map((ledgerRows ?? []).map((r) => [r.ID, r]));
    for (const r of receiptRows) {
      const target = mergeTargetOf(r["まとめ先"]);
      if (!target) continue;
      const row = byId.get(r.ID);
      expect(row?.["根拠"] ?? "", `${r.ID} の根拠にまとめ先 ${target} が無い`).toContain(target);
      expect(stateOf(row?.["状態"] ?? ""), `${r.ID} とまとめ先 ${target} の状態`).toBe(stateOf(byId.get(target)?.["状態"] ?? ""));
    }
  });

  it("決定の記録と、利用者の作業と、Node の通知の節を持つ", () => {
    const headings = ledgerText.split("\n").filter((l) => /^#{2,4}\s/.test(l));
    const has = (pattern) => headings.some((h) => pattern.test(h));
    expect(has(/#97/), "#97 で消した表と列を戻さない決定の節が無い").toBe(true);
    expect(has(/\(B\)|（B）/) && has(/\(E\)|（E）/), "観点 (B)・(E) の結果の節が無い").toBe(true);
    expect(has(/利用者の作業/), "利用者の作業の節が無い").toBe(true);
    expect(has(/Node/) && has(/通知/), "Node 本体の通知の節が無い").toBe(true);

    const userWork = ledgerText.split(/^#{2,4}\s.*利用者の作業.*$/m)[1]?.split(/^#{2,4}\s/m)[0] ?? "";
    for (const item of ["environment", "トークン", "画像の変換", "秘密"]) {
      expect(userWork.includes(item), `利用者の作業に「${item}」が無い`).toBe(true);
    }
  });
});

describe("秘密を替える手順書（DD-032 の1）", () => {
  const runbook = readIfExists(RUNBOOK);

  it("手順書がある", () => {
    expect(existsSync(join(root, RUNBOOK)), `${RUNBOOK} が無い`).toBe(true);
  });

  it("署名の鍵を替えた後に、残ったセッションの行をすべて消す手順を持つ", () => {
    expect(runbook).toContain("BETTER_AUTH_SECRET");
    expect(runbook).toMatch(/wrangler d1 execute/);
    expect(runbook).toMatch(/DELETE FROM sessions\s*;?/i);
    // 行を選ぶ条件を付けると、一部のセッションが残る
    expect(runbook).not.toMatch(/DELETE FROM sessions\s+WHERE/i);
  });

  it("控えの鍵の包み直しと、連携の鍵の失効と、パスワードの変更を含む", () => {
    expect(runbook).toContain("CREDENTIAL_ENC_KEY");
    expect(runbook).toMatch(/失効/);
    expect(runbook).toMatch(/パスワード/);
  });

  it("勧告への対応の節に、見る人と時・48時間の期限・Node 本体の受け取り先がある（DD-032 の14）", () => {
    const section = runbook.split(/^## 勧告への対応\s*$/m)[1]?.split(/^## /m)[0] ?? "";
    expect(section, "「## 勧告への対応」の節が無い").not.toBe("");
    expect(section).toContain("security-audit.yml");
    expect(section).toMatch(/48時間/);
    expect(section).toMatch(/台帳/);
    expect(section).toContain("nodejs-sec");
  });
});

describe("公開してよい中身だけを書く（README「本番運用とデータの注意」）", () => {
  const docs = [
    [LEDGER, ledgerText],
    [RUNBOOK, readIfExists(RUNBOOK)],
  ];

  /** wrangler.jsonc の vars の値（本番の URL など）。文書に写さない */
  const varValues = (() => {
    const text = read("wrangler.jsonc").replace(/^\s*\/\/.*$/gm, "");
    const block = text.match(/"vars"\s*:\s*\{([^}]*)\}/)?.[1] ?? "";
    return [...block.matchAll(/:\s*"([^"]{8,})"/g)].map((m) => m[1]);
  })();

  it.each(docs)("%s に、メールアドレス・本番の URL・秘密らしい長い値・ソースの行の場所が無い", (path, text) => {
    expect(text.length, `${path} が無いか空`).toBeGreaterThan(0);
    const emails = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [];
    expect(emails.filter((e) => !/@example\.(com|org|net)$/i.test(e)), `${path} のメールアドレス`).toEqual([]);
    expect(/\.workers\.dev\b/.test(text), `${path} に workers.dev の URL`).toBe(false);
    expect(varValues.some((v) => text.includes(v)), `${path} に wrangler.jsonc の vars の値`).toBe(false);
    expect(/\b[0-9a-f]{32,}\b/i.test(text), `${path} に長い16進の値`).toBe(false);
    expect(/[A-Za-z0-9+/]{40,}={0,2}/.test(text), `${path} に長い base64 の値`).toBe(false);
    // 直した場所は、テストの名前で示す。ソースの行の場所は書かない
    expect(/src\/[\w./-]+\.(ts|tsx|mjs):\d+/.test(text), `${path} にソースの行の場所`).toBe(false);
  });
});
