import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pending: false,
  routerRefresh: vi.fn(),
  startTransition: vi.fn((run: () => void) => run()),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.routerRefresh }),
}));

vi.mock("react", () => ({
  useCallback: <T>(callback: T) => callback,
  useTransition: () => [mocks.pending, mocks.startTransition] as const,
}));

import { useRefreshAfterSave } from "@/lib/use-refresh";

describe("useRefreshAfterSave", () => {
  beforeEach(() => {
    mocks.pending = false;
    mocks.routerRefresh.mockClear();
    mocks.startTransition.mockClear();
  });

  it("画面の再取得を transition に載せる", () => {
    const { refresh } = useRefreshAfterSave();

    refresh();

    expect(mocks.startTransition).toHaveBeenCalledOnce();
    expect(mocks.routerRefresh).toHaveBeenCalledOnce();
  });

  it("transition の完了待ちを refreshing として返す", () => {
    expect(useRefreshAfterSave().refreshing).toBe(false);

    mocks.pending = true;

    expect(useRefreshAfterSave().refreshing).toBe(true);
  });
});
