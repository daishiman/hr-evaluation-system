import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { KpiItemEditor, kpiItemIdFromHash, openableItem, type KpiItemRow } from "@/components/KpiItemEditor";

/* 比べる警告の「聞き方を決める」から来たとき（kpiItemPath。DD-012・DD-016）の描き方を確かめる。
   保存の入口はサーバーの処理を読み込むので、描くのに要らない部分だけ差し替える */
vi.mock("@/lib/use-refresh", () => ({ useSaveAction: () => ({ save: vi.fn(), saving: false }) }));
vi.mock("@/components/master-request", () => ({
  masterRequest: vi.fn(),
  masterSave: (input: unknown) => input,
  masterDelete: (kind: unknown, id: unknown) => ({ kind, id }),
}));

const row = (id: string, no: number, name: string, extra: Partial<KpiItemRow> = {}): KpiItemRow => ({
  id,
  no,
  name,
  categoryId: null,
  categoryName: null,
  measureType: "個人実績",
  unit: "%",
  direction: "higher",
  formula: null,
  formulaNote: null,
  remarks: null,
  isMonetary: false,
  isProvisional: false,
  isActive: true,
  isFixedSlot: false,
  asking: { questions: [], formula: "", readonlyReason: null },
  keySetLockedBy: null,
  ...extra,
});

const ITEMS = [
  row("kpi_fixed", 1, "等級要件達成率", { isFixedSlot: true }),
  row("kpi_a", 2, "稼働率"),
  row("kpi_b", 3, "残業率", { direction: "lower" }),
];

const render = (openItemId?: string | null) =>
  renderToStaticMarkup(createElement(KpiItemEditor, { items: ITEMS, categories: [], usage: {}, openItemId })).replace(
    /<!-- -->/g,
    "",
  );

/** id の行の中身（次の行の手前まで） */
const rowHtml = (html: string, id: string) => {
  const start = html.indexOf(`id="kpi-item-${id}"`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = html.indexOf('id="kpi-item-', start + 1);
  return html.slice(start, next < 0 ? undefined : next);
};

describe("項目を指して開く（聞き方を決める から来たとき）", () => {
  it("どの行にも、URL の # で飛べる id がある", () => {
    const html = render();
    for (const id of ["kpi_fixed", "kpi_a", "kpi_b"]) expect(html).toContain(`id="kpi-item-${id}"`);
  });

  it("指された項目だけを、入力欄を開いた状態で描く", () => {
    const html = render("kpi_b");
    const opened = rowHtml(html, "kpi_b");
    expect(opened).toContain('value="残業率"');
    expect(opened).toContain("保存する");
    expect(opened).not.toContain("内容を直す");
    const other = rowHtml(html, "kpi_a");
    expect(other).toContain("内容を直す");
    expect(other).not.toContain('value="稼働率"');
  });

  it("指されなければ、どの行も開かない", () => {
    const html = render();
    expect(html).not.toContain("保存する");
    expect(html.match(/内容を直す/g)).toHaveLength(2);
  });

  it("固定枠や無い項目を指されても、どの行も開かない", () => {
    for (const id of ["kpi_fixed", "kpi_missing"]) {
      const html = render(id);
      expect(html).not.toContain("保存する");
      expect(html).not.toContain('value="等級要件達成率"');
    }
  });
});

/* 画面を開いたまま別の項目を指されたとき（?item= が変わる・# だけが変わる）も、同じ線引きで開く。
   描き直しの state の動きはブラウザの試験（e2e/forms-audit.spec.ts）で見て、ここでは開く項目の決め方を見る */
describe("開いたまま別の項目を指されたとき", () => {
  it("開けるのは固定枠でない、ある項目だけ", () => {
    expect(openableItem(ITEMS, "kpi_b")?.name).toBe("残業率");
    expect(openableItem(ITEMS, "kpi_fixed")).toBeNull();
    expect(openableItem(ITEMS, "kpi_missing")).toBeNull();
    expect(openableItem(ITEMS, null)).toBeNull();
  });

  it("# から項目を読む。kpiItemPath の書き方の # だけを拾い、ほかの # や壊れた値は何も指さない", () => {
    expect(kpiItemIdFromHash("#kpi-item-kpi_b")).toBe("kpi_b");
    expect(kpiItemIdFromHash("#kpi-item-kpi%20b")).toBe("kpi b");
    expect(kpiItemIdFromHash("#kpi-item-")).toBeNull();
    expect(kpiItemIdFromHash("#grade-requirement-gr_1")).toBeNull();
    expect(kpiItemIdFromHash("")).toBeNull();
    expect(kpiItemIdFromHash("#kpi-item-%E0%A4%A")).toBeNull();
  });
});
