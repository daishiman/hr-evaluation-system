import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FieldGroup } from "@/components/ui";
import { stripComments } from "@/test-support/source-code";

/**
 * 保存中にまとめて止める入力の束は FieldGroup だけで作る（DD-017）。
 *
 * fieldset の直下に子が出入りし、同じフレームで中の size container の中身が変わると、
 * Chromium（148・153）は container の中身を描かない。2026-10-16 に「＋ 聞くことを追加」を
 * 1回押すと追加の行ごと消える形で見つかった。FieldGroup は中身を div 1つで包み、
 * 出入りを div の中に閉じ込める。生の <fieldset> を書くと、この包みが抜ける。
 */

const SRC = join(process.cwd(), "src");
const OWNER = join(SRC, "components", "ui.tsx");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("入力の束（FieldGroup）", () => {
  it("生の <fieldset> は ui.tsx の FieldGroup の外に書かない", () => {
    const offenders = walk(SRC)
      .filter((p) => p.endsWith(".tsx") && !p.includes(".test.") && p !== OWNER)
      .filter((p) => /<fieldset[\s>]/.test(stripComments(readFileSync(p, "utf8"))))
      .map((p) => p.replace(`${SRC}/`, ""));
    expect(offenders).toEqual([]);
  });

  it("中身は div 1つで包み、legend だけを直下に置く", () => {
    const html = renderToStaticMarkup(
      createElement(FieldGroup, {
        legend: "実績の聞き方",
        className: "mt-4",
        bodyClassName: "stack",
        disabled: true,
        "aria-busy": true,
        children: createElement(Fragment, null, createElement("p", null, "一"), createElement("p", null, "二")),
      }),
    );
    expect(html).toBe(
      '<fieldset disabled="" aria-busy="true" class="m-0 min-w-0 border-0 p-0 mt-4">' +
        '<legend class="p-0 text-sub font-bold">実績の聞き方</legend>' +
        '<div class="stack"><p>一</p><p>二</p></div>' +
        "</fieldset>",
    );
  });

  it("legend が無ければ、直下は包みの div 1つだけになる", () => {
    const html = renderToStaticMarkup(createElement(FieldGroup, { children: createElement("p", null, "一") }));
    expect(html).toBe('<fieldset class="m-0 min-w-0 border-0 p-0"><div><p>一</p></div></fieldset>');
  });
});
