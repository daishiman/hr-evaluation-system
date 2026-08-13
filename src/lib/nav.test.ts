import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  homeItemFor,
  isCurrent,
  navGroupsFor,
  resolveTrail,
  ROUTE_META,
  routeMetaOf,
  searchableScreens,
  type NavGroup,
} from "@/lib/nav";
import { stepTitle } from "@/lib/domain/scheme-steps";

const hrefsOf = (groups: NavGroup[]) => groups.flatMap((g) => g.items.map((i) => i.href));

describe("サイドバーのメニュー", () => {
  it("一般の方には、制度の設定と評価基準を一切出さない", () => {
    const hrefs = hrefsOf(navGroupsFor("EMPLOYEE"));
    expect(hrefs.some((h) => h.startsWith("/admin"))).toBe(false);
    expect(hrefs.some((h) => h.startsWith("/system"))).toBe(false);
    expect(hrefs).not.toContain("/criteria");
    // 自分の実績報告と結果、それにアンケートの中身（確認専用）だけが見える
    expect(hrefs).toEqual(["/me", "/me/forms", "/me/results", "/forms"]);
  });

  it("アンケートの中身は、どのロールからも同じ入口で読める", () => {
    for (const role of ["EMPLOYEE", "MANAGER", "COMPANY_ADMIN", "SUPER_ADMIN"] as const) {
      const items = navGroupsFor(role).flatMap((g) => g.items);
      const entry = items.find((i) => i.href === "/forms");
      expect(entry, `${role} にアンケートの中身が出ていない`).toBeDefined();
      expect(entry?.label).toBe("アンケートの中身");
    }
  });

  it("自分のアカウントはサイドバーに出さない（右上のアイコンにまとめる）", () => {
    for (const role of ["EMPLOYEE", "MANAGER", "COMPANY_ADMIN", "SUPER_ADMIN"] as const) {
      const hrefs = hrefsOf(navGroupsFor(role));
      expect(hrefs.some((h) => h.startsWith("/account"))).toBe(false);
      expect(navGroupsFor(role).some((g) => g.title === "アカウント")).toBe(false);
    }
  });

  it("マネージャーには制度の設定を出さない（評価基準は見てよい）", () => {
    const hrefs = hrefsOf(navGroupsFor("MANAGER"));
    expect(hrefs).toContain("/criteria");
    expect(hrefs.some((h) => h.startsWith("/admin"))).toBe(false);
    expect(hrefs.some((h) => h.startsWith("/system"))).toBe(false);
  });

  it("会社の管理者には制度の設定が出て、システム管理は出ない", () => {
    const groups = navGroupsFor("COMPANY_ADMIN");
    const hrefs = hrefsOf(groups);
    expect(hrefs).toContain("/admin/setup");
    expect(hrefs).toContain("/admin/masters/requirements");
    expect(hrefs).toContain("/admin/scheme");
    expect(hrefs.some((h) => h.startsWith("/system"))).toBe(false);

    // 設定元から成果まで、依存する順番で迷わずたどれる
    const ordered = [
      "/admin/setup",
      "/admin/masters",
      "/admin/masters/requirements",
      "/admin/masters/promotion",
      "/admin/behavior",
      "/admin/scheme",
      "/admin/cycles",
      "/admin/forms",
      "/manager/cycles",
    ];
    expect(ordered.map((href) => hrefs.indexOf(href))).toEqual([...ordered.keys()].map((_, i) => i + 1));

    const labels = groups.flatMap((g) => g.items.map((i) => i.label));
    expect(labels).not.toContain("制度マスタ");
    expect(labels).toContain("等級の設定");
    expect(labels).toContain("行動指針");
  });

  it.each(["MANAGER", "COMPANY_ADMIN"] as const)(
    "%s も評価を受ける立場なので、自分の実績報告と結果への入口がある",
    (role) => {
      const hrefs = hrefsOf(navGroupsFor(role));
      expect(hrefs).toContain("/me/forms");
      expect(hrefs).toContain("/me/results");
    },
  );

  it("会社に属さないシステム全体管理者には、自分の評価を出さない", () => {
    const hrefs = hrefsOf(navGroupsFor("SUPER_ADMIN"));
    expect(hrefs.some((h) => h.startsWith("/me"))).toBe(false);
  });

  it("自分の実績報告と結果は、どのロールでも同じ語で呼ぶ", () => {
    for (const href of ["/me/forms", "/me/results"]) {
      const labels = (["EMPLOYEE", "MANAGER", "COMPANY_ADMIN"] as const).map(
        (r) => navGroupsFor(r).flatMap((g) => g.items).find((i) => i.href === href)?.label,
      );
      expect(new Set(labels).size).toBe(1);
    }
  });

  it("システム全体管理者にはシステム管理と会社ごとの運用の両方が出る", () => {
    const hrefs = hrefsOf(navGroupsFor("SUPER_ADMIN"));
    expect(hrefs).toContain("/system/companies");
    expect(hrefs).toContain("/admin/setup");
    expect(hrefs).toContain("/admin/masters");
  });

  it("どのロールでも、分類のあるグループには見出しが付いている", () => {
    for (const role of ["EMPLOYEE", "MANAGER", "COMPANY_ADMIN", "SUPER_ADMIN"] as const) {
      const groups = navGroupsFor(role);
      // 見出しなしで許されるのはホームだけ
      const untitled = groups.filter((g) => g.title === null);
      expect(untitled).toHaveLength(1);
      expect(untitled[0].items).toHaveLength(1);
      expect(untitled[0].items[0].label).toBe("ホーム");
    }
  });

  it("ホームはロールごとの入口と一致する", () => {
    expect(homeItemFor("EMPLOYEE").href).toBe("/me");
    expect(homeItemFor("MANAGER").href).toBe("/manager");
    expect(homeItemFor("COMPANY_ADMIN").href).toBe("/admin");
    expect(homeItemFor("SUPER_ADMIN").href).toBe("/system");
  });
});

describe("現在地の判定", () => {
  const hrefs = hrefsOf(navGroupsFor("COMPANY_ADMIN"));
  const at = (pathname: string, href: string) =>
    isCurrent(pathname, { href, label: href, exact: href === "/admin" }, hrefs);

  it("詳細画面にいるときも、その一覧が現在地になる", () => {
    expect(at("/admin/forms/f1", "/admin/forms")).toBe(true);
    expect(at("/admin/forms/f1/responses", "/admin/forms")).toBe(true);
  });

  it("ホームは完全一致のときだけ（配下の画面で光らせない）", () => {
    expect(at("/admin", "/admin")).toBe(true);
    expect(at("/admin/forms", "/admin")).toBe(false);
  });

  it("等級要件にいるとき、等級の設定は現在地にしない（深い方だけを光らせる）", () => {
    expect(at("/admin/masters/requirements", "/admin/masters/requirements")).toBe(true);
    expect(at("/admin/masters/requirements", "/admin/masters")).toBe(false);
    // 等級の設定自身にいるときは等級の設定が現在地
    expect(at("/admin/masters", "/admin/masters")).toBe(true);
  });

  it("関係のない画面ではどれも現在地にならない", () => {
    expect(hrefs.every((h) => !at("/admin/nowhere", h))).toBe(true);
  });
});

/**
 * 用語の固定（docs/product/spec.md §5-4）。
 *
 * サイドバーの語が正本で、各画面の見出しはこれと同じ語を使う。
 * ここで止めておかないと、画面を直すたびに少しずつ別の呼び名が増える。
 */
describe("メニューの用語", () => {
  const allLabels = (["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER", "EMPLOYEE"] as const).flatMap((r) =>
    navGroupsFor(r).flatMap((g) => [...(g.title ? [g.title] : []), ...g.items.map((i) => i.label)]),
  );

  it.each([
    ["評価サイクル"],
    ["採点の基準"],
    ["マスタ"],
    ["フォーム"],
    ["（1〜6）"],
  ])("使わないことにした語«%s»がメニューに出ていない", (word) => {
    expect(allLabels.filter((l) => l.includes(word))).toEqual([]);
  });

  it("同じ画面（/manager/cycles）は、どのロールでも同じ語で呼ぶ", () => {
    const labels = (["COMPANY_ADMIN", "MANAGER"] as const).map(
      (r) => navGroupsFor(r).flatMap((g) => g.items).find((i) => i.href === "/manager/cycles")?.label,
    );
    expect(new Set(labels).size).toBe(1);
    expect(labels[0]).toBe("評価・結果を確認する");
  });
});

/**
 * ヘッダーの階層表示（いまどこを開いているか）。
 *
 * 画面名の正本は ROUTE_META 1箇所だけ。画面側で「社員 →」のような文字列を
 * 書き起こすと、呼び名を変えたときに直し漏れが出る。
 */
describe("いま開いている画面の呼び名", () => {
  const APP = join(process.cwd(), "src", "app");

  /** src/app の中の page.tsx から、実際に存在するURLの形を集める。 */
  function routesUnder(dir: string, prefix = ""): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (!statSync(p).isDirectory()) continue;
      // (group) のような括弧つきはURLに出ない
      const seg = name.startsWith("(") ? "" : `/${name}`;
      const here = `${prefix}${seg}`;
      if (readdirSync(p).includes("page.tsx")) out.push(here === "" ? "/" : here);
      out.push(...routesUnder(p, here));
    }
    return out;
  }

  /* 画面の骨格（AppShell）の外にあるURL。階層表示を出さないので呼び名を持たない。 */
  const OUTSIDE_SHELL = [
    "/", // ロール別のホームへ振り分けるだけ
    "/login",
    "/f/[token]", // ログインしない人が開く1枚だけのアンケート
    "/admin/masters/kpi-categories", // KPI・評価セットへ送るだけ
  ];

  it("骨格の中の画面には、すべて呼び名が付いている", () => {
    const missing = routesUnder(APP)
      .filter((r) => !OUTSIDE_SHELL.includes(r))
      .filter((r) => !ROUTE_META.some((m) => m.pattern === r));
    expect(missing).toEqual([]);
  });

  it("対応表に、いまは無いURLが残っていない", () => {
    const actual = new Set(routesUnder(APP));
    expect(ROUTE_META.filter((m) => !actual.has(m.pattern)).map((m) => m.pattern)).toEqual([]);
  });

  it("手順の呼び名は scheme-steps と同じ語を使う（2箇所で言い換えない）", () => {
    expect(routeMetaOf("/admin/scheme/Chief")?.label).toBe(stepTitle("select"));
    expect(routeMetaOf("/admin/scheme/Chief/criteria")?.label).toBe(stepTitle("criteria"));
  });

  it("動的な部分は、名前ではなく種類の呼び名を出す（見出しと二重に読ませない）", () => {
    expect(routeMetaOf("/admin/members/u_123")?.label).toBe("社員1人");
    expect(routeMetaOf("/system/users/u_123")?.label).toBe("利用者1人");
  });

  it("決まった名前の画面を、動的な画面と取り違えない", () => {
    // /admin/members/policy は /admin/members/[id] の形にも当たってしまう
    expect(routeMetaOf("/admin/members/policy")?.label).toBe("本人が変更できる項目");
    expect(resolveTrail("/admin/members/policy", "COMPANY_ADMIN").at(-1)?.label).toBe("本人が変更できる項目");
  });
});

describe("階層表示の組み立て", () => {
  it("ホームでは1段だけ（自分の名前を分類の下にぶら下げない）", () => {
    expect(resolveTrail("/admin", "COMPANY_ADMIN")).toEqual([{ label: "ホーム", href: "/admin" }]);
  });

  it("ホームはロールごとの入口を指す", () => {
    expect(resolveTrail("/criteria", "MANAGER")[0]).toEqual({ label: "ホーム", href: "/manager" });
    expect(resolveTrail("/criteria", "COMPANY_ADMIN")[0]).toEqual({ label: "ホーム", href: "/admin" });
  });

  it("サイドバーの分類が2段目に入る（どの区画にいるかが分かる）", () => {
    const trail = resolveTrail("/admin/members", "COMPANY_ADMIN");
    expect(trail.map((s) => s.label)).toEqual(["ホーム", "人を管理する", "社員"]);
    // 分類は開ける場所ではないので、押せる段にしない
    expect(trail[1].href).toBeUndefined();
  });

  it("いまの画面は押せない段にし、途中の段は押せる段にする", () => {
    const trail = resolveTrail("/admin/members/u_1", "COMPANY_ADMIN");
    expect(trail.map((s) => s.label)).toEqual(["ホーム", "人を管理する", "社員", "社員1人"]);
    expect(trail[2].href).toBe("/admin/members");
    expect(trail[3].href).toBeUndefined();
  });

  it("深い画面でも、上の階層をすべてたどれる", () => {
    const trail = resolveTrail("/admin/scheme/Chief/criteria", "COMPANY_ADMIN");
    expect(trail.map((s) => s.label)).toEqual([
      "ホーム",
      "制度を順番に設定する",
      "KPI・評価セット",
      "使うKPIを選ぶ",
      "選んだ項目の基準を決める",
    ]);
    expect(trail[3].href).toBe("/admin/scheme/Chief");
  });

  it("開いても何も無い中継のURLは段にしない", () => {
    const trail = resolveTrail("/manager/evaluations/ev_1", "MANAGER");
    expect(trail.map((s) => s.label)).toEqual(["ホーム", "評価1件"]);
  });

  it("知らないURLでは、当てずっぽうの呼び名を作らない", () => {
    expect(resolveTrail("/admin/nowhere", "COMPANY_ADMIN").map((s) => s.label)).toEqual(["ホーム"]);
  });
});

describe("検索で出す画面", () => {
  it("その人のメニューに出ている画面だけを候補にする", () => {
    const hrefs = searchableScreens("EMPLOYEE").map((s) => s.href);
    expect(hrefs.some((h) => h.startsWith("/admin"))).toBe(false);
    expect(hrefs).toContain("/me/forms");
  });

  it("候補には分類名も付ける（同じ語の画面を見分けられるように）", () => {
    const hit = searchableScreens("COMPANY_ADMIN").find((s) => s.href === "/admin/members");
    expect(hit?.group).toBe("人を管理する");
  });
});
