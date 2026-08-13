"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { rankScreens, type PersonHit, type ScreenHit } from "@/lib/domain/search";

/**
 * ヘッダーの検索。押すか、⌘K（Windows は Ctrl+K）で開く。
 *
 * 探せるものは2種類だけに絞ってある（決めた理由は docs/product/spec.md §25-3）。
 *   ・画面 … どこで設定するのか分からなくなったときの入口
 *   ・人  … 社員・利用者・会社
 * 画面は通信せずに出す（ロールごとの一覧をヘッダーが持っている）。
 * 人だけ /api/search に聞く。返せる範囲はサーバー側で権限に合わせて絞る。
 *
 * 窓は <dialog> を使う。Esc で閉じる・背面を触らせない・中だけを行き来する
 * （フォーカスの閉じ込め）をブラウザに任せるため。
 * 上下キーで候補を選び、Enter でその画面へ移る。
 */

interface Row {
  key: string;
  href: string;
  label: string;
  note: string | null;
}

export function GlobalSearch({ screens, canSearchPeople }: { screens: ScreenHit[]; canSearchPeople: boolean }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<PersonHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [mac, setMac] = useState(false);

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // 打っている途中で毎回聞かない（打ち終わりを少し待つ）
  useEffect(() => {
    if (!open || !canSearchPeople) return;
    const q = query.trim();
    if (q.length === 0) {
      setPeople([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => r.json() as Promise<{ people?: PersonHit[] }>)
        .then((d) => setPeople(d.people ?? []))
        .catch(() => setPeople([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
      setLoading(false);
    };
  }, [open, query, canSearchPeople]);

  const screenRows: Row[] = useMemo(() => {
    const hits = query.trim().length === 0 ? screens.slice(0, 6) : rankScreens(screens, query);
    return hits.map((s) => ({ key: `s:${s.href}`, href: s.href, label: s.label, note: s.group || null }));
  }, [screens, query]);

  const personRows: Row[] = useMemo(
    () => people.map((p) => ({ key: `p:${p.kind}:${p.id}`, href: p.href, label: p.name, note: p.note })),
    [people],
  );

  const rows = useMemo(() => [...screenRows, ...personRows], [screenRows, personRows]);

  useEffect(() => {
    setActive(0);
  }, [query, canSearchPeople]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setPeople([]);
  };

  const go = (href: string) => {
    close();
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (rows.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % rows.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + rows.length) % rows.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(rows[Math.min(active, rows.length - 1)].href);
    }
  };

  const activeRow = rows[Math.min(active, Math.max(rows.length - 1, 0))];

  return (
    <>
      <button type="button" className="header-search-trigger" onClick={() => setOpen(true)}>
        検索
        <span className="kbd-hint header-search-key">{mac ? "⌘K" : "Ctrl+K"}</span>
      </button>

      <dialog
        ref={dialogRef}
        className="search-dialog"
        aria-label="画面と人を探す"
        onClose={close}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        <div className="search-dialog-body">
          <div className="search-dialog-head">
            <input
              ref={inputRef}
              type="search"
              className="input search-input"
              autoFocus
              value={query}
              placeholder={canSearchPeople ? "画面の名前、人の名前" : "画面の名前"}
              aria-label="探しているもの"
              role="combobox"
              aria-expanded={rows.length > 0}
              aria-controls="search-result-list"
              aria-activedescendant={activeRow ? `search-row-${activeRow.key}` : undefined}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <p className="footnote m-0">上下キーで選び、Enter で開きます。</p>
          </div>

          <div className="search-dialog-list">
            <ul id="search-result-list" className="search-list" role="listbox" aria-label="見つかったもの">
              {screenRows.length > 0 && (
                <li className="search-group-title" role="presentation">
                  画面
                </li>
              )}
              {screenRows.map((r) => (
                <SearchRow key={r.key} row={r} active={rows[active]?.key === r.key} onPick={go} />
              ))}

              {personRows.length > 0 && (
                <li className="search-group-title" role="presentation">
                  人
                </li>
              )}
              {personRows.map((r) => (
                <SearchRow key={r.key} row={r} active={rows[active]?.key === r.key} onPick={go} />
              ))}
            </ul>

            {rows.length === 0 && (
              <p className="footnote m-0">
                {loading ? "探しています…" : "見つかりませんでした。別の言い方で試してください。"}
              </p>
            )}
            {!canSearchPeople && query.trim().length > 0 && (
              <p className="footnote m-0">探せるのは画面だけです。人の一覧を見る権限がありません。</p>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}

function SearchRow({ row, active, onPick }: { row: Row; active: boolean; onPick: (href: string) => void }) {
  return (
    <li id={`search-row-${row.key}`} role="option" aria-selected={active} className="search-row" data-active={active}>
      <button type="button" className="search-row-btn" onClick={() => onPick(row.href)}>
        <span className="search-row-label">{row.label}</span>
        {row.note && <span className="search-row-note">{row.note}</span>}
      </button>
    </li>
  );
}
