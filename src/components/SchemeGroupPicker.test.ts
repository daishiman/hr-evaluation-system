import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { GradePointRule } from "@/lib/domain/grade-points";

/*
 * 使うKPIを選ぶの候補に付ける札「設問なし」（spec §1・DD-012 の4）。
 * 札の有無は askableItemIds だけで決まる。比べる警告の表と同じ字面（NO_TEMPLATE_BADGE）を使う。
 * SSR の描画試験なので、保存と画面遷移はモックで止める。
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }) }));
vi.mock("@/actions/scheme", () => ({ saveScheme: async () => ({ ok: true, message: "", warnings: [] }) }));

import { SchemeGroupPicker } from "./SchemeGroupPicker";

const RULE: GradePointRule = {
  pointGroup: "Regular",
  totalPoints: 40,
  fixedSlotPoints: 20,
  majorSlotPoints: 0,
  majorSlotCount: 0,
  minorSlotPoints: 10,
  minorSlotCount: 2,
};

const item = (id: string, name: string, isFixedSlot = false) => ({
  id,
  no: 1,
  name,
  unit: "%",
  categoryId: isFixedSlot ? null : "cat_1",
  isFixedSlot,
  isProvisional: false,
  intent: null,
  aStandard: null,
});

const KPI_ITEMS = [item("kpi_fixed", "等級要件達成率", true), item("kpi_a", "稼働率"), item("kpi_b", "粗利率")];

function render(askableItemIds: string[]) {
  return renderToStaticMarkup(
    createElement(SchemeGroupPicker, {
      schemeId: "sch_1",
      updatedAt: 0,
      pointGroup: "Regular",
      groupLabel: "一般",
      gradeNames: ["一般"],
      rule: RULE,
      ratedItemIds: ["kpi_fixed", "kpi_a", "kpi_b"],
      askableItemIds,
      initial: [
        { kpiItemId: "kpi_fixed", isFixedSlot: true, isMajorSlot: false },
        { kpiItemId: "kpi_a", isFixedSlot: false, isMajorSlot: false },
        { kpiItemId: "kpi_b", isFixedSlot: false, isMajorSlot: false },
      ],
      categories: [{ id: "cat_1", name: "生産性", description: null }],
      kpiItems: KPI_ITEMS,
      criteriaPath: "/admin/scheme/Regular/criteria",
    }),
  ).replace(/<!-- -->/g, "");
}

const BADGE = '<span class="badge badge-required ui-mark">設問なし</span>';

describe("使うKPIを選ぶの候補: 実績の聞き方（設問のひな形）が決まっていない項目", () => {
  it("聞き方の無い候補にだけ札「設問なし」を付け、選んだ時点で、決める場所を添えて警告する", () => {
    const html = render(["kpi_a"]);
    expect(html.split(BADGE)).toHaveLength(2);
    expect(html).toMatch(new RegExp(`粗利率 <span class="badge badge-done ui-mark">選択中</span> ${BADGE}`));
    expect(html).toContain("「粗利率」は、実績の聞き方がまだ決まっていません。");
    expect(html).toContain("その項目の「内容を直す」を押してください。");
    // 聞き方のある項目と、等級要件の設問から数える固定枠は名指ししない
    expect(html).not.toContain("「稼働率」は");
    expect(html).not.toContain("「等級要件達成率」は");
  });

  it("どの候補も聞き方が決まっていれば、札も警告も出さない", () => {
    const html = render(["kpi_a", "kpi_b"]);
    expect(html).not.toContain("設問なし");
    expect(html).not.toContain("実績の聞き方がまだ決まっていません");
  });
});
