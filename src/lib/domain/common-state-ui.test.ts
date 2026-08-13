import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = new URL("../../app/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, app), "utf8");

describe("全画面共通の待機・失敗・権限状態", () => {
  it("画面移動中は内容を読み込んでいることを伝える", () => {
    expect(existsSync(new URL("loading.tsx", app))).toBe(true);
    const source = read("loading.tsx");
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("画面を読み込んでいます");
  });

  it("予期しない失敗は再試行とホームへの回復導線を出す", () => {
    expect(existsSync(new URL("error.tsx", app))).toBe(true);
    const source = read("error.tsx");
    expect(source).toContain("reset()");
    expect(source).toContain('href="/"');
    expect(source).toContain("もう一度読み込む");
  });

  it("権限がない可能性を含む404は、一覧とホームへ戻れる", () => {
    const source = read("not-found.tsx");
    expect(source).toContain("前の画面へ戻る");
    expect(source).toContain("ホームへ戻る");
  });
});
