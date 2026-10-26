"use client";

import { memo, useDeferredValue, useEffect, useId, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { CredentialMemoButton } from "@/components/CredentialMemoButton";
import { Icon } from "@/components/Icon";
import { LatestScoreValue } from "@/components/LatestScore";
import { Button, Card, ChipLink, EmptyState } from "@/components/ui";
import {
  buildSearchIndex,
  countPeople,
  defaultDirection,
  filterPeople,
  parsePeopleView,
  peopleViewParams,
  personLabels,
  QUERY_MAX_LENGTH,
  reversed,
  settleOwnUrlWrite,
  SORT_KEY_LABEL,
  sortLabel,
  sortPeople,
  type PeopleSortKey,
  type PeopleView,
  type PersonFields,
} from "@/lib/domain/people-list";

/**
 * 利用者・社員・メンバーの一覧（spec.md §28-13）。名前などで探し、名前・会社・役割・点数・等級で並べ替える。
 *
 * 探すのも並べ替えも手元の配列で行う（サーバーに問い合わせない）。
 * 打つたびに一覧を作り直しても入力が引っかからないよう、一覧の描き直しは入力より後回しにする（useDeferredValue）。
 * 選んだ並びと検索語は URL に残し、詳細から戻ったときや再読み込みでも同じ一覧に戻る。
 */

export interface PeopleListRow extends PersonFields {
  href: string;
  isActive: boolean;
  /** 初期パスワードの控えがあるか（あれば行の下に「控えを見る」を出す） */
  hasMemo?: boolean;
}

/** URL へ書き戻すまでの間。打っている途中は書かない（Safari は短い間の書き換えの回数を制限する） */
const URL_SYNC_DELAY_MS = 300;

/**
 * 履歴を増やさずに URL を書き換える。メニューの位置などは残し、Next の印（__NA・_N）だけ外して渡す。
 * 印が付いたままだと Next は内部の呼び出しとみなし、useSearchParams（会社の札の href）へ反映しない。
 * 印の名前は Next の内部のものなので、頼るのはここ1か所にする。
 */
function replaceUrlKeepingHistory(url: URL) {
  const { __NA: _na, _N: _n, ...own } = (window.history.state ?? {}) as Record<string, unknown>;
  window.history.replaceState(own, "", url);
}

/**
 * 検索語と並びを URL に書き、書いた引数（useSearchParams().toString() と同じ形）を控え（remember）に足す。
 * Next はこの書き換えを useSearchParams へ後から（transition で）届けるので、届いたときに自分の書き換えだと見分けるのに使う。
 */
function syncPeopleUrl(view: PeopleView, sortKeys: readonly PeopleSortKey[], remember: Dispatch<SetStateAction<readonly string[]>>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(peopleViewParams(view, sortKeys))) {
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  if (url.href === window.location.href) return;
  replaceUrlKeepingHistory(url);
  const written = url.searchParams.toString();
  remember((pending) => [...pending, written]);
}

export function PeopleList({
  rows,
  sortKeys,
  initial,
}: {
  rows: PeopleListRow[];
  /** この一覧で選べる並べ替え（availableSortKeys で作る） */
  sortKeys: PeopleSortKey[];
  /** URL から読んだ最初の検索語と並び（parsePeopleView で作る） */
  initial: PeopleView;
}) {
  const id = useId();
  const [query, setQuery] = useState(initial.q);
  const [sort, setSort] = useState(initial.sort);
  const [dir, setDir] = useState(initial.dir);
  const searchParams = useSearchParams();
  const urlId = searchParams.toString();
  const keysId = sortKeys.join();
  const [loadedUrl, setLoadedUrl] = useState(urlId);
  const [loadedKeys, setLoadedKeys] = useState(keysId);
  // 自分で URL に書き、まだ searchParams に届いていない引数（書いた順）
  const [pendingWrites, setPendingWrites] = useState<readonly string[]>([]);
  // 会社の札やブラウザの「戻る」で移動したら、移動先のURLを採用する。
  // 手元の入力だけが変わった間はURLが同じなので、未反映の入力を消さない。
  // native replaceStateでもNextのsearchParamsが更新されるが、届くのは後になる。届いた時点で入力がもう先へ進んでいる
  // （「検索を消す」を押した等）ことがあるので、自分の書き換えが届いただけなら入力を戻さない。
  // cachedなserver props(initial)は復元の根拠にしない。
  if (loadedUrl !== urlId || loadedKeys !== keysId) {
    const rest = loadedKeys === keysId ? settleOwnUrlWrite(pendingWrites, urlId) : null;
    setLoadedUrl(urlId);
    setLoadedKeys(keysId);
    if (rest !== null) {
      setPendingWrites(rest);
    } else {
      const view = parsePeopleView({
        q: searchParams.get("q") ?? undefined,
        sort: searchParams.get("sort") ?? undefined,
        dir: searchParams.get("dir") ?? undefined,
      }, sortKeys);
      if (pendingWrites.length > 0) setPendingWrites([]);
      setQuery(view.q);
      setSort(view.sort);
      setDir(view.dir);
    }
  }
  // 入力欄はすぐに変え、一覧の描き直しは後から追いかける
  const deferredQuery = useDeferredValue(query);
  const catchingUp = deferredQuery !== query;

  // 検索用の文字列は行が変わったときだけ作る。並べ替えてから絞るので、絞っても並びは崩れない
  const index = useMemo(() => buildSearchIndex(rows), [rows]);
  const sorted = useMemo(() => sortPeople(rows, sort, dir), [rows, sort, dir]);
  const visible = useMemo(() => filterPeople(sorted, index, deferredQuery), [sorted, index, deferredQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => syncPeopleUrl({ q: query, sort, dir }, sortKeys, setPendingWrites), URL_SYNC_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [query, sort, dir, sortKeys]);

  const searchable = describeSearchable(rows);
  const statusId = `${id}-status`;

  // 控えのボタンは、その人の最初に出ている行にだけ出す（同じ人の2行目に重ねない）
  const seen = new Set<string>();

  return (
    // 入力から会社の札や詳細へフォーカスが移る時は待たずに確定する。
    // 札や詳細への移動に備える。即時の会社切替も実ブラウザの回帰試験で確認する。
    <div onBlur={() => syncPeopleUrl({ q: query, sort, dir }, sortKeys, setPendingWrites)}>
      <div className="mb-2 flex flex-wrap items-end gap-3">
        <div className="field min-w-0 flex-[1_1_16rem]">
          <label htmlFor={`${id}-q`}>探す</label>
          <input
            id={`${id}-q`}
            type="search"
            className="input w-full"
            placeholder={`${searchable}で探す`}
            enterKeyHint="search"
            autoComplete="off"
            maxLength={QUERY_MAX_LENGTH}
            aria-describedby={statusId}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {sortKeys.length > 1 && (
          <div className="field">
            <label htmlFor={`${id}-sort`}>並べ替え</label>
            <select
              id={`${id}-sort`}
              className="input"
              value={sort}
              onChange={(e) => {
                const next = sortKeys.find((key) => key === e.target.value) ?? sort;
                setSort(next);
                setDir(defaultDirection(next));
              }}
            >
              {sortKeys.map((key) => (
                <option key={key} value={key}>
                  {SORT_KEY_LABEL[key]}
                </option>
              ))}
            </select>
          </div>
        )}
        <Button type="button" variant="tertiary" onClick={() => setDir(reversed(dir))}>
          {sortLabel(sort, reversed(dir))}にする
        </Button>
      </div>
      <p id={statusId} className="footnote m-0 mb-3" role="status" aria-live="polite">
        {sortLabel(sort, dir)}・{countPeople(visible)} / {countPeople(rows)}人を表示
      </p>

      {visible.length === 0 ? (
        <EmptyState
          title="条件に合う人がいません"
          body="言葉を減らすか、別の言葉で探してください。"
          action={
            <Button type="button" variant="secondary" onClick={() => setQuery("")}>
              検索を消す
            </Button>
          }
        />
      ) : (
        <div className={catchingUp ? "opacity-60" : undefined} aria-busy={catchingUp || undefined}>
          <Card>
            {visible.map((row) => {
              const showMemo = Boolean(row.hasMemo) && !seen.has(row.id);
              seen.add(row.id);
              return <PersonRow key={row.key} row={row} showMemo={showMemo} />;
            })}
          </Card>
        </div>
      )}
    </div>
  );
}

/** 検索欄の案内。その一覧に出ている欄だけを挙げる（出ていない欄では当たらない） */
function describeSearchable(rows: readonly PersonFields[]): string {
  const has = (pick: (row: PersonFields) => unknown) => rows.some((row) => pick(row) !== undefined);
  return [
    "名前",
    has((r) => r.email) && "メール",
    "役割",
    has((r) => r.companyName) && "会社",
    has((r) => r.gradeName) && "等級",
    has((r) => r.department) && "所属",
    rows.some((r) => r.employeeCode) && "社員番号",
  ]
    .filter(Boolean)
    .join("・");
}

/** 1行。並べ替えや検索で行が入れ替わっても、同じ行は描き直さない */
const PersonRow = memo(function PersonRow({ row, showMemo }: { row: PeopleListRow; showMemo: boolean }) {
  const labels = personLabels(row);
  const sub = [row.email, labels.employeeCode].filter(Boolean).join(" ／ ");
  const link = (
    <Link
      href={row.href}
      className="user-row no-underline"
      /* 利用停止の方は、札だけでなく行の面と枠でも分かるようにする（全画面共通の作法） */
      data-off={row.isActive ? undefined : "true"}
    >
      <Avatar name={row.name} seed={row.id} size={36} />
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-body font-semibold text-ink">
          {row.name}
          {!row.isActive && <span className="ml-2 badge badge-closed">利用停止</span>}
        </p>
        {sub !== "" && <p className="m-0 truncate text-note text-ink-muted">{sub}</p>}
      </div>
      <span className="user-row-tags">
        <span className="tag">
          <Icon name="shield" size={13} />
          {labels.role}
        </span>
        {labels.company !== undefined && (
          <span className="tag">
            <Icon name="building" size={13} />
            {labels.company}
          </span>
        )}
        {labels.grade !== undefined && (
          <span className="tag">
            <Icon name="layers" size={13} />
            {labels.grade}
          </span>
        )}
        {labels.department !== undefined && (
          <span className="tag">
            <Icon name="building" size={13} />
            {labels.department}
          </span>
        )}
      </span>
      {row.latestScore !== undefined && <LatestScoreValue score={row.latestScore} />}
    </Link>
  );
  // 控えがある行だけ、リンクの下に「控えを見る」を並べる（リンクの中には入れない）
  return showMemo ? (
    <div className="user-row-group">
      {link}
      <CredentialMemoButton userId={row.id} name={row.name} />
    </div>
  ) : (
    link
  );
});

/** 範囲の札の行き先。今の URL の引数（search）のうち、範囲の引数だけを差し替える */
function scopeHref(basePath: string, param: string, search: string, value: string) {
  const next = new URLSearchParams(search);
  if (value === "") next.delete(param);
  else next.set(param, value);
  const query = next.toString();
  return query === "" ? basePath : `${basePath}?${query}`;
}

/**
 * 一覧の範囲を切り替える札（会社でしぼる など）。
 * 切り替えても、選んでいる並びと検索語は引き継ぐ（URL の q・sort・dir を残す）。
 */
export function PeopleScopeChips({
  basePath,
  param,
  items,
  current,
}: {
  basePath: string;
  /** 範囲を持つ URL の引数の名前 */
  param: string;
  /** value が "" の札は、引数を消した範囲（すべて） */
  items: { value: string; label: string }[];
  current: string;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {items.map((item) => {
        const href = scopeHref(basePath, param, searchParams.toString(), item.value);
        return (
          <ChipLink
            key={item.value}
            href={href}
            current={current === item.value}
            onClick={(e) => {
              // 検索欄を離れた直後は、一覧が書いた検索語がまだ searchParams（描いた href）に届いていない。
              // 押した時点の URL から行き先を作り直す。別タブで開く押し方はブラウザに任せる
              if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              const live = scopeHref(basePath, param, window.location.search, item.value);
              if (live === href) return;
              e.preventDefault();
              router.push(live);
            }}
          >
            {item.label}
          </ChipLink>
        );
      })}
    </div>
  );
}
