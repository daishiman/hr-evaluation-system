"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { fitsOnA3, prepareReportForPrint } from "@/lib/report-print-layout";

type Preparation = "preparing" | "ready" | "error" | "overflow" | "cancelled";

export function ReportPrintControls() {
  const [paper, setPaper] = useState("A4");
  const [preparation, setPreparation] = useState<Preparation>("preparing");
  const [attempt, setAttempt] = useState(0);
  const prepared = useRef<Element | null>(null);
  const fitted = useRef<{ report: Element; fits: boolean } | null>(null);
  const current = useRef<{ report: Element; paper: string } | null>(null);
  const observer = useRef<MutationObserver | null>(null);
  const cancel = useRef<() => void>(() => {});
  const changed = useRef<(records: MutationRecord[]) => boolean>(() => false);

  useEffect(() => {
    document.documentElement.dataset.reportPaper = paper;
    return () => { delete document.documentElement.dataset.reportPaper; };
  }, [paper]);

  useEffect(() => {
    let controller: AbortController;
    let disposed = false;
    let report = document.querySelector(".report");
    changed.current = (records) => document.querySelector(".report") !== report || records.some((record) =>
      report?.contains(record.target) && !(record.target instanceof Element ? record.target : record.target.parentElement)?.closest(".report-chart-screen"));

    async function prepare() {
      controller?.abort();
      controller = new AbortController();
      const { signal } = controller;
      current.current = null;
      report = document.querySelector(".report");
      watch.disconnect();
      // Page-level observation only detects replacements; attribute/text observation
      // is confined to the report, so unrelated controls and hover do not wake us.
      watch.observe(document.body, { subtree: true, childList: true });
      if (report) watch.observe(report, { subtree: true, childList: true, characterData: true, attributes: true });
      setPreparation("preparing");
      try {
        if (!report) throw new Error("report");
        if (prepared.current !== report) {
          await prepareReportForPrint(report, signal);
          signal.throwIfAborted();
          prepared.current = report;
        }
        if (paper === "A3") {
          const fits = fitted.current?.report === report ? fitted.current.fits : await fitsOnA3(report, signal);
          signal.throwIfAborted();
          fitted.current = { report, fits };
          if (!fits) {
            setPreparation("overflow");
            return;
          }
        }
        signal.throwIfAborted();
        current.current = { report, paper };
        setPreparation("ready");
      } catch {
        if (!disposed && !signal.aborted) setPreparation("error");
      }
    }

    const watch = new MutationObserver((records) => {
      if (!changed.current(records)) return;
      prepared.current = null;
      fitted.current = null;
      void prepare();
    });
    observer.current = watch;
    // Controls live outside .report; a body child-list watch catches report replacement.
    cancel.current = () => {
      controller?.abort();
      watch.disconnect();
      prepared.current = null;
      fitted.current = null;
      current.current = null;
      setPreparation("cancelled");
    };
    void prepare();
    return () => {
      disposed = true;
      controller?.abort();
      watch.disconnect();
      observer.current = null;
      current.current = null;
    };
  }, [paper, attempt]);

  function print(asPaper = paper) {
    // A queued DOM mutation must invalidate the cache even before its observer runs.
    if (changed.current(observer.current?.takeRecords() ?? [])) {
      prepared.current = null;
      fitted.current = null;
      current.current = null;
      setAttempt((value) => value + 1);
      return;
    }
    const report = document.querySelector(".report");
    const ready = current.current;
    if (!report || (asPaper === "A4" ? prepared.current !== report : ready?.report !== report || ready.paper !== asPaper)) return;
    document.documentElement.dataset.reportPaper = asPaper;
    setPaper(asPaper);
    // Printing only happens in this explicit user action, never after background work.
    window.print();
  }

  return (
    <div className="no-print">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sub">
          <label htmlFor="report-paper">用紙</label>
          <select id="report-paper" className="input" value={paper} onChange={(event) => setPaper(event.target.value)}>
            <option value="A4">A4 縦（区切りで改ページ）</option>
            <option value="A3">A3 横（1枚にまとめる）</option>
          </select>
        </div>
        <Button type="button" variant="tertiary" disabled={preparation !== "ready"} onClick={() => print()}>
          {preparation === "preparing" ? "印刷の準備中…" : "印刷する"}
        </Button>
        {preparation === "preparing" && <Button type="button" variant="tertiary" onClick={() => cancel.current()}>準備を中止</Button>}
        {(preparation === "error" || preparation === "cancelled") && <Button type="button" variant="tertiary" onClick={() => setAttempt((value) => value + 1)}>印刷の準備をやり直す</Button>}
      </div>
      {preparation === "preparing" && <p className="footnote m-0 mt-2" role="status">印刷の準備中です。このまま他の操作や移動ができます。</p>}
      {preparation === "cancelled" && <p className="footnote m-0 mt-2" role="status">印刷の準備を中止しました。</p>}
      {preparation === "error" && <p className="footnote m-0 mt-2" role="alert">グラフか文字の準備が間に合いませんでした。印刷の準備をやり直すか、画面を読み直してください。</p>}
      {preparation === "overflow" && <div role="alert" className="mt-2">
        <p className="footnote m-0">内容がA3の1枚を超えています。A4なら全文を印刷できます。</p>
        <Button type="button" variant="tertiary" onClick={() => print("A4")}>A4で全文を印刷する</Button>
      </div>}
      <p className="footnote m-0 mt-2">URLや日時が出る場合は、印刷設定の「ヘッダーとフッター」をオフにします。</p>
    </div>
  );
}
