import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SetupGapList } from "./SetupGapList";
import type { SetupGap } from "@/lib/domain/setup-gaps";

const gap = (n: number): SetupGap => ({
  what: `足りないもの${n}`,
  how: `直し方${n}`,
  href: `/admin/scheme/g${n}`,
  linkLabel: `直す画面${n}`,
});

describe("SetupGapList", () => {
  it("1件ごとに、何が足りないか・どう直すか・直す画面へのリンクを並べる", () => {
    const html = renderToStaticMarkup(
      createElement(SetupGapList, { gaps: [gap(1)], title: "公開する前に、次の設定が必要です" }),
    );

    expect(html).toContain("公開する前に、次の設定が必要です");
    expect(html).toContain("足りないもの1");
    expect(html).toContain("直し方1");
    expect(html).toContain('href="/admin/scheme/g1"');
    expect(html).toContain("直す画面1");
    expect(html).not.toContain("<details");
  });

  it("初めの3件だけを見せ、残りは開いて見る", () => {
    const html = renderToStaticMarkup(createElement(SetupGapList, { gaps: [1, 2, 3, 4, 5].map(gap) }));
    const details = html.slice(html.indexOf("<details"));

    expect(html).toContain("残り2件を見る");
    for (const n of [1, 2, 3]) expect(details).not.toContain(`足りないもの${n}`);
    for (const n of [4, 5]) expect(details).toContain(`足りないもの${n}`);
  });

  it("その場で直せる操作と補足は、一覧のあとに添える", () => {
    const html = renderToStaticMarkup(
      createElement(
        SetupGapList,
        { gaps: [gap(1)], action: createElement("button", null, "作り直す") },
        createElement("p", null, "補足の説明"),
      ),
    );

    expect(html.indexOf("足りないもの1")).toBeLessThan(html.indexOf("補足の説明"));
    expect(html.indexOf("補足の説明")).toBeLessThan(html.indexOf("作り直す"));
  });

  it("不足が無ければ何も出さない", () => {
    expect(renderToStaticMarkup(createElement(SetupGapList, { gaps: [] }))).toBe("");
  });
});
