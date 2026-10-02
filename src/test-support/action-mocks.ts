import { vi } from "vitest";
import type { Role, Viewer } from "@/lib/session";

/**
 * Server Action の統合テストで使う差し替え。
 *
 * vi.mock の factory は import より前へ巻き上げられるので、ここの関数は factory の中で
 * 動的 import して呼ぶ。
 *   vi.mock("@/lib/session", async () =>
 *     (await import("@/test-support/action-mocks")).sessionAs(() => mocked.viewer));
 */

/** 役割が足りないときの言い方（本物の apiViewer と同じ文）。 */
export const FORBIDDEN_MESSAGE = "この操作を行う権限がありません。";

/**
 * ログイン中の人だけを current() に差し替えた @/lib/session。
 *
 * 役割が足りるかは本物の atLeast で決め、断るときも本物の HttpError を投げる。
 * 役割の順位をテストに書き写すと、本物の順位を変えてもテストだけ古い順位のまま通ってしまう。
 * 別のサイトからの送信を断る確認（assertSameOrigin）は通らないので、src/lib/action-origin.test.ts が受け持つ。
 */
export async function sessionAs(current: () => Viewer) {
  const actual = await vi.importActual<typeof import("@/lib/session")>("@/lib/session");
  return {
    ...actual,
    apiViewer: async (min: Role = "EMPLOYEE") => {
      const viewer = current();
      if (!actual.atLeast(viewer.role, min)) throw new actual.HttpError(403, FORBIDDEN_MESSAGE);
      return viewer;
    },
  };
}
