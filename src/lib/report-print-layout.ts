/** 画面用DOMを変えず、同じCSS・SVG・文字で紙面に収まるか測る（外部送信なし）。 */
export async function fitsOnA3(report: Element): Promise<boolean> {
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
  let timer: ReturnType<typeof setTimeout> | undefined;
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
    await Promise.race([
      doc.fonts.ready,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("print fonts")), 3000); }),
    ]);
    // mmを同じ描画環境で測る。描画・紙面の換算値を別々に持たない。
    const paper = doc.createElement("div");
    paper.style.cssText = "position:absolute;width:420mm;height:297mm";
    doc.body.appendChild(paper);
    const bounds = paper.getBoundingClientRect();
    return copy.getBoundingClientRect().height <= bounds.height + 1 && copy.scrollWidth <= bounds.width + 1;
  } finally {
    clearTimeout(timer);
    frame.remove();
  }
}
