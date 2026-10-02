import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const m = {
    pending: false,
    /** false にすると、transition の更新を画面へ反映（commit）しないまま止めておける */
    autoCommit: true,
    routerRefresh: vi.fn(),
    startTransition: vi.fn((run: () => void) => run()),
    announceChange: vi.fn(),
    recordActionCall: vi.fn(),
    /** 登録された useLayoutEffect と、それが返した後片付け */
    layoutEffects: [] as (() => void | (() => void))[],
    cleanups: [] as (() => void)[],
    /** 画面への反映を模す: 登録された layout effect を走らせる */
    commit() {
      for (const effect of m.layoutEffects) {
        const cleanup = effect();
        if (cleanup) m.cleanups.push(cleanup);
      }
    },
    /** 部品が消えたときを模す: 後片付けを走らせる */
    unmount() {
      for (const cleanup of m.cleanups.splice(0)) cleanup();
    },
  };
  return m;
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.routerRefresh }),
}));

vi.mock("react", () => ({
  useCallback: <T>(callback: T) => callback,
  useTransition: () => [mocks.pending, mocks.startTransition] as const,
  useState: <S>(init: S | (() => S)) => [
    typeof init === "function" ? (init as () => S)() : init,
    () => {
      if (mocks.autoCommit) mocks.commit();
    },
  ],
  useLayoutEffect: (effect: () => void | (() => void)) => {
    mocks.layoutEffects.push(effect);
  },
}));

vi.mock("@/lib/freshness", () => ({ announceChange: mocks.announceChange }));
vi.mock("@/lib/usage-client", () => ({ recordActionCall: mocks.recordActionCall }));

import {
  createCommitGate,
  failureMessageOf,
  NETWORK_FAILURE_MESSAGE,
  STALE_PAGE_MESSAGE,
  useReadAction,
  useRouterRefresh,
  useSaveAction,
} from "@/lib/use-refresh";

describe("useRouterRefresh", () => {
  beforeEach(() => {
    mocks.pending = false;
    mocks.routerRefresh.mockClear();
    mocks.startTransition.mockClear();
  });

  it("画面の再取得を transition に載せる", () => {
    const { refresh } = useRouterRefresh();

    refresh();

    expect(mocks.startTransition).toHaveBeenCalledOnce();
    expect(mocks.routerRefresh).toHaveBeenCalledOnce();
  });
});

describe("useSaveAction（画面からの保存）", () => {
  beforeEach(() => {
    mocks.pending = false;
    mocks.autoCommit = true;
    mocks.layoutEffects = [];
    mocks.cleanups = [];
    mocks.startTransition.mockClear();
    mocks.announceChange.mockClear();
    mocks.recordActionCall.mockClear();
  });

  it("結果は、応答の新しい画面が描き終わるまで返さない（成功の言葉を古い一覧の上に出さない）", async () => {
    mocks.autoCommit = false;
    const { save } = useSaveAction(async () => ({ ok: true as const, message: "保存しました。" }), {
      resource: "companies",
    });

    let returned = false;
    const pending = save({}).then((r) => {
      returned = true;
      return r;
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(returned).toBe(false);
    // 応答の結果と「描き終わり」の印は、どちらも transition に載っている
    expect(mocks.startTransition).toHaveBeenCalledTimes(2);

    mocks.commit();
    expect(await pending).toEqual({ ok: true, message: "保存しました。" });
  });

  it("保存の結果で部品ごと消えても、呼び出し元を待たせたままにしない", async () => {
    mocks.autoCommit = false;
    const { save } = useSaveAction(async () => ({ ok: true as const, message: "削除しました。" }), {
      resource: "members",
    });
    mocks.commit(); // 初めて描かれたとき（後片付けを登録する）

    const pending = save({});
    await new Promise((r) => setTimeout(r, 0));
    mocks.unmount();

    expect(await pending).toEqual({ ok: true, message: "削除しました。" });
  });

  it("保存を transition に載せ、成功したら他のタブへ知らせて利用回数に数える", async () => {
    const action = vi.fn(async (input: { name: string }) => ({ ok: true as const, message: "保存しました。", id: input.name }));
    const { save } = useSaveAction(action, { resource: "members" });

    const result = await save({ name: "a" });

    expect(result).toEqual({ ok: true, message: "保存しました。", id: "a" });
    expect(mocks.startTransition).toHaveBeenCalled();
    expect(mocks.announceChange).toHaveBeenCalledWith("members");
    expect(mocks.recordActionCall).toHaveBeenCalledWith("members", expect.any(Number), true);
  });

  it.each(["success", "failure", "network"] as const)("応答前に画面を離れても結果を返す（%s）", async (kind) => {
    mocks.autoCommit = false;
    let respond!: (result: { ok: true; message: string } | { ok: false; message: string }) => void;
    let reject!: (error: Error) => void;
    const response = new Promise<{ ok: true; message: string } | { ok: false; message: string }>((resolve, fail) => {
      respond = resolve;
      reject = fail;
    });
    const { save } = useSaveAction(() => response, { resource: "responses" });
    mocks.commit();
    const pending = save({});
    mocks.unmount();
    mocks.startTransition.mockClear();

    if (kind === "network") reject(new TypeError("Failed to fetch"));
    else respond({ ok: kind === "success", message: "応答" });

    await expect(pending).resolves.toEqual({
      ok: kind === "success",
      message: kind === "network" ? NETWORK_FAILURE_MESSAGE : "応答",
    });
    // 消えた部品には、描き終わりの印を追加しない。
    expect(mocks.startTransition).not.toHaveBeenCalled();
  });

  it("断られた保存は知らせず、失敗として数える", async () => {
    const { save } = useSaveAction(async () => ({ ok: false as const, message: "権限がありません。" }), {
      resource: "members",
    });

    expect(await save({})).toEqual({ ok: false, message: "権限がありません。" });
    expect(mocks.announceChange).not.toHaveBeenCalled();
    expect(mocks.recordActionCall).toHaveBeenCalledWith("members", expect.any(Number), false);
  });

  it("送信そのものが失敗しても例外にせず、直し方の言葉で返す", async () => {
    const { save } = useSaveAction(
      async () => {
        throw new TypeError("Failed to fetch");
      },
      { resource: "forms" },
    );

    expect(await save({})).toEqual({ ok: false, message: NETWORK_FAILURE_MESSAGE });
    expect(mocks.recordActionCall).toHaveBeenCalledWith("forms", expect.any(Number), false);
  });

  it("保存中かどうかを saving として返す", () => {
    const action = async () => ({ ok: true as const, message: "" });
    expect(useSaveAction(action, { resource: "members" }).saving).toBe(false);
    mocks.pending = true;
    expect(useSaveAction(action, { resource: "members" }).saving).toBe(true);
  });
});

describe("createCommitGate（描き終わりまで結果を待たせる関所）", () => {
  it("終了後の応答も解除し、effect の再設定後は再び commit を待つ", () => {
    const gate = createCommitGate();
    const before = vi.fn();
    const after = vi.fn();
    const reopened = vi.fn();
    gate.wait(before);
    gate.close();
    expect(gate.wait(after)).toBe(false);
    expect(before).toHaveBeenCalledOnce();
    expect(after).toHaveBeenCalledOnce();

    gate.open();
    expect(gate.wait(reopened)).toBe(true);
    expect(reopened).not.toHaveBeenCalled();
    gate.release();
    expect(reopened).toHaveBeenCalledOnce();
  });
  it("release までは渡さず、release で待っていた全員に1回ずつ渡す", () => {
    const gate = createCommitGate();
    const a = vi.fn();
    const b = vi.fn();
    gate.wait(a);
    gate.wait(b);
    expect(a).not.toHaveBeenCalled();

    gate.release();
    gate.release();

    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });
});

describe("useReadAction（読み出しだけの呼び出し）", () => {
  beforeEach(() => {
    mocks.pending = false;
    mocks.autoCommit = true;
    mocks.layoutEffects = [];
    mocks.cleanups = [];
    mocks.announceChange.mockClear();
    mocks.recordActionCall.mockClear();
  });

  it("何も変えていないので、成功しても他のタブへは知らせない", async () => {
    const { read } = useReadAction(async () => ({ ok: true as const, message: "確認しました。", created: 2 }), {
      resource: "members",
    });

    expect(await read({})).toEqual({ ok: true, message: "確認しました。", created: 2 });
    expect(mocks.announceChange).not.toHaveBeenCalled();
    expect(mocks.recordActionCall).toHaveBeenCalledWith("members", expect.any(Number), true);
  });

  it("読み出し中かどうかを reading として返す", () => {
    const action = async () => ({ ok: true as const, message: "" });
    expect(useReadAction(action, { resource: "members" }).reading).toBe(false);
    mocks.pending = true;
    expect(useReadAction(action, { resource: "members" }).reading).toBe(true);
  });
});

describe("failureMessageOf", () => {
  it("公開し直して宛先が変わった画面には、読み直しを案内する", () => {
    expect(failureMessageOf(new Error('Failed to find Server Action "abc"'))).toBe(STALE_PAGE_MESSAGE);
    expect(failureMessageOf(new Error("An unexpected response was received from the server."))).toBe(
      STALE_PAGE_MESSAGE,
    );
  });

  it("それ以外は通信を確かめてもう一度押す案内にする", () => {
    expect(failureMessageOf(new TypeError("Failed to fetch"))).toBe(NETWORK_FAILURE_MESSAGE);
    expect(failureMessageOf("offline")).toBe(NETWORK_FAILURE_MESSAGE);
  });

  it("画面に出す言葉は1文40文字以内に収める", () => {
    for (const message of [NETWORK_FAILURE_MESSAGE, STALE_PAGE_MESSAGE]) {
      for (const sentence of message.split("。").filter(Boolean)) expect(sentence.length).toBeLessThanOrEqual(40);
    }
  });
});
