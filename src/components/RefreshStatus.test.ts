import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RefreshStatus } from "@/components/RefreshStatus";

describe("保存後の反映状態", () => {
  it.each([
    { operation: "作成", target: "一覧", message: "作成しました。" },
    { operation: "更新", target: "画面", message: "更新しました。" },
    { operation: "削除", target: "一覧", message: "削除しました。" },
    { operation: "会社切替", target: "画面", message: "操作する会社を切り替えました。" },
  ])("$operation は反映中と完了後を区別する", ({ target, message }) => {
    const reflecting = renderToStaticMarkup(
      createElement(RefreshStatus, { message, refreshing: true, target }),
    );
    expect(reflecting).toContain('role="status"');
    expect(reflecting).toContain('aria-live="polite"');
    expect(reflecting).toContain('aria-busy="true"');
    expect(reflecting).toContain(message);
    expect(reflecting).toContain(`${target}に反映しています…`);

    const done = renderToStaticMarkup(
      createElement(RefreshStatus, { message, refreshing: false, target }),
    );
    expect(done).toContain('aria-busy="false"');
    expect(done).toContain(message);
    expect(done).not.toContain("反映しています");
  });

  it("完了文言がない場合も、反映中は無言にならない", () => {
    const html = renderToStaticMarkup(
      createElement(RefreshStatus, { message: null, refreshing: true, target: "一覧" }),
    );
    expect(html).toContain("一覧に反映しています…");
  });
});
