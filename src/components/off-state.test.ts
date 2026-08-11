import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 「いまは使わない設定にしてあるもの」の見た目の取りこぼしを機械で見つける。
 *
 * 2026-08-12、行動指針の観点を「使わない」にしても見た目が変わらない状態で出してしまった。
 * 状態は正しく持っているのに表示だけが追随しない、という抜けは目視では見つからない。
 * そこで「画面に “利用停止 / 使用しない / 締め切り済み / 取り消し済み” と書いてあるのに、
 * 沈める指定（off / data-off / data-muted / rowOff）が1つも無いファイル」を機械で落とす。
 */

const ROOT = process.cwd();
const STATE_WORDS = /利用停止|使用しない|締め切り済み|取り消し済み|停止中/;
const OFF_MARKS = /\boff=|data-off|data-muted|rowOff/;

/** 状態の言葉は出るが、沈める対象が無いファイル。増やすときは必ず理由を書く。 */
const ALLOWED: Record<string, string> = {
  "src/app/account/page.tsx": "自分の情報。利用停止の人はそもそもログインできないため到達しない",
  "src/app/admin/setup/page.tsx": "件数の集計と案内文だけ。停止中の項目自体を並べていない",
  "src/app/admin/page.tsx": "件数の集計だけ",
  "src/app/manager/page.tsx": "件数の集計だけ",
  "src/app/system/page.tsx": "SystemDashboard に渡すだけ",
  "src/app/admin/masters/page.tsx": "等級を選ぶチップ。等級に停止状態は出していない",
  "src/app/admin/forms/[id]/page.tsx": "画面全体の状態。カード単位で沈める対象が無い",
  "src/app/forms/[id]/page.tsx": "画面全体の状態。カード単位で沈める対象が無い",
  "src/app/api/companies/route.ts": "画面ではない",
  "src/app/api/forms/route.ts": "画面ではない",
  "src/app/api/members/route.ts": "画面ではない",
  "src/app/api/system/users/route.ts": "画面ではない",
  "src/app/api/masters/apply-master-update.ts": "画面ではない",
  "src/app/api/masters/delete-master-item.ts": "画面ではない",
  "src/lib/domain/master-delete.ts": "画面ではない",
  "src/app/api/forms/[id]/extensions/route.ts": "画面ではない",
  "src/components/FormAnswer.tsx": "回答画面そのもの。答えられないときは画面全体で理由を出しており、沈める1件が無い",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}

describe("使わない設定のものは、どの画面でも同じ見た目で沈める", () => {
  it("状態を画面に出しているファイルには、沈める指定が必ずある", () => {
    const missing = walk("src/app")
      .concat(walk("src/components"))
      .filter((rel) => {
        if (ALLOWED[rel]) return false;
        const source = readFileSync(join(ROOT, rel), "utf8");
        return STATE_WORDS.test(source) && !OFF_MARKS.test(source);
      });

    /* 落ちたときは、その画面に off / rowOff を渡すか、
       沈める対象が無いなら ALLOWED に理由を書いて足す（黙って消さない）。 */
    expect(missing).toEqual([]);
  });

  it("沈める見た目の定義は1箇所だけで、色以外の手がかりも持つ", () => {
    const css = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");

    expect(css).toContain("--off-surface");
    // 色を見分けられなくても分かるように、線の形でも示す
    expect(css).toContain("border-style: dashed");
    // 主役の面（hero-tint）でも「使わない」が勝つ
    expect(css).toContain('.card.hero-tint[data-off="true"]');
    // 本文の文字色は薄くしない（読みやすさの下限）
    expect(css).not.toMatch(/\[data-off="true"\][^{]*\{[^}]*color:\s*var\(--ink-muted\)/);
  });

  it("沈める指定は共通部品が受け取る（画面ごとに書き起こさない）", () => {
    const ui = readFileSync(join(ROOT, "src/components/ui.tsx"), "utf8");
    const table = readFileSync(join(ROOT, "src/components/DataTable.tsx"), "utf8");

    expect(ui).toContain('data-off={off ? "true" : undefined}');
    expect(ui).toContain('data-off={it.off ? "true" : undefined}');
    expect(table).toContain('data-off={rowOff?.(r) ? "true" : undefined}');
  });
});
