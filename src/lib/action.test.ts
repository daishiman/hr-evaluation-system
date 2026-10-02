import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  apiViewer: vi.fn(),
  rethrow: vi.fn(),
}));

vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("next/navigation", () => ({ unstable_rethrow: mocks.rethrow }));
vi.mock("@/lib/session", async () => {
  class HttpError extends Error {
    constructor(
      readonly status: number,
      message: string,
      readonly responseHeaders?: HeadersInit,
    ) {
      super(message);
    }
  }
  return { HttpError, apiViewer: mocks.apiViewer };
});

import { payloadBytes, runAction, runRead } from "@/lib/action";
import { HttpError } from "@/lib/session";

const viewer = { id: "u1", role: "COMPANY_ADMIN", companyId: "co1" };
const input = z.object({ name: z.string().min(1, "名前を入れてください") });

describe("runAction（画面からの保存の共通の包み）", () => {
  beforeEach(() => {
    mocks.refresh.mockClear();
    mocks.rethrow.mockClear();
    mocks.apiViewer.mockReset();
    mocks.apiViewer.mockResolvedValue(viewer);
  });

  it("成功したら表示中の画面を描き直し、言葉と戻り値を返す", async () => {
    const result = await runAction({ role: "COMPANY_ADMIN", input }, { name: "山" }, async ({ viewer: v, input: i }) => ({
      id: `${v.id}:${i.name}`,
      message: "作りました。",
    }));

    expect(result).toEqual({ ok: true, message: "作りました。", id: "u1:山" });
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.apiViewer).toHaveBeenCalledWith("COMPANY_ADMIN");
  });

  it("言葉を返さない書き込みは「保存しました。」にそろえる", async () => {
    const result = await runAction({ role: "EMPLOYEE", input }, { name: "a" }, async () => ({}));
    expect(result).toEqual({ ok: true, message: "保存しました。" });
  });

  it("入力の形が違えば書き込まず、描き直さず、直し方を返す", async () => {
    const write = vi.fn();
    const result = await runAction({ role: "EMPLOYEE", input }, { name: "" }, write);

    expect(result).toEqual({ ok: false, message: "入力内容を確認してください（name：名前を入れてください）" });
    expect(write).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("権限が無ければ入力を読む前に止める", async () => {
    mocks.apiViewer.mockRejectedValue(new HttpError(403, "この操作を行う権限がありません。"));
    const parse = vi.spyOn(input, "parse");

    const result = await runAction({ role: "SUPER_ADMIN", input }, { name: "a" }, vi.fn());

    expect(result).toEqual({ ok: false, message: "この操作を行う権限がありません。" });
    expect(parse).not.toHaveBeenCalled();
    parse.mockRestore();
  });

  it("書き込み中の失敗は言葉を返し、描き直さない", async () => {
    const result = await runAction({ role: "EMPLOYEE", input }, { name: "a" }, async () => {
      throw new HttpError(400, "このメールアドレスはすでに登録されています。");
    });
    expect(result).toEqual({ ok: false, message: "このメールアドレスはすでに登録されています。" });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("想定外の失敗は中身を見せず、決まった言葉にする", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await runAction({ role: "EMPLOYEE", input }, { name: "a" }, async () => {
      throw new Error("D1_ERROR: secret detail");
    });
    expect(result).toEqual({ ok: false, message: "処理中に問題が発生しました。時間をおいて試してください。" });
    spy.mockRestore();
  });

  it("Next.js の合図（redirect など）は投げ直しに回す", async () => {
    const signal = new Error("NEXT_REDIRECT");
    mocks.rethrow.mockImplementation((e: unknown) => {
      if (e === signal) throw e;
    });
    await expect(
      runAction({ role: "EMPLOYEE", input }, { name: "a" }, async () => {
        throw signal;
      }),
    ).rejects.toBe(signal);
  });

  it("上限を超える入力は読まずに断る", async () => {
    const write = vi.fn();
    const result = await runAction(
      { role: "EMPLOYEE", input, maxBytes: 10, tooLargeMessage: "大きすぎます。" },
      { name: "あいうえお" },
      write,
    );
    expect(result).toEqual({ ok: false, message: "大きすぎます。" });
    expect(write).not.toHaveBeenCalled();
  });
});

describe("runRead（読み出しだけの口）", () => {
  beforeEach(() => {
    mocks.refresh.mockClear();
    mocks.apiViewer.mockResolvedValue(viewer);
  });

  it("画面を描き直さずに値を返す", async () => {
    const result = await runRead({ role: "COMPANY_ADMIN", input }, { name: "a" }, async () => ({
      password: "secret",
      message: "控えを開きました。",
    }));
    expect(result).toEqual({ ok: true, message: "控えを開きました。", password: "secret" });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

describe("payloadBytes", () => {
  it("JSONに直したときの UTF-8 のバイト数で数える", () => {
    expect(payloadBytes({ a: "あ" })).toBe(new TextEncoder().encode('{"a":"あ"}').byteLength);
    expect(payloadBytes(undefined)).toBe(4);
  });
});
