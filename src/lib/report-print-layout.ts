/** 画面用DOMを変えず、同じCSS・SVG・文字で紙面に収まるか測る（外部送信なし）。 */
export async function fitsOnA3(report: Element, signal: AbortSignal): Promise<boolean> {
  // Give navigation and input a turn before walking styles and cloning the report.
  await waitForIdle(signal);
  const rulesAsPrint = (rules: CSSRuleList): string => Array.from(rules, (rule) => {
    if (rule instanceof CSSMediaRule && rule.conditionText.includes("print")) return rulesAsPrint(rule.cssRules);
    if (rule instanceof CSSGroupingRule && !(rule instanceof CSSStyleRule)) {
      return `${rule.cssText.slice(0, rule.cssText.indexOf("{"))}{${rulesAsPrint(rule.cssRules)}}`;
    }
    return rule.cssText;
  }).join("\n");
  const styles = Array.from(document.styleSheets, (sheet) => rulesAsPrint(sheet.cssRules)).join("\n");
  const frame = document.createElement("iframe");
  frame.title = "印刷の紙面確認";
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:420mm;height:297mm;visibility:hidden;border:0";
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument;
    if (!doc) throw new Error("print layout");
    doc.open();
    doc.write("<!doctype html><html><head></head><body></body></html>");
    doc.close();
    doc.documentElement.dataset.reportPaper = "A3";
    const style = doc.createElement("style");
    style.textContent = styles;
    doc.head.appendChild(style);
    const copy = report.cloneNode(true) as HTMLElement;
    doc.body.appendChild(copy);
    await waitFor(doc.fonts.ready, signal, 3000, "print fonts");
    signal.throwIfAborted();
    // mmを同じ描画環境で測る。描画・紙面の換算値を別々に持たない。
    const paper = doc.createElement("div");
    paper.style.cssText = "position:absolute;width:420mm;height:297mm";
    doc.body.appendChild(paper);
    const bounds = paper.getBoundingClientRect();
    return copy.getBoundingClientRect().height <= bounds.height + 1 && copy.scrollWidth <= bounds.width + 1;
  } finally {
    frame.remove();
  }
}


/** Font/chart preparation starts on screen entry; it never opens a print dialog. */
export async function prepareReportForPrint(report: Element, signal: AbortSignal): Promise<void> {
  const deadline = Date.now() + 15_000;
  await waitFor(document.fonts.ready, signal, 15_000, "fonts");
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    if (Array.from(report.querySelectorAll(".report-chart-print")).every((chart) => chart.querySelector("svg.recharts-surface"))) {
      await nextFrame(signal);
      await nextFrame(signal);
      return;
    }
    await delay(50, signal);
  }
  throw new Error("charts");
}

function waitFor<T>(promise: PromiseLike<T>, signal: AbortSignal, timeout: number, message: string): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); };
    const abort = () => { cleanup(); reject(signal.reason); };
    const timer = setTimeout(() => { cleanup(); reject(new Error(message)); }, timeout);
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(promise).then((value) => { cleanup(); resolve(value); }, (error) => { cleanup(); reject(error); });
  });
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return scheduled(signal, (done) => {
    const id = setTimeout(done, ms);
    return () => clearTimeout(id);
  });
}

function nextFrame(signal: AbortSignal): Promise<void> {
  return scheduled(signal, (done) => {
    const id = requestAnimationFrame(done);
    return () => cancelAnimationFrame(id);
  });
}

function waitForIdle(signal: AbortSignal): Promise<void> {
  if (typeof requestIdleCallback !== "function") return delay(0, signal);
  return scheduled(signal, (done) => {
    const id = requestIdleCallback(done, { timeout: 200 });
    return () => cancelIdleCallback(id);
  });
}

function scheduled(signal: AbortSignal, schedule: (done: () => void) => () => void): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => { cancel(); signal.removeEventListener("abort", abort); reject(signal.reason); };
    const cancel = schedule(() => { signal.removeEventListener("abort", abort); resolve(); });
    signal.addEventListener("abort", abort, { once: true });
  });
}
