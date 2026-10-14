import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ROLE_LABEL, ROLES } from "@/lib/session";
import { navGroupsFor } from "@/lib/nav";
import { permissionRows, type PermissionRow } from "@/lib/permission-rows";
import { PermissionMatrix } from "@/components/permissions/PermissionMatrix";

/*
 * 権限一覧の表とカード（S4・A4・D-006）。
 *
 * 行は台帳（system-spec/route-ledger.json）から1回だけ作り、表（768px 以上）とカード（768px 未満）は
 * 同じ行の配列から描く。だから中身が食い違うことはない、をここで固定する。
 * 可否は色だけに頼らず、記号（○・△・—）と言葉（できる・条件つき・できない）を並べる。
 */

const ledger = JSON.parse(readFileSync(path.join(process.cwd(), "system-spec/route-ledger.json"), "utf8")) as {
  routes: { path: string; label: string }[];
};

const MARK = { full: "○", conditional: "△", none: "—" } as const;
const WORD = { full: "できる", conditional: "条件つき", none: "できない" } as const;

const rows = permissionRows();

function render(initialRole?: (typeof ROLES)[number]): string {
  return renderToStaticMarkup(createElement(PermissionMatrix, { rows, initialRole }));
}

/** data-permission-row を持つ要素を、表の中とカードの中に分けて集める */
function rowsIn(html: string, container: "table" | "cards"): Map<string, string> {
  const start = container === "table" ? html.indexOf("<table") : html.indexOf('data-permission-cards="true"');
  expect(start, `${container} が描かれていない`).toBeGreaterThanOrEqual(0);
  const end = container === "table" ? html.indexOf("</table>", start) : html.length;
  const part = html.slice(start, end);
  const out = new Map<string, string>();
  const re = /data-permission-row="([^"]+)"/g;
  const hits = [...part.matchAll(re)];
  hits.forEach((m, i) => {
    const from = m.index ?? 0;
    const to = i + 1 < hits.length ? (hits[i + 1].index ?? part.length) : part.length;
    out.set(m[1], part.slice(from, to).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  });
  return out;
}

describe("行の作り方（permissionRows）", () => {
  it("台帳の全ページが1行ずつある（ログインの前の画面と、移動だけの古いURLは除く）", () => {
    const paths = rows.map((r: PermissionRow) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const route of ledger.routes) {
      const row = rows.find((r: PermissionRow) => r.path === route.path);
      if (row) expect(row.label).toBe(route.label);
    }
    expect(paths).toContain("/system/permissions");
    expect(paths).toContain("/system/agent-keys");
    expect(paths).not.toContain("/login");
  });

  it("行ごとに4つの役割の可否があり、条件つきの行には条件の説明がある", () => {
    for (const row of rows) {
      expect(Object.keys(row.byRole).sort()).toEqual([...ROLES].sort());
      for (const role of ROLES) expect(["full", "conditional", "none"]).toContain(row.byRole[role]);
      if (Object.values(row.byRole).includes("conditional")) expect(row.condition, row.path).toBeTruthy();
    }
  });

  it("サイドバーの区分の順に並ぶ（全体管理者のメニューの区分名を使う）", () => {
    const groupOrder = navGroupsFor("SUPER_ADMIN").map((g) => g.label);
    const seen = rows.map((r: PermissionRow) => r.group).filter((g, i, a) => a.indexOf(g) === i);
    const known = seen.filter((g) => groupOrder.includes(g));
    expect(known).toEqual(groupOrder.filter((g) => known.includes(g)));
  });

  it("Claude Code 連携の行は新しい名前で出る", () => {
    expect(rows.find((r: PermissionRow) => r.path === "/system/agent-keys")?.label).toBe(
      "Claude Code連携（システム開発者専用）",
    );
  });
});

describe("表とカード（PermissionMatrix）", () => {
  it("表とカードは同じ行を同じ順で出し、行ごとの文字も同じ", () => {
    const html = render();
    const table = rowsIn(html, "table");
    const cards = rowsIn(html, "cards");
    expect([...cards.keys()]).toEqual([...table.keys()]);
    expect([...table.keys()]).toEqual(rows.map((r: PermissionRow) => r.path));
    for (const [key, text] of table) {
      for (const word of Object.values(WORD)) {
        expect(text.split(word).length, `${key}: 「${word}」の数が表とカードで違う`).toBe(
          (cards.get(key) ?? "").split(word).length,
        );
      }
    }
  });

  it("可否は記号と言葉の両方で示す（色だけに頼らない）", () => {
    const html = render();
    for (const value of ["full", "conditional", "none"] as const) {
      expect(html).toContain(MARK[value]);
      expect(html).toContain(WORD[value]);
    }
    // 記号は読み上げから外し、言葉を読ませる
    expect(html).toMatch(/aria-hidden="true"[^>]*>[○△—]</);
  });

  it("列の見出しは4つの役割で、日本語の役割名を出す", () => {
    const html = render();
    const head = html.slice(html.indexOf("<thead"), html.indexOf("</thead>"));
    for (const role of ROLES) expect(head).toContain(ROLE_LABEL[role]);
  });

  it("役割のタブは tablist・tab・tabpanel で、選んだ役割のタブが aria-selected", () => {
    const html = render("MANAGER");
    expect(html).toContain('role="tablist"');
    expect((html.match(/role="tab"/g) ?? []).length).toBe(ROLES.length + 1);
    expect(html).toMatch(new RegExp(`role="tab"[^>]*aria-selected="true"[^>]*>[^<]*${ROLE_LABEL.MANAGER}`));
    expect(html).toContain('role="tabpanel"');
  });

  it("条件つきの可否には、条件の説明（InfoTip）が付く", () => {
    const html = render();
    const conditional = rows.find((r: PermissionRow) => Object.values(r.byRole).includes("conditional"));
    expect(conditional, "条件つきの行が台帳に1つも無い").toBeTruthy();
    expect(html).toContain(`${conditional!.label}の説明`);
  });
});
