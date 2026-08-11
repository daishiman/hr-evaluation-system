import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * 配布用URLの組み立て。
 *
 * ここが壊れると「開けないURLを管理者が配る」という形で外に出る。
 * しかも配った本人には気づけない（自分は画面から開けるため）ので、テストで固定する。
 */

const headerMap = new Map<string, string>();
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (k: string) => headerMap.get(k) ?? null }),
}));

const { appOrigin, formUrl } = await import("./origin");

/* cf-typegen が wrangler.jsonc の vars から型を作るため、process.env.APP_ORIGIN は
   「本番のURLという1つの文字列」型になる。テストでは別の値を入れたい（本番のURLが
   たまたま正しいから通った、という状態にしたくない）ので、ここだけ緩めて扱う。 */
const env = process.env as Record<string, string | undefined>;

afterEach(() => {
  headerMap.clear();
  delete env.APP_ORIGIN;
});

describe("appOrigin", () => {
  it("APP_ORIGIN があればそれを使う（Host ヘッダーは呼び出し側が細工できるため）", async () => {
    env.APP_ORIGIN = "https://hr.example.com";
    headerMap.set("host", "attacker.example.net");
    expect(await appOrigin()).toBe("https://hr.example.com");
  });

  it("APP_ORIGIN の末尾の / は落とす（// で始まると別ホストへのURLになるため）", async () => {
    env.APP_ORIGIN = "https://hr.example.com//";
    expect(formUrl(await appOrigin(), "abc")).toBe("https://hr.example.com/f/abc");
  });

  it("設定が無ければ実際のホストから組み立てる（本番・プレビュー・ローカルで自動的に変わる）", async () => {
    headerMap.set("x-forwarded-proto", "http");
    headerMap.set("host", "localhost:3000");
    expect(await appOrigin()).toBe("http://localhost:3000");
  });

  it("proto が無いときは https とみなす", async () => {
    headerMap.set("host", "hr-evaluation-system.workers.dev");
    expect(await appOrigin()).toBe("https://hr-evaluation-system.workers.dev");
  });

  it("ホストも設定も無いときは空文字（誤ったドメインを勝手に作らない）", async () => {
    expect(await appOrigin()).toBe("");
  });
});

describe("formUrl", () => {
  it("トークンから回答画面のURLを作る", () => {
    expect(formUrl("https://hr.example.com", "sakura-2026h1-beginner")).toBe(
      "https://hr.example.com/f/sakura-2026h1-beginner",
    );
  });
});
