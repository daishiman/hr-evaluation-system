import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

/*
 * 別のサイトから送られた書き込みを、二重に断る（ユーザー決定：今の二重の検査を試験で固定する）。
 *
 * 1枚目は Next.js の Server Action の検査（Origin と Host が違えば実行しない）。
 * next.config.ts に serverActions.allowedOrigins を足さない限り、この既定が効く。
 * 2枚目は runAction → apiViewer → assertSameOrigin。ここでは session を差し替えず、本物を通す。
 * どちらか一方が外れても、もう一方で止まる。
 */

const mocked = vi.hoisted(() => ({
  headers: new Headers(),
  getSession: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => mocked.headers,
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("next/cache", () => ({ refresh: mocked.refresh }));
vi.mock("@/lib/auth", () => ({ getAuth: async () => ({ api: { getSession: mocked.getSession } }) }));

import { runAction, runRead } from "@/lib/action";

const REJECTED = "この操作は受け付けられませんでした。画面を開き直してからもう一度お試しください。";
const input = z.object({ name: z.string() });

function request(fields: Record<string, string>) {
  mocked.headers = new Headers(fields);
}

beforeEach(() => {
  mocked.getSession.mockReset();
  // ログインしていない扱い。検査を通ったかどうかを「次の確認で止まったか」で見分ける
  mocked.getSession.mockResolvedValue(null);
  mocked.refresh.mockReset();
});

describe("runAction・runRead の入口で、送り元のサイトを確かめる", () => {
  it("別のサイトからの書き込みは、ログインを確かめる前に断り、書かず、描き直さない", async () => {
    request({ origin: "https://evil.example", host: "hyoka.example" });
    const write = vi.fn();

    const result = await runAction({ role: "EMPLOYEE", input }, { name: "a" }, write);

    expect(result).toEqual({ ok: false, message: REJECTED });
    expect(mocked.getSession).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(mocked.refresh).not.toHaveBeenCalled();
  });

  it("読み出しの口（runRead）も同じく断る（控えを開くなど、読むだけでも渡さない）", async () => {
    request({ origin: "https://evil.example", host: "hyoka.example" });
    const read = vi.fn();

    expect(await runRead({ role: "COMPANY_ADMIN", input }, { name: "a" }, read)).toEqual({
      ok: false,
      message: REJECTED,
    });
    expect(read).not.toHaveBeenCalled();
  });

  it("ポートだけ違うサイトも別のサイトとして断る", async () => {
    request({ origin: "http://localhost:3000", host: "localhost:8788" });
    expect(await runAction({ role: "EMPLOYEE", input }, { name: "a" }, vi.fn())).toEqual({
      ok: false,
      message: REJECTED,
    });
  });

  it("送り元が読めない（Origin: null など）ときも断る", async () => {
    request({ origin: "null", host: "hyoka.example" });
    expect(await runAction({ role: "EMPLOYEE", input }, { name: "a" }, vi.fn())).toEqual({
      ok: false,
      message: REJECTED,
    });
  });

  it("同じサイトからなら検査を通り、ログインの確認へ進む", async () => {
    request({ origin: "https://hyoka.example", host: "hyoka.example" });

    const result = await runAction({ role: "EMPLOYEE", input }, { name: "a" }, vi.fn());

    expect(result).toEqual({ ok: false, message: "ログインが必要です。" });
    expect(mocked.getSession).toHaveBeenCalledOnce();
  });

  it("Origin を付けない呼び出し（画面以外）は、この検査ではなくログインの確認で止まる", async () => {
    request({ host: "hyoka.example" });
    expect(await runAction({ role: "EMPLOYEE", input }, { name: "a" }, vi.fn())).toEqual({
      ok: false,
      message: "ログインが必要です。",
    });
  });
});

describe("Next.js 側の検査（1枚目）", () => {
  it("許すサイトを広げる設定（allowedOrigins）を足していない", () => {
    const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    expect(config).not.toContain("allowedOrigins");
  });
});
