"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { isCurrent, type NavGroup } from "@/lib/nav";
import { CompanyScopeSwitcher } from "@/components/CompanyScopeSwitcher";

/**
 * 左のメニュー。
 *
 * ・分類ごとに見出しを付けてまとめる（項目を平らに並べない）
 * ・分類の切れ目にだけ罫線を引く（見出しの下や項目の間に横棒を足さない）
 * ・開いた／閉じたはブラウザに覚えさせる（次に開いたときも同じ状態）
 * ・画面が狭いときは重ねて開く引き出しにする（会社の切り替えもここでできる）
 *
 * 閉じるときは「アイコンだけ残す」のではなく完全に隠す。
 * メニューは文字だけで意味が伝わるようにする方針（絵を並べても分類は伝わらない）ため、
 * アイコンだけの状態を作ると何のメニューか分からなくなる。
 * ※ 属性の札（役割・会社・等級）など、文字に添えるアイコンは components/Icon.tsx で
 *   意味ごとに固定して使う。アイコン単独のボタン・リンクは作らない。
 */

export const SIDEBAR_STORAGE_KEY = "hr:sidebar:v1";

/**
 * 画面が描かれる前に、前回の開閉状態を <html> に反映するための小さなスクリプト。
 * これが無いと、閉じていた人の画面で一瞬メニューが開いて見える。
 */
export const SIDEBAR_INIT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(SIDEBAR_STORAGE_KEY)})==="collapsed"){document.documentElement.dataset.sidebar="collapsed"}}catch(e){}`;

export function AppSidebar({
  groups,
  appSubtitle,
  companies,
  currentCompanyId,
  homeHref,
}: {
  groups: NavGroup[];
  appSubtitle: string;
  companies: { id: string; name: string }[];
  currentCompanyId: string | null;
  homeHref: string;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const allHrefs = groups.flatMap((g) => g.items.map((i) => i.href));

  // 初回の描画後に、いまの状態（<html> の属性）を React 側にも取り込む
  useEffect(() => {
    setCollapsed(document.documentElement.dataset.sidebar === "collapsed");
  }, []);

  // 画面を移ったら引き出しは閉じる（開きっぱなしで中身が隠れないように）
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      if (next) document.documentElement.dataset.sidebar = "collapsed";
      else delete document.documentElement.dataset.sidebar;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "collapsed" : "open");
      } catch {
        // プライベートブラウズなどで保存できなくても、開閉そのものは動かす
      }
      return next;
    });
  }, []);

  return (
    <>
      {/* 狭い画面用の開くボタン。ヘッダーの左端に入る */}
      <button type="button" className="sidebar-open-sp" onClick={() => setDrawerOpen(true)} aria-expanded={drawerOpen}>
        メニュー
      </button>

      {/* 広い画面で閉じているときの開くボタン。押す場所を見失わないよう常に左上に出す */}
      {collapsed && (
        <button type="button" className="sidebar-open-pc" onClick={toggleCollapsed}>
          メニューを開く
        </button>
      )}

      {drawerOpen && (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="メニューを閉じる"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <aside className="app-sidebar" data-drawer={drawerOpen ? "open" : "closed"} aria-label="メニュー">
        <div className="sidebar-head">
          <Link href={homeHref} className="app-name no-underline">
            人事評価
            <span className="app-name-sub">{appSubtitle}</span>
          </Link>
          <button type="button" className="sidebar-close" onClick={toggleCollapsed}>
            閉じる
          </button>
          <button type="button" className="sidebar-close-sp" onClick={() => setDrawerOpen(false)}>
            閉じる
          </button>
        </div>

        {companies.length > 0 && (
          <div className="sidebar-scope">
            <CompanyScopeSwitcher companies={companies} currentId={currentCompanyId} />
          </div>
        )}

        <nav className="sidebar-nav">
          {groups.map((group, gi) => (
            <div key={group.title ?? `g${gi}`} className="sidebar-group">
              {group.title && <p className="sidebar-group-title">{group.title}</p>}
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="sidebar-link no-underline"
                  aria-current={isCurrent(pathname, item, allHrefs) ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
