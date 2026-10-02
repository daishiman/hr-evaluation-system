import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/test-support/source-code";
import { ACTION_HOOKS } from "@/test-support/action-hooks";

/**
 * 画面からの書き込みの入口（Server Action）の作法を、ファイルの形で固定する。
 *
 * 「保存したのに一覧が古い」を根から断つため、画面からの書き込みは
 * すべて Server Action に寄せ、応答に新しい画面を載せて返す（runAction の refresh）。
 * この約束は1本でも外れると、その操作だけ「リロードしないと出ない」に戻る。
 * 目で見て揃えたものが、次の追加で崩れないよう機械で見張る。
 */

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

const rel = (p: string) => p.replace(`${SRC}/`, "");
const serverActionFiles = walk(join(SRC, "actions")).filter((p) =>
  readFileSync(p, "utf8").startsWith('"use server"'),
);

/** export async function ごとに、名前と本文（次の export まで）を切り出す */
function exportedFunctions(source: string): { name: string; body: string }[] {
  return source
    .split(/\nexport async function /)
    .slice(1)
    .map((part) => ({ name: part.slice(0, part.indexOf("(")), body: part.split(/\nexport /)[0] }));
}

describe("Server Action の入口", () => {
  it("src/actions の入口ファイルが見つかる（探し方が壊れて 0 件で通らない）", () => {
    expect(serverActionFiles.length).toBeGreaterThan(10);
  });

  it("どの入口も runAction か runRead を通す（権限・入力・失敗の言い方・描き直しを1か所にまとめる）", () => {
    const offenders: string[] = [];
    for (const file of serverActionFiles) {
      for (const fn of exportedFunctions(readFileSync(file, "utf8"))) {
        const firstStatement = fn.body.slice(fn.body.indexOf("{") + 1).trimStart();
        if (!/^return run(?:Action|Read)\(/.test(firstStatement)) offenders.push(`${rel(file)}: ${fn.name}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('"use server" のファイルは関数以外を外へ出さない（定数・型を出すと、呼べる入口と取り違える）', () => {
    const offenders = serverActionFiles.filter((file) =>
      /\nexport (?!async function )/.test(readFileSync(file, "utf8")),
    );
    expect(offenders.map(rel)).toEqual([]);
  });

  it("runRead の入口は書き込まない（書くなら runAction にして、画面の描き直しと他タブへの知らせを通す）", () => {
    const writes = /\.insert\(|\.update\(s\.|\.delete\(s\.|db\.batch\(|batchAll\(|memoUpsert\(|memoDelete\(/;
    const offenders: string[] = [];
    for (const file of serverActionFiles) {
      for (const fn of exportedFunctions(readFileSync(file, "utf8"))) {
        if (fn.body.includes("return runRead(") && writes.test(fn.body)) offenders.push(`${rel(file)}: ${fn.name}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("画面からの書き込み", () => {
  /** 画面側に置かれうるファイル（Route Handler の app/api は除く。lib は画面からも使われるので含める）。 */
  const clientSide = walk(join(SRC, "components"))
    .concat(walk(join(SRC, "app")).filter((p) => !p.includes(`${join(SRC, "app", "api")}/`)))
    .concat(walk(join(SRC, "lib")));
  /** 注釈を除いた中身。注釈に書いた使い方の例で、検査を通ったり落ちたりしないようにする。 */
  const code = (p: string) => stripComments(readFileSync(p, "utf8"));
  const listedFileLacks = (pattern: RegExp) => (p: string) => {
    try {
      return !pattern.test(code(join(SRC, p)));
    } catch {
      return true; // もう存在しない
    }
  };

  /** 通信の口。これを持つファイルは、下の WRITES か READS に理由つきで載せる。 */
  const NETWORK = /\bfetch\b|\bsendBeacon\b|\bXMLHttpRequest\b/;

  /**
   * 書き込む通信を画面側に持ってよいもの。増やすときは必ず理由を書く。
   * ここに無い書き込みは Server Action（useSaveAction）へ寄せる。
   */
  const WRITES: Record<string, string> = {
    "lib/usage-client.ts": "利用状況の記録。画面を閉じても届くよう sendBeacon で送り、応答も画面の描き直しも要らない",
    "lib/theme-usage.ts": "明るさ・配色の選択の記録。表示は端末側で即座に切り替わっており、サーバーの応答を待たない",
  };

  /** 通信を持つが、書き込まないもの。書き込みを足すなら WRITES へ移し、理由を書き直す。 */
  const READS: Record<string, string> = {
    "components/GlobalSearch.tsx": "検索の候補を読むだけ（GET）",
    "lib/client-diagnostics.ts": "画面の fetch を包み、失敗した通信を手元に控えるだけ。自分では送らない",
  };

  it("画面側で通信を持つファイルは、どれも一覧（WRITES・READS）に理由つきで載っている", () => {
    /* method の書き方（変数で渡す・大文字小文字）や送り方（sendBeacon・XMLHttpRequest）に
       よらず、通信の口があるファイルは必ず人が理由を書いて通す。 */
    const offenders = clientSide
      .filter((p) => NETWORK.test(code(p)))
      .map(rel)
      .filter((p) => !WRITES[p] && !READS[p]);
    expect(offenders).toEqual([]);
  });

  it("画面側に書き込みの fetch を作らない（保存したのに一覧が古い、の入り口になる）", () => {
    const offenders = clientSide
      .filter((p) => /\bmethod:\s*["'`](?:POST|PUT|PATCH|DELETE)["'`]/i.test(code(p)))
      .map(rel)
      .filter((p) => !WRITES[p]);
    expect(offenders).toEqual([]);
  });

  it("読むだけの一覧のファイルは、送り方を指定しない（method の指定・書き込みの語・sendBeacon を持たない）", () => {
    // 受け取った値を読む input.method : "GET" は指定ではないので、直前が . のものは数えない
    const sends = /(?<![.\w])method\s*:|["'`](?:POST|PUT|PATCH|DELETE)["'`]|\bsendBeacon\b|\bXMLHttpRequest\b/i;
    expect(Object.keys(READS).filter((p) => !listedFileLacks(sends)(p))).toEqual([]);
  });

  it("一覧に、もう存在しないファイルや、通信を持たなくなったファイルを残さない", () => {
    expect([...Object.keys(WRITES), ...Object.keys(READS)].filter(listedFileLacks(NETWORK))).toEqual([]);
  });

  /** Server Action を import する書き方（@/actions/… と相対の …/actions/…）。 */
  const ACTIONS_IMPORT = /(?:from|import\()\s*["'](?:@\/|(?:\.\.?\/)+)actions\//g;

  /**
   * Server Action を部品へ渡す中継だけをするファイル。中継自身は useSaveAction を呼ばない。
   * 増やすときは必ず理由を書く。中継を import した部品は、下の検査で Server Action を
   * import した部品と同じに扱う（中継を直に呼んで useSaveAction を飛ばす、を防ぐ）。
   */
  const RELAYS: Record<string, string> = {
    "components/master-request.ts":
      "制度設定の保存と削除を1つの入口にまとめるだけ（dispatchAction）。部品は useSaveAction(masterRequest) で受ける",
  };
  const RELAY_IMPORT = new RegExp(
    `from\\s*["'][^"']*/(?:${Object.keys(RELAYS)
      .map((p) => basename(p).replace(/\.tsx?$/, ""))
      .join("|")})["']`,
  );

  /** 共通hookも検査対象にする。呼び出し側の省略を例外扱いせず、hook自身の入口まで確認する。 */
  const importedActionHooks = (source: string) =>
    ACTION_HOOKS.filter(({ file }) =>
      new RegExp(`from\\s*["'][^"']*/${basename(file, ".ts")}["']`).test(source),
    );

  /** Server Action 自身と、"use client" の無い app のファイル（サーバーの画面）。action を部品へ渡す側 */
  const runsOnServer = (p: string, source: string) =>
    source.trimStart().startsWith('"use server"') ||
    (p.startsWith(`${join(SRC, "app")}/`) && !/^\s*["']use client["']/.test(source));

  it("画面の部品から Server Action を呼ぶときは、useSaveAction か useReadAction を通す", () => {
    /* 部品から action を直に await すると、保存中の状態・他タブへの知らせ・
       通信が切れたときの言い方がその部品だけ抜ける。
       対象は src 全体のうち、サーバーで動くもの以外（"use client" のファイル・lib・中継を使う部品）。 */
    const users = walk(SRC).flatMap((p) => {
      const source = code(p);
      if (runsOnServer(p, source)) return [];
      return source.match(ACTIONS_IMPORT) || RELAY_IMPORT.test(source) || importedActionHooks(source).length
        ? [rel(p)] : [];
    });
    expect(users.length).toBeGreaterThan(25);
    const offenders = users.filter((p) => {
      const source = code(join(SRC, p));
      return !RELAYS[p] && !/use(?:Save|Read)Action\(/.test(source) &&
        !importedActionHooks(source).some(({ name }) => new RegExp(`\\b${name}\\(`).test(source));
    });
    expect(offenders).toEqual([]);
  });

  it("共有hook自身はuseSaveActionを通し、制度マスタの中継を直接呼ばない", () => {
    for (const { file, name } of ACTION_HOOKS) {
      const source = code(join(SRC, file));
      expect(source).toMatch(new RegExp(`export function ${name}\\(`));
      expect(source).toMatch(/useSaveAction\(masterRequest,\s*\{\s*resource:\s*"masters"\s*\}\)/);
      expect(source).not.toMatch(/\bmasterRequest\s*\(/);
    }
  });

  it("中継の一覧に、もう存在しないファイルや、Server Action を import しなくなったファイルを残さない", () => {
    expect(Object.keys(RELAYS).filter(listedFileLacks(new RegExp(ACTIONS_IMPORT.source)))).toEqual([]);
  });

  it("import した Server Action は、その場で呼ばずに渡すだけにする", () => {
    /* useSaveAction(save) や dispatchAction の対応表へ渡すのはよい。
       save(input) と直に呼ぶと、同じファイルに useSaveAction があっても、その呼び出しだけ
       保存中の状態・描き直し・他タブへの知らせが抜ける。サーバーの画面から呼ぶのも同じ。 */
    const offenders: string[] = [];
    for (const p of walk(SRC)) {
      const source = code(p);
      const count = source.match(ACTIONS_IMPORT)?.length ?? 0;
      if (count === 0 || source.trimStart().startsWith('"use server"')) continue;
      const imports = [...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*["'][^"']*actions\/[^"']+["'];?/g)];
      // 名前を並べる形だけを読む。* as や default で受けると、何を呼んだかを追えない
      if (imports.length !== count) offenders.push(`${rel(p)}: 名前を並べずに import している`);
      const rest = imports.reduce((s, m) => s.replace(m[0], ""), source);
      const names = imports
        .flatMap((m) => m[1].split(","))
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith("type "))
        .map((s) => s.split(/\s+as\s+/).pop() ?? s);
      for (const name of names) {
        if (new RegExp(`\\b${name}\\s*\\(`).test(rest)) offenders.push(`${rel(p)}: ${name}(`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
