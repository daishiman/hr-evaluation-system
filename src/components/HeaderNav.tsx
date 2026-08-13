"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { resolveTrail } from "@/lib/nav";
import type { Role } from "@/lib/session";

/**
 * ヘッダーの左側。「1つ前に戻る／進む」と「いまどこを開いているか」。
 *
 * ■ 戻る／進むを、なぜブラウザの履歴でやるか
 *   アプリの中だけで履歴を持つと、ブラウザの戻るボタンとずれる
 *   （画面の中の戻るを押すと1つ戻り、ブラウザの戻るを押すと別の場所へ行く）。
 *   同じ操作で同じ場所へ行くほうが大事なので、行き先は router.back()/forward()
 *   にそのまま任せ、**押せるかどうかの判定だけ**を自分で持つ。
 *
 * ■ 押せるかどうかの判定
 *   ブラウザは「進める先があるか」を教えてくれない（history.length は当てにならない）。
 *   そこで履歴の1つ1つに通し番号を打ち、いまの番号と到達した最大の番号を見る。
 *     ・いまの番号 > 0        … 戻れる
 *     ・いまの番号 < 最大の番号 … 進める
 *   戻ってから別の画面へ進むと、その先の履歴は捨てられる。
 *   このとき番号を打ち直して最大の番号も下げるので、「進む」は正しく消える。
 *   押せないときは disabled にする（押せるように見せて何も起きないのが最悪）。
 *
 * ■ 最初の画面で「戻る」を押せないのはわざと
 *   別のサイトから来た場合、ブラウザの戻るは前のサイトへ戻れる。
 *   だがこのボタンはアプリの中を移るためのものなので、アプリの外へ
 *   放り出す動きは持たせない。番号が 0 のときは押せない。
 */

/** 履歴の1つ1つに打つ通し番号（history.state に混ぜる） */
const STAMP = "hrNavIndex";
/** いまいる位置と、到達した最大の位置。タブを閉じたら消えてよい */
const CURSOR_KEY = "hr:nav:cursor";
const MAX_KEY = "hr:nav:max";

function readNumber(key: string): number | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeNumber(key: string, value: number) {
  try {
    sessionStorage.setItem(key, String(value));
  } catch {
    // プライベートブラウズなどで覚えられなくても、移動そのものは動かす
  }
}

export function HeaderNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const [pos, setPos] = useState<{ index: number; max: number } | null>(null);

  const sync = useCallback(() => {
    const state = (window.history.state ?? {}) as Record<string, unknown>;
    const stamped = typeof state[STAMP] === "number" ? (state[STAMP] as number) : null;

    let index = stamped;
    if (index === null) {
      // この履歴は初めて来た。1つ前の位置の次に置き、その先の履歴は捨てられたものとする
      index = (readNumber(CURSOR_KEY) ?? -1) + 1;
      window.history.replaceState({ ...state, [STAMP]: index }, "");
      writeNumber(MAX_KEY, index);
    }
    writeNumber(CURSOR_KEY, index);
    setPos({ index, max: Math.max(readNumber(MAX_KEY) ?? index, index) });
  }, []);

  // 画面を移ったとき（検索条件だけの移動も含む）と、戻る／進むが押されたときに測り直す
  useEffect(() => {
    sync();
  }, [sync, pathname, search]);

  useEffect(() => {
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [sync]);

  /* 測る前（画面が出た直後のごく短い間）は、押せない側に倒しておく */
  const canBack = pos !== null && pos.index > 0;
  const canForward = pos !== null && pos.index < pos.max;
  const trail = resolveTrail(pathname, role);

  return (
    <>
      <div className="header-move">
        <button type="button" className="header-move-btn" disabled={!canBack} onClick={() => router.back()}>
          戻る
        </button>
        <button type="button" className="header-move-btn" disabled={!canForward} onClick={() => router.forward()}>
          進む
        </button>
      </div>

      <nav className="header-trail" aria-label="いま開いている画面">
        <ol className="trail">
          {trail.map((step, i) => (
            <li key={`${step.label}-${i}`}>
              {step.href ? (
                <Link href={step.href} className="no-underline">
                  {step.label}
                </Link>
              ) : (
                <span aria-current={i === trail.length - 1 ? "page" : undefined}>{step.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
