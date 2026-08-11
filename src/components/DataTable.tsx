import type { ReactNode } from "react";
import { Card } from "@/components/ui";

/**
 * 表の列1本ぶんの決めごと。
 *
 * `role` は「狭い画面でカードに畳んだとき、この列をどこに置くか」を決める。
 *  - `title` … カードの1行目（名前など、その行が何なのかを表す値）。1つだけ。
 *  - `mark`  … カードの1行目の右側（状態バッジなど、短い印）。
 *  - 省略    … カードの中でラベル付きの値として縦に積む。
 *
 * 列の並び順＝重要度の順にすること。カードに畳んだときも同じ順で読まれる。
 */
export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** 数値の列。右揃え＋等幅にする（文字列の列には付けない）。 */
  num?: boolean;
  role?: "title" | "mark";
}

/**
 * 一覧を「広い画面では表、狭い画面ではカード」で出す唯一の実装。
 *
 * **表を使ってよいのは「同じ属性を持つ多数の行を、上から下へ見比べる」場面だけ。**
 * 1件あたりの情報量が多い・行ごとに取れる操作が違う・長い文章が入る一覧は、
 * 表ではなくカードの一覧（`RecordList`）で書く。判断基準は docs/product/spec.md §5-5。
 *
 * 切替の幅は容器の幅で判定する（画面幅ではない）。折りたたみの中や狭い欄に
 * 置いても正しく畳まれるようにするため。列が5本以上ある表は、横に潰れる前に
 * 早めカードへ落とす（`data-cards="wide"`）。
 *
 * 表とカードは同じ行を2通りに描く（片方は `display: none`）。JS を待たずに正しい形で
 * 出すためにこうしている。数百行を超える一覧をここに入れるときは、先に件数を絞ること。
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** 表が何の一覧かを読み上げに伝える一文（画面には出さない）。 */
  caption?: string;
}) {
  const titleCol = columns.find((c) => c.role === "title") ?? columns[0];
  const markCols = columns.filter((c) => c.role === "mark");
  const restCols = columns.filter((c) => c !== titleCol && !markCols.includes(c));

  return (
    <div className="list-host" data-cards={columns.length >= 5 ? "wide" : undefined}>
      <Card className="table-scroll">
        <table>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.num ? "col-num" : undefined} scope="col">
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)}>
                {columns.map((c) => (
                  <td key={c.key} className={c.num ? "col-num" : undefined}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="list-cards">
        {rows.map((r) => (
          <div key={rowKey(r)} className="list-card">
            <div className="list-card-head">
              <span className="min-w-0">{titleCol.cell(r)}</span>
              {markCols.map((c) => (
                <span key={c.key}>{c.cell(r)}</span>
              ))}
            </div>
            <dl className="def-list">
              {restCols.map((c) => (
                <div key={c.key}>
                  <dt>{c.header}</dt>
                  <dd>{c.cell(r)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </Card>
    </div>
  );
}
