import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** 同じブラウザの別タブを模した BroadcastChannel。送った本人には届かない。 */
class FakeChannel {
  static all: FakeChannel[] = [];
  listeners: ((e: MessageEvent) => void)[] = [];
  constructor(readonly name: string) {
    FakeChannel.all.push(this);
  }
  postMessage(data: unknown) {
    for (const other of FakeChannel.all) {
      if (other === this || other.name !== this.name) continue;
      for (const l of other.listeners) l({ data } as MessageEvent);
    }
  }
  addEventListener(_: string, l: (e: MessageEvent) => void) {
    this.listeners.push(l);
  }
  removeEventListener(_: string, l: (e: MessageEvent) => void) {
    this.listeners = this.listeners.filter((x) => x !== l);
  }
}

async function load() {
  vi.resetModules();
  return import("@/lib/freshness");
}

describe("他のタブへの知らせ", () => {
  beforeEach(() => {
    FakeChannel.all = [];
    vi.stubGlobal("BroadcastChannel", FakeChannel);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("保存の知らせは他のタブに届き、送ったタブ自身には届かない", async () => {
    const f = await load();
    const own = vi.fn();
    f.subscribeChanges(own);

    const otherTab = new FakeChannel(f.FRESHNESS_CHANNEL);
    const received: unknown[] = [];
    otherTab.addEventListener("message", (e) => received.push(e.data));

    f.announceChange("members", 123);

    expect(received).toEqual([{ kind: "saved", resource: "members", at: 123 }]);
    expect(own).not.toHaveBeenCalled();
  });

  it("他のタブからの知らせを受け取り、形の違うものは捨てる", async () => {
    const f = await load();
    const got = vi.fn();
    const stop = f.subscribeChanges(got);

    const otherTab = new FakeChannel(f.FRESHNESS_CHANNEL);
    otherTab.postMessage({ kind: "saved", resource: "forms", at: 1 });
    otherTab.postMessage({ kind: "other" });
    otherTab.postMessage("text");

    expect(got).toHaveBeenCalledOnce();
    expect(got).toHaveBeenCalledWith({ kind: "saved", resource: "forms", at: 1 });

    stop();
    otherTab.postMessage({ kind: "saved", resource: "forms", at: 2 });
    expect(got).toHaveBeenCalledOnce();
  });

  it("BroadcastChannel が無い環境でも保存の流れを止めない", async () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const f = await load();
    expect(() => f.announceChange("members")).not.toThrow();
    const stop = f.subscribeChanges(vi.fn());
    expect(() => stop()).not.toThrow();
  });
});

describe("throttleTrailing（取り直しの間引き）", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("最初の1回はすぐ呼び、間隔の中の呼び出しは間隔が明けたところで1回にまとめる", async () => {
    const { throttleTrailing } = await load();
    let now = 0;
    const fn = vi.fn();
    const call = throttleTrailing(fn, 1000, () => now);

    call();
    expect(fn).toHaveBeenCalledTimes(1);

    now = 200;
    call();
    now = 400;
    call();
    expect(fn).toHaveBeenCalledTimes(1);

    now = 1000;
    vi.advanceTimersByTime(800);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("止めると、待っていた呼び出しは捨てる", async () => {
    const { throttleTrailing } = await load();
    let now = 0;
    const fn = vi.fn();
    const call = throttleTrailing(fn, 1000, () => now);
    call();
    now = 10;
    call();
    call.cancel();
    vi.advanceTimersByTime(2000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("今すぐ呼ぶと、待っていた呼び出しをそこへまとめ、そこから間隔を数え直す", async () => {
    const { throttleTrailing } = await load();
    let now = 0;
    const fn = vi.fn();
    const call = throttleTrailing(fn, 1000, () => now);
    call();
    now = 10;
    call();
    call.now();
    expect(fn).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(2000);
    expect(fn).toHaveBeenCalledTimes(2);
    // 最初の呼び出し（0）からなら間隔は明けているが、今すぐ呼んだ時刻（10）からはまだ
    now = 1005;
    call();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("watchFreshness（取り直すきっかけの見張り）", () => {
  class FakeDocument extends EventTarget {
    visibilityState: DocumentVisibilityState = "visible";
  }

  function setup() {
    const host = { document: new FakeDocument(), window: new EventTarget() };
    const refresh = vi.fn();
    return { host, refresh };
  }

  function pageShow(persisted: boolean): Event {
    return Object.assign(new Event("pageshow"), { persisted });
  }

  beforeEach(() => {
    FakeChannel.all = [];
    vi.stubGlobal("BroadcastChannel", FakeChannel);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("bfcache から戻ったときは、ルーターが画面を戻し終えた後に取り直す（先に取り直すと捨てられる）", async () => {
    const f = await load();
    const { host, refresh } = setup();
    const order: string[] = [];
    refresh.mockImplementation(() => order.push("取り直し"));
    f.watchFreshness(refresh, host);
    // Next.js のルーターの見張りは、骨格（子）より後に登録される
    host.window.addEventListener("pageshow", () => order.push("ルーターが戻す"));

    host.window.dispatchEvent(pageShow(true));
    expect(order).toEqual(["ルーターが戻す"]);

    vi.advanceTimersByTime(0);
    expect(order).toEqual(["ルーターが戻す", "取り直し"]);
  });

  it("表に戻った直後に bfcache から戻っても、戻し終えた後の取り直しを間引きで待たせない", async () => {
    const f = await load();
    const { host, refresh } = setup();
    const order: string[] = [];
    refresh.mockImplementation(() => order.push("取り直し"));
    f.watchFreshness(refresh, host);
    host.window.addEventListener("pageshow", () => order.push("ルーターが戻す"));
    const afterRestore = () => order.slice(order.indexOf("ルーターが戻す"));

    // ブラウザは bfcache から戻すとき、表に戻した（visibilitychange）後に pageshow を送る
    host.document.dispatchEvent(new Event("visibilitychange"));
    host.window.dispatchEvent(pageShow(true));
    vi.advanceTimersByTime(0);
    expect(afterRestore()).toEqual(["ルーターが戻す", "取り直し"]);

    // 間隔が明けても、同じきっかけで取り直しを重ねない
    vi.advanceTimersByTime(f.FRESHNESS_THROTTLE_MS);
    expect(afterRestore()).toEqual(["ルーターが戻す", "取り直し"]);
  });

  it("ふつうに開いたときの pageshow（persisted でない）では取り直さない", async () => {
    const f = await load();
    const { host, refresh } = setup();
    f.watchFreshness(refresh, host);

    host.window.dispatchEvent(pageShow(false));
    vi.advanceTimersByTime(0);

    expect(refresh).not.toHaveBeenCalled();
  });

  it("表に戻ったとき・通信が戻ったときに取り直す。裏に回ったときは取り直さない", async () => {
    const f = await load();
    const { host, refresh } = setup();
    f.watchFreshness(refresh, host);

    host.document.visibilityState = "hidden";
    host.document.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).not.toHaveBeenCalled();

    host.document.visibilityState = "visible";
    host.document.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(f.FRESHNESS_THROTTLE_MS);
    host.window.dispatchEvent(new Event("online"));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("他のタブの知らせは、裏にいる間は取り直さず、表に出ているときは取り直す", async () => {
    const f = await load();
    const { host, refresh } = setup();
    f.watchFreshness(refresh, host);
    const otherTab = new FakeChannel(f.FRESHNESS_CHANNEL);

    host.document.visibilityState = "hidden";
    otherTab.postMessage({ kind: "saved", resource: "companies", at: 1 });
    expect(refresh).not.toHaveBeenCalled();

    host.document.visibilityState = "visible";
    otherTab.postMessage({ kind: "saved", resource: "companies", at: 2 });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("見張りをやめると、待っていた取り直しも捨てる", async () => {
    const f = await load();
    const { host, refresh } = setup();
    const stop = f.watchFreshness(refresh, host);

    host.window.dispatchEvent(pageShow(true));
    stop();
    vi.advanceTimersByTime(f.FRESHNESS_THROTTLE_MS);
    host.document.dispatchEvent(new Event("visibilitychange"));

    expect(refresh).not.toHaveBeenCalled();
  });
});
