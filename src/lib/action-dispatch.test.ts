import { describe, expect, it, vi } from "vitest";
import { dispatchAction } from "@/lib/action-dispatch";

type Request = { op: "save"; input: { name: string } } | { op: "delete"; input: { id: string } };

describe("dispatchAction（複数の Server Action を1つの入口にまとめる）", () => {
  it("op で選んだ action に input だけを渡し、結果をそのまま返す", async () => {
    const save = vi.fn(async () => ({ ok: true as const, message: "保存しました。" }));
    const remove = vi.fn(async () => ({ ok: false as const, message: "使われているので消せません。" }));
    const dispatch = dispatchAction<Request, object>({ save, delete: remove });

    expect(await dispatch({ op: "save", input: { name: "a" } })).toEqual({ ok: true, message: "保存しました。" });
    expect(await dispatch({ op: "delete", input: { id: "x" } })).toEqual({
      ok: false,
      message: "使われているので消せません。",
    });
    expect(save).toHaveBeenCalledExactlyOnceWith({ name: "a" });
    expect(remove).toHaveBeenCalledExactlyOnceWith({ id: "x" });
  });
});
