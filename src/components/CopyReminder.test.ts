import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CopyReminderView } from "./CopyReminder";

const render = (result: "idle" | "copied" | "manual") =>
  renderToStaticMarkup(createElement(CopyReminderView, { text: "催促文", result, onCopy: vi.fn() }));

describe("未回答者への連絡文コピー", () => {
  it("成功時は成功案内だけを表示する", () => {
    const html = render("copied");
    expect(html).toContain("コピーしました");
    expect(html).not.toContain("自動でコピーできませんでした");
  });

  it("成功後に失敗しても失敗案内だけとなり、文面を開いて手動コピーできる", () => {
    const html = render("manual");
    expect(html).not.toContain("コピーしました");
    expect(html).toContain("自動でコピーできませんでした");
    expect(html).toContain("<details");
    expect(html).toContain(" open=\"\"");
    expect(html).toContain('role="alert"');
  });

  it("読み取り専用の文面欄にも、読み上げられる名前がある", () => {
    expect(render("idle")).toContain('aria-label="未回答者への連絡文"');
  });

  it("コピーのボタンは本文と同じ行の右端（SplitRow の補足）に置き、読む順は URL → 文面の確認 → コピー のまま（§28-9）", () => {
    const html = renderToStaticMarkup(
      createElement(CopyReminderView, {
        text: "催促文",
        result: "idle",
        onCopy: vi.fn(),
        lead: createElement("span", null, "回答画面のURL"),
      }),
    );
    const aside = html.indexOf('class="split-aside"');
    expect(html).toContain('class="split-row"');
    expect(aside).toBeGreaterThan(-1);
    expect(html.indexOf("未回答の方への連絡文をコピーする")).toBeGreaterThan(aside);
    expect(html.indexOf("回答画面のURL")).toBeLessThan(html.indexOf("送る文面を確認する"));
    expect(html.indexOf("送る文面を確認する")).toBeLessThan(aside);
  });
});
