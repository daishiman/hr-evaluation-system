"use client";

import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { navIconFor } from "@/lib/nav";

/**
 * 画面の見出しに添える絵。
 *
 * 画面ごとに選ばない。**左のメニューで使っている絵を、いまのURLから引いてくる**
 * （対応表は src/lib/nav.ts の1箇所）。メニューを畳むと絵だけの列になるので、
 * 「左のこの絵＝この画面」を、見出しの絵と突き合わせながら覚えられるようにする。
 *
 * メニューに無いURL（設定の中の細かい画面など）は何も出さない。
 * 意味の無い絵を埋め草として置くと、絵そのものが読み飛ばされるようになる。
 */
export function PageHeadIcon() {
  /* URL がまだ確定していない場面（画面部品だけを取り出して描くときなど）では
     null が返る。絵は添え物なので、その場合は黙って出さない。 */
  const pathname = usePathname();
  const name = pathname ? navIconFor(pathname) : null;
  if (!name) return null;
  return (
    <span className="page-title-icon">
      <Icon name={name} size={20} />
    </span>
  );
}
