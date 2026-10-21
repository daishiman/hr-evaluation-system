import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareReportForPrint } from "./report-print-layout";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function reportWithCharts(hasSvg: () => boolean) {
  return { querySelectorAll: () => [{ querySelector: () => hasSvg() ? {} : null }] } as unknown as Element;
}

function setup(fontsReady: Promise<void> = Promise.resolve()) {
  vi.useFakeTimers();
  vi.stubGlobal("document", { fonts: { ready: fontsReady } });
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => setTimeout(callback, 16));
  vi.stubGlobal("cancelAnimationFrame", (id: ReturnType<typeof setTimeout>) => clearTimeout(id));
}

describe("印刷の背景準備", () => {
  it("フォントと紙用の図が揃った描画フレームで準備が終わる", async () => {
    setup();
    let svgReady = false;
    let complete = false;
    const task = prepareReportForPrint(reportWithCharts(() => svgReady), new AbortController().signal).then(() => { complete = true; });
    await vi.advanceTimersByTimeAsync(100);
    expect(complete).toBe(false);
    svgReady = true;
    await vi.advanceTimersByTimeAsync(100);
    await task;
    expect(complete).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("移動・中止時には未完了フォントを待たず終了しタイマーを残さない", async () => {
    setup(new Promise(() => {}));
    const controller = new AbortController();
    const task = prepareReportForPrint(reportWithCharts(() => true), controller.signal);
    const rejected = expect(task).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("図が揃わない場合も再試行できるよう15秒で失敗する", async () => {
    setup();
    const task = prepareReportForPrint(reportWithCharts(() => false), new AbortController().signal);
    const rejected = expect(task).rejects.toThrow("charts");
    await vi.advanceTimersByTimeAsync(15_000);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });
});
