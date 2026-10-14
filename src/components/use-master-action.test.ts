import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  states: [] as unknown[],
  cursor: 0,
  saving: false,
  save: vi.fn(),
  useSaveAction: vi.fn(),
  masterRequest: vi.fn(),
}));

vi.mock("react", () => ({
  useState: (initial: unknown) => {
    const index = mocks.cursor++;
    if (!(index in mocks.states)) mocks.states[index] = initial;
    return [mocks.states[index], (value: unknown) => { mocks.states[index] = value; }];
  },
}));
vi.mock("@/lib/use-refresh", () => ({ useSaveAction: mocks.useSaveAction }));
vi.mock("@/components/master-request", () => ({
  masterRequest: mocks.masterRequest,
  masterSave: (input: unknown) => ({ op: "save", input }),
  masterDelete: (kind: string, id: string) => ({ op: "delete", input: { kind, id } }),
}));

import { useMasterAction } from "./use-master-action";

function render(kind: "gradeRequirement" | "promotionRequirement" | "behaviorGuideline" | "behaviorBandSet" = "gradeRequirement") {
  mocks.cursor = 0;
  return useMasterAction(kind);
}

describe("useMasterAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.states = [];
    mocks.saving = false;
    mocks.useSaveAction.mockImplementation(() => ({ save: mocks.save, saving: mocks.saving }));
  });

  it("描画完了を待つ保存経路を使い、完了前に成功を返さない", async () => {
    let resolve!: (value: { ok: true; message: string }) => void;
    mocks.save.mockReturnValue(new Promise((done) => { resolve = done; }));
    const hook = render();
    let returned = false;
    const pending = hook.send({ kind: "gradeRequirementRevise", id: "r", text: "新版" })
      .then((ok) => { returned = true; return ok; });
    expect(mocks.useSaveAction).toHaveBeenCalledWith(mocks.masterRequest, { resource: "masters" });
    expect(mocks.save).toHaveBeenCalledWith({ op: "save", input: { kind: "gradeRequirementRevise", id: "r", text: "新版" } });
    await Promise.resolve();
    expect(returned).toBe(false);
    expect(render().message).toBeNull();
    resolve({ ok: true, message: "保存しました。" });
    expect(await pending).toBe(true);
    expect(render()).toMatchObject({ message: "保存しました。", error: null });
  });

  it.each(["gradeRequirement", "promotionRequirement", "behaviorGuideline", "behaviorBandSet"] as const)("%sの削除拒否理由を保持し、次の送信で消す", async (kind) => {
    mocks.save.mockResolvedValueOnce({ ok: false, message: "使用中のため消せません。" });
    expect(await render(kind).remove("r")).toBe(false);
    expect(mocks.save).toHaveBeenCalledWith({ op: "delete", input: { kind, id: "r" } });
    expect(render(kind)).toMatchObject({ error: "使用中のため消せません。", message: null });
    mocks.save.mockResolvedValueOnce({ ok: true, message: "削除しました。" });
    const pending = render(kind).remove("r");
    expect(render(kind)).toMatchObject({ error: null, message: null });
    expect(await pending).toBe(true);
    expect(render(kind)).toMatchObject({ error: null, message: "削除しました。" });
  });

  it("保存失敗はfalseを返し、入力を閉じる成功条件を満たさない", async () => {
    mocks.save.mockResolvedValueOnce({ ok: true, message: "保存しました。" });
    await render().send({});
    mocks.save.mockResolvedValueOnce({ ok: false, message: "保存できません。" });
    expect(await render().send({})).toBe(false);
    expect(render()).toMatchObject({ error: "保存できません。", message: null });
    mocks.saving = true;
    expect(render().saving).toBe(true);
  });

  it.each([true, false])("並べ替えは描画完了まで一覧を無効化せず、結果%sのあと通常の保存状態に戻る", async (ok) => {
    let resolve!: (value: { ok: boolean; message: string }) => void;
    mocks.save.mockReturnValue(new Promise((done) => { resolve = done; }));
    const pending = render().sendOrder({ kind: "gradeRequirementOrder", ids: ["b", "a"] });
    mocks.saving = true;
    expect(render()).toMatchObject({ saving: true, reordering: true, message: null });
    expect(mocks.save).toHaveBeenCalledWith({ op: "save", input: { kind: "gradeRequirementOrder", ids: ["b", "a"] } });
    resolve({ ok, message: ok ? "並べ替えました。" : "保存できません。" });
    expect(await pending).toBe(ok);
    expect(render()).toMatchObject({ reordering: false });
    // 通常の内容保存はfieldsetを止める（並べ替えだけがフォーカス維持の例外）。
    expect(render().saving && !render().reordering).toBe(true);
  });

  it.each([true, false])("新しい入力を始めると結果%sの通知を消し、送信はしない", async (ok) => {
    mocks.save.mockResolvedValueOnce({ ok, message: ok ? "保存しました。" : "保存できません。" });
    await render("behaviorBandSet").send({ kind: "behaviorBandSet", name: "新しい基準" });
    expect(render("behaviorBandSet")[ok ? "message" : "error"]).not.toBeNull();
    mocks.save.mockClear();
    render("behaviorBandSet").clearResult();
    expect(render("behaviorBandSet")).toMatchObject({ message: null, error: null });
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
