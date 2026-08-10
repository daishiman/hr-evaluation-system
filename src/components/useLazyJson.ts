"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * 「開いたときだけ読む」ための共通の読み込み処理。
 *
 * 参考データ（ランク基準・元の配点表）は件数が多く、画面を開いた瞬間に
 * すべてHTMLへ埋め込むと、ほとんどの人が見ない情報のために毎回数十KBを
 * 送ることになる。折りたたみを開いたときに初めて取りに行く。
 *
 * 一度読んだURLは覚えておき、閉じて開き直しても取り直さない。
 * この控えは画面を移動すると消える（常に最新を読み直したいため、
 * ブラウザに残る仕組みにはしない）。
 */
const cache = new Map<string, unknown>();

export interface LazyJson<T> {
  data: T | null;
  /** 読み込み中かどうか */
  loading: boolean;
  /** 読めなかった理由（そのまま画面に出せる日本語） */
  error: string | null;
  /** 控えを捨てて読み直す。保存したあとに古い値が残らないようにするために使う */
  reload: () => void;
}

export function useLazyJson<T>(url: string | null, enabled: boolean): LazyJson<T> {
  const [data, setData] = useState<T | null>(() => (url ? ((cache.get(url) as T) ?? null) : null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* 読み直しの合図。保存後にこれを進めると、控えを捨ててもう一度取りに行く */
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => {
    if (url) cache.delete(url);
    setNonce((n) => n + 1);
  }, [url]);

  useEffect(() => {
    if (!enabled || !url) return;
    const cached = cache.get(url);
    if (cached !== undefined) {
      setData(cached as T);
      setError(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(url, { headers: { accept: "application/json" } });
        const json = (await res.json()) as { ok?: boolean; message?: string };
        if (!alive) return;
        if (!res.ok || json.ok === false) {
          setError(json.message ?? "読み込めませんでした。時間をおいて開き直してください。");
          return;
        }
        cache.set(url, json);
        setData(json as T);
      } catch {
        if (alive) setError("通信できませんでした。時間をおいて開き直してください。");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [url, enabled, nonce]);

  return { data, loading, error, reload };
}
