import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const app = new URL("../../app/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, app), "utf8");

/** 中身を描く画面。ここには待機表示を置く。 */
const CONTENT_HOMES = ["me", "admin", "manager", "system"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("全画面共通の待機・失敗・権限状態", () => {
  it("画面移動中は内容を読み込んでいることを伝える", () => {
    for (const home of CONTENT_HOMES) {
      expect(existsSync(new URL(`${home}/loading.tsx`, app)), `${home}/loading.tsx`).toBe(true);
      expect(read(`${home}/loading.tsx`)).toContain("PageLoading");
    }
    const shared = readFileSync(new URL("../components/ui.tsx", app), "utf8");
    expect(shared).toContain('aria-live="polite"');
    expect(shared).toContain("画面を読み込んでいます");
  });

  /**
   * これを外すと、2026-08-14 に本番が止まったのと同じ状態に戻る。
   *
   * src/app 直下に loading.tsx を置くと全画面が「まず200で待機表示を返す」形になり、
   * 一度200を送った後からは307へ変えられないので、redirect() が本文に埋め込んだ
   * 指示に降格する。実行がブラウザ側のJS任せになり、リダイレクトするだけの
   * / と /login が特定のブラウザで永久に待ち続けた。
   */
  it("リダイレクトするだけの画面に待機表示を掛けない（src/app 直下に loading.tsx を置かない）", () => {
    const appDir = fileURLToPath(app);
    const placed = walk(appDir)
      .filter((p) => p.endsWith("loading.tsx"))
      .map((p) => relative(appDir, p))
      .sort();

    // 置いてよい場所を数え上げで固定する。増やすときは、その階層の page.tsx が
    // 本当に中身を描いているか（redirect() するだけでないか）を確かめてから足すこと。
    expect(placed, "loading.tsx を置いてよいのは中身を描く画面の配下だけです").toEqual(
      CONTENT_HOMES.map((home) => join(home, "loading.tsx")).sort(),
    );
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
