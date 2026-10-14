import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROLES, type Role } from "@/lib/session";
import { navGroupsFor } from "@/lib/nav";
import { minRoleFor, roleCan, routeAccessOf } from "@/lib/route-access";
import { stripComments } from "@/test-support/source-code";

/*
 * 権限の契約（S4・S5・A3）。
 *
 * 権限一覧のページは台帳（system-spec/route-ledger.json）を読んで表を作る。
 * 一覧が実際の動きとずれないよう、役割の判定はすべて台帳を引く形にそろえ、
 * 「台帳に書いたこと」と「ページの入口・サーバー処理・Route Handler・メニュー」が
 * 双方向に一致することを字面で確かめる。
 *
 * - ページは requireRoute("<自分のパス>")、layout は上の階層のパスで入口を作る。
 * - サーバー処理は runAction / runRead の operation、Route Handler は apiViewerFor(<操作 id>)。
 * - 役割の名前を書いた判定（requireRole(・role: "…"・apiViewer("…")）は0件。
 * - 役割名の直接の比較は、台帳から導けない規則だけを許可リストに理由付きで置く。
 */

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const rel = (p: string) => path.relative(ROOT, p);
const read = (p: string) => stripComments(readFileSync(p, "utf8"));

type ByRole = Record<Role, "full" | "conditional" | "none">;
interface Access {
  minRole: Role | null;
  byRole: ByRole;
  condition?: string;
  conditionRef?: string;
}
interface Operation {
  id: string;
  label: string;
  minRole: Role;
  actions: string[];
  description: string;
}
interface LedgerRoute {
  path: string;
  label: string;
  accessClass: string;
  navHiddenFor?: Role[];
  permissions?: { summary: string; operations: Operation[] };
}
interface Ledger {
  $schemaNote: string;
  outcomeMeaning: Record<string, string>;
  accessClasses: Record<string, { states: Record<string, { expectedByRole: Record<Role, string> }>; access?: Access }>;
  routes: LedgerRoute[];
  sharedOperations?: Operation[];
  publicEndpoints?: { api: string; reason: string }[];
}

const ledger = JSON.parse(readFileSync(path.join(ROOT, "system-spec/route-ledger.json"), "utf8")) as Ledger;
/** ROLES は強い順（SUPER_ADMIN が先頭）。先にあるほど強い */
const atLeast = (role: Role, min: Role) => ROLES.indexOf(role) <= ROLES.indexOf(min);
/** ログインの前に出すページ（入口の判定を持たない） */
const PUBLIC_CLASSES = new Set(["login", "rootRouter", "legacyRedirect", "publicToken"]);

function walk(dir: string, match: (name: string) => boolean, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, match, out);
    else if (match(name)) out.push(p);
  }
  return out;
}
const isSource = (name: string) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name);

const allOperations: (Operation & { routePath: string | null })[] = [
  ...ledger.routes.flatMap((r) => (r.permissions?.operations ?? []).map((op) => ({ ...op, routePath: r.path }))),
  ...(ledger.sharedOperations ?? []).map((op) => ({ ...op, routePath: null })),
];

/** export async function ごとに、名前と本文（次の export まで）を切り出す */
function exportedFunctions(source: string): { name: string; body: string }[] {
  return source
    .split(/\nexport async function /)
    .slice(1)
    .map((part) => ({ name: part.slice(0, part.indexOf("(")), body: part.split(/\nexport /)[0] }));
}

const actionFiles = walk(path.join(SRC, "actions"), isSource).filter((p) =>
  readFileSync(p, "utf8").startsWith('"use server"'),
);
const actionRefs = actionFiles.flatMap((file) =>
  exportedFunctions(read(file)).map((fn) => ({
    ref: `actions/${path.basename(file)}#${fn.name}`,
    body: fn.body,
  })),
);

const handlerFiles = walk(path.join(SRC, "app/api"), (n) => n === "route.ts");
/** api/<path>#<METHOD> と、その METHOD の本文 */
const handlerRefs = handlerFiles.flatMap((file) => {
  const source = read(file);
  const apiPath = path.relative(path.join(SRC, "app"), path.dirname(file));
  const methods = [
    ...[...source.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]),
    ...[...source.matchAll(/export \{([^}]*)\}/g)].flatMap((m) =>
      [...m[1].matchAll(/as (GET|POST|PUT|PATCH|DELETE)\b/g)].map((x) => x[1]),
    ),
  ];
  return methods.map((method) => {
    const start = source.search(new RegExp(`export async function ${method}\\b`));
    const body = start < 0 ? "" : source.slice(start).split(/\nexport /)[0];
    return { ref: `${apiPath}#${method}`, body };
  });
});

describe("台帳の形", () => {
  it("全ページに permissions（summary と operations）があり、操作 id は台帳の中で重ならない", () => {
    for (const route of ledger.routes) {
      expect(route.permissions?.summary?.trim(), `${route.path} に summary が無い`).toBeTruthy();
      expect(Array.isArray(route.permissions?.operations), `${route.path} に operations が無い`).toBe(true);
    }
    const ids = allOperations.map((op) => op.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i), "重なっている操作 id").toEqual([]);
  });

  it("操作は id・名前・最低の役割・説明を持ち、参照の形が決まっている", () => {
    for (const op of allOperations) {
      expect(op.id, JSON.stringify(op)).toMatch(/^[a-z][a-zA-Z]*(\.[a-z][a-zA-Z]*)+$/);
      expect(op.label.trim(), op.id).not.toBe("");
      expect(op.description.trim(), op.id).not.toBe("");
      expect(ROLES, op.id).toContain(op.minRole);
      for (const ref of op.actions) {
        expect(ref, op.id).toMatch(/^(actions\/[a-z-]+\.ts#[A-Za-z]\w*|api\/[^#]+#(GET|POST|PUT|PATCH|DELETE))$/);
      }
    }
  });

  it("操作の最低の役割は、その操作を持つページの最低の役割以上（共有の操作は除く）", () => {
    for (const op of allOperations.filter((o) => o.routePath)) {
      const page = routeAccessOf(op.routePath!);
      if (page?.minRole) expect(atLeast(op.minRole, page.minRole), `${op.id}（${op.routePath}）`).toBe(true);
    }
  });

  it("メニューで隠す役割（navHiddenFor）は実在の役割", () => {
    for (const route of ledger.routes) {
      for (const role of route.navHiddenFor ?? []) expect(ROLES, route.path).toContain(role);
    }
  });

  it("台帳の説明書き（$schemaNote）の画面数が実際の数と合う", () => {
    expect(ledger.$schemaNote).toContain(`${ledger.routes.length}個`);
  });
});

describe("ページの可否（accessClass.access）は、状態ごとの期待（expectedByRole）と矛盾しない", () => {
  /** 「できる」と数える結果。denied（本文を出さない権限不足の画面）・redirect・notFound は数えない */
  const grants = (outcome: string) => outcome === "200";

  for (const [name, cls] of Object.entries(ledger.accessClasses)) {
    it(name, () => {
      const access = cls.access;
      expect(access, `${name} に access が無い`).toBeDefined();
      const states = Object.entries(cls.states).filter(([state]) => state !== "anonymous");
      for (const role of ROLES) {
        const can = states.some(([, st]) => grants(st.expectedByRole[role] ?? ""));
        if (access!.byRole[role] === "none") expect(can, `${name}: ${role} は none なのに 200 がある`).toBe(false);
        else expect(can, `${name}: ${role} は ${access!.byRole[role]} なのに 200 が無い`).toBe(true);
      }
      // 最低の役割は none でない最も弱い役割。ログインの前のページだけ null
      const weakest = [...ROLES].reverse().find((r) => access!.byRole[r] !== "none") ?? null;
      if (PUBLIC_CLASSES.has(name)) expect(access!.minRole).toBeNull();
      else expect(access!.minRole).toBe(weakest);
      // 強い役割ほど狭くならない（強い順に並べて、none のあとに full / conditional が来ない）
      const firstNone = ROLES.findIndex((r) => access!.byRole[r] === "none");
      if (firstNone >= 0) {
        for (const r of ROLES.slice(firstNone)) expect(access!.byRole[r], `${name}: ${r}`).toBe("none");
      }
      // 条件つき（△）には条件の言葉と、判定する関数（export されていること）を書く
      if (ROLES.some((r) => access!.byRole[r] === "conditional")) {
        expect(access!.condition?.trim(), `${name} に condition が無い`).toBeTruthy();
        const [file, fn] = (access!.conditionRef ?? "").split("#");
        expect(file, `${name} の conditionRef`).toMatch(/^src\/.+\.tsx?$/);
        expect(read(path.join(ROOT, file)), `${access!.conditionRef}`).toMatch(
          new RegExp(`export (async )?function ${fn}\\b`),
        );
      }
    });
  }
});

describe("サーバー処理（Server Action）と台帳が双方向に合う", () => {
  const opsByRef = new Map<string, string[]>();
  for (const op of allOperations) {
    for (const ref of op.actions) opsByRef.set(ref, [...(opsByRef.get(ref) ?? []), op.id]);
  }

  it("全ての Server Action が、ちょうど1つの操作に載っている", () => {
    const wrong = actionRefs
      .map(({ ref }) => ({ ref, ops: opsByRef.get(ref) ?? [] }))
      .filter(({ ops }) => ops.length !== 1);
    expect(wrong).toEqual([]);
  });

  it("各 Server Action の runAction / runRead は、載っている操作の id を operation に書く", () => {
    for (const { ref, body } of actionRefs) {
      const [opId] = opsByRef.get(ref) ?? [];
      expect(body, ref).toMatch(new RegExp(`run(Action|Read)\\(\\s*\\{[^}]*\\boperation:\\s*"${opId}"`));
    }
  });

  it("台帳が指す Server Action は実在する", () => {
    const existing = new Set(actionRefs.map((a) => a.ref));
    for (const op of allOperations) {
      for (const ref of op.actions.filter((r) => r.startsWith("actions/"))) {
        expect(existing.has(ref), `${op.id} → ${ref}`).toBe(true);
      }
    }
  });
});

describe("Route Handler と台帳が双方向に合う", () => {
  const publicApis = new Set((ledger.publicEndpoints ?? []).map((p) => p.api));

  it("公開の入口（publicEndpoints）は理由を持つ", () => {
    for (const p of ledger.publicEndpoints ?? []) expect(p.reason.trim(), p.api).not.toBe("");
  });

  it("全ての Route Handler は、1つの操作に載って apiViewerFor で入るか、公開の入口に理由付きで載る", () => {
    for (const { ref, body } of handlerRefs) {
      const ops = allOperations.filter((op) => op.actions.includes(ref));
      if (publicApis.has(ref)) {
        expect(ops, `${ref} は公開の入口と操作の両方に載っている`).toEqual([]);
        continue;
      }
      expect(ops.length, `${ref} が台帳に無い`).toBeGreaterThan(0);
      expect(body, ref).toMatch(/apiViewerFor\(/);
      for (const op of ops) expect(body, `${ref} が ${op.id} を引いていない`).toContain(`"${op.id}"`);
    }
  });

  it("台帳が指す Route Handler は実在する", () => {
    const existing = new Set(handlerRefs.map((h) => h.ref));
    for (const op of allOperations) {
      for (const ref of op.actions.filter((r) => r.startsWith("api/"))) {
        expect(existing.has(ref), `${op.id} → ${ref}`).toBe(true);
      }
    }
    for (const p of ledger.publicEndpoints ?? []) expect(existing.has(p.api), p.api).toBe(true);
  });
});

describe("操作 id の参照は台帳に実在し、台帳の操作はどこかで使われている", () => {
  const sources = walk(SRC, isSource).map((p) => ({ file: rel(p), code: read(p) }));
  const REF = /(?:\boperation:\s*|apiViewerFor\(\s*|\bcan\(\s*[\w.]+\s*,\s*|roleCan\(\s*[\w.]+\s*,\s*)"([a-z][a-zA-Z]*(?:\.[a-z][a-zA-Z]*)+)"/g;
  const used = new Map<string, string[]>();
  for (const { file, code } of sources) {
    for (const m of code.matchAll(REF)) used.set(m[1], [...(used.get(m[1]) ?? []), file]);
  }
  const known = new Set(allOperations.map((op) => op.id));

  it("コードが引く操作 id は全て台帳にある", () => {
    expect([...used.keys()].filter((id) => !known.has(id))).toEqual([]);
  });

  it("処理を持たない操作（画面の出し分けだけのもの）は、コードから can / roleCan で引かれている", () => {
    // 処理を持つ操作は、上の2つの describe が処理の側から引いていることを確かめている
    const displayOnly = allOperations.filter((op) => op.actions.length === 0).map((op) => op.id);
    expect(displayOnly.filter((id) => !used.has(id))).toEqual([]);
  });

  it("一覧の等級と点数は MANAGER 以上、等級名の変更は COMPANY_ADMIN 以上", () => {
    expect(minRoleFor("members.viewGradeScore")).toBe("MANAGER");
    expect(roleCan("MANAGER", "members.viewGradeScore")).toBe(true);
    expect(roleCan("EMPLOYEE", "members.viewGradeScore")).toBe(false);
    // 等級名は制度マスタの保存（saveMaster の kind=grades）で変える
    const rename = allOperations.find((op) => op.actions.includes("actions/masters.ts#saveMaster"));
    expect(rename?.minRole).toBe("COMPANY_ADMIN");
  });

  it("未知の操作 id は、どの役割にも許さない", () => {
    expect(minRoleFor("no.such")).toBeNull();
    for (const role of ROLES) expect(roleCan(role, "no.such")).toBe(false);
  });
});

describe("ページの入口", () => {
  const pageFile = (p: string) => path.join(SRC, "app", p === "/" ? "" : p, "page.tsx");

  it("台帳の全ページのファイルがある", () => {
    for (const route of ledger.routes) expect(existsSync(pageFile(route.path)), route.path).toBe(true);
  });

  it("ログインの前のページ以外は requireRoute(<自分のパス>) で入る", () => {
    for (const route of ledger.routes.filter((r) => !PUBLIC_CLASSES.has(r.accessClass))) {
      expect(read(pageFile(route.path)), route.path).toContain(`requireRoute("${route.path}")`);
    }
  });

  it("役割で入口を分ける layout は、上の階層のパスで requireRoute を呼ぶ", () => {
    for (const area of ["/admin", "/manager", "/system", "/criteria"]) {
      expect(read(path.join(SRC, "app", area, "layout.tsx")), area).toContain(`requireRoute("${area}")`);
    }
  });
});

describe("役割の名前を書いた判定を残さない", () => {
  const sources = walk(SRC, isSource).map((p) => ({ file: rel(p), code: read(p) }));

  it("requireRole( ・runAction/runRead の role: ・apiViewer(\"<役割>\") が0件", () => {
    const hits = sources.flatMap(({ file, code }) => [
      ...[...code.matchAll(/\brequireRole\(/g)].map(() => `${file}: requireRole(`),
      ...[...code.matchAll(/run(?:Action|Read)\(\s*\{[^}]*\brole\s*:/g)].map(() => `${file}: role:`),
      ...[...code.matchAll(/\bapiViewer\(\s*["'`]/g)].map(() => `${file}: apiViewer("…")`),
    ]);
    expect(hits).toEqual([]);
  });

  /**
   * 台帳から導けない規則だけ、役割名の直接の比較を許す。
   * 「誰がこの画面・操作を使えるか」は台帳で引き、ここには「データの範囲」の規則だけを置く。
   */
  const ALLOWED: Record<string, string> = {
    "src/lib/session.ts": "全体管理者は会社に属さず、選んだ会社で操作する（所属の組み立て・会社の解決・最初の画面）",
    "src/lib/domain/evaluation-authority.ts": "マネージャーは自分の部下の評価だけ扱う（条件つきの判定関数）",
    "src/actions/system-users.ts": "役割の付け替えの規則（全体管理者は会社を持たない・最後の全体管理者を残す・部下を持てる役割）",
    "src/actions/members.ts": "上長に選べるのは EMPLOYEE 以外・役割を下げるときの部下の付け替え",
    "src/actions/evaluations.ts": "マネージャーは自分の部下の評価だけ扱う",
    "src/actions/credential-memos.ts": "全体管理者だけが会社をまたいで控えを読む",
    "src/app/api/search/route.ts": "検索の範囲（全社・自社・自分の部下）",
    "src/app/admin/members/page.tsx": "上長の候補は EMPLOYEE 以外",
    "src/app/admin/members/[id]/page.tsx": "上長の候補は EMPLOYEE 以外",
    "src/app/system/users/page.tsx": "全体管理者の一覧を分けて出す",
    "src/app/system/users/[id]/page.tsx": "上長の候補・最後の全体管理者",
    "src/app/manager/members/page.tsx": "マネージャーは自分の部下だけ・部下を持てる役割の印",
    "src/app/manager/cycles/page.tsx": "マネージャーは自分の部下だけ",
    "src/app/manager/evaluations/[id]/page.tsx": "マネージャーは自分の部下だけ",
    "src/lib/memberships.ts": "所属に置ける役割（全体管理者は所属を持たない）",
  };
  const COMPARE = /(?:===|!==)\s*["'](SUPER_ADMIN|COMPANY_ADMIN|MANAGER|EMPLOYEE)["']|["'](SUPER_ADMIN|COMPANY_ADMIN|MANAGER|EMPLOYEE)["']\s*(?:===|!==)|case\s+["'](SUPER_ADMIN|COMPANY_ADMIN|MANAGER|EMPLOYEE)["']\s*:/g;

  it("役割名の直接の比較は、許可リストの外で0件（メニュー・ヘッダー・改善要望の権限は台帳で引く）", () => {
    const hits = sources
      .filter(({ file }) => !(file in ALLOWED))
      .flatMap(({ file, code }) => [...code.matchAll(COMPARE)].map((m) => `${file}: ${m[0]}`));
    expect(hits).toEqual([]);
  });

  it("許可リストは理由を持ち、実在のファイルを指す", () => {
    for (const [file, reason] of Object.entries(ALLOWED)) {
      expect(reason.trim(), file).not.toBe("");
      expect(existsSync(path.join(ROOT, file)), file).toBe(true);
    }
  });
});

describe("メニューは台帳から作る", () => {
  const byPath = new Map(ledger.routes.map((r) => [r.path, r]));

  it.each([...ROLES])("%s: メニューの項目は台帳のページで、名前は台帳と同じ、入れない・隠すページは出さない", (role) => {
    for (const group of navGroupsFor(role)) {
      for (const item of group.items) {
        const route = byPath.get(item.href);
        expect(route, `${role}: ${item.href} は台帳に無い`).toBeDefined();
        expect(item.label).toBe(route!.label);
        expect(routeAccessOf(item.href)?.byRole[role], `${role}: ${item.href}`).not.toBe("none");
        expect(route!.navHiddenFor ?? [], `${role}: ${item.href}`).not.toContain(role);
      }
    }
  });

  it("権限一覧（/system/permissions）は全体管理者のメニューに出る", () => {
    const hrefs = navGroupsFor("SUPER_ADMIN").flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toContain("/system/permissions");
  });
});
