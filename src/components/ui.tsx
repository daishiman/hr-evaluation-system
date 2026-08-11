import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
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
export function SectionHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="section-head">
      <h2 className="section-heading">{children}</h2>
      {aside}
    </div>
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
      <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
        <Num value={value} /> / <Num value={max} />
        {label ? ` ${label}` : ""}
      </p>
    </div>
  );
}

/* ───────────────────────── 定義リスト ───────────────────────── */

export function DefList({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="def-list">
      {rows.map((r) => (
        <div key={r.label} className="flex flex-wrap gap-x-3 gap-y-1 border-b border-[var(--line)] py-2 last:border-b-0">
          <dt className="w-40 shrink-0 text-[12px] text-[var(--ink-muted)]">{r.label}</dt>
          <dd className="m-0 min-w-0 flex-1 text-[13px]">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A〜E のランク表示。色相を増やさず太さと罫線で差をつける。 */
export function RankMark({ rank }: { rank: string | null }) {
  const strong = rank === "A";
  return (
    <span
      className={clsx(
        "num inline-flex h-6 w-6 items-center justify-center rounded-full border text-[12px] font-bold",
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
