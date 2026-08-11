import { describe, expect, it } from "vitest";
import { assertFormContentEditable } from "./form-build";

describe("assertFormContentEditable（アンケート内容の版を守る）", () => {
  it("下書きは内容を変更できる", () => {
    expect(() => assertFormContentEditable({ status: "draft", title: "上期アンケート" })).not.toThrow();
  });

  it.each([
    ["published", "公開中"],
    ["closed", "締め切り済み"],
  ])("%s は既存版を変えず、新しい版へ案内する", (status, stateLabel) => {
    expect(() => assertFormContentEditable({ status, title: "上期アンケート" })).toThrow(
      new RegExp(`${stateLabel}.*新しい版`),
    );
  });

  it("未知の状態もfail-closedにする", () => {
    expect(() => assertFormContentEditable({ status: "unexpected", title: "上期アンケート" })).toThrow(
      /現在の状態.*新しい版/,
    );
  });
});
