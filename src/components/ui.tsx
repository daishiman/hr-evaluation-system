import Link from "next/link";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { clsx } from "clsx";

/* ───────────────────────── ボタン ───────────────────────── */

type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger-outline";

export function Button({
  variant = "secondary",
  block,
  className,
  ...rest
}: ComponentProps<"button"> & { variant?: ButtonVariant; block?: boolean }) {
  return <button className={clsx("btn", `btn-${variant}`, block && "btn-block", className)} {...rest} />;
}

export function LinkButton({
  variant = "secondary",
  block,
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; block?: boolean }) {
  return <Link className={clsx("btn", `btn-${variant}`, block && "btn-block", className)} {...rest} />;
}

/**
 * 画面遷移ではないリンク（CSVの書き出しなど、サーバーがファイルを返すURL）用のボタン。
 *
 * Next.js の Link は画面遷移を先読みしてしまうため、ダウンロードには使えない。
 * とはいえ見た目・タップ領域はボタンと同じでなければならないので、素の <a> に
 * `btn` を書き散らさずここに集約する。
 */
export function DownloadButton({
  variant = "tertiary",
  className,
  ...rest
}: ComponentProps<"a"> & { variant?: ButtonVariant }) {
  return <a className={clsx("btn", `btn-${variant}`, className)} {...rest} />;
}

/* ───────────────────────── バッジ ─────────────────────────
 * 色相を増やさず、塗り・罫線・打消し線の違いで状態を表す。
 */

type BadgeTone = "active" | "done" | "closed" | "dropped" | "alert" | "required";

export function Badge({ tone = "done", children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

/** 仮置きの値であることを画面上で正直に示す。 */
export function ProvisionalMark({ note }: { note?: string | null }) {
  return (
    <span className="badge badge-dropped" title={note ?? "制度として未確定のため、叩き台の初期値を入れています。"}>
      仮置き
    </span>
  );
}

/* ───────────────────────── 数値 ─────────────────────────
 * 数字は欧文フォントで描き、カンマは脇役にする。単位は小さく muted。
 */

const nf = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 });

export function Num({
  value,
  unit,
  display,
  className,
}: {
  value: number | null | undefined;
  unit?: string | null;
  display?: boolean;
  className?: string;
}) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className="text-[var(--ink-muted)]">—</span>;
  }
  const parts = nf.format(value).split(",");
  return (
    <span className={clsx(display ? "num-display" : "num", className)}>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span className="num-sep">,</span>}
          {p}
        </span>
      ))}
      {unit && <span className="unit">{unit}</span>}
    </span>
  );
}

/* ───────────────────────── 面・見出し ───────────────────────── */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("card", className)}>{children}</div>;
}

/**
 * パンくずの1段。
 * 決め事: **いまの画面は入れず、上位の画面だけを並べる**（見出しと同じ語を2回読ませない）。
 * href を省いた段は、開けない中間分類として灰色のまま出す。
 */
export interface Crumb {
  label: string;
  href?: string;
}

/**
 * 画面の見出し。全画面でこの1つだけを使う。
 *
 * - `breadcrumb`: いまどこにいて、どこへ戻れるか。画面の中に「一覧に戻る」ボタンを置かない。
 * - `tags`: 対象者・期間・状態など、スクロール中も見えていてほしい札。
 * - `sticky`: 縦に長い画面だけ true にして、見出しの帯を固定ヘッダーの下に貼り付ける
 *   （適用範囲は docs/product/spec.md §6。画面ごとに position: sticky を書かない）。
 *
 * 下の余白はこの箱だけで付ける（見出しと説明文の両方に margin を付けると二重に空く）。
 */
export function PageTitle({
  title,
  lede,
  actions,
  breadcrumb,
  tags,
  sticky,
}: {
  title: string;
  lede?: string;
  actions?: ReactNode;
  breadcrumb?: Crumb[];
  tags?: ReactNode;
  sticky?: boolean;
}) {
  return (
    <div className="page-head" data-sticky={sticky ? "true" : undefined}>
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="現在の位置">
            <ol className="breadcrumb">
              {breadcrumb.map((c, i) => (
                <li key={`${c.label}-${i}`}>
                  {c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1 className="page-title">{title}</h1>
        {lede && <p className="page-lede">{lede}</p>}
        {tags && <div className="page-head-tags">{tags}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** セクションの見出し。上下の余白は .section-head に集約している。 */
export function SectionHeading({
  children,
  aside,
  help,
}: {
  children: ReactNode;
  /** 見出しの右に置く補助リンク（「すべて見る」など）。 */
  aside?: ReactNode;
  /** 見出しのすぐ下に添える1行の説明。段落を画面ごとに書き起こさないためのスロット。 */
  help?: ReactNode;
}) {
  return (
    <>
      <div className="section-head">
        <h2 className="section-heading">{children}</h2>
        {aside}
      </div>
      {help && <p className="footnote m-0 -mt-1.5 mb-2">{help}</p>}
    </>
  );
}

/**
 * 詳細を必要なときだけ開くための共通パネル。
 * 初期表示では要点（summary / meta）だけにし、長い説明や補助設定で画面を埋めない。
 */
export function Disclosure({
  summary,
  meta,
  children,
  defaultOpen = false,
}: {
  summary: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="disclosure card" open={defaultOpen || undefined}>
      <summary>
        <span>{summary}</span>
        {meta && <span className="disclosure-meta">{meta}</span>}
      </summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}

/* ───────────────────────── 空状態 ─────────────────────────
 * 「次に何をすればいいか」を必ず書く。
 */

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <p className="es-title">{title}</p>
      <p className="es-body">{body}</p>
      {action}
    </div>
  );
}

/**
 * 表示できない理由をその場に出す。
 * 一覧が空・編集できないときに無言にしないための部品。
 */
export function ReasonNote({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="caution-panel flex flex-wrap items-center justify-between gap-3">
      <span>{children}</span>
      {action}
    </div>
  );
}

/* ───────────────────────── 進捗バー ─────────────────────────
 * 分母を必ず添える（何に対する割合かを隠さない）。
 */

export function Bar({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div>
      <div className="bar-track" role="img" aria-label={`${label ?? "達成度"} ${max}中 ${value}`}>
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-note text-[var(--ink-muted)]">
        <Num value={value} /> / <Num value={max} />
        {label ? ` ${label}` : ""}
      </p>
    </div>
  );
}

/* ───────────────────────── 定義リスト ───────────────────────── */

/**
 * 1件の中身（ラベルと値の対）を並べる標準形。
 *
 * **項目と値の羅列を表（table）で書かない。** 列が1本しかない表は表ではなく、
 * 狭い画面で横スクロールを生むだけになる。判断基準は docs/product/spec.md §5-5。
 * 見た目（ラベル幅・区切り・狭い画面での縦積み）は .def-list に集約している。
 */
export function DefList({ rows }: { rows: { label: string; value: ReactNode; key?: string }[] }) {
  return (
    <dl className="def-list">
      {rows.map((r) => (
        // ラベルが重なりうる用途（同じ設問文が2つある等）は key を明示して渡す
        <div key={r.key ?? r.label}>
          <dt>{r.label}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * 同じ粒度の数値を数個ならべるサマリー（対象◯人／提出済み◯人 …）。
 *
 * 意味の違う値を混ぜない（それは DefList の仕事）。数値は大きく、
 * ラベルは小さく muted に固定する（画面ごとに組み方を変えない）。
 */
export function StatGrid({ stats }: { stats: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="stat-grid" style={{ "--stat-cols": Math.min(stats.length, 4) } as CSSProperties}>
      {stats.map((s) => (
        <div key={s.label}>
          <dt>{s.label}</dt>
          <dd>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * 一覧をカードで出す標準形。
 *
 * 表（DataTable）を使わない一覧はすべてこれで書く。とくに
 * 「1件ごとの情報量が多い」「行ごとに取れる操作が違う」「長い文章が入る」
 * 履歴・申請・調整のたぐいはこちら（判断基準は docs/product/spec.md §5-5）。
 *
 * 並びは上から: 見出し（+ 状態の札）→ ラベル付きの値 → 長い文章 → 操作。
 * この順番は画面ごとに変えない。
 */
export interface RecordItem {
  key: string;
  title: ReactNode;
  marks?: ReactNode;
  rows?: { label: string; value: ReactNode }[];
  note?: ReactNode;
  action?: ReactNode;
}

export function RecordList({ items }: { items: RecordItem[] }) {
  return (
    <Card>
      {items.map((it) => (
        <div key={it.key} className="list-card">
          <div className="list-card-head">
            <span className="min-w-0">{it.title}</span>
            {it.marks}
          </div>
          {it.rows && it.rows.length > 0 && <DefList rows={it.rows} />}
          {it.note && <p className="list-card-note">{it.note}</p>}
          {it.action && <div className="list-card-actions">{it.action}</div>}
        </div>
      ))}
    </Card>
  );
}

/**
 * 一覧の1行（1件＝1行、読むだけの行）。
 *
 * RecordList との使い分け（docs/product/spec.md §5-5）:
 * - 1件を「名前＋補足1行＋状態」で言い切れる → CardRow（ホーム・一覧の既定）
 * - ラベル付きの値が複数ある／長い文章が入る／行ごとに操作が違う → RecordList
 *
 * 並びは上から（横並びのときは左から）**見出し → 補足 → 右の数値 → 状態の札** で固定する。
 * 画面ごとに順番を入れ替えない。狭い画面では .card-row 側で自動的に折り返す。
 */
export function CardRow({
  lead,
  title,
  sub,
  detail,
  value,
  marks,
  alignTop,
  className,
}: {
  /** 行の先頭に置く小さな印（ランク・色見本）。文章は入れない。 */
  lead?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  /** 締切・提出日など、補足のさらに下に添える短い注記（.footnote の段落を渡す）。 */
  detail?: ReactNode;
  value?: ReactNode;
  marks?: ReactNode;
  /** 補足が数行になる（本文・回答など）ときだけ true。既定は上下中央。 */
  alignTop?: boolean;
  className?: string;
}) {
  return (
    <div className={clsx("card-row", alignTop && "items-start", className)}>
      {lead}
      <div className="row-main">
        <p className="todo-row-title m-0">{title}</p>
        {sub && <p className="todo-row-sub m-0">{sub}</p>}
        {detail}
      </div>
      {value && <div className="shrink-0 text-right">{value}</div>}
      {marks}
    </div>
  );
}

/**
 * カード1枚の頭（名前＋状態の札／補足／そのカードから出ていく操作）。
 *
 * 1件＝カード1枚で、中に編集フォームや明細を抱える画面（評価期間・アンケート・
 * 会社など）はこの頭を必ず使う。左に読むもの、右に押すものを固定し、
 * 画面ごとに flex の並べ方を書き起こさない。
 *
 * `pinned` を付けると、この頭がカードの中でスクロールしても消えなくなる。
 * 使う条件と、帯に何を載せてよいかは下の pinned の説明を読むこと。
 */
interface CardHeadBase {
  /** 名前の左に置く小さな印（手順番号など）。文章は入れない。 */
  lead?: ReactNode;
  title: ReactNode;
  /** そのカードが画面の節そのものであるときだけ true（見出しとして読み上げさせる）。 */
  heading?: boolean;
  sub?: ReactNode;
  actions?: ReactNode;
}

/**
 * 固定表示にすると `detail`（注記の段落）を渡せなくなる、を型で縛る。
 *
 * 帯に載せてよいのは「操作しながら参照し続けるもの」だけ（単位・配点・上限下限の
 * 判定ルール・合計）。一度読めば済む説明文を帯に足していくと帯が厚くなり、
 * 肝心の入力欄が画面から押し出されて逆効果になる。
 * 注意書きはカードの本文側（帯の下）に普通の段落として置くこと。
 */
type CardHeadProps = CardHeadBase &
  (
    | {
        /**
         * カードの中身が縦に長く、頭にある情報を見ながら下のほうを操作する画面だけ true。
         * 前提: 親の Card に `card-pad` が付いていること
         * （帯を幅いっぱいに広げるため、カードの内側の余白を打ち消している）。
         */
        pinned: true;
        detail?: never;
      }
    | { pinned?: false; detail?: ReactNode }
  );

export function CardHead({ lead, title, heading, sub, detail, actions, pinned }: CardHeadProps) {
  const Title = heading ? "h2" : "p";
  return (
    <div
      className={clsx(
        "flex flex-wrap items-start justify-between gap-3",
        pinned && "card-head-sticky",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {lead}
        <div className="min-w-0">
          <Title className="todo-row-title m-0">{title}</Title>
          {sub && <p className="todo-row-sub m-0">{sub}</p>}
          {detail}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** A〜E のランク表示。色相を増やさず太さと罫線で差をつける。 */
export function RankMark({ rank }: { rank: string | null }) {
  const strong = rank === "A";
  return (
    <span
      className={clsx(
        "num inline-flex h-6 w-6 items-center justify-center rounded-full border text-note font-bold",
        strong
          ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-deep)]"
          : "border-[var(--line)] bg-[var(--subtle)] text-[var(--ink-muted)]",
      )}
      aria-label={rank ? `ランク ${rank}` : "実績が未入力のため判定外"}
    >
      {/* ランクが付いていない＝実績が入力されていない。空白にすると理由が伝わらないので「—」を出す */}
      {rank ?? "—"}
    </span>
  );
}
