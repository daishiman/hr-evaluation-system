"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { fitsOnA3 } from "@/lib/report-print-layout";

/** 空の図を印刷しない。遅延読込した紙用の SVG とフォントがそろってから印刷する。 */
async function prepareReportForPrint(): Promise<void> {
  const deadline = Date.now() + 15_000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("fonts")), 15_000); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  while (Date.now() < deadline) {
    const report = document.querySelector(".report");
    const charts = report?.querySelectorAll(".report-chart-print");
    if (report && charts && Array.from(charts).every((chart) => chart.querySelector("svg.recharts-surface"))) {
      // SVG の DOM 挿入だけでなく、ブラウザが描画を終えたフレームまで待つ。
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("charts");
}

export function ReportPrintControls() {
  const [paper, setPaper] = useState("A4");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<"preparation" | "overflow" | null>(null);
  useEffect(() => {
    document.documentElement.dataset.reportPaper = paper;
    return () => { delete document.documentElement.dataset.reportPaper; };
  }, [paper]);

  async function print(asPaper = paper) {
    setPending(true);
    setError(null);
    try {
      // A4への回復操作でも、この印刷から選択した用紙を使う。
      document.documentElement.dataset.reportPaper = asPaper;
      setPaper(asPaper);
      await prepareReportForPrint();
      const report = document.querySelector(".report");
      if (asPaper === "A3" && report && !(await fitsOnA3(report))) {
        setError("overflow");
        return;
      }
      window.print();
    } catch {
      setError("preparation");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="no-print">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sub">
          <label htmlFor="report-paper">用紙</label>
          <select id="report-paper" className="input" value={paper} disabled={pending} onChange={(event) => setPaper(event.target.value)}>
            <option value="A4">A4 縦（区切りで改ページ）</option>
            <option value="A3">A3 横（1枚にまとめる）</option>
          </select>
        </div>
        <Button type="button" variant="tertiary" disabled={pending} onClick={() => print()}>
          {pending ? "印刷の準備中…" : error ? "もう一度印刷する" : "印刷する"}
        </Button>
      </div>
      {pending && <p className="footnote m-0 mt-2" role="status">グラフと文字を準備しています。</p>}
      {error === "preparation" && <p className="footnote m-0 mt-2" role="alert">グラフか文字の準備が間に合いませんでした。もう一度印刷するか、画面を読み直してください。</p>}
      {error === "overflow" && <div role="alert" className="mt-2">
        <p className="footnote m-0">内容がA3の1枚を超えています。A4なら全文を印刷できます。</p>
        <Button type="button" variant="tertiary" disabled={pending} onClick={() => print("A4")}>A4で全文を印刷する</Button>
      </div>}
      <p className="footnote m-0 mt-2">URLや日時が出る場合は、印刷設定の「ヘッダーとフッター」をオフにします。</p>
    </div>
  );
}
