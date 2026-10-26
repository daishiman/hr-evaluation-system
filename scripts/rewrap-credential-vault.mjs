/**
 * 初期パスワードの控えを、新しい鍵で包み直す（DD-032 の1。手順は docs/security/secret-rotation-runbook.md の③）。
 *
 *   read -rs OLD_KEY; read -rs NEW_KEY
 *   printf '%s\n%s\n' "$OLD_KEY" "$NEW_KEY" | pnpm run credential:rewrap -- --remote          # 件数だけ
 *   printf '%s\n%s\n' "$OLD_KEY" "$NEW_KEY" | pnpm run credential:rewrap -- --remote --apply  # 書く
 *
 * - 鍵は標準入力（パイプ）の2行で受ける。1行目が古い鍵、2行目が新しい鍵。
 *   コマンドの引数と環境変数には置かせない（シェルの履歴とプロセスの一覧に残るため）。
 *   鍵を替えずに古い形式（版に h1: の無いもの）だけを移すときは、2行とも今の鍵を渡す。
 * - 既定（と --dry-run）は書かずに件数だけを出す。--apply を付けたときだけ書く。
 * - 包む・開く処理は src/lib/security/keys.ts の関数をそのまま使う（アプリと同じ。写しを作らない）。
 * - 出すのは件数だけ。鍵・暗号文・パスワード・wrangler の出力は出さない。
 * - 書く文は、読んだときの版と暗号文のままの行だけを置き換える
 *   （読んでから書くまでの間に再発行された控えを、古い中身で上書きしない）。
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { importVaultKey, isMemoExpired, openMemo, sealMemo } from "../src/lib/security/keys.ts";

const DATABASE = "hr-evaluation-db";
const SELECT_SQL = "SELECT user_id, ciphertext, iv, key_version, issued_at FROM initial_credential_memos";
/** 鍵を置いてはいけない環境変数の名前 */
export const KEY_ENV_NAMES = ["CREDENTIAL_ENC_KEY", "OLD_CREDENTIAL_ENC_KEY", "NEW_CREDENTIAL_ENC_KEY"];

/**
 * 引数を読む。知らない指定は、値を繰り返さずに断る（鍵を貼り間違えた引数を画面に出さないため）。
 * `pnpm run credential:rewrap -- ...` の区切りの `--` は読み飛ばす。
 */
export function parseArgs(argv) {
  const args = argv.filter((a) => a !== "--");
  const known = new Set(["--local", "--remote", "--apply", "--dry-run"]);
  if (args.some((a) => !known.has(a))) {
    throw new Error("知らない指定があります。使えるのは --local・--remote・--apply・--dry-run だけです（鍵は引数で渡さず、標準入力で渡します）。");
  }
  const local = args.includes("--local");
  const remote = args.includes("--remote");
  if (local === remote) throw new Error("--local か --remote のどちらか1つを指定してください。");
  const apply = args.includes("--apply");
  if (apply && args.includes("--dry-run")) throw new Error("--apply と --dry-run は一緒に使えません。");
  return { target: remote ? "remote" : "local", apply };
}

/** 標準入力の2行を、古い鍵と新しい鍵に分ける。値は返すだけで、どこにも出さない */
export function parseKeys(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "");
  if (lines.length !== 2) throw new Error("標準入力には、古い鍵と新しい鍵を1行ずつ（2行）渡してください。");
  return { oldKey: lines[0], newKey: lines[1] };
}

/**
 * 控えの行を分ける。返すのは件数と、書く行（新しい鍵で包んだもの）だけ。
 * - 期限切れ（発行から14日）は、開けず一覧にも出ないので飛ばす（次の発行の batch で消える）。
 * - 版が新しい鍵と同じ行は包み直さない（書いた後にもう一度流すと、包み直す件数は0件になる）。
 * - それ以外は古い鍵で開き、開けなければ新しい鍵でも開いてみる（新しい鍵の古い形式）。
 *   開けたら新しい鍵で包み直し、どちらでも開けなければ読めない件数に数える。
 */
export async function planRewrap(rows, oldVault, newVault, now = new Date()) {
  const counts = { readable: 0, rewrap: 0, expired: 0, unreadable: 0 };
  const updates = [];
  for (const row of rows) {
    if (isMemoExpired(new Date(row.issuedAt), now)) {
      counts.expired++;
      continue;
    }
    const memo = { ciphertext: row.ciphertext, iv: row.iv, keyVersion: row.keyVersion };
    const current = row.keyVersion === newVault.version;
    let opened = await openMemo(current ? newVault : oldVault, row.userId, memo, now);
    if (!opened.ok && !current) opened = await openMemo(newVault, row.userId, memo, now);
    if (!opened.ok) {
      counts.unreadable++;
      continue;
    }
    counts.readable++;
    if (current) continue;
    counts.rewrap++;
    updates.push({ userId: row.userId, before: memo, after: await sealMemo(newVault, row.userId, opened.password) });
  }
  return { counts, updates };
}

const sqlText = (value) => `'${String(value).replaceAll("'", "''")}'`;

/** 書く文。読んだときの版と暗号文のままの行だけを置き換え、発行日時と発行した人は保つ */
export function buildUpdateSql(updates) {
  return updates.map(({ userId, before, after }) =>
    `UPDATE initial_credential_memos SET ciphertext = ${sqlText(after.ciphertext)}, iv = ${sqlText(after.iv)}, key_version = ${sqlText(after.keyVersion)}` +
    ` WHERE user_id = ${sqlText(userId)} AND key_version = ${sqlText(before.keyVersion)} AND ciphertext = ${sqlText(before.ciphertext)};`,
  );
}

/** 控えの表を wrangler で読み書きする。例外と出力には SQL と暗号文が含まれうるので、呼び出し側で出さない */
function d1(target) {
  const cwd = fileURLToPath(new URL("..", import.meta.url));
  const command = ["exec", "wrangler", "d1", "execute", DATABASE, `--${target}`, "--yes", "--json"];
  return {
    readRows() {
      const output = execFileSync("pnpm", [...command, "--command", SELECT_SQL], {
        cwd, stdio: "pipe", encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
      });
      return JSON.parse(output)
        .flatMap((entry) => entry.results ?? [])
        .map((r) => ({ userId: r.user_id, ciphertext: r.ciphertext, iv: r.iv, keyVersion: r.key_version, issuedAt: Number(r.issued_at) }));
    },
    write(statements) {
      const directory = mkdtempSync(join(tmpdir(), "hr-rewrap-"));
      const file = join(directory, "rewrap.sql");
      try {
        // 暗号文だけだが、権限を絞り、成功・失敗どちらでも削除する
        writeFileSync(file, statements.join("\n"), { mode: 0o600 });
        execFileSync("pnpm", [...command, "--file", file], { cwd, stdio: "pipe" });
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  };
}

/** 終了コードを返す（0 は成功、1 は断った・失敗した）。鍵と暗号文はどの経路でも出さない */
export async function main(argv, {
  env = process.env,
  stdin = { isTTY: process.stdin.isTTY, read: () => readFileSync(0, "utf8") },
  now = new Date(),
  log = console.log,
  error = console.error,
} = {}) {
  const fail = (message) => {
    error(message);
    return 1;
  };
  let options;
  try {
    options = parseArgs(argv);
  } catch (e) {
    return fail(e.message);
  }
  if (KEY_ENV_NAMES.some((name) => env[name])) {
    return fail("鍵を環境変数に置かないでください。古い鍵と新しい鍵は、標準入力の2行で渡します。");
  }
  // 端末から直に読むと打った文字が画面に出るので、パイプで渡されたときだけ読む
  if (stdin.isTTY) return fail("鍵は端末に打たず、パイプで2行渡してください（手順書の③）。");
  let keys;
  try {
    keys = parseKeys(stdin.read());
  } catch (e) {
    return fail(e.message);
  }
  const oldVault = await importVaultKey(keys.oldKey);
  const newVault = await importVaultKey(keys.newKey);
  if (!oldVault) return fail("1行目（古い鍵）が、32バイトを base64 にした値ではありません。");
  if (!newVault) return fail("2行目（新しい鍵）が、32バイトを base64 にした値ではありません。");

  const database = d1(options.target);
  let plan;
  try {
    plan = await planRewrap(database.readRows(), oldVault, newVault, now);
  } catch {
    return fail("控えを読めませんでした。接続・権限と migration の状態を確かめてください。");
  }
  const { counts, updates } = plan;
  const where = options.target === "remote" ? "本番" : "ローカル";
  const writing = options.apply && updates.length > 0;
  log(`控えの包み直し（${where}・${writing ? "書きます" : "書いていません"}）`);
  log(`  読めた件数: ${counts.readable}`);
  log(`  包み直す件数: ${counts.rewrap}`);
  log(`  期限切れで飛ばす件数: ${counts.expired}`);
  log(`  読めない件数: ${counts.unreadable}`);
  if (counts.unreadable > 0) {
    log("読めない控えは包み直せません。鍵を替えた後は開けないので、その人には仮パスワードを再発行してください。");
  }
  if (!options.apply) {
    if (updates.length > 0) log("件数を確かめてから、--apply を付けて同じ鍵をもう一度渡すと書き込みます。");
    return 0;
  }
  if (updates.length === 0) {
    log("包み直す控えが無いので、何も書いていません。");
    return 0;
  }
  try {
    database.write(buildUpdateSql(updates));
  } catch {
    return fail("書き込めませんでした。一部だけ書かれたことがありうるので、--apply を付けずにもう一度流して件数を確かめてください。");
  }
  log(`${updates.length} 件を書きました。--apply を付けずにもう一度流し、包み直す件数が0件になったことを確かめてください。`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await main(process.argv.slice(2));
}
