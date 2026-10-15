import type { ReactNode } from "react";
import { clsx } from "clsx";
import { SplitRow } from "@/components/ui";

/**
 * 一覧の1行の形（spec §28-14・DD-014）。等級要件・昇格の条件・アンケートの設問と選択肢・KPI 項目・行動指針の段階で同じにする。
 *
 *   番号 → 本文（本文の直後に札）→ 補足 → 使っている場所・入力欄
 *
 * 行の操作（内容を直す・今後使わない など）は本文に入れず、行の右端の列に置く。
 *   - 並べ替えのある一覧: ReorderList の renderActions
 *   - 並べ替えの無い一覧: <ol className="list-rows"> の <li className="card-row"> の中の .row-actions
 * どちらも、狭い一覧では本文の下へ行の幅いっぱいに割り付け、広い一覧では本文の右に1段で並べる（globals.css）。
 */
export function ListRowBody({
  number,
  wide = false,
  text,
  badges,
  note,
  children,
}: {
  /** 行の番号（並びの位置・No.・点数）。読み上げでは本文の前に読む */
  number: ReactNode;
  /** 番号が「No.12」のように長いときは列を広げる（どの行でも本文の頭がそろうよう、一覧の中では同じ値にする） */
  wide?: boolean;
  /** 本文。直している間は省き、入力欄を children で渡す */
  text?: ReactNode;
  /** 本文の直後に置く札。札は行の性質なので、押すボタンの列には置かない。2つ以上並べるときは呼び出し側で inline-flex の span に包む */
  badges?: ReactNode;
  /** 本文の下の補足（区分・単位など） */
  note?: ReactNode;
  /** 補足の下に置くもの（使っている場所・入力欄） */
  children?: ReactNode;
}) {
  return (
    // list-row-body: 入力欄から始まる行で、番号を入力欄の中の1行目にそろえる目印（globals.css）
    <div className="list-row-body flex items-start gap-3">
      <ListRowNumber wide={wide}>{number}</ListRowNumber>
      <div className="row-main">
        {text !== undefined && (
          <p className="m-0 text-sub">
            {text}
            {badges && (
              <>
                {" "}
                {badges}
              </>
            )}
          </p>
        )}
        {note && <div className="footnote m-0 mt-1">{note}</div>}
        {children}
      </div>
    </div>
  );
}

/**
 * 行の番号の列。ListRowBody の外で行の頭を描くとき（開いた設問の固定する頭。CardHead の lead）も、
 * これを使って番号の幅と位置を閉じた行とそろえる。
 */
export function ListRowNumber({ wide = false, children }: { wide?: boolean; children: ReactNode }) {
  return <span className={clsx("num mt-[2px]", wide ? "w-12" : "w-6", "shrink-0 text-sub text-ink-muted")}>{children}</span>;
}

/**
 * 一覧に1件足すボタンの置き場所。どの画面でも、一覧の下の左端に「＋ ○○を追加」を置く。
 * 置き場所を画面ごとに変えない（右端に置いた画面と左端に置いた画面が混ざると、押す場所を毎回探すことになる）。
 * 注記（押すと何が起きるか・足せない理由）は補足なので、SplitRow で行の右端に寄せる（§28-9。左に積むと右が空く）。
 * 一覧が空であること（empty）も、別の段にせず同じ行の右端に、注記の上へ書く。別の段にすると、その段は右側が丸ごと空き、
 * ボタンの上下も右が空く（空の一覧が2つ並ぶ最上位の等級の昇格の画面で、右の空きが 47% になった）。
 * 入れ物が狭いときは、ボタンの下に左寄せで続く。
 */
export function ListAddRow({ children, note, empty }: { children: ReactNode; note?: ReactNode; empty?: ReactNode }) {
  return (
    <SplitRow
      className="list-add-row"
      aside={
        (empty || note) && (
          <>
            {empty && <p className="footnote m-0">{empty}</p>}
            {note && <p className="footnote m-0">{note}</p>}
          </>
        )
      }
    >
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </SplitRow>
  );
}
