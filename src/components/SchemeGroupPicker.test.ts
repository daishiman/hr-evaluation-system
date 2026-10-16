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

const BADGE = '<span class="badge badge-required">設問なし</span>';

describe("使うKPIを選ぶの候補: 設問のひな形の無い項目", () => {
  it("ひな形の無い候補にだけ札「設問なし」を付け、選んだ時点で警告する", () => {
    const html = render(["kpi_a"]);
    expect(html.split(BADGE)).toHaveLength(2);
    expect(html).toMatch(new RegExp(`粗利率 <span class="badge badge-done">選択中</span> ${BADGE}`));
    expect(html).toContain("「粗利率」には、実績を聞く設問のひな形がありません。");
    // ひな形のある項目と、等級要件の設問から数える固定枠は名指ししない
    expect(html).not.toContain("「稼働率」には");
    expect(html).not.toContain("「等級要件達成率」には");
  });

  it("どの候補にもひな形があれば、札も警告も出さない", () => {
    const html = render(["kpi_a", "kpi_b"]);
    expect(html).not.toContain("設問なし");
    expect(html).not.toContain("設問のひな形がありません");
  });
});
