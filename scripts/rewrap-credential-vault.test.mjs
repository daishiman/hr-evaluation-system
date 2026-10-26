import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDatabase } from "../src/test-support/sqlite-d1";
import { fingerprintOf, importVaultKey, LEGACY_CREDENTIAL_READ_UNTIL, openMemo, sealMemo } from "../src/lib/security/keys.ts";
import { buildUpdateSql, main, parseArgs, parseKeys, planRewrap } from "./rewrap-credential-vault.mjs";

/*
 * 控えの包み直し（DD-032 の1）。鍵を替えるとき、古い鍵で包んだ控えを新しい鍵で包み直す。
 * wrangler の呼び出しは、本番と同じ migration を流した手元の SQLite に差し替えて、
 * 読む → 包み直す → 書く → もう一度読む を通しで確かめる。
 */

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

const NOW = new Date("2026-10-25T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const LIVE = NOW.getTime() - DAY;
const EXPIRED = NOW.getTime() - 14 * DAY;

const encoder = new TextEncoder();
const toBase64 = (bytes) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const newKey = () => toBase64(crypto.getRandomValues(new Uint8Array(32)));

/** HKDF を入れる前の古い形式（生の鍵で包み、版は生の鍵の指紋）。アプリはもう作らないので試験の中で作る */
async function legacySeal(base64, userId, password) {
  const raw = fromBase64(base64);
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(userId) }, key, encoder.encode(password));
  return { ciphertext: toBase64(new Uint8Array(cipher)), iv: toBase64(iv), keyVersion: await fingerprintOf(raw) };
}

const row = (userId, sealed, issuedAt = LIVE) => ({ userId, ...sealed, issuedAt });

describe("引数（DD-032 の1：鍵は引数に置かない）", () => {
  it("--local か --remote のどちらか1つが要り、既定は書かない", () => {
    expect(parseArgs(["--local"])).toEqual({ target: "local", apply: false });
    expect(parseArgs(["--remote", "--dry-run"])).toEqual({ target: "remote", apply: false });
    expect(parseArgs(["--", "--remote", "--apply"])).toEqual({ target: "remote", apply: true });
    expect(() => parseArgs([])).toThrow(/どちらか1つ/);
    expect(() => parseArgs(["--local", "--remote"])).toThrow(/どちらか1つ/);
  });

  it("--apply と --dry-run は一緒に使えない", () => {
    expect(() => parseArgs(["--local", "--apply", "--dry-run"])).toThrow(/一緒に使えません/);
  });

  it("知らない指定は、値を繰り返さずに断る", () => {
    const pasted = newKey();
    for (const argv of [["--local", pasted], ["--local", `--key=${pasted}`], ["--local", "--key", pasted]]) {
      let message = "";
      try {
        parseArgs(argv);
      } catch (e) {
        message = e.message;
      }
      expect(message).toMatch(/知らない指定/);
      expect(message).not.toContain(pasted);
    }
  });

  it("標準入力は、古い鍵と新しい鍵の2行だけを受ける", () => {
    expect(parseKeys("old\nnew\n")).toEqual({ oldKey: "old", newKey: "new" });
    expect(parseKeys(" old \r\n new \r\n\r\n")).toEqual({ oldKey: "old", newKey: "new" });
    expect(() => parseKeys("only-one\n")).toThrow(/2行/);
    expect(() => parseKeys("a\nb\nc\n")).toThrow(/2行/);
  });
});

describe("包み直す控えの分け方", () => {
  let oldBase64;
  let newBase64;
  let oldVault;
  let newVault;
  beforeEach(async () => {
    oldBase64 = newKey();
    newBase64 = newKey();
    oldVault = await importVaultKey(oldBase64);
    newVault = await importVaultKey(newBase64);
  });

  it("古い鍵の控え（h1: の版と古い形式）を包み直すと、新しい鍵で同じパスワードが開ける", async () => {
    const rows = [
      row("usr_h1", await sealMemo(oldVault, "usr_h1", "pass-h1-0001")),
      row("usr_legacy", await legacySeal(oldBase64, "usr_legacy", "pass-legacy-01")),
    ];
    const { counts, updates } = await planRewrap(rows, oldVault, newVault, NOW);
    expect(counts).toEqual({ readable: 2, rewrap: 2, expired: 0, unreadable: 0 });
    for (const [userId, password] of [["usr_h1", "pass-h1-0001"], ["usr_legacy", "pass-legacy-01"]]) {
      const update = updates.find((u) => u.userId === userId);
      expect(update.after.keyVersion).toBe(newVault.version);
      await expect(openMemo(newVault, userId, update.after, NOW)).resolves.toEqual({ ok: true, password });
    }
  });

  it("新しい鍵の版の控えは包み直さないので、包み直した後にもう一度分けると0件になる", async () => {
    const first = await planRewrap([row("usr_a", await sealMemo(oldVault, "usr_a", "pass-a-00001"))], oldVault, newVault, NOW);
    const rewrapped = first.updates.map((u) => row(u.userId, u.after));
    const second = await planRewrap(rewrapped, oldVault, newVault, NOW);
    expect(second.counts).toEqual({ readable: 1, rewrap: 0, expired: 0, unreadable: 0 });
    expect(second.updates).toEqual([]);
  });

  it("期限切れは開かずに飛ばし、どちらの鍵でも開けない控えは読めない件数に数える", async () => {
    const otherVault = await importVaultKey(newKey());
    const rows = [
      row("usr_old", await sealMemo(oldVault, "usr_old", "pass-old-0001"), EXPIRED),
      row("usr_other", await sealMemo(otherVault, "usr_other", "pass-other-01")),
      // 暗号文を別の人の行へ写しても、利用者 ID に結び付けてあるので開けない
      row("usr_moved", await sealMemo(oldVault, "usr_someone", "pass-moved-01")),
    ];
    const { counts, updates } = await planRewrap(rows, oldVault, newVault, NOW);
    expect(counts).toEqual({ readable: 0, rewrap: 0, expired: 1, unreadable: 2 });
    expect(updates).toEqual([]);
  });

  it("新しい鍵で包んだ古い形式も、新しい形式へ移す", async () => {
    const { counts, updates } = await planRewrap([row("usr_n", await legacySeal(newBase64, "usr_n", "pass-n-00001"))], oldVault, newVault, NOW);
    expect(counts).toEqual({ readable: 1, rewrap: 1, expired: 0, unreadable: 0 });
    expect(updates[0].after.keyVersion).toBe(newVault.version);
  });

  it("鍵を替えずに2行とも同じ鍵を渡すと、古い形式だけを移す", async () => {
    const rows = [
      row("usr_legacy", await legacySeal(oldBase64, "usr_legacy", "pass-legacy-01")),
      row("usr_h1", await sealMemo(oldVault, "usr_h1", "pass-h1-0001")),
    ];
    const { counts, updates } = await planRewrap(rows, oldVault, oldVault, NOW);
    expect(counts).toEqual({ readable: 2, rewrap: 1, expired: 0, unreadable: 0 });
    expect(updates.map((u) => u.userId)).toEqual(["usr_legacy"]);
  });

  it("古い形式を読む期限を過ぎたら、古い形式は読めない（アプリと同じ関数を通る）", async () => {
    const after = new Date(LEGACY_CREDENTIAL_READ_UNTIL);
    const rows = [row("usr_legacy", await legacySeal(oldBase64, "usr_legacy", "pass-legacy-01"), after.getTime() - DAY)];
    const { counts } = await planRewrap(rows, oldVault, newVault, after);
    expect(counts).toEqual({ readable: 0, rewrap: 0, expired: 0, unreadable: 1 });
  });
});

describe("書く文と、手元の D1 での通し", () => {
  let t;
  let oldBase64;
  let newBase64;
  let oldVault;
  let newVault;
  let files;

  const memos = () => t.raw.prepare("SELECT * FROM initial_credential_memos ORDER BY user_id").all();
  const insertMemo = (userId, sealed, issuedAt = LIVE, issuedBy = "usr_admin") => {
    t.raw.prepare("INSERT INTO initial_credential_memos (user_id, ciphertext, iv, key_version, issued_by, issued_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(userId, sealed.ciphertext, sealed.iv, sealed.keyVersion, issuedBy, issuedAt);
  };

  /** wrangler の呼び出しを手元の SQLite に差し替える。--file は1つの transaction で流す */
  function backWithSqlite({ failRead = false, failWrite = false } = {}) {
    execFileSync.mockImplementation((_command, args) => {
      if (args.includes("--file")) {
        const file = args[args.indexOf("--file") + 1];
        files.push({ file, mode: statSync(file).mode & 0o777, target: args.find((a) => a === "--local" || a === "--remote") });
        if (failWrite) throw new Error(readFileSync(file, "utf8"));
        t.raw.exec("BEGIN");
        try {
          t.raw.exec(readFileSync(file, "utf8"));
          t.raw.exec("COMMIT");
        } catch (failure) {
          t.raw.exec("ROLLBACK");
          throw failure;
        }
        return Buffer.from("[]");
      }
      if (failRead) throw new Error(JSON.stringify(memos()));
      return JSON.stringify([{ success: true, results: t.raw.prepare(args[args.indexOf("--command") + 1]).all() }]);
    });
  }

  async function run(argv, { input = `${oldBase64}\n${newBase64}\n`, env = {}, isTTY = false } = {}) {
    const out = [];
    const err = [];
    const read = vi.fn(() => input);
    const exit = await main(argv, { env, stdin: { isTTY, read }, now: NOW, log: (m) => out.push(m), error: (m) => err.push(m) });
    return { exit, stdout: out.join("\n"), stderr: err.join("\n"), read };
  }

  beforeEach(async () => {
    t = createTestDatabase();
    t.raw.exec(`INSERT INTO users (id, name, email, created_at, updated_at) VALUES
      ('usr_admin', '管理者', 'admin@example.test', 0, 0),
      ('usr_a', '社員A', 'a@example.test', 0, 0),
      ('usr_b', '社員B', 'b@example.test', 0, 0),
      ('usr_c', '社員C', 'c@example.test', 0, 0)`);
    oldBase64 = newKey();
    newBase64 = newKey();
    oldVault = await importVaultKey(oldBase64);
    newVault = await importVaultKey(newBase64);
    files = [];
  });
  afterEach(() => {
    t.close();
    execFileSync.mockReset();
  });

  it("文字列の ' は重ねてエスケープし、読んだときの版と暗号文のままの行だけを置き換える", () => {
    const [sql] = buildUpdateSql([{
      userId: "usr_'x", before: { ciphertext: "old'c", iv: "i", keyVersion: "v'1" }, after: { ciphertext: "new'c", iv: "n'iv", keyVersion: "h1:'v" },
    }]);
    expect(sql).toBe(
      "UPDATE initial_credential_memos SET ciphertext = 'new''c', iv = 'n''iv', key_version = 'h1:''v'" +
      " WHERE user_id = 'usr_''x' AND key_version = 'v''1' AND ciphertext = 'old''c';",
    );
  });

  it("読んでから書くまでに再発行された控えは、古い中身で上書きしない", async () => {
    insertMemo("usr_a", await sealMemo(oldVault, "usr_a", "pass-a-00001"));
    const rows = memos().map((r) => ({ userId: r.user_id, ciphertext: r.ciphertext, iv: r.iv, keyVersion: r.key_version, issuedAt: r.issued_at }));
    const { updates } = await planRewrap(rows, oldVault, newVault, NOW);
    const reissued = await sealMemo(oldVault, "usr_a", "pass-a-reissued");
    t.raw.prepare("UPDATE initial_credential_memos SET ciphertext = ?, iv = ? WHERE user_id = 'usr_a'").run(reissued.ciphertext, reissued.iv);
    t.raw.exec(buildUpdateSql(updates).join("\n"));
    expect(memos()[0]).toMatchObject({ ciphertext: reissued.ciphertext, key_version: oldVault.version });
  });

  it("既定は件数だけを出して書かない。--apply で書き、もう一度流すと包み直す件数は0件", async () => {
    backWithSqlite();
    insertMemo("usr_a", await legacySeal(oldBase64, "usr_a", "pass-a-00001"), LIVE, "usr_admin");
    insertMemo("usr_b", await sealMemo(oldVault, "usr_b", "pass-b-00001"), LIVE - DAY, null);
    insertMemo("usr_c", await sealMemo(oldVault, "usr_c", "pass-c-00001"), EXPIRED);
    const before = memos();

    const dry = await run(["--local", "--dry-run"]);
    expect(dry.exit).toBe(0);
    expect(dry.stdout).toMatch(/書いていません/);
    expect(dry.stdout).toMatch(/読めた件数: 2\n {2}包み直す件数: 2\n {2}期限切れで飛ばす件数: 1\n {2}読めない件数: 0/);
    expect(files).toEqual([]);
    expect(memos()).toEqual(before);

    const applied = await run(["--local", "--apply"]);
    expect(applied.exit).toBe(0);
    expect(applied.stdout).toMatch(/2 件を書きました/);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ mode: 0o600, target: "--local" });
    expect(existsSync(files[0].file)).toBe(false);
    expect(existsSync(dirname(files[0].file))).toBe(false);

    const after = memos();
    for (const [userId, password] of [["usr_a", "pass-a-00001"], ["usr_b", "pass-b-00001"]]) {
      const memo = after.find((r) => r.user_id === userId);
      const was = before.find((r) => r.user_id === userId);
      // 発行日時と発行した人は保つ（14日の期限を延ばさない）
      expect({ issued_at: memo.issued_at, issued_by: memo.issued_by }).toEqual({ issued_at: was.issued_at, issued_by: was.issued_by });
      expect(memo.key_version).toBe(newVault.version);
      await expect(openMemo(newVault, userId, { ciphertext: memo.ciphertext, iv: memo.iv, keyVersion: memo.key_version }, NOW))
        .resolves.toEqual({ ok: true, password });
    }
    // 期限切れの行には触れない（次の発行の batch で消える）
    expect(after.find((r) => r.user_id === "usr_c")).toEqual(before.find((r) => r.user_id === "usr_c"));

    const again = await run(["--local"]);
    expect(again.stdout).toMatch(/読めた件数: 2\n {2}包み直す件数: 0\n {2}期限切れで飛ばす件数: 1\n {2}読めない件数: 0/);
    const noop = await run(["--local", "--apply"]);
    expect(noop.stdout).toMatch(/何も書いていません/);
    expect(files).toHaveLength(1);

    // 出すのは件数だけ（鍵・暗号文・パスワードを出さない）
    const printed = [dry, applied, again, noop].map((r) => r.stdout + r.stderr).join("\n");
    for (const secret of [oldBase64, newBase64, "pass-a-00001", "pass-b-00001", ...before.map((r) => r.ciphertext), ...after.map((r) => r.ciphertext)]) {
      expect(printed).not.toContain(secret);
    }
  });

  it("--remote は wrangler に --remote を渡す", async () => {
    backWithSqlite();
    insertMemo("usr_a", await sealMemo(oldVault, "usr_a", "pass-a-00001"));
    await run(["--remote", "--apply"]);
    expect(execFileSync.mock.calls.every(([, args]) => args.includes("--remote") && !args.includes("--local"))).toBe(true);
    expect(files[0].target).toBe("--remote");
  });

  it("読み書きの失敗は、wrangler の出力（暗号文と SQL）を出さずに伝える", async () => {
    insertMemo("usr_a", await sealMemo(oldVault, "usr_a", "pass-a-00001"));
    const ciphertext = memos()[0].ciphertext;

    backWithSqlite({ failRead: true });
    const read = await run(["--local"]);
    expect(read.exit).toBe(1);
    expect(read.stderr).toMatch(/読めませんでした/);

    backWithSqlite({ failWrite: true });
    const write = await run(["--local", "--apply"]);
    expect(write.exit).toBe(1);
    expect(write.stderr).toMatch(/書き込めませんでした/);
    expect(existsSync(dirname(files[0].file))).toBe(false);

    expect(read.stdout + read.stderr + write.stdout + write.stderr).not.toContain(ciphertext);
  });

  it("引数・環境変数・端末の誤りは、標準入力を読まずに断る", async () => {
    backWithSqlite();
    const cases = [
      [["--local", "--apply", "--dry-run"], {}],
      [["--local", "--old-key"], {}],
      [["--local"], { env: { CREDENTIAL_ENC_KEY: "set" } }],
      [["--local"], { env: { OLD_CREDENTIAL_ENC_KEY: "set" } }],
      [["--local"], { env: { NEW_CREDENTIAL_ENC_KEY: "set" } }],
      [["--local"], { isTTY: true }],
    ];
    for (const [argv, options] of cases) {
      const result = await run(argv, options);
      expect(result.exit).toBe(1);
      expect(result.read).not.toHaveBeenCalled();
    }
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it("鍵の行が足りない・32バイトの base64 でないときは、DB に触れずに断る", async () => {
    backWithSqlite();
    for (const [input, pattern] of [
      [`${oldBase64}\n`, /2行/],
      [`short\n${newBase64}\n`, /1行目/],
      [`${oldBase64}\nshort\n`, /2行目/],
    ]) {
      const result = await run(["--local"], { input });
      expect(result.exit).toBe(1);
      expect(result.stderr).toMatch(pattern);
      expect(result.stderr).not.toContain(oldBase64);
    }
    expect(execFileSync).not.toHaveBeenCalled();
  });
});

describe("暗号の処理の写しを作らない（DD-032 の1）", () => {
  it("script も credential-vault.ts も、暗号の処理を keys.ts の関数に任せる", () => {
    const script = readFileSync("scripts/rewrap-credential-vault.mjs", "utf8");
    const vault = readFileSync("src/lib/credential-vault.ts", "utf8");
    expect(script).toContain('from "../src/lib/security/keys.ts"');
    expect(vault).toMatch(/from "@\/lib\/security\/keys"/);
    for (const source of [script, vault]) {
      expect(source).not.toMatch(/crypto\.subtle/);
    }
  });
});
