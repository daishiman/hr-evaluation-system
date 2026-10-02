import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COMPENSATION_FAILED_MESSAGE, rollForward, withCompensation } from "@/lib/compensation";
import { HttpError } from "@/lib/session";

describe("withCompensation（途中で失敗したら書いた分を消す）", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    error = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
    error.mockRestore();
  });

  it("全部成功したら何も消さず、最後の値を返す", async () => {
    const undo = vi.fn();
    const result = await withCompensation("op", {}, async (step) => {
      const a = await step("a", async () => 1, undo);
      const b = await step("b", async () => a + 1, undo);
      return b * 10;
    });
    expect(result).toBe(20);
    expect(undo).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("失敗したら、成功した手順だけを逆の順に取り消し、元の失敗を投げ直す", async () => {
    const order: string[] = [];
    const original = new HttpError(400, "このメールアドレスはすでに登録されています。");

    await expect(
      withCompensation("company.create", { companyId: "co1" }, async (step) => {
        await step("company", async () => "co1", async (id) => order.push(`company:${id}`));
        await step("masters", async () => 3, async (n) => order.push(`masters:${n}`));
        await step(
          "user",
          async () => {
            throw original;
          },
          async () => order.push("user"),
        );
      }),
    ).rejects.toBe(original);

    // 失敗した手順（user）の取り消しは呼ばない。書けていないものは消さない
    expect(order).toEqual(["masters:3", "company:co1"]);

    const logged = JSON.parse(String(warn.mock.calls[0]?.[0]));
    expect(logged).toMatchObject({
      event: "compensation_applied",
      operation: "company.create",
      failed_step: "user",
      undone: ["masters", "company"],
      leftovers: [],
      ids: { companyId: "co1" },
    });
  });

  it("取り消しが失敗しても残りの取り消しは続け、残った手順をログに書いて管理者への連絡を促す", async () => {
    const order: string[] = [];

    const failure = withCompensation("company.create", { companyId: "co1", userId: "u1" }, async (step) => {
      await step("company", async () => null, async () => order.push("company"));
      await step(
        "masters",
        async () => null,
        async () => {
          throw new Error("D1 busy");
        },
      );
      await step(
        "account",
        async () => {
          throw new Error("insert failed");
        },
        async () => {},
      );
    });

    await expect(failure).rejects.toMatchObject({ status: 500, message: COMPENSATION_FAILED_MESSAGE });
    expect(order).toEqual(["company"]);

    const failed = JSON.parse(String(error.mock.calls[0]?.[0]));
    expect(failed).toEqual({
      event: "compensation_failed",
      operation: "company.create",
      step: "masters",
      ids: { companyId: "co1", userId: "u1" },
      error: "D1 busy",
    });
    const summary = JSON.parse(String(warn.mock.calls[0]?.[0]));
    expect(summary).toMatchObject({ leftovers: ["masters"], undone: ["company"], failed_step: "account" });
  });

  it("画面に出す言葉は1文40文字以内に収める", () => {
    for (const sentence of COMPENSATION_FAILED_MESSAGE.split("。").filter(Boolean)) {
      expect(sentence.length).toBeLessThanOrEqual(40);
    }
  });
});

describe("rollForward（戻せない書き込みの続きを、前へ進めて揃える）", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    error = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
    error.mockRestore();
  });

  it("1回目で済めば、やり直さずログも出さない", async () => {
    const write = vi.fn(async () => {});
    expect(await rollForward("account.password", { userId: "u1" }, write)).toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("1回目が失敗しても、やり直して済めば true（やり直したことは warn で残す）", async () => {
    const write = vi.fn().mockRejectedValueOnce(new Error("D1 busy")).mockResolvedValueOnce(undefined);
    expect(await rollForward("account.password", { userId: "u1" }, write)).toBe(true);
    expect(write).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(warn.mock.calls[0]?.[0]))).toMatchObject({ event: "rollforward_retry" });
    expect(error).not.toHaveBeenCalled();
  });

  it("2回とも失敗したら false を返し、何が残ったかを error で1行残す", async () => {
    const write = vi.fn().mockRejectedValue(new Error("D1 down"));
    expect(await rollForward("account.password", { userId: "u1" }, write)).toBe(false);
    expect(write).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(error.mock.calls[0]?.[0]))).toEqual({
      event: "rollforward_failed",
      operation: "account.password",
      ids: { userId: "u1" },
      error: "D1 down",
    });
  });
});
