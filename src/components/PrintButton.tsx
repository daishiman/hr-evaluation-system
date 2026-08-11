"use client";

import { Button } from "@/components/ui";

/**
 * この画面をそのままA4で印刷する。
 * 移行元（Googleフォーム＋GAS）では「A4 HTML評価票を開く」ボタンから
 * 印刷用の評価票を出していたため、同じことができるようにしている。
 * 印刷時の見え方は globals.css の @media print 側で整える。
 */
export function PrintButton({ label = "この評価票を印刷する" }: { label?: string }) {
  return (
    <Button type="button" variant="tertiary" className="no-print" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
