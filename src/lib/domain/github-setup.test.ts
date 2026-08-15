import { describe, expect, it } from "vitest";
import {
  GITHUB_TOKEN_LIST_URL,
  GITHUB_TOKEN_NEW_URL,
  GITHUB_TOKEN_PUT_COMMAND,
  githubTokenMissingMessage,
  githubTokenSetupLines,
} from "./github-setup";

describe("トークンを用意するための案内", () => {
  it("取得先と、発行済みの確認先を出す", () => {
    const lines = githubTokenSetupLines("acme/hr").join("\n");
    expect(lines).toContain(GITHUB_TOKEN_NEW_URL);
    expect(lines).toContain(GITHUB_TOKEN_LIST_URL);
  });

  it("対象リポジトリは設定値から受け取る（案内に書き写さない）", () => {
    expect(githubTokenSetupLines("acme/hr").join("\n")).toContain("acme/hr だけを選びます");
    expect(githubTokenSetupLines("other/repo").join("\n")).toContain("other/repo だけを選びます");
  });

  it("選ぶ権限と、値が一度しか出ないことを書く", () => {
    const lines = githubTokenSetupLines("acme/hr").join("\n");
    expect(lines).toContain("Issues");
    expect(lines).toContain("Read and write");
    expect(lines).toContain("No access");
    expect(lines).toContain("一度しか表示されません");
    expect(lines).toContain("期限を付けた場合");
    expect(lines).toContain(GITHUB_TOKEN_PUT_COMMAND);
  });

  it("1行目に何が起きたかを出し、2行目から手順にする", () => {
    const [head, ...steps] = githubTokenMissingMessage("acme/hr").split("\n");
    expect(head).toBe("GitHub の書き込み用トークンが未設定です。");
    expect(steps).toEqual(githubTokenSetupLines("acme/hr"));
  });

  it("URL を含む行は、URL だけを切り出せる形にする（画面で押せるようにするため）", () => {
    for (const line of githubTokenSetupLines("acme/hr")) {
      const parts = line.split(/(https:\/\/\S+)/);
      const urls = parts.filter((p) => p.startsWith("https://"));
      expect(urls.length).toBeLessThanOrEqual(1);
      expect(parts.join("")).toBe(line);
    }
  });
});
