"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { isCurrent, type NavGroup } from "@/lib/nav";
import { CompanyScopeSwitcher } from "@/components/CompanyScopeSwitcher";
import { Icon } from "@/components/Icon";
import { useSidebarDrawer } from "@/components/SidebarDrawer";

/**
 * 左のメニュー。
 *
 * ・項目には必ず絵を添える（絵は src/lib/nav.ts が意味ごとに1対1で決める）
 * ・分類ごとに見出しを付けてまとめる（項目を平らに並べない）
 * ・分類の切れ目にだけ罫線を引く（見出しの下や項目の間に横棒を足さない）
 * ・開いた／閉じたはブラウザに覚えさせる（次に開いたときも同じ状態）
 * ・画面が狭いときは重ねて開く引き出しにする（会社の切り替えもここでできる）
 *
 * 広い画面で閉じたときは、**絵だけの細い列（レール）**にする。
 * 以前は完全に隠していた（絵だけでは分類が伝わらないため）が、
 * 次の3つを揃えることで「絵だけに意味を預けない」を保ったまま畳めるようにした。
 *  1. 絵は対象から一意に思い出せるものだけを使う（nav.ts の決まり）
 *  2. マウスを乗せても、キーボードで移動しても、同じ吹き出しで名前が出る
 *  3. 読み上げには aria-label で名前が渡る（絵は読み飛ばす）
 *
 * 出し分けは CSS（html[data-sidebar="collapsed"]）で行い、描く中身は常に同じにする。
 * 畳んでいるかどうかを React 側の状態で分岐させると、画面が出た直後の一瞬だけ
 * 開いた状態が見えてしまうため。
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
  /* 開くボタンはヘッダー側にあるので、開閉は共通の入れ物から借りる */
  const { open: drawerOpen, setOpen: setDrawerOpen } = useSidebarDrawer();
  const [collapsed, setCollapsed] = useState(false);
  /* レールのときに、いま指している項目の名前を出す吹き出し。
     メニューの中は縦に長くて自前でスクロールするため、中に置くと切れてしまう。
     画面に対して位置を決める（position: fixed）ので、指した項目の高さだけを持つ。 */
  const [tip, setTip] = useState<{ label: string; top: number } | null>(null);
  const allHrefs = groups.flatMap((g) => g.items.map((i) => i.href));

  /** マウスでもキーボードでも同じ吹き出しを出す。 */
  const showTip = (label: string) => (e: { currentTarget: HTMLElement }) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ label, top: r.top + r.height / 2 });
  };
  const hideTip = () => setTip(null);

  // 初回の描画後に、いまの状態（<html> の属性）を React 側にも取り込む
  useEffect(() => {
    setCollapsed(document.documentElement.dataset.sidebar === "collapsed");
  }, []);

  // 画面を移ったら引き出しは閉じる（開きっぱなしで中身が隠れないように）
  useEffect(() => {
    setDrawerOpen(false);
    setTip(null);
  }, [pathname, setDrawerOpen]);

  const toggleCollapsed = useCallback(() => {
    setTip(null);
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
            <Icon name="panelClose" />
            閉じる
          </button>
          {/* 畳んでいるときの「開く」。レールの中に置くので、押す場所が列から離れない。
              文字は入らないため、名前は読み上げ（aria-label）と吹き出しの両方で渡す。 */}
          <button
            type="button"
            className="sidebar-open-rail"
            aria-label="メニューを開く"
            onClick={toggleCollapsed}
            onMouseEnter={showTip("メニューを開く")}
            onMouseLeave={hideTip}
            onFocus={showTip("メニューを開く")}
            onBlur={hideTip}
          >
            <Icon name="panelOpen" size={20} />
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
                  /* 畳むと文字が消えるので、読み上げには常に名前を渡しておく */
                  aria-label={item.label}
                  onMouseEnter={showTip(item.label)}
                  onMouseLeave={hideTip}
                  onFocus={showTip(item.label)}
                  onBlur={hideTip}
                >
                  <Icon name={item.icon} size={18} className="sidebar-link-icon" />
                  <span className="sidebar-link-label">{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* 畳んでいるときだけ出る名前の吹き出し。読み上げは aria-label 側が持つので二重に読ませない */}
      {tip && (
        <div className="rail-tip" style={{ top: tip.top }} aria-hidden>
          {tip.label}
        </div>
      )}
    </>
  );
}
